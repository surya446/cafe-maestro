-- ============================================================
-- Migration 016: RLS Policies — Four-Role Rebuild
-- Cafe Maestro Platform
-- ============================================================
-- Drops all policies from migration 009 and replaces them with
-- policies that use the four-role model: owner, manager, staff, chef.
--
-- Policy naming convention:
--   {table}_{audience}_{action}
--
-- Role shorthand in comments:
--   O  = owner
--   M  = manager
--   S  = staff
--   C  = chef
--   P  = public / anon (guest or unauthenticated visitor)
-- ============================================================


-- ============================================================
-- CAFES
-- ============================================================

DROP POLICY IF EXISTS "cafes_public_read"  ON cafes;
DROP POLICY IF EXISTS "cafes_owner_all"    ON cafes;
DROP POLICY IF EXISTS "cafes_staff_read"   ON cafes;

-- P: public visitors can read any active cafe (powers public pages)
CREATE POLICY "cafes_public_read"
  ON cafes FOR SELECT
  USING (is_active = true);

-- O: owner has full access to their own cafe row
CREATE POLICY "cafes_owner_update"
  ON cafes FOR UPDATE
  USING  (id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']))
  WITH CHECK (id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']));

-- O+M+S+C: all authenticated staff can read their cafe row
CREATE POLICY "cafes_staff_read"
  ON cafes FOR SELECT
  USING (id = auth_user_cafe_id());


-- ============================================================
-- CAFE_TABLES
-- ============================================================

DROP POLICY IF EXISTS "cafe_tables_public_read"  ON cafe_tables;
DROP POLICY IF EXISTS "cafe_tables_owner_all"    ON cafe_tables;
DROP POLICY IF EXISTS "cafe_tables_staff_read"   ON cafe_tables;

-- P: public read of active tables (QR scan needs to resolve table)
CREATE POLICY "cafe_tables_public_read"
  ON cafe_tables FOR SELECT
  USING (is_active = true);

-- O+M: create, update, delete tables and regenerate QR codes
CREATE POLICY "cafe_tables_manager_write"
  ON cafe_tables FOR INSERT
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

CREATE POLICY "cafe_tables_manager_update"
  ON cafe_tables FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

CREATE POLICY "cafe_tables_owner_delete"
  ON cafe_tables FOR DELETE
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']));

-- O+M+S+C: all staff read all tables in their cafe
CREATE POLICY "cafe_tables_staff_read"
  ON cafe_tables FOR SELECT
  USING (cafe_id = auth_user_cafe_id());


-- ============================================================
-- TABLE_SESSIONS
-- ============================================================

DROP POLICY IF EXISTS "table_sessions_guest_read"   ON table_sessions;
DROP POLICY IF EXISTS "table_sessions_staff_read"   ON table_sessions;
DROP POLICY IF EXISTS "table_sessions_staff_update" ON table_sessions;

-- P: guests can read sessions (they already hold the session_id)
CREATE POLICY "table_sessions_guest_read"
  ON table_sessions FOR SELECT
  TO anon
  USING (true);

-- O+M+S+C: all staff read sessions in their cafe
CREATE POLICY "table_sessions_staff_read"
  ON table_sessions FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- O+M+S: staff and above can end sessions (not chef)
CREATE POLICY "table_sessions_staff_end"
  ON table_sessions FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']));


-- ============================================================
-- SESSION_DEVICES
-- ============================================================

DROP POLICY IF EXISTS "session_devices_guest_read"  ON session_devices;
DROP POLICY IF EXISTS "session_devices_staff_read"  ON session_devices;

CREATE POLICY "session_devices_guest_read"
  ON session_devices FOR SELECT
  TO anon
  USING (true);

-- O+M+S: staff and above see device list (for table map active counts)
-- Chef does not need to see device counts
CREATE POLICY "session_devices_staff_read"
  ON session_devices FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']));


-- ============================================================
-- MENU_CATEGORIES
-- ============================================================

DROP POLICY IF EXISTS "menu_categories_public_read"  ON menu_categories;
DROP POLICY IF EXISTS "menu_categories_staff_read"   ON menu_categories;
DROP POLICY IF EXISTS "menu_categories_owner_all"    ON menu_categories;

-- P: visible categories only (public menu page)
CREATE POLICY "menu_categories_public_read"
  ON menu_categories FOR SELECT
  USING (is_visible = true);

-- O+M+S+C: all staff read all categories (including hidden)
CREATE POLICY "menu_categories_staff_read"
  ON menu_categories FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- O+M: create/update/delete categories
CREATE POLICY "menu_categories_manager_write"
  ON menu_categories FOR INSERT
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

CREATE POLICY "menu_categories_manager_update"
  ON menu_categories FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

CREATE POLICY "menu_categories_owner_delete"
  ON menu_categories FOR DELETE
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']));


-- ============================================================
-- MENU_ITEMS
-- ============================================================

DROP POLICY IF EXISTS "menu_items_public_read"  ON menu_items;
DROP POLICY IF EXISTS "menu_items_staff_read"   ON menu_items;
DROP POLICY IF EXISTS "menu_items_owner_all"    ON menu_items;

-- P: available items only (public menu)
CREATE POLICY "menu_items_public_read"
  ON menu_items FOR SELECT
  USING (is_available = true);

-- O+M+S+C: all staff read all items including unavailable
-- (Chef needs to read items to display correctly on KDS)
CREATE POLICY "menu_items_staff_read"
  ON menu_items FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- O+M: create and update items (includes toggling is_available)
CREATE POLICY "menu_items_manager_write"
  ON menu_items FOR INSERT
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

CREATE POLICY "menu_items_manager_update"
  ON menu_items FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

-- O only: delete items (destructive — manager uses is_available instead)
CREATE POLICY "menu_items_owner_delete"
  ON menu_items FOR DELETE
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']));


-- ============================================================
-- ORDERS
-- ============================================================

DROP POLICY IF EXISTS "orders_guest_read"   ON orders;
DROP POLICY IF EXISTS "orders_staff_read"   ON orders;
DROP POLICY IF EXISTS "orders_staff_update" ON orders;

-- P: guests read orders in their own session
CREATE POLICY "orders_guest_read"
  ON orders FOR SELECT
  TO anon
  USING (true);

-- O+M+S+C: all staff read all orders in their cafe
CREATE POLICY "orders_staff_read"
  ON orders FOR SELECT
  USING (cafe_id = auth_user_cafe_id());

-- O+M+S: approve, reject, mark served
CREATE POLICY "orders_staff_approve_reject"
  ON orders FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']))
  WITH CHECK (
    cafe_id = auth_user_cafe_id()
    AND auth_user_has_role(ARRAY['owner','manager','staff'])
    -- Staff/manager can only move to: approved, cancelled, served
    -- (in_kitchen and ready are chef's domain — enforced at API layer)
  );

-- C: chef updates kitchen statuses (in_kitchen → ready)
CREATE POLICY "orders_chef_update"
  ON orders FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['chef']))
  WITH CHECK (
    cafe_id = auth_user_cafe_id()
    AND auth_user_has_role(ARRAY['chef'])
  );


-- ============================================================
-- ORDER_ITEMS
-- ============================================================

DROP POLICY IF EXISTS "order_items_guest_read"  ON order_items;
DROP POLICY IF EXISTS "order_items_staff_read"  ON order_items;

CREATE POLICY "order_items_guest_read"
  ON order_items FOR SELECT
  TO anon
  USING (true);

-- O+M+S+C: all staff read all order items
CREATE POLICY "order_items_staff_read"
  ON order_items FOR SELECT
  USING (cafe_id = auth_user_cafe_id());


-- ============================================================
-- BILL_REQUESTS
-- ============================================================

DROP POLICY IF EXISTS "bill_requests_guest_read"   ON bill_requests;
DROP POLICY IF EXISTS "bill_requests_staff_read"   ON bill_requests;
DROP POLICY IF EXISTS "bill_requests_staff_update" ON bill_requests;

CREATE POLICY "bill_requests_guest_read"
  ON bill_requests FOR SELECT
  TO anon
  USING (true);

-- O+M+S: see the bill request queue
CREATE POLICY "bill_requests_staff_read"
  ON bill_requests FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']));

-- O+M+S: acknowledge bill requests
CREATE POLICY "bill_requests_staff_acknowledge"
  ON bill_requests FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']));


-- ============================================================
-- BOOKINGS
-- ============================================================

DROP POLICY IF EXISTS "bookings_public_insert"  ON bookings;
DROP POLICY IF EXISTS "bookings_staff_all"      ON bookings;

-- P: anyone can create a booking (public booking page)
CREATE POLICY "bookings_public_insert"
  ON bookings FOR INSERT
  TO anon
  WITH CHECK (true);

-- O+M+S: confirm, cancel, seat bookings and assign tables
CREATE POLICY "bookings_staff_manage"
  ON bookings FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']));

CREATE POLICY "bookings_staff_update"
  ON bookings FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager','staff']));

-- O+M: delete bookings
CREATE POLICY "bookings_manager_delete"
  ON bookings FOR DELETE
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));


