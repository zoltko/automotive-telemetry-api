import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.alert.deleteMany();
  await prisma.sensorReading.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();

  // Create users
  const managerPassword = await bcrypt.hash('Manager123!', 10);
  const driverPassword = await bcrypt.hash('Driver123!', 10);

  const manager = await prisma.user.create({
    data: {
      email: 'manager@telemetry.com',
      passwordHash: managerPassword,
      name: 'Fleet Manager',
      role: 'manager',
    },
  });

  const driver = await prisma.user.create({
    data: {
      email: 'driver@telemetry.com',
      passwordHash: driverPassword,
      name: 'Alice Driver',
      role: 'driver',
    },
  });

  console.log(`✅ Created users: ${manager.email}, ${driver.email}`);

  // Create vehicles
  const vehicle1 = await prisma.vehicle.create({
    data: {
      ownerId: driver.id,
      make: 'Subaru',
      model: 'WRX STI',
      year: 2022,
      vin: 'JF1VA2U61N9800001',
    },
  });

  const vehicle2 = await prisma.vehicle.create({
    data: {
      ownerId: manager.id,
      make: 'Toyota',
      model: 'GR86',
      year: 2023,
      vin: 'JF1ZNAA12P8700001',
    },
  });

  console.log(`✅ Created vehicles: ${vehicle1.make} ${vehicle1.model}, ${vehicle2.make} ${vehicle2.model}`);

  // Create sensor readings for vehicle1
  const reading1 = await prisma.sensorReading.create({
    data: {
      vehicleId: vehicle1.id,
      rpm: 3400,
      oilTemp: 198.0,
      coolantTemp: 88.0,
      boostPressure: 12.0,
      batteryVoltage: 14.2,
    },
  });

  const reading2 = await prisma.sensorReading.create({
    data: {
      vehicleId: vehicle1.id,
      rpm: 7200,
      oilTemp: 245.0,
      coolantTemp: 102.0,
      boostPressure: 28.0,
      batteryVoltage: 14.1,
    },
  });

  const reading3 = await prisma.sensorReading.create({
    data: {
      vehicleId: vehicle2.id,
      rpm: 5000,
      oilTemp: 210.0,
      coolantTemp: 90.0,
      boostPressure: 0.0,
      batteryVoltage: 13.8,
    },
  });

  console.log(`✅ Created ${3} sensor readings`);

  // Create alerts
  await prisma.alert.create({
    data: {
      vehicleId: vehicle1.id,
      readingId: reading2.id,
      alertType: 'HIGH_OIL_TEMP',
      severity: 'HIGH',
      message: 'Oil temperature exceeded 240 degrees C',
      resolved: false,
    },
  });

  await prisma.alert.create({
    data: {
      vehicleId: vehicle1.id,
      readingId: reading2.id,
      alertType: 'HIGH_RPM',
      severity: 'MEDIUM',
      message: 'RPM exceeded safe operating threshold of 7000',
      resolved: false,
    },
  });

  await prisma.alert.create({
    data: {
      vehicleId: vehicle1.id,
      readingId: null,
      alertType: 'MAINTENANCE',
      severity: 'LOW',
      message: 'Oil change due in 500 km',
      resolved: false,
    },
  });

  await prisma.alert.create({
    data: {
      vehicleId: vehicle2.id,
      readingId: reading3.id,
      alertType: 'HIGH_OIL_TEMP',
      severity: 'MEDIUM',
      message: 'Oil temperature above recommended level',
      resolved: true,
    },
  });

  console.log(`✅ Created 4 alerts`);
  console.log('');
  console.log('🔐 Seed credentials:');
  console.log('  Manager: manager@telemetry.com / Manager123!');
  console.log('  Driver:  driver@telemetry.com  / Driver123!');
  console.log(`  Vehicle1 ID: ${vehicle1.id} (owned by driver)`);
  console.log(`  Vehicle2 ID: ${vehicle2.id} (owned by manager)`);
  console.log(`  SensorReading IDs: ${reading1.id}, ${reading2.id}, ${reading3.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
