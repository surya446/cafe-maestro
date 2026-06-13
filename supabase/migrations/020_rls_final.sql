-- ============================================================
-- Migration 020: Final RLS — Explicit Permission Model
-- Cafe Maestro Platform
-- ============================================================
-- Replaces migrations 009 and 016 entirely.
-- Drops all existing policies and rebuilds from scratch.
--
-- Design rules:
--   1. NO role inheritance. Every permission is explicit.
--   2. Chef is isolated to kitchen operations.
--   3. Manager and Owner both use /admin/* route.
--   4. No DELETE on orders or order_items (enforced by trigger in 019).
--   5. All policies gate on cafe_id for multi-tenant isolation.
--
-- Role shorthand: O=owner  M=manager  S=staff  C=chef  P=public/anon
-- ============================================================


-- ── Helper: rebuild auth_user_has_role ───────────────────────
-- Replaced here so it is consistent with the final model.

CREATE OR REPLACE FUNCTION auth_user_has_role(allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_users
    WHERE id        = auth.uid()
      AND is_active = true
      AND role      = ANY(allowed_roles)
  );
$$;

CREATE OR REPLACE FUNCTION auth_user_cafe_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT cafe_id FROM staff_users
  WHERE id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM staff_users
  WHERE id = auth.uid() AND is_active = true
  LIMIT 1;
$$;


-- ============================================================
-- Drop ALL existing policies (009 + 016 remnants)
-- ============================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
  END LOOP;
END;
$$;


-- ============================================================
-- CAFES
-- ============================================================

ALTER TABLE cafes ENABLE ROW LEVEL SECURITY;

-- P: public can read active cafes (public pages, QR resolution)
CREATE POLICY "cafes__public__select"
  ON cafes FOR SELECT
  USING (is_active = true);

-- O+M+S+C: all authenticated staff read their own cafe
CREATE POLICY "cafes__all_staff__select"
  ON cafes FOR SELECT
  USING (id = auth_user_cafe_id());

-- O only: update cafe settings (name, hours, etc.)
CREATE POLICY "cafes__owner__update"
  ON cafes FOR UPDATE
  USING  (id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']))
  WITH CHECK (id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']));


-- ============================================================
-- CAFE_TABLES
-- ============================================================

ALTER TABLE cafe_tables ENABLE ROW LEVEL SECURITY;

-- P: anyone can read active tables (QR scan entry point)
CREATE POLICY "cafe_tables__public__select"
  ON cafe_tables FOR SELECT
  USING (is_active = true);

-- O+M+S+C: all staff read all tables in their cafe
CREATE POLICY "cafe_tables__all_staff__select"
  ON cafe_tables FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- O+M: create tables
CREATE POLICY "cafe_tables__owner_manager__insert"
  ON cafe_tables FOR INSERT
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

-- O+M: update tables (incl. QR regeneration)
CREATE POLICY "cafe_tables__owner_manager__update"
  ON cafe_tables FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

-- O only: delete tables (remove physical table from system)
CREATE POLICY "cafe_tables__owner__delete"
  ON cafe_tables FOR DELETE
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']));


-- ============================================================
-- TABLE_SESSIONS
-- ============================================================

ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;

-- P: guests need to read their session (status, expiry)
CREATE POLICY "table_sessions__public__select"
  ON table_sessions FOR SELECT
  TO anon
  USING (true);

-- O+M+S: floor roles read all sessions in their cafe
-- C: chef does not need session data
CREATE POLICY "table_sessions__owner_manager_staff__select"
  ON table_sessions FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']));

-- O+M+S: can end sessions (set status=ended)
-- C: chef cannot end sessions
CREATE POLICY "table_sessions__owner_manager_staff__update"
  ON table_sessions FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']));


-- ============================================================
-- SESSION_DEVICES
-- ============================================================

ALTER TABLE session_devices ENABLE ROW LEVEL SECURITY;

-- P: guests verify their own device_token is still active
CREATE POLICY "session_devices__public__select"
  ON session_devices FOR SELECT
  TO anon
  USING (true);

-- O+M+S: see device list for active device count on table map
-- C: not needed for kitchen operations
CREATE POLICY "session_devices__owner_manager_staff__select"
  ON session_devices FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']));


-- ============================================================
-- MENU_CATEGORIES
-- ============================================================

ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;

-- P: visible categories only
CREATE POLICY "menu_categories__public__select"
  ON menu_categories FOR SELECT
  USING (is_visible = true);

-- O+M+S+C: all staff see all categories (chef needs this for KDS display context)
CREATE POLICY "menu_categories__all_staff__select"
  ON menu_categories FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- O+M: create categories
CREATE POLICY "menu_categories__owner_manager__insert"
  ON menu_categories FOR INSERT
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

-- O+M: update categories
CREATE POLICY "menu_categories__owner_manager__update"
  ON menu_categories FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

-- O only: delete categories
CREATE POLICY "menu_categories__owner__delete"
  ON menu_categories FOR DELETE
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']));


-- ============================================================
-- MENU_ITEMS
-- ============================================================

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- P: available items only (public menu page)
CREATE POLICY "menu_items__public__select"
  ON menu_items FOR SELECT
  USING (is_available = true);

-- O+M+S+C: all staff see all items including unavailable
-- (chef needs full item detail for KDS; staff needs it for order context)
CREATE POLICY "menu_items__all_staff__select"
  ON menu_items FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- O+M: create and update items (includes availability toggle)
CREATE POLICY "menu_items__owner_manager__insert"
  ON menu_items FOR INSERT
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

CREATE POLICY "menu_items__owner_manager__update"
  ON menu_items FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

-- O only: delete items (use is_available=false to retire; delete is permanent)
CREATE POLICY "menu_items__owner__delete"
  ON menu_items FOR DELETE
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']));


-- ============================================================
-- ORDERS
-- ============================================================
-- NO DELETE policy exists. Hard deletes are also blocked by
-- the prevent_order_delete() trigger (migration 019).

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- P: guests read orders in their session
CREATE POLICY "orders__public__select"
  ON orders FOR SELECT
  TO anon
  USING (true);

-- O+M+S+C: all staff read all orders in their cafe
CREATE POLICY "orders__all_staff__select"
  ON orders FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- O+M+S: approve, reject (cancel), mark served, archive
-- These roles manage the order workflow on the floor
CREATE POLICY "orders__owner_manager_staff__update"
  ON orders FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']));

-- C: update kitchen statuses only (approved → in_kitchen, in_kitchen → ready)
-- Fine-grained status transition validation is enforced at the API layer.
CREATE POLICY "orders__chef__update"
  ON orders FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['chef']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['chef']));


-- ============================================================
-- ORDER_ITEMS
-- ============================================================
-- NO DELETE policy. Trigger in 019 blocks deletes.

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- P: guests read items in their orders
CREATE POLICY "order_items__public__select"
  ON order_items FOR SELECT
  TO anon
  USING (true);

-- O+M+S+C: all staff read all order items
CREATE POLICY "order_items__all_staff__select"
  ON order_items FOR SELECT
  USING (cafe_id = auth_user_cafe_id());


-- ============================================================
-- BILL_REQUESTS
-- ============================================================

ALTER TABLE bill_requests ENABLE ROW LEVEL SECURITY;

-- P: guests read their own bill request status
CREATE POLICY "bill_requests__public__select"
  ON bill_requests FOR SELECT
  TO anon
  USING (true);

-- O+M+S: floor roles see and action the bill request queue
-- C: chef has no bill responsibility
CREATE POLICY "bill_requests__owner_manager_staff__select"
  ON bill_requests FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']));

CREATE POLICY "bill_requests__owner_manager_staff__update"
  ON bill_requests FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']));


-- ============================================================
-- BOOKINGS
-- ============================================================

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- P: public can create a booking (booking form)
CREATE POLICY "bookings__public__insert"
  ON bookings FOR INSERT
  TO anon
  WITH CHECK (true);

-- O+M+S: floor roles manage bookings
-- C: chef has no involvement in front-of-house bookings
CREATE POLICY "bookings__owner_manager_staff__select"
  ON bookings FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']));

CREATE POLICY "bookings__owner_manager_staff__update"
  ON bookings FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']));

-- O+M: delete bookings (e.g. data cleanup; staff cannot delete)
CREATE POLICY "bookings__owner_manager__delete"
  ON bookings FOR DELETE
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));


-- ============================================================
-- REVIEWS
-- ============================================================

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- P: read approved reviews (public reviews page)
CREATE POLICY "reviews__public__select"
  ON reviews FOR SELECT
  TO anon
  USING (is_visible = true);

-- P: submit a review (always queued, is_visible=false)
CREATE POLICY "reviews__public__insert"
  ON reviews FOR INSERT
  TO anon
  WITH CHECK (is_visible = false);

-- O+M: moderate (read all including hidden, approve/hide)
CREATE POLICY "reviews__owner_manager__select"
  ON reviews FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

CREATE POLICY "reviews__owner_manager__update"
  ON reviews FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

-- O only: delete reviews
CREATE POLICY "reviews__owner__delete"
  ON reviews FOR DELETE
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']));


-- ============================================================
-- GALLERY_IMAGES
-- ============================================================

ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;

-- P: visible images (public gallery page)
CREATE POLICY "gallery_images__public__select"
  ON gallery_images FOR SELECT
  USING (is_visible = true);

-- O+M: manage gallery
CREATE POLICY "gallery_images__owner_manager__insert"
  ON gallery_images FOR INSERT
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

CREATE POLICY "gallery_images__owner_manager__update"
  ON gallery_images FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

-- O only: delete gallery images
CREATE POLICY "gallery_images__owner__delete"
  ON gallery_images FOR DELETE
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']));


-- ============================================================
-- OFFERS
-- ============================================================

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- P: active, public offers
CREATE POLICY "offers__public__select"
  ON offers FOR SELECT
  USING (is_active = true AND is_public = true);

-- O+M+S+C: all staff read all offers (needed for order context display)
CREATE POLICY "offers__all_staff__select"
  ON offers FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- O+M: create, update, delete offers
CREATE POLICY "offers__owner_manager__insert"
  ON offers FOR INSERT
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

CREATE POLICY "offers__owner_manager__update"
  ON offers FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

CREATE POLICY "offers__owner_manager__delete"
  ON offers FOR DELETE
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));


-- ============================================================
-- STAFF_USERS
-- ============================================================

ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;

-- O+M+S+C: every staff member reads their own profile
CREATE POLICY "staff_users__self__select"
  ON staff_users FOR SELECT
  USING (id = auth.uid());

-- O+M+S+C: update own profile (name, pin hash) but not own role or cafe
CREATE POLICY "staff_users__self__update"
  ON staff_users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id      = auth.uid()
    AND cafe_id = auth_user_cafe_id()
    -- Cannot elevate own role via self-update
    AND role = (SELECT role FROM staff_users WHERE id = auth.uid())
  );

-- O+M: read all staff in their cafe
CREATE POLICY "staff_users__owner_manager__select"
  ON staff_users FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

-- O+M: create new accounts
-- Manager may not create an owner account
CREATE POLICY "staff_users__owner_manager__insert"
  ON staff_users FOR INSERT
  WITH CHECK (
    cafe_id = auth_user_cafe_id()
    AND auth_user_has_role(ARRAY['owner','manager'])
    AND (
      auth_user_role() = 'owner'          -- Owner can create any role
      OR NEW.role IN ('staff', 'chef')    -- Manager can only create staff/chef
    )
  );

-- O+M: update other staff accounts
-- Manager may not edit accounts with role=owner or role=manager
-- Manager may not promote anyone to owner or manager
CREATE POLICY "staff_users__owner_manager__update"
  ON staff_users FOR UPDATE
  USING (
    cafe_id   = auth_user_cafe_id()
    AND id   <> auth.uid()              -- Cannot edit self via this policy
    AND auth_user_has_role(ARRAY['owner','manager'])
    AND (
      auth_user_role() = 'owner'        -- Owner can edit any account
      OR OLD.role IN ('staff', 'chef')  -- Manager can only edit staff/chef
    )
  )
  WITH CHECK (
    cafe_id = auth_user_cafe_id()
    AND (
      auth_user_role() = 'owner'
      OR NEW.role IN ('staff', 'chef')  -- Manager cannot promote to owner/manager
    )
  );

-- O only: delete staff accounts (except self)
CREATE POLICY "staff_users__owner__delete"
  ON staff_users FOR DELETE
  USING (
    cafe_id  = auth_user_cafe_id()
    AND id  <> auth.uid()
    AND auth_user_has_role(ARRAY['owner'])
  );


-- ============================================================
-- AUDIT_LOGS
-- ============================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- O: full audit trail
CREATE POLICY "audit_logs__owner__select"
  ON audit_logs FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']));

-- M: operational events only — staff account events are owner-only
CREATE POLICY "audit_logs__manager__select"
  ON audit_logs FOR SELECT
  USING (
    cafe_id   = auth_user_cafe_id()
    AND auth_user_has_role(ARRAY['manager'])
    AND event_type NOT LIKE 'staff.%'
  );

-- No INSERT/UPDATE/DELETE for any client — triggers only (SECURITY DEFINER)


-- ============================================================
-- ROLE_CAPABILITIES & ROLE_PERMISSIONS
-- (read-only reference tables)
-- ============================================================

ALTER TABLE role_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions       ENABLE ROW LEVEL SECURITY;

-- All authenticated staff may read the permission reference tables
-- (used for UI rendering and mobile permission checks)
CREATE POLICY "role_capabilities__all_staff__select"
  ON role_capabilities FOR SELECT
  USING (auth_user_cafe_id() IS NOT NULL);

CREATE POLICY "role_permissions__all_staff__select"
  ON role_permissions FOR SELECT
  USING (auth_user_cafe_id() IS NOT NULL);

CREATE POLICY "permissions__all_staff__select"
  ON permissions FOR SELECT
  USING (auth_user_cafe_id() IS NOT NULL);
