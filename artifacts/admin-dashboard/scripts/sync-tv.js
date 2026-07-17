#!/usr/bin/env node
/**
 * scripts/sync-tv.js
 *
 * Syncs the Android TV native project after a TV web build.
 * Replaces `npx cap sync android --config capacitor-tv.config.ts` because
 * Capacitor 8.4.1's CLI does not support a --config flag on cap sync or cap open.
 *
 * What it does:
 *   1. Copies android/capacitor.settings.gradle → android-tv/capacitor.settings.gradle
 *   2. Ensures the Gradle wrapper (gradlew, gradlew.bat, gradle/wrapper/) is present
 *      in android-tv/ — copied from android/ if any file is missing.
 *   3. Syncs capacitor-cordova-android-plugins/ from android/ → android-tv/ when
 *      android/ has a real generated one (from npx cap sync android). When android/
 *      has no generated one, android-tv/ retains its committed stub so Gradle can
 *      always resolve :capacitor-cordova-android-plugins without internet access.
 *   4. Copies web assets from dist/tv-public/ → android-tv/app/src/main/assets/public/
 *   5. Generates the three Capacitor config files that `npx cap sync` normally writes
 *      (gitignored, regenerated on every sync):
 *        - app/src/main/assets/capacitor.config.json
 *        - app/src/main/assets/capacitor.plugins.json
 *        - app/src/main/res/xml/config.xml
 *
 * Typical workflow:
 *   pnpm build:tv        — compile TV web bundle to dist/tv-public/
 *   pnpm cap:sync:tv     — run this script (keeps android-tv/ ready for Android Studio)
 *   pnpm cap:open:tv     — open android-tv/ in Android Studio
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, ".."); // artifacts/admin-dashboard/

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function writeJSON(dest, obj) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(obj, null, 2) + "\n", "utf8");
  console.log(`  [gen]  ${path.relative(root, dest)}`);
}

function writeText(dest, content) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, "utf8");
  console.log(`  [gen]  ${path.relative(root, dest)}`);
}

// ── Step 1: Sync capacitor.settings.gradle ────────────────────────────────────
console.log("\n[sync-tv] Step 1 — capacitor.settings.gradle");
copyFileIfExists(
  path.join(root, "android/capacitor.settings.gradle"),
  path.join(root, "android-tv/capacitor.settings.gradle"),
);

// ── Step 2: Gradle wrapper ────────────────────────────────────────────────────
// android-tv/ must have the Gradle wrapper for Android Studio to open/build
// the project. Copy from android/ if any wrapper file is missing.
console.log("\n[sync-tv] Step 2 — Gradle wrapper");
const wrapperFiles = [
  ["android/gradlew",                                   "android-tv/gradlew"],
  ["android/gradlew.bat",                               "android-tv/gradlew.bat"],
  ["android/gradle/wrapper/gradle-wrapper.jar",         "android-tv/gradle/wrapper/gradle-wrapper.jar"],
  ["android/gradle/wrapper/gradle-wrapper.properties",  "android-tv/gradle/wrapper/gradle-wrapper.properties"],
];
let wrapperCopied = 0;
for (const [relSrc, relDest] of wrapperFiles) {
  const dest = path.join(root, relDest);
  if (!fs.existsSync(dest)) {
    copyFileIfExists(path.join(root, relSrc), dest, { required: true });
    wrapperCopied++;
  } else {
    console.log(`  [ok]   ${relDest}`);
  }
}
// Ensure gradlew is executable on Unix.
try { fs.chmodSync(path.join(root, "android-tv/gradlew"), 0o755); } catch (_) {}
if (wrapperCopied === 0) console.log("  Gradle wrapper already present — nothing to copy");

// ── Step 3: capacitor-cordova-android-plugins/ ───────────────────────────────
// If android/ has a real generated one (from npx cap sync android), copy it so
// the TV project stays in sync with any installed Cordova plugins.
// If android/ has no generated one, android-tv/ keeps its committed stub —
// the stub is what allows Gradle sync to succeed on a fresh clone.
console.log("\n[sync-tv] Step 3 — capacitor-cordova-android-plugins/");
const mobileCordovaPlugins = path.join(root, "android/capacitor-cordova-android-plugins");
const tvCordovaPlugins     = path.join(root, "android-tv/capacitor-cordova-android-plugins");

if (fs.existsSync(mobileCordovaPlugins)) {
  fs.rmSync(tvCordovaPlugins, { recursive: true, force: true });
  copyDirIfExists(mobileCordovaPlugins, tvCordovaPlugins);
} else {
  console.log("  [ok] android/ has no generated plugins dir — android-tv/ committed stub retained");
}

// ── Step 4: Web assets ────────────────────────────────────────────────────────
console.log("\n[sync-tv] Step 4 — web assets (dist/tv-public → android-tv/.../assets/public)");
const tvDist   = path.join(root, "dist/tv-public");
const tvAssets = path.join(root, "android-tv/app/src/main/assets/public");

if (!fs.existsSync(tvDist)) {
  console.log("  [warn] dist/tv-public/ not found — run 'pnpm build:tv' first, then re-run this script");
} else {
  if (fs.existsSync(tvAssets)) fs.rmSync(tvAssets, { recursive: true, force: true });
  copyDirIfExists(tvDist, tvAssets);
  console.log("  [done] TV web assets copied");
}

// ── Step 5: Capacitor-generated config files ──────────────────────────────────
// These are produced by `npx cap sync` in the mobile project but our custom
// sync skips the Capacitor CLI. We generate them directly from the known TV
// config values. They are gitignored (correctly — they are build artifacts),
// so they must be regenerated on every sync, just like the web assets.
console.log("\n[sync-tv] Step 5 — Capacitor config files");

const assetsDir = path.join(root, "android-tv/app/src/main/assets");

// 5a. capacitor.config.json — runtime config read by the Capacitor bridge.
writeJSON(path.join(assetsDir, "capacitor.config.json"), {
  appId: "com.cafemaestro.tv",
  appName: "Cafe Maestro TV",
  webDir: "dist/tv-public",
  android: { path: "android-tv" },
  server: { androidScheme: "https", cleartext: false },
});

// 5b. capacitor.plugins.json — list of installed Capacitor plugin classes.
// The Capacitor bridge reads this to register native plugins at startup.
// Only @capacitor/* packages that ship an Android plugin class are listed.
// ApkUpdaterPlugin is registered directly in MainActivity, not here.
writeJSON(path.join(assetsDir, "capacitor.plugins.json"), [
  { pkg: "@capacitor/app",     classpath: "com.capacitorjs.plugins.app.AppPlugin"         },
  { pkg: "@capacitor/browser", classpath: "com.capacitorjs.plugins.browser.BrowserPlugin" },
  { pkg: "@capacitor/device",  classpath: "com.capacitorjs.plugins.device.DevicePlugin"   },
  { pkg: "@capacitor/network", classpath: "com.capacitorjs.plugins.network.NetworkPlugin" },
]);

// 5c. config.xml — Cordova compatibility shim required by Capacitor's
// WebViewLocalServer. Without it the bridge throws on startup.
const xmlDir = path.join(root, "android-tv/app/src/main/res/xml");
writeText(
  path.join(xmlDir, "config.xml"),
  `<?xml version='1.0' encoding='utf-8'?>
<widget version="1" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">
    <access origin="*" />
    <allow-navigation href="*" />
    <allow-intent href="http://*/*" />
    <allow-intent href="https://*/*" />
    <preference name="Orientation" value="landscape" />
</widget>
`,
);

// 5d. cordova.variables.gradle — Capacitor's Cordova compatibility variables.
// Read by capacitor-cordova-android-plugins/build.gradle at Gradle sync time.
// Regenerated on every sync (same as `npx cap sync android` does for mobile).
// minSdkVersion must match variables.gradle (24).
writeText(
  path.join(root, "android-tv/capacitor-cordova-android-plugins/cordova.variables.gradle"),
  `// DO NOT EDIT THIS FILE! IT IS GENERATED EACH TIME "capacitor update" IS RUN
ext {
  cdvMinSdkVersion = project.hasProperty('minSdkVersion') ? rootProject.ext.minSdkVersion : 24
  // Plugin gradle extensions can append to this to have code run at the end.
  cdvPluginPostBuildExtras = []
  cordovaConfig = [:]
}
`,
);

console.log("\n[sync-tv] ✓ Sync complete\n");
