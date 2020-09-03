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
