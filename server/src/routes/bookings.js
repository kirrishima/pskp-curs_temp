'use strict';

/**
 * Bookings router — /api/bookings
 *
 * GET  /                         – List bookings for the current user.
 *                                  Admins/managers receive a query param ?userId= override.
 * GET  /:bookingId               – Full booking detail (owner, admin, or manager).
 * POST /:bookingId/cancel        – Cancel a booking with optional Stripe refund.
 *
 * Cancellation business rules
 * ───────────────────────────
 * source=GUEST
 *   • CONFIRMED bookings only.
 *   • ≥ 48 h before check-in (14:00) → full refund, no penalty.
 *   • <  48 h before check-in        → penalty = 1 night (room.basePrice), partial refund.
 *
 * source=ADMIN  (admin / manager role required)
 *   • applyPenalty: bool  – manually decide whether to withhold 1 night.
 *   • reason: string      – mandatory cancellation reason.
 *
 * source=HOTEL  (admin / manager role required)
 *   • Always 100 % refund, penalty locked to 0.
 *   • "Cancellation by hotel" email is sent to the guest.
 *
 * PENDING bookings (unpaid) can be cancelled by owner or admin at any time
 * — no Stripe interaction is needed (the PaymentIntent is just cancelled).
 *
 * BR-P2: refundAmount never exceeds payment.amount (validated before API call).
 * BR-P1: Stripe refund failures set refundStatus=ACTION_REQUIRED and alert admins.
 * BR-S4: Inventory is freed atomically in the same DB transaction as the status update.
 */

const { Router } = require('express');
const { createLogger } = require('../logger');
const prisma = require('../services/prisma');
const { getStripe } = require('../services/stripe');
const { authenticate } = require('../middleware/auth');
const { authorize, resolveRole } = require('../middleware/authorize');
const { serializeBooking } = require('../utils/serializers');
const { sendCancellationEmail } = require('../services/email');

const logger = createLogger('Bookings');
const router = Router();

// All routes require authentication
router.use(authenticate);

// ── GET / — list bookings ────────────────────────────────────────────────────
// Regular users → own bookings only.
// Staff (admin/manager) → all bookings with pagination, filters, search.

