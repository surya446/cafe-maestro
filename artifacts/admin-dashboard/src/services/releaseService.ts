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
  // DIAGNOSTIC — always a fresh network call; no client-side cache.
  console.log(`[releaseService] calling get_latest_release RPC — platform="${platform}" — network fetch (no cache)`);

  const { data, error } = await supabase.rpc("get_latest_release", {
    p_platform: platform,
  });

  if (error) {
    console.error("[releaseService] get_latest_release error:", error);
    return null;
  }

  // DIAGNOSTIC — log the raw rows returned by the RPC before any filtering.
  console.log(`[releaseService] RPC returned ${(data ?? []).length} row(s) →`, JSON.stringify(data));

  if (!data || data.length === 0) return null;

  const row = data[0] as LatestReleaseInfo;

  // DIAGNOSTIC — log the row that will be used as the "latest" release.
  console.log("[releaseService] using row →", JSON.stringify({
    id: row.id,
    platform: row.platform,
    version: row.version,
    build_number: row.build_number,
    is_force_update: row.is_force_update,
    published_at: row.published_at,
    download_url: row.download_url,
  }));

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
  const isForceUpdate = hasUpdate && latest.is_force_update;

  // DIAGNOSTIC — log the exact values used in the comparison so the
  // source of any mismatch is unambiguous.
  console.log("[releaseService] update comparison →", JSON.stringify({
    installedBuild: currentBuildNumber,
    latestBuild: latest.build_number,
    "latestBuild > installedBuild": hasUpdate,
    hasUpdate,
    is_force_update_flag_in_db: latest.is_force_update,
    isForceUpdate,
    dataSource: "fresh network fetch (no client cache)",
  }));

  return {
    hasUpdate,
    isForceUpdate,
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

/**
 * Compares two dotted version strings numerically, segment by segment.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 * Missing/non-numeric segments are treated as 0, so "1.0" == "1.0.0".
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.trim().split(".");
  const partsB = b.trim().split(".");
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const numA = parseInt(partsA[i] ?? "0", 10) || 0;
    const numB = parseInt(partsB[i] ?? "0", 10) || 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
}
