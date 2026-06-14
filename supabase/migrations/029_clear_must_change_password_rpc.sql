-- ============================================================
-- Migration 029: clear_must_change_password RPC
-- Cafe Maestro Platform
-- ============================================================
-- A SECURITY DEFINER function that lets the currently
-- authenticated staff member clear their own
-- must_change_password flag after setting a new password.
-- Only clears the calling user's own row — no privilege
-- escalation is possible.
-- ============================================================

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
  'Clears must_change_password on the calling user''s own staff_users row.
   Called after a forced first-login password change completes.
   SECURITY DEFINER — bypasses RLS but only ever touches auth.uid()''s row.';

GRANT EXECUTE ON FUNCTION clear_must_change_password() TO authenticated;
