-- ============================================================
-- Migration 010: Realtime Configuration
-- Cafe Maestro Platform
-- ============================================================
-- Supabase Realtime is configured at the publication level.
-- Tables added here emit database change events that clients
-- can subscribe to via Supabase Realtime channels.
--
-- Channel strategy (defined in lib/realtime/channels.ts):
--   session:{sessionId}    → guest devices (order status, session end)
--   staff:{cafeId}         → staff dashboard (new orders, bill requests)
--   kitchen:{cafeId}       → kitchen display (approved orders)
--   admin:{cafeId}         → owner dashboard (analytics events)
--   devices:{sessionId}    → staff table map (device joins/leaves)
--
-- FREE TIER NOTE:
-- ALTER PUBLICATION statements are intentionally omitted here.
-- Supabase owns and manages the supabase_realtime publication.
-- Enable Realtime on each table via the Supabase Dashboard:
--   Database → Replication → supabase_realtime → toggle each table
--
-- Tables to enable:
--   orders, order_items, table_sessions, session_devices,
--   bill_requests, menu_items, menu_categories
-- ============================================================

-- ------------------------------------
-- Realtime broadcast triggers
-- ------------------------------------
-- For complex multi-table events (e.g. session ended → invalidate
-- all devices), we use Supabase Broadcast via pg_notify so the
-- API route can fan out to multiple channels atomically.

CREATE OR REPLACE FUNCTION notify_session_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    PERFORM pg_notify(
      'session_status_change',
      json_build_object(
        'session_id',  NEW.id,
        'cafe_id',     NEW.cafe_id,
        'table_id',    NEW.table_id,
        'old_status',  OLD.status,
        'new_status',  NEW.status,
        'ended_by',    NEW.ended_by,
        'ended_at',    NEW.ended_at
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_session_status_change
  AFTER UPDATE ON table_sessions
  FOR EACH ROW
  EXECUTE FUNCTION notify_session_status_change();

-- ------------------------------------
-- Trigger: notify staff on new order
-- ------------------------------------

CREATE OR REPLACE FUNCTION notify_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify(
    'new_order',
    json_build_object(
      'order_id',    NEW.id,
      'cafe_id',     NEW.cafe_id,
      'session_id',  NEW.session_id,
      'table_id',    NEW.table_id,
      'status',      NEW.status,
      'created_at',  NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_order();

-- ------------------------------------
-- Trigger: notify on bill request
-- ------------------------------------

CREATE OR REPLACE FUNCTION notify_bill_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify(
    'bill_request',
    json_build_object(
      'request_id',    NEW.id,
      'cafe_id',       NEW.cafe_id,
      'session_id',    NEW.session_id,
      'table_id',      NEW.table_id,
      'status',        NEW.status,
      'requested_at',  NEW.requested_at
    )::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_bill_request
  AFTER INSERT OR UPDATE ON bill_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_bill_request();
