-- ============================================================
-- Migration 024: Table Closed Flag
-- Cafe Maestro Platform
-- ============================================================
-- Problem: When staff calls end_session(), the table_sessions row
-- moves to status='ended'. On the next QR scan, join_or_create_session()
-- finds no active session and unconditionally creates a new one,
-- allowing guests to continue ordering after a staff-ended session.
--
-- Fix: Add is_closed boolean to cafe_tables.
--   • end_session()           → sets is_closed = true
--   • join_or_create_session() → raises TABLE_CLOSED if is_closed = true
--   • reopen_table()          → sets is_closed = false (staff-only)
--
-- Expired sessions (time-based) are unaffected: is_closed is only
-- set by explicit staff action, not by the expiry trigger.
-- ============================================================


-- ============================================================
-- 1. Add is_closed column
-- ============================================================

ALTER TABLE cafe_tables
  ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN cafe_tables.is_closed IS
  'True when staff has manually ended the session via end_session().
   Prevents join_or_create_session() from auto-creating a new session.
   Reset to false only via reopen_table() — an explicit staff action.
   Has no effect on time-based session expiry.';


-- ============================================================
-- 2. end_session() — now also sets cafe_tables.is_closed = true
-- ============================================================

CREATE OR REPLACE FUNCTION end_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cafe_id  uuid;
  v_table_id uuid;
BEGIN
  SELECT cafe_id, table_id INTO v_cafe_id, v_table_id
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

  -- Lock the table so QR scans cannot auto-create a new session.
  UPDATE cafe_tables
  SET    is_closed   = true,
         updated_at  = NOW()
  WHERE  id = v_table_id;
END;
$$;

COMMENT ON FUNCTION end_session(uuid) IS
  'Staff-callable RPC to immediately close a table session.
   Sets table_sessions.status = ended, deactivates all session_devices,
   and sets cafe_tables.is_closed = true to block automatic session
   recreation on the next QR scan. Use reopen_table() to unlock.';

GRANT EXECUTE ON FUNCTION end_session(uuid) TO authenticated;


-- ============================================================
-- 3. join_or_create_session() — check is_closed before creating
-- ============================================================

CREATE OR REPLACE FUNCTION join_or_create_session(p_qr_token text)
RETURNS TABLE (
  session_id      uuid,
  device_token    text,
  cafe_id         uuid,
  cafe_name       text,
  table_id        uuid,
  table_number    integer,
  table_name      text,
  expires_at      timestamptz,
  is_new_session  boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table         cafe_tables%ROWTYPE;
  v_session_id    uuid;
  v_device_token  text;
  v_is_new        boolean := false;
BEGIN
  -- 1. Resolve token → table (active tables only; is_closed checked below)
  SELECT * INTO v_table
  FROM   cafe_tables
  WHERE  qr_code_token = p_qr_token
    AND  is_active     = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND'
      USING HINT = 'No active table found for this QR token';
  END IF;

  -- 2. Block auto-creation if staff manually closed the table.
  --    Expired sessions (time-based) do NOT set is_closed, so they
  --    still allow new sessions to be created automatically.
  IF v_table.is_closed THEN
    RAISE EXCEPTION 'TABLE_CLOSED'
      USING HINT = 'This table was closed by staff. Please ask staff to reopen the table.';
  END IF;

  -- 3. Find or create the active session.
  --    Loop handles concurrent scans: if two devices scan at the
  --    same millisecond and both miss the SELECT, one INSERT wins
  --    and the other catches unique_violation then retries.
  <<session_loop>>
  LOOP
    SELECT ts2.id INTO v_session_id
    FROM   table_sessions ts2
    WHERE  ts2.table_id   = v_table.id
      AND  ts2.status     = 'active'
      AND  ts2.expires_at > NOW()
    LIMIT 1;

    EXIT session_loop WHEN v_session_id IS NOT NULL;

    BEGIN
      INSERT INTO table_sessions (cafe_id, table_id)
      VALUES (v_table.cafe_id, v_table.id)
      RETURNING id INTO v_session_id;

      v_is_new := true;
      EXIT session_loop;
    EXCEPTION
      WHEN unique_violation THEN NULL;
    END;
  END LOOP;

  -- 4. Register this device
  INSERT INTO session_devices (session_id, cafe_id)
  VALUES (v_session_id, v_table.cafe_id)
  RETURNING session_devices.device_token INTO v_device_token;

  -- 5. Return enriched row
  RETURN QUERY
  SELECT
    ts.id,
    v_device_token,
    ts.cafe_id,
    c.name::text,
    ts.table_id,
    v_table.number,
    v_table.name,
    ts.expires_at,
    v_is_new
  FROM table_sessions ts
  JOIN cafes c ON c.id = ts.cafe_id
  WHERE ts.id = v_session_id;
END;
$$;

COMMENT ON FUNCTION join_or_create_session(text) IS
  'QR scan entry point. Resolves qr_code_token → table → active session.
   Returns TABLE_CLOSED if staff has manually ended the session (is_closed=true).
   Returns TABLE_NOT_FOUND if no active table matches the token.
   Creates a new session if none is active and the table is not closed.
   Race-safe via unique index + retry loop.';

GRANT EXECUTE ON FUNCTION join_or_create_session(text) TO anon;


-- ============================================================
-- 4. reopen_table() — staff action to unlock a closed table
-- ============================================================

CREATE OR REPLACE FUNCTION reopen_table(p_table_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cafe_id uuid;
BEGIN
  SELECT cafe_id INTO v_cafe_id
  FROM   cafe_tables
  WHERE  id = p_table_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND'
      USING HINT = 'No table with that ID exists';
  END IF;

  IF v_cafe_id IS DISTINCT FROM auth_user_cafe_id() THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'You may only reopen tables for your own cafe';
  END IF;

  IF NOT auth_user_has_role(ARRAY['owner','manager','staff']) THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'Only owner, manager, or staff can reopen tables';
  END IF;

  UPDATE cafe_tables
  SET    is_closed   = false,
         updated_at  = NOW()
  WHERE  id = p_table_id;
END;
$$;

COMMENT ON FUNCTION reopen_table(uuid) IS
  'Staff-callable RPC to reopen a closed table.
   Sets cafe_tables.is_closed = false, allowing the next QR scan
   to create a new session via join_or_create_session(). Cafe-scoped.';

GRANT EXECUTE ON FUNCTION reopen_table(uuid) TO authenticated;
