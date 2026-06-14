-- ============================================================
-- Migration 023: Staff Operations
-- Cafe Maestro Platform
-- ============================================================
-- 1. Fix generate_device_token — remove pgcrypto dependency.
--    gen_random_bytes() (pgcrypto) fails when called from a SECURITY
--    DEFINER function that sets search_path = public, because pgcrypto
--    lives in the extensions schema. Replaced with two gen_random_uuid()
--    calls — a PostgreSQL 13+ core built-in, no extension required.
--    Result: 64-char hex (256-bit entropy, up from 192-bit base64).
--
-- 2. Re-apply join_or_create_session — fixes ERROR 42702 (ambiguous
--    column reference "table_id"/"expires_at") caused by RETURNS TABLE
--    output params shadowing unqualified column names in the session_loop
--    SELECT. Fixed by aliasing table_sessions as ts2 in that query.
--
-- 3. end_session(p_session_id) — SECURITY DEFINER RPC for staff to
--    immediately close a table session. Updates table_sessions.status
--    AND deactivates all session_devices rows. Requires SECURITY DEFINER
--    because session_devices has no client UPDATE RLS policy.
--
-- 4. Enable realtime on bill_requests + session_devices so the staff
--    dashboard can receive push updates without polling only.
-- ============================================================


-- ============================================================
-- 1. Fix generate_device_token (no pgcrypto dependency)
-- ============================================================

CREATE OR REPLACE FUNCTION generate_device_token()
RETURNS text
LANGUAGE sql
AS $$
  SELECT replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', '');
$$;

COMMENT ON FUNCTION generate_device_token() IS
  'Generates a 64-char hex device token (256-bit entropy) using two
   gen_random_uuid() calls. No pgcrypto extension required — safe under
   SECURITY DEFINER callers that set search_path = public.';


-- ============================================================
-- 2. Re-apply join_or_create_session with ts2 alias fix
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
  -- 1. Resolve token → active table
  SELECT * INTO v_table
  FROM   cafe_tables
  WHERE  qr_code_token = p_qr_token
    AND  is_active     = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND'
      USING HINT = 'No active table found for this QR token';
  END IF;

  -- 2. Find or create the active session.
  --    Loop handles concurrent scans: if two devices scan at the
  --    same millisecond and both miss the SELECT, one INSERT wins
  --    and the other catches unique_violation then retries.
  --    FIX: alias table_sessions as ts2 so that table_id and expires_at
  --    in the WHERE clause are unambiguous (RETURNS TABLE declares
  --    output params with the same names, causing ERROR 42702 otherwise).
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
      -- BEFORE INSERT trigger (011) auto-expires any stale session
      -- for this table, unblocking the partial unique index.
      INSERT INTO table_sessions (cafe_id, table_id)
      VALUES (v_table.cafe_id, v_table.id)
      RETURNING id INTO v_session_id;

      v_is_new := true;
      EXIT session_loop;
    EXCEPTION
      WHEN unique_violation THEN
        -- Concurrent scan won the race; loop back to SELECT it
        NULL;
    END;
  END LOOP;

  -- 3. Register this device (generate_device_token() DEFAULT fires)
  INSERT INTO session_devices (session_id, cafe_id)
  VALUES (v_session_id, v_table.cafe_id)
  RETURNING session_devices.device_token INTO v_device_token;

  -- 4. Return enriched row
  RETURN QUERY
  SELECT
    ts.id,
    v_device_token,
    ts.cafe_id,
    c.name::text      AS cafe_name,
    ts.table_id,
    v_table.number    AS table_number,
    v_table.name      AS table_name,
    ts.expires_at,
    v_is_new
  FROM table_sessions ts
  JOIN cafes           c  ON c.id  = ts.cafe_id
  WHERE ts.id = v_session_id;
END;
$$;

COMMENT ON FUNCTION join_or_create_session(text) IS
  'QR scan entry point. Resolves qr_code_token → table → active session.
   Creates a new session if none is active (trigger handles stale cleanup).
   Registers a fresh device_token for every scan. Race-safe.';

GRANT EXECUTE ON FUNCTION join_or_create_session(text) TO anon;


-- ============================================================
-- 3. end_session RPC
-- ============================================================
-- SECURITY DEFINER is required because session_devices has no client
-- UPDATE RLS policy (staff can SELECT devices but not update them).
-- The function validates cafe ownership before acting, preventing
-- cross-cafe session termination.

CREATE OR REPLACE FUNCTION end_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cafe_id uuid;
BEGIN
  -- Resolve session → cafe
  SELECT cafe_id INTO v_cafe_id
  FROM   table_sessions
  WHERE  id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING HINT = 'No session with that ID exists';
  END IF;

  -- Gate: caller must be staff of that exact cafe
  IF v_cafe_id IS DISTINCT FROM auth_user_cafe_id() THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'You may only end sessions for your own cafe';
  END IF;

  -- Caller must have a floor role (owner, manager, or staff)
  IF NOT auth_user_has_role(ARRAY['owner','manager','staff']) THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'Only owner, manager, or staff can end sessions';
  END IF;

  -- Mark session ended (idempotent on already-ended sessions)
  UPDATE table_sessions
  SET    status = 'ended'
  WHERE  id     = p_session_id
    AND  status = 'active';

  -- Deactivate every device registered to this session.
  -- This triggers is_valid = false on next validate_device heartbeat,
  -- immediately redirecting guests to the expired screen.
  UPDATE session_devices
  SET    is_active = false
  WHERE  session_id = p_session_id;
END;
$$;

COMMENT ON FUNCTION end_session(uuid) IS
  'Staff-callable RPC to immediately close a table session. Sets
   table_sessions.status = ended and deactivates all session_devices,
   which causes every guest device to be redirected to the expired
   screen on their next heartbeat (within 15 seconds). Cafe-scoped.';

GRANT EXECUTE ON FUNCTION end_session(uuid) TO authenticated;


-- ============================================================
-- 4. Realtime publication for bill_requests and session_devices
-- ============================================================
-- Orders and table_sessions are presumed already in the publication
-- (migration 010). Adding bill_requests and session_devices so the
-- staff dashboard receives live push updates for those tables too.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE bill_requests;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE session_devices;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
