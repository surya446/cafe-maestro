/**
 * AppUpdateGate — mounted once inside AdminShell. Runs the Android
 * update check on launch and renders the UpdateDialog when a newer
 * Android release exists. Renders nothing on web / non-Android.
 */

import { useEffect, useState } from "react";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";
import { UpdateDialog } from "./UpdateDialog";

export function AppUpdateGate() {
  const { checked, hasUpdate, isForceUpdate, latestRelease, installedVersion } =
    useAppUpdateCheck();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [latestRelease?.id]);

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
