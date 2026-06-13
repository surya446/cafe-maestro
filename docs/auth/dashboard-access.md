# Dashboard Access Rules — Cafe Maestro

## Route → Role Matrix

| Route Prefix | chef | staff | manager | owner |
|---|:---:|:---:|:---:|:---:|
| `/kitchen/*` | ✅ | ✅ | ✅ | ✅ |
| `/staff/*` | ❌ | ✅ | ✅ | ✅ |
| `/manager/*` | ❌ | ❌ | ✅ | ✅ |
| `/admin/*` | ❌ | ❌ | ❌ | ✅ |

## Default Redirect After Login

| Role | Lands on |
|---|---|
| chef | `/kitchen/display` |
| staff | `/staff/dashboard` |
| manager | `/manager/dashboard` |
| owner | `/admin/dashboard` |

## Page-Level Access Rules

### `/kitchen/*` — Chef + Staff + Manager + Owner
| Page | Purpose |
|---|---|
| `/kitchen/display` | Live order queue (approved → in_kitchen → ready) |

### `/staff/*` — Staff + Manager + Owner
| Page | Purpose |
|---|---|
| `/staff/dashboard` | Table map with active session counts |
| `/staff/orders` | Pending approval queue |
| `/staff/bill-requests` | Bill request queue |
| `/staff/sessions` | Active sessions list |
| `/staff/bookings` | Booking list and status management |

### `/manager/*` — Manager + Owner
| Page | Purpose |
|---|---|
| `/manager/dashboard` | Operations overview + analytics summary |
| `/manager/menu` | Menu items and categories CRUD |
| `/manager/tables` | Table configuration + QR code generation |
| `/manager/reviews` | Review moderation queue |
| `/manager/gallery` | Gallery image management |
| `/manager/offers` | Promotional offer management |
| `/manager/staff` | Staff accounts (cannot manage other managers or owners) |
| `/manager/analytics` | Revenue, order counts, session analytics |

### `/admin/*` — Owner Only
| Page | Purpose |
|---|---|
| `/admin/dashboard` | Full overview |
| `/admin/staff` | All staff including managers (cannot deactivate self) |
| `/admin/settings` | Cafe name, phone, address, opening hours, social links |
| `/admin/audit-logs` | Full audit trail |
| `/admin/analytics` | Full analytics |

---

## Permission Check Layers

Three layers enforce access control. All must pass.

```
Request
   │
   ▼
1. Next.js Middleware (middleware.ts)
   → Checks Supabase JWT + staff_users.role
   → Blocks route if role not in allowed list
   → Redirects to correct dashboard
   │
   ▼
2. API Route Handler (lib/auth/server.ts)
   → getAuthenticatedStaff() — re-validates JWT + active status
   → requirePermission(user, 'menu.write') — fine-grained check
   → setAuditActor(supabase, user.id) — stamps audit trail
   │
   ▼
3. Supabase RLS (database)
   → auth_user_has_role(['owner','manager']) on every query
   → cafe_id scoping on every row
   → Cannot be bypassed by any client
```

Even if middleware is bypassed (e.g. a direct API call), layer 2 and layer 3 independently block the request. Defense in depth.

---

## Manager Cannot Manage Owners — Enforcement Points

This restriction is enforced at all three layers:

1. **Middleware**: Manager cannot reach `/admin/staff`
2. **API**: `requirePermission(user, 'staff.manage_owners')` — manager lacks this
3. **RLS** (`016_rls_rebuild.sql`):
   ```sql
   -- Manager cannot create an owner
   AND (auth_user_role() = 'owner' OR NEW.role <> 'owner')

   -- Manager cannot edit owner accounts
   AND (auth_user_role() = 'owner' OR (OLD.role <> 'owner' AND NEW.role <> 'owner'))
   ```

---

## Customers — No Login Required

Guests authenticate exclusively via `device_token` (a random base64 token stored in `localStorage` and an HTTP-only cookie). They interact only with:

- `POST /api/cafes/[cafeId]/sessions` — create or join
- `POST /api/cafes/[cafeId]/orders` — place an order
- `GET  /api/cafes/[cafeId]/orders/[id]` — poll order status
- `POST /api/cafes/[cafeId]/bill-requests` — request the bill

Every guest endpoint validates `device_token` against `session_devices` before proceeding. When a session ends, `is_active = false` is set on all device records, and any subsequent request with that token receives `SESSION_ENDED`.
