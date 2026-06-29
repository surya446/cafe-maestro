import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * useNavBadges
 *
 * Owned by NavBadgesProvider (mounted at AdminShell level — always alive).
 * Uses dedicated query keys so it never interferes with the full-data queries
 * used by the page-level hooks (useOrders, useBillRequests, useTableSessions).
 *
 * Queries are COUNT-only (head:true) — zero rows transferred, just a number.
 * One Supabase realtime channel covers all three tables.
 */
export function useNavBadges() {
  const qc = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ── Orders: count pending_approval ────────────────────────────────────────
  const { data: pendingOrderCount = 0 } = useQuery<number>({
    queryKey: ["nav_badge_orders"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_approval");
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  // ── Bill requests: count pending ──────────────────────────────────────────
  const { data: pendingBillCount = 0 } = useQuery<number>({
    queryKey: ["nav_badge_bills"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("bill_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  // ── Sessions: count active non-expired ────────────────────────────────────
  const { data: sessionCount = 0 } = useQuery<number>({
    queryKey: ["nav_badge_sessions"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("table_sessions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  // ── Single realtime channel for all three tables ──────────────────────────
  useEffect(() => {
    const channelName = `nav_badges_rt_${crypto.randomUUID()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => qc.invalidateQueries({ queryKey: ["nav_badge_orders"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bill_requests" },
        () => qc.invalidateQueries({ queryKey: ["nav_badge_bills"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_sessions" },
        () => qc.invalidateQueries({ queryKey: ["nav_badge_sessions"] })
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Catch-up: pick up any changes that arrived during the WebSocket
          // establishment window before the channel was fully subscribed.
          qc.invalidateQueries({ queryKey: ["nav_badge_orders"] });
          qc.invalidateQueries({ queryKey: ["nav_badge_bills"] });
          qc.invalidateQueries({ queryKey: ["nav_badge_sessions"] });
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [qc]);

  return { pendingOrderCount, pendingBillCount, sessionCount };
}
