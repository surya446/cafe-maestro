---
name: Capacitor Android setup
description: How Capacitor 8 is configured in the admin-dashboard artifact and what env vars / scripts are needed for APK builds.
---

## Rule
Capacitor 8 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android` ^8.x) requires **Node.js ≥22**. The Replit environment ships nodejs-20 by default; nodejs-22 must be installed via `installProgrammingLanguage({ language: "nodejs-22" })`.

**Why:** `npx cap sync android` exits with a fatal error on Node 20: "The Capacitor CLI requires NodeJS >=22.0.0".

## How to apply
- `capacitor.config.ts` lives at `artifacts/admin-dashboard/capacitor.config.ts`
- `webDir` = `"dist/public"` (Vite's outDir)
- `appId` = `"com.cafemaestro.app"`, `appName` = `"Cafe Maestro"`
- The Vite config **throws** if `PORT` or `BASE_PATH` are not set, even during `vite build`. Use the dedicated build script that passes dummy values acceptable for a static bundle:
  ```
  "build:cap": "PORT=3000 BASE_PATH=/ vite build --config vite.config.ts"
  ```
- The android/ scaffold is committed; it was generated via:
  1. `pnpm run build:cap` → produces `dist/public`
  2. `npx cap add android` → scaffolds `android/`
  3. `npx cap sync android` → copies web assets into `android/app/src/main/assets/public/`
- To rebuild after code changes: `pnpm run build:cap && pnpm run cap:sync`
- Android TV / Kitchen Display: same APK, same Supabase backend. Chef role auto-redirects to KDS after login (architecture planned; TV-specific routing not yet implemented).
