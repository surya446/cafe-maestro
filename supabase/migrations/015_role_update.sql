-- ============================================================
-- Migration 015: Four-Role Model
-- Cafe Maestro Platform
-- ============================================================
-- Roles (ascending privilege):
--   chef     → Kitchen display only. Updates order status.
--   staff    → Order approval, session management, bill requests, bookings.
--   manager  → All staff capabilities + menu, tables, QR, reviews, analytics.
--   owner    → Everything + cafe settings, staff account management.
--
-- Customers do NOT log in. Guests authenticate via device_token only.
-- ============================================================

-- ------------------------------------
-- Update role constraint on staff_users
-- ------------------------------------

ALTER TABLE staff_users
  DROP CONSTRAINT IF EXISTS staff_users_role_check;

ALTER TABLE staff_users
  ADD CONSTRAINT staff_users_role_check
  CHECK (role IN ('owner', 'manager', 'staff', 'chef'));

COMMENT ON COLUMN staff_users.role IS
  'owner: full platform control.
   manager: operations + menu + analytics. Cannot manage other owners.
   staff: order approval, session control, bill requests, bookings.
   chef: kitchen display only — sees approved orders, updates status.';

-- ------------------------------------
-- Role capability reference table
-- (read-only reference used in UI to render permission labels)
-- ------------------------------------

CREATE TABLE role_capabilities (
  role          text    PRIMARY KEY,
  label         text    NOT NULL,
  description   text    NOT NULL,
  sort_order    integer NOT NULL
);

INSERT INTO role_capabilities (role, label, description, sort_order) VALUES
  ('owner',   'Owner',   'Full platform access including settings and staff management.',                1),
  ('manager', 'Manager', 'Operations, menu, analytics, and QR management. Cannot modify owner accounts.', 2),
  ('staff',   'Staff',   'Order approval, session control, bill requests, and bookings.',               3),
  ('chef',    'Chef',    'Kitchen display only. Updates order status from approved to ready.',          4);

-- ------------------------------------
-- Helper functions — updated for new roles
-- ------------------------------------
-- These replace the versions from 009_rls_policies.sql.
-- Existing function signatures are unchanged — only role values updated.

CREATE OR REPLACE FUNCTION auth_user_cafe_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT cafe_id FROM staff_users
  WHERE id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM staff_users
  WHERE id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- Convenience: check if caller has AT LEAST a given privilege level
-- Usage: auth_user_has_role(ARRAY['owner','manager'])
CREATE OR REPLACE FUNCTION auth_user_has_role(allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_users
    WHERE id       = auth.uid()
      AND is_active = true
      AND role      = ANY(allowed_roles)
  );
$$;
