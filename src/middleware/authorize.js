'use strict';

const prisma = require('../services/prisma');

/**
 * Factory that returns an Express middleware checking whether the
 * authenticated user has one of the allowed roles.
 *
 * Usage:
 *   router.post('/admin-only', authenticate, authorize('admin'), handler);
 *   router.get('/managers',    authenticate, authorize('admin', 'manager'), handler);
 *
 * The middleware expects `req.user` to be set by the `authenticate`
 * middleware (it must contain at least `req.user.roleId`).
 */
function authorize(...allowedRoleNames) {
  if (allowedRoleNames.length === 0) {
    throw new Error('authorize() requires at least one role name');
  }

  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.roleId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const role = await prisma.role.findUnique({
        where: { id: req.user.roleId },
      });

      if (!role || !allowedRoleNames.includes(role.name)) {
        return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
      }

      // Attach resolved role name for downstream convenience
      req.userRole = role.name;
      next();
    } catch (err) {
      return res.status(500).json({ error: 'Authorization check failed' });
    }
  };
}

/**
 * Lightweight helper that attaches `req.userRole` without blocking.
 * Useful when access rules differ per-role inside the same handler
 * (e.g. admin sees all rooms, user sees only available ones).
 */
async function resolveRole(req, _res, next) {
  try {
    if (req.user && req.user.roleId) {
      const role = await prisma.role.findUnique({
        where: { id: req.user.roleId },
      });
      req.userRole = role ? role.name : null;
    }
  } catch {
    // Non-critical — proceed without role resolution
  }
  next();
}

module.exports = { authorize, resolveRole };
