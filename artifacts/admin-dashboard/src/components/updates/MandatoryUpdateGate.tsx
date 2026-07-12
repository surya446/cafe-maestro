/**
 * MandatoryUpdateGate — mounted once at the app root, wrapping
 * everything (including the login/public routes). This is what makes
 * the update "TRUE mandatory": while a force-update is pending, the
 * entire app — not just the authenticated area — is replaced by
 * MandatoryUpdateScreen. Also owns AndroidBackHandler so the hardware
 * back button can be disabled while blocked.
 *
 * A no-op on web/desktop: useAppUpdateContext() reports hasUpdate:
 * false there (see useAppUpdateCheck).
 */

import type { ReactNode } from "react";
import { AndroidBackHandler } from "@/components/native/AndroidBackHandler";
import { useAppUpdateContext } from "@/context/AppUpdateContext";
import { isNativeAndroid } from "@/native/platform";
import { MandatoryUpdateScreen } from "./MandatoryUpdateScreen";

function UpdateCheckSplash() {
  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function MandatoryUpdateGate({ children }: { children: ReactNode }) {
  const { checked, hasUpdate, isForceUpdate, latestRelease, installedVersion, installedBuild } =
    useAppUpdateContext();

  const blocked = checked && hasUpdate && isForceUpdate && !!latestRelease;

  // Never show any screen — including the login page — until we know
  // for certain whether a mandatory update is required. Web/desktop
  // always has `checked: true` on the first render, so this never
  // shows there.
  const awaitingFirstCheck = !checked && isNativeAndroid();

  return (
    <>
      <AndroidBackHandler disabled={blocked} />
      {awaitingFirstCheck ? (
        <UpdateCheckSplash />
      ) : blocked ? (
        <MandatoryUpdateScreen
          installedVersion={installedVersion}
          installedBuild={installedBuild}
          release={latestRelease!}
        />
      ) : (
        children
      )}
    </>
  );
}
