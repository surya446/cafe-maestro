-- ============================================================
-- Migration 028: must_change_password
-- Cafe Maestro Platform
-- ============================================================
-- Adds must_change_password flag to staff_users.
-- Set to true when an account is created with a temporary
-- password by an owner/manager. Staff must change their
-- password on first login before accessing the dashboard.
-- ============================================================

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN staff_users.must_change_password IS
  'When true the staff member must change their password on next login.
   Set to true by create-staff-member edge function.
   Cleared to false by clear_must_change_password() RPC after the
   staff member successfully updates their password.';
