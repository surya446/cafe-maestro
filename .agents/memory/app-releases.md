---
name: App release management
description: Architecture of the app_releases table, release service, and downloads page. Critical for anyone adding APK management features.
---

## Rule
The `app_releases` table (migration 040) is the single source of truth for all APK distribution. `downloads.ts` config is now only used for "Coming Soon" platforms.

**Why:** Previous implementation used a hardcoded config file with no real data; the DB replaces it entirely.

## Key decisions
- **DB trigger** `enforce_single_latest_release` auto-sets all other releases for a platform to `is_latest = false` whenever a row is inserted or updated with `is_latest = true`. This powers both Publish and Rollback without extra frontend logic.
- **Rollback** = `UPDATE app_releases SET is_latest = true WHERE id = X`. No re-upload needed.
- **Storage bucket** = `downloads` (150 MB limit, public read, authenticated write). Path format: `{platform}/{version}-{buildNumber}-{timestamp}.apk`.
- **Storage rollback** — `useDeleteRelease` removes the file from storage before deleting the DB row. If the APK upload succeeds but DB insert fails, `usePublishRelease` removes the uploaded file (atomic-ish cleanup).
- **Version check RPC** `get_latest_release(p_platform text)` is public (anon access allowed). Android app calls this to check for updates.
- **Sidebar permission** — "App Releases" nav item uses `managerOrAbove: true` (not `ownerOnly`). Owners see upload/rollback/delete; managers see read-only + download only.

## How to apply
After code changes, run in Supabase Dashboard → SQL Editor:
1. `supabase/migrations/040_app_releases.sql` — table + trigger + RLS + RPC
2. `sql/create-storage-buckets.sql` — creates `downloads` bucket (idempotent, won't touch gallery/website-assets)

## Files
- `src/services/releaseService.ts` — `getLatestRelease()`, `checkForUpdate()`, `formatFileSize()`, `buildStoragePath()`
- `src/hooks/useAppReleases.ts` — `useLatestRelease`, `useReleaseHistory`, `usePublishRelease`, `useRollbackRelease`, `useDeleteRelease`, `useUpdateRelease`
- `src/pages/DownloadsPage.tsx` — full page (title: "App Releases")
- `src/config/downloads.ts` — only coming-soon platforms now
- `supabase/migrations/040_app_releases.sql`
- `sql/create-storage-buckets.sql`
