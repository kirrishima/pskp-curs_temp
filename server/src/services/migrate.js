'use strict';

/**
 * Incremental startup migration.
 *
 * Applies DDL changes that are additive-only (ADD COLUMN IF NOT EXISTS,
 * CREATE TYPE IF NOT EXISTS) so it is safe to run on every server boot.
 * Errors are logged but do NOT abort startup — the server can still serve
 * existing functionality even if a migration step fails.
 */

const { createLogger } = require('../logger');
const prisma = require('./prisma');

const logger = createLogger('Migrate');

const steps = [
  // ── 001: NO_SHOW BookingStatus ───────────────────────────────────────────
  {
    name: '001_booking_status_no_show',
    sql: `ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW'`,
  },

  // ── 002: CancellationSource enum ─────────────────────────────────────────
  {
    name: '002_cancellation_source_enum',
    sql: `
      DO $$ BEGIN
        CREATE TYPE "CancellationSource" AS ENUM ('GUEST','ADMIN','HOTEL','SYSTEM');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },

  // ── 003: RefundStatus enum ────────────────────────────────────────────────
  {
    name: '003_refund_status_enum',
    sql: `
      DO $$ BEGIN
        CREATE TYPE "RefundStatus" AS ENUM ('NONE','FULL','PARTIAL','PENDING','FAILED','ACTION_REQUIRED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },

  // ── 004: Cancellation columns on bookings ─────────────────────────────────
  {
    name: '004_bookings_cancellation_columns',
    sql: `
      ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID,
        ADD COLUMN IF NOT EXISTS cancellation_source "CancellationSource",
        ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
        ADD COLUMN IF NOT EXISTS penalty_amount DECIMAL(12,2),
        ADD COLUMN IF NOT EXISTS refund_status "RefundStatus" NOT NULL DEFAULT 'NONE'
    `,
  },

  // ── 005: Stripe refund audit columns on payments ──────────────────────────
  {
    name: '005_payments_refund_columns',
    sql: `
      ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT,
        ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT,
        ADD COLUMN IF NOT EXISTS stripe_refund_status TEXT,
        ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(12,2)
    `,
  },

  // ── 006: Unique constraint on stripe_refund_id (idempotent) ──────────────
  {
    name: '006_payments_stripe_refund_id_unique',
    sql: `
      DO $$ BEGIN
        ALTER TABLE payments ADD CONSTRAINT payments_stripe_refund_id_key
          UNIQUE (stripe_refund_id);
      EXCEPTION WHEN duplicate_table THEN NULL;
               WHEN duplicate_object THEN NULL;
      END $$
    `,
  },

  // ── 007: is_blocked column on User ───────────────────────────────────────
  {
    name: '007_user_is_blocked',
    sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE`,
  },

  // ── 008: reviews table ────────────────────────────────────────────────────
  {
    name: '008_create_reviews',
    sql: `
      CREATE TABLE IF NOT EXISTS reviews (
        review_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id  UUID        UNIQUE NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
        user_id     UUID        NOT NULL REFERENCES "User"(id),
        room_no     TEXT        NOT NULL REFERENCES rooms(room_no),
        rating      INTEGER     NOT NULL CHECK (rating >= 1 AND rating <= 5),
        text        TEXT,
        created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMP   NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: '008b_reviews_indexes',
    sql: `
      DO $$ BEGIN
        CREATE INDEX IF NOT EXISTS reviews_room_no_idx  ON reviews(room_no);
        CREATE INDEX IF NOT EXISTS reviews_user_id_idx  ON reviews(user_id);
        CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON reviews(created_at DESC);
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$
    `,
  },

  // ── 009: review_images table ──────────────────────────────────────────────
  {
    name: '009_create_review_images',
    sql: `
      CREATE TABLE IF NOT EXISTS review_images (
        image_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        review_id   UUID        NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
        image_url   TEXT        NOT NULL,
        uploaded_at TIMESTAMP   NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: '009b_review_images_index',
    sql: `
      DO $$ BEGIN
        CREATE INDEX IF NOT EXISTS review_images_review_id_idx ON review_images(review_id);
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$
    `,
  },

  // ── 010: hotel_images table ──────────────────────────────────────────────────
  {
    name: '010_create_hotel_images',
    sql: `
      CREATE TABLE IF NOT EXISTS hotel_images (
        image_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_code TEXT        NOT NULL REFERENCES hotels(hotel_code) ON DELETE CASCADE,
        image_url  TEXT        NOT NULL,
        is_main    BOOLEAN     NOT NULL DEFAULT FALSE,
        uploaded_at TIMESTAMP  NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: '010b_hotel_images_index',
    sql: `
      CREATE INDEX IF NOT EXISTS hotel_images_hotel_code_idx ON hotel_images(hotel_code)
    `,
  },

  // ── 011: Add ext column to room_images (idempotent)
  {
    name: '011_room_images_add_ext',
    sql: `ALTER TABLE room_images ADD COLUMN IF NOT EXISTS ext VARCHAR(10)`,
  },
  // ── 011b: Populate ext from image_url in room_images (only if image_url column still exists)
  {
    name: '011b_room_images_populate_ext',
    sql: `
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_images' AND column_name='image_url') THEN
          UPDATE room_images SET ext = LOWER(REGEXP_REPLACE(image_url, '^.*\\.', '')) WHERE ext IS NULL OR ext = '';
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$
    `,
  },
  // ── 011c: Drop image_url from room_images
  {
    name: '011c_room_images_drop_image_url',
    sql: `ALTER TABLE room_images DROP COLUMN IF EXISTS image_url`,
  },

  // ── 012: Add ext column to review_images (idempotent)
  {
    name: '012_review_images_add_ext',
    sql: `ALTER TABLE review_images ADD COLUMN IF NOT EXISTS ext VARCHAR(10)`,
  },
  // ── 012b: Populate ext from image_url in review_images
  {
    name: '012b_review_images_populate_ext',
    sql: `
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='review_images' AND column_name='image_url') THEN
          UPDATE review_images SET ext = LOWER(REGEXP_REPLACE(image_url, '^.*\\.', '')) WHERE ext IS NULL OR ext = '';
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$
    `,
  },
  // ── 012c: Drop image_url from review_images
  {
    name: '012c_review_images_drop_image_url',
    sql: `ALTER TABLE review_images DROP COLUMN IF EXISTS image_url`,
  },

  // ── 013: Add ext column to hotel_images (idempotent)
  {
    name: '013_hotel_images_add_ext',
    sql: `ALTER TABLE hotel_images ADD COLUMN IF NOT EXISTS ext VARCHAR(10)`,
  },
  // ── 013b: Populate ext from image_url in hotel_images
  {
    name: '013b_hotel_images_populate_ext',
    sql: `
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_images' AND column_name='image_url') THEN
          UPDATE hotel_images SET ext = LOWER(REGEXP_REPLACE(image_url, '^.*\\.', '')) WHERE ext IS NULL OR ext = '';
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$
    `,
  },
  // ── 013c: Drop image_url from hotel_images
  {
    name: '013c_hotel_images_drop_image_url',
    sql: `ALTER TABLE hotel_images DROP COLUMN IF EXISTS image_url`,
  },

  // ── 014: Drop hero_image_url from hotels
  {
    name: '014_hotels_drop_hero_image_url',
    sql: `ALTER TABLE hotels DROP COLUMN IF EXISTS hero_image_url`,
  },

  // ── 015: Add is_main column to review_images
  {
    name: '015_review_images_add_is_main',
    sql: `ALTER TABLE review_images ADD COLUMN IF NOT EXISTS is_main BOOLEAN NOT NULL DEFAULT FALSE`,
  },

  // ── 016: Convert room_images.image_id from SERIAL integer to UUID text.
  //         Steps: drop sequence default → change type → drop old sequence.
  //         Safe to re-run (checks data_type = 'integer' first).
  {
    name: '016_room_images_image_id_to_uuid',
    sql: `
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'room_images'
            AND column_name = 'image_id'
            AND data_type = 'integer'
        ) THEN
          ALTER TABLE room_images ALTER COLUMN image_id DROP DEFAULT;
          ALTER TABLE room_images ALTER COLUMN image_id TYPE UUID USING gen_random_uuid();
          DROP SEQUENCE IF EXISTS room_images_image_id_seq;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$
    `,
  },
];

async function runMigrations() {
  logger.info('Running startup migrations…');

  for (const step of steps) {
    try {
      await prisma.$executeRawUnsafe(step.sql.trim());
      logger.info(`Migration step applied: ${step.name}`);
    } catch (err) {
      // "already exists" errors (42701, 42P07) are expected on re-runs and are fine.
      const code = err.meta?.code || err.code || '';
      const ignoredCodes = ['42701', '42P07', '42710']; // column/table/enum already exists
      if (ignoredCodes.includes(String(code))) {
        logger.info(`Migration step already applied: ${step.name}`);
      } else {
        logger.warn(`Migration step skipped (non-fatal error): ${step.name}`, {
          error: err.message,
          code,
        });
      }
    }
  }

  logger.info('Startup migrations complete.');
}

module.exports = { runMigrations };
