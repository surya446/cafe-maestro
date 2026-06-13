-- ============================================================
-- Migration 013: Audit Logs
-- Cafe Maestro Platform
-- ============================================================
--
-- DESIGN PRINCIPLE — Mobile-Ready Audit Trail
-- ──────────────────────────────────────────────────────────
-- All audit records are written by POSTGRES TRIGGERS, not
-- application code. This means:
--
--   Web app writes order approval → audit_log written ✓
--   Staff mobile app writes order approval → audit_log written ✓
--   Kitchen tablet writes status change → audit_log written ✓
--   Future owner app changes menu → audit_log written ✓
--
-- No mobile app needs to call a logging endpoint.
-- No API route needs to manually log anything.
-- The database guarantees the audit trail is complete,
-- regardless of which client or API triggered the change.
--
-- ──────────────────────────────────────────────────────────
-- Schema overview
-- ──────────────────────────────────────────────────────────
--
-- audit_logs
--   id             → unique log entry
--   cafe_id        → tenant scoping
--   event_type     → namespaced action, e.g. 'session.ended'
--   entity_table   → which table was affected
--   entity_id      → which row was affected
--   actor_type     → 'staff' | 'system' | 'guest'
--   actor_id       → auth.uid() for staff, device_token for guest,
--                    'system' for cron/trigger-initiated actions
--   old_data       → JSONB snapshot of row BEFORE change (UPDATE/DELETE)
--   new_data       → JSONB snapshot of row AFTER change (INSERT/UPDATE)
--   changed_fields → array of column names that actually changed (UPDATE)
--   metadata       → JSONB bag for extra context (IP, user-agent, etc.)
--   created_at     → immutable timestamp of when the event occurred
--
-- audit_logs is APPEND-ONLY. Rows are never updated or deleted.
-- ============================================================


-- ------------------------------------
-- Core audit_logs table
-- ------------------------------------

CREATE TABLE audit_logs (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id         uuid          REFERENCES cafes(id) ON DELETE CASCADE,

  -- What happened
  event_type      text          NOT NULL,
  -- Namespaced dot-notation, e.g.:
  --   'session.ended'         'session.expired'
  --   'order.approved'        'order.rejected'        'order.status_changed'
  --   'menu_item.created'     'menu_item.updated'     'menu_item.deleted'
  --   'menu_item.availability_changed'
  --   'booking.created'       'booking.confirmed'     'booking.cancelled'
  --   'staff.created'         'staff.updated'         'staff.deactivated'
  --   'bill_request.acknowledged'

  -- Where it happened
  entity_table    text          NOT NULL,   -- 'orders', 'table_sessions', etc.
  entity_id       uuid          NOT NULL,   -- PK of the affected row

  -- Who did it
  actor_type      text          NOT NULL    DEFAULT 'system'
                  CHECK (actor_type IN ('staff', 'guest', 'system')),
  actor_id        text,
  -- staff  → auth.uid()::text (UUID string)
  -- guest  → device_token
  -- system → 'pg_cron' | 'trigger' | null

  -- What changed
  old_data        jsonb,        -- Row state BEFORE the change (null for INSERT)
  new_data        jsonb,        -- Row state AFTER the change (null for DELETE)
  changed_fields  text[],       -- Column names that differ between old/new

  -- Extra context (optional, API layer can populate via SET LOCAL)
  metadata        jsonb         NOT NULL DEFAULT '{}'::jsonb,
  -- e.g. { "ip": "...", "user_agent": "...", "reason": "..." }

  -- Immutable timestamp
  created_at      timestamptz   NOT NULL DEFAULT NOW()

  -- NO updated_at — audit rows are never modified
);

COMMENT ON TABLE audit_logs IS
  'Append-only audit trail for all significant state changes across the platform. Written exclusively by Postgres triggers — any client (web, mobile, tablet) is automatically audited without additional implementation.';

COMMENT ON COLUMN audit_logs.changed_fields IS
  'For UPDATE events: the list of columns whose values actually changed. Allows consumers to quickly determine if a relevant field was modified without diffing old_data vs new_data.';

COMMENT ON COLUMN audit_logs.actor_id IS
  'For staff: auth.uid()::text. For guests: device_token. For system events (cron, triggers): descriptive string or null.';

COMMENT ON COLUMN audit_logs.metadata IS
  'Optional bag for extra context. API routes can set a local Postgres variable (SET LOCAL app.actor_id = ...) so triggers can pick it up without a JOIN.';


