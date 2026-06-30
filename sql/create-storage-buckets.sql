-- ============================================================
-- Cafe Maestro — Storage Bucket Setup
-- Run this once in the Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/<your-project-id>/sql
-- ============================================================

-- ── 1. Create the gallery bucket (public read) ────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery',
  'gallery',
  true,
  10485760,  -- 10 MB per file
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- ── 2. Create the website-assets bucket (public read) ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'website-assets',
  'website-assets',
  true,
  10485760,  -- 10 MB per file
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- ── 3. Create the downloads bucket (APK files, public read) ───
-- Holds Android and Android TV APKs.
-- Folder structure: downloads/android/, downloads/android-tv/
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'downloads',
  'downloads',
  true,
  157286400,  -- 150 MB — enough for a Capacitor APK
  array[
    'application/vnd.android.package-archive',
    'application/octet-stream'  -- fallback for APK files on some systems
  ]
)
on conflict (id) do nothing;

-- ── 4. RLS policies for gallery bucket ───────────────────────

create policy "gallery: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'gallery');

create policy "gallery: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'gallery');

create policy "gallery: authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'gallery');

create policy "gallery: authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'gallery');

-- ── 5. RLS policies for website-assets bucket ────────────────

create policy "website-assets: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'website-assets');

create policy "website-assets: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'website-assets');

create policy "website-assets: authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'website-assets');

create policy "website-assets: authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'website-assets');

-- ── 6. RLS policies for downloads bucket ─────────────────────
-- Anyone can read/download APK files (for QR-code sharing).
-- Only authenticated users (owners via app-layer checks) can write.

create policy "downloads: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'downloads');

create policy "downloads: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'downloads');

create policy "downloads: authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'downloads');
