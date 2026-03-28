'use strict';

/**
 * Room management & availability search routes
 *
 * GET    /api/rooms/search      — search available rooms (filters, sort, keyset pagination)
 * GET    /api/rooms/:roomNo     — get room details
 * POST   /api/rooms             — create room        (admin only)
 * PATCH  /api/rooms/:roomNo     — update room        (admin only)
 * DELETE /api/rooms/:roomNo     — delete room         (admin only)
 *
 * Search available rooms:
 *   Required: checkIn, checkOut (dates)
 *   Optional filters: hotelCode, floor, title, minPrice, maxPrice,
 *                     minBeds, maxBeds, minCapacity, maxCapacity,
 *                     minArea, maxArea, services (comma-separated service codes)
 *   Sort: sortBy (basePrice|capacity|bedsCount|floor|area), sortOrder (asc|desc)
 *   Keyset Pagination: cursor, limit
 *
 * For users with role "user" the search endpoint always filters to available
 * rooms only (status = ACTIVE, no overlapping bookings). Admins can see all.
 */

const { Router } = require('express');
const { Prisma } = require('@prisma/client');
const { createLogger } = require('../logger');
const prisma = require('../services/prisma');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { authorize, resolveRole } = require('../middleware/authorize');
const { serializeRoom } = require('../utils/serializers');

const logger = createLogger('Rooms');
const router = Router();

// ── Allowed sort columns and orders ─────────────────────────────────────────

const ALLOWED_SORT_FIELDS = new Set(['basePrice', 'capacity', 'bedsCount', 'floor', 'area', 'roomNo']);
const ALLOWED_SORT_ORDERS = new Set(['asc', 'desc']);
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ── Helper: parse positive integer from query ───────────────────────────────

