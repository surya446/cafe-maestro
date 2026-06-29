import {
  ShoppingBag,
  DollarSign,
  Users,
  CalendarDays,
  Clock,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge, orderStatusVariant } from "@/components/common/StatusBadge";
import { useDashboard } from "@/hooks/useDashboard";
import { formatCurrency, formatRelativeTime, ORDER_STATUS_LABELS } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p
            className={`text-2xl font-bold mt-1 ${
              accent ? "text-primary" : "text-foreground"
            }`}
          >
            {value}
          </p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-xl ${
            accent
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-6xl mx-auto pb-8">
        <div className="h-8 w-48 bg-muted rounded-lg animate-pulse mb-8" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-muted rounded-xl animate-pulse" />
          <div className="h-72 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
  );
}

export function DashboardPage() {
  const { data: stats, isLoading } = useDashboard();

  if (isLoading) return <LoadingSkeleton />;

  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="max-w-6xl mx-auto pb-8">
        <PageHeader
          title="Dashboard"
          subtitle={today}
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Revenue Today"
            value={formatCurrency(stats?.revenueToday ?? 0)}
            icon={DollarSign}
            accent
          />
          <StatCard
            label="Orders Today"
            value={stats?.ordersToday ?? 0}
            icon={ShoppingBag}
            sub={`${stats?.pendingOrders ?? 0} pending`}
          />
          <StatCard
            label="Active Tables"
            value={stats?.activeSessions ?? 0}
            icon={Users}
            sub="live sessions"
          />
          <StatCard
            label="Bookings Today"
            value={stats?.pendingBookingsToday ?? 0}
            icon={CalendarDays}
          />
        </div>

        {/* Charts + Recent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly revenue chart */}
          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4.5 h-4.5 text-primary" />
              <h3 className="font-semibold text-foreground">Weekly Revenue</h3>
            </div>
            {stats?.weeklyRevenue && stats.weeklyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
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
                  <Bar
                    dataKey="revenue"
                    fill="hsl(38 72% 47%)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                No data yet
              </div>
            )}
          </div>

          {/* Recent orders */}
          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Clock className="w-4.5 h-4.5 text-primary" />
              <h3 className="font-semibold text-foreground">Recent Orders</h3>
            </div>
            {stats?.recentOrders && stats.recentOrders.length > 0 ? (
              <div className="space-y-3">
                {stats.recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {order.tableLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(order.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge
                        label={ORDER_STATUS_LABELS[order.status] ?? order.status}
                        variant={orderStatusVariant(order.status)}
                      />
                      <span className="text-sm font-semibold text-foreground">
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                No orders yet today
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
