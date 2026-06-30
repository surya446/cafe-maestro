import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

export interface DashboardStats {
  ordersToday: number;
  revenueToday: number;
  activeSessions: number;
  pendingBookingsToday: number;
  pendingOrders: number;
  weeklyRevenue: { day: string; revenue: number }[];
  topItems: { name: string; count: number }[];
  ordersByStatus: { status: string; count: number }[];
  recentOrders: {
    id: string;
    tableLabel: string;
    total: number;
    status: string;
    created_at: string;
  }[];
}

function computeOrderTotal(order_items?: Array<{ unit_price: number; quantity: number }>): number {
  return (order_items ?? []).reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
}

export function useDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard", user?.cafeId],
    queryFn: async (): Promise<DashboardStats> => {
      if (!user) throw new Error("Not authenticated");
      const cafeId = user.cafeId;
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000)
        .toISOString()
        .split("T")[0];

      const [ordersRes, sessionsRes, bookingsRes, pendingOrdersRes, weeklyRes, recentRes, ordersByStatusRes] =
        await Promise.all([
          supabase
            .from("orders")
            .select("status, created_at, order_items(unit_price, quantity)")
            .eq("cafe_id", cafeId)
            .gte("created_at", today),
          supabase
            .from("table_sessions")
            .select("id")
            .eq("cafe_id", cafeId)
            .eq("status", "active"),
          supabase
            .from("bookings")
            .select("id, status")
            .eq("cafe_id", cafeId)
            .eq("booking_date", today)
            .in("status", ["pending", "confirmed"]),
          supabase
            .from("orders")
            .select("id")
            .eq("cafe_id", cafeId)
            .in("status", ["pending_approval", "approved", "in_kitchen"]),
          supabase
            .from("orders")
            .select("created_at, order_items(unit_price, quantity)")
            .eq("cafe_id", cafeId)
            .gte("created_at", weekAgo)
            .not("status", "in", '("cancelled","archived")'),
          supabase
            .from("orders")
            .select(
              "id, status, created_at, order_items(unit_price, quantity), cafe_tables(name, number)"
            )
            .eq("cafe_id", cafeId)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("orders")
            .select("status")
            .eq("cafe_id", cafeId)
            .gte("created_at", weekAgo),
        ]);

      const ordersToday = (ordersRes.data ?? []) as Array<{
        status: string;
        created_at: string;
        order_items: Array<{ unit_price: number; quantity: number }>;
      }>;
      const revenueToday = ordersToday
        .filter((o) => !["cancelled", "archived"].includes(o.status))
        .reduce((sum, o) => sum + computeOrderTotal(o.order_items), 0);

      const weeklyMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toLocaleDateString("en-AU", { weekday: "short" });
        weeklyMap[key] = 0;
      }
      const weeklyOrders = (weeklyRes.data ?? []) as Array<{
        created_at: string;
        order_items: Array<{ unit_price: number; quantity: number }>;
      }>;
      for (const row of weeklyOrders) {
        const d = new Date(row.created_at);
        const key = d.toLocaleDateString("en-AU", { weekday: "short" });
        if (key in weeklyMap) weeklyMap[key] += computeOrderTotal(row.order_items);
      }

      const recentOrders = ((recentRes.data ?? []) as unknown as Array<{
        id: string;
        status: string;
        created_at: string;
        order_items: Array<{ unit_price: number; quantity: number }>;
        cafe_tables: { name: string | null; number: number } | null;
      }>).map((o) => ({
        id: o.id,
        tableLabel:
          o.cafe_tables?.name ??
          `Table ${o.cafe_tables?.number ?? "?"}`,
        total: computeOrderTotal(o.order_items),
        status: o.status,
        created_at: o.created_at,
      }));

      return {
        ordersToday: ordersToday.length,
        revenueToday,
        activeSessions: sessionsRes.data?.length ?? 0,
        pendingBookingsToday: bookingsRes.data?.length ?? 0,
        pendingOrders: pendingOrdersRes.data?.length ?? 0,
        weeklyRevenue: Object.entries(weeklyMap).map(([day, revenue]) => ({
          day,
          revenue,
        })),
        topItems: [],
        ordersByStatus: Object.entries(
          (ordersByStatusRes.data ?? []).reduce<Record<string, number>>(
            (acc, o) => {
              acc[o.status] = (acc[o.status] ?? 0) + 1;
              return acc;
            },
            {}
          )
        ).map(([status, count]) => ({ status, count })),
        recentOrders,
      };
    },
    enabled: !!user,
    refetchInterval: 60000,
  });
}
