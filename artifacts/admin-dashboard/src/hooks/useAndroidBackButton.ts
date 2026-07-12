/**
 * useAndroidBackButton
 *
 * Native Android hardware/gesture back button handling:
 *  - If there is SPA navigation history to go back to, go back one
 *    screen (React Router / wouter history).
 *  - If we're already at the root of the navigation stack, invoke
 *    `onExitRequested` instead of letting Capacitor exit immediately.
 *
 * No-op on web/desktop — the browser handles its own back button.
 */

import { useEffect } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { isNativeAndroid } from "@/native/platform";
import {
  getAndroidHistoryDepth,
  goBackOneAndroidHistoryStep,
  installAndroidHistoryDepthTracking,
} from "@/native/androidHistoryDepth";

export function useAndroidBackButton(onExitRequested: () => void): void {
  useEffect(() => {
    if (!isNativeAndroid()) return;

    installAndroidHistoryDepthTracking();

    let handle: PluginListenerHandle | undefined;
    let cancelled = false;

    void App.addListener("backButton", () => {
      if (getAndroidHistoryDepth() > 0) {
        goBackOneAndroidHistoryStep();
      } else {
        onExitRequested();
      }
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
  }, [onExitRequested]);
}
