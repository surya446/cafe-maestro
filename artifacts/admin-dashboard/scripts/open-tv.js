#!/usr/bin/env node
/**
 * scripts/open-tv.js
 *
 * Opens the android-tv/ Gradle project in Android Studio.
 *
 * Capacitor 8.4.1 replacement for:
 *   npx cap open android --config capacitor-tv.config.ts
 * (that flag does not exist in Capacitor 8.4.1's `cap open`.)
 *
 * Replicates the exact studio-path resolution and launch logic from
 * @capacitor/cli@8.4.1 dist/android/open.js + dist/config.js:
 *
 *   macOS   — open -a "Android Studio" <projectDir>
 *   Windows — resolves studio64.exe via:
 *               1. CAPACITOR_ANDROID_STUDIO_PATH env var
 *               2. C:\Program Files\Android\Android Studio\bin\studio64.exe
 *               3. REG QUERY HKEY_LOCAL_MACHINE\SOFTWARE\Android Studio /v Path
 *             then spawns studio64.exe <projectDir> directly.
 *             (Using `start ""` is wrong — it opens File Explorer, not Android Studio.)
 *   Linux   — tries CAPACITOR_ANDROID_STUDIO_PATH, then common studio.sh
 *             locations, then xdg-open, then prints manual instructions.
 */

import { execSync, spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "../android-tv");

// ── Pre-flight checks ─────────────────────────────────────────────────────────

if (!fs.existsSync(projectDir)) {
  console.error(`[open-tv] ERROR: android-tv/ not found at:\n  ${projectDir}`);
  process.exit(1);
}
if (!fs.existsSync(path.join(projectDir, "settings.gradle"))) {
  console.error(`[open-tv] ERROR: android-tv/settings.gradle missing.`);
  console.error(`  Run: pnpm cap:sync:tv`);
  process.exit(1);
}

console.log(`[open-tv] Opening Android Studio with project:\n  ${projectDir}\n`);

// ── Platform dispatch ─────────────────────────────────────────────────────────

const platform = process.platform;

if (platform === "darwin") {
  openMac();
} else if (platform === "win32") {
  openWindows();
} else {
  openLinux();
}

// ── macOS ─────────────────────────────────────────────────────────────────────

function openMac() {
  // Identical to what `cap open android` does on macOS.
  const studioPath =
    process.env.CAPACITOR_ANDROID_STUDIO_PATH ?? "/Applications/Android Studio.app";

  try {
    execSync(`open -a "${studioPath}" "${projectDir}"`, { stdio: "inherit" });
  } catch {
    fatal(
      `Could not launch Android Studio at: ${studioPath}`,
      `Set CAPACITOR_ANDROID_STUDIO_PATH if it is installed elsewhere.`,
      `Or open Android Studio manually: File → Open → ${projectDir}`,
    );
  }
}

// ── Windows ───────────────────────────────────────────────────────────────────

async function openWindows() {
  const studioExe = await resolveWindowsStudioPath();

  if (!studioExe || !fs.existsSync(studioExe)) {
    fatal(
      `Cannot find Android Studio executable${studioExe ? ` at:\n  ${studioExe}` : "."}`,
      `Set the CAPACITOR_ANDROID_STUDIO_PATH environment variable to the full path`,
      `of studio64.exe, e.g.:`,
      `  set CAPACITOR_ANDROID_STUDIO_PATH=C:\\Program Files\\Android\\Android Studio\\bin\\studio64.exe`,
      `Or open Android Studio manually: File → Open → ${projectDir}`,
    );
    return;
  }

  console.log(`[open-tv] Launching: ${studioExe}`);
  // Spawn studio64.exe with the project directory — this is the correct Windows
  // launch method. Do NOT use `start ""` which opens File Explorer, not Android Studio.
  spawn(`"${studioExe}"`, [`"${projectDir}"`], {
    stdio: "ignore",
    detached: true,
    shell: true,   // shell:true so quoted paths with spaces resolve correctly on Windows
  }).unref();
}

async function resolveWindowsStudioPath() {
  // 1. Explicit env var (same as Capacitor).
  if (process.env.CAPACITOR_ANDROID_STUDIO_PATH) {
    return process.env.CAPACITOR_ANDROID_STUDIO_PATH;
  }

  // 2. Default install location.
  const defaultPath =
    "C:\\Program Files\\Android\\Android Studio\\bin\\studio64.exe";
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  // 3. Registry query — same query Capacitor 8.4.1 uses.
  try {
    let result = execSync(
      "REG QUERY HKEY_LOCAL_MACHINE\\SOFTWARE\\Android Studio /v Path",
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] },
    );
    result = result.replace(/(\r\n|\n|\r)/gm, "");
    const i = result.indexOf("REG_SZ");
    if (i > 0) {
      return result.substring(i + 6).trim() + "\\bin\\studio64.exe";
    }
  } catch {
    // Registry key not present — fall through.
  }

  return null;
}

// ── Linux ─────────────────────────────────────────────────────────────────────

function openLinux() {
  const candidates = [
    process.env.CAPACITOR_ANDROID_STUDIO_PATH ?? null,
    "/usr/local/android-studio/bin/studio.sh",
    "/usr/local/android-studio/bin/studio",
    "/opt/android-studio/bin/studio.sh",
    "/opt/android-studio/bin/studio",
    process.env.HOME ? `${process.env.HOME}/android-studio/bin/studio.sh` : null,
    process.env.HOME ? `${process.env.HOME}/.local/share/JetBrains/Toolbox/apps/AndroidStudio/ch-0/default/bin/studio.sh` : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.log(`[open-tv] Launching: ${candidate}`);
      spawn(candidate, [projectDir], { stdio: "ignore", detached: true }).unref();
      return;
    }
  }

  // Last resort: xdg-open (may or may not open in Android Studio).
  try {
    spawn("xdg-open", [projectDir], { stdio: "ignore", detached: true }).unref();
    console.log(`[open-tv] Opened via xdg-open (may open in file manager — see below).`);
  } catch {
    // xdg-open not available.
  }

  console.log(
    `[open-tv] Could not locate Android Studio automatically.\n` +
    `  Set CAPACITOR_ANDROID_STUDIO_PATH to your studio.sh path, e.g.:\n` +
    `    export CAPACITOR_ANDROID_STUDIO_PATH=/opt/android-studio/bin/studio.sh\n` +
    `  Or open Android Studio manually: File → Open → ${projectDir}`,
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fatal(...lines) {
  console.error(`[open-tv] ERROR: ${lines.join("\n  ")}`);
  process.exit(1);
}
