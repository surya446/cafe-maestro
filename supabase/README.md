# Cafe Maestro — Supabase Schema

## Migration Run Order

Apply migrations in numeric order against your Supabase project.
Run via the Supabase Dashboard SQL editor or `supabase db push`.

| File | Purpose |
|---|---|
| `001_extensions_and_helpers.sql` | Extensions (uuid-ossp, pg_cron, pgcrypto), helper functions (set_updated_at, generate_device_token) |
| `002_cafes.sql` | Root tenant table. Every other table references `cafe_id` |
| `003_tables_and_sessions.sql` | Physical tables, sessions, session_devices |
| `004_menu.sql` | Menu categories and items |
| `005_orders_and_billing.sql` | Orders, order_items, bill_requests |
| `006_staff.sql` | Staff users (extends auth.users) |
| `007_content.sql` | Bookings, reviews, gallery_images, offers |
| `008_indexes.sql` | All performance indexes |
| `009_rls_policies.sql` | Row-level security for every table |
| `010_realtime.sql` | Realtime publication + pg_notify triggers |
| `011_session_expiry_cron.sql` | pg_cron job — expires sessions every 5 min |
| `012_views.sql` | Convenience views (active sessions, orders, analytics) |

## Seed Data

| File | Purpose |
|---|---|
| `seed/001_cup_and_cozy.sql` | Cup & Cozy tenant: cafe, 8 tables, full menu, sample offer |

## Key Design Decisions

- **`cafe_id` on every row** — multi-tenant from day one; cross-cafe leakage is impossible via RLS
- **`device_count` is never stored** — always computed from `session_devices` via `COUNT()`
- **Unique partial index** on `table_sessions(table_id) WHERE status='active'` — database-enforced one active session per table
- **`unit_price` snapshotted** in `order_items` — historical order values survive menu price changes
- **`menu_items.is_available`** — use to "86" items; never delete items that appear in orders (`ON DELETE RESTRICT`)
- **Session states**: `active | expired | ended` only. No table open/close workflow.
