/**
 * TvKitchenPage — Kitchen Display System main screen.
 *
 * Display-only: no status mutations from the TV.
 * Kitchen staff update orders via the staff dashboard; this screen
 * reflects changes instantly via the existing useOrders realtime hook.
 *
 * ── Layout ────────────────────────────────────────────────────────────────────
 *   4-column CSS grid with align-items: start — each card grows to fit its
 *   items. Cards of different heights sit correctly without overlapping.
 *
 * ── Board scrolling ───────────────────────────────────────────────────────────
 *   The ENTIRE BOARD scrolls (not individual cards). Individual cards never
 *   have scrollbars — their content is always fully visible.
 *
 * ── Auto-scroll (requestAnimationFrame state machine) ─────────────────────────
 *   Phase 1  DOWN         Smooth crawl at 25 px/s.
 *   Phase 2  PAUSE-BOTTOM Hold at bottom for 2 s.
 *   Phase 3  RETURN       Ease-in-out animation back to top (2 s).
 *   Phase 4  PAUSE-TOP    Hold at top for 1.5 s, then repeat.
 *
 *   RAF is used instead of setInterval to keep animation smooth and avoid
 *   layout thrashing — one rAF callback reads scrollTop once per frame.
 *
 * ── Manual override ───────────────────────────────────────────────────────────
 *   Any wheel / touch / pointer / D-pad key event pauses auto-scroll for
 *   exactly 4 s from the last input. The timer resets on each new input.
 *   After 4 s of silence the auto-scroll resumes from the current position.
 *
 * ── Remote-control focus ──────────────────────────────────────────────────────
 *   Cards have tabIndex={0} (set in TvOrderCard). When a card receives focus
 *   the board scrolls to ensure the card is fully visible (smooth, no jump).
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

// ── Auto-scroll constants ─────────────────────────────────────────────────────

/** Downward crawl speed in pixels per second. */
const SCROLL_SPEED_PX_S = 25;
/** Hold duration at the bottom before returning to top (ms). */
const PAUSE_BOTTOM_MS = 2_000;
/** Hold duration after returning to top before resuming downward (ms). */
const PAUSE_TOP_MS = 1_500;
/** Smooth return-to-top animation duration (ms). */
const RETURN_DURATION_MS = 2_000;
/** Inactivity window after the last manual input before auto-scroll resumes (ms). */
const MANUAL_RESUME_DELAY_MS = 4_000;

// ── Easing ───────────────────────────────────────────────────────────────────

