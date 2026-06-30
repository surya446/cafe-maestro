-- ============================================================
-- Migration 022: QR Ordering — Guest RPCs & Realtime Policies
-- Cafe Maestro Platform
-- ============================================================
-- Adds the server-side functions for the guest QR ordering flow.
-- All guest writes go through SECURITY DEFINER RPCs that validate
-- device credentials before any DML, preventing direct table access.
--
-- RPCs (callable by anon role):
--   join_or_create_session(qr_token)          → session + device_token
--   validate_device(device_token)             → session validity check
--   place_order(device_token, session_id, items) → order_id
--   request_bill(device_token, session_id)       → bill_request_id
--   get_session_orders(device_token)             → orders[]
--
-- New anon SELECT policies (time-scoped to 4 h):
--   table_sessions__anon__realtime  → Supabase Realtime session watch
--   orders__anon__realtime          → Supabase Realtime order tracking
--
-- Security notes:
--   • Session / order UUIDs are gen_random_uuid() — 2^122 entropy.
--     The UUID itself is the credential for realtime subscriptions.
--   • Prices are fetched server-side in place_order to prevent
--     client-side price manipulation.
--   • The BEFORE INSERT trigger (migration 011) auto-expires stale
--     sessions before a new one is created — no pg_cron required.
--   • Concurrent QR scans on the same table are handled via a
--     LOOP + unique_violation catch around the session INSERT.
-- ============================================================


-- ============================================================
-- Anon SELECT policies for Supabase Realtime subscriptions
-- ============================================================
-- These allow guest devices to subscribe to postgres_changes
-- events so session termination and order status changes
-- propagate in real time without polling.
-- Scoped to sessions/orders created in the past 4 hours.

CREATE POLICY "table_sessions__anon__realtime"
  ON table_sessions FOR SELECT
  TO anon
  USING (started_at > NOW() - INTERVAL '4 hours');

CREATE POLICY "orders__anon__realtime"
  ON orders FOR SELECT
  TO anon
  USING (created_at > NOW() - INTERVAL '4 hours');


-- ============================================================
-- RPC: join_or_create_session
-- ============================================================
-- Called on every QR code scan. Resolves qr_code_token →
-- physical table, then either joins the existing active session
-- or creates a new one (BEFORE INSERT trigger handles stale
-- session expiry). Registers a fresh device_token for this scan.

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
-- RPC: validate_device
-- ============================================================
-- Called on page reload when localStorage contains a stored
-- device_token. Lazily expires overdue sessions, updates the
-- device heartbeat, and reports the current session state.

