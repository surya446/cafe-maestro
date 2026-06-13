-- ============================================================
-- Migration 002: Cafes (Multi-Tenant Root)
-- Cafe Maestro Platform
-- ============================================================
-- Every other table references cafe_id. This is the tenant root.
-- Example tenant: Cup & Cozy (slug: cup-and-cozy)
-- ============================================================

CREATE TABLE cafes (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name            text          NOT NULL,                   -- "Cup & Cozy"
  slug            text          NOT NULL UNIQUE,            -- "cup-and-cozy" (URL-safe)
  description     text,

  -- Contact
  phone           text,
  email           text,
  address         text,

  -- Business hours
  -- Stored as JSONB for flexibility:
  -- { "monday": "8:00 AM - 9:00 PM", "tuesday": null, ... }
  -- null = closed that day
  opening_hours   jsonb         NOT NULL DEFAULT '{}'::jsonb,

  -- Social media
  -- { "instagram": "https://...", "facebook": null, ... }
  social_links    jsonb         NOT NULL DEFAULT '{}'::jsonb,

  -- Operational
  is_active       boolean       NOT NULL DEFAULT true,
  currency        text          NOT NULL DEFAULT 'GBP',
  timezone        text          NOT NULL DEFAULT 'Europe/London',

  -- Audit
  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  updated_at      timestamptz   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cafes IS
  'Root tenant table. Every cafe on the Cafe Maestro platform has one row here. All other tables reference cafe_id.';

COMMENT ON COLUMN cafes.slug IS
  'URL-safe identifier used in public routes, e.g. /cup-and-cozy/menu';

COMMENT ON COLUMN cafes.opening_hours IS
  'JSONB: keys are lowercase day names, values are human-readable hour strings or null (closed).';

COMMENT ON COLUMN cafes.social_links IS
  'JSONB: keys are platform names (instagram, facebook, twitter, tiktok, website), values are full URLs or null.';

SELECT create_updated_at_trigger('cafes');
