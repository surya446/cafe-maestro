/**
 * Release Service
 *
 * Reusable service for querying the latest app release information.
 * This is the single source of truth consumed by:
 *   - The admin dashboard Downloads page
 *   - The Android / Android TV app (via the embedded WebView)
 *
 * The Android app calls getLatestRelease() or checkForUpdate() to
 * determine whether a newer APK is available.
 */

import { supabase } from "@/lib/supabase";

export type AppReleasePlatform =
  | "android"
  | "android-tv"
  | "windows"
  | "macos"
  | "linux"
  | "ios";

export interface LatestReleaseInfo {
  id: string;
  platform: AppReleasePlatform;
  version: string;
  build_number: number;
  release_notes: string | null;
  min_android_version: string | null;
  file_size: string | null;
  download_url: string | null;
  is_force_update: boolean;
  published_at: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  isForceUpdate: boolean;
  latestRelease: LatestReleaseInfo | null;
}

/**
 * Returns the current live release for a platform.
 * Uses the public get_latest_release RPC — works without authentication.
 */
export async function getLatestRelease(
  platform: AppReleasePlatform
): Promise<LatestReleaseInfo | null> {
  const { data, error } = await supabase.rpc("get_latest_release", {
    p_platform: platform,
  });

  if (error) {
    console.error("[releaseService] get_latest_release error:", error);
    return null;
  }

  if (!data || data.length === 0) return null;

  const row = data[0] as LatestReleaseInfo;
  return row;
}

/**
 * Compares the installed build number against the latest released build.
 * Returns whether an update is available and whether it is forced.
 *
 * Usage from Android app:
 *   const result = await checkForUpdate("android", installedBuildNumber);
 *   if (result.isForceUpdate) { blockUsageAndShowUpdateDialog(); }
 *   else if (result.hasUpdate) { showOptionalUpdateBanner(); }
 */
export async function checkForUpdate(
  platform: AppReleasePlatform,
  currentBuildNumber: number
): Promise<UpdateCheckResult> {
  const latest = await getLatestRelease(platform);

  if (!latest) {
    return { hasUpdate: false, isForceUpdate: false, latestRelease: null };
  }

  const hasUpdate = latest.build_number > currentBuildNumber;

  return {
    hasUpdate,
    isForceUpdate: hasUpdate && latest.is_force_update,
    latestRelease: latest,
  };
}

/**
 * Formats a byte count as a human-readable file size string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns the Supabase Storage path for an APK.
 * Format: {platform}/{version}-{buildNumber}-{timestamp}.apk
 */
export function buildStoragePath(
  platform: AppReleasePlatform,
  version: string,
  buildNumber: number
): string {
  return `${platform}/${version}-${buildNumber}-${Date.now()}.apk`;
}
