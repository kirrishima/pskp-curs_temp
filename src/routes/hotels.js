'use strict';

/**
 * Hotel management routes
 *
 * GET    /api/hotels            — list all hotels (any authenticated user)
 * GET    /api/hotels/:hotelCode — get hotel by code  (any authenticated user)
 * POST   /api/hotels            — create hotel       (admin only)
 * PATCH  /api/hotels/:hotelCode — update hotel       (admin only)
 * DELETE /api/hotels/:hotelCode — delete hotel        (admin only)
 */

const { Router } = require('express');
const { createLogger } = require('../logger');
const prisma = require('../services/prisma');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const logger = createLogger('Hotels');
const router = Router();

// ── List all hotels ─────────────────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  try {
    const hotels = await prisma.hotel.findMany({
      orderBy: { name: 'asc' },
    });

    res.json({ hotels });
  } catch (err) {
    logger.error('Failed to list hotels', { error: err.message });
    res.status(500).json({ error: 'Failed to list hotels' });
  }
});

// ── Get single hotel ────────────────────────────────────────────────────────

router.get('/:hotelCode', authenticate, async (req, res) => {
  try {
    const { hotelCode } = req.params;

    const hotel = await prisma.hotel.findUnique({
      where: { hotelCode },
      include: {
        rooms: {
          select: {
            roomNo: true,
            title: true,
            capacity: true,
            bedsCount: true,
            floor: true,
            basePrice: true,
            status: true,
          },
          orderBy: { roomNo: 'asc' },
        },
      },
    });

    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    res.json({ hotel });
  } catch (err) {
    logger.error('Failed to get hotel', { error: err.message });
    res.status(500).json({ error: 'Failed to get hotel' });
  }
});

// ── Create hotel (admin) ────────────────────────────────────────────────────

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { hotelCode, name, description, city, address, phone, email } = req.body;

    if (!hotelCode || !name) {
      return res.status(400).json({ error: 'hotelCode and name are required' });
    }

    if (typeof hotelCode !== 'string' || hotelCode.trim().length === 0) {
      return res.status(400).json({ error: 'hotelCode must be a non-empty string' });
    }

    const existing = await prisma.hotel.findUnique({ where: { hotelCode: hotelCode.trim() } });
    if (existing) {
      return res.status(409).json({ error: 'Hotel with this code already exists' });
    }

    const hotel = await prisma.hotel.create({
      data: {
        hotelCode: hotelCode.trim(),
        name: name.trim(),
        description: description || null,
        city: city || null,
        address: address || null,
        phone: phone || null,
        email: email || null,
      },
    });

    logger.info('Hotel created', { hotelCode: hotel.hotelCode });
    res.status(201).json({ hotel });
  } catch (err) {
    logger.error('Failed to create hotel', { error: err.message });
    res.status(500).json({ error: 'Failed to create hotel' });
  }
});

// ── Update hotel (admin) ────────────────────────────────────────────────────

router.patch('/:hotelCode', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { hotelCode } = req.params;
    const { name, description, city, address, phone, email } = req.body;

    const existing = await prisma.hotel.findUnique({ where: { hotelCode } });
    if (!existing) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description || null;
    if (city !== undefined) data.city = city || null;
    if (address !== undefined) data.address = address || null;
    if (phone !== undefined) data.phone = phone || null;
    if (email !== undefined) data.email = email || null;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const hotel = await prisma.hotel.update({
      where: { hotelCode },
      data,
    });

    logger.info('Hotel updated', { hotelCode });
    res.json({ hotel });
  } catch (err) {
    logger.error('Failed to update hotel', { error: err.message });
    res.status(500).json({ error: 'Failed to update hotel' });
  }
});

// ── Delete hotel (admin) ────────────────────────────────────────────────────

router.delete('/:hotelCode', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { hotelCode } = req.params;

    const existing = await prisma.hotel.findUnique({
      where: { hotelCode },
      include: { rooms: { select: { roomNo: true }, take: 1 } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    if (existing.rooms.length > 0) {
      return res.status(409).json({
        error: 'Cannot delete hotel with existing rooms. Remove rooms first.',
      });
    }

    await prisma.hotel.delete({ where: { hotelCode } });

    logger.info('Hotel deleted', { hotelCode });
    res.json({ message: 'Hotel deleted successfully' });
  } catch (err) {
    logger.error('Failed to delete hotel', { error: err.message });
    res.status(500).json({ error: 'Failed to delete hotel' });
  }
});

module.exports = router;
