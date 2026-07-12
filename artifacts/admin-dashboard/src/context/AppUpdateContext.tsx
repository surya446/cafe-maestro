/**
 * AppUpdateContext
 *
 * Single source of truth for the Android update-check result, shared
 * by:
 *   - MandatoryUpdateGate (blocks the entire app when is_force_update)
 *   - AppUpdateGate (shows a dismissible "update available" dialog
 *     for optional/non-forced releases, mounted inside AdminShell)
 *
 * Runs the check exactly once per mount and re-runs it whenever the
 * native Android app returns from the background, so both consumers
 * always see the same result instead of issuing duplicate RPC calls.
 * A no-op on web/desktop (useAppUpdateCheck resolves immediately with
 * hasUpdate: false there).
 */

import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { useAppUpdateCheck, type AppUpdateState } from "@/hooks/useAppUpdateCheck";
import { isNativeAndroid } from "@/native/platform";

interface AppUpdateContextValue extends AppUpdateState {
  recheck: (trigger?: "launch" | "resume") => Promise<void>;
}

const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const state = useAppUpdateCheck();
  const { recheck } = state;

  useEffect(() => {
    if (!isNativeAndroid()) return;

    let handle: PluginListenerHandle | undefined;
    let cancelled = false;

    void App.addListener("appStateChange", ({ isActive }) => {
      // DIAGNOSTIC — log every resume event so we can see when recheck fires.
      console.log(`[AppUpdateContext] appStateChange isActive=${isActive}`);
      if (isActive) void recheck("resume");
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

  return <AppUpdateContext.Provider value={state}>{children}</AppUpdateContext.Provider>;
}

export function useAppUpdateContext(): AppUpdateContextValue {
  const ctx = useContext(AppUpdateContext);
  if (!ctx) {
    throw new Error("useAppUpdateContext must be used within AppUpdateProvider");
  }
  return ctx;
}
