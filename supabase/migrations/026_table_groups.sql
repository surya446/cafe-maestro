-- ============================================================
-- Migration 026: Table Groups (Visit Model) + Clear Table
-- Cafe Maestro Platform
-- ============================================================
-- Introduces table_groups: one row per party's visit to a table.
-- Every session belongs to a group. Every order belongs indirectly
-- to a group through its session. Clear Table closes the current
-- group; the next QR scan opens a new one automatically.
--
-- Depends on: migration 025 (create_session, get_table_orders,
--             end_table_sessions must already exist)
--
-- Changes:
--
--   Schema
--   ------
--   1.  CREATE TABLE table_groups
--   2.  table_sessions  ADD COLUMN group_id → FK to table_groups
--
--   Backfill
--   --------
--   3.  One active table_group per table that has active sessions
--   4.  All currently-active sessions assigned to their table's group
--       (Historical ended/expired sessions left with group_id = NULL)
--
--   RPCs replaced / updated
--   -----------------------
--   5.  create_session    → also assigns group_id (get or create)
--   6.  get_table_orders  → group_id-scoped; 6-hour window is the
--                           legacy fallback for NULL group_id only
--
--   New RPCs
--   --------
--   7.  clear_table(p_table_id uuid)
--         Authenticated. Ends all active sessions, acknowledges
--         pending bill requests, and marks the group as cleared.
--         The next QR scan creates a new group automatically.
--
--   8.  staff_request_bill(p_table_id uuid)
--         Authenticated. Creates a pending bill_request for the
--         table's active group without a guest device_token.
--         Idempotent — returns the existing request if one exists.
--
-- Safe on existing data:
--   • table_sessions.group_id is nullable; old rows get NULL.
--   • Backfill only touches currently-active sessions.
--   • No historical rows are deleted or modified.
-- ============================================================


-- ============================================================
-- 1. CREATE TABLE table_groups
-- ============================================================

CREATE TABLE table_groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id     uuid        NOT NULL REFERENCES cafes(id)       ON DELETE CASCADE,
  table_id    uuid        NOT NULL REFERENCES cafe_tables(id) ON DELETE CASCADE,

  status      text        NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'cleared')),

  opened_at   timestamptz NOT NULL DEFAULT NOW(),
  cleared_at  timestamptz,
  cleared_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE table_groups IS
  'One row per party visit to a physical table.
   status=active  : guests are currently seated and ordering.
   status=cleared : staff has collected payment and reset the table.
   Created automatically by create_session when no active group exists.
   Closed by clear_table(). All sessions, orders, and bill requests for
   a visit are linked through this group.';

COMMENT ON COLUMN table_groups.opened_at IS
  'Set to the started_at of the first session in this group during backfill;
   defaults to NOW() for all groups created after migration 026.';

COMMENT ON COLUMN table_groups.cleared_by IS
  'Staff user who called clear_table(). NULL for groups that have not yet
   been cleared, or for any future automated expiry mechanism.';

-- Enforces the single-active-group-per-table invariant at the DB level.
CREATE UNIQUE INDEX table_groups_one_active_per_table
  ON table_groups (table_id)
  WHERE status = 'active';

COMMENT ON INDEX table_groups_one_active_per_table IS
  'At most one active table_group per physical table at any time.
   clear_table() sets status=cleared before the next create_session
   can open a new group.';

SELECT create_updated_at_trigger('table_groups');

-- RLS: authenticated staff can read groups for their own cafe.
-- All anon access goes through SECURITY DEFINER RPCs.
ALTER TABLE table_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "table_groups__staff__select"
  ON table_groups FOR SELECT
  TO authenticated
  USING (cafe_id = auth_user_cafe_id());

CREATE POLICY "table_groups__staff__update"
  ON table_groups FOR UPDATE
  TO authenticated
  USING (cafe_id = auth_user_cafe_id());


-- ============================================================
-- 2. table_sessions.group_id
-- ============================================================

ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES table_groups(id);

COMMENT ON COLUMN table_sessions.group_id IS
  'The table_group (party visit) this session belongs to.
   Set by create_session at creation time (migration 026+).
   NULL for sessions created before migration 026 (legacy rows).
   All sessions in the same party visit share the same group_id.';

-- Index to support get_table_orders and admin group-member lookups.
CREATE INDEX IF NOT EXISTS table_sessions_group_id_idx
  ON table_sessions (group_id)
  WHERE group_id IS NOT NULL;


