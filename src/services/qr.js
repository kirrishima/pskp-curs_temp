const { v4: uuidv4 } = require('uuid');
const prisma = require('./prisma');
const { getQRCodeExpiresAt } = require('../config');
const { signAccessToken, signRefreshToken } = require('./token');

/**
 * Generate a short-lived, single-use QR login code for an authenticated user.
 * Returns only the raw code string — the client is responsible for rendering
 * it as a QR image.
 */
async function generateQRCode(userId) {
  const code = uuidv4();
  const expiresAt = getQRCodeExpiresAt();

  await prisma.qRCode.create({
    data: {
      code,
      userId,
      expiresAt,
    },
  });

  return { code, expiresAt };
}

/**
 * Consume a QR code and, if valid, issue tokens for the requesting device.
 * The code is single-use and time-limited.
 */
async function consumeQRCode(code) {
  const qr = await prisma.qRCode.findUnique({ where: { code } });

  if (!qr) throw new Error('QR code not found');
  if (qr.consumed) throw new Error('QR code already used');
  if (new Date() > qr.expiresAt) throw new Error('QR code expired');

  // Mark consumed
  await prisma.qRCode.update({
    where: { id: qr.id },
    data: { consumed: true },
  });

  const user = await prisma.user.findUnique({ where: { id: qr.userId } });
  if (!user) throw new Error('User not found');

  const accessToken = signAccessToken(user);
  const refreshToken = await signRefreshToken(user);

  return { accessToken, refreshToken, user };
}

module.exports = { generateQRCode, consumeQRCode };
