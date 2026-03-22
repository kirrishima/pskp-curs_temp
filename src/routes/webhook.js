'use strict';

/**
 * Stripe Webhook Handler
 * ---------------------
 * Mounted at POST /api/webhooks/stripe
 *
 * IMPORTANT: Express must receive the RAW request body for signature
 * verification. The route is registered *before* express.json() in index.js
 * using express.raw({ type: 'application/json' }).
 *
 * Idempotency
 * -----------
 * Every processed Stripe event ID is stored in the WebhookEvent table.
 * Duplicate deliveries are detected and skipped without re-processing.
 *
 * Handled events
 * --------------
 *   payment_intent.succeeded         → confirm booking, unlock room
 *   payment_intent.payment_failed    → cancel booking, unlock room
 *   payment_intent.canceled          → cancel booking, unlock room
 *   checkout.session.completed       → (handled if you switch to Checkout)
 */

const { Router } = require('express');
const { createLogger } = require('../logger');
const { getConfig } = require('../config');
const { getStripe } = require('../services/stripe');
const prisma = require('../services/prisma');
const wsManager = require('../services/websocket');

const logger = createLogger('Webhook');
const router = Router();

// ── Main webhook endpoint ────────────────────────────────────────────────────
// Note: express.raw() middleware is applied in index.js for this route.
router.post('/stripe', async (req, res) => {
  const { stripeWebhookSecret } = getConfig();
  const sig = req.headers['stripe-signature'];

  if (!stripeWebhookSecret || stripeWebhookSecret.includes('REPLACE')) {
    logger.error('Stripe webhook secret is not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // ── 1. Verify signature ──────────────────────────────────────────────────
  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
  } catch (err) {
    logger.warn('Webhook signature verification failed', { error: err.message });
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // ── 2. Idempotency check ─────────────────────────────────────────────────
  try {
    const existing = await prisma.webhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });
    if (existing) {
      logger.info('Duplicate webhook event – skipping', { eventId: event.id, type: event.type });
      return res.json({ received: true, duplicate: true });
    }
  } catch (err) {
    logger.error('DB error during idempotency check', { error: err.message });
    // Do not return 500 – Stripe would retry; instead fall through and try to process
  }

  // Acknowledge receipt to Stripe immediately (prevents timeout retries)
  res.json({ received: true });

  // ── 3. Process the event asynchronously ─────────────────────────────────
  setImmediate(() => _handleEvent(event).catch((err) => {
    logger.error('Unhandled error in webhook event processor', {
      eventId: event.id,
      type: event.type,
      error: err.message,
      stack: err.stack,
    });
  }));
});

// ── Event dispatcher ─────────────────────────────────────────────────────────
async function _handleEvent(event) {
  logger.info('Processing webhook event', { id: event.id, type: event.type });

  switch (event.type) {
    case 'payment_intent.succeeded':
      await _onPaymentSucceeded(event.data.object);
      break;

    case 'payment_intent.payment_failed':
      await _onPaymentFailed(event.data.object);
      break;

    case 'payment_intent.canceled':
      await _onPaymentCancelled(event.data.object);
      break;

    case 'checkout.session.completed':
      await _onCheckoutCompleted(event.data.object);
      break;

    default:
      logger.info('Unhandled event type – ignoring', { type: event.type });
  }

  // ── Record the event (idempotency log) ──────────────────────────────────
  try {
    await prisma.webhookEvent.create({
      data: { stripeEventId: event.id, type: event.type },
    });
  } catch (err) {
    // Unique-constraint violation means a parallel worker already wrote it – safe to ignore
    if (err.code !== 'P2002') {
      logger.error('Failed to record webhook event', { error: err.message });
    }
  }
}

// ── payment_intent.succeeded ─────────────────────────────────────────────────
async function _onPaymentSucceeded(paymentIntent) {
  const { bookingId, userId } = paymentIntent.metadata || {};
  logger.info('PaymentIntent succeeded', { stripeId: paymentIntent.id, bookingId });

  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntent.id },
    include: { booking: true },
  });

  if (!payment) {
    logger.warn('No Payment record found for PaymentIntent', { stripeId: paymentIntent.id });
    return;
  }

  // Confirm booking + unlock room atomically
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'SUCCEEDED' },
    }),
    prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: 'CONFIRMED' },
    }),
    prisma.hotelRoom.update({
      where: { id: payment.booking.roomId },
      data: { locked: false, lockedAt: null },
    }),
  ]);

  logger.info('Booking confirmed', { bookingId: payment.bookingId });

  // Notify the client via WebSocket
  const notification = {
    type: 'PAYMENT_SUCCEEDED',
    bookingId: payment.bookingId,
    paymentId: payment.id,
    timestamp: new Date().toISOString(),
  };

  const targetUserId = userId || payment.booking.userId;
  if (targetUserId) {
    wsManager.notifyUser(targetUserId, notification);
  }
  wsManager.broadcast({ ...notification, broadcastType: 'BOOKING_CONFIRMED' });
}

// ── payment_intent.payment_failed ────────────────────────────────────────────
async function _onPaymentFailed(paymentIntent) {
  const { bookingId, userId } = paymentIntent.metadata || {};
  logger.info('PaymentIntent failed', { stripeId: paymentIntent.id, bookingId });

  await _releaseBooking(paymentIntent.id, 'FAILED', userId);
}

// ── payment_intent.canceled ──────────────────────────────────────────────────
async function _onPaymentCancelled(paymentIntent) {
  const { bookingId, userId } = paymentIntent.metadata || {};
  logger.info('PaymentIntent cancelled', { stripeId: paymentIntent.id, bookingId });

  await _releaseBooking(paymentIntent.id, 'CANCELLED', userId);
}

// ── checkout.session.completed ───────────────────────────────────────────────
async function _onCheckoutCompleted(session) {
  // If you use Checkout Sessions, the PaymentIntent ID is available here
  const paymentIntentId = session.payment_intent;
  const { bookingId, userId } = session.metadata || {};

  logger.info('Checkout session completed', {
    sessionId: session.id,
    paymentIntentId,
    bookingId,
  });

  if (session.payment_status === 'paid' && paymentIntentId) {
    // Reuse the same success handler
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    await _onPaymentSucceeded(paymentIntent);
  }
}

// ── Shared helper: cancel booking + release room lock ────────────────────────
async function _releaseBooking(stripePaymentIntentId, paymentStatus, userId) {
  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId },
    include: { booking: true },
  });

  if (!payment) {
    logger.warn('No Payment record found for PaymentIntent', { stripeId: stripePaymentIntentId });
    return;
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: paymentStatus },
    }),
    prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: 'CANCELLED' },
    }),
    prisma.hotelRoom.update({
      where: { id: payment.booking.roomId },
      data: { locked: false, lockedAt: null },
    }),
  ]);

  logger.info('Booking cancelled, room released', {
    bookingId: payment.bookingId,
    paymentStatus,
  });

  const eventType = paymentStatus === 'FAILED' ? 'PAYMENT_FAILED' : 'PAYMENT_CANCELLED';
  const notification = {
    type: eventType,
    bookingId: payment.bookingId,
    paymentId: payment.id,
    timestamp: new Date().toISOString(),
  };

  const targetUserId = userId || payment.booking.userId;
  if (targetUserId) {
    wsManager.notifyUser(targetUserId, notification);
  }
  wsManager.broadcast({ ...notification, broadcastType: 'BOOKING_CANCELLED' });
}

module.exports = router;
