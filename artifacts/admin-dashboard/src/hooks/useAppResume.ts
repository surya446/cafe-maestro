/**
 * useAppResume
 *
 * Native Android "coming back from background" handling:
 *  - Reconnects the Supabase realtime socket.
 *  - Refetches stale React Query data (never a full page/WebView reload).
 *  - Touches the current staff device's `last_seen`.
 *
 * App update checks are handled separately by AppUpdateGate's own
 * resume listener, since it owns that state. No-op on web/desktop.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { supabase } from "@/lib/supabase";
import { isNativeAndroid } from "@/native/platform";
import { touchDeviceLastSeen } from "@/services/deviceService";

export function useAppResume(staffId: string | undefined): void {
  const staffIdRef = useRef(staffId);
  staffIdRef.current = staffId;

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isNativeAndroid()) return;

    let handle: PluginListenerHandle | undefined;
    let cancelled = false;

    void App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return;

      try {
        supabase.realtime.connect();
      } catch (err) {
        console.error("[useAppResume] realtime reconnect failed:", err);
      }

      void queryClient.invalidateQueries();

      const currentStaffId = staffIdRef.current;
      if (currentStaffId) void touchDeviceLastSeen(currentStaffId);
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
  }, [queryClient]);
}
