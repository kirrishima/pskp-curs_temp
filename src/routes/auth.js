const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { createLogger } = require('../logger');
const prisma = require('../services/prisma');
const {
  signAccessToken,
  signRefreshToken,
  rotateRefreshToken,
  revokeAllTokens,
} = require('../services/token');
const { authenticate } = require('../middleware/auth');

const logger = createLogger('Auth');
const router = Router();

// ── Register ────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashed },
    });

    const accessToken = signAccessToken(user);
    const refreshToken = await signRefreshToken(user);

    logger.info('User registered', { userId: user.id, email: user.email });

    res.status(201).json({
      user: { id: user.id, email: user.email },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error('Registration failed', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Login ───────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      logger.warn('Login attempt with unknown email', { email });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      logger.warn('Login attempt with wrong password', { userId: user.id });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await signRefreshToken(user);

    logger.info('User logged in', { userId: user.id });

    res.json({
      user: { id: user.id, email: user.email },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error('Login failed', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Refresh ─────────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const result = await rotateRefreshToken(refreshToken);

    logger.info('Tokens rotated', { userId: result.user.id });

    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err) {
    logger.warn('Token refresh failed', { error: err.message });
    res.status(401).json({ error: err.message || 'Token refresh failed' });
  }
});

// ── Revoke all tokens (logout everywhere) ───────────────────────────
router.post('/revoke', authenticate, async (req, res) => {
  try {
    await revokeAllTokens(req.user.id);
    logger.info('All tokens revoked', { userId: req.user.id });
    res.json({ message: 'All tokens revoked successfully' });
  } catch (err) {
    logger.error('Token revocation failed', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Token revocation failed' });
  }
});

// ── Current user ────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      tokenVersion: req.user.tokenVersion,
    },
  });
});

module.exports = router;
