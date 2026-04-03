'use strict';

/**
 * User management routes (admin only)
 *
 * GET    /api/users              — paginated list with optional search
 * GET    /api/users/:userId      — single user detail
 * PATCH  /api/users/:userId/block   — block user (revokes all tokens)
 * PATCH  /api/users/:userId/unblock — unblock user
 * PATCH  /api/users/:userId/role    — change user role
 */

const { Router } = require('express');
const { createLogger } = require('../logger');
const prisma = require('../services/prisma');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { revokeAllTokens } = require('../services/token');

const logger = createLogger('Users');
const router = Router();

// All user management endpoints are admin-only.
router.use(authenticate, authorize('admin'));

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Serialize a User record for API output.
 * Strips the password and tokenVersion fields; includes role name.
 */
function serializeUser(user) {
  const { password: _pw, tokenVersion: _tv, ...rest } = user;
  return rest;
}

// ── GET /api/users — paginated list ─────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    // search: trim and match against id (prefix), email, firstName, lastName
    const raw = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    // Role filter
    const roleFilter = typeof req.query.role === 'string' ? req.query.role.trim() : '';

    // Status filter: 'blocked' | 'active' | ''
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    // ── Build where clause ────────────────────────────────────────────────
    const where = {};

    if (raw) {
      where.OR = [
        { id:        { startsWith: raw,      mode: 'insensitive' } },
        { email:     { contains:   raw,      mode: 'insensitive' } },
        { firstName: { contains:   raw,      mode: 'insensitive' } },
        { lastName:  { contains:   raw,      mode: 'insensitive' } },
      ];
    }

    if (roleFilter) {
      where.role = { name: roleFilter };
    }

    if (statusFilter === 'blocked') {
      where.isBlocked = true;
    } else if (statusFilter === 'active') {
      where.isBlocked = false;
    }

    // ── Count + fetch in parallel ─────────────────────────────────────────
    const [totalCount, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { role: true },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      users: users.map(serializeUser),
      pagination: { page, limit, totalCount, totalPages },
    });
  } catch (err) {
    logger.error('Failed to list users', { error: err.message });
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// ── GET /api/users/:userId — user detail ─────────────────────────────────────

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        _count: {
          select: { bookings: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: serializeUser(user) });
  } catch (err) {
    logger.error('Failed to get user', { error: err.message, userId: req.params.userId });
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ── PATCH /api/users/:userId/block — block user ───────────────────────────────

router.patch('/:userId/block', async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent an admin from blocking themselves.
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot block your own account' });
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (existing.isBlocked) {
      return res.status(409).json({ error: 'User is already blocked' });
    }

    // Revoke all active tokens to force immediate logout, then set isBlocked.
    // revokeAllTokens bumps tokenVersion and marks all refresh tokens revoked.
    await revokeAllTokens(userId);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isBlocked: true },
      include: { role: true },
    });

    logger.info('User blocked', { targetUserId: userId, adminId: req.user.id });
    res.json({ user: serializeUser(user) });
  } catch (err) {
    logger.error('Failed to block user', { error: err.message, userId: req.params.userId });
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// ── PATCH /api/users/:userId/unblock — unblock user ──────────────────────────

router.patch('/:userId/unblock', async (req, res) => {
  try {
    const { userId } = req.params;

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!existing.isBlocked) {
      return res.status(409).json({ error: 'User is not blocked' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isBlocked: false },
      include: { role: true },
    });

    logger.info('User unblocked', { targetUserId: userId, adminId: req.user.id });
    res.json({ user: serializeUser(user) });
  } catch (err) {
    logger.error('Failed to unblock user', { error: err.message, userId: req.params.userId });
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// ── PATCH /api/users/:userId/role — change user role ─────────────────────────

router.patch('/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleName } = req.body;

    const VALID_ROLES = new Set(['user', 'manager', 'admin']);

    if (!roleName || !VALID_ROLES.has(roleName)) {
      return res.status(400).json({
        error: 'roleName must be one of: user, manager, admin',
      });
    }

    // Prevent removing the last admin by demoting yourself.
    if (userId === req.user.id && roleName !== 'admin') {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      return res.status(400).json({ error: `Role '${roleName}' not found in database` });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { roleId: role.id },
      include: { role: true },
    });

    logger.info('User role changed', {
      targetUserId: userId,
      adminId: req.user.id,
      oldRoleId: existing.roleId,
      newRole: roleName,
    });
    res.json({ user: serializeUser(user) });
  } catch (err) {
    logger.error('Failed to change user role', { error: err.message, userId: req.params.userId });
    res.status(500).json({ error: 'Failed to change user role' });
  }
});

module.exports = router;
