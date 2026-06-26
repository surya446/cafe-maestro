# Authorization Model — Cup & Cozy Management System

---

## Roles

| Role | Description |
|---|---|
| **owner** | Full platform control including settings, staff management, and complete audit log |
| **manager** | Full operations + admin dashboard with restricted capabilities. No settings, no owner account management |
| **staff** | Floor operations — order approval, session control, bill requests, bookings |
| **chef** | Kitchen only — sees approved orders, updates kitchen status |

**No role inheritance.** Every permission per role is explicitly assigned.  
**Customers do not log in.** Guests authenticate via ephemeral `device_token` only.

---

## Permission Matrix

| Permission | owner | manager | staff | chef |
|---|:---:|:---:|:---:|:---:|
| **Orders** |
| `orders.view` | ✅ | ✅ | ✅ | ✅ |
| `orders.approve` | ✅ | ✅ | ✅ | ❌ |
| `orders.reject` | ✅ | ✅ | ✅ | ❌ |
| `orders.mark_served` | ✅ | ✅ | ✅ | ❌ |
| `orders.kitchen_update` | ✅ | ✅ | ❌ | ✅ |
| `orders.archive` | ✅ | ✅ | ❌ | ❌ |
| **Sessions** |
| `sessions.view` | ✅ | ✅ | ✅ | ❌ |
| `sessions.end` | ✅ | ✅ | ✅ | ❌ |
| **Bill Requests** |
| `bill_requests.view` | ✅ | ✅ | ✅ | ❌ |
| `bill_requests.acknowledge` | ✅ | ✅ | ✅ | ❌ |
| **Menu** |
| `menu.view_all` | ✅ | ✅ | ✅ | ✅ |
| `menu.write` | ✅ | ✅ | ❌ | ❌ |
| `menu.delete` | ✅ | ❌ | ❌ | ❌ |
| **Tables & QR** |
| `tables.write` | ✅ | ✅ | ❌ | ❌ |
| `tables.delete` | ✅ | ❌ | ❌ | ❌ |
| **Bookings** |
| `bookings.view` | ✅ | ✅ | ✅ | ❌ |
| `bookings.manage` | ✅ | ✅ | ✅ | ❌ |
| `bookings.delete` | ✅ | ✅ | ❌ | ❌ |
| **Reviews** |
| `reviews.moderate` | ✅ | ✅ | ❌ | ❌ |
| `reviews.delete` | ✅ | ❌ | ❌ | ❌ |
| **Content** |
| `gallery.write` | ✅ | ✅ | ❌ | ❌ |
| `offers.write` | ✅ | ✅ | ❌ | ❌ |
| **Staff Management** |
| `staff.view` | ✅ | ✅ | ❌ | ❌ |
| `staff.create_non_owner` | ✅ | ✅ | ❌ | ❌ |
| `staff.manage_non_owner` | ✅ | ✅ | ❌ | ❌ |
| `staff.manage_all` | ✅ | ❌ | ❌ | ❌ |
| **Reporting** |
| `analytics.view` | ✅ | ✅ | ❌ | ❌ |
| `audit_logs.view_operations` | ✅ | ✅ | ❌ | ❌ |
| `audit_logs.view_all` | ✅ | ❌ | ❌ | ❌ |
| **Settings** |
| `settings.write` | ✅ | ❌ | ❌ | ❌ |

---

## Route Access

No `/manager/*` route exists. Manager and owner share `/admin/*`.

| Route | chef | staff | manager | owner |
|---|:---:|:---:|:---:|:---:|
| `/kitchen/*` | ✅ | ✅ | ✅ | ✅ |
| `/staff/*` | ❌ | ✅ | ✅ | ✅ |
| `/admin/*` | ❌ | ❌ | ✅ | ✅ |

### Default redirect after login

| Role | Lands on |
|---|---|
| chef | `/kitchen/display` |
| staff | `/staff/dashboard` |
| manager | `/admin/dashboard` |
| owner | `/admin/dashboard` |

---

## Admin Dashboard — Page-Level Access

Manager and owner both enter `/admin/*`. The middleware grants both roles access to the route group. Individual pages enforce finer restrictions at the API and Server Component layer.

### `/admin/*` — All pages (manager + owner unless marked)

