/**
 * Version Service
 *
 * Single source of truth for the currently installed app version and
 * build number. Never hardcode a version elsewhere — always read it
 * from here.
 *
 * - On the native Android app (Capacitor), reads the real installed
 *   version/build from the Android package info (versionName /
 *   versionCode, set in android/app/build.gradle at build time),
 *   via the @capacitor/app plugin.
 * - In the browser (the admin dashboard web app), there is no
 *   installed "app" to version-check, so this resolves to a web
 *   placeholder. Update checks are always skipped outside of the
 *   native Android platform — see useAppUpdateCheck.
 *
 * NOTE: No module-level caching. App.getInfo() is a cheap synchronous
 * native call; caching it caused an infinite update loop because
 * recheck() (triggered on appStateChange after installation) would
 * read the old build number from cache instead of the freshly
 * installed one.
 */

import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

export interface InstalledAppVersion {
  version: string;
  buildNumber: number;
  platform: "android" | "web";
}

export async function getInstalledAppVersion(): Promise<InstalledAppVersion> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    try {
      const info = await App.getInfo();
      return {
        version: info.version,
        buildNumber: parseInt(info.build, 10) || 0,
        platform: "android",
      };
    } catch (err) {
      console.error("[versionService] App.getInfo() failed:", err);
    }
  }

  return { version: "web", buildNumber: 0, platform: "web" };
}

/** No-op kept for test compatibility. */
export function __resetVersionCache(): void {
  // Cache removed — App.getInfo() is always called fresh.
}
