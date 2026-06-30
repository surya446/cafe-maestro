-- ── website_settings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.website_settings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id          uuid        NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  cafe_name        text,
  tagline          text,
  hero_title       text,
  hero_subtitle    text,
  about_content    text,
  logo_url         text,
  logo_path        text,
  hero_image_url   text,
  hero_image_path  text,
  address          text,
  phone            text,
  email            text,
  google_maps_url  text,
  instagram_url    text,
  facebook_url     text,
  opening_hours    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  primary_color    text        NOT NULL DEFAULT '#1a1a1a',
  secondary_color  text        NOT NULL DEFAULT '#f5f0eb',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_settings_cafe_id_unique UNIQUE (cafe_id)
);

-- updated_at auto-stamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS website_settings_updated_at ON public.website_settings;
CREATE TRIGGER website_settings_updated_at
  BEFORE UPDATE ON public.website_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

-- owner: full CRUD
CREATE POLICY "website_settings__owner__select"
  ON public.website_settings FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner'::text]));

CREATE POLICY "website_settings__owner__insert"
  ON public.website_settings FOR INSERT
  WITH CHECK (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner'::text]));

CREATE POLICY "website_settings__owner__update"
  ON public.website_settings FOR UPDATE
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner'::text]));

CREATE POLICY "website_settings__owner__delete"
  ON public.website_settings FOR DELETE
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['owner'::text]));

-- manager: read-only
CREATE POLICY "website_settings__manager__select"
  ON public.website_settings FOR SELECT
  USING (cafe_id = auth_user_cafe_id() AND auth_user_has_role(ARRAY['manager'::text]));

-- anon: read active cafes (public website use)
CREATE POLICY "website_settings__public__select"
  ON public.website_settings FOR SELECT TO anon
  USING (cafe_id IN (SELECT id FROM public.cafes WHERE is_active = true));

-- ── Storage bucket ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'website-assets',
  'website-assets',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage policies ───────────────────────────────────────────────────────
-- anyone can read (public bucket, but belt-and-suspenders)
CREATE POLICY "website_assets__public__select"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'website-assets');

-- owner can upload into their {cafe_id}/ folder
CREATE POLICY "website_assets__owner__insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'website-assets'
    AND EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE id = auth.uid() AND role = 'owner' AND is_active = true
    )
  );

CREATE POLICY "website_assets__owner__update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'website-assets'
    AND EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE id = auth.uid() AND role = 'owner' AND is_active = true
    )
  );

CREATE POLICY "website_assets__owner__delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'website-assets'
    AND EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE id = auth.uid() AND role = 'owner' AND is_active = true
    )
  );
