# Cup & Cozy

A premium digital ordering, table booking, QR ordering, and café management platform built exclusively for Cup & Cozy. Staff log in to manage menu, bookings, gallery, offers, and view analytics.

## Run & Operate

- `pnpm --filter @workspace/admin-dashboard run dev` — run the admin dashboard (port 22133, preview `/admin/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000, preview `/api/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase project credentials for admin dashboard ✅
- Required secret: `SUPABASE_DATABASE_URL` — Supabase Transaction pooler URL (port 6543) for API server; `lib/db/src/index.ts` prefers this over the Replit-managed `DATABASE_URL`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Admin Dashboard: React + Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, Wouter, Recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (api-server) + Supabase (admin dashboard via RLS)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/admin-dashboard/` — React + Vite admin dashboard (staff-facing)
  - `src/types/index.ts` — all TypeScript types (mirrors Supabase DB schema)
  - `src/lib/supabase.ts` — Supabase client
  - `src/hooks/` — TanStack Query hooks: useAuth, useDashboard, useMenu, useBookings, useGallery, useOffers, useStaff
  - `src/pages/` — LoginPage, DashboardPage, MenuPage, BookingsPage, GalleryPage, OffersPage, StaffPage, AnalyticsPage, SettingsPage
  - `src/components/layout/` — AppLayout, Sidebar
  - `src/components/common/` — PageHeader, EmptyState, ConfirmDialog, StatusBadge
  - `src/index.css` — Cup & Cozy warm espresso/amber/terracotta theme (Tailwind v4)
- `artifacts/api-server/` — Express API server (future guest-facing API)
- `supabase/migrations/` — 20 SQL migrations (full schema)
- `supabase/seed/001_cup_and_cozy.sql` — Cup & Cozy seed data
- `docs/auth/` — Auth types, role permissions, route access reference

## Architecture decisions

- **Admin dashboard talks directly to Supabase via RLS** — no Express proxy for admin. Row-Level Security on Supabase enforces tenant isolation and role access at the DB level.
- **Staff auth via `staff_users` table** — `staff_users.id` = Supabase auth UID. No separate `cafe_members` table.
- **No `orders.total` column** — order totals are computed by summing `order_items(unit_price × quantity)`. The dashboard computes this client-side from joined data.
- **Four explicit roles** — `owner > manager > staff > chef`. No role inheritance — each role's permissions are fully enumerated in `docs/auth/types.ts`.
- **`position` not `display_order`** — menu categories, menu items, and gallery images use `position` for sort order.

## Product

- **Dashboard** — revenue, active tables, order counts, weekly revenue chart, recent orders feed
- **Menu** — manage categories and items; toggle availability per item; image support
- **Bookings** — date-browsable list; create, edit, update status (pending → confirmed → seated → no_show/cancelled)
- **Gallery** — photo grid; upload via file or URL; edit captions
- **Offers** — promotional offers with validity dates; toggle active/inactive
- **Staff** — invite members via Supabase Edge Function; toggle active; change roles
- **Analytics** — revenue trends, orders by status, top items (chart-based)
- **Settings** — cafe name, description, contact info, timezone (owner-only)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **`useRef` unused import** — `GalleryPage.tsx` uses `useRef` for the file input — keep it; removing it breaks the upload tab.
- **Supabase joined relations return arrays for one-to-many** — cast with `as unknown as` when TS infers conflicting shapes (e.g. `cafe_tables` in order queries).
- **`updated_at` is server-managed** — always omit it from mutation input types (`Omit<T, ... | "updated_at">`).
- **No `/manager/*` route** — managers and owners both use `/admin/*`; individual pages enforce finer permission checks.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `docs/auth/types.ts` for the full permission matrix
- See `supabase/migrations/` for the complete DB schema (20 migrations)
