'use strict';

/**
 * Payment & Booking routes (adapted for the new schema)
 *
 * POST /api/payments/create-intent
 *   -> Creates a RoomHold, then a Booking with BookingServices,
 *      then a Stripe PaymentIntent + Payment record.
 *
 * GET  /api/payments/:bookingId
 *   -> Returns the Payment + Booking status.
 *
 * POST /api/payments/cancel/:bookingId
 *   -> Cancels a pending payment, marks hold as CANCELLED, cancels booking.
 *
 * GET  /api/payments/config
 *   -> Returns the Stripe publishable key.
 */

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../logger');
const { getConfig } = require('../config');
const prisma = require('../services/prisma');
const { getStripe } = require('../services/stripe');
const { authenticate } = require('../middleware/auth');
const { serializeBooking } = require('../utils/serializers');

const logger = createLogger('Payments');
const router = Router();

const HOLD_DURATION_MINUTES = 5;

// ── Client config (publishable key) — must be before /:bookingId ────────────

router.get('/config', (_req, res) => {
  const { stripePublishableKey } = getConfig();
  res.json({ stripePublishableKey });
});

// ── Create PaymentIntent + Booking ──────────────────────────────────────────

router.post('/create-intent', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { roomNo, checkIn, checkOut, currency = 'usd', selectedServices, notes } = req.body;

  // ── Validate inputs ─────────────────────────────────────────────────────

  if (!roomNo) return res.status(400).json({ error: 'roomNo is required' });
  if (!checkIn || !checkOut) return res.status(400).json({ error: 'checkIn and checkOut are required' });

  const startDate = new Date(checkIn);
  const endDate = new Date(checkOut);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format' });
  }
  if (startDate >= endDate) {
    return res.status(400).json({ error: 'checkOut must be after checkIn' });
  }

  let booking = null;
  let hold = null;
  let paymentIntent = null; // tracked so rollback can cancel it if payment.create() fails

  try {
    const stripe = getStripe();

    // 1. Load the room
    const room = await prisma.room.findUnique({
      where: { roomNo },
      include: {
        roomServices: { include: { service: true } },
      },
    });

    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status !== 'ACTIVE') {
      return res.status(409).json({ error: 'Room is not available for booking' });
    }

    // 2. Check for overlapping bookings (non-cancelled)
    const overlap = await prisma.booking.findFirst({
      where: {
        roomNo,
        status: { notIn: ['CANCELLED'] },
        startDate: { lt: endDate },
        endDate: { gt: startDate },
      },
      include: {
        payment: true,
        hold: { select: { holdId: true, expiresAt: true } },
      },
    });

    if (overlap) {
      const now = new Date();
      const holdExpired = overlap.hold && overlap.hold.expiresAt <= now;
      const isPending = overlap.status === 'PENDING';
      const exactDateMatch =
        overlap.startDate.getTime() === startDate.getTime() &&
        overlap.endDate.getTime() === endDate.getTime();

      // ─── Case 1: Any PENDING booking whose hold has expired — stale, clean up ──
      if (isPending && holdExpired) {
        logger.info('Cancelling stale booking with expired hold', {
          bookingId: overlap.bookingId,
          expiresAt: overlap.hold.expiresAt,
        });

        const txOps = [
          prisma.booking.update({
            where: { bookingId: overlap.bookingId },
            data: { status: 'CANCELLED' },
          }),
          prisma.roomHold.update({
            where: { holdId: overlap.holdId },
            data: { status: 'CANCELLED' },
          }),
        ];
        if (overlap.payment) {
          txOps.push(
            prisma.payment.update({
              where: { id: overlap.payment.id },
              data: { status: 'CANCELLED' },
            }),
          );
          // Cancel the Stripe PI so no late payments can succeed
          try {
            await stripe.paymentIntents.cancel(overlap.payment.stripePaymentIntentId);
          } catch (stripeErr) {
            // PI might already be in a terminal state — that's fine
            logger.warn('Could not cancel expired PI', { error: stripeErr.message });
          }
        }
        await prisma.$transaction(txOps);
        // Fall through to create a new booking
      }

      // ─── Case 2: User's own PENDING booking with EXACT same dates, hold still active ──
      // Handles all payment states: recoverable PI, terminal PI, missing payment.
      // Exact date match is required — if the user changed dates we fall through to Case 3.
      else if (overlap.userId === userId && isPending && !holdExpired && exactDateMatch) {
        const resumeNights = Math.ceil(
          (overlap.endDate.getTime() - overlap.startDate.getTime()) / (24 * 60 * 60 * 1000),
        );

        const recoverableStatuses = [
          'requires_payment_method',
          'requires_confirmation',
          'requires_action',
        ];

        // Sub-case 2a: payment record exists in DB
        if (overlap.payment?.status === 'PENDING') {
          const pi = await stripe.paymentIntents.retrieve(overlap.payment.stripePaymentIntentId);

          if (recoverableStatuses.includes(pi.status)) {
            // Happy path: payment can still be completed — hand back the client secret
            logger.info('Resuming existing PENDING booking (recoverable PI)', {
              bookingId: overlap.bookingId,
              userId,
            });
            return res.status(200).json({
              bookingId: overlap.bookingId,
              holdId: overlap.holdId,
              paymentId: overlap.payment.id,
              clientSecret: pi.client_secret,
              totalAmount: Number(overlap.totalAmount),
              currency: overlap.payment.currency,
              nights: resumeNights,
              expiresAt: overlap.hold.expiresAt,
              resumed: true,
            });
          }

          // PI reached a terminal state (succeeded/cancelled/failed) — cancel the
          // stale payment record in DB and create a fresh PI below.
          logger.info('PI in terminal state, issuing fresh PI for existing booking', {
            bookingId: overlap.bookingId,
            piStatus: pi.status,
          });
          try { await stripe.paymentIntents.cancel(overlap.payment.stripePaymentIntentId); } catch {}
          await prisma.payment.update({
            where: { id: overlap.payment.id },
            data: { status: 'CANCELLED' },
          });
        }

        // Sub-case 2b: payment record is missing, failed, or was just cancelled above.
        // Create a fresh Stripe PI (and payment record) for the existing booking + hold
        // instead of cancelling everything and starting from scratch.
        logger.info('Creating fresh PI for existing booking (no valid payment found)', {
          bookingId: overlap.bookingId,
          userId,
        });

        const freshAmount = Math.round(Number(overlap.totalAmount) * 100);
        const freshPI = await stripe.paymentIntents.create({
          amount: freshAmount,
          currency: currency.toLowerCase(),
          metadata: {
            bookingId: overlap.bookingId,
            holdId: overlap.holdId,
            roomNo,
            userId,
          },
        });

        const freshPayment = await prisma.payment.create({
          data: {
            stripePaymentIntentId: freshPI.id,
            amount: Number(overlap.totalAmount),
            currency: currency.toLowerCase(),
            status: 'PENDING',
            bookingId: overlap.bookingId,
          },
        });

        return res.status(200).json({
          bookingId: overlap.bookingId,
          holdId: overlap.holdId,
          paymentId: freshPayment.id,
          clientSecret: freshPI.client_secret,
          totalAmount: Number(overlap.totalAmount),
          currency: currency.toLowerCase(),
          nights: resumeNights,
          expiresAt: overlap.hold.expiresAt,
          resumed: true,
        });
      }

      // ─── Case 3: Genuine conflict (confirmed booking, or another user's active hold) ──
      else {
        return res.status(409).json({ error: 'Room is already booked for the selected dates' });
      }
    }

    // Also check active holds from other users
    const holdOverlap = await prisma.roomHold.findFirst({
      where: {
        roomNo,
        status: 'ACTIVE',
        userId: { not: userId },
        startDate: { lt: endDate },
        endDate: { gt: startDate },
        expiresAt: { gt: new Date() },
      },
    });
    if (holdOverlap) {
      return res.status(409).json({ error: 'Room is currently being reserved by another user' });
    }

    // 3. Calculate nights
    const msPerDay = 24 * 60 * 60 * 1000;
    const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay);

    // 4. Calculate total amount based on room price and services
    let totalAmount = Number(room.basePrice) * nights;

    // Build booking_services list based on room_services defaults + user selections
    const bookingServicesData = [];
    const serviceMap = new Map(
      room.roomServices.map((rs) => [rs.serviceCode, rs])
    );

    // selectedServices: { "WIFI": true, "BREAKFAST": false, ... }
    // If not provided, use defaults
    const selections = selectedServices || {};

    for (const [code, rs] of serviceMap) {
      const service = rs.service;
      if (!service.isActive) continue;

      if (rs.defaultState === 'INCLUDED') {
        // Always present, cannot be removed.
        // Cost is already baked into room.basePrice — do NOT add to totalAmount.
        bookingServicesData.push({
          serviceCode: code,
          sourceState: 'INCLUDED',
          priceSnapshot: 0,
        });
        continue;
      }

      // OPTIONAL_ON / OPTIONAL_OFF: respect user selection
      let include = false;
      if (rs.defaultState === 'OPTIONAL_ON') {
        include = selections[code] !== false;
      } else if (rs.defaultState === 'OPTIONAL_OFF') {
        include = selections[code] === true;
      }

      if (include) {
        const servicePrice = Number(service.basePrice);
        const priceForBooking =
          service.priceType === 'PER_NIGHT' ? servicePrice * nights : servicePrice;

        totalAmount += priceForBooking;

        bookingServicesData.push({
          serviceCode: code,
          sourceState: rs.defaultState,
          priceSnapshot: priceForBooking,
        });
      }
    }

    // 5. Create RoomHold + Booking + BookingServices in transaction
    const holdId = uuidv4();
    const bookingId = uuidv4();
    const expiresAt = new Date(Date.now() + HOLD_DURATION_MINUTES * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      const createdHold = await tx.roomHold.create({
        data: {
          holdId,
          roomNo,
          userId,
          startDate,
          endDate,
          expiresAt,
          status: 'ACTIVE',
        },
      });

      const createdBooking = await tx.booking.create({
        data: {
          bookingId,
          holdId,
          userId,
          roomNo,
          startDate,
          endDate,
          status: 'PENDING',
          totalAmount,
          notes: notes || null,
        },
      });

      if (bookingServicesData.length > 0) {
        await tx.bookingService.createMany({
          data: bookingServicesData.map((bs) => ({
            bookingId,
            serviceCode: bs.serviceCode,
            sourceState: bs.sourceState,
            priceSnapshot: bs.priceSnapshot,
          })),
        });
      }

      return { hold: createdHold, booking: createdBooking };
    });

    hold = result.hold;
    booking = result.booking;

    logger.info('Booking created with hold', {
      bookingId: booking.bookingId,
      holdId: hold.holdId,
      roomNo,
      userId,
      totalAmount,
    });

    // 6. Create Stripe PaymentIntent
    // Stripe amount is in smallest currency unit (cents for USD)
    const stripeAmount = Math.round(totalAmount * 100);

    paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmount,
      currency: currency.toLowerCase(),
      metadata: {
        bookingId: booking.bookingId,
        holdId: hold.holdId,
        roomNo,
        userId,
      },
    });

    // 7. Persist the Payment record
    const payment = await prisma.payment.create({
      data: {
        stripePaymentIntentId: paymentIntent.id,
        amount: totalAmount,
        currency: currency.toLowerCase(),
        status: 'PENDING',
        bookingId: booking.bookingId,
      },
    });

    logger.info('PaymentIntent created', {
      paymentId: payment.id,
      stripeId: paymentIntent.id,
      bookingId: booking.bookingId,
    });

    res.status(201).json({
      bookingId: booking.bookingId,
      holdId: hold.holdId,
      paymentId: payment.id,
      clientSecret: paymentIntent.client_secret,
      totalAmount,
      currency,
      nights,
      expiresAt: hold.expiresAt,
      services: bookingServicesData,
    });
  } catch (err) {
    // Rollback: if booking/hold was created but Stripe PI creation or payment.create() failed,
    // cancel all DB records AND the orphaned Stripe PI (if it was already created).
    if (booking) {
      // Cancel the orphaned PI in Stripe so it doesn't linger
      if (paymentIntent) {
        try {
          const stripe = getStripe();
          await stripe.paymentIntents.cancel(paymentIntent.id);
        } catch (stripeErr) {
          logger.warn('Could not cancel orphaned Stripe PI during rollback', {
            piId: paymentIntent.id,
            error: stripeErr.message,
          });
        }
      }

      try {
        await prisma.$transaction([
          prisma.bookingService.deleteMany({ where: { bookingId: booking.bookingId } }),
          prisma.booking.update({
            where: { bookingId: booking.bookingId },
            data: { status: 'CANCELLED' },
          }),
          prisma.roomHold.update({
            where: { holdId: hold.holdId },
            data: { status: 'CANCELLED' },
          }),
        ]);
        logger.warn('Rolled back booking and hold after error', {
          bookingId: booking.bookingId,
        });
      } catch (rollbackErr) {
        logger.error('Rollback failed — booking may be stuck PENDING', {
          bookingId: booking.bookingId,
          error: rollbackErr.message,
        });
      }
    }

    logger.error('Failed to create payment intent', { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message || 'Failed to create payment intent' });
  }
});