-- ============================================================
-- 3 & 4. Backfill: active sessions → active table_groups
-- ============================================================
-- For each physical table that currently has at least one active
-- session, create one table_group (status=active) and link all
-- those sessions to it.
--
-- Historical ended/expired sessions are intentionally left with
-- group_id = NULL. The 6-hour fallback in get_table_orders covers
-- the brief window until those sessions naturally expire.
-- ============================================================

DO $$
DECLARE
  r          RECORD;
  v_group_id uuid;
  v_opened   timestamptz;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (ts.table_id)
           ts.table_id,
           ts.cafe_id,
           MIN(ts.started_at) OVER (PARTITION BY ts.table_id) AS earliest_start
    FROM   table_sessions ts
    WHERE  ts.status = 'active'
  LOOP
    -- opened_at = earliest active session on this table
    v_opened := r.earliest_start;

    INSERT INTO table_groups (cafe_id, table_id, opened_at)
    VALUES (r.cafe_id, r.table_id, v_opened)
    RETURNING id INTO v_group_id;

    UPDATE table_sessions
    SET    group_id = v_group_id
    WHERE  table_id = r.table_id
      AND  status   = 'active';
  END LOOP;
END;
$$;


-- ============================================================
-- 5. create_session — updated to assign group_id
-- ============================================================
-- Behaviour change: after creating the session, get or create the
-- active table_group for this table and store it on the session.
-- All other logic (customer_name, device registration, return shape)
-- is identical to migration 025.

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
  v_group_id     uuid;
