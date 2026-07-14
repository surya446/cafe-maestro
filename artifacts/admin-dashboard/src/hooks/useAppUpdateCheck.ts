/**
 * useAppUpdateCheck
 *
 * Runs once when the native Android app launches and re-runs on every
 * resume from background.  Compares the installed build number against
 * the latest published release for this APK's platform:
 *
 *   Mobile APK  →  checks "android"
 *   TV APK      →  checks "android-tv"
 *
 * The platform is derived at build time from VITE_APP_VARIANT via
 * getAppVariant() in src/native/platform.ts — no runtime guessing.
 *
 * Never runs in the browser admin dashboard.
 *
 * Failure-safe: if the check fails for any reason (offline, RPC error,
 * missing table) the app continues normally — it never blocks usage.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { isNativeAndroid, isTvApp } from "@/native/platform";
import { checkForUpdate, type AppReleasePlatform, type LatestReleaseInfo } from "@/services/releaseService";
import { getInstalledAppVersion } from "@/services/versionService";

export interface AppUpdateState {
  checked: boolean;
  hasUpdate: boolean;
  isForceUpdate: boolean;
  latestRelease: LatestReleaseInfo | null;
  installedVersion: string;
  installedBuild: number;
}

/** The platform this build checks against — resolved once at module load. */
const RELEASE_PLATFORM: AppReleasePlatform = isTvApp() ? "android-tv" : "android";

const initialState: AppUpdateState = {
  checked: false,
  hasUpdate: false,
  isForceUpdate: false,
  latestRelease: null,
  installedVersion: "",
  installedBuild: 0,
};

export function useAppUpdateCheck() {
  const [state, setState] = useState<AppUpdateState>(initialState);
  const hasRun = useRef(false);

  const runCheck = useCallback(async (trigger: "launch" | "resume" = "launch") => {
    // Update checks are meaningful only on the native Android app.
    // isNativeAndroid() is true for both the Mobile and TV APKs.
    if (!isNativeAndroid()) {
      setState((s) => ({ ...s, checked: true }));
      return;
    }

    // DIAGNOSTIC — record what triggered this check so logs are unambiguous.
    console.log(`[useAppUpdateCheck] ── check triggered by: ${trigger} (platform: ${RELEASE_PLATFORM}) ──`);

    try {
      const installed = await getInstalledAppVersion();
      const result = await checkForUpdate(RELEASE_PLATFORM, installed.buildNumber);

      // DIAGNOSTIC — final state that will be written to context.
      console.log(`[useAppUpdateCheck] result (${trigger}) →`, JSON.stringify({
        trigger,
        platform: RELEASE_PLATFORM,
        installedVersion: installed.version,
        installedBuild: installed.buildNumber,
        latestBuild: result.latestRelease?.build_number ?? null,
        hasUpdate: result.hasUpdate,
        isForceUpdate: result.isForceUpdate,
        latestReleaseId: result.latestRelease?.id ?? null,
      }));

      setState({
        checked: true,
        hasUpdate: result.hasUpdate,
        isForceUpdate: result.isForceUpdate,
        latestRelease: result.latestRelease,
        installedVersion: installed.version,
        installedBuild: installed.buildNumber,
      });
    } catch (err) {
      console.error("[useAppUpdateCheck] update check failed, continuing:", err);
      setState((s) => ({ ...s, checked: true }));
    }
  }, []);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    void runCheck("launch");
  }, [runCheck]);

  return { ...state, recheck: runCheck };
}
