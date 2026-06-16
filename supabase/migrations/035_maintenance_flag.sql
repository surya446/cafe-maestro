-- ============================================================
-- Migration 035: Maintenance flag for cafe_tables
-- Cafe Maestro Platform
-- ============================================================
-- Adds is_under_maintenance to the table operational state model.
-- This is distinct from is_active (archive flag):
--   is_active = false          → archived (hidden from all customers)
--   is_under_maintenance = true → temporarily blocked (no new sessions)
--
-- Changes:
--   1. ALTER TABLE cafe_tables ADD COLUMN is_under_maintenance
--   2. CREATE POLICY cafe_tables_anon_active_read (guest QR lookup)
--   3. UPDATE create_session RPC to enforce maintenance block
-- ============================================================


-- 1. Add maintenance column
ALTER TABLE cafe_tables
  ADD COLUMN IF NOT EXISTS is_under_maintenance boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN cafe_tables.is_under_maintenance IS
  'When true, this table is blocked from new QR sessions and hidden from
   booking assignment. Operational flag — separate from is_active (archive).
   Only toggled by staff with owner/manager role.';


-- 2. Allow anon to read active tables
--    Safe: QR codes already make table existence public.
--    Enables the guest UI to check maintenance status before the name-entry
--    form is shown, preventing a confusing "enter your name" → "blocked" flow.
CREATE POLICY "cafe_tables_anon_active_read"
  ON cafe_tables FOR SELECT
  TO anon
  USING (is_active = true);


-- 3. Update create_session to enforce the maintenance block server-side.
--    Even if the client skips the pre-check, the RPC rejects the request.
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
  v_name := TRIM(COALESCE(p_customer_name, ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'CUSTOMER_NAME_REQUIRED'
      USING HINT = 'A customer name is required to start a session';
  END IF;

  SELECT * INTO v_table
  FROM   cafe_tables
  WHERE  qr_code_token = p_qr_token
    AND  is_active     = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND'
      USING HINT = 'No active table found for this QR token';
  END IF;

  IF v_table.is_under_maintenance THEN
    RAISE EXCEPTION 'TABLE_UNDER_MAINTENANCE'
      USING HINT = 'This table is currently under maintenance';
  END IF;

  INSERT INTO table_sessions (cafe_id, table_id, customer_name)
  VALUES (v_table.cafe_id, v_table.id, v_name)
  RETURNING id INTO v_session_id;

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
  JOIN  cafes           c ON c.id = ts.cafe_id
  WHERE ts.id = v_session_id;
END;
$$;

COMMENT ON FUNCTION create_session(text, text, text) IS
  'QR scan entry point for the multi-session architecture.
   Every scan creates a new independent session.
   Blocks session creation when table is_under_maintenance = true (TABLE_UNDER_MAINTENANCE).
   Blocks when table not found or inactive (TABLE_NOT_FOUND).
   Requires a non-empty customer_name (CUSTOMER_NAME_REQUIRED).';

GRANT EXECUTE ON FUNCTION create_session(text, text, text) TO anon;
