/**
 * TvApp — root of the Android TV / Kitchen Display System build.
 *
 * Mounted by src/main.tsx when VITE_APP_VARIANT === "tv".
 * Completely replaces App.tsx — no sidebar, no admin dashboard, no
 * mobile navigation.
 *
 * Provider hierarchy (mirrors App.tsx where relevant):
 *   QueryClientProvider  — TanStack Query (reuses shared queryClient)
 *   AppUpdateProvider    — update check against "android-tv" platform
 *                          (isTvApp() is true → RELEASE_PLATFORM = "android-tv")
 *   MandatoryUpdateGate  — blocks the KDS if a force-update is pending;
 *                          no-op on web/desktop
 *   TvKitchenPage        — the Kitchen Display System
 *
 * Phase 3 extension points (inside TvAuthShell):
 *   - PIN-pad login alternative
 *   - Multi-station / kitchen-selector after login
 *   - "Session expired" toast before re-showing the login form
 *
 * Auth note: TvAuthShell gates the kitchen display behind a valid
 * Supabase staff session. On first launch (or after WebView data is
 * cleared) it shows TvLoginScreen. Once signed in, persistSession:true
 * keeps the session alive across restarts via the WebView localStorage.
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import { AppUpdateProvider } from "@/context/AppUpdateContext";
import { MandatoryUpdateGate } from "@/components/updates/MandatoryUpdateGate";
import { TvAuthShell } from "./TvAuthShell";
import { TvKitchenPage } from "./TvKitchenPage";

export default function TvApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppUpdateProvider>
        <MandatoryUpdateGate>
          <TvAuthShell>
            <TvKitchenPage />
          </TvAuthShell>
        </MandatoryUpdateGate>
      </AppUpdateProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
