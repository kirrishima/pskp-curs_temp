'use strict';

/**
 * Reviews routes
 *
 * Public (no auth required):
 *   GET  /api/reviews/room/:roomNo             — paginated reviews for a room
 *   GET  /api/reviews/hotel/:hotelCode         — paginated reviews for a hotel
 *
 * Authenticated user:
 *   GET  /api/reviews/booking/:bookingId       — get own review for a booking
 *   POST /api/reviews                          — create review
 *   PATCH /api/reviews/:reviewId               — edit own review
 *   DELETE /api/reviews/:reviewId              — delete own review (or staff)
 */

const { Router } = require('express');
const { createLogger } = require('../logger');
const prisma = require('../services/prisma');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const logger = createLogger('Reviews');
const router = Router();

// ── Helper: resolve author name ───────────────────────────────────────────────

function resolveAuthorName(user) {
  if (!user) return 'Гость';
  const dn = user.displayName?.trim();
  return dn || user.firstName;
}

// ── Helper: serialize review for API output ───────────────────────────────────

function serializeReview(review, authorUser) {
  if (!review) return review;
  const user = authorUser ?? review.user;
  return {
    reviewId:   review.reviewId,
    bookingId:  review.bookingId,
    userId:     review.userId,
    roomNo:     review.roomNo,
    rating:     review.rating,
    text:       review.text ?? null,
    authorName: resolveAuthorName(user),
    imagesBase: `/uploads/reviews/${review.bookingId}`,
    images:     Array.isArray(review.images)
      ? review.images.map(img => ({
          imageId: img.imageId,
          ext: img.ext,
          isMain: img.isMain,
        }))
      : [],
    room: review.room
      ? {
          roomNo:    review.room.roomNo,
          title:     review.room.title,
          hotelCode: review.room.hotelCode,
          hotel:     review.room.hotel
            ? { hotelCode: review.room.hotel.hotelCode, name: review.room.hotel.name }
            : undefined,
        }
      : undefined,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

// ── Shared include for review queries ─────────────────────────────────────────

const REVIEW_INCLUDE = {
  images: { orderBy: { uploadedAt: 'asc' } },
  user:   { select: { firstName: true, displayName: true } },
  room: {
    select: {
      roomNo:    true,
      title:     true,
      hotelCode: true,
      hotel:     { select: { hotelCode: true, name: true } },
    },
  },
};

// ── Helper: check review eligibility for a user + booking ─────────────────────
// Returns the booking if eligible, throws otherwise.

async function assertReviewEligible(bookingId, userId) {
  const booking = await prisma.booking.findUnique({
    where: { bookingId },
    include: { payment: true },
  });

  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });
  if (booking.userId !== userId) throw Object.assign(new Error('Access denied'), { status: 403 });

  const isCheckedOut = booking.status === 'CHECKED_OUT';
  const isCancelledAfterPayment =
    booking.status === 'CANCELLED' && booking.payment?.status === 'SUCCEEDED';

  if (!isCheckedOut && !isCancelledAfterPayment) {
    throw Object.assign(
      new Error('Reviews can only be left after checkout or after a paid cancellation'),
      { status: 403 },
    );
  }

  return booking;
}

// ── GET /api/reviews/room/:roomNo ─────────────────────────────────────────────

