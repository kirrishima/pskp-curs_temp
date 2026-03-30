'use strict';

/**
 * Server-side hold expiration (authoritative timer).
 *
 * The client shows a visual countdown, but the ACTUAL expiration decision
 * lives here on the server.  Every CHECK_INTERVAL_MS we look for ACTIVE
 * holds whose `expiresAt` has passed and whose booking is still PENDING.
 *
 * For each expired hold we:
 *   1. Cancel the Stripe PaymentIntent (so no late charge can succeed).
 *   2. Atomically set booking→CANCELLED, hold→EXPIRED, payment→CANCELLED.
 *   3. Notify the client via WebSocket so the UI updates immediately.
 *
 * The scheduler runs on startup (to recover missed expirations) and then
 * every 15 seconds.
 */

const { createLogger } = require('../logger');
const prisma = require('./prisma');
const { getStripe } = require('./stripe');
const wsManager = require('./websocket');

const logger = createLogger('HoldExpiry');

const CHECK_INTERVAL_MS = 15_000; // 15 seconds

// ── Core processing ─────────────────────────────────────────────────────────

async function processExpiredHolds() {
  const now = new Date();

  // Find ACTIVE holds that have expired and still have a PENDING booking
  const expired = await prisma.roomHold.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { lte: now },
    },
    include: {
      booking: {
        include: {
          payment: true,
        },
      },
    },
    take: 50, // safety cap per cycle
  });

  if (expired.length === 0) return;

  logger.info(`Hold expiry check: ${expired.length} expired hold(s) found`);

  for (const hold of expired) {
    try {
      await _expireOne(hold);
    } catch (err) {
      logger.error('Failed to expire hold', {
        holdId: hold.holdId,
        error: err.message,
      });
    }
  }
}

async function _expireOne(hold) {
  const booking = hold.booking;

  // If the booking is not PENDING (e.g. already CONFIRMED or CANCELLED),
  // just mark the hold as EXPIRED — no need to cancel anything else.
  if (!booking || booking.status !== 'PENDING') {
    await prisma.roomHold.update({
      where: { holdId: hold.holdId },
      data: { status: 'EXPIRED' },
    });
    logger.info('Hold expired (no pending booking)', { holdId: hold.holdId });
    return;
  }

  // ── Cancel Stripe PaymentIntent ─────────────────────────────────────────
  if (booking.payment) {
    try {
      const stripe = getStripe();
      await stripe.paymentIntents.cancel(booking.payment.stripePaymentIntentId);
      logger.info('Stripe PI cancelled for expired hold', {
        holdId: hold.holdId,
        stripeId: booking.payment.stripePaymentIntentId,
      });
    } catch (stripeErr) {
      // PI might already be in a terminal state (succeeded, cancelled)
      if (stripeErr.code !== 'payment_intent_unexpected_state') {
        logger.warn('Could not cancel PI for expired hold', {
          holdId: hold.holdId,
          error: stripeErr.message,
        });
      }
    }
  }

  // ── Atomically cancel everything ────────────────────────────────────────
  const txOps = [
    prisma.roomHold.update({
      where: { holdId: hold.holdId },
      data: { status: 'EXPIRED' },
    }),
    prisma.booking.update({
      where: { bookingId: booking.bookingId },
      data: { status: 'CANCELLED' },
    }),
  ];

  if (booking.payment) {
    txOps.push(
      prisma.payment.update({
        where: { id: booking.payment.id },
        data: { status: 'CANCELLED' },
      }),
    );
  }

  await prisma.$transaction(txOps);

  logger.info('Hold expired — booking cancelled', {
    holdId: hold.holdId,
    bookingId: booking.bookingId,
    userId: hold.userId,
  });

  // ── Notify client via WebSocket ─────────────────────────────────────────
  wsManager.notifyUser(hold.userId, {
    type: 'HOLD_EXPIRED',
    bookingId: booking.bookingId,
    holdId: hold.holdId,
    message: 'Время оплаты истекло. Номер освобождён.',
  });
}

// ── Scheduler ───────────────────────────────────────────────────────────────

function scheduleHoldExpiryProcessing() {
  // Run immediately on startup
  processExpiredHolds().catch((err) =>
    logger.error('Initial hold expiry check failed', { error: err.message }),
  );

  // Then every CHECK_INTERVAL_MS
  setInterval(() => {
    processExpiredHolds().catch((err) =>
      logger.error('Scheduled hold expiry check failed', { error: err.message }),
    );
  }, CHECK_INTERVAL_MS);

  logger.info(`Hold expiry scheduler started (interval: ${CHECK_INTERVAL_MS / 1000}s)`);
}

module.exports = { scheduleHoldExpiryProcessing, processExpiredHolds };
