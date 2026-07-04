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
 */

import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

export interface InstalledAppVersion {
  version: string;
  buildNumber: number;
  platform: "android" | "web";
}

let cached: InstalledAppVersion | null = null;

export async function getInstalledAppVersion(): Promise<InstalledAppVersion> {
  if (cached) return cached;

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    try {
      const info = await App.getInfo();
      cached = {
        version: info.version,
        buildNumber: parseInt(info.build, 10) || 0,
        platform: "android",
      };
      return cached;
    } catch (err) {
      console.error("[versionService] App.getInfo() failed:", err);
    }
  }

  cached = { version: "web", buildNumber: 0, platform: "web" };
  return cached;
}

/** Clears the cached version — mainly useful for tests. */
export function __resetVersionCache(): void {
  cached = null;
}
