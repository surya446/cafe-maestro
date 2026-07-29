-- Migration 045: Add food_type to menu_items
-- Tracks whether a menu item is vegetarian or non-vegetarian.
-- Defaults to 'veg' so existing rows get a value immediately.
-- The CHECK constraint enforces the two allowed values at DB level.

ALTER TABLE menu_items
  ADD COLUMN food_type text NOT NULL DEFAULT 'veg'
    CHECK (food_type IN ('veg', 'non_veg'));

COMMENT ON COLUMN menu_items.food_type IS
  'Food classification: veg (vegetarian) or non_veg (non-vegetarian). '
  'Displayed as the standard Indian food indicator on the QR ordering menu.';