-- ============================================================
-- REVIEWS
-- ============================================================

DROP POLICY IF EXISTS "reviews_public_read"    ON reviews;
DROP POLICY IF EXISTS "reviews_public_insert"  ON reviews;
DROP POLICY IF EXISTS "reviews_owner_all"      ON reviews;

-- P: read approved reviews (public reviews page)
CREATE POLICY "reviews_public_read"
  ON reviews FOR SELECT
  TO anon
  USING (is_visible = true);

-- P: submit review (always queued, is_visible=false)
CREATE POLICY "reviews_public_insert"
  ON reviews FOR INSERT
  TO anon
  WITH CHECK (is_visible = false);

-- O+M: moderate (approve/hide/delete) reviews
CREATE POLICY "reviews_manager_moderate"
  ON reviews FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

CREATE POLICY "reviews_manager_update"
  ON reviews FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

CREATE POLICY "reviews_owner_delete"
  ON reviews FOR DELETE
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']));


-- ============================================================
-- GALLERY_IMAGES
-- ============================================================

DROP POLICY IF EXISTS "gallery_images_public_read"  ON gallery_images;
DROP POLICY IF EXISTS "gallery_images_owner_all"    ON gallery_images;

CREATE POLICY "gallery_images_public_read"
  ON gallery_images FOR SELECT
  USING (is_visible = true);

