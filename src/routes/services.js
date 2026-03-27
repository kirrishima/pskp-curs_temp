'use strict';

/**
 * Service management routes
 *
 * GET    /api/services              — list all services (any authenticated user)
 * GET    /api/services/:serviceCode — get service       (any authenticated user)
 * POST   /api/services              — create service    (admin only)
 * PATCH  /api/services/:serviceCode — update service    (admin only)
 * DELETE /api/services/:serviceCode — delete service    (admin only)
 */

const { Router } = require('express');
const { createLogger } = require('../logger');
const prisma = require('../services/prisma');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const logger = createLogger('Services');
const router = Router();

// Valid price types
const VALID_PRICE_TYPES = new Set(['PER_NIGHT', 'ONE_TIME']);

// ── List all services ───────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { title: 'asc' },
    });

    res.json({ services });
  } catch (err) {
    logger.error('Failed to list services', { error: err.message });
    res.status(500).json({ error: 'Failed to list services' });
  }
});

// ── Get single service ──────────────────────────────────────────────────────

router.get('/:serviceCode', async (req, res) => {
  try {
    const { serviceCode } = req.params;

    const service = await prisma.service.findUnique({
      where: { serviceCode },
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json({ service });
  } catch (err) {
    logger.error('Failed to get service', { error: err.message });
    res.status(500).json({ error: 'Failed to get service' });
  }
});

// ── Create service (admin) ──────────────────────────────────────────────────

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { serviceCode, title, description, basePrice, priceType, icon, iconUrl } = req.body;

    const errors = {};
    if (!serviceCode) errors.serviceCode = 'serviceCode is required';
    if (!title) errors.title = 'title is required';
    if (!priceType) errors.priceType = 'priceType is required';
    if (priceType && !VALID_PRICE_TYPES.has(priceType)) {
      errors.priceType = 'priceType must be PER_NIGHT or ONE_TIME';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Validation failed', errors });
    }

    const existing = await prisma.service.findUnique({ where: { serviceCode } });
    if (existing) {
      return res.status(409).json({ error: 'Service with this code already exists' });
    }

    const service = await prisma.service.create({
      data: {
        serviceCode: serviceCode.trim(),
        title: title.trim(),
        description: description || null,
        basePrice: basePrice !== undefined ? parseFloat(basePrice) : 0,
        priceType,
        icon: icon || null,
        iconUrl: iconUrl || null,
      },
    });

    logger.info('Service created', { serviceCode: service.serviceCode });
    res.status(201).json({ service });
  } catch (err) {
    logger.error('Failed to create service', { error: err.message });
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// ── Update service (admin) ──────────────────────────────────────────────────

router.patch('/:serviceCode', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { serviceCode } = req.params;
    const { title, description, basePrice, priceType, icon, iconUrl, isActive } = req.body;

    const existing = await prisma.service.findUnique({ where: { serviceCode } });
    if (!existing) {
      return res.status(404).json({ error: 'Service not found' });
    }

    if (priceType !== undefined && !VALID_PRICE_TYPES.has(priceType)) {
      return res.status(400).json({ error: 'priceType must be PER_NIGHT or ONE_TIME' });
    }

    const data = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description || null;
    if (basePrice !== undefined) data.basePrice = parseFloat(basePrice);
    if (priceType !== undefined) data.priceType = priceType;
    if (icon !== undefined) data.icon = icon || null;
    if (iconUrl !== undefined) data.iconUrl = iconUrl || null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const service = await prisma.service.update({
      where: { serviceCode },
      data,
    });

    logger.info('Service updated', { serviceCode });
    res.json({ service });
  } catch (err) {
    logger.error('Failed to update service', { error: err.message });
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// ── Delete service (admin) ──────────────────────────────────────────────────

router.delete('/:serviceCode', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { serviceCode } = req.params;

    const existing = await prisma.service.findUnique({ where: { serviceCode } });
    if (!existing) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Soft-delete: mark as inactive rather than destroying data
    await prisma.service.update({
      where: { serviceCode },
      data: { isActive: false },
    });

    logger.info('Service deactivated', { serviceCode });
    res.json({ message: 'Service deactivated successfully' });
  } catch (err) {
    logger.error('Failed to delete service', { error: err.message });
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

module.exports = router;
