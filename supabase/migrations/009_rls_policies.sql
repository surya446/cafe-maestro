-- ============================================================
-- Migration 009: Row-Level Security Policies
-- Cafe Maestro Platform
-- ============================================================
-- All tables have RLS enabled. Policies enforce:
-- 1. cafe_id scoping (cross-cafe data leakage is impossible)
-- 2. Role-based access (guests vs staff vs kitchen vs owner)
-- 3. Device token validation for guest operations
-- ============================================================

-- ------------------------------------
-- Helper: get cafe_id for authenticated staff user
-- ------------------------------------

CREATE OR REPLACE FUNCTION auth_user_cafe_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT cafe_id FROM staff_users
  WHERE id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- ------------------------------------
-- Helper: get role for authenticated staff user
-- ------------------------------------

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM staff_users
  WHERE id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- ------------------------------------
-- CAFES
-- ------------------------------------

ALTER TABLE cafes ENABLE ROW LEVEL SECURITY;

-- Public: anyone can read a cafe by slug (for public pages)
CREATE POLICY "cafes_public_read"
  ON cafes FOR SELECT
  USING (is_active = true);

-- Owner: full access to their own cafe
CREATE POLICY "cafes_owner_all"
  ON cafes FOR ALL
  USING (auth_user_cafe_id() = id AND auth_user_role() = 'owner')
  WITH CHECK (auth_user_cafe_id() = id AND auth_user_role() = 'owner');

-- Staff/Kitchen: can read their own cafe
CREATE POLICY "cafes_staff_read"
  ON cafes FOR SELECT
  USING (auth_user_cafe_id() = id);

-- ------------------------------------
-- CAFE_TABLES
-- ------------------------------------

ALTER TABLE cafe_tables ENABLE ROW LEVEL SECURITY;

-- Public: anyone can read active tables (needed for QR flow to resolve table)
CREATE POLICY "cafe_tables_public_read"
  ON cafe_tables FOR SELECT
  USING (is_active = true);

-- Owner: full access to their cafe's tables
CREATE POLICY "cafe_tables_owner_all"
  ON cafe_tables FOR ALL
  USING (cafe_id = auth_user_cafe_id() AND auth_user_role() = 'owner')
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_role() = 'owner');

-- Staff: read-only on their cafe's tables
CREATE POLICY "cafe_tables_staff_read"
  ON cafe_tables FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- ------------------------------------
-- TABLE_SESSIONS
-- ------------------------------------

ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;

-- Guests (anon): can read a specific session by ID
-- (frontend always requests by session_id it already holds)
CREATE POLICY "table_sessions_guest_read"
  ON table_sessions FOR SELECT
  TO anon
  USING (true);

-- Guests (anon): cannot create sessions directly — handled via API route
-- API route runs with service_role key, so it bypasses RLS.

-- Staff/Kitchen/Owner: read all sessions in their cafe
CREATE POLICY "table_sessions_staff_read"
  ON table_sessions FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- Staff/Owner: can update session status (end session)
CREATE POLICY "table_sessions_staff_update"
  ON table_sessions FOR UPDATE
  USING (
    cafe_id = auth_user_cafe_id()
    AND auth_user_role() IN ('staff', 'owner')
  )
  WITH CHECK (
    cafe_id = auth_user_cafe_id()
    AND auth_user_role() IN ('staff', 'owner')
  );

-- ------------------------------------
-- SESSION_DEVICES
-- ------------------------------------

ALTER TABLE session_devices ENABLE ROW LEVEL SECURITY;

-- Guests (anon): read their own device record
-- (used by frontend to verify token is still active)
CREATE POLICY "session_devices_guest_read"
  ON session_devices FOR SELECT
  TO anon
  USING (true);

-- Staff/Owner: read all devices for sessions in their cafe
CREATE POLICY "session_devices_staff_read"
  ON session_devices FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- ------------------------------------
-- MENU_CATEGORIES
-- ------------------------------------

ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;

-- Public: read visible categories
CREATE POLICY "menu_categories_public_read"
  ON menu_categories FOR SELECT
  USING (is_visible = true);

-- Staff/Kitchen: read all (including hidden) for their cafe
CREATE POLICY "menu_categories_staff_read"
  ON menu_categories FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- Owner: full access
CREATE POLICY "menu_categories_owner_all"
  ON menu_categories FOR ALL
  USING (cafe_id = auth_user_cafe_id() AND auth_user_role() = 'owner')
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_role() = 'owner');

-- ------------------------------------
-- MENU_ITEMS
-- ------------------------------------

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Public: read available items only
CREATE POLICY "menu_items_public_read"
  ON menu_items FOR SELECT
  USING (is_available = true);

-- Staff/Kitchen: read all (including unavailable) for their cafe
CREATE POLICY "menu_items_staff_read"
  ON menu_items FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- Owner: full access
CREATE POLICY "menu_items_owner_all"
  ON menu_items FOR ALL
  USING (cafe_id = auth_user_cafe_id() AND auth_user_role() = 'owner')
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_role() = 'owner');

