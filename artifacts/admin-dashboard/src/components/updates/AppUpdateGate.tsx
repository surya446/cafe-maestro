/**
 * AppUpdateGate — mounted inside AdminShell (authenticated area only).
 * Shows the dismissible "update available" dialog for OPTIONAL Android
 * releases (is_force_update = false). Mandatory releases never reach
 * this component — MandatoryUpdateGate (mounted at the app root, wraps
 * even the login screen) fully blocks the app before anything else
 * renders in that case. Renders nothing on web / non-Android.
 *
 * Reads from the shared AppUpdateContext so the update check runs
 * exactly once per launch/resume, not once per gate.
 */

import { useEffect, useState } from "react";
import { useAppUpdateContext } from "@/context/AppUpdateContext";
import { UpdateDialog } from "./UpdateDialog";

export function AppUpdateGate() {
  const { checked, hasUpdate, isForceUpdate, latestRelease, installedVersion } =
    useAppUpdateContext();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [latestRelease?.id]);

  if (!checked || !hasUpdate || !latestRelease) return null;
  if (isForceUpdate) return null; // handled by MandatoryUpdateGate at the app root
  if (dismissed) return null;

  return (
    <UpdateDialog
      installedVersion={installedVersion}
      isForceUpdate={false}
      release={latestRelease}
      onDismiss={() => setDismissed(true)}
    />
  );
}
