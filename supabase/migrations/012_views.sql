-- ============================================================
-- Migration 012: Convenience Views
-- Cafe Maestro Platform
-- ============================================================
-- Views that pre-join common query patterns.
-- Used by the API layer and analytics.
-- All views respect the underlying table RLS through SECURITY INVOKER.
--
-- FREE TIER SESSION EXPIRY:
-- active_sessions_with_devices filters expires_at > NOW() in addition
-- to status = 'active'. This ensures logically-expired sessions
-- (whose status column hasn't been transitioned yet) never appear
-- on the staff dashboard, even without a background job.
-- ============================================================

-- ------------------------------------
-- Active sessions with device count
-- ------------------------------------
-- Used by the staff dashboard table map.
-- Shows exactly how many devices are currently active per session.
-- Dual guard: status = 'active' AND expires_at > NOW()

CREATE OR REPLACE VIEW active_sessions_with_devices AS
SELECT
  ts.id                                           AS session_id,
  ts.cafe_id,
  ts.table_id,
  ts.status,
  ts.started_at,
  ts.expires_at,
  ct.number                                       AS table_number,
  ct.name                                         AS table_name,
  ct.capacity,
  COUNT(sd.id) FILTER (WHERE sd.is_active = true) AS active_device_count,
  COUNT(sd.id)                                    AS total_device_count
FROM table_sessions ts
JOIN cafe_tables ct ON ct.id = ts.table_id
LEFT JOIN session_devices sd ON sd.session_id = ts.id
WHERE ts.status = 'active'
  AND ts.expires_at > NOW()   -- Free Tier guard: hide logically-expired sessions
GROUP BY ts.id, ts.cafe_id, ts.table_id, ts.status,
         ts.started_at, ts.expires_at,
         ct.number, ct.name, ct.capacity;

COMMENT ON VIEW active_sessions_with_devices IS
  'Staff dashboard: active sessions with live device counts.
   Filters status=active AND expires_at > NOW() — logically-expired sessions
   are excluded even if their status column has not yet been transitioned.
   device_count is always computed — never stored.';

-- ------------------------------------
-- Orders with table and session info
-- ------------------------------------
-- Used by the approval queue and kitchen display.

CREATE OR REPLACE VIEW orders_with_context AS
SELECT
  o.id                  AS order_id,
  o.cafe_id,
  o.session_id,
  o.status,
  o.device_token,
  o.staff_note,
  o.created_at,
  o.approved_at,
  o.approved_by,
  ct.number             AS table_number,
  ct.name               AS table_name,
  COUNT(oi.id)          AS item_count,
  SUM(oi.quantity * oi.unit_price) AS order_total
FROM orders o
JOIN cafe_tables ct ON ct.id = o.table_id
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id, o.cafe_id, o.session_id, o.status,
         o.device_token, o.staff_note, o.created_at,
         o.approved_at, o.approved_by,
         ct.number, ct.name;

COMMENT ON VIEW orders_with_context IS
  'Enriches orders with table info and computed totals. Used by staff approval queue and kitchen display.';

-- ------------------------------------
-- Pending bill requests with context
-- ------------------------------------

CREATE OR REPLACE VIEW pending_bill_requests AS
SELECT
  br.id                 AS request_id,
  br.cafe_id,
  br.session_id,
  br.status,
  br.requested_at,
  ct.number             AS table_number,
  ct.name               AS table_name,
  -- Time since request (for urgency indicators in staff UI)
  EXTRACT(EPOCH FROM (NOW() - br.requested_at)) AS seconds_waiting
FROM bill_requests br
JOIN cafe_tables ct ON ct.id = br.table_id
WHERE br.status = 'pending'
ORDER BY br.requested_at ASC;

COMMENT ON VIEW pending_bill_requests IS
  'Staff bill request queue with table info and wait time in seconds.';

-- ------------------------------------
-- Revenue summary per cafe (owner analytics)
-- ------------------------------------

CREATE OR REPLACE VIEW revenue_summary AS
SELECT
  o.cafe_id,
  DATE_TRUNC('day', o.created_at)     AS day,
  COUNT(DISTINCT o.id)                AS order_count,
  COUNT(DISTINCT o.session_id)        AS session_count,
  SUM(oi.quantity * oi.unit_price)    AS gross_revenue,
  AVG(oi.quantity * oi.unit_price)    AS avg_order_value
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status IN ('served', 'ready')  -- Only count completed orders
GROUP BY o.cafe_id, DATE_TRUNC('day', o.created_at);

COMMENT ON VIEW revenue_summary IS
  'Daily revenue aggregates per cafe. Only counts served/ready orders. Used by owner analytics dashboard.';

-- ------------------------------------
-- Top menu items per cafe
-- ------------------------------------

CREATE OR REPLACE VIEW top_menu_items AS
SELECT
  oi.cafe_id,
  oi.menu_item_id,
  mi.name                           AS item_name,
  mc.name                           AS category_name,
  SUM(oi.quantity)                  AS total_ordered,
  SUM(oi.quantity * oi.unit_price)  AS total_revenue,
  COUNT(DISTINCT oi.order_id)       AS appears_in_orders
FROM order_items oi
JOIN menu_items mi ON mi.id = oi.menu_item_id
JOIN menu_categories mc ON mc.id = mi.category_id
JOIN orders o ON o.id = oi.order_id
WHERE o.status IN ('served', 'ready')
GROUP BY oi.cafe_id, oi.menu_item_id, mi.name, mc.name
ORDER BY total_ordered DESC;

COMMENT ON VIEW top_menu_items IS
  'Ranking of most ordered menu items per cafe. Used by owner analytics.';
