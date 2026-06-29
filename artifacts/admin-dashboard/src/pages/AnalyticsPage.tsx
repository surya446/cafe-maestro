import { PageHeader } from "@/components/common/PageHeader";
import { useDashboard } from "@/hooks/useDashboard";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending_approval: "#F59E0B",
  approved: "#3B82F6",
  in_kitchen: "#8B5CF6",
  ready: "#10B981",
  served: "#22C55E",
  cancelled: "#EF4444",
  archived: "#6B7280",
};

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
      <h3 className="font-semibold text-foreground mb-5">{title}</h3>
      {children}
    </div>
  );
}

export function AnalyticsPage() {
  const { data: stats, isLoading } = useDashboard();

  return (
    <div className="max-w-5xl mx-auto pb-8">
        <PageHeader
          title="Analytics"
          subtitle="Revenue, orders, and performance insights"
        />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Revenue today", value: formatCurrency(stats?.revenueToday ?? 0) },
                { label: "Orders today", value: stats?.ordersToday ?? 0 },
                { label: "Active sessions", value: stats?.activeSessions ?? 0 },
                { label: "Bookings today", value: stats?.pendingBookingsToday ?? 0 },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-card border border-card-border rounded-xl p-4 shadow-sm"
                >
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Weekly revenue */}
              <SectionCard title="Revenue — last 7 days">
                {stats?.weeklyRevenue && stats.weeklyRevenue.some((d) => d.revenue > 0) ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={stats.weeklyRevenue}
                      barSize={28}
                      margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(35 28% 87%)" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 12, fill: "hsl(25 20% 48%)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(25 20% 48%)" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `₹${v}`}
                      />
                      <Tooltip
                        formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                        contentStyle={{
                          background: "hsl(0 0% 100%)",
                          border: "1px solid hsl(35 28% 87%)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="revenue" fill="hsl(38 72% 47%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                    No revenue data yet
                  </div>
                )}
              </SectionCard>

              {/* Orders by status */}
              <SectionCard title="Orders by status">
                {stats?.ordersByStatus && stats.ordersByStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={stats.ordersByStatus}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {stats.ordersByStatus.map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={ORDER_STATUS_COLORS[entry.status] ?? "#94a3b8"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(0 0% 100%)",
                          border: "1px solid hsl(35 28% 87%)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(value: string) => (
                          <span className="text-xs text-muted-foreground">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                    No order data yet
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Top items */}
            {stats?.topItems && stats.topItems.length > 0 && (
              <SectionCard title="Top selling items">
                <div className="space-y-3">
                  {stats.topItems.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-muted-foreground w-5 text-right">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {item.count} sold
                      </span>
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              (item.count / (stats.topItems[0]?.count ?? 1)) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        )}
      </div>
  );
}
