-- ============================================================
-- Migration 003: Tables, Sessions & Devices
-- Cafe Maestro Platform
-- ============================================================

-- ------------------------------------
-- Physical cafe tables (not DB tables)
-- ------------------------------------

CREATE TABLE cafe_tables (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,

  number          integer       NOT NULL,          -- Table 1, Table 5, etc.
  name            text,                            -- Optional: "Window Seat", "Garden 3"
  capacity        integer       NOT NULL DEFAULT 4,
  qr_code_url     text,                           -- Supabase Storage URL for QR image
  qr_code_token   text          UNIQUE,            -- Embedded in QR, maps to this table
  is_active       boolean       NOT NULL DEFAULT true,

  -- Position on floor plan (for staff map UI, optional)
  position_x      numeric,
  position_y      numeric,

  -- Audit
  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  updated_at      timestamptz   NOT NULL DEFAULT NOW(),

  CONSTRAINT cafe_tables_number_unique UNIQUE (cafe_id, number)
);

COMMENT ON TABLE cafe_tables IS
  'Physical tables in a cafe. number is unique per cafe. qr_code_token is embedded in QR codes.';

COMMENT ON COLUMN cafe_tables.qr_code_token IS
  'Random token embedded in QR URL. Safer than exposing the raw table UUID publicly.';

SELECT create_updated_at_trigger('cafe_tables');

-- ------------------------------------
-- Table sessions
-- ------------------------------------
-- A session is created the first time a QR code is scanned
-- while no active session exists. All subsequent scans JOIN
-- the existing active session. Sessions have no "open/close"
-- workflow — only active, expired, or ended.

CREATE TABLE table_sessions (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  table_id        uuid          NOT NULL REFERENCES cafe_tables(id) ON DELETE CASCADE,

  status          text          NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'expired', 'ended')),

  started_at      timestamptz   NOT NULL DEFAULT NOW(),
  expires_at      timestamptz   NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),

  -- Populated only on ended/expired
  ended_at        timestamptz,
  ended_by        uuid          REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  updated_at      timestamptz   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE table_sessions IS
  'A dine-in session for one table. Created on first QR scan, joined on subsequent scans. Status: active | expired | ended. No device_count stored here — derive from session_devices.';

COMMENT ON COLUMN table_sessions.expires_at IS
  'Auto-set to started_at + 2 hours. A pg_cron job marks sessions expired when this passes.';

COMMENT ON COLUMN table_sessions.ended_by IS
  'References the staff user who manually ended the session. NULL for auto-expired sessions.';

-- Only one active session per table at a time (database-enforced)
CREATE UNIQUE INDEX table_sessions_one_active_per_table
  ON table_sessions (table_id)
  WHERE status = 'active';

SELECT create_updated_at_trigger('table_sessions');

-- ------------------------------------
-- Session devices
-- ------------------------------------
-- Each QR scan registers a device. Multiple devices can belong
-- to one session. device_token is the guest's identity credential.
-- All tokens are invalidated (is_active=false) when session ends.

CREATE TABLE session_devices (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid          NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,

  -- Opaque token stored in guest's localStorage.
  -- Used to authenticate order placement and bill requests.
  device_token    text          NOT NULL UNIQUE DEFAULT generate_device_token(),

  is_active       boolean       NOT NULL DEFAULT true,  -- false when session ends
  joined_at       timestamptz   NOT NULL DEFAULT NOW(),
  last_seen_at    timestamptz   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE session_devices IS
  'One row per device that has joined a session. device_token is the guest auth credential. Set is_active=false on session end/expiry to invalidate all guests instantly.';

COMMENT ON COLUMN session_devices.cafe_id IS
  'Denormalized from session for simpler RLS policies without a JOIN.';

COMMENT ON COLUMN session_devices.device_token IS
  'URL-safe base64 token (24 bytes → 32 chars). Stored in guest localStorage. Never exposed in URLs.';
