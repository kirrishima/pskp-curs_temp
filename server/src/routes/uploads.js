'use strict';

/**
 * Image upload routes for rooms and services.
 *
 * POST   /api/uploads/rooms/:roomNo          — upload room image(s)
 * DELETE /api/uploads/rooms/:roomNo/:imageId  — delete room image
 * POST   /api/uploads/services/:serviceCode   — upload service icon image
 *
 * Files are stored on disk under /uploads/rooms/<roomNo>/ and
 * /uploads/services/<serviceCode>/ respectively.
 * The URL is returned as /uploads/rooms/<roomNo>/<filename>.
 */

const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { createLogger } = require('../logger');
const prisma = require('../services/prisma');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { serializeService } = require('../utils/serializers');

const logger = createLogger('Uploads');
const { v4: uuidv4 } = require('uuid');
const router = Router();

// ── Base upload directory ────────────────────────────────────────────────────

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

// Ensure root exists
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

// ── Multer configuration ─────────────────────────────────────────────────────

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function createUploadMiddleware(getDestination) {
  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = getDestination(req);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, uniqueName);
    },
  });

  return multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_TYPES.has(file.mimetype)) {
        return cb(new Error('Only JPEG, PNG, WebP and GIF images are allowed'));
      }
      cb(null, true);
    },
  });
}

const roomUpload = createUploadMiddleware(
  (req) => path.join(UPLOAD_ROOT, 'rooms', req.params.roomNo)
);

// Review images: stored in uploads/reviews/{bookingId}/ and named by UUID
// (UUID is pre-generated as req.reviewImageId before multer runs).
const reviewUpload = createUploadMiddleware(
  (req) => path.join(UPLOAD_ROOT, 'reviews', req.params.bookingId)
);

