-- Allow anon to read ALL menu items (including out-of-stock) for active cafes.
-- The existing menu_items__public__select (is_available = true) is kept for the
-- QR-ordering flow; permissive policies are OR-ed, so anon now sees the union.
-- The public website queries is_visible on the application side; the QR ordering
-- continues to filter is_available = true in its own query.
CREATE POLICY "menu_items__website__select"
  ON public.menu_items FOR SELECT
  USING (
    cafe_id IN (SELECT id FROM public.cafes WHERE is_active = true)
  );
