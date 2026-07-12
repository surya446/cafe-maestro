/**
 * AppUpdateGate — mounted once inside AdminShell. Runs the Android
 * update check on launch and renders the UpdateDialog when a newer
 * Android release exists. Renders nothing on web / non-Android.
 */

import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";
import { isNativeAndroid } from "@/native/platform";
import { UpdateDialog } from "./UpdateDialog";

export function AppUpdateGate() {
  const { checked, hasUpdate, isForceUpdate, latestRelease, installedVersion, recheck } =
    useAppUpdateCheck();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [latestRelease?.id]);

  // Re-check for a newer release whenever the app returns from the
  // background — never on a page/WebView reload.
  useEffect(() => {
    if (!isNativeAndroid()) return;

    let cancelled = false;
    let handle: { remove: () => void } | undefined;

    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void recheck();
    }).then((h) => {
      if (cancelled) {
        void h.remove();
      } else {
        handle = h;
      }
    });

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [recheck]);

  if (!checked || !hasUpdate || !latestRelease) return null;
  if (dismissed && !isForceUpdate) return null;

  return (
    <UpdateDialog
      installedVersion={installedVersion}
      isForceUpdate={isForceUpdate}
      release={latestRelease}
      onDismiss={() => setDismissed(true)}
    />
  );
}
