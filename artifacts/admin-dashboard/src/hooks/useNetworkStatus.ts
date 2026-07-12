/**
 * useNetworkStatus
 *
 * Native Android connectivity tracking for the offline banner. No-op
 * (always reports online) on web/desktop.
 */

import { useEffect, useState } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { isNativeAndroid } from "@/native/platform";

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (!isNativeAndroid()) return;

    let handle: PluginListenerHandle | undefined;
    let cancelled = false;

    void Network.getStatus().then((status) => {
      if (!cancelled) setIsOnline(status.connected);
    });

    void Network.addListener("networkStatusChange", (status) => {
      setIsOnline(status.connected);
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
  }, []);

  return isOnline;
}
