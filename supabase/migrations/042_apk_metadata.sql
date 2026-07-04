-- ============================================================
-- Migration 042: APK Metadata Auto-Extraction
-- Cafe Maestro Platform
-- ============================================================
-- Adds columns to app_releases so the owner only has to upload
-- an APK — the rest of the release information is extracted
-- automatically from the file itself (parsed client-side) and
-- stored here as the single source of truth.
--
-- Does not modify or replace any column from migration 040/041.
-- ============================================================

ALTER TABLE public.app_releases
  ADD COLUMN IF NOT EXISTS package_name          text,
  ADD COLUMN IF NOT EXISTS target_android_version text,
  ADD COLUMN IF NOT EXISTS apk_sha256            text,
  ADD COLUMN IF NOT EXISTS apk_signature         text,
  ADD COLUMN IF NOT EXISTS build_timestamp        timestamptz;

-- ── Duplicate detection ─────────────────────────────────────────
-- The same APK (identical bytes) should never be published twice
-- for the same platform. The app-layer duplicate-detection dialog
-- (compare SHA256 before publish) is backed by this constraint as
-- a hard guarantee — race conditions or bypassed client checks are
-- still caught at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_releases_platform_sha256
  ON public.app_releases (platform, apk_sha256)
  WHERE apk_sha256 IS NOT NULL;

-- ── Lookup index for duplicate checks ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_app_releases_apk_sha256
  ON public.app_releases (apk_sha256);
