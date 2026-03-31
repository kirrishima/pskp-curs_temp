const { v4: uuidv4 } = require('uuid');
const prisma = require('./prisma');
const { getQRCodeExpiresAt } = require('../config');
const { signAccessToken, signRefreshToken } = require('./token');
const wsManager = require('./websocket');

/**
 * Generate a QR login session (called by the PC that wants to log in).
 * No authentication required — the QR code starts without a userId.
 * Returns the raw code string and expiry — the client renders it as a QR image.
 */
async function generateQRSession() {
  const code = uuidv4();
  const expiresAt = getQRCodeExpiresAt();

  await prisma.qRCode.create({
    data: {
      code,
      expiresAt,
      // userId is null — will be set when the phone approves
    },
  });

  return { code, expiresAt };
}

/**
 * Approve a QR session (called by the phone that is already logged in).
 * Sets the userId on the QR record, making it ready for the PC to pick up.
 */
async function approveQRCode(code, userId) {
  const qr = await prisma.qRCode.findUnique({ where: { code } });

  if (!qr) throw new Error('QR-код не найден');
  if (qr.consumed) throw new Error('QR-код уже использован');
  if (new Date() > qr.expiresAt) throw new Error('QR-код истёк');
  if (qr.userId) throw new Error('QR-код уже одобрен');

  await prisma.qRCode.update({
    where: { id: qr.id },
    data: { userId },
  });

  // Notify the PC via WebSocket so it doesn't have to wait for the next poll
  wsManager.broadcast({
    type: 'QR_APPROVED',
    code,
  });

  return { success: true };
}

/**
 * Check QR session status (polled by the PC).
 * If approved (userId is set), issue tokens and mark consumed.
 */
async function checkQRStatus(code) {
  const qr = await prisma.qRCode.findUnique({ where: { code } });

  if (!qr) throw new Error('QR-код не найден');
  if (new Date() > qr.expiresAt) return { status: 'expired' };
  if (qr.consumed) return { status: 'consumed' };

  // Not yet approved — still waiting for a phone to scan
  if (!qr.userId) return { status: 'pending' };

  // Approved! Issue tokens and mark as consumed
  await prisma.qRCode.update({
    where: { id: qr.id },
    data: { consumed: true },
  });

  const user = await prisma.user.findUnique({
    where: { id: qr.userId },
    include: { role: true },
  });
  if (!user) throw new Error('Пользователь не найден');

  const accessToken = signAccessToken(user);
  const refreshToken = await signRefreshToken(user);

  return { status: 'approved', accessToken, refreshToken, user };
}

module.exports = { generateQRSession, approveQRCode, checkQRStatus };
