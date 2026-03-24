const { Router } = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { createLogger } = require('../logger');
const prisma = require('../services/prisma');
const { sendVerificationCode } = require('../services/email');
const {
  signAccessToken,
  signRefreshToken,
  rotateRefreshToken,
  revokeAllTokens,
} = require('../services/token');
const { authenticate } = require('../middleware/auth');
const {
  validateEmail,
  validatePassword,
  validateFirstName,
  validateLastName,
  validatePhone,
  normalizePhone,
  validateBirthDate,
  validateGender,
  validateCitizenship,
  validateDisplayName,
  collectErrors,
} = require('../utils/validation');

const logger = createLogger('Auth');
const router = Router();

// ── Helper: strip sensitive fields from user ──────────────────────────────
function sanitizeUser(user) {
  const { password, tokenVersion, ...safe } = user;
  return safe;
}

// ── Step 1: Send verification code ───────────────────────────────────────
router.post('/register/send-code', async (req, res) => {
  try {
    const { email } = req.body;

    const emailErr = validateEmail(email);
    if (emailErr) {
      return res.status(400).json({ error: emailErr, field: 'email' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already registered
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: 'Этот email уже зарегистрирован', field: 'email' });
    }

    // Rate limit: no more than 1 code per 60 seconds for the same email
    const recentCode = await prisma.emailVerification.findFirst({
      where: {
        email: normalizedEmail,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recentCode) {
      return res.status(429).json({ error: 'Подождите 60 секунд перед повторной отправкой' });
    }

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate previous codes for this email
    await prisma.emailVerification.updateMany({
      where: { email: normalizedEmail, used: false },
      data: { used: true },
    });

    // Store the code
    await prisma.emailVerification.create({
      data: { email: normalizedEmail, code, expiresAt },
    });

    // Send email
    await sendVerificationCode(normalizedEmail, code);

    logger.info('Verification code sent', { email: normalizedEmail });
    res.json({ message: 'Verification code sent' });
  } catch (err) {
    logger.error('Send code failed', { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message || 'Failed to send verification code' });
  }
});

// ── Step 2: Verify the code ──────────────────────────────────────────────
router.post('/register/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    const emailErr = validateEmail(email);
    if (emailErr) {
      return res.status(400).json({ error: emailErr, field: 'email' });
    }
    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return res.status(400).json({ error: 'Код должен состоять из 6 цифр', field: 'code' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const record = await prisma.emailVerification.findFirst({
      where: {
        email: normalizedEmail,
        code: code.trim(),
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return res.status(400).json({ error: 'Неверный или просроченный код', field: 'code' });
    }

    // Mark as used
    await prisma.emailVerification.update({
      where: { id: record.id },
      data: { used: true },
    });

    logger.info('Email verified', { email: normalizedEmail });
    res.json({ message: 'Email verified', verified: true });
  } catch (err) {
    logger.error('Verify code failed', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── Step 3: Complete registration (name + password) ──────────────────────
router.post('/register/complete', async (req, res) => {
  try {
    const { email, firstName, lastName, password } = req.body;

    // Validate all fields at once, return all errors
    const errors = collectErrors({
      email: validateEmail(email),
      firstName: validateFirstName(firstName),
      lastName: validateLastName(lastName),
      password: validatePassword(password),
    });

    if (errors) {
      return res.status(400).json({ error: 'Validation failed', errors });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check email was recently verified (within 15 minutes)
    const recentVerification = await prisma.emailVerification.findFirst({
      where: {
        email: normalizedEmail,
        used: true,
        createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!recentVerification) {
      return res.status(400).json({ error: 'Email не подтверждён или срок подтверждения истёк. Начните сначала.' });
    }

    // Check if already registered
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: 'Этот email уже зарегистрирован', errors: { email: 'Этот email уже зарегистрирован' } });
    }

    // Get default "user" role
    const userRole = await prisma.role.findUnique({ where: { name: 'user' } });
    if (!userRole) {
      logger.error('Default "user" role not found — run seed');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashed,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        roleId: userRole.id,
      },
      include: { role: true },
    });

    const accessToken = signAccessToken(user);
    const refreshToken = await signRefreshToken(user);

    logger.info('User registered', { userId: user.id, email: user.email });

    res.status(201).json({
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error('Registration failed', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Login ───────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const errors = collectErrors({
      email: validateEmail(email),
      password: password ? null : 'Password is required',
    });

    if (errors) {
      return res.status(400).json({ error: 'Validation failed', errors });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { role: true },
    });
    if (!user) {
      logger.warn('Login attempt with unknown email', { email: normalizedEmail });
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      logger.warn('Login attempt with wrong password', { userId: user.id });
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await signRefreshToken(user);

    logger.info('User logged in', { userId: user.id });

    res.json({
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error('Login failed', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Refresh ─────────────────────────────────────────────────────────────
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

// ── Revoke all tokens (logout everywhere) ───────────────────────────────
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

// ── Logout (revoke current refresh token only) ──────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken, userId: req.user.id },
        data: { revoked: true },
      });
    }

    logger.info('User logged out', { userId: req.user.id });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    logger.error('Logout failed', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ── Current user (full profile) ─────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    logger.error('Get user failed', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// ── Update profile (optional fields) ────────────────────────────────────
router.patch('/me', authenticate, async (req, res) => {
  try {
    const { phone, birthDate, gender, citizenship, displayName } = req.body;
    const data = {};
    const validationResults = {};

    if (phone !== undefined) {
      validationResults.phone = validatePhone(phone);
      data.phone = phone ? normalizePhone(phone) : null;
    }
    if (birthDate !== undefined) {
      validationResults.birthDate = validateBirthDate(birthDate);
      data.birthDate = birthDate ? new Date(birthDate) : null;
    }
    if (gender !== undefined) {
      validationResults.gender = validateGender(gender);
      data.gender = gender || null;
    }
    if (citizenship !== undefined) {
      validationResults.citizenship = validateCitizenship(citizenship);
      data.citizenship = citizenship || null;
    }
    if (displayName !== undefined) {
      validationResults.displayName = validateDisplayName(displayName);
      data.displayName = displayName ? displayName.trim() : null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const errors = collectErrors(validationResults);
    if (errors) {
      return res.status(400).json({ error: 'Validation failed', errors });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      include: { role: true },
    });

    logger.info('Profile updated', { userId: user.id, fields: Object.keys(data) });

    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    logger.error('Profile update failed', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
