#!/usr/bin/env node
/**
 * scripts/open-tv.js
 *
 * Opens the android-tv/ Gradle project in Android Studio.
 *
 * This is the Capacitor 8-compatible replacement for:
 *   npx cap open android --config capacitor-tv.config.ts
 *
 * Capacitor 8.4.1's `cap open` does not support a --config flag.
 * This script replicates exactly what `cap open android` does internally:
 * it resolves the Android project path from the TV Capacitor config and
 * opens it with Android Studio using the platform-appropriate mechanism.
 *
 * Usage: node scripts/open-tv.js   (via pnpm cap:open:tv)
 *
 * Platform behaviour:
 *   macOS   — open -a "Android Studio" <path>
 *   Windows — start "" "<path>"  (Windows shell opens with the registered handler)
 *   Linux   — tries ANDROID_STUDIO env var, then common install locations,
 *              then falls back to xdg-open, then prints manual instructions.
 */

import { execSync, spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "../android-tv");

if (!fs.existsSync(projectDir)) {
  console.error(`[open-tv] ERROR: android-tv/ project not found at:\n  ${projectDir}`);
  console.error(`  Make sure you are running this from the workspace root.`);
  process.exit(1);
}

// Verify settings.gradle is present — minimum check that this is a Gradle project.
if (!fs.existsSync(path.join(projectDir, "settings.gradle"))) {
  console.error(`[open-tv] ERROR: android-tv/settings.gradle not found.`);
  console.error(`  The android-tv project may be incomplete. Run: pnpm cap:sync:tv`);
  process.exit(1);
}

console.log(`[open-tv] Opening Android Studio with project:\n  ${projectDir}\n`);

const platform = process.platform;

if (platform === "darwin") {
  // macOS — standard open -a command. Identical to what `cap open android` does.
  try {
    execSync(`open -a "Android Studio" "${projectDir}"`, { stdio: "inherit" });
  } catch (_) {
    console.error(`[open-tv] Could not open Android Studio automatically.`);
    console.error(`  Open Android Studio manually and choose: File → Open`);
    console.error(`  Then navigate to: ${projectDir}`);
    process.exit(1);
  }
} else if (platform === "win32") {
  // Windows — open the directory via the shell; Android Studio registers as
  // the handler for Android Gradle projects.
  try {
    spawn("cmd.exe", ["/c", "start", "", projectDir], {
      stdio: "inherit",
      detached: true,
      shell: false,
    }).unref();
  } catch (_) {
    console.error(`[open-tv] Could not open the project automatically on Windows.`);
    console.error(`  Open Android Studio manually and choose: File → Open`);
    console.error(`  Then navigate to: ${projectDir}`);
    process.exit(1);
  }
} else {
  // Linux — try candidate studio.sh locations in order.
  const candidates = [
    process.env.ANDROID_STUDIO
      ? path.join(process.env.ANDROID_STUDIO, "bin/studio.sh")
      : null,
    "/opt/android-studio/bin/studio.sh",
    "/usr/local/android-studio/bin/studio.sh",
    `${process.env.HOME}/android-studio/bin/studio.sh`,
    `${process.env.HOME}/.local/share/JetBrains/Toolbox/apps/AndroidStudio/ch-0/default/bin/studio.sh`,
  ].filter(Boolean);

  let opened = false;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        spawn(candidate, [projectDir], { stdio: "ignore", detached: true }).unref();
        console.log(`[open-tv] Launched: ${candidate}`);
        opened = true;
        break;
      } catch (_) {
        // try next
      }
    }
  }

  if (!opened) {
    // Last resort: xdg-open
    try {
      spawn("xdg-open", [projectDir], { stdio: "ignore", detached: true }).unref();
      console.log(`[open-tv] Opened via xdg-open.`);
    } catch (_) {
      console.log(`[open-tv] Could not locate Android Studio automatically.`);
      console.log(`  Set the ANDROID_STUDIO environment variable to your Android Studio install dir, or`);
      console.log(`  open Android Studio manually and choose: File → Open`);
      console.log(`  Navigate to: ${projectDir}`);
    }
  }
}
