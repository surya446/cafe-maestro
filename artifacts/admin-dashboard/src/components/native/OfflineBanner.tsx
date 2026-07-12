import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { isNativeAndroid } from "@/native/platform";

/**
 * Persistent (non-toast) offline indicator for native Android. Shows
 * once while offline, hides and refetches stale queries the moment
 * connectivity returns. `useNetworkStatus` is already a no-op on
 * web/desktop so this component never renders there.
 */
export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const wasOffline = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      void queryClient.invalidateQueries();
    }
  }, [isOnline, queryClient]);

  if (!isNativeAndroid() || isOnline) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-1.5 bg-destructive py-1.5 text-xs font-medium text-destructive-foreground"
      style={{ paddingTop: "calc(0.375rem + env(safe-area-inset-top))" }}
      role="status"
    >
      <WifiOff className="h-3.5 w-3.5" />
      You're offline — showing saved data
    </div>
  );
}
