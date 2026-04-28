import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper: check vehicle access (owner or manager)
async function getVehicleOrForbid(vehicleId, userId, userRole, res) {
  const id = parseInt(vehicleId);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid vehicle ID' });
    return null;
  }
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) {
    res.status(404).json({ error: 'Vehicle not found' });
    return null;
  }
  if (userRole !== 'manager' && vehicle.ownerId !== userId) {
    res.status(403).json({ error: 'Access denied: not the owner or a manager' });
    return null;
  }
  return vehicle;
}

export async function createVehicle(req, res) {
  const { make, model, year, vin } = req.body;

  if (!make || !model || !year || !vin) {
    return res.status(400).json({ error: 'make, model, year, and vin are required' });
  }
  const yearNum = parseInt(year);
  if (isNaN(yearNum) || yearNum < 1886 || yearNum > new Date().getFullYear() + 2) {
    return res.status(400).json({ error: 'Invalid year provided' });
  }

  try {
    const existing = await prisma.vehicle.findUnique({ where: { vin } });
    if (existing) {
      return res.status(409).json({ error: 'VIN already registered in the system' });
    }

    const vehicle = await prisma.vehicle.create({
      data: { ownerId: req.user.id, make, model, year: yearNum, vin },
    });
    return res.status(201).json(vehicle);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getVehicles(req, res) {
  try {
    let vehicles;
    if (req.user.role === 'manager') {
      vehicles = await prisma.vehicle.findMany({ orderBy: { createdAt: 'desc' } });
    } else {
      vehicles = await prisma.vehicle.findMany({
        where: { ownerId: req.user.id },
        orderBy: { createdAt: 'desc' },
      });
    }
    return res.status(200).json(vehicles);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getVehicleById(req, res) {
  try {
    const vehicle = await getVehicleOrForbid(req.params.id, req.user.id, req.user.role, res);
    if (!vehicle) return;
    return res.status(200).json(vehicle);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateVehicle(req, res) {
  const { make, model, year } = req.body;

  if (!make && !model && !year) {
    return res.status(400).json({ error: 'Provide at least one field to update: make, model, or year' });
  }

  try {
    const vehicle = await getVehicleOrForbid(req.params.id, req.user.id, req.user.role, res);
    if (!vehicle) return;

    const data = {};
    if (make) data.make = make;
    if (model) data.model = model;
    if (year) {
      const yearNum = parseInt(year);
      if (isNaN(yearNum) || yearNum < 1886) {
        return res.status(400).json({ error: 'Invalid year' });
      }
      data.year = yearNum;
    }

    const updated = await prisma.vehicle.update({ where: { id: vehicle.id }, data });
    return res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteVehicle(req, res) {
  try {
    const vehicle = await getVehicleOrForbid(req.params.id, req.user.id, req.user.role, res);
    if (!vehicle) return;

    await prisma.vehicle.delete({ where: { id: vehicle.id } });
    return res.status(200).json({ id: vehicle.id, make: vehicle.make, model: vehicle.model, deleted: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
