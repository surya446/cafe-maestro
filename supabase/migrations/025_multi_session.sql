-- ============================================================
-- Migration 025: Multi-Session Architecture
-- Cafe Maestro Platform
-- ============================================================
-- Replaces the one-active-session-per-table model with a
-- model where every QR scan creates an independent session.
--
-- Changes in this migration:
--
--   Schema
--   ------
--   1.  table_sessions    ADD customer_name text NOT NULL DEFAULT ''
--   2.  session_devices   ADD user_agent text (audit; nullable)
--   3.  DROP INDEX table_sessions_one_active_per_table
--   4.  DROP INDEX bill_requests_one_pending_per_session
--   5.  ADD  INDEX bill_requests_one_pending_per_table
--
--   RPCs replaced
--   -------------
--   6.  join_or_create_session(qr_token)
--         → create_session(qr_token, customer_name, user_agent)
--           Always INSERTs a new session; customer_name required.
--
--   7.  get_session_orders(device_token)
--         → get_table_orders(device_token)
--           Returns all orders for the physical table, across all
--           sessions started within the past 6 hours. Includes
--           session_id + customer_name for guest-side attribution.
--
--   RPCs updated (same name / same arguments)
--   ------------------------------------------
--   8.  validate_device   → adds customer_name to RETURNS TABLE
--   9.  request_bill      → table-scoped uniqueness (was session-scoped)
--   10. expire_stale_session_for_table (trigger fn) → comment only
--
--   New RPCs
--   --------
--   11. end_table_sessions(table_id) → ends all active sessions on a
--       table in one call; returns count of sessions ended.
--
--   Decommissioned
--   --------------
--   12. REVOKE + DROP join_or_create_session
--   13. REVOKE + DROP get_session_orders
--
-- Migration is safe on existing data:
--   • customer_name defaults to '' for historical rows.
--   • user_agent is nullable; historical rows get NULL.
--   • No rows are deleted or structurally altered.
-- ============================================================


-- ============================================================
-- 1. table_sessions.customer_name
-- ============================================================

ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS customer_name text NOT NULL DEFAULT '';

COMMENT ON COLUMN table_sessions.customer_name IS
  'Name entered by the guest when they scan the QR code.
   Required for all new sessions (enforced by create_session RPC).
   Historical rows default to empty string.';


-- ============================================================
-- 2. session_devices.user_agent
-- ============================================================

ALTER TABLE session_devices
  ADD COLUMN IF NOT EXISTS user_agent text;

COMMENT ON COLUMN session_devices.user_agent IS
  'Browser user-agent captured at scan time. Nullable.
   Stored for audit and analytics only — never used for logic.';


-- ============================================================
-- 3. Drop one-active-session-per-table constraint
-- ============================================================

DROP INDEX IF EXISTS table_sessions_one_active_per_table;


-- ============================================================
-- 4–5. Bill requests: session-scoped → table-scoped
-- ============================================================

DROP INDEX IF EXISTS bill_requests_one_pending_per_session;

CREATE UNIQUE INDEX IF NOT EXISTS bill_requests_one_pending_per_table
  ON bill_requests (table_id)
  WHERE status = 'pending';

COMMENT ON INDEX bill_requests_one_pending_per_table IS
  'Enforces at most one pending bill request per physical table.
   Covers all sessions on the table simultaneously.
   Replaced bill_requests_one_pending_per_session (migration 025).';


-- ============================================================
-- 6. create_session — replaces join_or_create_session
-- ============================================================
-- Every QR scan unconditionally creates a new session.
-- customer_name is required (validated server-side).
-- user_agent is optional, stored in session_devices for audit.
-- The BEFORE INSERT trigger (expire_stale_session_for_table)
-- still fires to lazily expire overdue sessions.

