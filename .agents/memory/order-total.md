---
name: Order total computation
description: orders table has no total column — must compute from order_items.
---

There is no `orders.total` column in the schema.

Order totals must be computed by joining and summing `order_items`:

```ts
function computeOrderTotal(order_items?: Array<{ unit_price: number; quantity: number }>): number {
  return (order_items ?? []).reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
}
```

**Why:** The schema stores per-item `unit_price` and `quantity` on `order_items`. There is no denormalized total on the `orders` row.

**How to apply:** Any Supabase query that needs order revenue must select `order_items(unit_price, quantity)` and compute the total client-side. The `DashboardStats.revenueToday` and `weeklyRevenue` are computed this way in `useDashboard.ts`.
