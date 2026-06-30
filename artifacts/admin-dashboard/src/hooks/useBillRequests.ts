import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type BillStatus = "pending" | "acknowledged";

export interface BillRequest {
  id: string;
  cafeId: string;
  sessionId: string;
  tableId: string;
  tableNumber: number;
  tableName: string | null;
  status: BillStatus;
  requestedAt: string;
  acknowledgedAt: string | null;
}

export function useBillRequests() {
  const qc = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const { data: billRequests = [], isLoading } = useQuery<BillRequest[]>({
    queryKey: ["staff_bill_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bill_requests")
        .select(
          `id, cafe_id, session_id, table_id,
           status, requested_at, acknowledged_at,
           cafe_tables (number, name)`
        )
        .order("requested_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data ?? []).map((br: any) => ({
        id: br.id,
        cafeId: br.cafe_id,
        sessionId: br.session_id,
        tableId: br.table_id,
        tableNumber: br.cafe_tables?.number ?? 0,
        tableName: br.cafe_tables?.name ?? null,
        status: br.status as BillStatus,
        requestedAt: br.requested_at,
        acknowledgedAt: br.acknowledged_at ?? null,
      }));
    },
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    const channelName = `staff_bill_requests_rt_${crypto.randomUUID()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bill_requests" },
        () => qc.invalidateQueries({ queryKey: ["staff_bill_requests"] })
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Catch-up: pick up any bill requests that arrived during the
          // WebSocket establishment window (~100–1000ms). Without this,
          // a request_bill RPC that commits before SUBSCRIBED is confirmed
          // would be silently dropped and only caught by the 10s poll.
          qc.invalidateQueries({ queryKey: ["staff_bill_requests"] });
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [qc]);

  // Delivering the bill calls clear_table(), which atomically:
  //   1. Ends all active sessions on the table
  //   2. Deactivates all session devices (guests see "Session Ended" instantly)
  //   3. Acknowledges any pending bill request for the table
  //   4. Marks the table_group as cleared
  //
  // This reuses the same RPC the admin "Clear Table" button uses,
  // so there is no duplicated session-ending logic.
  const deliverBillMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const { error } = await supabase.rpc("clear_table", {
        p_table_id: tableId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff_bill_requests"] });
      qc.invalidateQueries({ queryKey: ["staff_sessions"] });
      qc.invalidateQueries({ queryKey: ["staff_tables"] });
      // Nav badge queries use RLS-filtered realtime, but the session UPDATE
      // (active → ended) fails the RLS check on the new row, so the realtime
      // event is dropped server-side. Explicit invalidation here guarantees
      // the counts drop immediately after bill delivery.
      qc.invalidateQueries({ queryKey: ["nav_badge_sessions"] });
      qc.invalidateQueries({ queryKey: ["nav_badge_bills"] });
    },
  });

  const pendingBills = billRequests.filter((b) => b.status === "pending");
  const acknowledgedBills = billRequests.filter(
    (b) => b.status === "acknowledged"
  );

  return {
    billRequests,
    pendingBills,
    acknowledgedBills,
    isLoading,
    deliverBill: deliverBillMutation.mutateAsync,
    isDelivering: deliverBillMutation.isPending,
    deliveringTableId: deliverBillMutation.variables as string | undefined,
  };
}
