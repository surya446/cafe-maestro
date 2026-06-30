-- ============================================================
-- Migration 024: end_session audit columns
-- Cafe Maestro Platform
-- ============================================================
-- Adds ended_at / ended_by to table_sessions for audit trail.
-- Updates end_session() to populate those fields.
--
-- NOTE: The is_closed table-flag approach was abandoned.
-- Session-ended enforcement is handled entirely on the client:
--   - markEnded() writes an ended marker to localStorage.
--   - isFreshNavigation() clears the marker on a real QR scan.
--   - Page reloads see the marker and show the ended screen.
-- This means join_or_create_session() is unchanged; expired
-- sessions still auto-create a new session as before.
-- ============================================================


-- ============================================================
-- 1. Audit columns on table_sessions
-- ============================================================

ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_by uuid REFERENCES auth.users(id);


-- ============================================================
-- 2. end_session() — populate audit columns
-- ============================================================

CREATE OR REPLACE FUNCTION end_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cafe_id uuid;
BEGIN
  SELECT cafe_id INTO v_cafe_id
  FROM   table_sessions
  WHERE  id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING HINT = 'No session with that ID exists';
  END IF;

  IF v_cafe_id IS DISTINCT FROM auth_user_cafe_id() THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'You may only end sessions for your own cafe';
  END IF;

  IF NOT auth_user_has_role(ARRAY['owner','manager','staff']) THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'Only owner, manager, or staff can end sessions';
  END IF;

  UPDATE table_sessions
  SET    status   = 'ended',
         ended_at = NOW(),
         ended_by = auth.uid()
  WHERE  id     = p_session_id
    AND  status = 'active';

  UPDATE session_devices
  SET    is_active = false
  WHERE  session_id = p_session_id;
END;
$$;

COMMENT ON FUNCTION end_session(uuid) IS
  'Staff-callable RPC to immediately close a table session.
   Sets table_sessions.status = ended, records ended_at / ended_by,
   and deactivates all session_devices so guests are redirected to
   the ended screen on their next heartbeat (within 15 s).
   Guests who reload will see the ended screen because the client
   preserves an ended marker in localStorage; a fresh QR scan
   clears that marker and allows join_or_create_session() to run.';

GRANT EXECUTE ON FUNCTION end_session(uuid) TO authenticated;