CREATE OR REPLACE FUNCTION validate_device(p_device_token text)
RETURNS TABLE (
  is_valid        boolean,
  session_id      uuid,
  session_status  text,
  expires_at      timestamptz,
  cafe_id         uuid,
  cafe_name       text,
  table_id        uuid,
  table_number    integer,
  table_name      text
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
    ct.name            AS table_name
  FROM   session_devices sd
  JOIN   table_sessions  ts ON ts.id  = sd.session_id
  JOIN   cafe_tables     ct ON ct.id  = ts.table_id
  JOIN   cafes            c ON c.id   = ts.cafe_id
  WHERE  sd.device_token = p_device_token
  LIMIT  1;
END;
$$;

COMMENT ON FUNCTION validate_device(text) IS
  'Checks whether a stored device_token is still valid. Lazily expires
   sessions and updates the device heartbeat. Returns is_valid=false when
   the session has ended or expired — the guest UI should prompt re-scan.';

GRANT EXECUTE ON FUNCTION validate_device(text) TO anon;


-- ============================================================
-- RPC: place_order
-- ============================================================
-- Validates device ownership + session liveness, fetches
-- current prices server-side (prevents client price tampering),
-- and atomically inserts order + order_items.

CREATE OR REPLACE FUNCTION place_order(
  p_device_token  text,
  p_session_id    uuid,
  p_items         jsonb   -- [{menu_item_id, quantity, notes?}]
)
RETURNS uuid   -- new order_id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device    session_devices%ROWTYPE;
  v_session   table_sessions%ROWTYPE;
  v_order_id  uuid;
  v_item      jsonb;
  v_mi_id     uuid;
  v_price     numeric(10,2);
  v_qty       integer;
BEGIN
  -- 1. Validate device
  SELECT * INTO v_device
  FROM   session_devices
  WHERE  device_token = p_device_token
    AND  is_active    = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEVICE_INVALID'
      USING HINT = 'Device token is invalid or the session has ended';
  END IF;

  IF v_device.session_id <> p_session_id THEN
    RAISE EXCEPTION 'SESSION_MISMATCH'
      USING HINT = 'Device does not belong to this session';
  END IF;

  -- 2. Validate session liveness
  SELECT * INTO v_session
  FROM   table_sessions
  WHERE  id         = p_session_id
    AND  status     = 'active'
    AND  expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_INVALID'
      USING HINT = 'Session is no longer active or has expired';
  END IF;

  -- 3. Require at least one item
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'NO_ITEMS'
      USING HINT = 'Order must contain at least one item';
  END IF;

  -- 4. Create order header
  INSERT INTO orders (cafe_id, session_id, table_id, device_token)
  VALUES (v_session.cafe_id, v_session.id, v_session.table_id, p_device_token)
  RETURNING id INTO v_order_id;

  -- 5. Insert line items — prices come from DB to prevent tampering
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_mi_id := (v_item->>'menu_item_id')::uuid;
    v_qty   := COALESCE((v_item->>'quantity')::integer, 1);

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY'
        USING HINT = 'Item quantity must be at least 1';
    END IF;

    SELECT price INTO v_price
    FROM   menu_items
    WHERE  id           = v_mi_id
      AND  cafe_id      = v_session.cafe_id
      AND  is_available = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ITEM_UNAVAILABLE'
        USING HINT = format('Menu item %s is unavailable', v_mi_id);
    END IF;

    INSERT INTO order_items (
      cafe_id, order_id, menu_item_id, quantity, unit_price, notes
    ) VALUES (
      v_session.cafe_id,
      v_order_id,
      v_mi_id,
      v_qty,
      v_price,
      NULLIF(TRIM(COALESCE(v_item->>'notes', '')), '')
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

COMMENT ON FUNCTION place_order(text, uuid, jsonb) IS
  'Atomic order creation for guest devices. Validates device + session,
   fetches server-side prices (prevents tampering), inserts order + items.
   Items JSON: [{menu_item_id: uuid, quantity: int, notes?: text}]';

GRANT EXECUTE ON FUNCTION place_order(text, uuid, jsonb) TO anon;


-- ============================================================
-- RPC: request_bill
-- ============================================================
-- Idempotent: returns the existing pending bill request if one
-- already exists for this session (unique index enforces this).

CREATE OR REPLACE FUNCTION request_bill(
  p_device_token  text,
  p_session_id    uuid
)
RETURNS uuid   -- bill_request_id (new or existing pending)
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

  -- Return existing or create new pending request
  SELECT id INTO v_request_id
  FROM   bill_requests
  WHERE  session_id = p_session_id AND status = 'pending';

  IF NOT FOUND THEN
    INSERT INTO bill_requests (cafe_id, session_id, table_id, device_token)
    VALUES (v_session.cafe_id, v_session.id, v_session.table_id, p_device_token)
    RETURNING id INTO v_request_id;
  END IF;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION request_bill(text, uuid) IS
  'Signals to staff that a guest wants the bill. Idempotent — returns
   the existing pending request if one already exists for this session.';

GRANT EXECUTE ON FUNCTION request_bill(text, uuid) TO anon;


-- ============================================================
-- RPC: get_session_orders
-- ============================================================
-- Returns all orders placed by this device, enriched with line
-- items and menu item names. Used for guest order history and
-- status tracking. Scoped to device_token — no cross-device leak.

CREATE OR REPLACE FUNCTION get_session_orders(p_device_token text)
RETURNS TABLE (
  order_id    uuid,
  status      text,
  staff_note  text,
  created_at  timestamptz,
  items       jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id                 AS order_id,
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
  FROM   orders     o
  LEFT  JOIN order_items oi ON oi.order_id    = o.id
  LEFT  JOIN menu_items  mi ON mi.id          = oi.menu_item_id
  WHERE  o.device_token = p_device_token
  GROUP  BY o.id, o.status, o.staff_note, o.created_at
  ORDER  BY o.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_session_orders(text) IS
  'Returns all orders placed by this device token with enriched item detail.
   Scoped to device_token — a device can only see its own orders.
   Used for order history display and status tracking in the guest UI.';

GRANT EXECUTE ON FUNCTION get_session_orders(text) TO anon;
