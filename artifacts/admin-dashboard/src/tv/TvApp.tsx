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
 * Phase 3 will add:
 *   TvAuthShell          — TV-native login (staff pin / email)
 *   TvUpdateUI           — download progress for Android TV APK updates
 *   Kitchen selector     — multi-station support
 *
 * Phase 2 note: the KDS launches directly into the kitchen display.
 * If there is no active Supabase auth session the order query returns
 * empty (RLS blocks unauthenticated reads) and the empty-state screen
 * is shown. Phase 3 adds a dedicated TV login flow.
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import { AppUpdateProvider } from "@/context/AppUpdateContext";
import { MandatoryUpdateGate } from "@/components/updates/MandatoryUpdateGate";
import { TvKitchenPage } from "./TvKitchenPage";

export default function TvApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppUpdateProvider>
        <MandatoryUpdateGate>
          <TvKitchenPage />
        </MandatoryUpdateGate>
      </AppUpdateProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
