# Cup & Cozy — Café Management Platform

A full-stack café management platform with a React + Vite admin dashboard and an Express API server.

## Architecture

| Service | Package | Preview path |
|---|---|---|
| Admin Dashboard | `@workspace/admin-dashboard` | `/admin/` |
| API Server | `@workspace/api-server` | `/api` |

- **Admin Dashboard** — React + Vite + shadcn/ui staff interface. Communicates directly with Supabase via Row-Level Security for most features.
- **API Server** — Express 5 REST API for guest-facing endpoints (QR ordering, table sessions).

## Running

Both services start automatically via their configured workflows. No manual steps needed on Replit.

## Environment variables / secrets

| Secret | Used by |
|---|---|
| `VITE_SUPABASE_URL` | Admin Dashboard — Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Admin Dashboard — Supabase anon/public key |
| `DATABASE_URL` | API Server — PostgreSQL connection string (Transaction pooler, port 6543) |

`SESSION_SECRET` is also set in the workspace.

## Database (Supabase)

Apply the 35 SQL migration files in `supabase/migrations/` in order (001 → 035) using the Supabase Dashboard SQL editor or `supabase db push`. Then apply the seed at `supabase/seed/001_cup_and_cozy.sql`.

See `LOCAL_SETUP.md` for the full setup walkthrough including first-login instructions.

## User preferences

<!-- Add preferences here as you learn them -->
