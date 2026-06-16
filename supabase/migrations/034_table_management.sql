-- ============================================================
-- Migration 034: Table Management columns
-- Adds display_order and section to cafe_tables for the
-- admin Table Management page (add / edit / archive / QR).
-- ============================================================

-- 1. display_order — explicit ordering separate from the table number
ALTER TABLE cafe_tables
  ADD COLUMN IF NOT EXISTS display_order integer;

-- 2. section — optional zone/area label (e.g. "Main Floor", "Patio")
ALTER TABLE cafe_tables
  ADD COLUMN IF NOT EXISTS section text;

-- 3. Backfill display_order from the existing number field
UPDATE cafe_tables
SET display_order = number
WHERE display_order IS NULL;

-- 4. Make display_order non-nullable going forward (after backfill)
ALTER TABLE cafe_tables
  ALTER COLUMN display_order SET DEFAULT 0;