// ── Get booking + payment status ────────────────────────────────────────────

router.get('/:bookingId', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { bookingId },
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
          select: {
            roomNo: true,
            title: true,
            basePrice: true,
            hotel: { select: { hotelCode: true, name: true } },
          },
        },
        bookingServices: {
          include: {
            service: {
              select: {
                serviceCode: true,
                title: true,
                priceType: true,
              },
            },
          },
        },
        hold: {
          select: { holdId: true, status: true, expiresAt: true },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ booking: serializeBooking(booking) });
  } catch (err) {
    logger.error('Failed to get booking', { error: err.message });
    res.status(500).json({ error: 'Failed to get booking' });
  }
});

// ── Cancel a pending booking ────────────────────────────────────────────────

router.post('/cancel/:bookingId', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const stripe = getStripe();

    const booking = await prisma.booking.findUnique({
      where: { bookingId },
      include: { payment: true, hold: true },
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
        if (stripeErr.code !== 'payment_intent_unexpected_state') {
          logger.warn('Could not cancel Stripe PaymentIntent', { error: stripeErr.message });
        }
      }
    }

    // Cancel booking + hold + payment atomically
    const txOps = [
      prisma.booking.update({
        where: { bookingId },
        data: { status: 'CANCELLED' },
      }),
    ];

    if (booking.hold) {
      txOps.push(
        prisma.roomHold.update({
          where: { holdId: booking.holdId },
          data: { status: 'CANCELLED' },
        })
      );
    }

    if (booking.payment) {
      txOps.push(
        prisma.payment.update({
          where: { id: booking.payment.id },
          data: { status: 'CANCELLED' },
        })
      );
    }

    await prisma.$transaction(txOps);

    logger.info('Booking cancelled', { bookingId, userId: req.user.id });
    res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    logger.error('Failed to cancel booking', { error: err.message });
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

module.exports = router;
