import { useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionInGroup {
  id: string;
  customerName: string;
  status: "active" | "ended" | "expired";
  createdAt: string;
  expiresAt: string;
  activeDeviceCount: number;
}

export interface TableOverview {
  tableId: string;
  tableNumber: number;
  tableName: string | null;
  groupId: string;
  openedAt: string;
  /** "bill_requested" when a pending bill_request exists for this table */
  tableStatus: "active" | "bill_requested";
  /** Only sessions currently status=active */
  sessions: SessionInGroup[];
  guestCount: number;
  /** Sum of all non-cancelled order items in this group */
  total: number;
  billRequestId: string | null;
  billRequestedAt: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTableGroups() {
  const qc = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ── Query 1: active table_groups with their sessions and devices ───────────
  const { data: rawGroups, isLoading: groupsLoading } = useQuery<any[]>({
    queryKey: ["table_groups_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_groups")
        .select(
          `id, table_id, status, opened_at,
           cafe_tables!table_id (number, name),
           table_sessions!group_id (
             id, customer_name, status, created_at, expires_at,
             session_devices (id, is_active)
           )`
        )
        .eq("status", "active")
        .order("opened_at", { ascending: true });

      if (error) throw error;
      console.log("[RT] Query refetched — table_groups_active, row count:", (data ?? []).length);
      return data ?? [];
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  // ── Derive all session IDs for the orders query ───────────────────────────
  const allGroupSessionIds = useMemo<string[]>(() => {
    return (rawGroups ?? []).flatMap((g: any) =>
      (g.table_sessions ?? []).map((s: any) => s.id)
    );
  }, [rawGroups]);

  // ── Query 2: pending bill requests (for table status) ─────────────────────
  const { data: rawPendingBills } = useQuery<any[]>({
    queryKey: ["table_pending_bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bill_requests")
        .select("id, table_id, status, requested_at")
        .eq("status", "pending");

      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  // ── Query 3: orders with items for all active group sessions (for totals) ──
  const { data: rawOrders } = useQuery<any[]>({
    queryKey: ["table_group_order_totals", allGroupSessionIds],
    queryFn: async () => {
      if (allGroupSessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("id, session_id, status, order_items (quantity, unit_price)")
        .in("session_id", allGroupSessionIds)
        .neq("status", "cancelled");

      if (error) throw error;
      return data ?? [];
    },
    enabled: allGroupSessionIds.length > 0,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  // ── Compute tableOverview ─────────────────────────────────────────────────
  const tableOverview = useMemo<TableOverview[]>(() => {
    return (rawGroups ?? [])
      .map((g: any) => {
        // All sessions in this group (any status)
        const allSessions: SessionInGroup[] = (g.table_sessions ?? []).map(
          (s: any) => ({
            id:                s.id,
            customerName:      s.customer_name ?? "",
            status:            s.status as "active" | "ended" | "expired",
            createdAt:         s.created_at,
            expiresAt:         s.expires_at,
            activeDeviceCount: (s.session_devices ?? []).filter(
              (d: any) => d.is_active
            ).length,
          })
        );

        // Only currently active sessions (can still be ended individually)
        const activeSessions = allSessions.filter((s) => s.status === "active");

        // Sum orders that belong to any session in this group
        const sessionIdSet = new Set(allSessions.map((s) => s.id));
        const groupTotal = (rawOrders ?? [])
          .filter((o: any) => sessionIdSet.has(o.session_id))
          .reduce((sum: number, o: any) => {
            const orderSum = (o.order_items ?? []).reduce(
              (s2: number, oi: any) =>
                s2 + Number(oi.unit_price) * Number(oi.quantity),
              0
            );
            return sum + orderSum;
          }, 0);

        // Check for a pending bill request on this table
        const pendingBill = (rawPendingBills ?? []).find(
          (b: any) => b.table_id === g.table_id
        );

        return {
          tableId:         g.table_id,
          tableNumber:     g.cafe_tables?.number ?? 0,
          tableName:       g.cafe_tables?.name ?? null,
          groupId:         g.id,
          openedAt:        g.opened_at,
          tableStatus:     (pendingBill ? "bill_requested" : "active") as
            "active" | "bill_requested",
          sessions:        activeSessions,
          guestCount:      activeSessions.length,
          total:           groupTotal,
          billRequestId:   pendingBill?.id ?? null,
          billRequestedAt: pendingBill?.requested_at ?? null,
        } satisfies TableOverview;
      })
      .sort((a, b) => a.tableNumber - b.tableNumber);
  }, [rawGroups, rawOrders, rawPendingBills]);

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("table_groups_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_groups" },
        (payload) => {
          console.log("[RT] table_groups event received", payload);
          console.log("[RT] Invalidating query", ["table_groups_active"]);
          qc.invalidateQueries({ queryKey: ["table_groups_active"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_sessions" },
        (payload) => {
          console.log("[RT] table_sessions event received", payload);
          console.log("[RT] Invalidating query", ["table_groups_active"]);
          qc.invalidateQueries({ queryKey: ["table_groups_active"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_devices" },
        (payload) => {
          console.log("[RT] session_devices event received", payload);
          console.log("[RT] Invalidating query", ["table_groups_active"]);
          qc.invalidateQueries({ queryKey: ["table_groups_active"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bill_requests" },
        (payload) => {
          console.log("[RT] bill_requests event received", payload);
          console.log("[RT] Invalidating query", ["table_pending_bills"], ["staff_bill_requests"]);
          qc.invalidateQueries({ queryKey: ["table_pending_bills"] });
          qc.invalidateQueries({ queryKey: ["staff_bill_requests"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          console.log("[RT] orders event received", payload);
          console.log("[RT] Invalidating query", ["table_group_order_totals"]);
          qc.invalidateQueries({
            queryKey: ["table_group_order_totals"],
            exact: false,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        (payload) => {
          console.log("[RT] order_items event received", payload);
          console.log("[RT] Invalidating query", ["table_group_order_totals"]);
          qc.invalidateQueries({
            queryKey: ["table_group_order_totals"],
            exact: false,
          });
        }
      )
      .subscribe((status, err) => {
        console.log("[RT] table_groups_realtime subscription status:", status, err ?? "");
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [qc]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const clearTableMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const { error } = await supabase.rpc("clear_table", {
        p_table_id: tableId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["table_groups_active"] });
      qc.invalidateQueries({ queryKey: ["table_pending_bills"] });
      qc.invalidateQueries({ queryKey: ["staff_sessions"] });
      qc.invalidateQueries({ queryKey: ["staff_bill_requests"] });
    },
  });

  const staffRequestBillMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const { data, error } = await supabase.rpc("staff_request_bill", {
        p_table_id: tableId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["table_pending_bills"] });
      qc.invalidateQueries({ queryKey: ["staff_bill_requests"] });
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc("end_session", {
        p_session_id: sessionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["table_groups_active"] });
      qc.invalidateQueries({ queryKey: ["staff_sessions"] });
    },
  });

  return {
    tableOverview,
    isLoading: groupsLoading,

    clearTable:        clearTableMutation.mutateAsync,
    isClearingTable:   clearTableMutation.isPending,
    clearingTableId:   clearTableMutation.variables as string | undefined,

    staffRequestBill:        staffRequestBillMutation.mutateAsync,
    isRequestingBill:        staffRequestBillMutation.isPending,
    requestingBillTableId:   staffRequestBillMutation.variables as string | undefined,

    endSession:        endSessionMutation.mutateAsync,
    isEndingSession:   endSessionMutation.isPending,
    endingSessionId:   endSessionMutation.variables as string | undefined,
  };
}
