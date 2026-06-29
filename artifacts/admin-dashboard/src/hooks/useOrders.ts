import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type OrderStatus =
  | "pending_approval"
  | "approved"
  | "in_kitchen"
  | "ready"
  | "served"
  | "cancelled";

export interface StaffOrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
}

export interface StaffOrder {
  id: string;
  cafeId: string;
  sessionId: string;
  tableId: string;
  tableNumber: number | null;
  tableName: string | null;
  customerName: string;
  status: OrderStatus;
  staffNote: string | null;
  createdAt: string;
  updatedAt: string;
  items: StaffOrderItem[];
  total: number;
}

const ACTIVE_STATUSES: OrderStatus[] = [
  "pending_approval",
  "approved",
  "in_kitchen",
  "ready",
];

// ─── Tracing helper ───────────────────────────────────────────────────────────

function trace(msg: string) {
  console.log(`[ORDER TRACE] ${performance.now().toFixed(1)} ms — ${msg}`);
}

export function useOrders() {
  const qc = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const { data: orders = [], isLoading } = useQuery<StaffOrder[]>({
    queryKey: ["staff_orders"],
    queryFn: async () => {
      const t0 = performance.now();
      trace("React Query refetch started");

      const { data, error } = await supabase
        .from("orders")
        .select(
          `id, cafe_id, session_id, table_id, status, staff_note,
           created_at, updated_at,
           cafe_tables (number, name),
           table_sessions (customer_name),
           order_items (
             id, menu_item_id, quantity, unit_price, notes,
             menu_items (name)
           )`
        )
        .in("status", ACTIVE_STATUSES)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const rows = (data ?? []).map((o: any) => {
        const items: StaffOrderItem[] = (o.order_items ?? []).map((oi: any) => ({
          id:          oi.id,
          menuItemId:  oi.menu_item_id,
          name:        oi.menu_items?.name ?? "Unknown item",
          quantity:    oi.quantity,
          unitPrice:   Number(oi.unit_price),
          notes:       oi.notes ?? null,
        }));

        return {
          id:           o.id,
          cafeId:       o.cafe_id,
          sessionId:    o.session_id,
          tableId:      o.table_id,
          tableNumber:  o.cafe_tables?.number ?? null,
          tableName:    o.cafe_tables?.name ?? null,
          customerName: o.table_sessions?.customer_name ?? "",
          status:       o.status as OrderStatus,
          staffNote:    o.staff_note ?? null,
          createdAt:    o.created_at,
          updatedAt:    o.updated_at,
          items,
          total: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
        };
      });

      trace(`React Query refetch completed — ${rows.length} rows (${(performance.now() - t0).toFixed(1)} ms)`);
      return rows;
    },
    refetchInterval: 12_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    trace("Realtime channel subscribing");

    const channel = supabase
      .channel(`staff_orders_rt_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          trace(`Realtime event received (orders) — event=${payload.eventType} order_id=${(payload.new as any)?.id ?? (payload.old as any)?.id ?? "?"}`);
          trace("invalidateQueries called");
          qc.invalidateQueries({ queryKey: ["staff_orders"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        (payload) => {
          trace(`Realtime event received (order_items) — event=${payload.eventType} order_id=${(payload.new as any)?.order_id ?? "?"}`);
          trace("invalidateQueries called");
          qc.invalidateQueries({ queryKey: ["staff_orders"] });
        }
      )
      .subscribe((status, err) => {
        // ── Status callback: the critical missing piece ────────────────────
        //
        // This callback fires on every channel state transition:
        //   SUBSCRIBING  → initial handshake in progress
        //   SUBSCRIBED   → channel is live and receiving events
        //                  also fires after every WebSocket RECONNECT
        //   CHANNEL_ERROR → server-side problem (auth, overload, etc.)
        //   TIMED_OUT    → heartbeat missed; client will attempt to reconnect
        //   CLOSED       → channel was explicitly removed
        //
        // ROOT CAUSE FIX:
        //   Previously .subscribe() had no callback, so when the WebSocket
        //   reconnected after any disruption the channel silently re-entered
        //   SUBSCRIBING → SUBSCRIBED with no code reacting. Any INSERT that
        //   occurred during that reconnection window was permanently missed.
        //
        //   By invalidating on every SUBSCRIBED transition we fill the gap:
        //   the first refetch after reconnect fetches everything committed
        //   while the channel was dark, making the eventual-consistency
        //   window as short as a single round-trip.

        if (status === "SUBSCRIBED") {
          trace("Realtime channel SUBSCRIBED — invalidating to fill reconnect gap");
          qc.invalidateQueries({ queryKey: ["staff_orders"] });
        } else if (status === "CHANNEL_ERROR") {
          trace(`Realtime channel CHANNEL_ERROR — ${String(err ?? "unknown")}`);
        } else if (status === "TIMED_OUT") {
          trace("Realtime channel TIMED_OUT — Supabase client will reconnect");
        } else {
          trace(`Realtime channel status: ${status}`);
        }
      });

    channelRef.current = channel;
    return () => {
      trace("Realtime channel cleanup");
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [qc]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
      staffNote,
    }: {
      orderId: string;
      status: OrderStatus;
      staffNote?: string | null;
    }) => {
      const patch: Record<string, unknown> = { status };
      if (staffNote !== undefined) patch.staff_note = staffNote;
      if (status === "approved")   patch.approved_at   = new Date().toISOString();
      if (status === "cancelled")  patch.cancelled_at  = new Date().toISOString();

      const { error } = await supabase
        .from("orders")
        .update(patch)
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff_orders"] }),
  });

  const pendingOrders  = orders.filter((o) => o.status === "pending_approval");
  const preparingOrders = orders.filter(
    (o) => o.status === "approved" || o.status === "in_kitchen"
  );
  const readyOrders = orders.filter((o) => o.status === "ready");

  return {
    orders,
    pendingOrders,
    preparingOrders,
    readyOrders,
    isLoading,
    updateStatus: (
      orderId: string,
      status: OrderStatus,
      staffNote?: string | null
    ) => updateStatusMutation.mutateAsync({ orderId, status, staffNote }),
    isUpdating:      updateStatusMutation.isPending,
    updatingOrderId: updateStatusMutation.variables?.orderId ?? null,
  };
}