-- ------------------------------------
-- Indexes on audit_logs
-- ------------------------------------

-- Most common query: audit history for a specific entity (e.g. order detail page)
CREATE INDEX idx_audit_logs_entity
  ON audit_logs (entity_table, entity_id, created_at DESC);

-- Admin audit viewer: all events for a cafe, newest first
CREATE INDEX idx_audit_logs_cafe_created
  ON audit_logs (cafe_id, created_at DESC);

-- Filter by event type (e.g. show all 'order.rejected' events)
CREATE INDEX idx_audit_logs_event_type
  ON audit_logs (cafe_id, event_type, created_at DESC);

-- Actor history (e.g. what did this staff member do today?)
CREATE INDEX idx_audit_logs_actor
  ON audit_logs (actor_type, actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;


-- ------------------------------------
-- RLS on audit_logs
-- ------------------------------------

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Owner: read all audit logs for their cafe
CREATE POLICY "audit_logs_owner_read"
  ON audit_logs FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_role() = 'owner');

-- Staff: read audit logs for their cafe (limited events — no staff account changes)
CREATE POLICY "audit_logs_staff_read"
  ON audit_logs FOR SELECT
  USING (
    cafe_id = auth_user_cafe_id()
    AND auth_user_role() = 'staff'
    AND event_type NOT LIKE 'staff.%'   -- Staff cannot see staff account audit events
  );

-- No INSERT/UPDATE/DELETE policies — audit_logs is written exclusively
-- by SECURITY DEFINER trigger functions (bypass RLS). Direct inserts
-- from clients are prohibited.


-- ============================================================
-- TRIGGER INFRASTRUCTURE
-- ============================================================

-- ------------------------------------
-- Helper: read actor_id from session local variable
-- Set by API routes before any DML:
--   SET LOCAL app.actor_id = '<auth.uid() or device_token>';
--   SET LOCAL app.actor_type = 'staff';
-- ------------------------------------

CREATE OR REPLACE FUNCTION get_audit_actor_id()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v text;
BEGIN
  BEGIN
    v := current_setting('app.actor_id', true);
  EXCEPTION WHEN OTHERS THEN
    v := NULL;
  END;
  -- Fall back to auth.uid() if not explicitly set
  IF v IS NULL OR v = '' THEN
    v := auth.uid()::text;
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION get_audit_actor_type()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v text;
BEGIN
  BEGIN
    v := current_setting('app.actor_type', true);
  EXCEPTION WHEN OTHERS THEN
    v := 'system';
  END;
  IF v IS NULL OR v = '' THEN
    -- If auth.uid() exists, it's a staff action
    IF auth.uid() IS NOT NULL THEN
      v := 'staff';
    ELSE
      v := 'system';
    END IF;
  END IF;
  RETURN v;
END;
$$;

-- ------------------------------------
-- Helper: compute changed_fields array from old/new JSONB
-- ------------------------------------