BEGIN
  -- Require a non-blank customer name
  v_name := TRIM(COALESCE(p_customer_name, ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'CUSTOMER_NAME_REQUIRED'
      USING HINT = 'A customer name is required to start a session';
  END IF;

  -- Resolve QR token → active physical table
  -- Use explicit alias 'ct' so qr_code_token / is_active are unambiguous
  -- with any RETURNS TABLE output column of the same name in future.
  SELECT ct.*
  INTO   v_table
  FROM   cafe_tables ct
  WHERE  ct.qr_code_token = p_qr_token
    AND  ct.is_active     = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND'
      USING HINT = 'No active table found for this QR token';
  END IF;

  -- ── Group assignment ──────────────────────────────────────────
  -- Alias 'tg' prevents PostgreSQL from confusing the bare column
  -- name 'table_id' with the RETURNS TABLE output parameter of the
  -- same name (error 42702 "column reference is ambiguous").
  SELECT tg.id
  INTO   v_group_id
  FROM   table_groups tg
  WHERE  tg.table_id = v_table.id
    AND  tg.status   = 'active';

  IF NOT FOUND THEN
    INSERT INTO table_groups (cafe_id, table_id)
    VALUES (v_table.cafe_id, v_table.id)
    RETURNING table_groups.id INTO v_group_id;
  END IF;
  -- ─────────────────────────────────────────────────────────────

  -- Create a new session for this guest and link it to the group.
  -- The BEFORE INSERT trigger fires here to lazily expire any sessions
  -- on this table whose expires_at has already passed.
  INSERT INTO table_sessions (cafe_id, table_id, customer_name, group_id)
  VALUES (v_table.cafe_id, v_table.id, v_name, v_group_id)
  RETURNING table_sessions.id INTO v_session_id;

  -- Register the device; capture user_agent for audit trail.
  -- 'session_devices.device_token' is already table-qualified to avoid
  -- ambiguity with the RETURNS TABLE output param 'device_token'.
  INSERT INTO session_devices (session_id, cafe_id, user_agent)
  VALUES (
    v_session_id,
    v_table.cafe_id,
    NULLIF(TRIM(COALESCE(p_user_agent, '')), '')
  )
  RETURNING session_devices.device_token INTO v_device_token;

  -- All selected expressions are explicitly table-aliased so PostgreSQL
  -- never confuses them with the RETURNS TABLE output parameters.
  RETURN QUERY
  SELECT
    ts.id              AS session_id,
    v_device_token     AS device_token,
    ts.cafe_id         AS cafe_id,
    c.name::text       AS cafe_name,
    ts.table_id        AS table_id,
    v_table.number     AS table_number,
    v_table.name       AS table_name,
    ts.expires_at      AS expires_at,
    ts.customer_name   AS customer_name
  FROM   table_sessions ts
  JOIN   cafes          c  ON c.id = ts.cafe_id
  WHERE  ts.id = v_session_id;
END;
$$;

COMMENT ON FUNCTION create_session(text, text, text) IS
  'QR scan entry point for the multi-session + table-group architecture.
   Creates a new independent session for every scan. Assigns the session
   to the current active table_group; if no active group exists, opens one.
   Requires a non-empty customer_name. Replaces join_or_create_session()
   (decommissioned in migration 025). Updated in migration 026 to set group_id.';

GRANT EXECUTE ON FUNCTION create_session(text, text, text) TO anon;


-- ============================================================
-- 6. get_table_orders — group_id-scoped isolation
-- ============================================================
-- Orders are now isolated by table_group rather than a 6-hour window.
-- The calling device's session carries the group_id; only orders from
-- sessions in that same group are returned.
--
-- Legacy fallback: if the device's session has group_id IS NULL
-- (created before migration 026), fall back to the 6-hour window so
-- existing sessions continue to work until they expire naturally.
--
-- Once all pre-026 sessions have ended/expired, the legacy branch
-- becomes unreachable and can be removed in a future migration.

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
  v_group_id uuid;
BEGIN
  -- Resolve device token → physical table + group
  -- No status filter: works even if the session has ended or expired
  SELECT ts.table_id, ts.group_id
  INTO   v_table_id, v_group_id
  FROM   session_devices sd
  JOIN   table_sessions  ts ON ts.id = sd.session_id
  WHERE  sd.device_token = p_device_token
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN;
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
  JOIN   table_sessions  ts2 ON ts2.id        = o.session_id
  LEFT  JOIN order_items  oi  ON oi.order_id  = o.id
  LEFT  JOIN menu_items   mi  ON mi.id        = oi.menu_item_id
  WHERE  o.table_id = v_table_id
    AND (
      -- ── Primary path (migration 026+) ────────────────────────
      -- group_id is set: only orders from sessions in this group
      (v_group_id IS NOT NULL AND ts2.group_id = v_group_id)
      OR
      -- ── Legacy fallback (pre-026 sessions) ───────────────────
      -- group_id is NULL: fall back to the 6-hour window
      -- This branch becomes unreachable once all pre-026 sessions expire.
      (v_group_id IS NULL AND ts2.started_at > NOW() - INTERVAL '6 hours')
    )
  GROUP  BY o.id, o.session_id, ts2.customer_name,
            o.status, o.staff_note, o.created_at
  ORDER  BY o.created_at ASC;
END;
$$;

COMMENT ON FUNCTION get_table_orders(text) IS
  'Returns all orders for the calling device''s party visit (table_group).
   Isolation is group_id-based (migration 026). A 6-hour window fallback
   applies only to legacy sessions (group_id IS NULL) created before
   migration 026 — this path expires as those sessions end naturally.
   Replacing: previously used a 6-hour window unconditionally (migration 025).';

GRANT EXECUTE ON FUNCTION get_table_orders(text) TO anon;


-- ============================================================
-- 7. clear_table — new authenticated RPC
-- ============================================================
-- Called by staff after collecting payment offline.
-- Steps:
--   1. End all active sessions on the table.
--   2. Deactivate all devices for those sessions.
--   3. Acknowledge any pending bill request for the table.
--   4. Mark the active table_group as cleared.
--
-- After this call the table has no active group. The next QR scan
-- (create_session) will open a new group automatically.
--
-- Idempotent: calling clear_table on a table with no active group
-- is a no-op (returns without error).

CREATE OR REPLACE FUNCTION clear_table(p_table_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cafe_id     uuid;
  v_group_id    uuid;
  v_session_ids uuid[];
BEGIN
  -- ── Auth ────────────────────────────────────────────────────
  SELECT cafe_id INTO v_cafe_id
  FROM   cafe_tables
  WHERE  id = p_table_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND'
      USING HINT = 'No table with that ID exists';
  END IF;

  IF v_cafe_id IS DISTINCT FROM auth_user_cafe_id() THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'You may only clear tables in your own cafe';
  END IF;

  IF NOT auth_user_has_role(ARRAY['owner','manager','staff']) THEN
    RAISE EXCEPTION 'ACCESS_DENIED'
      USING HINT = 'Only owner, manager, or staff can clear tables';
  END IF;

  -- ── Find active group ────────────────────────────────────────
  SELECT id INTO v_group_id
  FROM   table_groups
  WHERE  table_id = p_table_id
    AND  status   = 'active';

  IF NOT FOUND THEN
    RETURN;  -- Nothing to clear; idempotent
  END IF;

  -- ── 1. End all active sessions on this table ─────────────────
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
  SELECT ARRAY_AGG(id) INTO v_session_ids FROM ended;

  -- ── 2. Deactivate all devices for those sessions ─────────────
  IF v_session_ids IS NOT NULL AND array_length(v_session_ids, 1) > 0 THEN
    UPDATE session_devices
    SET    is_active = false
    WHERE  session_id = ANY(v_session_ids)
      AND  is_active  = true;
  END IF;

  -- ── 3. Acknowledge any pending bill request for this table ────
  UPDATE bill_requests
  SET    status           = 'acknowledged',
         acknowledged_at  = NOW(),
         acknowledged_by  = auth.uid()
  WHERE  table_id = p_table_id
    AND  status   = 'pending';

  -- ── 4. Close the table_group ──────────────────────────────────
  UPDATE table_groups
  SET    status     = 'cleared',
         cleared_at = NOW(),
         cleared_by = auth.uid(),
         updated_at = NOW()
  WHERE  id = v_group_id;

END;
$$;

COMMENT ON FUNCTION clear_table(uuid) IS
  'Staff action taken after collecting payment at the table.
   Ends all active sessions → deactivates all devices → acknowledges
   pending bill requests → marks the table_group as cleared.
   Idempotent: no-op if no active group exists.
   The next QR scan will open a new table_group automatically.
   Authenticated; cafe-scoped to owner/manager/staff roles.';

GRANT EXECUTE ON FUNCTION clear_table(uuid) TO authenticated;


-- ============================================================
-- 8. staff_request_bill — new authenticated RPC
-- ============================================================
-- Staff-side bill request. Creates a pending bill_request for the
-- table's current active group without needing a guest device_token
-- (staff may trigger this verbally on the customer's behalf).
-- Idempotent: returns the existing pending request id if one exists.

CREATE OR REPLACE FUNCTION staff_request_bill(p_table_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cafe_id    uuid;
  v_group_id   uuid;
  v_session_id uuid;
  v_request_id uuid;
BEGIN
  -- ── Auth ────────────────────────────────────────────────────
  SELECT cafe_id INTO v_cafe_id
  FROM   cafe_tables
  WHERE  id = p_table_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND';
  END IF;

  IF v_cafe_id IS DISTINCT FROM auth_user_cafe_id() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF NOT auth_user_has_role(ARRAY['owner','manager','staff']) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  -- ── Must have an active group ────────────────────────────────
  SELECT id INTO v_group_id
  FROM   table_groups
  WHERE  table_id = p_table_id
    AND  status   = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_ACTIVE_GROUP'
      USING HINT = 'There is no active party at this table';
  END IF;

  -- ── Get a session to satisfy the NOT NULL FK on bill_requests ─
  -- Any session in the group (active or ended) is acceptable.
  SELECT id INTO v_session_id
  FROM   table_sessions
  WHERE  group_id = v_group_id
  ORDER  BY created_at DESC
  LIMIT  1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_SESSIONS'
      USING HINT = 'Active group has no sessions yet';
  END IF;

  -- ── Idempotent: return existing pending request if one exists ─
  SELECT id INTO v_request_id
  FROM   bill_requests
  WHERE  table_id = p_table_id
    AND  status   = 'pending';

  IF NOT FOUND THEN
    -- device_token = 'staff' signals this was a staff-initiated request
    INSERT INTO bill_requests (cafe_id, session_id, table_id, device_token)
    VALUES (v_cafe_id, v_session_id, p_table_id, 'staff')
    RETURNING id INTO v_request_id;
  END IF;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION staff_request_bill(uuid) IS
  'Staff-triggered bill request for a physical table.
   Creates a pending bill_request for the current active group without
   requiring a guest device_token (staff acts on the guest''s behalf).
   Idempotent — returns the existing pending request id if one already exists.
   device_token is set to ''staff'' to distinguish from guest-initiated requests.
   Authenticated; cafe-scoped to owner/manager/staff roles.';

GRANT EXECUTE ON FUNCTION staff_request_bill(uuid) TO authenticated;
