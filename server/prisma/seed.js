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
      description: 'Элегантный бутик-отель в самом сердце Москвы с панорамным видом на город.',
      tagline: 'Ваш лунный свет в сердце столицы',
      aboutText:
        'Moonglow Hotel — это уникальное сочетание современного комфорта и изысканной атмосферы. ' +
        'Расположенный на Тверской улице, отель предлагает безупречный сервис, стильные номера ' +
        'и незабываемые впечатления для каждого гостя. Наша команда заботится о том, чтобы ваше ' +
        'пребывание было идеальным — от момента заселения до выезда.',
      heroImageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=80',
      city: 'Москва',
      address: 'ул. Тверская, д. 1',
      phone: '+7 (495) 123-45-67',
      email: 'info@moonglow.hotel',
      stars: 4,
      latitude: 55.7558,
      longitude: 37.6173,
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

  // ── Seed demo users (one per role) ───────────────────────────────────────

  console.log('\nSeeding demo users...');

  const HASHED_PASSWORD = '$2a$12$TB7f4Vvs3ohQGodEC25nvOIeI/xwk5vf2tyF/nz1GD0UP/t/kiqkK';

  const usersData = [
    { email: 'user@u.com',    roleName: 'user',    firstName: 'User',    lastName: 'Demo' },
    { email: 'manager@u.com', roleName: 'manager', firstName: 'Manager', lastName: 'Demo' },
    { email: 'admin@u.com',   roleName: 'admin',   firstName: 'Admin',   lastName: 'Demo' },
  ];

  for (const u of usersData) {
    const role = await prisma.role.findUnique({ where: { name: u.roleName } });
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        password: HASHED_PASSWORD,
        firstName: u.firstName,
        lastName: u.lastName,
        roleId: role.id,
      },
    });
    console.log(`  User "${u.email}" (role: ${u.roleName}) — OK`);
  }

  // ── Seed past bookings with reviews ─────────────────────────────────────────

  console.log('\nSeeding past bookings with reviews...');

  const demoUser = await prisma.user.findUnique({ where: { email: 'user@u.com' } });

  if (!demoUser) {
    console.log('  Demo user not found, skipping past bookings.');
  } else {
    /**
     * Each entry fully describes a past stay:
     *   holdId / bookingId / paymentId / reviewId  — stable pre-set UUIDs so
     *   the seed is idempotent (re-running won't duplicate rows).
     */
    const pastStays = [
      {
        holdId:    'b0000001-0000-0000-0000-000000000001',
        bookingId: 'b0000002-0000-0000-0000-000000000001',
        paymentId: 'b0000003-0000-0000-0000-000000000001',
        reviewId:  'b0000004-0000-0000-0000-000000000001',
        roomNo:       'MG-101',
        startDate:    new Date('2025-09-10'),
        endDate:      new Date('2025-09-13'),
        totalAmount:  240,
        stripeIntentId: 'pi_seed_0000000000001',
        bookingStatus:  'CHECKED_OUT',
        paymentStatus:  'SUCCEEDED',
        rating: 5,
        text:   'Отличный номер! Очень чисто, уютная обстановка, прекрасный вид на город. Обязательно вернусь.',
      },
      {
        holdId:    'b0000001-0000-0000-0000-000000000002',
        bookingId: 'b0000002-0000-0000-0000-000000000002',
        paymentId: 'b0000003-0000-0000-0000-000000000002',
        reviewId:  'b0000004-0000-0000-0000-000000000002',
        roomNo:       'MG-102',
        startDate:    new Date('2025-10-01'),
        endDate:      new Date('2025-10-04'),
        totalAmount:  360,
        stripeIntentId: 'pi_seed_0000000000002',
        bookingStatus:  'CHECKED_OUT',
        paymentStatus:  'SUCCEEDED',
        rating: 4,
        text:   'Хороший номер, удобная кровать. Немного шумновато по утрам из-за соседнего номера, но персонал был очень вежлив.',
      },
      {
        holdId:    'b0000001-0000-0000-0000-000000000003',
        bookingId: 'b0000002-0000-0000-0000-000000000003',
        paymentId: 'b0000003-0000-0000-0000-000000000003',
        reviewId:  'b0000004-0000-0000-0000-000000000003',
        roomNo:       'MG-201',
        startDate:    new Date('2025-10-20'),
        endDate:      new Date('2025-10-25'),
        totalAmount:  900,
        stripeIntentId: 'pi_seed_0000000000003',
        bookingStatus:  'CHECKED_OUT',
        paymentStatus:  'SUCCEEDED',
        rating: 5,
        text:   'Просторный номер с отличным оснащением. Завтрак включён — очень вкусный. Однозначно рекомендую для романтического уикенда.',
      },
      {
        holdId:    'b0000001-0000-0000-0000-000000000004',
        bookingId: 'b0000002-0000-0000-0000-000000000004',
        paymentId: 'b0000003-0000-0000-0000-000000000004',
        reviewId:  'b0000004-0000-0000-0000-000000000004',
        roomNo:       'MG-202',
        startDate:    new Date('2025-11-05'),
        endDate:      new Date('2025-11-10'),
        totalAmount:  1500,
        stripeIntentId: 'pi_seed_0000000000004',
        bookingStatus:  'CHECKED_OUT',
        paymentStatus:  'SUCCEEDED',
        rating: 3,
        text:   'Номер большой, подходит для семьи. Но кондиционер шумел, и горничная убирала только раз в 2 дня. Ожидали большего за такую цену.',
      },
      {
        holdId:    'b0000001-0000-0000-0000-000000000005',
        bookingId: 'b0000002-0000-0000-0000-000000000005',
        paymentId: 'b0000003-0000-0000-0000-000000000005',
        reviewId:  'b0000004-0000-0000-0000-000000000005',
        roomNo:       'MG-301',
        startDate:    new Date('2025-12-27'),
        endDate:      new Date('2026-01-02'),
        totalAmount:  3000,
        stripeIntentId: 'pi_seed_0000000000005',
        bookingStatus:  'CHECKED_OUT',
        paymentStatus:  'SUCCEEDED',
        rating: 5,
        text:   'Президентский люкс — это нечто особенное. Встретили Новый год в полном комфорте. Персональный консьерж, живые цветы в номере, панорамный вид. Незабываемо.',
      },
      // One cancelled-after-payment stay (also eligible for review)
      {
        holdId:    'b0000001-0000-0000-0000-000000000006',
        bookingId: 'b0000002-0000-0000-0000-000000000006',
        paymentId: 'b0000003-0000-0000-0000-000000000006',
        reviewId:  'b0000004-0000-0000-0000-000000000006',
        roomNo:       'MG-102',
        startDate:    new Date('2025-08-15'),
        endDate:      new Date('2025-08-18'),
        totalAmount:  360,
        stripeIntentId: 'pi_seed_0000000000006',
        bookingStatus:  'CANCELLED',
        paymentStatus:  'SUCCEEDED',
        cancellationSource: 'GUEST',
        cancelledAt: new Date('2025-08-10'),
        refundStatus: 'FULL',
        rating: 2,
        text:   'Пришлось отменить поездку по личным обстоятельствам. Возврат средств прошёл быстро, но хотелось бы более гибких условий отмены.',
      },
    ];

    // Also create a second reviewer (manager acts as a regular guest for demo purposes)
    const managerUser = await prisma.user.findUnique({ where: { email: 'manager@u.com' } });

    const managerStays = [
      {
        holdId:    'b0000001-0000-0000-0000-000000000007',
        bookingId: 'b0000002-0000-0000-0000-000000000007',
        paymentId: 'b0000003-0000-0000-0000-000000000007',
        reviewId:  'b0000004-0000-0000-0000-000000000007',
        roomNo:       'MG-201',
        startDate:    new Date('2025-11-20'),
        endDate:      new Date('2025-11-22'),
        totalAmount:  360,
        stripeIntentId: 'pi_seed_0000000000007',
        bookingStatus:  'CHECKED_OUT',
        paymentStatus:  'SUCCEEDED',
        rating: 4,
        text:   'Удобный номер, хорошее расположение. Приятный персонал, быстрое заселение. Рекомендую для деловых поездок.',
      },
      {
        holdId:    'b0000001-0000-0000-0000-000000000008',
        bookingId: 'b0000002-0000-0000-0000-000000000008',
        paymentId: 'b0000003-0000-0000-0000-000000000008',
        reviewId:  'b0000004-0000-0000-0000-000000000008',
        roomNo:       'MG-101',
        startDate:    new Date('2025-07-03'),
        endDate:      new Date('2025-07-06'),
        totalAmount:  240,
        stripeIntentId: 'pi_seed_0000000000008',
        bookingStatus:  'CHECKED_OUT',
        paymentStatus:  'SUCCEEDED',
        rating: 5,
        text:   'Небольшой, но очень функциональный номер. Всё необходимое есть. Отличное соотношение цены и качества.',
      },
    ];

    /**
     * Create a single stay: hold → booking → payment → review.
     * All operations use upsert / createOrSkip to stay idempotent.
     */
    async function createStay(userId, stay) {
      const {
        holdId, bookingId, paymentId, reviewId,
        roomNo, startDate, endDate, totalAmount,
        stripeIntentId, bookingStatus, paymentStatus,
        cancellationSource, cancelledAt, refundStatus,
        rating, text,
      } = stay;

      // 1. RoomHold (CONVERTED — already used by the booking)
      await prisma.roomHold.upsert({
        where:  { holdId },
        update: {},
        create: {
          holdId,
          roomNo,
          userId,
          startDate,
          endDate,
          expiresAt: startDate, // already in the past
          status:    'CONVERTED',
        },
      });

      // 2. Booking
      await prisma.booking.upsert({
        where:  { bookingId },
        update: {},
        create: {
          bookingId,
          holdId,
          userId,
          roomNo,
          startDate,
          endDate,
          status:             bookingStatus,
          totalAmount,
          cancelledAt:        cancelledAt ?? null,
          cancelledByUserId:  cancelledAt ? userId : null,
          cancellationSource: cancellationSource ?? null,
          refundStatus:       refundStatus ?? 'NONE',
        },
      });

      // 3. Payment
      await prisma.payment.upsert({
        where:  { stripePaymentIntentId: stripeIntentId },
        update: {},
        create: {
          id:                   paymentId,
          stripePaymentIntentId: stripeIntentId,
          amount:               totalAmount,
          currency:             'rub',
          status:               paymentStatus,
          bookingId,
        },
      });

      // 4. Review (unique on bookingId)
      await prisma.review.upsert({
        where:  { bookingId },
        update: {},
        create: {
          reviewId,
          bookingId,
          userId,
          roomNo,
          rating,
          text: text ?? null,
        },
      });

      console.log(`  Stay ${roomNo} [${startDate.toISOString().slice(0, 10)} → ${endDate.toISOString().slice(0, 10)}] ★${rating} — OK`);
    }

    for (const stay of pastStays) {
      await createStay(demoUser.id, stay);
    }

    if (managerUser) {
      for (const stay of managerStays) {
        await createStay(managerUser.id, stay);
      }
    }
  }

  console.log('\nSeed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
