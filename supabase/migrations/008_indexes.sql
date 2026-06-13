-- ============================================================
-- Migration 008: Indexes
-- Cafe Maestro Platform
-- ============================================================
-- All performance-critical query paths are indexed here.
-- Naming: idx_{table}_{columns}

-- ------------------------------------
-- cafes
-- ------------------------------------

CREATE INDEX idx_cafes_slug
  ON cafes (slug);

CREATE INDEX idx_cafes_is_active
  ON cafes (is_active)
  WHERE is_active = true;

-- ------------------------------------
-- cafe_tables
-- ------------------------------------

CREATE INDEX idx_cafe_tables_cafe_id
  ON cafe_tables (cafe_id);

CREATE INDEX idx_cafe_tables_qr_code_token
  ON cafe_tables (qr_code_token);                        -- QR scan lookup

CREATE INDEX idx_cafe_tables_cafe_active
  ON cafe_tables (cafe_id, is_active)
  WHERE is_active = true;

-- ------------------------------------
-- table_sessions
-- ------------------------------------

-- Most common query: active sessions for a cafe (staff dashboard)
CREATE INDEX idx_table_sessions_cafe_status
  ON table_sessions (cafe_id, status);

-- Session lookup by table (check for active session before creating)
CREATE INDEX idx_table_sessions_table_status
  ON table_sessions (table_id, status);

-- Cron job: find sessions to expire
CREATE INDEX idx_table_sessions_expiry
  ON table_sessions (expires_at)
  WHERE status = 'active';

-- ------------------------------------
-- session_devices
-- ------------------------------------

-- Active device count (replaces device_count column)
CREATE INDEX idx_session_devices_session_active
  ON session_devices (session_id, is_active);

-- Auth: validate device_token on every guest request
CREATE INDEX idx_session_devices_token
  ON session_devices (device_token)
  WHERE is_active = true;

-- Cafe-level device queries for RLS
CREATE INDEX idx_session_devices_cafe
  ON session_devices (cafe_id);

-- ------------------------------------
-- menu_categories
-- ------------------------------------

CREATE INDEX idx_menu_categories_cafe_visible
  ON menu_categories (cafe_id, is_visible, position);    -- Public menu page query

-- ------------------------------------
-- menu_items
-- ------------------------------------

CREATE INDEX idx_menu_items_cafe_available
  ON menu_items (cafe_id, is_available, position);       -- Public menu page

CREATE INDEX idx_menu_items_category
  ON menu_items (category_id, position);

-- Tag filtering (e.g. guest filters by 'vegan')
CREATE INDEX idx_menu_items_tags
  ON menu_items USING GIN (tags);

-- ------------------------------------
-- orders
-- ------------------------------------

-- Staff approval queue: pending orders per cafe, newest first
CREATE INDEX idx_orders_cafe_status_created
  ON orders (cafe_id, status, created_at DESC);

-- Kitchen display: approved/in_kitchen orders
CREATE INDEX idx_orders_cafe_kitchen_statuses
  ON orders (cafe_id, status)
  WHERE status IN ('approved', 'in_kitchen', 'ready');

-- Guest order tracking: orders in this session
CREATE INDEX idx_orders_session
  ON orders (session_id, created_at DESC);

-- Validate device_token on order insert
CREATE INDEX idx_orders_device_token
  ON orders (device_token);

-- Analytics: time-based revenue queries
CREATE INDEX idx_orders_cafe_created
  ON orders (cafe_id, created_at DESC);

-- ------------------------------------
-- order_items
-- ------------------------------------

CREATE INDEX idx_order_items_order
  ON order_items (order_id);

-- Analytics: most ordered items
CREATE INDEX idx_order_items_menu_item
  ON order_items (menu_item_id);

CREATE INDEX idx_order_items_cafe
  ON order_items (cafe_id);

-- ------------------------------------
-- bill_requests
-- ------------------------------------

-- Staff bill queue: pending requests per cafe
CREATE INDEX idx_bill_requests_cafe_status
  ON bill_requests (cafe_id, status, requested_at DESC);

CREATE INDEX idx_bill_requests_session
  ON bill_requests (session_id);

-- ------------------------------------
-- bookings
-- ------------------------------------

-- Staff booking management: upcoming bookings per cafe
CREATE INDEX idx_bookings_cafe_date
  ON bookings (cafe_id, booking_date, booking_time);

CREATE INDEX idx_bookings_cafe_status
  ON bookings (cafe_id, status);

CREATE INDEX idx_bookings_table
  ON bookings (table_id, booking_date)
  WHERE table_id IS NOT NULL;

-- ------------------------------------
-- reviews
-- ------------------------------------

-- Public reviews page: visible, newest first
CREATE INDEX idx_reviews_cafe_visible
  ON reviews (cafe_id, is_visible, created_at DESC);

-- Moderation queue
CREATE INDEX idx_reviews_cafe_pending
  ON reviews (cafe_id, created_at DESC)
  WHERE is_visible = false;

-- ------------------------------------
-- gallery_images
-- ------------------------------------

CREATE INDEX idx_gallery_images_cafe_visible
  ON gallery_images (cafe_id, is_visible, position);

-- ------------------------------------
-- offers
-- ------------------------------------

CREATE INDEX idx_offers_cafe_active
  ON offers (cafe_id, is_active, valid_until);

CREATE INDEX idx_offers_applies_to_items
  ON offers USING GIN (applies_to_items)
  WHERE applies_to_items IS NOT NULL;

-- ------------------------------------
-- staff_users
-- ------------------------------------

CREATE INDEX idx_staff_users_cafe_role
  ON staff_users (cafe_id, role);

CREATE INDEX idx_staff_users_cafe_active
  ON staff_users (cafe_id, is_active)
  WHERE is_active = true;
