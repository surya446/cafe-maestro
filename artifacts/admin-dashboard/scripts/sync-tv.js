#!/usr/bin/env node
/**
 * scripts/sync-tv.js
 *
 * Syncs the Android TV native project after a mobile cap sync or a TV web build.
 *
 * What it does:
 *   1. Copies android/capacitor.settings.gradle → android-tv/capacitor.settings.gradle
 *      (plugin module paths are identical for both projects since android/ and
 *       android-tv/ sit at the same depth from node_modules)
 *   2. Copies android/capacitor-cordova-android-plugins/ → android-tv/ (if present)
 *      so Gradle can resolve cordova.variables.gradle during the TV build.
 *   3. Copies web assets from dist/tv-public/ → android-tv/app/src/main/assets/public/
 *      (mirrors what `cap sync` does for the mobile project)
 *
 * Typical workflow:
 *   pnpm build:tv          # compile the TV web bundle to dist/tv-public/
 *   pnpm cap:sync:mobile   # sync mobile Android project + regenerate capacitor.settings.gradle
 *   pnpm cap:sync:tv       # run this script — keeps android-tv in sync
 *
 * Alternatively, `pnpm cap:sync:tv` can be run standalone after `build:tv` if
 * Capacitor (via `cap sync android --config capacitor-tv.config.ts`) is already
 * handling plugin discovery correctly.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, ".."); // artifacts/admin-dashboard/

function copyFileIfExists(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`  [skip] ${path.relative(root, src)} — not found`);
    return false;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`  [copy] ${path.relative(root, src)} → ${path.relative(root, dest)}`);
  return true;
}

function copyDirIfExists(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`  [skip] ${path.relative(root, src)}/ — not found`);
    return false;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirIfExists(srcPath, destPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }
  console.log(`  [sync] ${path.relative(root, src)}/ → ${path.relative(root, dest)}/`);
  return true;
}

// ── Step 1: Sync capacitor.settings.gradle ────────────────────────────────────
console.log("\n[sync-tv] Step 1 — capacitor.settings.gradle");
copyFileIfExists(
  path.join(root, "android/capacitor.settings.gradle"),
  path.join(root, "android-tv/capacitor.settings.gradle"),
);

// ── Step 2: Sync capacitor-cordova-android-plugins/ ──────────────────────────
console.log("\n[sync-tv] Step 2 — capacitor-cordova-android-plugins/");
copyDirIfExists(
  path.join(root, "android/capacitor-cordova-android-plugins"),
  path.join(root, "android-tv/capacitor-cordova-android-plugins"),
);

// ── Step 3: Sync web assets from dist/tv-public → android-tv assets ──────────
console.log("\n[sync-tv] Step 3 — web assets (dist/tv-public → android-tv/.../assets/public)");
const tvDist = path.join(root, "dist/tv-public");
const tvAssets = path.join(root, "android-tv/app/src/main/assets/public");

if (!fs.existsSync(tvDist)) {
  console.log(`  [warn] dist/tv-public/ not found — run 'pnpm build:tv' first`);
} else {
  // Clear the target directory first so stale files don't linger
  if (fs.existsSync(tvAssets)) {
    fs.rmSync(tvAssets, { recursive: true, force: true });
  }
  copyDirIfExists(tvDist, tvAssets);
  console.log(`  [done] TV web assets copied`);
}

console.log("\n[sync-tv] ✓ Sync complete\n");