router.get('/', resolveRole, async (req, res) => {
  try {
    const isStaff = req.userRole === 'admin' || req.userRole === 'manager';
    const isAdmin = req.userRole === 'admin';

    // ── Build WHERE clause ──────────────────────────────────────────────────
    const where = {};

    if (!isStaff) {
      // Regular user — own bookings only
      where.userId = req.user.id;
      if (req.query.status) where.status = req.query.status;
    } else {
      // Manager: active statuses + recently changed (7 days)
      if (!isAdmin && !req.query.status) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        where.OR = [
          { status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] } },
          {
            status: { in: ['NO_SHOW', 'CHECKED_OUT', 'CANCELLED'] },
            updatedAt: { gte: sevenDaysAgo },
          },
        ];
      }

      // Status filter
      if (req.query.status) {
        if (!isAdmin) {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const terminalStatuses = ['NO_SHOW', 'CHECKED_OUT', 'CANCELLED'];
          if (terminalStatuses.includes(req.query.status)) {
            delete where.OR;
            where.status = req.query.status;
            where.updatedAt = { gte: sevenDaysAgo };
          } else {
            delete where.OR;
            where.status = req.query.status;
          }
        } else {
          where.status = req.query.status;
        }
      }

      // Date range filter
      if (req.query.dateFrom) {
        where.startDate = { ...(where.startDate || {}), gte: new Date(req.query.dateFrom) };
      }
      if (req.query.dateTo) {
        where.endDate = { ...(where.endDate || {}), lte: new Date(req.query.dateTo) };
      }

      // Search by booking ID fragment.
      // UUID fields in Prisma don't support `contains`, so we cast to text via raw SQL
      // to find matching IDs, then use `in` on the result.
      if (req.query.search) {
        const searchPattern = `%${req.query.search.trim()}%`;
        const matched = await prisma.$queryRaw`
          SELECT booking_id::text AS id FROM bookings
          WHERE booking_id::text ILIKE ${searchPattern}
          LIMIT 200
        `;
        where.bookingId = { in: matched.map((r) => r.id) };
      }
    }

    // ── Pagination ──────────────────────────────────────────────────────────
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // ── Sorting ─────────────────────────────────────────────────────────────
    const allowedSortFields = ['createdAt', 'startDate', 'endDate', 'totalAmount', 'status'];
    const sortBy = allowedSortFields.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    // ── Query ───────────────────────────────────────────────────────────────
    const include = {
      room: {
        select: {
          roomNo: true,
          title: true,
          floor: true,
          basePrice: true,
          images: { where: { isMain: true }, take: 1, select: { imageId: true, ext: true, isMain: true } },
          hotel: { select: { hotelCode: true, name: true, city: true } },
        },
      },
      payment: {
        select: {
          id: true,
          stripePaymentIntentId: true,
          amount: true,
          currency: true,
          status: true,
          stripeChargeId: true,
          stripeRefundId: true,
          stripeRefundStatus: true,
          refundAmount: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      bookingServices: {
        include: {
          service: { select: { serviceCode: true, title: true, priceType: true } },
        },
      },
    };

    if (isStaff) {
      include.hold = { select: { holdId: true, status: true, expiresAt: true, startDate: true, endDate: true } };
      include.user = { select: { id: true, firstName: true, lastName: true, email: true, phone: true } };
    }

    const [bookings, totalCount] = await prisma.$transaction([
      prisma.booking.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        include,
      }),
      prisma.booking.count({ where }),
    ]);

    // Strip sensitive payment fields for manager (not admin)
    const serialized = bookings.map((b) => {
      const sb = serializeBooking(b);
      if (!isAdmin && isStaff && sb.payment) {
        sb.payment = {
          id: sb.payment.id,
          amount: sb.payment.amount,
          currency: sb.payment.currency,
          status: sb.payment.status,
          createdAt: sb.payment.createdAt,
        };
      }
      if (!isAdmin) delete sb.hold;
      return sb;
    });

    res.json({
      bookings: serialized,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    logger.error('Failed to list bookings', { error: err.message });
    res.status(500).json({ error: 'Failed to list bookings' });
  }
});

// ── GET /:bookingId — booking detail ─────────────────────────────────────────

