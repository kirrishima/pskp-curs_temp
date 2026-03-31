'use strict';

/**
 * Stripe Webhook Handler (adapted for the new schema)
 *
 * Mounted at POST /api/webhooks/stripe
 *
 * IMPORTANT: Express must receive the RAW request body for signature
 * verification. The route is registered *before* express.json() in index.js
 * using express.raw({ type: 'application/json' }).
 *
 * Handled events:
 *   payment_intent.succeeded      -> confirm booking, convert hold
 *   payment_intent.payment_failed -> cancel booking, cancel hold
 *   payment_intent.canceled       -> cancel booking, cancel hold
 *   checkout.session.completed    -> delegated to succeeded handler
 */

const { Router } = require('express');
const { createLogger } = require('../logger');
const { getConfig } = require('../config');
const { getStripe } = require('../services/stripe');
const prisma = require('../services/prisma');
const wsManager = require('../services/websocket');
const { sendBookingConfirmation } = require('../services/email');

const logger = createLogger('Webhook');
const router = Router();

// ── Main webhook endpoint ────────────────────────────────────────────────────

router.post('/stripe', async (req, res) => {
  const { stripeWebhookSecret } = getConfig();
  const sig = req.headers['stripe-signature'];

  if (!stripeWebhookSecret || stripeWebhookSecret.includes('REPLACE')) {
    logger.error('Stripe webhook secret is not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
  } catch (err) {
    logger.warn('Webhook signature verification failed', { error: err.message });
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Idempotency check
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
  }

  res.json({ received: true });

  setImmediate(() =>
    _handleEvent(event).catch((err) => {
      logger.error('Unhandled error in webhook event processor', {
        eventId: event.id,
        type: event.type,
        error: err.message,
        stack: err.stack,
      });
    })
  );
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

  try {
    await prisma.webhookEvent.create({
      data: { stripeEventId: event.id, type: event.type },
    });
  } catch (err) {
    if (err.code !== 'P2002') {
      logger.error('Failed to record webhook event', { error: err.message });
    }
  }
}

// ── payment_intent.succeeded ─────────────────────────────────────────────────

async function _onPaymentSucceeded(paymentIntent) {
  const { bookingId, holdId, userId } = paymentIntent.metadata || {};
  logger.info('PaymentIntent succeeded', { stripeId: paymentIntent.id, bookingId });

  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntent.id },
    include: { booking: true },
  });

  if (!payment) {
    logger.warn('No Payment record found for PaymentIntent', { stripeId: paymentIntent.id });
    return;
  }

  // Capture the Stripe Charge ID now so refunds can be issued later (BR-S3)
  const chargeId = paymentIntent.latest_charge || null;

  // Confirm booking + convert hold atomically
  const txOps = [
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCEEDED',
        ...(chargeId ? { stripeChargeId: chargeId } : {}),
      },
    }),
    prisma.booking.update({
      where: { bookingId: payment.bookingId },
      data: { status: 'CONFIRMED' },
    }),
  ];

  if (payment.booking.holdId) {
    txOps.push(
      prisma.roomHold.update({
        where: { holdId: payment.booking.holdId },
        data: { status: 'CONVERTED' },
      })
    );
  }

  await prisma.$transaction(txOps);

  logger.info('Booking confirmed', { bookingId: payment.bookingId });

  // ── Send booking confirmation email ─────────────────────────────────────────
  try {
    const fullBooking = await prisma.booking.findUnique({
      where: { bookingId: payment.bookingId },
      include: {
        user: true,
        room: {
          include: {
            hotel: true,
            images: { where: { isMain: true }, take: 1 },
          },
        },
        bookingServices: {
          include: { service: true },
          orderBy: { serviceCode: 'asc' },
        },
        payment: true,
      },
    });

    if (fullBooking && fullBooking.user?.email) {
      await sendBookingConfirmation(fullBooking);
    }
  } catch (err) {
    // Email errors must not interrupt the payment success flow
    logger.error('Failed to send booking confirmation email', {
      bookingId: payment.bookingId,
      error: err.message,
    });
  }

  const notification = {
    type: 'PAYMENT_SUCCEEDED',
    bookingId: payment.bookingId,
    paymentId: payment.id,
    timestamp: new Date().toISOString(),
  };

  const targetUserId = userId || payment.booking.userId;
  if (targetUserId) wsManager.notifyUser(targetUserId, notification);
}

// ── payment_intent.payment_failed ────────────────────────────────────────────

async function _onPaymentFailed(paymentIntent) {
  // A charge attempt failed but the PaymentIntent remains active
  // (status: requires_payment_method). The user can retry with a different card.
  // Do NOT cancel the booking or release the hold.
  const { userId } = paymentIntent.metadata || {};
  logger.info('PaymentIntent attempt failed (non-terminal, user can retry)', {
    stripeId: paymentIntent.id,
  });

  // Send non-terminal notification so the client knows, but don't cancel anything
  if (userId) {
    wsManager.notifyUser(userId, {
      type: 'PAYMENT_ATTEMPT_FAILED',
      bookingId: paymentIntent.metadata?.bookingId,
      timestamp: new Date().toISOString(),
    });
  }
}

// ── payment_intent.canceled ──────────────────────────────────────────────────

async function _onPaymentCancelled(paymentIntent) {
  const { userId } = paymentIntent.metadata || {};
  logger.info('PaymentIntent cancelled', { stripeId: paymentIntent.id });
  await _releaseBooking(paymentIntent.id, 'CANCELLED', userId);
}

// ── checkout.session.completed ───────────────────────────────────────────────

async function _onCheckoutCompleted(session) {
  const paymentIntentId = session.payment_intent;
  logger.info('Checkout session completed', {
    sessionId: session.id,
    paymentIntentId,
  });

  if (session.payment_status === 'paid' && paymentIntentId) {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    await _onPaymentSucceeded(paymentIntent);
  }
}

// ── Shared helper: cancel booking + release hold ─────────────────────────────

async function _releaseBooking(stripePaymentIntentId, paymentStatus, userId) {
  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId },
    include: { booking: true },
  });

  if (!payment) {
    logger.warn('No Payment record found for PaymentIntent', { stripeId: stripePaymentIntentId });
    return;
  }

  const txOps = [
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: paymentStatus },
    }),
    prisma.booking.update({
      where: { bookingId: payment.bookingId },
      data: { status: 'CANCELLED' },
    }),
  ];

  if (payment.booking.holdId) {
    txOps.push(
      prisma.roomHold.update({
        where: { holdId: payment.booking.holdId },
        data: { status: 'CANCELLED' },
      })
    );
  }

  await prisma.$transaction(txOps);

  logger.info('Booking cancelled, hold released', {
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
  if (targetUserId) wsManager.notifyUser(targetUserId, notification);
}

module.exports = router;
