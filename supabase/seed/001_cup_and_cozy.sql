-- ============================================================
-- Seed 001: Cup & Cozy — Example Tenant
-- Cafe Maestro Platform
-- ============================================================
-- This seed creates the first real tenant: Cup & Cozy.
-- Run AFTER all migrations have been applied.
-- Uses fixed UUIDs so foreign keys can reference them safely.
-- ============================================================

-- ------------------------------------
-- Cafe
-- ------------------------------------

INSERT INTO cafes (
  id, name, slug, description, phone, email, address,
  opening_hours, social_links, currency, timezone
) VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Cup & Cozy',
  'cup-and-cozy',
  'A warm neighbourhood cafe serving specialty coffee, fresh pastries, and seasonal small plates.',
  '+44 20 7946 0123',
  'hello@cupandcozy.co.uk',
  '14 Maple Street, London, E1 6RF',
  '{
    "monday":    "8:00 AM – 6:00 PM",
    "tuesday":   "8:00 AM – 6:00 PM",
    "wednesday": "8:00 AM – 6:00 PM",
    "thursday":  "8:00 AM – 8:00 PM",
    "friday":    "8:00 AM – 8:00 PM",
    "saturday":  "9:00 AM – 7:00 PM",
    "sunday":    null
  }'::jsonb,
  '{
    "instagram": "https://instagram.com/cupandcozy",
    "facebook":  "https://facebook.com/cupandcozy",
    "twitter":   null,
    "tiktok":    null,
    "website":   null
  }'::jsonb,
  'GBP',
  'Europe/London'
);

-- ------------------------------------
-- Tables (8 physical tables)
-- ------------------------------------

INSERT INTO cafe_tables (id, cafe_id, number, name, capacity) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 1, 'Table 1',        2),
  ('b1000000-0000-0000-0000-000000000002', 'a1b2c3d4-0000-0000-0000-000000000001', 2, 'Table 2',        2),
  ('b1000000-0000-0000-0000-000000000003', 'a1b2c3d4-0000-0000-0000-000000000001', 3, 'Window Seat',    4),
  ('b1000000-0000-0000-0000-000000000004', 'a1b2c3d4-0000-0000-0000-000000000001', 4, 'Garden Corner',  4),
  ('b1000000-0000-0000-0000-000000000005', 'a1b2c3d4-0000-0000-0000-000000000001', 5, 'Long Table',     8),
  ('b1000000-0000-0000-0000-000000000006', 'a1b2c3d4-0000-0000-0000-000000000001', 6, 'Sofa Nook',      3),
  ('b1000000-0000-0000-0000-000000000007', 'a1b2c3d4-0000-0000-0000-000000000001', 7, 'Bar Stool 1',    1),
  ('b1000000-0000-0000-0000-000000000008', 'a1b2c3d4-0000-0000-0000-000000000001', 8, 'Bar Stool 2',    1);

-- ------------------------------------
-- Menu categories
-- ------------------------------------

INSERT INTO menu_categories (id, cafe_id, name, description, position) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Hot Drinks',    'Specialty espresso, filter, and tea',          1),
  ('c1000000-0000-0000-0000-000000000002', 'a1b2c3d4-0000-0000-0000-000000000001', 'Cold Drinks',   'Iced coffee, smoothies, and cold brew',         2),
  ('c1000000-0000-0000-0000-000000000003', 'a1b2c3d4-0000-0000-0000-000000000001', 'Pastries',      'Freshly baked every morning',                   3),
  ('c1000000-0000-0000-0000-000000000004', 'a1b2c3d4-0000-0000-0000-000000000001', 'Small Plates',  'Seasonal plates for sharing or a light lunch',  4),
  ('c1000000-0000-0000-0000-000000000005', 'a1b2c3d4-0000-0000-0000-000000000001', 'Extras',        'Syrups, alt milks, and add-ons',                5);

-- ------------------------------------
-- Menu items
-- ------------------------------------

INSERT INTO menu_items (cafe_id, category_id, name, description, price, prep_time_min, tags, position) VALUES

  -- Hot Drinks
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Flat White',       'Double ristretto, silky microfoam',                   3.80, 4, '{signature}',         1),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Oat Cappuccino',   'House blend, oat milk, dusted cocoa',                 4.20, 4, '{vegan}',             2),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Matcha Latte',     'Ceremonial grade matcha, steamed milk',               4.50, 5, '{vegan,caffeine-free}',3),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Filter Coffee',    'Single origin, batch-brewed daily',                   3.20, 2, '{}',                  4),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Earl Grey Tea',    'Organic loose-leaf, served with milk',                2.80, 3, '{caffeine-free}',     5),

  -- Cold Drinks
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002',
   'Cold Brew',        '18-hour steep, served over ice',                      4.50, 1, '{}',                  1),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002',
   'Iced Matcha',      'Ceremonial matcha, oat milk, ice',                    5.00, 3, '{vegan}',             2),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002',
   'Banana Smoothie',  'Banana, oat milk, honey, cinnamon',                   5.50, 5, '{vegan,gluten-free}', 3),

  -- Pastries
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003',
   'Butter Croissant', 'Laminated dough, baked in-house',                     3.50, 1, '{}',                  1),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003',
   'Pain au Chocolat', 'Dark chocolate, flaky pastry',                        4.00, 1, '{}',                  2),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003',
   'Banana Bread',     'Moist, walnuts, served warm',                         4.50, 2, '{nut-free-option}',   3),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003',
   'Almond Danish',    'Frangipane, flaked almonds, vanilla glaze',           4.50, 1, '{}',                  4),

  -- Small Plates
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004',
   'Avocado Toast',    'Sourdough, smashed avo, chilli flakes, poached egg', 10.50, 8, '{vegetarian}',        1),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004',
   'Granola Bowl',     'House granola, seasonal fruit, coconut yoghurt',       9.00, 3, '{vegan,gluten-free}', 2),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004',
   'Cheese Toastie',   'Aged cheddar, sourdough, whole grain mustard',         8.50, 7, '{vegetarian}',        3),

  -- Extras
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005',
   'Alt Milk Upgrade', 'Oat, almond, soy, or coconut',                        0.60, 0, '{vegan}',             1),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005',
   'Vanilla Syrup',    'House-made vanilla syrup',                             0.50, 0, '{}',                  2),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005',
   'Extra Shot',       'Additional espresso shot',                             0.80, 0, '{}',                  3);

-- ------------------------------------
-- Sample offer
-- ------------------------------------

INSERT INTO offers (cafe_id, title, description, discount_type, discount_value, valid_from, valid_until, is_active, is_public) VALUES
  (
    'a1b2c3d4-0000-0000-0000-000000000001',
    'Happy Hour',
    'All drinks 20% off between 3pm and 5pm, Monday to Friday.',
    'percent',
    20.00,
    '2026-01-01',
    '2026-12-31',
    true,
    true
  );
