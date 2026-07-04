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

## Android in-app update system (on top of the above)
Native Android launch checks build number via `App.getInfo()` (Capacitor) against `get_latest_release('android')` — never `android-tv`. No hardcoded/duplicated version anywhere; `getInstalledAppVersion()` in `versionService.ts` is the only read path.

**Why:** avoids version drift between `android/app/build.gradle` and any JS-side constant; TV releases must never trigger a phone/tablet update prompt or vice versa.

- Update dialog (`UpdateDialog.tsx`) is non-browser, built on the shared `Dialog` primitive with an additive `hideClose` prop (only hides the X button; existing dialogs unaffected). Force-update (`is_force_update`) also blocks outside-click/Escape dismissal.
- Download + install uses a **native Capacitor plugin** (`ApkUpdaterPlugin.java`, bridged via `native/apkUpdater.ts`) — HttpURLConnection with progress events + FileProvider install intent. Never `window.open`/browser download on native Android.
- `staff_devices` (migration 041) — one row per `staff_id` (UNIQUE, upsert onConflict staff_id), so it's latest-device-wins, not multi-device history. RLS: owner full, manager read, self upsert/read.
- Device tracking (`useDeviceTracking`) fires once per login from `AdminShell`, guarded to Android native only inside `deviceService.trackDeviceForStaff`.
- "Device Versions" card on the Downloads page reuses the exact same `useLatestRelease("android")` react-query cache key as the release history section — publishing a new release invalidates that cache and every device row's status badge recomputes automatically, satisfying the "auto-refresh on publish" requirement with zero extra polling/subscription code.
- Manual Supabase step still required (same as 040): apply `supabase/migrations/041_staff_devices.sql` by hand — no working CLI/Management API auth in this environment (SUPABASE_ACCESS_TOKEN → 401).

## APK metadata auto-extraction (migration 042, on top of the above)
Owner uploads only the APK; version/build/package/SDK/size/SHA256/signature/build-timestamp are all read from the file itself in `src/services/apkParser.ts` — nothing is hand-typed or invented.

**Why:** the task explicitly forbade faked/guessed release metadata; every field must be traceable to bytes in the uploaded file or explicitly reported as unavailable.

- `app-info-parser` (parses binary AndroidManifest.xml) → versionName/versionCode/package/minSdkVersion/targetSdkVersion. Must be imported with a normal ESM `import`, not `require()` — Vite dev server does not polyfill `require` in app source (only prebundles `import`ed node_modules deps via esbuild). A `require()` call compiles fine but throws "require is not defined" at runtime in the browser.
- Whole-file SHA256 via Web Crypto `crypto.subtle.digest` — used for DB-level duplicate detection (unique index on `(platform, apk_sha256)` in migration 042) plus a pre-publish app-side check (`findReleaseBySha256`).
- Signing certificate fingerprint only recoverable for APKs with a legacy v1/JAR signing block (`META-INF/*.RSA|DSA|EC`, parsed via `jszip` + `node-forge` PKCS7/X.509). v2/v3-only APKs report `signatureFingerprint: null` with an explicit `signatureUnavailableReason` string — never fabricated.
- Build timestamp read from the ZIP entry date of `AndroidManifest.xml`; treated as unavailable (null) when year ≤ 1980, the common reproducible-build zero-date default.
- Build-number and version-regression checks compare the parsed values against the platform's current `is_latest` release (`compareVersions()` in `releaseService.ts`); both require an explicit owner action (Auto Increment/Keep Existing, or a downgrade-confirm checkbox) before Publish is enabled — never silently overridden.
- Manual Supabase step again required: apply `supabase/migrations/042_apk_metadata.sql` by hand (adds `package_name`, `target_android_version`, `apk_sha256`, `apk_signature`, `build_timestamp` columns + duplicate-SHA256 unique index).
