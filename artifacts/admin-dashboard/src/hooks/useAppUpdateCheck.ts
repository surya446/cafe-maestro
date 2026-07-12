/**
 * useAppUpdateCheck
 *
 * Runs once when the native Android app launches (mounted from
 * AdminShell after login). Compares the installed build number
 * against the latest published Android release. Never checks or
 * compares against Android TV releases, and never runs in the
 * browser admin dashboard.
 *
 * Failure-safe: if the check fails for any reason (offline, RPC
 * error, missing table), the app continues normally — it never
 * blocks usage.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { checkForUpdate, type LatestReleaseInfo } from "@/services/releaseService";
import { getInstalledAppVersion } from "@/services/versionService";

export interface AppUpdateState {
  checked: boolean;
  hasUpdate: boolean;
  isForceUpdate: boolean;
  latestRelease: LatestReleaseInfo | null;
  installedVersion: string;
  installedBuild: number;
}

const ANDROID_PLATFORM = "android" as const;

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
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      setState((s) => ({ ...s, checked: true }));
      return;
    }

    // DIAGNOSTIC — record what triggered this check so logs are unambiguous.
    console.log(`[useAppUpdateCheck] ── check triggered by: ${trigger} ──`);

    try {
      const installed = await getInstalledAppVersion();
      const result = await checkForUpdate(ANDROID_PLATFORM, installed.buildNumber);

      // DIAGNOSTIC — final state that will be written to context.
      console.log(`[useAppUpdateCheck] result (${trigger}) →`, JSON.stringify({
        trigger,
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
