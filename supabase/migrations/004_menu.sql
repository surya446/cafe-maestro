-- ============================================================
-- Migration 004: Menu Categories & Items
-- Cafe Maestro Platform
-- ============================================================

-- ------------------------------------
-- Menu categories
-- ------------------------------------

CREATE TABLE menu_categories (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,

  name            text          NOT NULL,          -- "Hot Drinks", "Pastries", "Mains"
  description     text,
  image_url       text,
  position        integer       NOT NULL DEFAULT 0, -- Display order
  is_visible      boolean       NOT NULL DEFAULT true,

  -- Audit
  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  updated_at      timestamptz   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE menu_categories IS
  'Menu sections per cafe. position controls display order. Soft-hidden with is_visible.';

SELECT create_updated_at_trigger('menu_categories');

-- ------------------------------------
-- Menu items
-- ------------------------------------

CREATE TABLE menu_items (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  category_id     uuid          NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,

  name            text          NOT NULL,
  description     text,
  price           numeric(10,2) NOT NULL CHECK (price >= 0),
  image_url       text,

  is_available    boolean       NOT NULL DEFAULT true,  -- Toggle without deleting
  prep_time_min   integer       CHECK (prep_time_min >= 0),
  position        integer       NOT NULL DEFAULT 0,

  -- Dietary / filter tags: ['vegan', 'gluten-free', 'nut-free', 'spicy', 'signature']
  tags            text[]        NOT NULL DEFAULT '{}',

  -- Nutritional info (optional, future use)
  calories        integer,
  allergens       text[]        NOT NULL DEFAULT '{}',

  -- Audit
  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  updated_at      timestamptz   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE menu_items IS
  'Individual menu items per cafe. price is snapshotted into order_items at time of order so historical order values remain accurate even if price changes.';

COMMENT ON COLUMN menu_items.is_available IS
  'Allows staff to 86 an item (mark unavailable) without deleting it. Unavailable items are hidden from guests.';

COMMENT ON COLUMN menu_items.tags IS
  'Array of dietary/filter tags. Used for guest filtering on the menu page.';

SELECT create_updated_at_trigger('menu_items');
