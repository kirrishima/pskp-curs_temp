const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('./prisma');
const { getConfig, getRefreshTokenExpiresAt } = require('../config');

/**
 * Generate an access token embedding user id and current token version.
 * The token version enables mass-revocation: bumping the user's tokenVersion
 * instantly invalidates every previously issued access token.
 */
function signAccessToken(user) {
  const config = getConfig();
  return jwt.sign(
    { sub: user.id, email: user.email, tokenVersion: user.tokenVersion },
    config.jwtSecret,
    { expiresIn: config.accessTokenLifetime }
  );
}

/**
 * Generate a refresh token, persist it in the database, and return the
 * signed JWT.  The stored record also captures the tokenVersion at
 * creation time so that a version bump revokes it on next use.
 */
async function signRefreshToken(user) {
  const config = getConfig();
  const tokenId = uuidv4();
  const expiresAt = getRefreshTokenExpiresAt();

  const token = jwt.sign(
    { sub: user.id, jti: tokenId, tokenVersion: user.tokenVersion },
    config.refreshSecret,
    { expiresIn: config.refreshTokenLifetime }
  );

  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      token,
      tokenVersion: user.tokenVersion,
      userId: user.id,
      expiresAt,
    },
  });

  return token;
}

/**
 * Verify an access token and ensure the embedded tokenVersion matches
 * the user's current version (i.e. the token hasn't been revoked).
 */
async function verifyAccessToken(token) {
  const config = getConfig();
  const payload = jwt.verify(token, config.jwtSecret);

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new Error('User not found');
  if (payload.tokenVersion !== user.tokenVersion) {
    throw new Error('Token revoked (version mismatch)');
  }

  return { payload, user };
}

/**
 * Verify a refresh token, check it hasn't been revoked or version-bumped,
 * then rotate: revoke the old token and issue a fresh pair.
 */
async function rotateRefreshToken(token) {
  const config = getConfig();
  const payload = jwt.verify(token, config.refreshSecret);

  const stored = await prisma.refreshToken.findUnique({
    where: { id: payload.jti },
  });

  if (!stored || stored.revoked) {
    throw new Error('Refresh token revoked or not found');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new Error('User not found');

  if (stored.tokenVersion !== user.tokenVersion) {
    // Version was bumped — revoke this token family
    await prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { revoked: true },
    });
    throw new Error('Token revoked (version mismatch)');
  }

  // Revoke old refresh token (rotation)
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revoked: true },
  });

  // Issue new pair
  const newAccessToken = signAccessToken(user);
  const newRefreshToken = await signRefreshToken(user);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, user };
}

/**
 * Revoke ALL tokens for a user by bumping their tokenVersion.
 * This invalidates every access token (checked on each request) and
 * every refresh token (checked on rotation).
 */
async function revokeAllTokens(userId) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });

  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revoked: true },
  });

  return user;
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  rotateRefreshToken,
  revokeAllTokens,
};
