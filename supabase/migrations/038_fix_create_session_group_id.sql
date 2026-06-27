-- ============================================================
-- Migration 038: Restore table_groups logic in create_session()
-- Cafe Maestro Platform
-- ============================================================
-- Migration 035 redefined create_session() using the migration 025
-- body as its base. It added the maintenance check correctly but
-- silently dropped the entire table_groups block that was
-- introduced in migration 026:
--
--   • v_group_id declaration was removed
--   • SELECT / INSERT on table_groups was removed
--   • INSERT INTO table_sessions no longer included group_id
--
-- Result: every session created since migration 035 has
-- group_id = NULL and no corresponding table_groups row,
-- causing the Admin → Sessions page (which queries table_groups)
-- to display nothing.
--
-- This migration rebuilds create_session() from the migration 026
-- body (which is the correct base) and layers in the one addition
-- from migration 035: the is_under_maintenance guard.
--
-- Nothing else changes:
--   • function signature: create_session(text, text, text)
--   • RETURNS TABLE columns (identical to 025 / 026 / 035)
--   • SECURITY DEFINER, SET search_path = public
--   • GRANT EXECUTE TO anon
-- ============================================================

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

  -- Resolve QR token → active physical table.
  -- Explicit alias 'ct' prevents PostgreSQL from confusing bare
  -- column names with the RETURNS TABLE output parameters of the
  -- same name (error 42702 "column reference is ambiguous").
  SELECT ct.*
  INTO   v_table
  FROM   cafe_tables ct
  WHERE  ct.qr_code_token = p_qr_token
    AND  ct.is_active     = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND'
      USING HINT = 'No active table found for this QR token';
  END IF;

  -- Maintenance guard (added in migration 035).
  -- Reject new sessions while the table is temporarily blocked.
  IF v_table.is_under_maintenance THEN
    RAISE EXCEPTION 'TABLE_UNDER_MAINTENANCE'
      USING HINT = 'This table is currently under maintenance';
  END IF;

  -- ── Group assignment (restored from migration 026) ────────────
  -- Find an existing active table_group for this physical table.
  -- Alias 'tg' prevents PostgreSQL from confusing the bare column
  -- 'table_id' with the RETURNS TABLE output parameter of the
  -- same name (error 42702 "column reference is ambiguous").
  SELECT tg.id
  INTO   v_group_id
  FROM   table_groups tg
  WHERE  tg.table_id = v_table.id
    AND  tg.status   = 'active';

  IF NOT FOUND THEN
    -- No active group for this table — open a new one.
    INSERT INTO table_groups (cafe_id, table_id)
    VALUES (v_table.cafe_id, v_table.id)
    RETURNING table_groups.id INTO v_group_id;
  END IF;
  -- ─────────────────────────────────────────────────────────────

  -- Create the session and link it to the group.
  -- The BEFORE INSERT trigger fires here to lazily expire any
  -- sessions on this table whose expires_at has already passed.
  INSERT INTO table_sessions (cafe_id, table_id, customer_name, group_id)
  VALUES (v_table.cafe_id, v_table.id, v_name, v_group_id)
  RETURNING table_sessions.id INTO v_session_id;

  -- Register the device; capture user_agent for audit trail.
  -- 'session_devices.device_token' is table-qualified to avoid
  -- ambiguity with the RETURNS TABLE output param 'device_token'.
  INSERT INTO session_devices (session_id, cafe_id, user_agent)
  VALUES (
    v_session_id,
    v_table.cafe_id,
    NULLIF(TRIM(COALESCE(p_user_agent, '')), '')
  )
  RETURNING session_devices.device_token INTO v_device_token;

  -- All selected expressions are explicitly table-aliased so
  -- PostgreSQL never confuses them with RETURNS TABLE output params.
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
  'QR scan entry point. Every scan creates a new table_session for this
   guest and links it to the active table_group for the physical table
   (creating one if none exists). Rejects the request when the table is
   under maintenance (TABLE_UNDER_MAINTENANCE), not found or inactive
   (TABLE_NOT_FOUND), or the customer name is blank (CUSTOMER_NAME_REQUIRED).';

GRANT EXECUTE ON FUNCTION create_session(text, text, text) TO anon;