CREATE OR REPLACE FUNCTION jsonb_changed_fields(old_row jsonb, new_row jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY(
    SELECT key
    FROM jsonb_each(new_row)
    WHERE new_row->key IS DISTINCT FROM old_row->key
  );
$$;

-- ------------------------------------
-- Core audit insert function
-- (called by all audit triggers)
-- ------------------------------------

CREATE OR REPLACE FUNCTION insert_audit_log(
  p_cafe_id       uuid,
  p_event_type    text,
  p_entity_table  text,
  p_entity_id     uuid,
  p_old_data      jsonb,
  p_new_data      jsonb,
  p_changed_fields text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER   -- Bypasses RLS; audit_logs has no INSERT policy for clients
AS $$
BEGIN
  INSERT INTO audit_logs (
    cafe_id, event_type, entity_table, entity_id,
    actor_type, actor_id,
    old_data, new_data, changed_fields
  ) VALUES (
    p_cafe_id,
    p_event_type,
    p_entity_table,
    p_entity_id,
    get_audit_actor_type(),
    get_audit_actor_id(),
    p_old_data,
    p_new_data,
    p_changed_fields
  );
END;
$$;


-- ============================================================
-- TRIGGER: TABLE_SESSIONS — session endings
-- ============================================================

CREATE OR REPLACE FUNCTION audit_table_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_type text;
BEGIN
  -- INSERT: new session started
  IF TG_OP = 'INSERT' THEN
    PERFORM insert_audit_log(
      NEW.cafe_id, 'session.started', 'table_sessions', NEW.id,
      NULL, to_jsonb(NEW), NULL
    );
    RETURN NEW;
  END IF;

  -- UPDATE: only log meaningful status transitions
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status <> OLD.status THEN
      v_event_type := CASE NEW.status
        WHEN 'ended'   THEN 'session.ended'
        WHEN 'expired' THEN 'session.expired'
        ELSE 'session.status_changed'
      END;

      PERFORM insert_audit_log(
        NEW.cafe_id,
        v_event_type,
        'table_sessions',
        NEW.id,
        to_jsonb(OLD),
        to_jsonb(NEW),
        jsonb_changed_fields(to_jsonb(OLD), to_jsonb(NEW))
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_table_sessions_trigger
  AFTER INSERT OR UPDATE ON table_sessions
  FOR EACH ROW EXECUTE FUNCTION audit_table_sessions();


-- ============================================================
-- TRIGGER: ORDERS — approvals, rejections, status changes
-- ============================================================

CREATE OR REPLACE FUNCTION audit_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM insert_audit_log(
      NEW.cafe_id, 'order.created', 'orders', NEW.id,
      NULL, to_jsonb(NEW), NULL
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    v_event_type := CASE NEW.status
      WHEN 'approved'    THEN 'order.approved'
      WHEN 'cancelled'   THEN 'order.rejected'    -- cancelled by staff = rejection
      WHEN 'in_kitchen'  THEN 'order.in_kitchen'
      WHEN 'ready'       THEN 'order.ready'
      WHEN 'served'      THEN 'order.served'
      ELSE 'order.status_changed'
    END;

    PERFORM insert_audit_log(
      NEW.cafe_id,
      v_event_type,
      'orders',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW),
      jsonb_changed_fields(to_jsonb(OLD), to_jsonb(NEW))
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_orders_trigger
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION audit_orders();


-- ============================================================
-- TRIGGER: MENU_ITEMS — created, updated, availability changed, deleted
-- ============================================================

CREATE OR REPLACE FUNCTION audit_menu_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_type    text;
  v_changed       text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM insert_audit_log(
      NEW.cafe_id, 'menu_item.created', 'menu_items', NEW.id,
      NULL, to_jsonb(NEW), NULL
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_changed := jsonb_changed_fields(to_jsonb(OLD), to_jsonb(NEW));

    -- Specific event for toggling availability (most common action)
    IF 'is_available' = ANY(v_changed) AND array_length(v_changed, 1) = 1 THEN
      v_event_type := 'menu_item.availability_changed';
    ELSE
      v_event_type := 'menu_item.updated';
    END IF;

    PERFORM insert_audit_log(
      NEW.cafe_id, v_event_type, 'menu_items', NEW.id,
      to_jsonb(OLD), to_jsonb(NEW), v_changed
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM insert_audit_log(
      OLD.cafe_id, 'menu_item.deleted', 'menu_items', OLD.id,
      to_jsonb(OLD), NULL, NULL
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_menu_items_trigger
  AFTER INSERT OR UPDATE OR DELETE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION audit_menu_items();


-- ============================================================
-- TRIGGER: MENU_CATEGORIES
-- ============================================================

CREATE OR REPLACE FUNCTION audit_menu_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM insert_audit_log(
      NEW.cafe_id, 'menu_category.created', 'menu_categories', NEW.id,
      NULL, to_jsonb(NEW), NULL
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM insert_audit_log(
      NEW.cafe_id, 'menu_category.updated', 'menu_categories', NEW.id,
      to_jsonb(OLD), to_jsonb(NEW),
      jsonb_changed_fields(to_jsonb(OLD), to_jsonb(NEW))
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM insert_audit_log(
      OLD.cafe_id, 'menu_category.deleted', 'menu_categories', OLD.id,
      to_jsonb(OLD), NULL, NULL
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_menu_categories_trigger
  AFTER INSERT OR UPDATE OR DELETE ON menu_categories
  FOR EACH ROW EXECUTE FUNCTION audit_menu_categories();


-- ============================================================
-- TRIGGER: BOOKINGS — created, confirmed, cancelled, no_show
-- ============================================================

CREATE OR REPLACE FUNCTION audit_bookings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM insert_audit_log(
      NEW.cafe_id, 'booking.created', 'bookings', NEW.id,
      NULL, to_jsonb(NEW), NULL
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Named events for status transitions
    IF NEW.status <> OLD.status THEN
      v_event_type := CASE NEW.status
        WHEN 'confirmed'  THEN 'booking.confirmed'
        WHEN 'cancelled'  THEN 'booking.cancelled'
        WHEN 'seated'     THEN 'booking.seated'
        WHEN 'no_show'    THEN 'booking.no_show'
        ELSE 'booking.updated'
      END;
    ELSE
      v_event_type := 'booking.updated';
    END IF;

    PERFORM insert_audit_log(
      NEW.cafe_id, v_event_type, 'bookings', NEW.id,
      to_jsonb(OLD), to_jsonb(NEW),
      jsonb_changed_fields(to_jsonb(OLD), to_jsonb(NEW))
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM insert_audit_log(
      OLD.cafe_id, 'booking.deleted', 'bookings', OLD.id,
      to_jsonb(OLD), NULL, NULL
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_bookings_trigger
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION audit_bookings();


-- ============================================================
-- TRIGGER: STAFF_USERS — created, role changes, deactivation
-- ============================================================

CREATE OR REPLACE FUNCTION audit_staff_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_type    text;
  v_changed       text[];
  v_old_safe      jsonb;
  v_new_safe      jsonb;
BEGIN
  -- Scrub pin_hash from audit data — never log credential material
  v_old_safe := CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE'
                THEN to_jsonb(OLD) - 'pin_hash'
                ELSE NULL END;

  v_new_safe := CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE'
                THEN to_jsonb(NEW) - 'pin_hash'
                ELSE NULL END;

  IF TG_OP = 'INSERT' THEN
    PERFORM insert_audit_log(
      NEW.cafe_id, 'staff.created', 'staff_users', NEW.id,
      NULL, v_new_safe, NULL
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_changed := jsonb_changed_fields(
      to_jsonb(OLD) - 'pin_hash' - 'updated_at',
      to_jsonb(NEW) - 'pin_hash' - 'updated_at'
    );

    -- Only log if something meaningful changed
    IF array_length(v_changed, 1) > 0 THEN
      -- Named events for the most significant changes
      IF 'is_active' = ANY(v_changed) AND NOT NEW.is_active THEN
        v_event_type := 'staff.deactivated';
      ELSIF 'is_active' = ANY(v_changed) AND NEW.is_active THEN
        v_event_type := 'staff.reactivated';
      ELSIF 'role' = ANY(v_changed) THEN
        v_event_type := 'staff.role_changed';
      ELSIF v_changed = ARRAY['pin_hash'] THEN
        -- If ONLY pin_hash changed, log a scrubbed event (no data)
        PERFORM insert_audit_log(
          NEW.cafe_id, 'staff.pin_changed', 'staff_users', NEW.id,
          NULL, NULL,  -- deliberately no data for credential changes
          ARRAY['pin_hash']
        );
        RETURN NEW;
      ELSE
        v_event_type := 'staff.updated';
      END IF;

      PERFORM insert_audit_log(
        NEW.cafe_id, v_event_type, 'staff_users', NEW.id,
        v_old_safe, v_new_safe, v_changed
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM insert_audit_log(
      OLD.cafe_id, 'staff.deleted', 'staff_users', OLD.id,
      v_old_safe, NULL, NULL
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_staff_users_trigger
  AFTER INSERT OR UPDATE OR DELETE ON staff_users
  FOR EACH ROW EXECUTE FUNCTION audit_staff_users();


-- ============================================================
-- TRIGGER: BILL_REQUESTS — acknowledged
-- ============================================================

CREATE OR REPLACE FUNCTION audit_bill_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM insert_audit_log(
      NEW.cafe_id, 'bill_request.created', 'bill_requests', NEW.id,
      NULL, to_jsonb(NEW), NULL
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    PERFORM insert_audit_log(
      NEW.cafe_id, 'bill_request.acknowledged', 'bill_requests', NEW.id,
      to_jsonb(OLD), to_jsonb(NEW),
      jsonb_changed_fields(to_jsonb(OLD), to_jsonb(NEW))
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_bill_requests_trigger
  AFTER INSERT OR UPDATE ON bill_requests
  FOR EACH ROW EXECUTE FUNCTION audit_bill_requests();
