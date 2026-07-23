-- ============================================================
-- Migration 043: Archived Items System Category
-- Cafe Maestro Platform
-- ============================================================
-- Introduces a permanent system category called "Archived Items".
-- Archived menu items are automatically moved into this category
-- so that normal categories can be deleted without violating the
-- order_items FK RESTRICT constraint.
--
-- Rules:
--   is_system = true  → cannot be renamed, deleted, or archived
--   The "Archived Items" category is hidden from customers,
--   QR ordering, staff dashboard, and kitchen display.
--   It is only visible inside the Admin Dashboard.
-- ============================================================

-- 1. Add is_system column to menu_categories
ALTER TABLE menu_categories
  ADD COLUMN is_system boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN menu_categories.is_system IS
  'System-managed category. Cannot be renamed, deleted, or archived by users. '
  'The "Archived Items" system category holds menu items with order history so '
  'they can be preserved without blocking deletion of normal categories.';

-- 2. Create the "Archived Items" system category for every existing cafe
INSERT INTO menu_categories (cafe_id, name, description, position, is_visible, is_system)
SELECT
  id                      AS cafe_id,
  'Archived Items'        AS name,
  'System category. Holds archived menu items that have order history, '
  'preserving data integrity without blocking deletion of normal categories.'
                          AS description,
  999999                  AS position,  -- Always sorts last
  false                   AS is_visible, -- Never shown to customers
  true                    AS is_system
FROM cafes;

-- 3. Move all currently-archived menu items into their cafe's Archived Items category
UPDATE menu_items mi
SET    category_id = arc.id
FROM   menu_categories arc
WHERE  arc.cafe_id   = mi.cafe_id
  AND  arc.is_system = true
  AND  arc.name      = 'Archived Items'
  AND  mi.is_archived = true;
