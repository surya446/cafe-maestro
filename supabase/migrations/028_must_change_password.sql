-- ============================================================
-- Migration 028: Must-Change-Password Flag
-- Cafe Maestro Platform
-- ============================================================
-- Supports the direct staff account creation flow (replaces
-- invite-based onboarding).
--
-- When an admin creates a staff account, a temporary password
-- is generated. The account is marked must_change_password=true.
-- On first login the dashboard redirects to a forced password-
-- change page. After the change clear_must_change_password() is
-- called, which resets the flag to false.
-- ============================================================


-- ── Column ──────────────────────────────────────────────────

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN staff_users.must_change_password IS
  'Set to true when an account is created with a temporary password.
   Cleared to false by clear_must_change_password() after the user
   sets a permanent password on first login.';


-- ── RPC: clear_must_change_password() ───────────────────────
-- Called by the change-password page after supabase.auth.updateUser
-- succeeds. SECURITY DEFINER so it can write the flag even when
-- the staff_users__self__update policy restricts the column set.

CREATE OR REPLACE FUNCTION clear_must_change_password()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE staff_users
  SET    must_change_password = false,
         updated_at           = NOW()
  WHERE  id = auth.uid();
END;
$$;

COMMENT ON FUNCTION clear_must_change_password() IS
  'Called once by the forced-password-change page after the user sets a
   permanent password. Resets must_change_password = false for the
   authenticated user. SECURITY DEFINER to bypass column-level update
   restrictions.';

GRANT EXECUTE ON FUNCTION clear_must_change_password() TO authenticated;
