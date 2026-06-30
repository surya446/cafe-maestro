-- ============================================================
-- Migration 040: App Release Management
-- Cafe Maestro Platform
-- ============================================================
-- Stores APK releases for Android and Android TV.
-- Only one release per platform may have is_latest = true.
-- Publishing a new release auto-marks previous ones as false.
-- Exposes a public RPC for the Android app to check for updates.
-- ============================================================

-- ── Platform type ──────────────────────────────────────────────
CREATE TYPE public.app_platform AS ENUM (
  'android',
  'android-tv',
  'windows',
  'macos',
  'linux',
  'ios'
);

-- ── Table ──────────────────────────────────────────────────────
CREATE TABLE public.app_releases (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  platform            public.app_platform NOT NULL,
  version             text        NOT NULL,
  build_number        integer     NOT NULL,
  release_notes       text,
  min_android_version text,
  file_size           text,
  download_url        text,
  storage_path        text,
  is_latest           boolean     NOT NULL DEFAULT false,
  is_force_update     boolean     NOT NULL DEFAULT false,
  published_at        timestamptz NOT NULL DEFAULT now(),
  created_by          uuid        REFERENCES public.staff_users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Auto-update updated_at ─────────────────────────────────────
SELECT create_updated_at_trigger('app_releases');

-- ── Indexes ────────────────────────────────────────────────────
CREATE INDEX idx_app_releases_platform
  ON public.app_releases(platform);

CREATE INDEX idx_app_releases_platform_latest
  ON public.app_releases(platform, is_latest)
  WHERE is_latest = true;

CREATE INDEX idx_app_releases_created_at
  ON public.app_releases(created_at DESC);

-- ── Trigger: enforce single latest per platform ────────────────
-- When a release is set to is_latest = true, all other releases
-- for the same platform are automatically set to is_latest = false.
-- This powers both "Publish" and "Rollback" without extra logic.
CREATE OR REPLACE FUNCTION public.enforce_single_latest_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_latest = true THEN
    UPDATE public.app_releases
    SET    is_latest = false
    WHERE  platform  = NEW.platform
      AND  id        != NEW.id
      AND  is_latest = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_single_latest_release
  AFTER INSERT OR UPDATE ON public.app_releases
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_latest_release();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

-- Owners: full access (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "app_releases: owner full access"
  ON public.app_releases
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE id = auth.uid()
        AND role = 'owner'
        AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE id = auth.uid()
        AND role = 'owner'
        AND is_active = true
    )
  );

-- Managers: SELECT only
CREATE POLICY "app_releases: manager read"
  ON public.app_releases
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE id = auth.uid()
        AND role IN ('manager', 'owner')
        AND is_active = true
    )
  );

-- Public (anon): only the latest release per platform.
-- Used by the Android app for version-check calls.
CREATE POLICY "app_releases: public read latest"
  ON public.app_releases
  FOR SELECT
  TO anon
  USING (is_latest = true);

-- ── RPC: version check ─────────────────────────────────────────
-- The Android app calls this to check whether a newer APK exists.
-- Returns the current latest release for the requested platform.
CREATE OR REPLACE FUNCTION public.get_latest_release(p_platform text)
RETURNS TABLE (
  id                  uuid,
  platform            text,
  version             text,
  build_number        integer,
  release_notes       text,
  min_android_version text,
  file_size           text,
  download_url        text,
  is_force_update     boolean,
  published_at        timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    r.id,
    r.platform::text,
    r.version,
    r.build_number,
    r.release_notes,
    r.min_android_version,
    r.file_size,
    r.download_url,
    r.is_force_update,
    r.published_at
  FROM public.app_releases r
  WHERE r.platform = p_platform::public.app_platform
    AND r.is_latest = true
  LIMIT 1;
$$;

-- Allow both anon and authenticated to call the version-check RPC
GRANT EXECUTE ON FUNCTION public.get_latest_release(text) TO anon, authenticated;
