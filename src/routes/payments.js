'use strict';

/**
 * Payment & Booking routes
 *
 * POST /api/payments/create-intent
 *   → Creates a Booking (PENDING), locks the HotelRoom, creates a Stripe
 *     PaymentIntent, saves a Payment record. Returns the client_secret.
 *
 * GET  /api/payments/:bookingId
 *   → Returns the Payment + Booking status for a given booking.
 *
 * POST /api/payments/cancel/:bookingId
 *   → Cancels a pending payment, releases the room lock, cancels the booking.
 *
 * GET  /api/rooms
 *   → Lists all hotel rooms (with availability).
 *
 * POST /api/rooms  (admin convenience – seed rooms during development)
 *   → Creates a new hotel room.
 */

const { Router } = require('express');
const { createLogger } = require('../logger');
const prisma = require('../services/prisma');
const { getStripe } = require('../services/stripe');
const { authenticate } = require('../middleware/auth');

const logger = createLogger('Payments');
const router = Router();

// ── List rooms ───────────────────────────────────────────────────────────────
router.get('/rooms', authenticate, async (req, res) => {
  try {
    const rooms = await prisma.hotelRoom.findMany({
      orderBy: { number: 'asc' },
      select: {
        id: true,
        number: true,
        name: true,
        pricePerNight: true,
        locked: true,
      },
    });
    res.json({ rooms });
  } catch (err) {
    logger.error('Failed to list rooms', { error: err.message });
    res.status(500).json({ error: 'Failed to list rooms' });
  }
});

// ── Seed / create a room (dev helper) ───────────────────────────────────────
router.post('/rooms', authenticate, async (req, res) => {
  try {
    const { number, name, pricePerNight } = req.body;
    if (!number || !name || !pricePerNight) {
      return res.status(400).json({ error: 'number, name, and pricePerNight are required' });
    }

    const room = await prisma.hotelRoom.create({
      data: {
        number: String(number),
        name,
        pricePerNight: parseInt(pricePerNight, 10), // cents
      },
    });

    logger.info('Room created', { roomId: room.id, number: room.number });
    res.status(201).json({ room });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Room number already exists' });
    }
    logger.error('Failed to create room', { error: err.message });
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// ── Create PaymentIntent + Booking ──────────────────────────────────────────
router.post('/create-intent', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { roomId, currency = 'usd' } = req.body;

  if (!roomId) {
    return res.status(400).json({ error: 'roomId is required' });
  }

  // Wrap everything in a try so we can return clean error responses
  let booking = null;

  try {
    const stripe = getStripe();

    // 1. Load the room and verify it is not already locked
    const room = await prisma.hotelRoom.findUnique({ where: { id: roomId } });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (room.locked) {
      return res.status(409).json({ error: 'Room is currently reserved. Please try again later.' });
    }

    // 2. Create Booking (PENDING) + lock room atomically
    const [createdBooking] = await prisma.$transaction([
      prisma.booking.create({
        data: {
          status: 'PENDING',
          roomId: room.id,
          userId,
        },
      }),
      prisma.hotelRoom.update({
        where: { id: room.id },
        data: { locked: true, lockedAt: new Date() },
      }),
    ]);
    booking = createdBooking;

    logger.info('Booking created, room locked', {
      bookingId: booking.id,
      roomId: room.id,
      userId,
    });

    // 3. Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: room.pricePerNight,
      currency: currency.toLowerCase(),
      metadata: {
        bookingId: booking.id,
        roomId: room.id,
        userId,
      },
      // Automatically cancel after 30 minutes if not paid
      // (requires Stripe dashboard payment_intent.canceled webhook event)
    });

    // 4. Persist the Payment record
    const payment = await prisma.payment.create({
      data: {
        stripePaymentIntentId: paymentIntent.id,
        amount: room.pricePerNight,
        currency: currency.toLowerCase(),
        status: 'PENDING',
        bookingId: booking.id,
      },
    });

    logger.info('PaymentIntent created', {
      paymentId: payment.id,
      stripeId: paymentIntent.id,
      bookingId: booking.id,
    });

    res.status(201).json({
      bookingId: booking.id,
      paymentId: payment.id,
      clientSecret: paymentIntent.client_secret,
      amount: room.pricePerNight,
      currency,
    });
  } catch (err) {
    // If something went wrong after we created the booking, roll back the lock
    if (booking) {
      try {
        await prisma.$transaction([
          prisma.booking.update({
            where: { id: booking.id },
            data: { status: 'CANCELLED' },
          }),
          prisma.hotelRoom.update({
            where: { id: booking.roomId },
            data: { locked: false, lockedAt: null },
          }),
        ]);
        logger.warn('Rolled back booking and room lock after error', { bookingId: booking.id });
      } catch (rollbackErr) {
        logger.error('Rollback failed', { error: rollbackErr.message });
      }
    }

    logger.error('Failed to create payment intent', { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message || 'Failed to create payment intent' });
  }
});

// ── Get booking + payment status ─────────────────────────────────────────────
router.get('/:bookingId', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: {
          select: {
            id: true,
            stripePaymentIntentId: true,
            amount: true,
            currency: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        room: {
          select: { id: true, number: true, name: true, pricePerNight: true },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only the owner can see their booking
    if (booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ booking });
  } catch (err) {
    logger.error('Failed to get booking', { error: err.message });
    res.status(500).json({ error: 'Failed to get booking' });
  }
});

// ── Cancel a pending booking ─────────────────────────────────────────────────
router.post('/cancel/:bookingId', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const stripe = getStripe();

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (booking.status !== 'PENDING') {
      return res.status(409).json({ error: `Cannot cancel a booking with status ${booking.status}` });
    }

    // Cancel the PaymentIntent in Stripe first
    if (booking.payment) {
      try {
        await stripe.paymentIntents.cancel(booking.payment.stripePaymentIntentId);
        logger.info('Stripe PaymentIntent cancelled', {
          stripeId: booking.payment.stripePaymentIntentId,
        });
      } catch (stripeErr) {
        // If already cancelled, that's fine
        if (stripeErr.code !== 'payment_intent_unexpected_state') {
          logger.warn('Could not cancel Stripe PaymentIntent', { error: stripeErr.message });
        }
      }
    }

    // Cancel booking + release room lock atomically
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
      }),
      ...(booking.payment
        ? [prisma.payment.update({
            where: { id: booking.payment.id },
            data: { status: 'CANCELLED' },
          })]
        : []),
      prisma.hotelRoom.update({
        where: { id: booking.roomId },
        data: { locked: false, lockedAt: null },
      }),
    ]);

    logger.info('Booking cancelled', { bookingId, userId: req.user.id });
    res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    logger.error('Failed to cancel booking', { error: err.message });
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

module.exports = router;
