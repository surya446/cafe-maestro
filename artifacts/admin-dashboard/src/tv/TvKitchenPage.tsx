/**
 * TvKitchenPage — the main Kitchen Display System screen.
 *
 * Reuses:
 *   useOrders()        — order data + real-time subscription + mutations
 *   useAuth()          — cafe name from authenticated staff session
 *   useNetworkStatus() — online/offline detection (Capacitor Network)
 *   useAppResume()     — reconnects Supabase realtime when app foregrounds
 *   supabase           — direct query for "completed today" count
 *
 * No new data models. No duplicated business logic.
 *
 * Layout (1080p TV-optimised):
 *   Fixed top bar (88px)
 *   Optional offline banner
 *   Scrollable order grid (auto-fill, min 380px per card)
 *   Pagination controls when > ORDERS_PER_PAGE active orders
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrders } from "@/hooks/useOrders";
import { useAuth } from "@/hooks/useAuth";
import { useAppResume } from "@/hooks/useAppResume";
import { TvTopBar, TV_BAR_HEIGHT } from "./TvTopBar";
import { TvOfflineBanner } from "./TvOfflineBanner";
import { TvOrderCard } from "./TvOrderCard";
import { TvEmptyState } from "./TvEmptyState";
import { TvLoadingScreen } from "./TvLoadingScreen";

// How many cards to show per page on the TV grid.
// 9 = 3 columns × 3 rows, fits comfortably on 1080p at ~380px min card width.
const ORDERS_PER_PAGE = 9;
// Auto-advance to the next page every N seconds when paginating.
const AUTO_ADVANCE_SECONDS = 10;

// ── Completed-today count query ───────────────────────────────────────────────

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

// ── Pagination controls ───────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

function TvPagination({ page, totalPages, onPrev, onNext }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        padding: "20px 0 8px",
        userSelect: "none",
      }}
    >
      <button
        onClick={onPrev}
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "12px",
          backgroundColor: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#9ca3af",
          fontSize: "1.5rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background-color 0.15s",
        }}
        aria-label="Previous page"
      >
        ‹
      </button>

      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: "1rem", color: "#6b7280", fontWeight: 500 }}>
          Page {page} of {totalPages}
        </span>
      </div>

      <button
        onClick={onNext}
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "12px",
          backgroundColor: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#9ca3af",
          fontSize: "1.5rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background-color 0.15s",
        }}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TvKitchenPage() {
  const { user } = useAuth();
  const { orders, pendingOrders, preparingOrders, readyOrders, isLoading, updateStatus, isUpdating } =
    useOrders();
  const completedToday = useTvCompletedToday();

  // Reconnect Supabase realtime + invalidate queries when app returns to
  // foreground (native Android only; no-op on web).
  useAppResume(user?.id);

  // Active orders sorted newest-first within each status column is handled
  // by useOrders already (created_at ascending = oldest first, which is
  // correct for a kitchen — oldest orders need attention first).
  const activeOrders = orders;

  // ── Pagination ──────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(activeOrders.length / ORDERS_PER_PAGE));

  // Reset to page 1 if the total changes and current page is out of range.
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  // Auto-advance to next page when paginating (cycles back to first).
  useEffect(() => {
    if (totalPages <= 1) return;
    const id = setInterval(() => {
      setPage((p) => (p >= totalPages ? 1 : p + 1));
    }, AUTO_ADVANCE_SECONDS * 1000);
    return () => clearInterval(id);
  }, [totalPages]);

  const pageOrders = activeOrders.slice(
    (page - 1) * ORDERS_PER_PAGE,
    page * ORDERS_PER_PAGE
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#080a0d",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar (fixed) */}
      <TvTopBar
        cafeName={user?.cafeName ?? ""}
        pending={pendingOrders.length}
        preparing={preparingOrders.length}
        ready={readyOrders.length}
        completedToday={completedToday}
      />

      {/* Content area — offset by top bar height */}
      <div
        style={{
          marginTop: `${TV_BAR_HEIGHT}px`,
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: `calc(100vh - ${TV_BAR_HEIGHT}px)`,
        }}
      >
        {/* Offline banner (stacks below top bar) */}
        <TvOfflineBanner />

        {/* Loading */}
        {isLoading && <TvLoadingScreen />}

        {/* Empty state */}
        {!isLoading && activeOrders.length === 0 && <TvEmptyState />}

        {/* Order grid */}
        {!isLoading && activeOrders.length > 0 && (
          <div style={{ padding: "24px 28px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
                gap: "20px",
                flex: 1,
                alignContent: "start",
              }}
            >
              {pageOrders.map((order) => (
                <TvOrderCard
                  key={order.id}
                  order={order}
                  onUpdate={updateStatus}
                  isUpdating={isUpdating}
                />
              ))}
            </div>

            {/* Pagination */}
            <TvPagination
              page={page}
              totalPages={totalPages}
              onPrev={() => setPage((p) => (p <= 1 ? totalPages : p - 1))}
              onNext={() => setPage((p) => (p >= totalPages ? 1 : p + 1))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
