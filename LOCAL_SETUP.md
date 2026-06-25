# Cafe Maestro — Complete Local Setup Guide

> **Audience**: Complete beginners. No previous experience with this project required.
> **Target OS**: Windows 10/11 (notes for macOS/Linux included where different).
> **Last verified against**: Node.js 24, pnpm 10, Supabase CLI 1.x.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Downloading the Project](#2-downloading-the-project)
3. [Opening the Project](#3-opening-the-project)
4. [Critical Windows Fix](#4-critical-windows-fix)
5. [Installing Dependencies](#5-installing-dependencies)
6. [Environment Variables](#6-environment-variables)
7. [Database Setup](#7-database-setup)
8. [Storage Buckets](#8-storage-buckets)
9. [Running the Project](#9-running-the-project)
10. [First Login](#10-first-login)
11. [Troubleshooting](#11-troubleshooting)
12. [Updating the Project](#12-updating-the-project)
13. [Deploying](#13-deploying)
14. [Project Structure](#14-project-structure)
15. [Backup Strategy](#15-backup-strategy)
16. [Production Checklist](#16-production-checklist)

---

## 1. Prerequisites

Install all of the following before continuing. Each link goes to the official download page.

### Required tools

| Tool | Recommended version | Download |
|---|---|---|
| **Git** | 2.44 or newer | https://git-scm.com/download/win |
| **Node.js (LTS)** | **24.x** (must match project) | https://nodejs.org/en/download |
| **pnpm** | 10.x | Installed via Node — see below |
| **VS Code** | Latest stable | https://code.visualstudio.com |

### Required accounts

| Service | Purpose | Sign up |
|---|---|---|
| **Supabase** | Database, Auth, Storage, Realtime | https://supabase.com |

### Optional (for local Supabase instead of cloud)

| Tool | Purpose | Download |
|---|---|---|
| **Docker Desktop** | Required by `supabase start` (local Supabase only) | https://www.docker.com/products/docker-desktop |
| **Supabase CLI** | Apply migrations, manage local DB | https://supabase.com/docs/guides/cli/getting-started |

> **Recommendation for beginners**: Use **Supabase Cloud** (free tier). Skip Docker entirely. The cloud approach is covered in detail in [Section 7](#7-database-setup).

### Installing pnpm

After Node.js is installed, open a terminal and run:

```bash
npm install -g pnpm
```

Verify:

```bash
pnpm --version
# Expected: 10.x.x
```

> **Important**: This project enforces pnpm. Running `npm install` or `yarn install` will fail with an error on purpose. Always use `pnpm`.

---

## 2. Downloading the Project

### Option A — Clone from GitHub (recommended)

If the project is on GitHub, open a terminal and run:

```bash
git clone https://github.com/YOUR_USERNAME/cafe-maestro.git
cd cafe-maestro
```

Replace `YOUR_USERNAME/cafe-maestro` with the actual repository path.

### Option B — Download ZIP from GitHub

1. Go to the repository page on GitHub.
2. Click the green **Code** button → **Download ZIP**.
3. Save the ZIP to a folder like `C:\Projects\`.
4. Right-click the ZIP → **Extract All** → choose `C:\Projects\cafe-maestro\`.
5. Open VS Code.
6. Go to **File → Open Folder** and select `C:\Projects\cafe-maestro\`.

---

## 3. Opening the Project

1. Open VS Code.
2. Open the project folder (**File → Open Folder**).
3. Open the integrated terminal: **Terminal → New Terminal** (or press `` Ctrl+` ``).
4. Verify your tools are installed correctly:

```bash
node --version
# Expected: v24.x.x

npm --version
# Expected: 10.x.x

pnpm --version
# Expected: 10.x.x

git --version
# Expected: git version 2.44.x
```

If any version is wrong, re-install that tool from the links in Section 1.

---

## 4. Critical Windows Fix

> **Skip this section if you are on macOS or Linux.**

The project's `pnpm-workspace.yaml` file contains optimizations for Replit's Linux environment. These optimizations **exclude Windows-specific binary packages**, which will cause `pnpm install` to fail on Windows.

You must edit `pnpm-workspace.yaml` and remove all the `overrides` lines that exclude Windows, macOS, and ARM packages. Here is what to do:

1. Open `pnpm-workspace.yaml` in VS Code.
2. Find the `overrides:` section (near the bottom of the file).
3. **Delete the entire `overrides:` block** (from `overrides:` down to the last `"-"` line).

The resulting file should end after the `autoInstallPeers: false` and `onlyBuiltDependencies:` sections, like this:

```yaml
minimumReleaseAge: 1440

minimumReleaseAgeExclude:
  - '@replit/*'
  - stripe-replit-sync

packages:
  - artifacts/*
  - lib/*
  - lib/integrations/*
  - scripts

catalog:
  # ... (keep all catalog entries unchanged)

autoInstallPeers: false

onlyBuiltDependencies:
  - '@swc/core'
  - esbuild
  - msw
  - unrs-resolver
```

> **Why this is necessary**: Replit runs on Linux x64 exclusively, so the workspace config blocks Windows/macOS binaries to reduce install size. On your Windows PC, those same binaries are required.

Also, the Vite config reads two environment variables that Replit injects automatically but you must set manually. This is covered in [Section 6](#6-environment-variables).

---

## 5. Installing Dependencies

From the **root of the project** (the folder that contains `pnpm-workspace.yaml`), run:

```bash
pnpm install
```

This installs all packages for every workspace — the admin dashboard, API server, and shared libraries — in one command.

Expected output ends with something like:

```
Progress: resolved 1200 packages, reused 1180 packages
Done in 45s
```

> **If `pnpm install` fails** with "minimum release age" errors, a very recently published package is being blocked. Wait 24 hours and try again, or see [Troubleshooting](#11-troubleshooting).

You do **not** need to `cd` into subfolders and run `pnpm install` separately. The workspace handles everything from the root.

---

## 6. Environment Variables

The project uses environment variables for secrets and configuration. These are never committed to Git.

### Files you need to create

| File | Used by | Committed to Git? |
|---|---|---|
| `artifacts/admin-dashboard/.env.local` | Admin dashboard (Vite) | **Never** |
| `artifacts/api-server/.env` | API server (Express) | **Never** |

### Admin Dashboard — `artifacts/admin-dashboard/.env.local`

Create this file with exactly the following content (fill in your values):

```env
# ── Supabase ──────────────────────────────────────────────────────────────────
# Your Supabase project URL
# Found: Supabase Dashboard → Project Settings → API → Project URL
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co

# Your Supabase anonymous/public key (safe to expose in browser)
# Found: Supabase Dashboard → Project Settings → API → Project API keys → anon / public
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# The UUID of your cafe row (from the cafes table after running the seed)
# After running the seed: SELECT id FROM cafes LIMIT 1;
VITE_CAFE_ID=a1b2c3d4-0000-0000-0000-000000000001

# ── Dev server config ─────────────────────────────────────────────────────────
# Port the Vite dev server listens on
PORT=3000

# Base path — must end with a slash; use / for root
BASE_PATH=/
```

> Vite automatically loads `.env.local` in development. Never use `.env` for secrets (it may be committed).

### API Server — `artifacts/api-server/.env`

Create this file:

```env
# ── Database ──────────────────────────────────────────────────────────────────
# Postgres connection string for Drizzle ORM
# Found: Supabase Dashboard → Project Settings → Database → Connection string → URI
# Use the "Transaction" pooler string for best compatibility:
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxxxxxxxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# ── Server ────────────────────────────────────────────────────────────────────
PORT=5000
NODE_ENV=development

# ── Logging (optional) ────────────────────────────────────────────────────────
# LOG_LEVEL=info
```

### Full environment variable reference

| Variable | Service | Description | Where to find it |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Admin Dashboard | Your Supabase project URL | Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Admin Dashboard | Public anon key (safe for browser) | Dashboard → Settings → API → anon/public key |
| `VITE_CAFE_ID` | Admin Dashboard | UUID of the cafe row in the `cafes` table | Run `SELECT id FROM cafes LIMIT 1;` after seed |
| `DATABASE_URL` | API Server | PostgreSQL connection string (Drizzle) | Dashboard → Settings → Database → Connection string → URI |
| `PORT` | Both services | Port for the dev server | Set to `3000` (dashboard) and `5000` (API) |
| `BASE_PATH` | Admin Dashboard | URL base path prefix for Vite | Set to `/` for local dev |
| `NODE_ENV` | API Server | Runtime environment | `development` locally, `production` in prod |
| `LOG_LEVEL` | API Server | Pino log level (optional) | `info`, `debug`, `warn`, or `error` |

### Secrets that must NEVER be committed to Git

- `VITE_SUPABASE_ANON_KEY`
- `DATABASE_URL` (contains your password)
- Any `SERVICE_ROLE_KEY` if you add one later

Add these to `.gitignore` if they are not already there:

```
.env
.env.local
.env.production
.env.*.local
```

---

## 7. Database Setup

This project uses **Supabase** as its database, authentication provider, and realtime engine.

### Step 1 — Create a Supabase project

1. Go to https://supabase.com and sign in.
2. Click **New project**.
3. Choose a name (e.g. `cafe-maestro`), set a strong database password, and pick a region close to you.
4. Wait for the project to finish provisioning (~2 minutes).

### Step 2 — Apply migrations

The project has **35 SQL migration files** in `supabase/migrations/`. They must be applied in order.

**Option A — Via the Supabase Dashboard SQL editor (beginner-friendly)**

1. In your Supabase project, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open each migration file in VS Code and copy its contents.
4. Paste into the SQL editor and click **Run**.
5. Repeat for every file in this order:

```
001_extensions_and_helpers.sql
002_cafes.sql
003_tables_and_sessions.sql
004_menu.sql
005_orders_and_billing.sql
006_staff.sql
007_content.sql
008_indexes.sql
009_rls_policies.sql
010_realtime.sql
011_session_expiry_cron.sql
012_views.sql
013_audit_logs.sql
014_audit_views.sql
015_role_update.sql
016_rls_rebuild.sql
017_permission_matrix_view.sql
018_set_audit_actor_rpc.sql
019_orders_immutable.sql
020_rls_final.sql
021_bookings_staff_insert.sql
022_qr_ordering.sql
023_staff_operations.sql
024_end_session_audit.sql
025_multi_session.sql
026_table_groups.sql
027_staff_deletion.sql
028_must_change_password.sql
029_clear_must_change_password_rpc.sql
030_website_settings.sql
031_menu_website_policy.sql
032_menu_archiving.sql
033_fix_realtime_rls_archived_items.sql
034_table_management.sql
035_maintenance_flag.sql
```

> **Important**: Run them strictly in numeric order. Each migration builds on the previous one.

**Option B — Via Supabase CLI (advanced)**

If you have the Supabase CLI and Docker Desktop installed:

```bash
# Link to your cloud project (get the project ref from the Supabase Dashboard URL)
supabase link --project-ref xxxxxxxxxxxxxxxxxxxx

# Push all migrations
supabase db push
```

### Step 3 — Run the seed data

The seed file creates the example "Cup & Cozy" cafe with tables, menu categories, menu items, and a sample offer.

1. In the Supabase SQL editor, open `supabase/seed/001_cup_and_cozy.sql`.
2. Copy the entire file and paste it into a new SQL editor query.
3. Click **Run**.

### Step 4 — Create the first staff account (owner)

The seed data does **not** create a staff account because passwords cannot be seeded safely. You must create the first owner account manually:

1. In Supabase Dashboard → **Authentication → Users** → **Invite user** (or **Add user**).
2. Enter an email and temporary password.
3. In the **SQL editor**, run:

```sql
INSERT INTO staff_users (id, cafe_id, email, full_name, role, is_active, must_change_password)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'your@email.com'),
  'a1b2c3d4-0000-0000-0000-000000000001',
  'your@email.com',
  'Your Name',
  'owner',
  true,
  false
);
```

Replace `your@email.com` and `Your Name` with your actual values. The cafe UUID `a1b2c3d4-0000-0000-0000-000000000001` is what the seed created — verify with `SELECT id FROM cafes LIMIT 1;`.

### Step 5 — Verify the setup

Run these queries in the SQL editor to confirm everything is correct:

```sql
-- Should return 1 row: Cup & Cozy
SELECT id, name, slug FROM cafes;

-- Should return 8 rows (tables 1–8)
SELECT number, name FROM cafe_tables ORDER BY number;

-- Should return menu categories with items
SELECT c.name AS category, COUNT(i.id) AS item_count
FROM menu_categories c
LEFT JOIN menu_items i ON i.category_id = c.id
GROUP BY c.name;

-- Should return 1 owner row
SELECT email, role, is_active FROM staff_users;
```

---

## 8. Storage Buckets

The `website-assets` storage bucket is created automatically by migration `030_website_settings.sql`. Verify it exists:

1. Supabase Dashboard → **Storage**.
2. You should see a bucket named `website-assets` (public).

If it is missing, run this in the SQL editor:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'website-assets',
  'website-assets',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;
```

### RLS policies

The migration already applies the following policies to `website-assets`:

| Operation | Who | Condition |
|---|---|---|
| SELECT (read) | Everyone (public) | Bucket is public |
| INSERT (upload) | Authenticated staff | Their `cafe_id` matches |
| UPDATE | Authenticated staff | Their `cafe_id` matches |
| DELETE | Authenticated staff | Their `cafe_id` matches |

These are applied via migration — you do not need to set them manually.

### Gallery bucket

If you add a `gallery` bucket for photo uploads, create it the same way and apply matching RLS policies. The admin dashboard gallery feature uses signed URLs and expects the bucket to be named `gallery`.

### Verify uploads work

1. Start the admin dashboard (see Section 9).
2. Log in as owner.
3. Go to **Gallery → Upload photo**.
4. Select an image. If it appears in the gallery grid, storage is working correctly.

---

## 9. Running the Project

The project has two services. Run each in a **separate terminal window**.

### Terminal 1 — Admin Dashboard (React + Vite)

```bash
pnpm --filter @workspace/admin-dashboard run dev
```

Expected output:

```
VITE v7.x.x  ready in 1800ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.x.x:3000/
```

Open http://localhost:3000 in your browser.

### Terminal 2 — API Server (Express)

```bash
pnpm --filter @workspace/api-server run dev
```

Expected output:

```
{"level":"info","msg":"Server listening","port":5000}
```

The API server is available at http://localhost:5000/api.

### What each service does

| Service | URL | Description |
|---|---|---|
| Admin Dashboard | http://localhost:3000 | Staff login, menu, bookings, analytics |
| API Server | http://localhost:5000/api | Express REST API (guest ordering, future use) |

> **Note**: The admin dashboard communicates **directly with Supabase** via Row-Level Security — it does not need the API server to be running for most features. The API server is for guest-facing endpoints.

### Full typecheck (optional)

To check TypeScript across all packages:

```bash
pnpm run typecheck
```

---

## 10. First Login

1. Open http://localhost:3000 in your browser.
2. Enter the email and password you created in Step 4 of [Section 7](#step-4--create-the-first-staff-account-owner).
3. You will be redirected to the Dashboard.

If you set `must_change_password = true` when creating the account, the app will prompt you to change your password before proceeding.

### Default seeded data

The seed file creates:

- **Cafe**: Cup & Cozy
- **Tables**: 8 cafe tables (Table 1–8)
- **Menu categories**: Coffees, Teas, Cold Drinks, Pastries, Toasties, Seasonal Specials
- **Menu items**: ~20 items across categories
- **Offer**: A sample promotional offer

No staff accounts are seeded (see Section 7, Step 4).

---

## 11. Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `pnpm install` fails with "use pnpm instead" | Running `npm install` by mistake | Use `pnpm install` |
| `pnpm install` fails on Windows with esbuild errors | Windows binaries excluded in workspace config | Complete [Section 4](#4-critical-windows-fix) |
| `pnpm install` fails with "minimum release age" | A new package is too fresh (< 24 hours old) | Wait 24 hours and retry |
| `PORT environment variable is required` | Missing `PORT` in `.env.local` | Add `PORT=3000` to `artifacts/admin-dashboard/.env.local` |
| `BASE_PATH environment variable is required` | Missing `BASE_PATH` in `.env.local` | Add `BASE_PATH=/` to `artifacts/admin-dashboard/.env.local` |
| Blank white screen in browser | Env vars missing or wrong | Check `.env.local` values, restart dev server |
| Login fails: "Invalid login credentials" | Staff user not in `staff_users` table | Run the INSERT from Section 7 Step 4 |
| Login fails: user not found | Account not in Supabase Auth | Create user via Dashboard → Authentication → Users |
| Realtime updates not working | Realtime not enabled for tables | Check migration 010 ran; enable realtime in Dashboard → Database → Replication |
| Images not uploading | Storage bucket missing or wrong RLS | Verify `website-assets` bucket exists; re-run migration 030 |
| QR scanner not opening | Browser camera permission denied | Allow camera in browser settings; must be on HTTPS or localhost |
| `DATABASE_URL` connection refused | Wrong connection string | Use the "Transaction" pooler URI from Supabase Dashboard |
| Port already in use | Another process using port 3000 or 5000 | Change `PORT=` in `.env.local` / `.env`, or kill the conflicting process |
| Migration failed: "relation does not exist" | Migrations run out of order | Re-apply all migrations in strict numeric order |
| Node version mismatch | Using Node 18 or 20 instead of 24 | Install Node 24 from nodejs.org; use `nvm` to switch if needed |
| Git authentication failed on clone | SSH key not set up | Use HTTPS URL instead: `https://github.com/...` |
| `supabase db push` fails | Not linked to project | Run `supabase link --project-ref YOUR_REF` first |

---

## 12. Updating the Project

### Pull latest code

```bash
git pull origin main
```

### Install new dependencies

Always run after pulling, in case new packages were added:

```bash
pnpm install
```

### Apply new migrations

Check if any new `.sql` files were added to `supabase/migrations/` since your last pull.

Apply only the new ones (in order) via the Supabase SQL editor.

Or with the CLI:

```bash
supabase db push
```

### Regenerate API types (if API spec changed)

```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## 13. Deploying

### Frontend — Admin Dashboard

Build the static bundle:

```bash
pnpm --filter @workspace/admin-dashboard run build
```

Output is in `artifacts/admin-dashboard/dist/public/`.

Deploy to any static host (Vercel, Netlify, Cloudflare Pages):

- **Vercel**: Connect your GitHub repo, set root to `artifacts/admin-dashboard`, build command `pnpm run build`, output directory `dist/public`.
- **Netlify**: Same settings. Add your env vars in the Netlify dashboard.

Set these environment variables in your hosting provider:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_CAFE_ID=a1b2c3d4-0000-0000-0000-000000000001
PORT=3000
BASE_PATH=/
```

### Backend — API Server

Build:

```bash
pnpm --filter @workspace/api-server run build
```

Output is in `artifacts/api-server/dist/`.

Deploy to any Node.js host (Railway, Fly.io, Render):

Start command: `node --enable-source-maps ./dist/index.mjs`

Set environment variables:

```
DATABASE_URL=postgresql://...
PORT=8080
NODE_ENV=production
```

### Database — Supabase

Supabase Cloud handles hosting. Apply any new migrations before deploying code changes:

```bash
supabase db push
```

### CORS

For production, update the API server to restrict CORS to your actual frontend domain. In `artifacts/api-server/src/app.ts`, change:

```ts
app.use(cors());
```

to:

```ts
app.use(cors({ origin: 'https://your-dashboard.vercel.app' }));
```

---

## 14. Project Structure

```
cafe-maestro/
├── artifacts/
│   ├── admin-dashboard/          React + Vite staff dashboard
│   │   ├── src/
│   │   │   ├── components/       Shared UI components (shadcn/ui + custom)
│   │   │   ├── hooks/            TanStack Query data hooks (useMenu, useBookings…)
│   │   │   ├── lib/              Supabase client, utilities, formatCurrency
│   │   │   ├── pages/            One file per page (MenuPage, BookingsPage…)
│   │   │   └── types/            TypeScript types mirroring the DB schema
│   │   ├── .env.local            Your local secrets (never commit)
│   │   └── vite.config.ts        Vite configuration
│   │
│   └── api-server/               Express 5 REST API (guest-facing)
│       ├── src/
│       │   ├── app.ts            Express app setup (CORS, middleware, routing)
│       │   ├── routes/           API route handlers
│       │   └── lib/              Logger (pino), helpers
│       └── .env                  Your local secrets (never commit)
│
├── lib/
│   ├── db/                       Drizzle ORM schema + client (used by API server)
│   ├── api-spec/                 OpenAPI spec (source of truth for the API)
│   ├── api-zod/                  Zod schemas auto-generated from the OpenAPI spec
│   └── api-client-react/         TanStack Query hooks auto-generated from the spec
│
├── supabase/
│   ├── migrations/               35 SQL migration files (apply in order)
│   ├── seed/                     001_cup_and_cozy.sql — example tenant data
│   └── README.md                 Migration index and key design decisions
│
├── docs/
│   └── auth/                     Role permission matrix, auth types reference
│
├── scripts/                      Workspace utility scripts
├── pnpm-workspace.yaml           Monorepo configuration (edit for Windows — Section 4)
├── package.json                  Root scripts: typecheck, build
└── LOCAL_SETUP.md                This file
```

### What each area is responsible for

| Area | Responsibility |
|---|---|
| `artifacts/admin-dashboard/` | Everything staff see: login, dashboard, menu management, bookings, gallery, offers, analytics, settings |
| `artifacts/api-server/` | REST API for guest interactions (QR ordering, table sessions). Does not handle admin auth. |
| `lib/db/` | Drizzle ORM schema definitions and the Postgres connection pool. Shared by the API server. |
| `lib/api-spec/` | The single OpenAPI YAML file that defines every API endpoint. Edit this to add endpoints. |
| `lib/api-zod/` | Auto-generated Zod schemas (run `codegen` to refresh after spec changes). |
| `lib/api-client-react/` | Auto-generated TanStack Query hooks consumed by the admin dashboard. |
| `supabase/migrations/` | Complete Postgres schema as SQL files. Applied once to your Supabase project. |
| `supabase/seed/` | Sample data for the Cup & Cozy demo tenant. |
| `docs/auth/` | Human-readable reference for the four-role permission model (owner / manager / staff / chef). |

---

## 15. Backup Strategy

### Database

Supabase Cloud automatically backs up your database daily on paid plans. On the free plan, create manual backups regularly:

1. Supabase Dashboard → **Database → Backups**.
2. Click **Create backup**.

Or export via `pg_dump` (requires the Supabase connection string):

```bash
pg_dump "postgresql://postgres.xxxx:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
  --file backup-$(date +%Y%m%d).sql
```

### Storage

Download your storage files from Supabase Dashboard → **Storage** → select a bucket → download files manually, or use the Supabase CLI:

```bash
supabase storage cp ss://website-assets . --recursive
```

### Environment Variables

Store your `.env.local` and `.env` files in a **password manager** (Bitwarden, 1Password) or a secure encrypted notes app. Never commit them to Git.

### Git Repository

Push to GitHub or another remote regularly:

```bash
git add .
git commit -m "checkpoint: description of changes"
git push origin main
```

Consider enabling GitHub branch protection so `main` cannot be force-pushed.

---

## 16. Production Checklist

Run through this list before going live:

### Environment
- [ ] `NODE_ENV=production` set in API server environment
- [ ] All `VITE_*` variables set in hosting provider dashboard
- [ ] `DATABASE_URL` uses the **Transaction pooler** connection string (port 6543)
- [ ] No `.env` files committed to the Git repository
- [ ] `.gitignore` includes `.env`, `.env.local`, `.env.production`

### Database
- [ ] All 35 migrations applied in order
- [ ] Seed data verified (`SELECT COUNT(*) FROM menu_items` returns expected count)
- [ ] `staff_users` table has at least one owner account
- [ ] RLS is enabled on all tables (check via Supabase Dashboard → Database → Tables → RLS column shows "enabled")
- [ ] Realtime is enabled for `cafe_tables`, `table_sessions`, `orders`, `menu_items` (migration 010)

### Storage
- [ ] `website-assets` bucket exists and is public
- [ ] RLS policies on `storage.objects` are applied
- [ ] Test upload from the admin dashboard succeeds

### API
- [ ] CORS is restricted to your production frontend domain (not `*`)
- [ ] API server health check responds at `/api/`
- [ ] `LOG_LEVEL=warn` or `error` in production (avoid verbose logging)

### Security
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is never exposed to the browser or frontend code
- [ ] Supabase email confirmation is enabled for new auth users (Dashboard → Auth → Settings)
- [ ] Strong database password set (not the default)
- [ ] Supabase project is not set to "Allow new user signups" unless intentional

### Functionality
- [ ] Staff login works end-to-end
- [ ] Menu items load on the admin dashboard
- [ ] Creating and editing a menu item works
- [ ] Analytics page loads without errors
- [ ] Gallery upload works (tests storage integration)
- [ ] Realtime table status updates when a session is created
