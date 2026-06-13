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
| `013_audit_logs.sql` | `audit_logs` table + all SECURITY DEFINER trigger functions |
| `014_audit_views.sql` | Audit query views (feed, staff activity, menu history, etc.) |
| `015_role_update.sql` | Four-role model (owner/manager/staff/chef), `auth_user_has_role()` helper |
| `016_rls_rebuild.sql` | Full RLS rebuild against the four-role model — drops old policies |
| `017_permission_matrix_view.sql` | `permissions`, `role_permissions`, `role_permission_matrix` view |
| `018_set_audit_actor_rpc.sql` | `set_audit_actor()` RPC — lets API routes stamp the audit trail |

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
- **Audit logging is trigger-based** — all audit records are written by `SECURITY DEFINER` Postgres triggers, never by application code. Any future mobile app is automatically audited with zero extra implementation.
- **`pin_hash` is scrubbed from audit data** — credential fields are never written into `audit_logs.old_data` or `new_data`.
- **Actor identity via session variable** — API routes run `SET LOCAL app.actor_id = '...'` before DML so triggers can record who performed the action without an application-level audit call.
- **Four-role model**: `owner > manager > staff > chef` — enforced at middleware, API, and RLS layers independently.
- **Manager cannot touch owner accounts** — enforced at all three layers, not just the UI.
- **Customers never authenticate** — guests use ephemeral `device_token` only; no Supabase Auth account is created.
- **`set_audit_actor()` RPC** — call before any DML so triggers attribute the action to the right actor. Mobile apps call the same RPC; no separate audit implementation needed.
