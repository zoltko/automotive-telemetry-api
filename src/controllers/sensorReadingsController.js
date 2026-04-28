import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Thresholds for auto-alert generation
const THRESHOLDS = {
  rpm:            { max: 7000,  alertType: 'HIGH_RPM',           severity: 'MEDIUM', message: 'RPM exceeded safe operating threshold of 7000' },
  oilTemp:        { max: 240,   alertType: 'HIGH_OIL_TEMP',      severity: 'HIGH',   message: 'Oil temperature exceeded 240 degrees C' },
  coolantTemp:    { max: 100,   alertType: 'HIGH_COOLANT_TEMP',  severity: 'HIGH',   message: 'Coolant temperature exceeded 100 degrees C' },
  boostPressure:  { max: 25,    alertType: 'HIGH_BOOST',         severity: 'CRITICAL', message: 'Boost pressure exceeded 25 PSI' },
  batteryVoltage: { min: 11.5,  alertType: 'LOW_BATTERY',        severity: 'MEDIUM', message: 'Battery voltage below 11.5V' },
};

async function checkAndCreateAlerts(vehicleId, readingId, data) {
  const warnings = [];
  const alertsToCreate = [];

  if (data.rpm > THRESHOLDS.rpm.max) {
    warnings.push(THRESHOLDS.rpm.message);
    alertsToCreate.push({ vehicleId, readingId, ...THRESHOLDS.rpm });
  }
  if (data.oilTemp > THRESHOLDS.oilTemp.max) {
    warnings.push(THRESHOLDS.oilTemp.message);
    alertsToCreate.push({ vehicleId, readingId, ...THRESHOLDS.oilTemp });
  }
  if (data.coolantTemp > THRESHOLDS.coolantTemp.max) {
    warnings.push(THRESHOLDS.coolantTemp.message);
    alertsToCreate.push({ vehicleId, readingId, ...THRESHOLDS.coolantTemp });
  }
  if (data.boostPressure > THRESHOLDS.boostPressure.max) {
    warnings.push(THRESHOLDS.boostPressure.message);
    alertsToCreate.push({ vehicleId, readingId, ...THRESHOLDS.boostPressure });
  }
  if (data.batteryVoltage < THRESHOLDS.batteryVoltage.min) {
    warnings.push(THRESHOLDS.batteryVoltage.message);
    alertsToCreate.push({ vehicleId, readingId, ...THRESHOLDS.batteryVoltage });
  }

  if (alertsToCreate.length > 0) {
    await prisma.alert.createMany({ data: alertsToCreate });
  }
  return warnings;
}

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

export async function createReading(req, res) {
  const { rpm, oilTemp, coolantTemp, boostPressure, batteryVoltage } = req.body;

  if (rpm === undefined || oilTemp === undefined || coolantTemp === undefined ||
      boostPressure === undefined || batteryVoltage === undefined) {
    return res.status(400).json({ error: 'All sensor fields required: rpm, oilTemp, coolantTemp, boostPressure, batteryVoltage' });
  }

  const fields = { rpm, oilTemp, coolantTemp, boostPressure, batteryVoltage };
  for (const [key, val] of Object.entries(fields)) {
    if (typeof val !== 'number' || val < 0) {
      return res.status(400).json({ error: `Invalid value for ${key}: must be a non-negative number` });
    }
  }

  try {
    const vehicle = await resolveVehicleAccess(req.params.vehicleId, req.user.id, req.user.role, res);
    if (!vehicle) return;

    const reading = await prisma.sensorReading.create({
      data: { vehicleId: vehicle.id, rpm, oilTemp, coolantTemp, boostPressure, batteryVoltage },
    });

    const warnings = await checkAndCreateAlerts(vehicle.id, reading.id, { rpm, oilTemp, coolantTemp, boostPressure, batteryVoltage });

    return res.status(201).json({ ...reading, warnings });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getReadings(req, res) {
  try {
    const vehicle = await resolveVehicleAccess(req.params.vehicleId, req.user.id, req.user.role, res);
    if (!vehicle) return;

    const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
    const since = req.query.since ? new Date(req.query.since) : undefined;

    const where = { vehicleId: vehicle.id };
    if (since && !isNaN(since)) where.recordedAt = { gte: since };

    const readings = await prisma.sensorReading.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: limit && !isNaN(limit) ? limit : undefined,
    });

    return res.status(200).json(readings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getReadingById(req, res) {
  const readingId = parseInt(req.params.id);
  if (isNaN(readingId) || readingId <= 0) {
    return res.status(400).json({ error: 'Invalid reading ID' });
  }

  try {
    const vehicle = await resolveVehicleAccess(req.params.vehicleId, req.user.id, req.user.role, res);
    if (!vehicle) return;

    const reading = await prisma.sensorReading.findFirst({
      where: { id: readingId, vehicleId: vehicle.id },
    });
    if (!reading) return res.status(404).json({ error: 'Sensor reading not found' });

    return res.status(200).json(reading);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateReading(req, res) {
  const readingId = parseInt(req.params.id);
  if (isNaN(readingId) || readingId <= 0) {
    return res.status(400).json({ error: 'Invalid reading ID' });
  }

  const allowed = ['rpm', 'oilTemp', 'coolantTemp', 'boostPressure', 'batteryVoltage'];
  const data = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      const val = Number(req.body[field]);
      if (isNaN(val) || val < 0) {
        return res.status(400).json({ error: `Invalid value for ${field}` });
      }
      data[field] = val;
    }
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  try {
    const vehicle = await resolveVehicleAccess(req.params.vehicleId, req.user.id, req.user.role, res);
    if (!vehicle) return;

    const reading = await prisma.sensorReading.findFirst({
      where: { id: readingId, vehicleId: vehicle.id },
    });
    if (!reading) return res.status(404).json({ error: 'Sensor reading not found' });

    const updated = await prisma.sensorReading.update({ where: { id: readingId }, data });
    return res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteReading(req, res) {
  const readingId = parseInt(req.params.id);
  if (isNaN(readingId) || readingId <= 0) {
    return res.status(400).json({ error: 'Invalid reading ID' });
  }

  try {
    const vehicle = await resolveVehicleAccess(req.params.vehicleId, req.user.id, req.user.role, res);
    if (!vehicle) return;

    const reading = await prisma.sensorReading.findFirst({
      where: { id: readingId, vehicleId: vehicle.id },
    });
    if (!reading) return res.status(404).json({ error: 'Sensor reading not found' });

    // Unlink alerts referencing this reading
    await prisma.alert.updateMany({
      where: { readingId: readingId },
      data: { readingId: null },
    });

    await prisma.sensorReading.delete({ where: { id: readingId } });
    return res.status(200).json({ id: readingId, vehicleId: vehicle.id, deleted: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
