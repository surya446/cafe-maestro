-- Migration 044: Normalize category display positions
--
-- The menu_categories.position column exists since migration 004 but has
-- DEFAULT 0, so every category created before manual ordering was introduced
-- shares the same position value (0). This makes ORDER BY position
-- non-deterministic and means the first shown category will appear randomly.
--
-- This migration assigns each cafe's user-created categories a unique,
-- sequential 0-based position sorted by their created_at timestamp (preserving
-- the historical insertion order as the starting point). The system "Archived
-- Items" category is left at its sentinel value of 999999 and is never shown
-- in the ordering UI.
--
-- Safe to run multiple times: only cafes that currently have duplicate
-- positions among their user-created categories are touched.

DO $$
DECLARE
  cafe_row  RECORD;
  cat_row   RECORD;
  pos       INTEGER;
BEGIN
  -- Find every cafe that has at least one duplicated position value among its
  -- user-created (non-system) categories.
  FOR cafe_row IN
    SELECT DISTINCT cafe_id
    FROM menu_categories
    WHERE is_system = false
    GROUP BY cafe_id, position
    HAVING COUNT(*) > 1
  LOOP
    pos := 0;
    -- Reassign sequential positions in created_at order (id as tiebreaker).
    FOR cat_row IN
      SELECT id
      FROM menu_categories
      WHERE cafe_id = cafe_row.cafe_id
        AND is_system = false
      ORDER BY created_at, id
    LOOP
      UPDATE menu_categories SET position = pos WHERE id = cat_row.id;
      pos := pos + 1;
    END LOOP;
  END LOOP;
END;
$$;