CREATE OR REPLACE FUNCTION create_session(
  p_qr_token      text,
  p_customer_name text,
  p_user_agent    text DEFAULT NULL
)
RETURNS TABLE (
  session_id     uuid,
  device_token   text,
  cafe_id        uuid,
  cafe_name      text,
  table_id       uuid,
  table_number   integer,
  table_name     text,
  expires_at     timestamptz,
  customer_name  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table        cafe_tables%ROWTYPE;
  v_session_id   uuid;
  v_device_token text;
  v_name         text;
BEGIN
  -- Require a non-blank customer name
  v_name := TRIM(COALESCE(p_customer_name, ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'CUSTOMER_NAME_REQUIRED'
      USING HINT = 'A customer name is required to start a session';
  END IF;

  -- Resolve QR token → active physical table
  SELECT * INTO v_table
  FROM   cafe_tables
  WHERE  qr_code_token = p_qr_token
    AND  is_active     = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND'
      USING HINT = 'No active table found for this QR token';
  END IF;

  -- Create a new session for this guest.
  -- The BEFORE INSERT trigger fires here to lazily expire any sessions
  -- on this table whose expires_at has already passed.
  INSERT INTO table_sessions (cafe_id, table_id, customer_name)
  VALUES (v_table.cafe_id, v_table.id, v_name)
  RETURNING id INTO v_session_id;

  -- Register the device; capture user_agent for audit trail
  INSERT INTO session_devices (session_id, cafe_id, user_agent)
  VALUES (
    v_session_id,
    v_table.cafe_id,
    NULLIF(TRIM(COALESCE(p_user_agent, '')), '')
  )
  RETURNING session_devices.device_token INTO v_device_token;

  RETURN QUERY
  SELECT
    ts.id,
    v_device_token,
    ts.cafe_id,
    c.name::text        AS cafe_name,
    ts.table_id,
    v_table.number      AS table_number,
    v_table.name        AS table_name,
    ts.expires_at,
    ts.customer_name
  FROM  table_sessions ts
  JOIN  cafes          c  ON c.id = ts.cafe_id
  WHERE ts.id = v_session_id;
END;
$$;

COMMENT ON FUNCTION create_session(text, text, text) IS
  'QR scan entry point for the multi-session architecture.
   Creates a new independent session for every scan.
   Requires a non-empty customer_name.
   Stores user_agent in session_devices for audit.
   Replaces join_or_create_session() which is decommissioned below.';

GRANT EXECUTE ON FUNCTION create_session(text, text, text) TO anon;


-- ============================================================
-- 7. get_table_orders — replaces get_session_orders
-- ============================================================
-- Returns all orders placed on the same physical table as the
-- calling device, across all sessions started within the past
-- 6 hours. Orders from all sessions are included so guests can
-- see the full table view. session_id + customer_name allow the
-- frontend to attribute orders to individual guests.

CREATE OR REPLACE FUNCTION get_table_orders(p_device_token text)
RETURNS TABLE (
  order_id       uuid,
  session_id     uuid,
  customer_name  text,
  status         text,
  staff_note     text,
  created_at     timestamptz,
  items          jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_id uuid;
BEGIN
  -- Resolve device token → physical table
  -- (no status filter — works even if the session has ended)
  SELECT ts.table_id INTO v_table_id
  FROM   session_devices sd
  JOIN   table_sessions  ts ON ts.id = sd.session_id
  WHERE  sd.device_token = p_device_token
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN;  -- unknown token; return empty result set
  END IF;

  RETURN QUERY
  SELECT
    o.id                 AS order_id,
    o.session_id,
    ts2.customer_name,
    o.status,
    o.staff_note,
    o.created_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id',         oi.id,
          'name',       mi.name,
          'quantity',   oi.quantity,
          'unit_price', oi.unit_price,
          'notes',      oi.notes
        )
        ORDER BY oi.created_at
      ) FILTER (WHERE oi.id IS NOT NULL),
      '[]'::jsonb
    )                    AS items
  FROM   orders          o
  JOIN   table_sessions  ts2 ON ts2.id         = o.session_id
  LEFT  JOIN order_items  oi  ON oi.order_id   = o.id
  LEFT  JOIN menu_items   mi  ON mi.id         = oi.menu_item_id
  WHERE  o.table_id      = v_table_id
    AND  ts2.started_at  > NOW() - INTERVAL '6 hours'
  GROUP  BY o.id, o.session_id, ts2.customer_name,
            o.status, o.staff_note, o.created_at
  ORDER  BY o.created_at ASC;
END;
$$;

COMMENT ON FUNCTION get_table_orders(text) IS
  'Returns all orders placed on the physical table of the calling device,
   across all sessions started in the past 6 hours.
   Includes session_id and customer_name for per-guest attribution.
   Replaces get_session_orders() which is decommissioned below.';

GRANT EXECUTE ON FUNCTION get_table_orders(text) TO anon;


-- ============================================================
-- 8. validate_device — add customer_name to return set
-- ============================================================
-- Return type changes (new column added), so we must DROP first.

DROP FUNCTION IF EXISTS validate_device(text);

CREATE FUNCTION validate_device(p_device_token text)
RETURNS TABLE (
  is_valid        boolean,
  session_id      uuid,
  session_status  text,
  expires_at      timestamptz,
  cafe_id         uuid,
  cafe_name       text,
  table_id        uuid,
  table_number    integer,
  table_name      text,
  customer_name   text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Lazily expire any overdue sessions before reporting validity
  PERFORM expire_sessions();

  -- Heartbeat: record that this device is still active
  UPDATE session_devices
  SET    last_seen_at = NOW()
  WHERE  device_token = p_device_token;

  RETURN QUERY
  SELECT
    (sd.is_active AND ts.status = 'active' AND ts.expires_at > NOW()) AS is_valid,
    ts.id              AS session_id,
    ts.status          AS session_status,
    ts.expires_at,
    ts.cafe_id,
    c.name::text       AS cafe_name,
    ts.table_id,
    ct.number          AS table_number,
    ct.name            AS table_name,
    ts.customer_name
  FROM   session_devices sd
  JOIN   table_sessions  ts ON ts.id  = sd.session_id
  JOIN   cafe_tables     ct ON ct.id  = ts.table_id
  JOIN   cafes            c ON c.id   = ts.cafe_id
  WHERE  sd.device_token = p_device_token
  LIMIT  1;
END;
$$;

COMMENT ON FUNCTION validate_device(text) IS
  'Checks whether a stored device_token is still valid.
   Lazily expires sessions and updates the device heartbeat.
   Returns customer_name so the guest page can display it after reload.
   Returns is_valid=false when the session has ended or expired.';

GRANT EXECUTE ON FUNCTION validate_device(text) TO anon;


-- ============================================================
-- 9. request_bill — change uniqueness scope to table
-- ============================================================
-- Signature is unchanged; only the duplicate-detection query
-- changes from session_id to table_id.

CREATE OR REPLACE FUNCTION request_bill(
  p_device_token  text,
  p_session_id    uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device     session_devices%ROWTYPE;
  v_session    table_sessions%ROWTYPE;
  v_request_id uuid;
BEGIN
  SELECT * INTO v_device
  FROM   session_devices
  WHERE  device_token = p_device_token AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEVICE_INVALID';
  END IF;

  IF v_device.session_id <> p_session_id THEN
    RAISE EXCEPTION 'SESSION_MISMATCH';
  END IF;

  SELECT * INTO v_session
  FROM   table_sessions
  WHERE  id = p_session_id AND status = 'active' AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_INVALID';
  END IF;

  -- Table-scoped: one pending request covers all active sessions
  SELECT id INTO v_request_id
  FROM   bill_requests
  WHERE  table_id = v_session.table_id
    AND  status   = 'pending';

  IF NOT FOUND THEN
    INSERT INTO bill_requests (cafe_id, session_id, table_id, device_token)
    VALUES (v_session.cafe_id, v_session.id, v_session.table_id, p_device_token)
    RETURNING id INTO v_request_id;
  END IF;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION request_bill(text, uuid) IS
  'Signals to staff that a guest wants the bill. Table-scoped: one
   pending request covers all active sessions on the table. Idempotent —
   returns the existing pending request if one already exists for the
   table. Changed from session-scoped uniqueness in migration 025.';

GRANT EXECUTE ON FUNCTION request_bill(text, uuid) TO anon;


-- ============================================================
-- 10. end_table_sessions — new RPC
-- ============================================================
-- Ends all active sessions for a table in one call.
-- Returns the number of sessions ended.

CREATE OR REPLACE FUNCTION end_table_sessions(p_table_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cafe_id   uuid;
  session_ids uuid[];
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
      USING HINT = 'You may only end sessions for tables in your own cafe';
  END IF;

  IF NOT auth_user_has_role(ARRAY['owner','manager','staff']) THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'Only owner, manager, or staff can end sessions';
  END IF;

  WITH ended AS (
    UPDATE table_sessions
    SET    status     = 'ended',
           ended_at   = NOW(),
           ended_by   = auth.uid(),
           updated_at = NOW()
    WHERE  table_id   = p_table_id
      AND  status     = 'active'
    RETURNING id
  )
  SELECT ARRAY_AGG(id) INTO session_ids FROM ended;

  IF session_ids IS NOT NULL AND array_length(session_ids, 1) > 0 THEN
    UPDATE session_devices
    SET    is_active = false
    WHERE  session_id = ANY(session_ids)
      AND  is_active  = true;
  END IF;

  RETURN COALESCE(array_length(session_ids, 1), 0);
END;
$$;

COMMENT ON FUNCTION end_table_sessions(uuid) IS
  'Ends all active sessions for a physical table in one call.
   Sets status=ended, ended_at=NOW(), ended_by=auth.uid() on each.
   Deactivates all associated session_devices immediately.
   Returns the count of sessions ended. Cafe-scoped.';

GRANT EXECUTE ON FUNCTION end_table_sessions(uuid) TO authenticated;


-- ============================================================
-- 11. expire_stale_session_for_table — updated trigger function
-- ============================================================
-- Logic is identical to migration 011. Only the COMMENT changes:
-- the trigger no longer "unblocks a unique index" (that index was
-- dropped above) — it now serves purely as lazy session cleanup.

CREATE OR REPLACE FUNCTION expire_stale_session_for_table()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stale_ids uuid[];
BEGIN
  SELECT ARRAY_AGG(id)
  INTO   stale_ids
  FROM   table_sessions
  WHERE  table_id   = NEW.table_id
    AND  status     = 'active'
    AND  expires_at < NOW();

  IF stale_ids IS NOT NULL AND array_length(stale_ids, 1) > 0 THEN
    UPDATE table_sessions
    SET    status     = 'expired',
           ended_at   = NOW(),
           updated_at = NOW()
    WHERE  id = ANY(stale_ids);

    UPDATE session_devices
    SET    is_active = false
    WHERE  session_id = ANY(stale_ids)
      AND  is_active  = true;

    DECLARE
      sid uuid;
    BEGIN
      FOREACH sid IN ARRAY stale_ids
      LOOP
        PERFORM pg_notify(
          'session_status_change',
          json_build_object(
            'session_id', sid,
            'old_status', 'active',
            'new_status', 'expired'
          )::text
        );
      END LOOP;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION expire_stale_session_for_table IS
  'BEFORE INSERT trigger on table_sessions.
   On every new QR scan, lazily expires any sessions on the same
   table whose expires_at has passed and invalidates their devices.
   No background job needed. The one-active-session-per-table unique
   index was removed in migration 025; this trigger now serves purely
   as a cleanup mechanism, not a constraint unblock.';

-- The trigger binding (expire_stale_sessions_before_insert) already
-- exists from migration 011 and does not need to be recreated.


-- ============================================================
-- 12. Decommission old RPCs
-- ============================================================

REVOKE EXECUTE ON FUNCTION join_or_create_session(text) FROM anon;
DROP FUNCTION IF EXISTS join_or_create_session(text);

REVOKE EXECUTE ON FUNCTION get_session_orders(text) FROM anon;
DROP FUNCTION IF EXISTS get_session_orders(text);
