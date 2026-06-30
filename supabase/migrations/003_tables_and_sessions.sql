-- ============================================================
-- Migration 003: Cafe Tables, Sessions & Devices
-- Cafe Maestro Platform
-- ============================================================
-- Depends on: 001 (helpers), 002 (cafes)
--
-- Session expiry is enforced via expires_at column checks in
-- RLS policies, views, and a BEFORE INSERT trigger (migration 011).
-- No pg_cron. No scheduled jobs.
-- ============================================================

-- ------------------------------------
-- Physical cafe tables (not DB tables)
-- ------------------------------------

CREATE TABLE cafe_tables (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,

  number          integer       NOT NULL,
  name            text,
  capacity        integer       NOT NULL DEFAULT 4,

  qr_code_url     text,
  qr_code_token   text          UNIQUE,

  position_x      numeric,
  position_y      numeric,

  is_active       boolean       NOT NULL DEFAULT true,

  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  updated_at      timestamptz   NOT NULL DEFAULT NOW(),

  CONSTRAINT cafe_tables_number_unique UNIQUE (cafe_id, number)
);

COMMENT ON TABLE cafe_tables IS
  'Physical tables in a cafe. number is unique per cafe. qr_code_token is embedded in QR codes and used for guest session lookup.';

COMMENT ON COLUMN cafe_tables.qr_code_token IS
  'Random token embedded in the QR URL. Safer than exposing the raw table UUID publicly.';

COMMENT ON COLUMN cafe_tables.number IS
  'Human-visible table number (e.g. Table 1, Table 5). Unique per cafe.';

SELECT create_updated_at_trigger('cafe_tables');

-- ------------------------------------
-- Table sessions
-- ------------------------------------
-- A session is created on the first QR scan when no active session
-- exists for the table. Subsequent scans JOIN the existing session.
-- Expiry is not enforced by a scheduled job — it is checked via
-- expires_at in RLS policies, views, and a BEFORE INSERT trigger.

CREATE TABLE table_sessions (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  table_id        uuid          NOT NULL REFERENCES cafe_tables(id) ON DELETE CASCADE,

  status          text          NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'expired', 'ended')),

  started_at      timestamptz   NOT NULL DEFAULT NOW(),
  expires_at      timestamptz   NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),

  ended_at        timestamptz,
  ended_by        uuid          REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  updated_at      timestamptz   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE table_sessions IS
  'A dine-in session for one table. Created on first QR scan, joined on subsequent scans. Statuses: active | expired | ended. Expiry is checked via expires_at, not via scheduled jobs.';

COMMENT ON COLUMN table_sessions.expires_at IS
  'Set to started_at + 2 hours. Checked in RLS, views, and a BEFORE INSERT trigger in migration 011 to prevent stale sessions from accepting new devices or orders.';

COMMENT ON COLUMN table_sessions.ended_by IS
  'Staff user who manually ended the session. NULL for auto-expired sessions.';

COMMENT ON COLUMN table_sessions.status IS
  'active: session is live and accepting orders. expired: passed expires_at, set by trigger or RLS check. ended: manually closed by staff.';

-- Enforce: only one active session per table at a time.
CREATE UNIQUE INDEX table_sessions_one_active_per_table
  ON table_sessions (table_id)
  WHERE status = 'active';

SELECT create_updated_at_trigger('table_sessions');

-- ------------------------------------
-- Session devices
-- ------------------------------------
-- Each QR scan registers a device in this table. Multiple devices
-- can belong to one session. device_token is the guest's identity
-- credential for placing orders and requesting bills.
-- All tokens are invalidated (is_active = false) when the session ends.

CREATE TABLE session_devices (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid          NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,

  device_token    text          NOT NULL UNIQUE DEFAULT generate_device_token(),

  is_active       boolean       NOT NULL DEFAULT true,
  joined_at       timestamptz   NOT NULL DEFAULT NOW(),
  last_seen_at    timestamptz   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE session_devices IS
  'One row per device that has scanned into a session. device_token is the guest auth credential stored in localStorage. Set is_active = false on session end or expiry to instantly invalidate all guests.';

COMMENT ON COLUMN session_devices.cafe_id IS
  'Denormalized from session for simpler RLS policies without a JOIN.';

COMMENT ON COLUMN session_devices.device_token IS
  'URL-safe base64 token (24 bytes → 32 chars). Generated by generate_device_token() from migration 001. Stored in guest localStorage. Never exposed in URLs.';

COMMENT ON COLUMN session_devices.is_active IS
  'Set to false when the parent session ends or expires. Invalidates the guest credential instantly.';
