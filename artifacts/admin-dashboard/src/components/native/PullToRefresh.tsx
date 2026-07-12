import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  children: React.ReactNode;
  className?: string;
}

const PULL_THRESHOLD = 64;

/**
 * Wraps the main scrollable admin content area. On native Android,
 * pulling down from the top invalidates the React Query cache so every
 * active query (Orders, Sessions, Bill Requests, Analytics, Tables,
 * Menu, Offers, Gallery, Bookings, Staff, Settings, Dashboard, App
 * Releases…) refetches in place — realtime subscriptions and the
 * WebView are left untouched. Renders children unchanged on
 * web/desktop.
 */
export function PullToRefresh({ children, className }: PullToRefreshProps) {
  const queryClient = useQueryClient();
  const { containerRef, pullDistance, refreshing, isNative } = usePullToRefresh<HTMLDivElement>(
    async () => {
      await queryClient.invalidateQueries();
    },
  );

  if (!isNative) return <>{children}</>;

  const spinProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div ref={containerRef} className={cn("h-full overflow-auto", className)}>
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: pullDistance,
          opacity: spinProgress,
          transition: pullDistance === 0 ? "height 200ms ease, opacity 200ms ease" : undefined,
        }}
      >
        <RefreshCw
          className={cn("h-5 w-5 text-primary", refreshing && "animate-spin")}
          style={!refreshing ? { transform: `rotate(${spinProgress * 360}deg)` } : undefined}
        />
      </div>
      {children}
    </div>
  );
}