/** Smooth cubic ease-in-out — used for the return-to-top animation. */
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TvKitchenPage() {
  const { user } = useAuth();
  const { orders, pendingOrders, preparingOrders, readyOrders, isLoading } =
    useOrders();
  const completedToday = useTvCompletedToday();

  useAppResume(user?.id);

  // ── Scroll container ref ───────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Auto-scroll state (all refs — no React re-renders needed) ─────────────
  type Phase = "down" | "pause-bottom" | "return" | "pause-top";
  const phaseRef        = useRef<Phase>("down");
  const phaseStartRef   = useRef(0);       // timestamp when current phase began
  const returnFromYRef  = useRef(0);       // scrollTop captured at start of return
  const rafIdRef        = useRef(0);
  const lastFrameRef    = useRef<number | null>(null);

  /** Epoch ms until which auto-scroll is suppressed by manual input. */
  const manualPauseUntil = useRef(0);
  const manualResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Manual-input handler ───────────────────────────────────────────────────
  /**
   * Called on any user interaction (wheel, touch, pointer, D-pad key).
   * Extends the manual pause window by MANUAL_RESUME_DELAY_MS from NOW.
   * Resets on every input so the timer always counts from the last key press.
   */
  const handleManualInput = useCallback(() => {
    manualPauseUntil.current = Date.now() + MANUAL_RESUME_DELAY_MS;
    if (manualResumeTimer.current) clearTimeout(manualResumeTimer.current);
    manualResumeTimer.current = setTimeout(() => {
      // Timer expires naturally; manualPauseUntil is already in the past.
    }, MANUAL_RESUME_DELAY_MS);
  }, []);

  // ── Remote-control D-pad key handler ──────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        handleManualInput();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleManualInput]);

  // ── Auto-scroll RAF loop ───────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function tick(now: number) {
      rafIdRef.current = requestAnimationFrame(tick);

      const dt = lastFrameRef.current !== null ? now - lastFrameRef.current : 0;
      lastFrameRef.current = now;

      // Suppress during manual input
      if (now < manualPauseUntil.current) return;

      const { scrollTop, scrollHeight, clientHeight } = el!;
      const maxScroll = scrollHeight - clientHeight;

      // Nothing to scroll — reset phase and wait.
      if (maxScroll <= 2) {
        phaseRef.current = "down";
        return;
      }

      switch (phaseRef.current) {
        case "down": {
          const next = scrollTop + SCROLL_SPEED_PX_S * (dt / 1000);
          if (next >= maxScroll) {
            el!.scrollTop = maxScroll;
            phaseRef.current = "pause-bottom";
            phaseStartRef.current = now;
          } else {
            el!.scrollTop = next;
          }
          break;
        }

        case "pause-bottom": {
          if (now - phaseStartRef.current >= PAUSE_BOTTOM_MS) {
            phaseRef.current = "return";
            phaseStartRef.current = now;
            returnFromYRef.current = el!.scrollTop;
          }
          break;
        }

        case "return": {
          const elapsed = now - phaseStartRef.current;
          const t = Math.min(elapsed / RETURN_DURATION_MS, 1);
          // Interpolate from returnFromY → 0 with easing.
          el!.scrollTop = returnFromYRef.current * (1 - easeInOutCubic(t));
          if (t >= 1) {
            el!.scrollTop = 0;
            phaseRef.current = "pause-top";
            phaseStartRef.current = now;
          }
          break;
        }

        case "pause-top": {
          if (now - phaseStartRef.current >= PAUSE_TOP_MS) {
            phaseRef.current = "down";
            lastFrameRef.current = now; // reset dt so the first tick doesn't jump
          }
          break;
        }
      }
    }

    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafIdRef.current);
      lastFrameRef.current = null;
    };
  }, []);

  // ── Cleanup manual-resume timer on unmount ─────────────────────────────────
  useEffect(() => {
    return () => {
      if (manualResumeTimer.current) clearTimeout(manualResumeTimer.current);
    };
  }, []);

  // ── Focus handler: scroll focused card fully into view ────────────────────
  /**
   * When the TV remote focuses a card (tabIndex={0} on TvOrderCard), this
   * handler ensures the board scrolls so the card is fully visible.
   * Uses getBoundingClientRect for accurate position relative to the viewport,
   * then adjusts scrollTop accordingly.
   */
  const handleFocus = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const card = (e.target as HTMLElement).closest(
      "[data-kds-card]"
    ) as HTMLElement | null;
    if (!card || !scrollRef.current) return;

    // Pause auto-scroll immediately when the user navigates
    handleManualInput();

    const el = scrollRef.current;
    const containerRect = el.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const MARGIN = 20; // px clearance above/below the focused card

    // Card top/bottom relative to the scroll container's visible area
    const relTop = cardRect.top - containerRect.top;
    const relBottom = cardRect.bottom - containerRect.top;

    if (relTop < MARGIN) {
      // Card is above the visible area — scroll up
      el.scrollTo({
        top: el.scrollTop + relTop - MARGIN,
        behavior: "smooth",
      });
    } else if (relBottom > el.clientHeight - MARGIN) {
      // Card is below the visible area — scroll down
      el.scrollTo({
        top: el.scrollTop + (relBottom - el.clientHeight + MARGIN),
        behavior: "smooth",
      });
    }
  }, [handleManualInput]);

  // ── Render ────────────────────────────────────────────────────────────────
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

      {/*
       * Scrollable board — the ENTIRE BOARD scrolls here.
       * Individual order cards never scroll internally.
       * onFocus bubbles up from focused cards via handleFocus.
       */}
      <div
        ref={scrollRef}
        onWheel={handleManualInput}
        onTouchStart={handleManualInput}
        onPointerDown={handleManualInput}
        onFocus={handleFocus}
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

        {/*
         * Order grid
         * align-items: start — each card takes its natural height.
         * Cards in the same row do NOT stretch to match the tallest card.
         * This prevents empty space inside shorter cards and keeps the
         * layout honest about content size.
         */}
        {!isLoading && orders.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              alignItems: "start",
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

      {/* Hide scrollbar in WebKit (Android TV) */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
