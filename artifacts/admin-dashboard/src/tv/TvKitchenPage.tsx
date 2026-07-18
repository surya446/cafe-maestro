/**
 * TvKitchenPage — Kitchen Display System main screen.
 *
 * Display-only: no status mutations from the TV.
 * Kitchen staff update orders via the staff dashboard; this screen
 * reflects changes instantly via the existing useOrders realtime hook.
 *
 * Scrolling:
 *   Auto-scroll: slow continuous downward crawl → 3 s pause at bottom →
 *               snap back to top → repeat.
 *   Manual:     wheel / touch / trackpad pauses auto-scroll for 20 s,
 *               then resumes automatically.
 *
 * Grid: 4 columns × N rows — shows 8–12 orders on a 1920×1080 screen.
 */

import { useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrders } from "@/hooks/useOrders";
import { useAuth } from "@/hooks/useAuth";
import { useAppResume } from "@/hooks/useAppResume";
import { TvTopBar } from "./TvTopBar";
import { TV_BAR_HEIGHT } from "./tvConstants";
import { TvOfflineBanner } from "./TvOfflineBanner";
import { TvOrderCard } from "./TvOrderCard";
import { TvEmptyState } from "./TvEmptyState";
import { TvLoadingScreen } from "./TvLoadingScreen";

// ── Completed-today count ─────────────────────────────────────────────────────

function useTvCompletedToday(): number {
  const { data = 0 } = useQuery({
    queryKey: ["tv_completed_today"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "served")
        .gte("created_at", today.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });
  return data;
}

// ── Scroll constants ──────────────────────────────────────────────────────────

// px scrolled per tick (tick = SCROLL_INTERVAL ms) — keeps the crawl slow.
const SCROLL_PX_PER_TICK = 1;
// ms between scroll ticks.
const SCROLL_INTERVAL_MS = 40; // ~25 px/s
// ms to pause at the bottom before snapping to top.
const PAUSE_AT_BOTTOM_MS = 3_000;
// ms to pause after snapping back to top.
const PAUSE_AFTER_SNAP_MS = 1_500;
// ms of inactivity after a manual scroll before auto-scroll resumes.
const MANUAL_SCROLL_RESUME_MS = 20_000;

// ── Main page ─────────────────────────────────────────────────────────────────

export function TvKitchenPage() {
  const { user } = useAuth();
  const { orders, pendingOrders, preparingOrders, readyOrders, isLoading } =
    useOrders();
  const completedToday = useTvCompletedToday();

  // ── DIAGNOSTIC: log every order as it reaches the page component.
  //    Remove once the root cause is confirmed.
  useEffect(() => {
    if (!isLoading) {
      console.group("[TvKitchenPage] orders after useOrders mapping");
      console.log("total orders:", orders.length);
      orders.forEach((o, idx) => {
        console.log(
          `order[${idx}] id=${o.id} status=${o.status}` +
          ` items.length=${o.items.length}` +
          ` items=${JSON.stringify(o.items)}`
        );
      });
      console.groupEnd();
    }
  }, [orders, isLoading]);

  useAppResume(user?.id);

  // ── Scroll refs ──────────────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  // Timestamp until which auto-scroll is paused (Date.now() based).
  const pauseUntilRef = useRef(0);
  // Whether we just triggered a snap-to-top (prevents double-trigger).
  const wasAtBottomRef = useRef(false);
  // Timeout handle for resuming auto-scroll after manual interaction.
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether the user is actively suppressing auto-scroll.
  const userScrollingRef = useRef(false);

  // Pause auto-scroll on user interaction, resume after MANUAL_SCROLL_RESUME_MS.
  const handleUserScroll = useCallback(() => {
    userScrollingRef.current = true;
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, MANUAL_SCROLL_RESUME_MS);
  }, []);

  // Auto-scroll loop.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const id = setInterval(() => {
      if (userScrollingRef.current) return;

      const now = Date.now();
      if (now < pauseUntilRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = el;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 4;

      if (atBottom && !wasAtBottomRef.current) {
        // Just reached bottom — pause before snapping to top.
        wasAtBottomRef.current = true;
        pauseUntilRef.current = now + PAUSE_AT_BOTTOM_MS;
        return;
      }

      if (wasAtBottomRef.current) {
        // Pause elapsed — snap to top, brief pause.
        wasAtBottomRef.current = false;
        el.scrollTop = 0;
        pauseUntilRef.current = now + PAUSE_AFTER_SNAP_MS;
        return;
      }

      el.scrollTop += SCROLL_PX_PER_TICK;
    }, SCROLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, []);

  // Cleanup resume timeout on unmount.
  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        height: "100vh",
        backgroundColor: "#111827",
        color: "#F9FAFB",
        fontFamily:
          "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Fixed top bar */}
      <TvTopBar
        cafeName={user?.cafeName ?? ""}
        pending={pendingOrders.length}
        preparing={preparingOrders.length}
        ready={readyOrders.length}
        completedToday={completedToday}
      />

      {/* Scrollable content area */}
      <div
        ref={scrollRef}
        onWheel={handleUserScroll}
        onTouchStart={handleUserScroll}
        onPointerDown={handleUserScroll}
        style={{
          marginTop: `${TV_BAR_HEIGHT}px`,
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
        }}
      >
        {/* Offline banner */}
        <TvOfflineBanner />

        {/* Loading */}
        {isLoading && <TvLoadingScreen />}

        {/* Empty state */}
        {!isLoading && orders.length === 0 && <TvEmptyState />}

        {/* Order grid */}
        {!isLoading && orders.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "14px",
              padding: "16px 20px 24px",
            }}
          >
            {orders.map((order) => (
              <TvOrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>

      {/* Hide scrollbar in WebKit */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
