---
name: Table status model
description: How cafe_tables operational status is derived and what drives each state.
---

## Status hierarchy (client-side derivation)

Priority order — first matching rule wins:

| Priority | Status | Condition |
|---|---|---|
| 1 | `archived` | `is_active = false` |
| 2 | `maintenance` | `is_under_maintenance = true` (migration 035) |
| 3 | `busy` | Active `table_sessions` row exists (`status = 'active'`) |
| 4 | `booked` | Confirmed `bookings` row exists for today with `table_id` assigned |
| 5 | `free` | None of the above |

**Why:** Single source of truth — status is never stored, always derived from three live data sources (cafe_tables, table_sessions, bookings). Prevents inconsistency.

**How to apply:** `useTableManagement` hook fetches all three in parallel in one `useQuery`, derives status via `deriveStatus()`, and exposes `ManagedTable.status`. Don't add a `status` column to the DB.

## Maintenance flag (migration 035)

- Column: `cafe_tables.is_under_maintenance boolean NOT NULL DEFAULT false`
- Server-side enforcement: `create_session` RPC raises `TABLE_UNDER_MAINTENANCE` if flag is true
- Client-side pre-check: `useTableSession.init()` queries `cafe_tables` for `is_under_maintenance` before showing name-entry form
- Guest screen: `sessionState = 'maintenance'` → maintenance screen in `TableSessionPage`
- Archiving a table auto-clears the maintenance flag

## Anon SELECT on cafe_tables

Migration 035 adds policy `cafe_tables_anon_active_read` (`USING (is_active = true)`) so guests can read `is_under_maintenance` before the name-entry flow. This is safe — only active tables are exposed, and QR codes already imply public existence.

## Real-time

`useTableManagement` subscribes to postgres_changes on:
- `cafe_tables` (maintenance toggle, archive/restore)
- `table_sessions` (busy/free transitions)
- `bookings` (booked/free transitions)

All three invalidate `["managed_tables", "v2"]` query key. The `v2` suffix busts the stale cache from the previous hook version.
