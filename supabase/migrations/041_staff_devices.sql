-- ============================================================
-- Migration 041: Staff Device Tracking
-- Cafe Maestro Platform
-- ============================================================
-- Tracks which Android device each staff member is using and
-- which app version/build is installed on it. Populated by the
-- Android app on every login. Powers the "Device Versions" card
-- in the App Releases page (owner/manager only).
-- One row per staff member (latest device wins on re-login).
-- ============================================================

CREATE TABLE public.staff_devices (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id          uuid        NOT NULL UNIQUE REFERENCES public.staff_users(id) ON DELETE CASCADE,
  device_name       text,
  device_model      text,
  android_version   text,
  app_version       text,
  build_number      integer,
  last_seen         timestamptz,
  last_login        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

SELECT create_updated_at_trigger('staff_devices');

CREATE INDEX idx_staff_devices_staff_id ON public.staff_devices(staff_id);
CREATE INDEX idx_staff_devices_last_seen ON public.staff_devices(last_seen DESC);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.staff_devices ENABLE ROW LEVEL SECURITY;

-- Owners: full access
CREATE POLICY "staff_devices: owner full access"
  ON public.staff_devices
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

-- Managers: read all device rows (for the dashboard)
CREATE POLICY "staff_devices: manager read"
  ON public.staff_devices
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

-- Any authenticated staff member: upsert their own device row.
-- This is how the Android app registers itself on login.
CREATE POLICY "staff_devices: self upsert"
  ON public.staff_devices
  FOR INSERT
  TO authenticated
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY "staff_devices: self update"
  ON public.staff_devices
  FOR UPDATE
  TO authenticated
  USING (staff_id = auth.uid())
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY "staff_devices: self read"
  ON public.staff_devices
  FOR SELECT
  TO authenticated
  USING (staff_id = auth.uid());
