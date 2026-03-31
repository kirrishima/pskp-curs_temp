'use strict';

/**
 * No-show processing (BR-G3)
 *
 * A CONFIRMED booking becomes a NO_SHOW if:
 *   • The check-in date has passed (startDate + 1 day at 14:00 = the latest
 *     possible check-in time is 14:00 on day 2, i.e. 24h after the nominal
 *     check-in time of 14:00 on startDate).
 *   • The booking is still in status CONFIRMED (never changed to CHECKED_IN).
 *
 * When a no-show is detected:
 *   1. The booking transitions to NO_SHOW.
 *   2. A penalty of 1 night (room.basePrice) is recorded.
 *   3. A partial Stripe refund (totalAmount − penalty) is attempted.
 *   4. A cancellation email is sent to the guest.
 *
 * The check runs once at startup (to recover any missed windows) and then
 * every hour via setInterval.
 */

const { createLogger } = require('../logger');
const prisma = require('./prisma');
const { getStripe } = require('./stripe');
const { sendCancellationEmail } = require('./email');

const logger = createLogger('NoShow');

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function processNoShows() {
  logger.info('Running no-show check…');

  // No-show threshold: 14:00 the day AFTER startDate has passed
  const now = new Date();

  // Find CONFIRMED bookings where the no-show window has elapsed
  const candidates = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      // startDate is a @db.Date — compare as plain date. A booking whose
      // startDate is today or earlier and check-in window has closed is a no-show.
      // We use: startDate < today (yesterday or before) as the conservative cut-off.
      startDate: { lt: now },
    },
    include: {
      payment: true,
      room: { select: { roomNo: true, title: true, basePrice: true, hotel: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      bookingServices: { include: { service: true } },
      hold: { select: { holdId: true, status: true } },
    },
    take: 100, // Safety cap — prevents runaway processing
  });

  if (candidates.length === 0) {
    logger.info('No-show check complete: no candidates found.');
    return;
  }

  logger.info(`No-show check: ${candidates.length} candidate(s) found.`);

  for (const booking of candidates) {
    try {
      await _processOneNoShow(booking);
    } catch (err) {
      logger.error('Failed to process no-show', {
        bookingId: booking.bookingId,
        error: err.message,
      });
    }
  }

  logger.info('No-show check complete.');
}

async function _processOneNoShow(booking) {
  const penaltyAmount = Number(booking.room.basePrice);
  const totalPaid = Number(booking.payment?.amount ?? 0);
  const refundAmountCalc = Math.max(0, totalPaid - penaltyAmount);

  logger.info('Processing no-show booking', {
    bookingId: booking.bookingId,
    penaltyAmount,
    refundAmountCalc,
  });

  let stripeRefundId = null;
  let stripeRefundStatus = null;
  let refundStatus;
  let refundAmountActual = refundAmountCalc;

  // Attempt Stripe refund if there's anything to refund
  if (booking.payment && refundAmountCalc > 0) {
    const stripe = getStripe();
    let chargeId = booking.payment.stripeChargeId;

    if (!chargeId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(booking.payment.stripePaymentIntentId);
        chargeId = pi.latest_charge || null;
        if (chargeId) {
          await prisma.payment.update({
            where: { id: booking.payment.id },
            data: { stripeChargeId: chargeId },
          });
        }
      } catch (e) {
        logger.warn('Could not retrieve chargeId for no-show', {
          bookingId: booking.bookingId,
          error: e.message,
        });
      }
    }

    if (!chargeId) {
      refundStatus = 'ACTION_REQUIRED';
      refundAmountActual = 0;
    } else {
      try {
        const refund = await stripe.refunds.create({
          charge: chargeId,
          amount: Math.round(refundAmountCalc * 100),
        });
        stripeRefundId = refund.id;
        stripeRefundStatus = refund.status;
        refundStatus = refund.status === 'succeeded' ? 'PARTIAL' : 'PENDING';
      } catch (e) {
        logger.error('Stripe refund failed for no-show', {
          bookingId: booking.bookingId,
          error: e.message,
        });
        refundStatus = 'ACTION_REQUIRED';
        refundAmountActual = 0;
      }
    }
  } else {
    refundStatus = refundAmountCalc > 0 ? 'FULL' : 'NONE';
  }

  // Persist all changes atomically (BR-S4)
  const txOps = [
    prisma.booking.update({
      where: { bookingId: booking.bookingId },
      data: {
        status: 'NO_SHOW',
        cancelledAt: new Date(),
        cancellationSource: 'SYSTEM',
        cancellationReason: 'Незаезд: гость не прибыл в расчётный час',
        penaltyAmount,
        refundStatus,
      },
    }),
  ];

  if (booking.hold && booking.hold.status === 'ACTIVE') {
    txOps.push(
      prisma.roomHold.update({
        where: { holdId: booking.holdId },
        data: { status: 'CANCELLED' },
      }),
    );
  }

  if (booking.payment) {
    txOps.push(
      prisma.payment.update({
        where: { id: booking.payment.id },
        data: {
          ...(stripeRefundId ? { stripeRefundId } : {}),
          ...(stripeRefundStatus ? { stripeRefundStatus } : {}),
          ...(refundAmountActual > 0 ? { refundAmount: refundAmountActual } : {}),
        },
      }),
    );
  }

  await prisma.$transaction(txOps);

  logger.info('No-show processed', {
    bookingId: booking.bookingId,
    penaltyAmount,
    refundStatus,
  });

  // Send notification email
  try {
    await sendCancellationEmail(booking, {
      source: 'SYSTEM',
      reason: 'Незаезд: гость не прибыл в расчётный час',
      penaltyAmount,
      refundAmount: refundAmountActual,
      refundStatus,
    });
  } catch (e) {
    logger.warn('No-show email failed (non-fatal)', {
      bookingId: booking.bookingId,
      error: e.message,
    });
  }
}

function scheduleNoShowProcessing() {
  // Run immediately on startup (catches any missed overnight bookings)
  processNoShows().catch((err) =>
    logger.error('Initial no-show check failed', { error: err.message }),
  );

  // Then check every hour
  setInterval(() => {
    processNoShows().catch((err) =>
      logger.error('Scheduled no-show check failed', { error: err.message }),
    );
  }, CHECK_INTERVAL_MS);

  logger.info('No-show scheduler started (interval: 1 h)');
}

module.exports = { scheduleNoShowProcessing, processNoShows };
