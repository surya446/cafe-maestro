---
name: Mandatory app update gate
description: Force-update screen, infinite update loop root cause, and what was fixed.
---

## Architecture
- `MandatoryUpdateGate` (root-mounted, wraps everything including login) blocks the app when `checked && hasUpdate && isForceUpdate`.
- `AppUpdateContext` runs `useAppUpdateCheck` once on mount and re-runs it (`recheck()`) on every `appStateChange: isActive` resume event.
- `useApkDownload` / `ApkUpdaterPlugin.java`: downloads APK with progress events, then fires a `startActivity(ACTION_VIEW)` intent to the system package installer and resolves immediately. The old app process goes to background.

## Root causes of the infinite update loop (both fixed)

### 1 — Auto Increment in upload form (primary cause)
`DownloadsPage.tsx` previously offered an "Auto Increment" button when the uploaded APK's `versionCode` ≤ current DB `build_number`. Clicking it stored `build_number = N+1` in the DB while the APK binary retained `versionCode = N`. After installation, `App.getInfo()` returns `N` (the real versionCode), but DB has `N+1 > N` → mandatory update screen appears again → infinite loop.

**Fix**: Removed "Auto Increment" option entirely. `isBuildTooLow` (APK versionCode < DB build) is now a hard block with an error directing the owner to bump `versionCode` in `build.gradle`. `isBuildSameAsCurrent` (versionCode == DB build) requires explicit confirmation to republish the same build number (safe, won't retrigger updates).

### 2 — Module-level cache in versionService.ts (secondary cause)
`let cached` was set on the first call to `getInstalledAppVersion()`. If `recheck()` was triggered (e.g., via `appStateChange`) before the old process was killed, the stale pre-install build number was returned from cache → update still appeared.

**Fix**: Removed the module-level cache entirely. `App.getInfo()` is called fresh on every invocation. `__resetVersionCache()` kept as a no-op for test compatibility.

## Key rule
The database `build_number` must always equal the APK's actual `versionCode` (as reported by `App.getInfo().build`). Any mismatch where DB > installed versionCode creates an infinite mandatory update loop.

## Files
- `src/services/versionService.ts` — reads `App.getInfo()`, no caching
- `src/hooks/useAppUpdateCheck.ts` — runs check, exposes `recheck`
- `src/context/AppUpdateContext.tsx` — mounts listener for `appStateChange`
- `src/components/updates/MandatoryUpdateGate.tsx` — gate, root-mounted
- `src/components/updates/MandatoryUpdateScreen.tsx` — download + install UI
- `src/native/apkUpdater.ts` + `android/.../ApkUpdaterPlugin.java` — native download/install plugin
- `src/pages/DownloadsPage.tsx` — APK upload form (UploadForm component)

**Why:** Without strict invariant enforcement at upload time, an owner can accidentally push a DB record whose `build_number` no longer maps to any real APK versionCode, trapping every device in an update loop.
