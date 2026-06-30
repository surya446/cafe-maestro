-- ============================================================
-- Migration 006: Staff Users
-- Cafe Maestro Platform
-- ============================================================
-- Staff, kitchen staff, and owners all authenticate via
-- Supabase Auth. This table extends auth.users with role
-- and cafe assignment. One row per auth user.

CREATE TABLE staff_users (
  id              uuid          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,

  full_name       text          NOT NULL,
  email           text          NOT NULL,  -- Denormalized from auth.users for queries

  -- Role determines dashboard access and API permissions
  role            text          NOT NULL
                  CHECK (role IN ('staff', 'kitchen', 'owner')),

  -- Pin for quick re-auth on shared kitchen/staff devices (optional)
  -- Stored hashed. NULL = pin login not enabled for this user.
  pin_hash        text,

  is_active       boolean       NOT NULL DEFAULT true,  -- Deactivate without deleting

  -- Audit
  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  updated_at      timestamptz   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE staff_users IS
  'Extends auth.users with cafe assignment and role. Roles: staff (order approval, session management), kitchen (KDS), owner (full admin). One row per Supabase Auth user.';

COMMENT ON COLUMN staff_users.role IS
  'staff: approves orders, manages sessions, handles bill requests. kitchen: sees and updates approved orders. owner: full admin access, cannot change platform design/animations.';

COMMENT ON COLUMN staff_users.pin_hash IS
  'Optional hashed PIN for quick re-authentication on shared devices (e.g. kitchen tablet). Uses pgcrypto crypt(). NULL means PIN login is not enabled.';

COMMENT ON COLUMN staff_users.email IS
  'Denormalized from auth.users.email for use in queries and audit logs without a JOIN.';

SELECT create_updated_at_trigger('staff_users');
