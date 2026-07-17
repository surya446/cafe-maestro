#!/usr/bin/env node
/**
 * scripts/sync-tv.js
 *
 * Syncs the Android TV native project after a mobile cap sync or a TV web build.
 *
 * What it does:
 *   1. Copies android/capacitor.settings.gradle → android-tv/capacitor.settings.gradle
 *   2. Ensures the Gradle wrapper (gradlew, gradlew.bat, gradle/wrapper/) is present
 *      in android-tv/ — copied from android/ if missing.
 *   3. Syncs capacitor-cordova-android-plugins/ from android/ → android-tv/
 *      (if android/ has a real one with Cordova plugins). If android/ doesn't have
 *      one either, ensures android-tv/ has the committed stub so Gradle can resolve
 *      the :capacitor-cordova-android-plugins subproject.
 *   4. Copies web assets from dist/tv-public/ → android-tv/app/src/main/assets/public/
 *      (mirrors what `cap sync` does for the mobile project).
 *
 * Typical workflow:
 *   pnpm build:tv          # compile the TV web bundle to dist/tv-public/
 *   pnpm cap:sync:mobile   # sync mobile Android project + regenerate capacitor.settings.gradle
 *   pnpm cap:sync:tv       # run this script — keeps android-tv in sync
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, ".."); // artifacts/admin-dashboard/

function copyFileIfExists(src, dest, { required = false } = {}) {
  if (!fs.existsSync(src)) {
    if (required) {
      console.error(`  [error] ${path.relative(root, src)} — required but not found`);
      process.exit(1);
    }
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

// ── Step 2: Gradle wrapper ────────────────────────────────────────────────────
// android-tv/ must have the Gradle wrapper for Android Studio to open the
// project. Copy from android/ if any wrapper file is missing.
console.log("\n[sync-tv] Step 2 — Gradle wrapper");
const wrapperFiles = [
  ["android/gradlew",                               "android-tv/gradlew"],
  ["android/gradlew.bat",                           "android-tv/gradlew.bat"],
  ["android/gradle/wrapper/gradle-wrapper.jar",     "android-tv/gradle/wrapper/gradle-wrapper.jar"],
  ["android/gradle/wrapper/gradle-wrapper.properties", "android-tv/gradle/wrapper/gradle-wrapper.properties"],
];
let wrapperCopied = 0;
for (const [rel_src, rel_dest] of wrapperFiles) {
  const src  = path.join(root, rel_src);
  const dest = path.join(root, rel_dest);
  if (!fs.existsSync(dest)) {
    if (copyFileIfExists(src, dest, { required: true })) {
      wrapperCopied++;
    }
  } else {
    console.log(`  [ok]   ${rel_dest}`);
  }
}
// Ensure gradlew is executable on Unix
const gradlew = path.join(root, "android-tv/gradlew");
try { fs.chmodSync(gradlew, 0o755); } catch (_) {}
if (wrapperCopied === 0) console.log("  [ok] Gradle wrapper already present — nothing to copy");

// ── Step 3: capacitor-cordova-android-plugins/ ───────────────────────────────
// If android/ has a real generated one (from npx cap sync), copy it.
// If not, android-tv/ already has the committed stub — leave it alone.
console.log("\n[sync-tv] Step 3 — capacitor-cordova-android-plugins/");
const mobileCordovaPlugins = path.join(root, "android/capacitor-cordova-android-plugins");
const tvCordovaPlugins     = path.join(root, "android-tv/capacitor-cordova-android-plugins");

if (fs.existsSync(mobileCordovaPlugins)) {
  // Real plugins available — overwrite the stub with the real thing.
  fs.rmSync(tvCordovaPlugins, { recursive: true, force: true });
  copyDirIfExists(mobileCordovaPlugins, tvCordovaPlugins);
} else {
  // No real plugins in mobile project either. android-tv/ keeps its committed stub.
  console.log("  [ok] android/ has no generated plugins dir — android-tv/ stub is up to date");
}

// ── Step 4: Sync web assets from dist/tv-public → android-tv assets ──────────
console.log("\n[sync-tv] Step 4 — web assets (dist/tv-public → android-tv/.../assets/public)");
const tvDist   = path.join(root, "dist/tv-public");
const tvAssets = path.join(root, "android-tv/app/src/main/assets/public");

if (!fs.existsSync(tvDist)) {
  console.log(`  [warn] dist/tv-public/ not found — run 'pnpm build:tv' first`);
} else {
  // Clear the target directory first so stale files don't linger.
  if (fs.existsSync(tvAssets)) {
    fs.rmSync(tvAssets, { recursive: true, force: true });
  }
  copyDirIfExists(tvDist, tvAssets);
  console.log(`  [done] TV web assets copied`);
}

console.log("\n[sync-tv] ✓ Sync complete\n");
