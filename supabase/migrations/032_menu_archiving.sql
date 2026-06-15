-- ============================================================
-- Migration 032: Menu Item Archiving
-- Cafe Maestro Platform
-- ============================================================
-- Adds is_archived to menu_items for soft-deleting items that
-- have order history. Archived items are hidden from public
-- website and QR ordering but preserved in historical orders,
-- revenue reports, and audit logs.
--
-- Rules:
--   ACTIVE    is_archived=false, is_available=true  → visible everywhere
--   UNAVAIL   is_archived=false, is_available=false → visible everywhere, no ordering
--   ARCHIVED  is_archived=true  (any is_available)  → admin only
--
-- Delete is only allowed when no order_items reference exists.
-- Otherwise, admin must archive.
-- ============================================================

ALTER TABLE menu_items
  ADD COLUMN is_archived boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN menu_items.is_archived IS
  'Soft-delete for items with order history. Archived items are hidden from public '
  'website and QR ordering but preserved in historical orders, revenue reports, and '
  'audit logs. Use is_available=false for temporary unavailability. '
  'Only hard-delete when no order_items reference exists.';

-- ── Update public policies to exclude archived items ────────────────────────

-- Website policy (migration 031): all items for active cafes, excluding archived
DROP POLICY IF EXISTS "menu_items__website__select" ON public.menu_items;
CREATE POLICY "menu_items__website__select"
  ON public.menu_items FOR SELECT
  USING (
    is_archived = false
    AND cafe_id IN (SELECT id FROM public.cafes WHERE is_active = true)
  );

-- Original public read policy (migration 009): available items only, excluding archived
DROP POLICY IF EXISTS "menu_items_public_read" ON public.menu_items;
CREATE POLICY "menu_items_public_read"
  ON public.menu_items FOR SELECT
  USING (is_available = true AND is_archived = false);

-- Staff and owner policies are unchanged — admin must see archived items.
