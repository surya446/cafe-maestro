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

export function useOrders() {
  const qc = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const { data: orders = [], isLoading } = useQuery<StaffOrder[]>({
    queryKey: ["staff_orders"],
    queryFn: async () => {
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

      // ── DIAGNOSTIC: log raw Supabase payload so we can verify
      //    whether order_items is populated before any mapping.
      //    Remove once the root cause is confirmed.
      if (import.meta.env.DEV || import.meta.env.VITE_APP_VARIANT === "tv") {
        console.group("[useOrders] raw Supabase response");
        console.log("row count:", (data ?? []).length);
        (data ?? []).forEach((o: any, idx: number) => {
          console.log(
            `order[${idx}] id=${o.id} status=${o.status}` +
            ` order_items=${JSON.stringify(o.order_items)}` +
            ` cafe_tables=${JSON.stringify(o.cafe_tables)}` +
            ` table_sessions=${JSON.stringify(o.table_sessions)}`
          );
        });
        console.groupEnd();
      }

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

    const channel = supabase
      .channel(`staff_orders_rt_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          qc.invalidateQueries({ queryKey: ["staff_orders"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          qc.invalidateQueries({ queryKey: ["staff_orders"] });
        }
      )
      .subscribe((status) => {
        // Invalidate on every SUBSCRIBED transition (including after WebSocket
        // reconnects) to backfill any events missed during the reconnect window.
        if (status === "SUBSCRIBED") {
          qc.invalidateQueries({ queryKey: ["staff_orders"] });
        }
      });

    channelRef.current = channel;
    return () => {
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
