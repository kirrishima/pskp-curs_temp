/**
 * Prisma Decimal → plain Number serializers.
 *
 * Prisma's `Decimal` type serialises to a string when passed through
 * `JSON.stringify` / `res.json()`.  Every route that returns a model
 * containing a Decimal column must wrap the result with the appropriate
 * serializer from this module before sending the response.
 *
 * Serializers are intentionally pure functions (no side-effects) and handle
 * `null` / `undefined` gracefully so callers never need defensive checks.
 */

// ─── Primitive helper ─────────────────────────────────────────────────────────

/**
 * Converts a Prisma Decimal (or anything coercible to a number) to a plain
 * JavaScript `number`.  Returns `null` for `null` / `undefined` inputs so
 * nullable Decimal columns preserve their nullability.
 *
 * @param {*} v
 * @returns {number | null}
 */
function toNum(v) {
  if (v === null || v === undefined) return null;
  return Number(v);
}

// ─── Per-model serializers ────────────────────────────────────────────────────

/**
 * Serializes a `Service` record.
 * Decimal fields: basePrice
 */
function serializeService(service) {
  if (!service) return service;
  return {
    ...service,
    basePrice: service.basePrice !== null && service.basePrice !== undefined
      ? Number(service.basePrice)
      : 0,
  };
}

/**
 * Serializes a `RoomService` join record, including its nested `service`.
 * Decimal fields: service.basePrice  (own record has none)
 */
function serializeRoomService(rs) {
  if (!rs) return rs;
  return {
    ...rs,
    service: rs.service ? serializeService(rs.service) : rs.service,
  };
}

/**
 * Serializes a `Room` record.
 * Decimal fields: area, basePrice
 * Nested: hotel (latitude, longitude), roomServices[].service.basePrice
 */
function serializeRoom(room) {
  if (!room) return room;
  return {
    ...room,
    area: toNum(room.area),
    basePrice: toNum(room.basePrice),
    hotel: room.hotel ? serializeHotel(room.hotel) : room.hotel,
    roomServices: Array.isArray(room.roomServices)
      ? room.roomServices.map(serializeRoomService)
      : room.roomServices,
  };
}

/**
 * Serializes a `Hotel` record.
 * Decimal fields: latitude, longitude
 * Nested: rooms[].area, rooms[].basePrice, rooms[].roomServices
 */
function serializeHotel(hotel) {
  if (!hotel) return hotel;
  return {
    ...hotel,
    latitude: toNum(hotel.latitude),
    longitude: toNum(hotel.longitude),
    rooms: Array.isArray(hotel.rooms)
      ? hotel.rooms.map(serializeRoom)
      : hotel.rooms,
  };
}

/**
 * Serializes a `BookingService` record.
 * Decimal fields: priceSnapshot
 * Nested: service.basePrice
 */
function serializeBookingService(bs) {
  if (!bs) return bs;
  return {
    ...bs,
    priceSnapshot: toNum(bs.priceSnapshot),
    service: bs.service ? serializeService(bs.service) : bs.service,
  };
}

/**
 * Serializes a `Payment` record.
 * Decimal fields: amount
 */
function serializePayment(payment) {
  if (!payment) return payment;
  return {
    ...payment,
    amount: toNum(payment.amount),
  };
}

/**
 * Serializes a `Booking` record.
 * Decimal fields: totalAmount
 * Nested: payment, room (with hotel + roomServices), bookingServices
 */
function serializeBooking(booking) {
  if (!booking) return booking;
  return {
    ...booking,
    totalAmount: toNum(booking.totalAmount),
    payment: booking.payment ? serializePayment(booking.payment) : booking.payment,
    room: booking.room ? serializeRoom(booking.room) : booking.room,
    bookingServices: Array.isArray(booking.bookingServices)
      ? booking.bookingServices.map(serializeBookingService)
      : booking.bookingServices,
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  toNum,
  serializeService,
  serializeRoomService,
  serializeRoom,
  serializeHotel,
  serializeBookingService,
  serializePayment,
  serializeBooking,
};