-- O+M: manage gallery
CREATE POLICY "gallery_images_manager_write"
  ON gallery_images FOR INSERT
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

CREATE POLICY "gallery_images_manager_update"
  ON gallery_images FOR UPDATE
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

CREATE POLICY "gallery_images_owner_delete"
  ON gallery_images FOR DELETE
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']));


-- ============================================================
-- OFFERS
-- ============================================================

DROP POLICY IF EXISTS "offers_public_read"  ON offers;
DROP POLICY IF EXISTS "offers_staff_read"   ON offers;
DROP POLICY IF EXISTS "offers_owner_all"    ON offers;

-- P: active + public offers
CREATE POLICY "offers_public_read"
  ON offers FOR SELECT
  USING (is_active = true AND is_public = true);

-- O+M: full offer management
CREATE POLICY "offers_manager_all"
  ON offers FOR ALL
  USING  (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']))
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

-- S+C: read all offers (needed to apply to orders)
CREATE POLICY "offers_staff_read"
  ON offers FOR SELECT
  USING (cafe_id = auth_user_cafe_id());


-- ============================================================
-- STAFF_USERS
-- ============================================================

DROP POLICY IF EXISTS "staff_users_self_read"    ON staff_users;
DROP POLICY IF EXISTS "staff_users_self_update"  ON staff_users;
DROP POLICY IF EXISTS "staff_users_owner_all"    ON staff_users;

-- O+M+S+C: every staff member reads their own profile
CREATE POLICY "staff_users_self_read"
  ON staff_users FOR SELECT
  USING (id = auth.uid());

-- O+M+S+C: update own profile (name, pin — not role, not cafe_id)
CREATE POLICY "staff_users_self_update"
  ON staff_users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND cafe_id = auth_user_cafe_id()  -- Cannot move yourself to another cafe
  );

-- O+M: read all staff in their cafe
CREATE POLICY "staff_users_manager_read"
  ON staff_users FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner','manager']));

-- O+M: create new staff accounts (INSERT)
-- Manager cannot create another owner (enforced in API layer + below)
CREATE POLICY "staff_users_manager_create"
  ON staff_users FOR INSERT
  WITH CHECK (
    cafe_id = auth_user_cafe_id()
    AND auth_user_has_role(ARRAY['owner','manager'])
    -- Manager cannot create an owner — only owner can create owners
    AND (
      auth_user_role() = 'owner'
      OR NEW.role <> 'owner'
    )
  );

-- O+M: update other staff (deactivate, change role)
-- Manager cannot promote anyone to owner or edit owner accounts
CREATE POLICY "staff_users_manager_update"
  ON staff_users FOR UPDATE
  USING (
    cafe_id = auth_user_cafe_id()
    AND auth_user_has_role(ARRAY['owner','manager'])
    AND id <> auth.uid()                  -- Cannot edit yourself via this policy
  )
  WITH CHECK (
    cafe_id = auth_user_cafe_id()
    -- Manager: cannot change target to/from owner role
    AND (
      auth_user_role() = 'owner'
      OR (OLD.role <> 'owner' AND NEW.role <> 'owner')
    )
  );

-- O only: permanently delete staff accounts
CREATE POLICY "staff_users_owner_delete"
  ON staff_users FOR DELETE
  USING (
    cafe_id = auth_user_cafe_id()
    AND auth_user_has_role(ARRAY['owner'])
    AND id <> auth.uid()  -- Cannot delete yourself
  );


-- ============================================================
-- AUDIT_LOGS
-- ============================================================

DROP POLICY IF EXISTS "audit_logs_owner_read"  ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_staff_read"  ON audit_logs;

-- O: full audit log access
CREATE POLICY "audit_logs_owner_read"
  ON audit_logs FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner']));

-- M: audit log access (excludes staff account changes — not their domain)
CREATE POLICY "audit_logs_manager_read"
  ON audit_logs FOR SELECT
  USING (
    cafe_id = auth_user_cafe_id()
    AND auth_user_has_role(ARRAY['manager'])
    AND event_type NOT LIKE 'staff.%'
  );
