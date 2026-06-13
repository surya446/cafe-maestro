-- ============================================================
-- Migration 007: Bookings, Reviews, Gallery Images & Offers
-- Cafe Maestro Platform
-- ============================================================

-- ------------------------------------
-- Bookings (table reservations)
-- ------------------------------------

CREATE TABLE bookings (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,

  -- Table assignment is optional at booking time; staff assign later
  table_id        uuid          REFERENCES cafe_tables(id) ON DELETE SET NULL,

  -- Guest info
  name            text          NOT NULL,
  email           text          NOT NULL,
  phone           text,
  party_size      integer       NOT NULL CHECK (party_size > 0),

  -- Booking time
  booking_date    date          NOT NULL,
  booking_time    time          NOT NULL,

  status          text          NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'seated', 'no_show')),

  notes           text,                    -- Guest's special requests

  -- Internal staff notes (not visible to guest)
  staff_notes     text,

  -- Confirmation sent to guest
  confirmed_at    timestamptz,
  confirmed_by    uuid          REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  updated_at      timestamptz   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bookings IS
  'Pre-visit table reservations. Submitted by guests via the public booking page. Staff confirm and assign tables.';

SELECT create_updated_at_trigger('bookings');

-- ------------------------------------
-- Reviews
-- ------------------------------------

CREATE TABLE reviews (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,

  -- Guest info (not authenticated)
  name            text          NOT NULL,
  email           text,                    -- Optional, not displayed publicly

  rating          integer       NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content         text          NOT NULL,

  -- Owner moderates before review goes public
  is_visible      boolean       NOT NULL DEFAULT false,
  moderated_at    timestamptz,
  moderated_by    uuid          REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  updated_at      timestamptz   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE reviews IS
  'Customer reviews submitted via the public reviews page. Default is_visible=false — owner must approve before they appear on the public site.';

SELECT create_updated_at_trigger('reviews');

-- ------------------------------------
-- Gallery images
-- ------------------------------------

CREATE TABLE gallery_images (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,

  url             text          NOT NULL,     -- Supabase Storage public URL
  storage_path    text          NOT NULL,     -- Internal path for deletion/management
  caption         text,
  alt_text        text,                       -- Accessibility
  position        integer       NOT NULL DEFAULT 0,
  is_visible      boolean       NOT NULL DEFAULT true,

  -- Audit
  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  updated_at      timestamptz   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE gallery_images IS
  'Gallery images displayed on the public gallery page. Stored in Supabase Storage. position controls display order.';

SELECT create_updated_at_trigger('gallery_images');

-- ------------------------------------
-- Offers / promotions
-- ------------------------------------

CREATE TABLE offers (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id         uuid          NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,

  title           text          NOT NULL,             -- "Happy Hour 50% Off"
  description     text,
  image_url       text,

  discount_type   text          NOT NULL DEFAULT 'percent'
                  CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  numeric(10,2) NOT NULL CHECK (discount_value > 0),

  -- Applicable menu items (NULL = all items)
  applies_to_items uuid[],

  valid_from      date,
  valid_until     date,
  is_active       boolean       NOT NULL DEFAULT true,

  -- Display on public site
  is_public       boolean       NOT NULL DEFAULT true,

  -- Audit
  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  updated_at      timestamptz   NOT NULL DEFAULT NOW(),

  CONSTRAINT offers_valid_range CHECK (
    valid_from IS NULL
    OR valid_until IS NULL
    OR valid_from <= valid_until
  )
);

COMMENT ON TABLE offers IS
  'Promotional offers per cafe. applies_to_items=NULL means the offer applies to all items. Offers are informational — discount enforcement is handled in the order API.';

SELECT create_updated_at_trigger('offers');
