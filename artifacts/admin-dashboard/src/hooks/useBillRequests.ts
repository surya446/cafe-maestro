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
    const channel = supabase
      .channel(`staff_bill_requests_rt_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bill_requests" },
        () => qc.invalidateQueries({ queryKey: ["staff_bill_requests"] })
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [qc]);

  const acknowledgeMutation = useMutation({
    mutationFn: async (billRequestId: string) => {
      const { error } = await supabase
        .from("bill_requests")
        .update({
          status: "acknowledged",
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", billRequestId);

      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff_bill_requests"] }),
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
    acknowledge: acknowledgeMutation.mutateAsync,
    isAcknowledging: acknowledgeMutation.isPending,
    acknowledgingId: acknowledgeMutation.variables as string | undefined,
  };
}
