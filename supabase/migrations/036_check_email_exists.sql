-- ============================================================
-- Migration 036: check_email_exists RPC
-- Cafe Maestro Platform
-- ============================================================
-- Adds a server-side function used by the "Add staff member"
-- form for real-time email duplicate detection.
--
-- Checks staff_users.email (case-insensitive).
-- After a staff member is fully deleted (auth user removed,
-- staff_users row cascaded away), this correctly returns
-- exists=false, allowing the email to be reused immediately.
--
-- Returns: { "exists": boolean }
-- ============================================================

CREATE OR REPLACE FUNCTION check_email_exists(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM   staff_users
    WHERE  lower(email) = lower(trim(p_email))
      AND  deleted_at IS NULL
  ) INTO v_exists;

  RETURN jsonb_build_object('exists', v_exists);
END;
$$;

COMMENT ON FUNCTION check_email_exists(text) IS
  'Returns {exists: true/false} indicating whether the given email
   is already registered in staff_users. Used by the Add Staff form
   for real-time duplicate detection. SECURITY DEFINER so authenticated
   callers can perform the check without needing direct table access.';

GRANT EXECUTE ON FUNCTION check_email_exists(text) TO authenticated;