router.get('/:bookingId', resolveRole, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const isStaff = req.userRole === 'admin' || req.userRole === 'manager';
    const isAdmin = req.userRole === 'admin';

    const detailInclude = {
      room: {
        include: {
          hotel: true,
          images: true,
          roomServices: { include: { service: true } },
        },
      },
      payment: true,
      bookingServices: {
        include: {
          service: { select: { serviceCode: true, title: true, priceType: true, icon: true, iconUrl: true } },
        },
      },
      hold: { select: { holdId: true, status: true, expiresAt: true, startDate: true, endDate: true, createdAt: true } },
    };

    if (isStaff) {
      detailInclude.user = { select: { id: true, firstName: true, lastName: true, email: true, phone: true } };
    }

    const booking = await prisma.booking.findUnique({
      where: { bookingId },
      include: detailInclude,
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (!isStaff && booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const sb = serializeBooking(booking);

    // Manager: limited payment info, no hold details
    if (isStaff && !isAdmin && sb.payment) {
      sb.payment = {
        id: sb.payment.id,
        amount: sb.payment.amount,
        currency: sb.payment.currency,
        status: sb.payment.status,
        createdAt: sb.payment.createdAt,
        updatedAt: sb.payment.updatedAt,
        refundAmount: sb.payment.refundAmount,
      };
    }
    if (!isAdmin) delete sb.hold;

    res.json({ booking: sb });
  } catch (err) {
    logger.error('Failed to get booking', { error: err.message });
    res.status(500).json({ error: 'Failed to get booking' });
  }
});

// ── POST /:bookingId/cancel — cancel with optional refund ────────────────────

router.post('/:bookingId/cancel', resolveRole, async (req, res) => {
  const { bookingId } = req.params;
  const { source = 'GUEST', applyPenalty = false, reason } = req.body;
  const actorId = req.user.id;
  const isStaff = req.userRole === 'admin' || req.userRole === 'manager';

  try {
    // ── 1. Load booking ─────────────────────────────────────────────────────

    const booking = await prisma.booking.findUnique({
      where: { bookingId },
      include: {
        payment: true,
        room: { select: { roomNo: true, title: true, basePrice: true, hotel: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        hold: { select: { holdId: true, status: true } },
        bookingServices: { include: { service: true } },
      },
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // ── 2. Authorization ────────────────────────────────────────────────────

    if ((source === 'ADMIN' || source === 'HOTEL') && !isStaff) {
      return res.status(403).json({ error: 'Forbidden: staff role required' });
    }
    if (source === 'GUEST' && booking.userId !== actorId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (source === 'ADMIN' && !reason) {
      return res.status(400).json({ error: 'reason is required for admin cancellations' });
    }

    // ── 3. Check cancellable status ─────────────────────────────────────────

    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      return res.status(409).json({
        error: `Cannot cancel a booking with status ${booking.status}`,
      });
    }

    // ── 4. PENDING bookings — no Stripe refund needed ───────────────────────

    if (booking.status === 'PENDING') {
      const stripe = getStripe();
      if (booking.payment) {
        try {
          await stripe.paymentIntents.cancel(booking.payment.stripePaymentIntentId);
        } catch (e) {
          if (e.code !== 'payment_intent_unexpected_state') {
            logger.warn('Could not cancel Stripe PaymentIntent', { error: e.message });
          }
        }
      }
      await _applyCancellation(booking, {
        source,
        reason: reason || null,
        actorId,
        penaltyAmount: 0,
        refundStatus: 'NONE',
        stripeRefundId: null,
        stripeRefundStatus: null,
        refundAmountActual: 0,
      });
      logger.info('PENDING booking cancelled (no refund)', { bookingId, actorId });
      return res.json({ message: 'Booking cancelled', refundAmount: 0, penaltyAmount: 0 });
    }

    // ── 5. CONFIRMED — calculate penalty ────────────────────────────────────

    const checkInDateTime = new Date(booking.startDate);
    checkInDateTime.setHours(14, 0, 0, 0);
    const hoursUntilCheckIn = (checkInDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

    let penaltyAmount = 0;
    const oneNight = Number(booking.room.basePrice);

    if (source === 'HOTEL') {
      penaltyAmount = 0; // BR-S2: hotel-initiated → always full refund
    } else if (source === 'ADMIN') {
      penaltyAmount = applyPenalty ? oneNight : 0; // BR-S1
    } else {
      // GUEST
      penaltyAmount = hoursUntilCheckIn < 48 ? oneNight : 0; // BR-G1/G2
    }

    const totalPaid = Number(booking.payment.amount);
    const refundAmountCalc = Math.max(0, totalPaid - penaltyAmount);

    // BR-P2: Never refund more than was charged
    if (refundAmountCalc > totalPaid) {
      return res.status(400).json({ error: 'Refund amount cannot exceed the original charge' });
    }

    // ── 6. Execute Stripe refund ─────────────────────────────────────────────

    const stripe = getStripe();
    let stripeRefundId = null;
    let stripeRefundStatus = null;
    let refundStatus;
    let refundAmountActual = refundAmountCalc;

    if (refundAmountCalc > 0) {
      // Retrieve charge ID — prefer stored value, else pull from PaymentIntent
      let chargeId = booking.payment.stripeChargeId;
      if (!chargeId) {
        try {
          const pi = await stripe.paymentIntents.retrieve(
            booking.payment.stripePaymentIntentId,
          );
          chargeId = pi.latest_charge;
          if (chargeId) {
            // Persist for future calls (non-blocking)
            prisma.payment
              .update({ where: { id: booking.payment.id }, data: { stripeChargeId: chargeId } })
              .catch(() => {});
          }
        } catch (e) {
          logger.warn('Could not retrieve PaymentIntent to get chargeId', { error: e.message });
        }
      }

      if (!chargeId) {
        // BR-P1: Cannot obtain chargeId — mark as action required
        logger.error('Cannot refund: no chargeId found', { bookingId, paymentId: booking.payment.id });
        refundStatus = 'ACTION_REQUIRED';
        refundAmountActual = 0;
      } else {
        try {
          const refundParams = {
            charge: chargeId,
            amount: Math.round(refundAmountCalc * 100), // Stripe uses smallest unit
          };
          if (source === 'HOTEL') {
            refundParams.reason = 'fraudulent'; // closest Stripe reason for hotel-initiated
          }

          const refund = await stripe.refunds.create(refundParams);
          stripeRefundId = refund.id;
          stripeRefundStatus = refund.status;

          if (refund.status === 'succeeded') {
            refundStatus = penaltyAmount > 0 ? 'PARTIAL' : 'FULL';
          } else if (refund.status === 'pending') {
            refundStatus = 'PENDING';
          } else {
            refundStatus = 'ACTION_REQUIRED'; // BR-P1
          }

          logger.info('Stripe refund created', {
            bookingId,
            refundId: refund.id,
            status: refund.status,
            amount: refundAmountCalc,
          });
        } catch (stripeErr) {
          // BR-P1: Stripe API error during refund
          logger.error('Stripe refund failed', { bookingId, error: stripeErr.message });
          refundStatus = 'ACTION_REQUIRED';
          refundAmountActual = 0;
        }
      }
    } else {
      // No refund (penalty = full amount)
      refundStatus = 'NONE';
      refundAmountActual = 0;
    }

    // ── 7. Persist cancellation atomically ────────────────────────────────────

    await _applyCancellation(booking, {
      source,
      reason: reason || null,
      actorId,
      penaltyAmount,
      refundStatus,
      stripeRefundId,
      stripeRefundStatus,
      refundAmountActual,
    });

    logger.info('Confirmed booking cancelled', {
      bookingId,
      actorId,
      source,
      penaltyAmount,
      refundStatus,
    });

    // ── 8. Send cancellation email ────────────────────────────────────────────

    try {
      await sendCancellationEmail(
        {
          ...booking,
          room: { ...booking.room },
          user: booking.user,
        },
        {
          source,
          reason: reason || null,
          penaltyAmount,
          refundAmount: refundAmountActual,
          refundStatus,
        },
      );
    } catch (emailErr) {
      logger.warn('Cancellation email failed (non-fatal)', { error: emailErr.message });
    }

    return res.json({
      message: 'Booking cancelled',
      refundAmount: refundAmountActual,
      penaltyAmount,
      refundStatus,
    });
  } catch (err) {
    logger.error('Failed to cancel booking', { bookingId, error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// ── Helper: apply all DB changes atomically (BR-S4) ─────────────────────────

async function _applyCancellation(
  booking,
  { source, reason, actorId, penaltyAmount, refundStatus, stripeRefundId, stripeRefundStatus, refundAmountActual },
) {
  const txOps = [
    // Cancel the booking
    prisma.booking.update({
      where: { bookingId: booking.bookingId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledByUserId: actorId,
        cancellationSource: source,
        cancellationReason: reason || null,
        penaltyAmount: penaltyAmount > 0 ? penaltyAmount : null,
        refundStatus,
      },
    }),
  ];

  // Release hold if still active (BR-S4 — instant inventory release)
  if (booking.hold && booking.hold.status === 'ACTIVE') {
    txOps.push(
      prisma.roomHold.update({
        where: { holdId: booking.holdId },
        data: { status: 'CANCELLED' },
      }),
    );
  }

  // Update payment record with refund audit data
  if (booking.payment) {
    txOps.push(
      prisma.payment.update({
        where: { id: booking.payment.id },
        data: {
          status: 'CANCELLED',
          ...(stripeRefundId ? { stripeRefundId } : {}),
          ...(stripeRefundStatus ? { stripeRefundStatus } : {}),
          ...(refundAmountActual > 0 ? { refundAmount: refundAmountActual } : {}),
        },
      }),
    );
  }

  await prisma.$transaction(txOps);
}

module.exports = router;
