-- ============================================================
-- Migration 017: Permission Matrix View
-- Cafe Maestro Platform
-- ============================================================
-- A single queryable view that codifies every permission in
-- the system. Used by:
--   1. The Next.js middleware for route protection checks
--   2. The admin staff management UI to show permission labels
--   3. Future mobile apps — same query, same truth
-- ============================================================

CREATE TABLE permissions (
  id          serial        PRIMARY KEY,
  permission  text          NOT NULL UNIQUE,
  description text          NOT NULL
);

INSERT INTO permissions (permission, description) VALUES
  -- Session management
  ('sessions.read',        'View table sessions and active device counts'),
  ('sessions.end',         'Manually end a table session'),

  -- Order management
  ('orders.read',          'View all orders in the cafe'),
  ('orders.approve',       'Approve a pending order (send to kitchen)'),
  ('orders.reject',        'Reject a pending order with a reason'),
  ('orders.mark_served',   'Mark a ready order as served'),
  ('orders.kitchen_update','Update kitchen status: in_kitchen → ready'),

  -- Bill requests
  ('bill_requests.read',   'View the bill request queue'),
  ('bill_requests.acknowledge', 'Acknowledge a guest bill request'),

  -- Menu
  ('menu.read_hidden',     'Read unavailable/hidden menu items and categories'),
  ('menu.write',           'Create and edit menu items and categories'),
  ('menu.delete',          'Permanently delete menu items'),

  -- Tables & QR
  ('tables.write',         'Add, edit tables and regenerate QR codes'),
  ('tables.delete',        'Remove tables'),

  -- Bookings
  ('bookings.read',        'View booking list'),
  ('bookings.manage',      'Confirm, cancel, seat bookings'),
  ('bookings.delete',      'Delete bookings'),

  -- Reviews
  ('reviews.moderate',     'Approve or hide customer reviews'),
  ('reviews.delete',       'Permanently delete reviews'),

  -- Gallery & offers
  ('gallery.write',        'Upload and manage gallery images'),
  ('offers.write',         'Create and manage promotional offers'),

  -- Staff management
  ('staff.read',           'View all staff accounts in the cafe'),
  ('staff.create',         'Create new staff accounts'),
  ('staff.manage',         'Deactivate, edit roles of non-owner staff'),
  ('staff.manage_owners',  'Create and manage owner accounts'),
  ('staff.delete',         'Permanently delete staff accounts'),

  -- Analytics & audit
  ('analytics.read',       'View revenue, order, and session analytics'),
  ('audit_logs.read',      'View the full audit trail'),
  ('audit_logs.read_operations', 'View operational audit events (no staff changes)'),

  -- Cafe settings
  ('settings.write',       'Edit cafe name, hours, contact, social links');

-- ------------------------------------
-- Role → Permission assignments
-- ------------------------------------

CREATE TABLE role_permissions (
  role        text  NOT NULL,
  permission  text  NOT NULL REFERENCES permissions(permission),
  PRIMARY KEY (role, permission)
);

INSERT INTO role_permissions (role, permission) VALUES
  -- CHEF ─────────────────────────────────────────────────────
  ('chef', 'orders.read'),
  ('chef', 'orders.kitchen_update'),
  ('chef', 'menu.read_hidden'),

  -- STAFF ────────────────────────────────────────────────────
  -- (inherits chef capabilities + the following)
  ('staff', 'orders.read'),
  ('staff', 'orders.approve'),
  ('staff', 'orders.reject'),
  ('staff', 'orders.mark_served'),
  ('staff', 'orders.kitchen_update'),
  ('staff', 'menu.read_hidden'),
  ('staff', 'sessions.read'),
  ('staff', 'sessions.end'),
  ('staff', 'bill_requests.read'),
  ('staff', 'bill_requests.acknowledge'),
  ('staff', 'bookings.read'),
  ('staff', 'bookings.manage'),

  -- MANAGER ──────────────────────────────────────────────────
  -- (inherits staff capabilities + the following)
  ('manager', 'orders.read'),
  ('manager', 'orders.approve'),
  ('manager', 'orders.reject'),
  ('manager', 'orders.mark_served'),
  ('manager', 'orders.kitchen_update'),
  ('manager', 'menu.read_hidden'),
  ('manager', 'menu.write'),
  ('manager', 'sessions.read'),
  ('manager', 'sessions.end'),
  ('manager', 'bill_requests.read'),
  ('manager', 'bill_requests.acknowledge'),
  ('manager', 'bookings.read'),
  ('manager', 'bookings.manage'),
  ('manager', 'bookings.delete'),
  ('manager', 'reviews.moderate'),
  ('manager', 'gallery.write'),
  ('manager', 'offers.write'),
  ('manager', 'tables.write'),
  ('manager', 'staff.read'),
  ('manager', 'staff.create'),
  ('manager', 'staff.manage'),
  ('manager', 'analytics.read'),
  ('manager', 'audit_logs.read_operations'),

  -- OWNER ────────────────────────────────────────────────────
  -- (all permissions)
  ('owner', 'orders.read'),
  ('owner', 'orders.approve'),
  ('owner', 'orders.reject'),
  ('owner', 'orders.mark_served'),
  ('owner', 'orders.kitchen_update'),
  ('owner', 'menu.read_hidden'),
  ('owner', 'menu.write'),
  ('owner', 'menu.delete'),
  ('owner', 'sessions.read'),
  ('owner', 'sessions.end'),
  ('owner', 'bill_requests.read'),
  ('owner', 'bill_requests.acknowledge'),
  ('owner', 'bookings.read'),
  ('owner', 'bookings.manage'),
  ('owner', 'bookings.delete'),
  ('owner', 'reviews.moderate'),
  ('owner', 'reviews.delete'),
  ('owner', 'gallery.write'),
  ('owner', 'offers.write'),
  ('owner', 'tables.write'),
  ('owner', 'tables.delete'),
  ('owner', 'staff.read'),
  ('owner', 'staff.create'),
  ('owner', 'staff.manage'),
  ('owner', 'staff.manage_owners'),
  ('owner', 'staff.delete'),
  ('owner', 'analytics.read'),
  ('owner', 'audit_logs.read'),
  ('owner', 'settings.write');

-- ------------------------------------
-- Convenience view: does a given role have a permission?
-- ------------------------------------

CREATE OR REPLACE VIEW role_permission_matrix AS
SELECT
  rc.role,
  rc.label                         AS role_label,
  rc.sort_order,
  p.permission,
  p.description,
  (rp.permission IS NOT NULL)      AS has_permission
FROM role_capabilities rc
CROSS JOIN permissions p
LEFT JOIN role_permissions rp
  ON rp.role = rc.role
  AND rp.permission = p.permission
ORDER BY rc.sort_order, p.permission;

COMMENT ON VIEW role_permission_matrix IS
  'Full cross-product of roles and permissions. has_permission=true means the role has that permission. Used to render the permission matrix UI in staff management.';