router.get('/room/:roomNo', async (req, res) => {
  try {
    const { roomNo } = req.params;
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip  = (page - 1) * limit;

    const [totalCount, reviews] = await Promise.all([
      prisma.review.count({ where: { roomNo } }),
      prisma.review.findMany({
        where:   { roomNo },
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Aggregate rating
    const agg = await prisma.review.aggregate({
      where:   { roomNo },
      _avg:    { rating: true },
      _count:  { rating: true },
    });

    res.json({
      reviews: reviews.map((r) => serializeReview(r)),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        averageRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
        totalReviews:  agg._count.rating,
      },
    });
  } catch (err) {
    logger.error('Failed to list room reviews', { error: err.message });
    res.status(500).json({ error: 'Failed to list reviews' });
  }
});

// ── GET /api/reviews/hotel/:hotelCode ─────────────────────────────────────────

router.get('/hotel/:hotelCode', async (req, res) => {
  try {
    const { hotelCode } = req.params;
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip  = (page - 1) * limit;

    // Filter by hotel via room relation
    const where = { room: { hotelCode } };

    const [totalCount, reviews] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const agg = await prisma.review.aggregate({
      where,
      _avg:   { rating: true },
      _count: { rating: true },
    });

    res.json({
      reviews: reviews.map((r) => serializeReview(r)),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        averageRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
        totalReviews:  agg._count.rating,
      },
    });
  } catch (err) {
    logger.error('Failed to list hotel reviews', { error: err.message, hotelCode: req.params.hotelCode });
    res.status(500).json({ error: 'Failed to list reviews' });
  }
});

// ── GET /api/reviews/booking/:bookingId — get own review ──────────────────────

router.get('/booking/:bookingId', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const isStaff = ['admin', 'manager'].includes(req.user.role?.name);

    const review = await prisma.review.findUnique({
      where:   { bookingId },
      include: REVIEW_INCLUDE,
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Non-staff users can only fetch their own review
    if (!isStaff && review.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ review: serializeReview(review) });
  } catch (err) {
    logger.error('Failed to get booking review', { error: err.message });
    res.status(500).json({ error: 'Failed to get review' });
  }
});

// ── POST /api/reviews — create ────────────────────────────────────────────────

router.post('/', authenticate, async (req, res) => {
  try {
    const { bookingId, rating, text } = req.body;

    if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'rating must be an integer 1–5' });
    }

    // Check eligibility (throws with .status if not eligible)
    const booking = await assertReviewEligible(bookingId, req.user.id).catch((err) => {
      res.status(err.status ?? 400).json({ error: err.message });
      return null;
    });
    if (!booking) return;

    // Prevent duplicate
    const existing = await prisma.review.findUnique({ where: { bookingId } });
    if (existing) {
      return res.status(409).json({ error: 'Review already exists for this booking' });
    }

    const review = await prisma.review.create({
      data: {
        bookingId,
        userId: req.user.id,
        roomNo: booking.roomNo,
        rating: ratingNum,
        text:   text?.trim() || null,
      },
      include: REVIEW_INCLUDE,
    });

    logger.info('Review created', { reviewId: review.reviewId, bookingId, userId: req.user.id });
    res.status(201).json({ review: serializeReview(review) });
  } catch (err) {
    logger.error('Failed to create review', { error: err.message });
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// ── PATCH /api/reviews/:reviewId — edit ───────────────────────────────────────

router.patch('/:reviewId', authenticate, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, text } = req.body;

    const existing = await prisma.review.findUnique({ where: { reviewId } });
    if (!existing) return res.status(404).json({ error: 'Review not found' });

    if (existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own reviews' });
    }

    const data = {};

    if (rating !== undefined) {
      const ratingNum = parseInt(rating, 10);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ error: 'rating must be an integer 1–5' });
      }
      data.rating = ratingNum;
    }

    if (text !== undefined) {
      data.text = text?.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const review = await prisma.review.update({
      where:   { reviewId },
      data,
      include: REVIEW_INCLUDE,
    });

    logger.info('Review updated', { reviewId, userId: req.user.id });
    res.json({ review: serializeReview(review) });
  } catch (err) {
    logger.error('Failed to update review', { error: err.message });
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// ── DELETE /api/reviews/:reviewId — delete (own or staff) ────────────────────

router.delete('/:reviewId', authenticate, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const isStaff = ['admin', 'manager'].includes(req.user.role?.name);

    const existing = await prisma.review.findUnique({
      where:   { reviewId },
      include: { images: true },
    });

    if (!existing) return res.status(404).json({ error: 'Review not found' });

    if (!isStaff && existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete image files from disk before removing DB record
    const fs   = require('fs');
    const path = require('path');
    const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
    for (const img of existing.images) {
      const filePath = path.join(UPLOAD_ROOT, 'reviews', existing.bookingId, `${img.imageId}.${img.ext}`);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      }
    }

    await prisma.review.delete({ where: { reviewId } });

    logger.info('Review deleted', { reviewId, deletedBy: req.user.id });
    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    logger.error('Failed to delete review', { error: err.message });
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

module.exports = router;
