-- ============================================================
-- Migration 014: Audit Log Views
-- Cafe Maestro Platform
-- ============================================================
-- Convenience views on top of audit_logs for the owner
-- admin dashboard and the staff activity panel.
-- ============================================================

-- ------------------------------------
-- Full audit feed for owner (enriched)
-- ------------------------------------
-- The primary view for the Admin → Audit Log page.
-- Joins actor name from staff_users where available.

CREATE OR REPLACE VIEW audit_feed AS
SELECT
  al.id,
  al.cafe_id,
  al.event_type,
  al.entity_table,
  al.entity_id,
  al.actor_type,
  al.actor_id,

  -- Resolve staff name when actor is a known staff member
  CASE
    WHEN al.actor_type = 'staff'
    THEN su.full_name
    ELSE NULL
  END                               AS actor_name,

  CASE
    WHEN al.actor_type = 'staff'
    THEN su.role
    ELSE NULL
  END                               AS actor_role,

  al.changed_fields,
  al.old_data,
  al.new_data,
  al.metadata,
  al.created_at

FROM audit_logs al
LEFT JOIN staff_users su
  ON su.id::text = al.actor_id
  AND al.actor_type = 'staff'
ORDER BY al.created_at DESC;

COMMENT ON VIEW audit_feed IS
  'Enriched audit log for owner dashboard. Resolves actor_id to staff name/role where available.';

-- ------------------------------------
-- Session event history
-- ------------------------------------
-- Used on the admin session detail page.

CREATE OR REPLACE VIEW session_audit_history AS
SELECT
  al.id,
  al.cafe_id,
  al.entity_id                     AS session_id,
  al.event_type,
  al.actor_type,
  al.actor_id,
  su.full_name                     AS actor_name,
  al.old_data  -> 'status'         AS old_status,
  al.new_data  -> 'status'         AS new_status,
  al.created_at
FROM audit_logs al
LEFT JOIN staff_users su
  ON su.id::text = al.actor_id
  AND al.actor_type = 'staff'
WHERE al.entity_table = 'table_sessions'
ORDER BY al.created_at DESC;

COMMENT ON VIEW session_audit_history IS
  'Session lifecycle events: started, ended, expired. Used on session detail pages.';

-- ------------------------------------
-- Order audit history
-- ------------------------------------
-- Used on the order detail drawer to show approval/rejection timeline.

CREATE OR REPLACE VIEW order_audit_history AS
SELECT
  al.id,
  al.cafe_id,
  al.entity_id                     AS order_id,
  al.event_type,
  al.actor_type,
  al.actor_id,
  su.full_name                     AS actor_name,
  al.old_data  -> 'status'         AS old_status,
  al.new_data  -> 'status'         AS new_status,
  al.new_data  -> 'staff_note'     AS staff_note,
  al.created_at
FROM audit_logs al
LEFT JOIN staff_users su
  ON su.id::text = al.actor_id
  AND al.actor_type = 'staff'
WHERE al.entity_table = 'orders'
ORDER BY al.created_at DESC;

COMMENT ON VIEW order_audit_history IS
  'Order lifecycle events with actor name. Used in the order detail panel.';

-- ------------------------------------
-- Staff activity log (owner only)
-- ------------------------------------
-- Shows what each staff member has done: approvals, rejections,
-- session endings, bill acknowledgements, etc.

CREATE OR REPLACE VIEW staff_activity_log AS
SELECT
  al.id,
  al.cafe_id,
  al.actor_id,
  su.full_name                     AS staff_name,
  su.role                          AS staff_role,
  al.event_type,
  al.entity_table,
  al.entity_id,
  al.created_at
FROM audit_logs al
JOIN staff_users su
  ON su.id::text = al.actor_id
WHERE al.actor_type = 'staff'
ORDER BY al.created_at DESC;

COMMENT ON VIEW staff_activity_log IS
  'Owner view: all actions taken by staff members. Useful for accountability and shift reviews.';

-- ------------------------------------
-- Menu change history
-- ------------------------------------
-- Shows every menu edit, creation, deletion, and availability toggle.

CREATE OR REPLACE VIEW menu_change_history AS
SELECT
  al.id,
  al.cafe_id,
  al.event_type,
  al.entity_table,
  al.entity_id,
  al.actor_type,
  al.actor_id,
  su.full_name                     AS actor_name,
  al.old_data  ->> 'name'          AS item_name,
  al.old_data  -> 'price'          AS old_price,
  al.new_data  -> 'price'          AS new_price,
  al.old_data  -> 'is_available'   AS old_availability,
  al.new_data  -> 'is_available'   AS new_availability,
  al.changed_fields,
  al.created_at
FROM audit_logs al
LEFT JOIN staff_users su
  ON su.id::text = al.actor_id
  AND al.actor_type = 'staff'
WHERE al.entity_table IN ('menu_items', 'menu_categories')
ORDER BY al.created_at DESC;

COMMENT ON VIEW menu_change_history IS
  'History of all menu edits, additions, deletions and availability toggles. Useful for auditing price changes.';

-- ------------------------------------
-- Booking event history
-- ------------------------------------

CREATE OR REPLACE VIEW booking_audit_history AS
SELECT
  al.id,
  al.cafe_id,
  al.entity_id                     AS booking_id,
  al.event_type,
  al.actor_type,
  su.full_name                     AS actor_name,
  al.old_data  ->> 'status'        AS old_status,
  al.new_data  ->> 'status'        AS new_status,
  al.changed_fields,
  al.created_at
FROM audit_logs al
LEFT JOIN staff_users su
  ON su.id::text = al.actor_id
  AND al.actor_type = 'staff'
WHERE al.entity_table = 'bookings'
ORDER BY al.created_at DESC;

COMMENT ON VIEW booking_audit_history IS
  'History of all booking status changes: confirmed, cancelled, seated, no_show.';
