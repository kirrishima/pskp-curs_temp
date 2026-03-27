'use strict';

/**
 * Room-Service association routes (which services are available per room)
 *
 * GET    /api/room-services/:roomNo          — list services for a room
 * POST   /api/room-services/:roomNo          — assign service to room (admin)
 * PATCH  /api/room-services/:roomNo/:code    — update default_state   (admin)
 * DELETE /api/room-services/:roomNo/:code    — remove service from room (admin)
 * PUT    /api/room-services/:roomNo          — bulk set services       (admin)
 */

const { Router } = require('express');
const { createLogger } = require('../logger');
const prisma = require('../services/prisma');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { serializeRoomService } = require('../utils/serializers');

const logger = createLogger('RoomServices');
const router = Router();

const VALID_STATES = new Set(['INCLUDED', 'OPTIONAL_ON', 'OPTIONAL_OFF']);

// ── List services for a room ────────────────────────────────────────────────

router.get('/:roomNo', authenticate, async (req, res) => {
  try {
    const { roomNo } = req.params;

    const room = await prisma.room.findUnique({ where: { roomNo } });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const roomServices = await prisma.roomService.findMany({
      where: { roomNo },
      include: {
        service: true,
      },
      orderBy: { serviceCode: 'asc' },
    });

    res.json({ roomServices: roomServices.map(serializeRoomService) });
  } catch (err) {
    logger.error('Failed to list room services', { error: err.message });
    res.status(500).json({ error: 'Failed to list room services' });
  }
});

// ── Assign a service to a room (admin) ──────────────────────────────────────

router.post('/:roomNo', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { roomNo } = req.params;
    const { serviceCode, defaultState } = req.body;

    if (!serviceCode || !defaultState) {
      return res.status(400).json({ error: 'serviceCode and defaultState are required' });
    }

    if (!VALID_STATES.has(defaultState)) {
      return res.status(400).json({ error: 'defaultState must be INCLUDED, OPTIONAL_ON, or OPTIONAL_OFF' });
    }

    const room = await prisma.room.findUnique({ where: { roomNo } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const service = await prisma.service.findUnique({ where: { serviceCode } });
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const existing = await prisma.roomService.findUnique({
      where: { roomNo_serviceCode: { roomNo, serviceCode } },
    });
    if (existing) {
      return res.status(409).json({ error: 'Service already assigned to this room' });
    }

    const roomService = await prisma.roomService.create({
      data: { roomNo, serviceCode, defaultState },
      include: { service: true },
    });

    logger.info('Service assigned to room', { roomNo, serviceCode, defaultState });
    res.status(201).json({ roomService: serializeRoomService(roomService) });
  } catch (err) {
    logger.error('Failed to assign service', { error: err.message });
    res.status(500).json({ error: 'Failed to assign service to room' });
  }
});

// ── Update default_state (admin) ────────────────────────────────────────────

router.patch('/:roomNo/:serviceCode', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { roomNo, serviceCode } = req.params;
    const { defaultState } = req.body;

    if (!defaultState || !VALID_STATES.has(defaultState)) {
      return res.status(400).json({ error: 'defaultState must be INCLUDED, OPTIONAL_ON, or OPTIONAL_OFF' });
    }

    const existing = await prisma.roomService.findUnique({
      where: { roomNo_serviceCode: { roomNo, serviceCode } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Room-service association not found' });
    }

    const roomService = await prisma.roomService.update({
      where: { roomNo_serviceCode: { roomNo, serviceCode } },
      data: { defaultState },
      include: { service: true },
    });

    logger.info('Room-service updated', { roomNo, serviceCode, defaultState });
    res.json({ roomService: serializeRoomService(roomService) });
  } catch (err) {
    logger.error('Failed to update room-service', { error: err.message });
    res.status(500).json({ error: 'Failed to update room-service' });
  }
});

// ── Remove a service from a room (admin) ────────────────────────────────────

router.delete('/:roomNo/:serviceCode', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { roomNo, serviceCode } = req.params;

    const existing = await prisma.roomService.findUnique({
      where: { roomNo_serviceCode: { roomNo, serviceCode } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Room-service association not found' });
    }

    await prisma.roomService.delete({
      where: { roomNo_serviceCode: { roomNo, serviceCode } },
    });

    logger.info('Service removed from room', { roomNo, serviceCode });
    res.json({ message: 'Service removed from room' });
  } catch (err) {
    logger.error('Failed to remove room-service', { error: err.message });
    res.status(500).json({ error: 'Failed to remove service from room' });
  }
});

// ── Bulk set services for a room (admin) ────────────────────────────────────
// Replaces all room-service associations for the given room.
// Body: { services: [{ serviceCode, defaultState }, ...] }

router.put('/:roomNo', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { roomNo } = req.params;
    const { services } = req.body;

    if (!Array.isArray(services)) {
      return res.status(400).json({ error: 'services must be an array' });
    }

    const room = await prisma.room.findUnique({ where: { roomNo } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Validate each entry
    for (const entry of services) {
      if (!entry.serviceCode || !entry.defaultState) {
        return res.status(400).json({ error: 'Each service entry must have serviceCode and defaultState' });
      }
      if (!VALID_STATES.has(entry.defaultState)) {
        return res.status(400).json({
          error: `Invalid defaultState "${entry.defaultState}" for service "${entry.serviceCode}"`,
        });
      }
    }

    // Check all service codes exist
    const codes = services.map((s) => s.serviceCode);
    const existingServices = await prisma.service.findMany({
      where: { serviceCode: { in: codes } },
      select: { serviceCode: true },
    });
    const existingCodes = new Set(existingServices.map((s) => s.serviceCode));
    const missing = codes.filter((c) => !existingCodes.has(c));
    if (missing.length > 0) {
      return res.status(404).json({ error: `Services not found: ${missing.join(', ')}` });
    }

    // Transaction: delete all existing, create new
    await prisma.$transaction([
      prisma.roomService.deleteMany({ where: { roomNo } }),
      ...services.map((entry) =>
        prisma.roomService.create({
          data: {
            roomNo,
            serviceCode: entry.serviceCode,
            defaultState: entry.defaultState,
          },
        })
      ),
    ]);

    // Fetch updated list
    const roomServices = await prisma.roomService.findMany({
      where: { roomNo },
      include: { service: true },
      orderBy: { serviceCode: 'asc' },
    });

    logger.info('Room services bulk-set', { roomNo, count: services.length });
    res.json({ roomServices: roomServices.map(serializeRoomService) });
  } catch (err) {
    logger.error('Failed to bulk-set room services', { error: err.message });
    res.status(500).json({ error: 'Failed to set room services' });
  }
});

module.exports = router;