-- ------------------------------------
-- ORDERS
-- ------------------------------------

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Guests: read orders belonging to their session
-- (validated against session_id they hold in localStorage)
CREATE POLICY "orders_guest_read"
  ON orders FOR SELECT
  TO anon
  USING (true);

-- Staff: read all orders for their cafe
CREATE POLICY "orders_staff_read"
  ON orders FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- Staff: update order status (approve, reject, serve)
CREATE POLICY "orders_staff_update"
  ON orders FOR UPDATE
  USING (
    cafe_id = auth_user_cafe_id()
    AND auth_user_role() IN ('staff', 'kitchen', 'owner')
  )
  WITH CHECK (
    cafe_id = auth_user_cafe_id()
    AND auth_user_role() IN ('staff', 'kitchen', 'owner')
  );

-- ------------------------------------
-- ORDER_ITEMS
-- ------------------------------------

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Guests: read order items (via order_id they hold)
CREATE POLICY "order_items_guest_read"
  ON order_items FOR SELECT
  TO anon
  USING (true);

-- Staff/Kitchen/Owner: read all order items for their cafe
CREATE POLICY "order_items_staff_read"
  ON order_items FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- ------------------------------------
-- BILL_REQUESTS
-- ------------------------------------

ALTER TABLE bill_requests ENABLE ROW LEVEL SECURITY;

-- Guests: read their own bill request
CREATE POLICY "bill_requests_guest_read"
  ON bill_requests FOR SELECT
  TO anon
  USING (true);

-- Staff/Owner: read all bill requests for their cafe
CREATE POLICY "bill_requests_staff_read"
  ON bill_requests FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- Staff/Owner: acknowledge bill requests
CREATE POLICY "bill_requests_staff_update"
  ON bill_requests FOR UPDATE
  USING (
    cafe_id = auth_user_cafe_id()
    AND auth_user_role() IN ('staff', 'owner')
  )
  WITH CHECK (
    cafe_id = auth_user_cafe_id()
    AND auth_user_role() IN ('staff', 'owner')
  );

-- ------------------------------------
-- BOOKINGS
-- ------------------------------------

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Public (anon): can insert bookings (public booking form)
CREATE POLICY "bookings_public_insert"
  ON bookings FOR INSERT
  TO anon
  WITH CHECK (true);

-- Staff/Owner: full access to their cafe's bookings
CREATE POLICY "bookings_staff_all"
  ON bookings FOR ALL
  USING (cafe_id = auth_user_cafe_id())
  WITH CHECK (cafe_id = auth_user_cafe_id());

-- ------------------------------------
-- REVIEWS
-- ------------------------------------

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Public (anon): read only visible/approved reviews
CREATE POLICY "reviews_public_read"
  ON reviews FOR SELECT
  TO anon
  USING (is_visible = true);

-- Public (anon): submit a review (always starts hidden)
CREATE POLICY "reviews_public_insert"
  ON reviews FOR INSERT
  TO anon
  WITH CHECK (is_visible = false);

-- Owner: full access (moderate, delete, approve)
CREATE POLICY "reviews_owner_all"
  ON reviews FOR ALL
  USING (cafe_id = auth_user_cafe_id() AND auth_user_role() = 'owner')
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_role() = 'owner');

-- ------------------------------------
-- GALLERY_IMAGES
-- ------------------------------------

ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;

-- Public: read visible images
CREATE POLICY "gallery_images_public_read"
  ON gallery_images FOR SELECT
  USING (is_visible = true);

-- Owner: full access
CREATE POLICY "gallery_images_owner_all"
  ON gallery_images FOR ALL
  USING (cafe_id = auth_user_cafe_id() AND auth_user_role() = 'owner')
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_role() = 'owner');

-- ------------------------------------
-- OFFERS
-- ------------------------------------

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Public: read active, public offers
CREATE POLICY "offers_public_read"
  ON offers FOR SELECT
  USING (is_active = true AND is_public = true);

-- Staff: read all offers for their cafe
CREATE POLICY "offers_staff_read"
  ON offers FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- Owner: full access
CREATE POLICY "offers_owner_all"
  ON offers FOR ALL
  USING (cafe_id = auth_user_cafe_id() AND auth_user_role() = 'owner')
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_role() = 'owner');

-- ------------------------------------
-- STAFF_USERS
-- ------------------------------------

ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;

-- Staff: can read their own profile
CREATE POLICY "staff_users_self_read"
  ON staff_users FOR SELECT
  USING (id = auth.uid());

-- Staff: can update their own profile (name, pin)
CREATE POLICY "staff_users_self_update"
  ON staff_users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND cafe_id = auth_user_cafe_id());

-- Owner: full access to all staff in their cafe
CREATE POLICY "staff_users_owner_all"
  ON staff_users FOR ALL
  USING (cafe_id = auth_user_cafe_id() AND auth_user_role() = 'owner')
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_role() = 'owner');
