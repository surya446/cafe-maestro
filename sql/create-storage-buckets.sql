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

-- ── 3. RLS policies for gallery bucket ───────────────────────

-- Public can view all gallery images
create policy "gallery: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'gallery');

-- Authenticated users can upload gallery images
create policy "gallery: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'gallery');

-- Authenticated users can update their own uploads
create policy "gallery: authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'gallery');

-- Authenticated users can delete gallery images
create policy "gallery: authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'gallery');

-- ── 4. RLS policies for website-assets bucket ────────────────

-- Public can view all website assets
create policy "website-assets: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'website-assets');

-- Authenticated users can upload website assets
create policy "website-assets: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'website-assets');

-- Authenticated users can update website assets
create policy "website-assets: authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'website-assets');

-- Authenticated users can delete website assets
create policy "website-assets: authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'website-assets');