function parseIntParam(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseDecimalParam(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

// ── Search available rooms (GET /api/rooms/search) ──────────────────────────

router.get('/search', optionalAuthenticate, resolveRole, async (req, res) => {
  try {
    const {
      checkIn,
      checkOut,
      hotelCode,
      floor,
      title,
      minPrice,
      maxPrice,
      minBeds,
      maxBeds,
      minCapacity,
      maxCapacity,
      minArea,
      maxArea,
      services,       // comma-separated service_code list
      sortBy = 'basePrice',
      sortOrder = 'asc',
      cursor,         // keyset pagination cursor: "sortValue::roomNo"
      limit,
    } = req.query;

    // ── Validate required date range ──────────────────────────────────────

    if (!checkIn || !checkOut) {
      return res.status(400).json({ error: 'checkIn and checkOut are required (YYYY-MM-DD)' });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    if (checkInDate >= checkOutDate) {
      return res.status(400).json({ error: 'checkOut must be after checkIn' });
    }

    // ── Validate sort ─────────────────────────────────────────────────────

    const safeSortBy = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : 'basePrice';
    const safeSortOrder = ALLOWED_SORT_ORDERS.has(sortOrder) ? sortOrder : 'asc';

    // ── Validate limit ────────────────────────────────────────────────────

    let safeLimit = parseIntParam(limit) || DEFAULT_LIMIT;
    if (safeLimit < 1) safeLimit = DEFAULT_LIMIT;
    if (safeLimit > MAX_LIMIT) safeLimit = MAX_LIMIT;

    // ── Determine if user is admin ────────────────────────────────────────

    const isAdmin = req.userRole === 'admin';

    // ── Build WHERE conditions ────────────────────────────────────────────
    // For regular users: only ACTIVE rooms with no overlapping confirmed/pending bookings
    // For admins: all rooms (can still filter by status if they want)

    const where = {};

    if (!isAdmin) {
      where.status = 'ACTIVE';
    }

    if (hotelCode) {
      where.hotelCode = hotelCode;
    }

    const floorVal = parseIntParam(floor);
    if (floorVal !== undefined) {
      where.floor = floorVal;
    }

    if (title) {
      where.title = { contains: title, mode: 'insensitive' };
    }

    // Price range
    const minP = parseDecimalParam(minPrice);
    const maxP = parseDecimalParam(maxPrice);
    if (minP !== undefined || maxP !== undefined) {
      where.basePrice = {};
      if (minP !== undefined) where.basePrice.gte = minP;
      if (maxP !== undefined) where.basePrice.lte = maxP;
    }

    // Beds range
    const minB = parseIntParam(minBeds);
    const maxB = parseIntParam(maxBeds);
    if (minB !== undefined || maxB !== undefined) {
      where.bedsCount = {};
      if (minB !== undefined) where.bedsCount.gte = minB;
      if (maxB !== undefined) where.bedsCount.lte = maxB;
    }

    // Capacity range
    const minC = parseIntParam(minCapacity);
    const maxC = parseIntParam(maxCapacity);
    if (minC !== undefined || maxC !== undefined) {
      where.capacity = {};
      if (minC !== undefined) where.capacity.gte = minC;
      if (maxC !== undefined) where.capacity.lte = maxC;
    }

    // Area range
    const minA = parseDecimalParam(minArea);
    const maxA = parseDecimalParam(maxArea);
    if (minA !== undefined || maxA !== undefined) {
      where.area = {};
      if (minA !== undefined) where.area.gte = minA;
      if (maxA !== undefined) where.area.lte = maxA;
    }

    // ── Filter by services (room must have ALL requested services) ────────

    let serviceCodeList = [];
    if (services) {
      serviceCodeList = services
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (serviceCodeList.length > 0) {
      // Room must have a room_services entry for EACH requested service code
      where.AND = serviceCodeList.map((code) => ({
        roomServices: {
          some: { serviceCode: code },
        },
      }));
    }

    // ── Availability filter: exclude rooms with overlapping bookings ──────
    // Overlap condition: booking.startDate < checkOut AND booking.endDate > checkIn
    // We exclude rooms that have any non-cancelled booking overlapping the dates.

    if (!isAdmin) {
      const now = new Date();

      // Exclude rooms with overlapping non-cancelled bookings.
      // PENDING bookings whose hold has already expired are treated as stale
      // (they will be cleaned up on the next create-intent call) and ignored.
      const overlapCondition = {
        bookings: {
          none: {
            AND: [
              { startDate: { lt: checkOutDate } },
              { endDate: { gt: checkInDate } },
              { status: { notIn: ['CANCELLED'] } },
              // Exclude stale PENDING bookings with expired holds
              {
                OR: [
                  { status: { not: 'PENDING' } },           // CONFIRMED etc. always block
                  { hold: { expiresAt: { gt: now } } },     // PENDING with active hold blocks
                ],
              },
            ],
          },
        },
      };

      // Also check room_holds that are ACTIVE and not yet expired
      const holdOverlapCondition = {
        roomHolds: {
          none: {
            AND: [
              { startDate: { lt: checkOutDate } },
              { endDate: { gt: checkInDate } },
              { status: 'ACTIVE' },
              { expiresAt: { gt: now } },
            ],
          },
        },
      };

      if (where.AND) {
        where.AND.push(overlapCondition, holdOverlapCondition);
      } else {
        where.AND = [overlapCondition, holdOverlapCondition];
      }
    }

    // ── Keyset pagination cursor parsing ──────────────────────────────────
    // Cursor format: "sortValue::roomNo"
    // We use a composite cursor: (sortField, roomNo) to guarantee uniqueness.

    let cursorCondition = undefined;

    if (cursor) {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const separatorIdx = decoded.lastIndexOf('::');

      if (separatorIdx === -1) {
        return res.status(400).json({ error: 'Invalid cursor format' });
      }

      const cursorSortValue = decoded.substring(0, separatorIdx);
      const cursorRoomNo = decoded.substring(separatorIdx + 2);

      // Build keyset condition:
      // For ASC:  (sortField > cursorValue) OR (sortField = cursorValue AND roomNo > cursorRoomNo)
      // For DESC: (sortField < cursorValue) OR (sortField = cursorValue AND roomNo > cursorRoomNo)
      // roomNo tie-breaker always ASC to ensure deterministic ordering.

      const compareOp = safeSortOrder === 'asc' ? 'gt' : 'lt';

      // Parse the sort value to the correct type
      let parsedCursorSortValue;
      if (['basePrice', 'area'].includes(safeSortBy)) {
        parsedCursorSortValue = parseFloat(cursorSortValue);
      } else if (['capacity', 'bedsCount', 'floor'].includes(safeSortBy)) {
        parsedCursorSortValue = parseInt(cursorSortValue, 10);
      } else {
        // roomNo — string comparison
        parsedCursorSortValue = cursorSortValue;
      }

      if (safeSortBy === 'roomNo') {
        // Single-field sort — just use roomNo
        cursorCondition = {
          roomNo: { gt: cursorRoomNo },
        };
      } else {
        cursorCondition = {
          OR: [
            { [safeSortBy]: { [compareOp]: parsedCursorSortValue } },
            {
              [safeSortBy]: parsedCursorSortValue,
              roomNo: { gt: cursorRoomNo },
            },
          ],
        };
      }
    }

    if (cursorCondition) {
      if (where.AND) {
        where.AND.push(cursorCondition);
      } else {
        where.AND = [cursorCondition];
      }
    }

    // ── Query ─────────────────────────────────────────────────────────────

    const orderBy = [];
    if (safeSortBy !== 'roomNo') {
      orderBy.push({ [safeSortBy]: safeSortOrder });
    }
    // Always include roomNo as tie-breaker for deterministic keyset pagination
    orderBy.push({ roomNo: 'asc' });

    // Fetch one extra to determine if there's a next page
    const rooms = await prisma.room.findMany({
      where,
      orderBy,
      take: safeLimit + 1,
      include: {
        hotel: {
          select: { hotelCode: true, name: true, city: true },
        },
        images: {
          select: { imageId: true, imageUrl: true, isMain: true },
          orderBy: [{ isMain: 'desc' }, { imageId: 'asc' }],
        },
        roomServices: {
          include: {
            service: {
              select: {
                serviceCode: true,
                title: true,
                description: true,
                basePrice: true,
                priceType: true,
                icon: true,
                iconUrl: true,
              },
            },
          },
        },
      },
    });

    // ── Determine next cursor ─────────────────────────────────────────────

    let hasNextPage = false;
    let nextCursor = null;

    if (rooms.length > safeLimit) {
      hasNextPage = true;
      rooms.pop(); // remove the extra item
    }

    if (hasNextPage && rooms.length > 0) {
      const lastRoom = rooms[rooms.length - 1];
      const sortValue = safeSortBy === 'roomNo'
        ? lastRoom.roomNo
        : String(lastRoom[safeSortBy] ?? '');

      nextCursor = Buffer.from(`${sortValue}::${lastRoom.roomNo}`).toString('base64');
    }

    // ── Response ──────────────────────────────────────────────────────────

    res.json({
      rooms: rooms.map(serializeRoom),
      pagination: {
        limit: safeLimit,
        hasNextPage,
        nextCursor,
        sortBy: safeSortBy,
        sortOrder: safeSortOrder,
      },
    });
  } catch (err) {
    logger.error('Room search failed', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Room search failed' });
  }
});

// ── Get single room ─────────────────────────────────────────────────────────

router.get('/:roomNo', async (req, res) => {
  try {
    const { roomNo } = req.params;

    const room = await prisma.room.findUnique({
      where: { roomNo },
      include: {
        hotel: true,
        images: {
          orderBy: [{ isMain: 'desc' }, { imageId: 'asc' }],
        },
        roomServices: {
          include: {
            service: true,
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ room: serializeRoom(room) });
  } catch (err) {
    logger.error('Failed to get room', { error: err.message });
    res.status(500).json({ error: 'Failed to get room' });
  }
});

// ── Create room (admin) ─────────────────────────────────────────────────────

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const {
      roomNo,
      hotelCode,
      title,
      description,
      capacity,
      bedsCount,
      floor,
      area,
      basePrice,
      status,
    } = req.body;

    // Validate required fields
    const errors = {};
    if (!roomNo) errors.roomNo = 'roomNo is required';
    if (!hotelCode) errors.hotelCode = 'hotelCode is required';
    if (!title) errors.title = 'title is required';
    if (capacity === undefined || capacity === null) errors.capacity = 'capacity is required';
    if (bedsCount === undefined || bedsCount === null) errors.bedsCount = 'bedsCount is required';
    if (basePrice === undefined || basePrice === null) errors.basePrice = 'basePrice is required';

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Validation failed', errors });
    }

    // Check hotel exists
    const hotel = await prisma.hotel.findUnique({ where: { hotelCode } });
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    // Check room doesn't already exist
    const existing = await prisma.room.findUnique({ where: { roomNo } });
    if (existing) {
      return res.status(409).json({ error: 'Room with this roomNo already exists' });
    }

    const room = await prisma.room.create({
      data: {
        roomNo: String(roomNo).trim(),
        hotelCode,
        title: title.trim(),
        description: description || null,
        capacity: parseInt(capacity, 10),
        bedsCount: parseInt(bedsCount, 10),
        floor: floor !== undefined && floor !== null ? parseInt(floor, 10) : null,
        area: area !== undefined && area !== null ? parseFloat(area) : null,
        basePrice: parseFloat(basePrice),
        status: status || 'ACTIVE',
      },
      include: { hotel: true },
    });

    logger.info('Room created', { roomNo: room.roomNo, hotelCode });
    res.status(201).json({ room: serializeRoom(room) });
  } catch (err) {
    logger.error('Failed to create room', { error: err.message });
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// ── Update room (admin) ─────────────────────────────────────────────────────

router.patch('/:roomNo', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { roomNo } = req.params;
    const {
      title,
      description,
      capacity,
      bedsCount,
      floor,
      area,
      basePrice,
      status,
      hotelCode,
    } = req.body;

    const existing = await prisma.room.findUnique({ where: { roomNo } });
    if (!existing) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const data = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description || null;
    if (capacity !== undefined) data.capacity = parseInt(capacity, 10);
    if (bedsCount !== undefined) data.bedsCount = parseInt(bedsCount, 10);
    if (floor !== undefined) data.floor = floor !== null ? parseInt(floor, 10) : null;
    if (area !== undefined) data.area = area !== null ? parseFloat(area) : null;
    if (basePrice !== undefined) data.basePrice = parseFloat(basePrice);
    if (status !== undefined) data.status = status;

    if (hotelCode !== undefined) {
      const hotel = await prisma.hotel.findUnique({ where: { hotelCode } });
      if (!hotel) {
        return res.status(404).json({ error: 'Hotel not found' });
      }
      data.hotelCode = hotelCode;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const room = await prisma.room.update({
      where: { roomNo },
      data,
      include: { hotel: true },
    });

    logger.info('Room updated', { roomNo });
    res.json({ room: serializeRoom(room) });
  } catch (err) {
    logger.error('Failed to update room', { error: err.message });
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// ── Delete room (admin) ─────────────────────────────────────────────────────

router.delete('/:roomNo', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { roomNo } = req.params;

    const existing = await prisma.room.findUnique({
      where: { roomNo },
      include: {
        bookings: {
          where: { status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] } },
          select: { bookingId: true },
          take: 1,
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (existing.bookings.length > 0) {
      return res.status(409).json({
        error: 'Cannot delete room with active bookings',
      });
    }

    // Delete related records in order
    await prisma.$transaction([
      prisma.bookingService.deleteMany({
        where: { booking: { roomNo } },
      }),
      prisma.booking.deleteMany({ where: { roomNo } }),
      prisma.roomHold.deleteMany({ where: { roomNo } }),
      prisma.roomService.deleteMany({ where: { roomNo } }),
      prisma.roomImage.deleteMany({ where: { roomNo } }),
      prisma.room.delete({ where: { roomNo } }),
    ]);

    logger.info('Room deleted', { roomNo });
    res.json({ message: 'Room deleted successfully' });
  } catch (err) {
    logger.error('Failed to delete room', { error: err.message });
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

module.exports = router;
