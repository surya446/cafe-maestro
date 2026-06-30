-- ============================================================
-- Migration 021: Bookings INSERT policy for authenticated staff
-- Cafe Maestro Platform
-- ============================================================
-- Context:
--   Migration 020 defined `bookings__public__insert` scoped
--   TO anon — allowing unauthenticated customers to submit
--   bookings via the public form.
--
--   No INSERT policy was defined for the `authenticated` role,
--   so owner / manager / staff users received:
--     42501 — new row violates row-level security policy
--   when creating bookings from the admin dashboard.
--
-- This migration adds the missing authenticated INSERT policy.
-- No existing policies are modified.
-- ============================================================

CREATE POLICY "bookings__owner_manager_staff__insert"
  ON bookings FOR INSERT
  WITH CHECK (
    cafe_id = auth_user_cafe_id()
    AND auth_user_has_role(ARRAY['owner', 'manager', 'staff'])
  );
