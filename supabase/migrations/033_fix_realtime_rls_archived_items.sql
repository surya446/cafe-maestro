-- ============================================================
-- Migration 033: Fix Realtime RLS for Archived Menu Items
-- Cafe Maestro Platform
-- ============================================================
-- Root cause: Migration 032 added `is_archived = false` to both
-- anon SELECT policies on menu_items. This caused Supabase
-- Realtime to suppress UPDATE events when an item is archived
-- (is_archived = true), because the new row state no longer
-- passed RLS for anon subscribers. The event was never delivered
-- to QR menu clients using the anon key, so archived items
-- remained visible until the page was refreshed.
--
-- Restore events worked because the restored row (is_archived=false)
-- passed RLS, so that UPDATE event was delivered normally.
--
-- Fix: Remove `is_archived` from both anon SELECT policies.
-- Archived items are hidden at the application level instead:
--   - TableSessionPage query: .eq("is_archived", false)
--   - useMenuItems query:     .eq("is_archived", false)
--   - usePublicMenu query:    .eq("is_archived", false)
--
-- Security: is_archived is not sensitive data. Archived items
-- remaining selectable via RLS does not expose private information.
-- The application layer consistently filters them from all UIs.
-- ============================================================

-- ── menu_items__website__select ─────────────────────────────────────────────
-- Before: is_archived = false AND cafe_id IN (active cafes)
-- After:  cafe_id IN (active cafes)
-- Realtime: anon now receives UPDATE events when is_archived changes.

DROP POLICY IF EXISTS "menu_items__website__select" ON public.menu_items;
CREATE POLICY "menu_items__website__select"
  ON public.menu_items FOR SELECT
  USING (
    cafe_id IN (SELECT id FROM public.cafes WHERE is_active = true)
  );

-- ── menu_items_public_read ──────────────────────────────────────────────────
-- Before: is_available = true AND is_archived = false
-- After:  is_available = true
-- Note: archived items have is_available = false (set on archive), so they
-- remain excluded from this policy's result set anyway. The change removes
-- the redundant is_archived guard that was blocking realtime delivery.

DROP POLICY IF EXISTS "menu_items_public_read" ON public.menu_items;
CREATE POLICY "menu_items_public_read"
  ON public.menu_items FOR SELECT
  USING (is_available = true);
