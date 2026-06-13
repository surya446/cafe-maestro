-- ============================================================
-- Migration 001: Extensions & Helper Functions
-- Cafe Maestro Platform
-- ============================================================
-- Free Tier compatible: pg_cron removed.
-- Session expiry is enforced via expires_at checks in RLS,
-- views, and a BEFORE INSERT trigger (migration 011).
-- ============================================================

-- ------------------------------------
-- Extensions
-- ------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- gen_random_uuid() fallback
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_bytes for device tokens

-- uuid-ossp and pgcrypto are enabled by default on all Supabase tiers.
-- pg_cron is NOT used — no scheduled jobs, no paid-tier dependency.

-- ------------------------------------
-- Helper: auto-update updated_at
-- ------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ------------------------------------
-- Helper: apply updated_at trigger
-- (call after each table creation)
-- ------------------------------------

CREATE OR REPLACE FUNCTION create_updated_at_trigger(target_table text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER set_updated_at
     BEFORE UPDATE ON %I
     FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
    target_table
  );
END;
$$;

-- ------------------------------------
-- Helper: generate a URL-safe device token
-- ------------------------------------

CREATE OR REPLACE FUNCTION generate_device_token()
RETURNS text
LANGUAGE sql
AS $$
  SELECT encode(gen_random_bytes(24), 'base64');
$$;