// Service icons are stored as flat files named after the serviceCode (primary key)
// so that uploading a new icon always replaces the old one without creating orphan files.
// e.g. /uploads/services/WIFI.jpg  or  /uploads/services/SPA.png
const serviceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(UPLOAD_ROOT, 'services');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.params.serviceCode}${ext}`);
  },
});

const serviceUpload = multer({
  storage: serviceStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP and GIF images are allowed'));
    }
    cb(null, true);
  },
});

// ── Upload room images ──────────────────────────────────────────────────────

router.post(
  '/rooms/:roomNo',
  authenticate,
  authorize('admin'),
  roomUpload.array('images', 10),
  async (req, res) => {
    try {
      const { roomNo } = req.params;
      const isMain = req.body.isMain === 'true' || req.body.isMain === true;

      const room = await prisma.room.findUnique({ where: { roomNo } });
      if (!room) {
        // Clean up uploaded files
        if (req.files) {
          for (const f of req.files) fs.unlinkSync(f.path);
        }
        return res.status(404).json({ error: 'Room not found' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const createdImages = [];

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const imageUrl = `/uploads/rooms/${roomNo}/${file.filename}`;

        const image = await prisma.roomImage.create({
          data: {
            roomNo,
            imageUrl,
            isMain: isMain && i === 0, // Only first image can be main
          },
        });

        createdImages.push(image);
      }

      // If isMain, unset other images' isMain flag
      if (isMain && createdImages.length > 0) {
        await prisma.roomImage.updateMany({
          where: {
            roomNo,
            imageId: { notIn: [createdImages[0].imageId] },
            isMain: true,
          },
          data: { isMain: false },
        });
      }

      logger.info('Room images uploaded', { roomNo, count: createdImages.length });
      res.status(201).json({ images: createdImages });
    } catch (err) {
      logger.error('Failed to upload room images', { error: err.message });
      res.status(500).json({ error: 'Failed to upload images' });
    }
  }
);

// ── Delete room image ───────────────────────────────────────────────────────

router.delete(
  '/rooms/:roomNo/:imageId',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const { roomNo, imageId } = req.params;
      const id = parseInt(imageId, 10);

      const image = await prisma.roomImage.findFirst({
        where: { imageId: id, roomNo },
      });

      if (!image) {
        return res.status(404).json({ error: 'Image not found' });
      }

      // Delete file from disk
      const filePath = path.join(process.cwd(), image.imageUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete from DB
      await prisma.roomImage.delete({ where: { imageId: id } });

      logger.info('Room image deleted', { roomNo, imageId: id });
      res.json({ message: 'Image deleted' });
    } catch (err) {
      logger.error('Failed to delete room image', { error: err.message });
      res.status(500).json({ error: 'Failed to delete image' });
    }
  }
);

// ── Upload service icon ─────────────────────────────────────────────────────

router.post(
  '/services/:serviceCode',
  authenticate,
  authorize('admin'),
  serviceUpload.single('icon'),
  async (req, res) => {
    try {
      const { serviceCode } = req.params;

      const service = await prisma.service.findUnique({ where: { serviceCode } });
      if (!service) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Service not found' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const iconUrl = `/uploads/services/${req.file.filename}`;

      // Delete old icon file if exists
      if (service.iconUrl) {
        const oldPath = path.join(process.cwd(), service.iconUrl);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      // Update the service record
      const updated = await prisma.service.update({
        where: { serviceCode },
        data: { iconUrl },
      });

      logger.info('Service icon uploaded', { serviceCode, iconUrl });
      res.json({ service: serializeService(updated) });
    } catch (err) {
      logger.error('Failed to upload service icon', { error: err.message });
      res.status(500).json({ error: 'Failed to upload icon' });
    }
  }
);

// ── Upload review images ────────────────────────────────────────────────────
// The file is saved with a random temp name by multer, then renamed to
// {uuid}.ext so the DB record ID matches the filename.

router.post(
  '/reviews/:bookingId',
  authenticate,
  reviewUpload.array('images', 5),
  async (req, res) => {
    try {
      const { bookingId } = req.params;

      // Verify the booking belongs to the requesting user
      const booking = await prisma.booking.findUnique({
        where:   { bookingId },
        include: { payment: true },
      });

      if (!booking) {
        if (req.files) for (const f of req.files) fs.unlinkSync(f.path);
        return res.status(404).json({ error: 'Booking not found' });
      }

      if (booking.userId !== req.user.id) {
        if (req.files) for (const f of req.files) fs.unlinkSync(f.path);
        return res.status(403).json({ error: 'Access denied' });
      }

      // Verify the review exists for this booking
      const review = await prisma.review.findUnique({ where: { bookingId } });
      if (!review) {
        if (req.files) for (const f of req.files) fs.unlinkSync(f.path);
        return res.status(404).json({ error: 'Review not found — create the review before uploading images' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const createdImages = [];
      const dir = path.join(UPLOAD_ROOT, 'reviews', bookingId);

      for (const file of req.files) {
        const imageId = uuidv4();
        const ext     = path.extname(file.originalname).toLowerCase() || path.extname(file.filename) || '.jpg';
        const newName = `${imageId}${ext}`;
        const newPath = path.join(dir, newName);

        // Rename from multer's temp name to the UUID-based name
        fs.renameSync(file.path, newPath);

        const imageUrl = `/uploads/reviews/${bookingId}/${newName}`;

        const image = await prisma.reviewImage.create({
          data: { imageId, reviewId: review.reviewId, imageUrl },
        });

        createdImages.push(image);
      }

      logger.info('Review images uploaded', { reviewId: review.reviewId, count: createdImages.length });
      res.status(201).json({ images: createdImages });
    } catch (err) {
      logger.error('Failed to upload review images', { error: err.message });
      res.status(500).json({ error: 'Failed to upload images' });
    }
  }
);

// ── Delete review image ─────────────────────────────────────────────────────

router.delete('/reviews/:bookingId/:imageId', authenticate, async (req, res) => {
  try {
    const { bookingId, imageId } = req.params;
    const isStaff = ['admin', 'manager'].includes(req.user.role?.name);

    // Find the review for this booking
    const review = await prisma.review.findUnique({ where: { bookingId } });
    if (!review) return res.status(404).json({ error: 'Review not found' });

    // Permission check: own review or staff
    if (!isStaff && review.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const image = await prisma.reviewImage.findFirst({
      where: { imageId, reviewId: review.reviewId },
    });

    if (!image) return res.status(404).json({ error: 'Image not found' });

    // Delete file from disk
    const filePath = path.join(process.cwd(), image.imageUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.reviewImage.delete({ where: { imageId } });

    logger.info('Review image deleted', { reviewId: review.reviewId, imageId });
    res.json({ message: 'Image deleted' });
  } catch (err) {
    logger.error('Failed to delete review image', { error: err.message });
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// ── Hotel image upload ────────────────────────────────────────────────────────

const hotelUploadDir = (hotelCode) => path.join(process.cwd(), 'uploads', 'hotels', hotelCode);

const hotelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = hotelUploadDir(req.params.hotelCode);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Temp name; renamed to uuid after save
    cb(null, `tmp_${Date.now()}_${file.originalname}`);
  },
});

const hotelUpload = multer({
  storage: hotelStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP and GIF images are allowed'));
    }
    cb(null, true);
  },
});

// POST /api/uploads/hotels/:hotelCode — upload hotel images (admin only)
router.post(
  '/hotels/:hotelCode',
  authenticate,
  authorize('admin'),
  (req, res, next) => hotelUpload.array('images', 10)(req, res, next),
  async (req, res) => {
    try {
      const { hotelCode } = req.params;

      const hotel = await prisma.hotel.findUnique({ where: { hotelCode } });
      if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const existingCount = await prisma.hotelImage.count({ where: { hotelCode } });

      const savedImages = [];
      for (const file of req.files) {
        const imageId = uuidv4();
        const ext = path.extname(file.originalname).toLowerCase();
        const newFilename = `${imageId}${ext}`;
        const newPath = path.join(hotelUploadDir(hotelCode), newFilename);
        fs.renameSync(file.path, newPath);

        const imageUrl = `/uploads/hotels/${hotelCode}/${newFilename}`;
        const isMain = existingCount === 0 && savedImages.length === 0;

        const img = await prisma.hotelImage.create({
          data: { imageId, hotelCode, imageUrl, isMain },
        });
        savedImages.push(img);
      }

      logger.info('Hotel images uploaded', { hotelCode, count: savedImages.length });
      res.status(201).json({ images: savedImages });
    } catch (err) {
      logger.error('Hotel image upload failed', { error: err.message });
      res.status(500).json({ error: 'Upload failed' });
    }
  },
);

// DELETE /api/uploads/hotels/:hotelCode/:imageId — delete hotel image (admin only)
router.delete('/hotels/:hotelCode/:imageId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { hotelCode, imageId } = req.params;

    const image = await prisma.hotelImage.findUnique({ where: { imageId } });
    if (!image) return res.status(404).json({ error: 'Image not found' });
    if (image.hotelCode !== hotelCode) return res.status(403).json({ error: 'Access denied' });

    // Delete file from disk
    const filePath = path.join(process.cwd(), image.imageUrl);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }

    await prisma.hotelImage.delete({ where: { imageId } });

    // If deleted image was main, promote the next image
    if (image.isMain) {
      const next = await prisma.hotelImage.findFirst({ where: { hotelCode }, orderBy: { uploadedAt: 'asc' } });
      if (next) await prisma.hotelImage.update({ where: { imageId: next.imageId }, data: { isMain: true } });
    }

    logger.info('Hotel image deleted', { hotelCode, imageId });
    res.json({ message: 'Image deleted' });
  } catch (err) {
    logger.error('Hotel image delete failed', { error: err.message });
    res.status(500).json({ error: 'Delete failed' });
  }
});

// PATCH /api/uploads/hotels/:hotelCode/:imageId/main — set as main image (admin only)
router.patch('/hotels/:hotelCode/:imageId/main', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { hotelCode, imageId } = req.params;

    const image = await prisma.hotelImage.findUnique({ where: { imageId } });
    if (!image || image.hotelCode !== hotelCode) return res.status(404).json({ error: 'Image not found' });

    // Unset all, then set this one
    await prisma.hotelImage.updateMany({ where: { hotelCode }, data: { isMain: false } });
    await prisma.hotelImage.update({ where: { imageId }, data: { isMain: true } });

    logger.info('Hotel main image set', { hotelCode, imageId });
    res.json({ message: 'Main image updated' });
  } catch (err) {
    logger.error('Hotel set main image failed', { error: err.message });
    res.status(500).json({ error: 'Failed to set main image' });
  }
});

module.exports = router;
