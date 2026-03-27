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

const logger = createLogger('Uploads');
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
      res.json({ service: { ...updated, basePrice: Number(updated.basePrice) } });
    } catch (err) {
      logger.error('Failed to upload service icon', { error: err.message });
      res.status(500).json({ error: 'Failed to upload icon' });
    }
  }
);

module.exports = router;