| Page | manager | owner | Restriction enforced by |
|---|:---:|:---:|---|
| `/admin/dashboard` | ✅ | ✅ | — |
| `/admin/orders` | ✅ | ✅ | — |
| `/admin/sessions` | ✅ | ✅ | — |
| `/admin/bill-requests` | ✅ | ✅ | — |
| `/admin/bookings` | ✅ | ✅ | — |
| `/admin/menu` | ✅ | ✅ | — |
| `/admin/tables` | ✅ | ✅ | — |
| `/admin/reviews` | ✅ | ✅ | — |
| `/admin/gallery` | ✅ | ✅ | — |
| `/admin/offers` | ✅ | ✅ | — |
| `/admin/staff` | ✅ | ✅ | Manager sees staff/chef only; owner sees all |
| `/admin/analytics` | ✅ | ✅ | — |
| `/admin/settings` | ❌ | ✅ | `requirePermission('settings.write')` in Server Component |
| `/admin/audit-logs` | ⚠️ | ✅ | Manager sees operational events only (no staff account events) |

⚠️ = Manager can access the page but sees a filtered view.

### `/staff/*` — Staff + manager + owner

| Page | Purpose |
|---|---|
| `/staff/dashboard` | Table map with active device counts |
| `/staff/orders` | Pending approval queue |
| `/staff/bill-requests` | Bill request queue |
| `/staff/sessions` | Active sessions list |
| `/staff/bookings` | Booking management |

### `/kitchen/*` — All roles

| Page | Purpose |
|---|---|
| `/kitchen/display` | Live order queue: approved → in_kitchen → ready |

---

## Order Status Machine

Historical orders are **never hard deleted**. All transitions are forward-only.

```
pending_approval
    ├── → approved        (staff | manager | owner)
    └── → cancelled       (staff | manager | owner — rejection with reason)

approved
    ├── → in_kitchen      (chef | manager | owner)
    └── → cancelled       (staff | manager | owner)

in_kitchen
    └── → ready           (chef | manager | owner)

ready
    └── → served          (staff | manager | owner)

served
    └── → archived        (manager | owner — soft housekeeping)

cancelled
    └── → archived        (manager | owner — soft housekeeping)
```

**Database-level enforcement:** A `BEFORE DELETE` trigger on `orders` and `order_items` raises an exception unconditionally. Even a service-role key cannot delete order rows without explicitly removing the trigger.

---

## Three-Layer Defense

All three layers operate independently. Bypassing one still hits the others.

```
1. middleware.ts          — Route-level: blocks wrong role at the Next.js edge
2. API Route Handler      — Request-level: re-validates JWT, checks permission, sets audit actor
3. Supabase RLS           — Row-level: gates every query on cafe_id + role, always
```

### Example: manager attempts to reach /admin/settings

```
GET /admin/settings
  │
  ▼ Layer 1 — middleware.ts
  Manager has /admin/* access → passes through
  │
  ▼ Layer 2 — Server Component / API Route
  requirePermission(user, 'settings.write')
  → manager lacks this permission → 403 returned, page renders unauthorized state
  │
  Layer 3 — RLS
  Even if layer 2 is bypassed, cafes UPDATE policy:
  auth_user_has_role(ARRAY['owner']) → false for manager → DB rejects the write
```

---

## Guest Authentication

Customers never create a Supabase Auth account.

1. Guest scans QR → server issues a random `device_token` (base64, 24 bytes)
2. Token stored in `session_devices` table and in guest's `localStorage` + HTTP-only cookie
3. Every guest API request includes `device_token` in the request body
4. Server validates token against `session_devices WHERE is_active = true`
5. On session end or expiry: `is_active = false` for all tokens → all subsequent requests receive `SESSION_ENDED`

---

## Manager Restrictions — Enforcement Summary

| Restriction | Layer 1 (middleware) | Layer 2 (API) | Layer 3 (RLS) |
|---|:---:|:---:|:---:|
| Cannot access /admin/settings | ❌ (let through) | `requirePermission('settings.write')` | `cafes UPDATE: owner only` |
| Cannot view staff account audit events | N/A | N/A | `event_type NOT LIKE 'staff.%'` |
| Cannot create/edit owner accounts | N/A | `requirePermission('staff.manage_all')` | `NEW.role NOT IN ('owner','manager')` |
| Cannot delete menu items | N/A | `requirePermission('menu.delete')` | No DELETE policy for manager |
| Cannot archive orders without permission | N/A | `requirePermission('orders.archive')` | `owner_manager_staff UPDATE` (staff lacks archive in API) |
| Cannot delete tables | N/A | `requirePermission('tables.delete')` | No DELETE policy for manager |
