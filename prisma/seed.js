const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ROLES = ['user', 'manager', 'admin'];

async function main() {
  console.log('Seeding roles...');

  for (const name of ROLES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`  Role "${name}" — OK`);
  }

  // ── Seed a demo hotel ───────────────────────────────────────────────────

  console.log('\nSeeding demo hotel...');

  const hotel = await prisma.hotel.upsert({
    where: { hotelCode: 'MOONGLOW' },
    update: {},
    create: {
      hotelCode: 'MOONGLOW',
      name: 'Moonglow Hotel',
      description: 'A luxurious hotel in the heart of the city',
      city: 'Moscow',
      address: 'Tverskaya St, 1',
      phone: '+74951234567',
      email: 'info@moonglow.hotel',
    },
  });
  console.log(`  Hotel "${hotel.name}" — OK`);

  // ── Seed services ─────────────────────────────────────────────────────────

  console.log('\nSeeding services...');

  const servicesData = [
    { serviceCode: 'WIFI',       title: 'Wi-Fi',              basePrice: 0,    priceType: 'PER_NIGHT', icon: 'wifi' },
    { serviceCode: 'BREAKFAST',  title: 'Breakfast',           basePrice: 15,   priceType: 'PER_NIGHT', icon: 'coffee' },
    { serviceCode: 'PARKING',    title: 'Parking',             basePrice: 10,   priceType: 'PER_NIGHT', icon: 'car' },
    { serviceCode: 'SPA',        title: 'Spa Access',          basePrice: 50,   priceType: 'ONE_TIME',  icon: 'droplet' },
    { serviceCode: 'MINIBAR',    title: 'Mini Bar',            basePrice: 25,   priceType: 'PER_NIGHT', icon: 'wine' },
    { serviceCode: 'LAUNDRY',    title: 'Laundry Service',     basePrice: 20,   priceType: 'ONE_TIME',  icon: 'shirt' },
    { serviceCode: 'TRANSFER',   title: 'Airport Transfer',    basePrice: 40,   priceType: 'ONE_TIME',  icon: 'plane' },
    { serviceCode: 'GYM',        title: 'Gym Access',          basePrice: 0,    priceType: 'PER_NIGHT', icon: 'dumbbell' },
  ];

  for (const s of servicesData) {
    await prisma.service.upsert({
      where: { serviceCode: s.serviceCode },
      update: {},
      create: s,
    });
    console.log(`  Service "${s.title}" — OK`);
  }

  // ── Seed rooms ────────────────────────────────────────────────────────────

  console.log('\nSeeding rooms...');

  const roomsData = [
    { roomNo: 'MG-101', hotelCode: 'MOONGLOW', title: 'Standard Single',   capacity: 1, bedsCount: 1, floor: 1, area: 20,  basePrice: 80 },
    { roomNo: 'MG-102', hotelCode: 'MOONGLOW', title: 'Standard Double',   capacity: 2, bedsCount: 1, floor: 1, area: 25,  basePrice: 120 },
    { roomNo: 'MG-201', hotelCode: 'MOONGLOW', title: 'Deluxe Double',     capacity: 2, bedsCount: 2, floor: 2, area: 35,  basePrice: 180 },
    { roomNo: 'MG-202', hotelCode: 'MOONGLOW', title: 'Family Suite',      capacity: 4, bedsCount: 3, floor: 2, area: 55,  basePrice: 300 },
    { roomNo: 'MG-301', hotelCode: 'MOONGLOW', title: 'Presidential Suite', capacity: 2, bedsCount: 1, floor: 3, area: 80,  basePrice: 500 },
  ];

  for (const r of roomsData) {
    await prisma.room.upsert({
      where: { roomNo: r.roomNo },
      update: {},
      create: r,
    });
    console.log(`  Room "${r.roomNo} — ${r.title}" — OK`);
  }

  // ── Seed room-service associations ────────────────────────────────────────

  console.log('\nSeeding room-service associations...');

  const roomServicesData = [
    // Standard Single: Wi-Fi included, breakfast optional (on by default)
    { roomNo: 'MG-101', serviceCode: 'WIFI',      defaultState: 'INCLUDED' },
    { roomNo: 'MG-101', serviceCode: 'BREAKFAST',  defaultState: 'OPTIONAL_ON' },
    { roomNo: 'MG-101', serviceCode: 'PARKING',    defaultState: 'OPTIONAL_OFF' },

    // Standard Double
    { roomNo: 'MG-102', serviceCode: 'WIFI',      defaultState: 'INCLUDED' },
    { roomNo: 'MG-102', serviceCode: 'BREAKFAST',  defaultState: 'OPTIONAL_ON' },
    { roomNo: 'MG-102', serviceCode: 'PARKING',    defaultState: 'OPTIONAL_OFF' },
    { roomNo: 'MG-102', serviceCode: 'LAUNDRY',    defaultState: 'OPTIONAL_OFF' },

    // Deluxe Double
    { roomNo: 'MG-201', serviceCode: 'WIFI',      defaultState: 'INCLUDED' },
    { roomNo: 'MG-201', serviceCode: 'BREAKFAST',  defaultState: 'INCLUDED' },
    { roomNo: 'MG-201', serviceCode: 'PARKING',    defaultState: 'OPTIONAL_ON' },
    { roomNo: 'MG-201', serviceCode: 'MINIBAR',    defaultState: 'OPTIONAL_ON' },
    { roomNo: 'MG-201', serviceCode: 'GYM',        defaultState: 'INCLUDED' },
    { roomNo: 'MG-201', serviceCode: 'LAUNDRY',    defaultState: 'OPTIONAL_OFF' },

    // Family Suite
    { roomNo: 'MG-202', serviceCode: 'WIFI',      defaultState: 'INCLUDED' },
    { roomNo: 'MG-202', serviceCode: 'BREAKFAST',  defaultState: 'INCLUDED' },
    { roomNo: 'MG-202', serviceCode: 'PARKING',    defaultState: 'INCLUDED' },
    { roomNo: 'MG-202', serviceCode: 'GYM',        defaultState: 'INCLUDED' },
    { roomNo: 'MG-202', serviceCode: 'MINIBAR',    defaultState: 'OPTIONAL_ON' },
    { roomNo: 'MG-202', serviceCode: 'LAUNDRY',    defaultState: 'OPTIONAL_ON' },
    { roomNo: 'MG-202', serviceCode: 'SPA',        defaultState: 'OPTIONAL_OFF' },
    { roomNo: 'MG-202', serviceCode: 'TRANSFER',   defaultState: 'OPTIONAL_OFF' },

    // Presidential Suite: everything included or on by default
    { roomNo: 'MG-301', serviceCode: 'WIFI',      defaultState: 'INCLUDED' },
    { roomNo: 'MG-301', serviceCode: 'BREAKFAST',  defaultState: 'INCLUDED' },
    { roomNo: 'MG-301', serviceCode: 'PARKING',    defaultState: 'INCLUDED' },
    { roomNo: 'MG-301', serviceCode: 'MINIBAR',    defaultState: 'INCLUDED' },
    { roomNo: 'MG-301', serviceCode: 'GYM',        defaultState: 'INCLUDED' },
    { roomNo: 'MG-301', serviceCode: 'SPA',        defaultState: 'OPTIONAL_ON' },
    { roomNo: 'MG-301', serviceCode: 'TRANSFER',   defaultState: 'OPTIONAL_ON' },
    { roomNo: 'MG-301', serviceCode: 'LAUNDRY',    defaultState: 'OPTIONAL_ON' },
  ];

  for (const rs of roomServicesData) {
    await prisma.roomService.upsert({
      where: {
        roomNo_serviceCode: { roomNo: rs.roomNo, serviceCode: rs.serviceCode },
      },
      update: {},
      create: rs,
    });
    console.log(`  ${rs.roomNo} ← ${rs.serviceCode} [${rs.defaultState}] — OK`);
  }

  console.log('\nSeed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
