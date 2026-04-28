import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

async function resolveVehicleAccess(vehicleId, userId, userRole, res) {
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

export async function createAlert(req, res) {
  const { alertType, severity, message, readingId } = req.body;

  if (!alertType || !severity || !message) {
    return res.status(400).json({ error: 'alertType, severity, and message are required' });
  }
  if (!VALID_SEVERITIES.includes(severity)) {
    return res.status(400).json({ error: `severity must be one of: ${VALID_SEVERITIES.join(', ')}` });
  }

  try {
    const vehicle = await resolveVehicleAccess(req.params.vehicleId, req.user.id, req.user.role, res);
    if (!vehicle) return;

    const alert = await prisma.alert.create({
      data: {
        vehicleId: vehicle.id,
        readingId: readingId ? parseInt(readingId) : null,
        alertType,
        severity,
        message,
      },
    });
    return res.status(201).json(alert);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAlerts(req, res) {
  try {
    const vehicle = await resolveVehicleAccess(req.params.vehicleId, req.user.id, req.user.role, res);
    if (!vehicle) return;

    const where = { vehicleId: vehicle.id };
    if (req.query.resolved !== undefined) {
      where.resolved = req.query.resolved === 'true';
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(alerts);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAlertById(req, res) {
  const alertId = parseInt(req.params.id);
  if (isNaN(alertId) || alertId <= 0) {
    return res.status(400).json({ error: 'Invalid alert ID' });
  }

  try {
    const vehicle = await resolveVehicleAccess(req.params.vehicleId, req.user.id, req.user.role, res);
    if (!vehicle) return;

    const alert = await prisma.alert.findFirst({
      where: { id: alertId, vehicleId: vehicle.id },
    });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    return res.status(200).json(alert);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateAlert(req, res) {
  const alertId = parseInt(req.params.id);
  if (isNaN(alertId) || alertId <= 0) {
    return res.status(400).json({ error: 'Invalid alert ID' });
  }

  try {
    const vehicle = await resolveVehicleAccess(req.params.vehicleId, req.user.id, req.user.role, res);
    if (!vehicle) return;

    const alert = await prisma.alert.findFirst({
      where: { id: alertId, vehicleId: vehicle.id },
    });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    const isOwner = vehicle.ownerId === req.user.id;
    const isManager = req.user.role === 'manager';

    // Owners can only update resolved; managers can update any field
    const data = {};

    if (isManager) {
      if (req.body.resolved !== undefined) data.resolved = Boolean(req.body.resolved);
      if (req.body.severity) {
        if (!VALID_SEVERITIES.includes(req.body.severity)) {
          return res.status(400).json({ error: `severity must be one of: ${VALID_SEVERITIES.join(', ')}` });
        }
        data.severity = req.body.severity;
      }
      if (req.body.message) data.message = req.body.message;
      if (req.body.alertType) data.alertType = req.body.alertType;
    } else if (isOwner) {
      if (req.body.resolved !== undefined) data.resolved = Boolean(req.body.resolved);
      else {
        return res.status(403).json({ error: 'Drivers can only update the resolved field' });
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await prisma.alert.update({ where: { id: alertId }, data });
    return res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteAlert(req, res) {
  const alertId = parseInt(req.params.id);
  if (isNaN(alertId) || alertId <= 0) {
    return res.status(400).json({ error: 'Invalid alert ID' });
  }

  // Only managers can delete alerts
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Manager role required to delete alerts' });
  }

  try {
    const vehicle = await resolveVehicleAccess(req.params.vehicleId, req.user.id, req.user.role, res);
    if (!vehicle) return;

    const alert = await prisma.alert.findFirst({
      where: { id: alertId, vehicleId: vehicle.id },
    });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    await prisma.alert.delete({ where: { id: alertId } });
    return res.status(200).json({ id: alertId, vehicleId: vehicle.id, deleted: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
