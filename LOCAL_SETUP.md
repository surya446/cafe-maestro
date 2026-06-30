# Cup & Cozy — Local Setup Guide

> Every command, script name, environment variable, package name, and version in this guide was read directly from the repository source files. Nothing is assumed or invented. Where something is absent from the repository, that is stated explicitly.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Getting the Code](#2-getting-the-code)
3. [Critical: Fix pnpm-workspace.yaml for Non-Linux Systems](#3-critical-fix-pnpm-workspaceyaml-for-non-linux-systems)
4. [Installing Dependencies](#4-installing-dependencies)
5. [Environment Variables](#5-environment-variables)
6. [Database Setup (Supabase)](#6-database-setup-supabase)
7. [Storage Buckets](#7-storage-buckets)
8. [Running the Project](#8-running-the-project)
9. [Edge Functions (Staff Management)](#9-edge-functions-staff-management)
10. [First Login](#10-first-login)
11. [Useful Commands Reference](#11-useful-commands-reference)
12. [Troubleshooting](#12-troubleshooting)
13. [Project Structure](#13-project-structure)

---

## 1. Prerequisites

### Required

| Tool | Version required | How to verify | Download |
|---|---|---|---|
| **Node.js** | **24.x** (exact major version used by the project) | `node --version` | https://nodejs.org/en/download |
| **pnpm** | 10.x | `pnpm --version` | Install after Node — see below |
| **Git** | Any recent version | `git --version` | https://git-scm.com/download |

> **The project's preinstall script actively rejects `npm` and `yarn`.** Running `npm install` will print "Use pnpm instead" and exit with an error. You must use pnpm.

### Installing pnpm

After Node.js is installed:

```bash
npm install -g pnpm
```

### Required accounts

| Service | Purpose |
|---|---|
| **Supabase** (https://supabase.com) | PostgreSQL database, Auth, Realtime, Storage, and Edge Functions |

### Windows-specific requirement

The preinstall script in `package.json` uses `sh -c '...'`, which is POSIX shell syntax. On Windows, this requires either:

- **Git Bash** (included with Git for Windows — recommended), or
- **WSL2** (Windows Subsystem for Linux)

Windows Command Prompt and PowerShell alone will not work.

### Docker

**This project does not define a Dockerfile or docker-compose file.** Docker is not required.

---

## 2. Getting the Code

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

Or download the ZIP from GitHub: **Code → Download ZIP**, extract it, and open the folder in VS Code.

---

## 3. Critical: Fix pnpm-workspace.yaml for Non-Linux Systems

**Skip this section only if you are running Linux x86-64.**

The file `pnpm-workspace.yaml` contains an `overrides:` block that was added for Replit's Linux x86-64 environment. It explicitly excludes the native binary packages for esbuild, rollup, lightningcss, and `@tailwindcss/oxide` on every platform *other* than Linux x86-64 — including **Windows, macOS, and Linux ARM**.

This means `pnpm install` will succeed but the binaries required to actually run the tools will be missing, causing build failures.

**What to do:**

Open `pnpm-workspace.yaml` and delete the entire `overrides:` block — everything from the `overrides:` line to the end of the file. The file should end after the `onlyBuiltDependencies:` section:

```yaml
# Keep everything above this unchanged ...

autoInstallPeers: false

onlyBuiltDependencies:
  - '@swc/core'
  - esbuild
  - msw
  - unrs-resolver

# DELETE everything from "overrides:" to the end of the file
```

Also note: the api-server dev script (`artifacts/api-server/package.json`) uses `export NODE_ENV=development` which is bash syntax. On Windows, run it in Git Bash, not in Command Prompt or PowerShell.

---

## 4. Installing Dependencies

From the **root of the project** (the directory that contains `pnpm-workspace.yaml`):

```bash
pnpm install
```

This single command installs packages for all workspaces: the admin dashboard, api server, and all shared libraries under `lib/`.

**What the workspace contains** (from `pnpm-workspace.yaml`):

```
packages:
  - artifacts/*
  - lib/*
  - lib/integrations/*
  - scripts
```

You do **not** need to `cd` into subdirectories and run `pnpm install` separately.

**Note on `minimumReleaseAge: 1440`:** The workspace is configured to reject any npm package published less than 24 hours ago as a supply-chain attack defense. If you try to install a very newly published package, pnpm will block it. This setting should not cause problems during normal setup.

---

## 5. Environment Variables

### What does NOT exist in this repository

- There is **no `.env.example` file** in this repository. Create the files below from scratch.
- The `.gitignore` does **not** include `.env` or `.env.local`. You must not commit these files manually. Add them to `.gitignore` yourself (see below).

### Add to .gitignore

Before creating any `.env` file, add these lines to `.gitignore` if they are not already there:

```
.env
.env.local
.env.production
.env.*.local
```

---

### Admin Dashboard — `artifacts/admin-dashboard/.env.local`

These variables were verified by reading `vite.config.ts` and `src/lib/supabase.ts`.

Create `artifacts/admin-dashboard/.env.local`:

```env
# ── Vite dev server ───────────────────────────────────────────────────────────
# Required. vite.config.ts throws an error if PORT is missing.
PORT=3000

# Required. vite.config.ts throws an error if BASE_PATH is missing.
# Use / for local development (no sub-path prefix).
BASE_PATH=/

# ── Supabase ──────────────────────────────────────────────────────────────────
# Required. Read in src/lib/supabase.ts.
# Supabase Dashboard → Project Settings → API → Project URL
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co

# Required. Read in src/lib/supabase.ts.
# Supabase Dashboard → Project Settings → API → anon / public key
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional. Read only in src/hooks/usePublicBooking.ts.
# Only needed if you use the public booking feature.
# Run: SELECT id FROM cafes LIMIT 1; after applying the seed.
# The seed file hardcodes this UUID:
VITE_CAFE_ID=a1b2c3d4-0000-0000-0000-000000000001
```

**What each variable does (verified from source):**

| Variable | File that reads it | Behaviour if missing |
|---|---|---|
| `PORT` | `vite.config.ts` line 7 | Throws: *"PORT environment variable is required"* |
| `BASE_PATH` | `vite.config.ts` line 21 | Throws: *"BASE_PATH environment variable is required"* |
| `VITE_SUPABASE_URL` | `src/lib/supabase.ts` line 3 | `console.warn`, falls back to placeholder — login fails silently |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.ts` line 4 | `console.warn`, falls back to placeholder — login fails silently |
| `VITE_CAFE_ID` | `src/hooks/usePublicBooking.ts` line 45 | Public booking hook receives `undefined`; admin dashboard is unaffected |

**Note on `import.meta.env.BASE_URL`:** This is a Vite built-in variable that is automatically set to the value of `BASE_PATH`. You do not set it manually.

**Note on `REPL_ID` and `NODE_ENV`:** `vite.config.ts` conditionally loads Replit-specific plugins (`@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`) only when `REPL_ID` is defined and `NODE_ENV !== "production"`. Neither variable needs to be set for local development — the check will simply skip those plugins.

---

### API Server — `artifacts/api-server/.env`

These variables were verified by reading `src/index.ts` and `src/lib/logger.ts`.

Create `artifacts/api-server/.env`:

```env
# Required. src/index.ts throws if PORT is missing.
PORT=5000

# Optional. Used in src/lib/logger.ts to toggle pino-pretty formatting.
# In development, pino-pretty (colourised) output is used when NODE_ENV != "production".
NODE_ENV=development

# Optional. src/lib/logger.ts: level defaults to "info" if not set.
# Valid values: trace, debug, info, warn, error, fatal
# LOG_LEVEL=info
```

**Note:** The api-server **also** requires `DATABASE_URL` when its database connection is used. However, `DATABASE_URL` is consumed by `lib/db/src/index.ts` (which the api-server imports). See the table below.

---

### lib/db — database connection

These variables were verified by reading `lib/db/src/index.ts` and `lib/db/drizzle.config.ts`.

The api-server imports `@workspace/db`. Add `DATABASE_URL` to `artifacts/api-server/.env`:

```env
# Required when the api-server uses the database.
# lib/db/src/index.ts throws if DATABASE_URL is missing.
# Supabase Dashboard → Project Settings → Database → Connection string → URI
# Use the "Transaction" mode pooler (port 6543) for Node.js compatibility:
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxxxxxxxxxx:YOUR_DB_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
```

---

### Complete environment variable table (all verified from source code)

| Variable | File | Required? | Default if absent |
|---|---|---|---|
| `PORT` | `artifacts/admin-dashboard/vite.config.ts` | **Yes** | Throws on startup |
| `BASE_PATH` | `artifacts/admin-dashboard/vite.config.ts` | **Yes** | Throws on startup |
| `VITE_SUPABASE_URL` | `artifacts/admin-dashboard/src/lib/supabase.ts` | **Yes** | `console.warn`, uses placeholder; login fails |
| `VITE_SUPABASE_ANON_KEY` | `artifacts/admin-dashboard/src/lib/supabase.ts` | **Yes** | `console.warn`, uses placeholder; login fails |
| `VITE_CAFE_ID` | `artifacts/admin-dashboard/src/hooks/usePublicBooking.ts` | No | `undefined` — public booking broken, admin unaffected |
| `PORT` | `artifacts/api-server/src/index.ts` | **Yes** | Throws on startup |
| `NODE_ENV` | `artifacts/api-server/src/lib/logger.ts` | No | `undefined` — pino-pretty used (dev-style logging) |
| `LOG_LEVEL` | `artifacts/api-server/src/lib/logger.ts` | No | `"info"` |
| `DATABASE_URL` | `lib/db/src/index.ts`, `lib/db/drizzle.config.ts` | **Yes (for api-server and db push)** | Throws when DB module is first imported |

---

## 6. Database Setup (Supabase)

### Step 1 — Create a Supabase project

1. Go to https://supabase.com → **New project**.
2. Choose a name, set a strong password, pick a region.
3. Wait ~2 minutes for provisioning.
4. Go to **Project Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`
5. Go to **Project Settings → Database → Connection string → URI** and copy:
   - The **Transaction** pooler string (port 6543) → `DATABASE_URL`

### Step 2 — Apply migrations

There are **35 migration files** in `supabase/migrations/`. They must be applied in strictly ascending numeric order. Each one depends on the previous.

**Note:** There is no `supabase/config.toml` in this repository. The Supabase CLI `supabase db push` command requires a linked project. If you prefer the Dashboard SQL editor, paste each file manually.

**Option A — Supabase Dashboard SQL editor (no CLI required)**

1. Supabase Dashboard → **SQL Editor → New query**.
2. Open each file in VS Code, copy the full contents, paste into the editor, click **Run**.
3. Repeat for all 35 files in this exact order:

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

**Option B — Supabase CLI**

```bash
# Install the CLI: https://supabase.com/docs/guides/cli/getting-started

# Link to your cloud project (project ref is in the Dashboard URL)
supabase link --project-ref xxxxxxxxxxxxxxxxxxxx

# Push migrations
supabase db push
```

### Step 3 — Apply seed data

There is one seed file: `supabase/seed/001_cup_and_cozy.sql`.

Run it **after** all 35 migrations are applied. Paste the full file contents into the SQL editor and click **Run**.

This creates:

- **Cafe**: "Cup & Cozy" with ID `a1b2c3d4-0000-0000-0000-000000000001`
- **8 physical tables**: Table 1, Table 2, Window Seat, Garden Corner, Long Table, Sofa Nook, Bar Stool 1, Bar Stool 2
- **Menu categories and items**
- **A sample promotional offer**

### Step 4 — Create the first staff (owner) account

The seed does **not** create a staff account — passwords cannot be seeded in SQL safely.

**4a.** In Supabase Dashboard → **Authentication → Users**, create a new user with your email and a password.

**4b.** In the SQL editor, run:

```sql
INSERT INTO staff_users (id, cafe_id, email, full_name, role, is_active, must_change_password)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE'),
  'a1b2c3d4-0000-0000-0000-000000000001',
  'YOUR_EMAIL_HERE',
  'Your Name',
  'owner',
  true,
  false
);
```

Replace `YOUR_EMAIL_HERE` and `Your Name` with your actual values.

### Step 5 — Verify

```sql
-- Should return 1 row: Cup & Cozy
SELECT id, name FROM cafes;

-- Should return 8 rows
SELECT number, name FROM cafe_tables ORDER BY number;

-- Should return your owner account
SELECT email, role, is_active FROM staff_users;
```

---

## 7. Storage Buckets

Migration `030_website_settings.sql` automatically creates the following storage bucket:

| Bucket | Public | Max file size | Allowed types | Created by |
|---|---|---|---|---|
| `website-assets` | Yes | 5 MB (5,242,880 bytes) | jpeg, png, webp, gif, svg+xml | Migration 030 |

**The RLS policies applied by migration 030:**

| Operation | Who |
|---|---|
| SELECT (read) | Everyone (public bucket) |
| INSERT (upload) | Authenticated users with `role = 'owner'` only |
| UPDATE | Authenticated users with `role = 'owner'` only |
| DELETE | Authenticated users with `role = 'owner'` only |

**There is no `gallery` bucket defined in this repository.** The previous version of this guide incorrectly mentioned one.

If migration 030 ran successfully, the bucket already exists. Verify in Supabase Dashboard → **Storage** — you should see `website-assets` listed.

---

## 8. Running the Project

There are two runnable services. Run each in a separate terminal.

### Terminal 1 — Admin Dashboard

Package: `@workspace/admin-dashboard`  
Script (from `artifacts/admin-dashboard/package.json`): `dev`  
Command: `vite --config vite.config.ts --host 0.0.0.0`

```bash
pnpm --filter @workspace/admin-dashboard run dev
```

Expected output:

```
VITE v7.x.x  ready in XXXX ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://0.0.0.0:3000/
```

Open **http://localhost:3000** in your browser.

> The dev server uses `strictPort: true` — if port 3000 is in use, it will fail rather than try the next port. Change `PORT=` in `.env.local` to use a different port.

### Terminal 2 — API Server

Package: `@workspace/api-server`  
Script (from `artifacts/api-server/package.json`): `dev`  
Command: `export NODE_ENV=development && pnpm run build && pnpm run start`

```bash
pnpm --filter @workspace/api-server run dev
```

**Important for Windows users:** The dev script uses `export`, which is bash syntax. Run this in **Git Bash**, not in Command Prompt or PowerShell.

Expected output:

```json
{"level":"info","msg":"Server listening","port":5000}
```

The API server is available at **http://localhost:5000/api**.

> The api-server dev script runs a full esbuild compile before starting. There is no hot-reload — changes require restarting the script.

### Relationship between the two services

The admin dashboard communicates **directly with Supabase** via Row-Level Security — it does not proxy through the api-server for most features. The api-server is for guest-facing endpoints (QR ordering, table sessions). You do not need the api-server running for the admin dashboard to work.

---

## 9. Edge Functions (Staff Management)

Two Supabase Edge Functions live in `supabase/functions/`:

| Function | Purpose |
|---|---|
| `create-staff-member` | Creates a Supabase Auth user with a temporary password and sends login credentials via Gmail SMTP |
| `invite-staff-member` | Sends a Supabase Auth invite email to a new staff member |

These run on Supabase's Deno runtime — they are not run locally with `pnpm`. They must be deployed to your Supabase project.

### Environment variables for edge functions

These are set as **Supabase Edge Function Secrets** (Dashboard → Edge Functions → Manage secrets), not in any local `.env` file.

**Auto-injected by Supabase (do NOT set manually):**

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Project REST URL |
| `SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |

**Must be set manually via Supabase dashboard or CLI:**

| Variable | Required by | Description |
|---|---|---|
| `SMTP_USER` | `create-staff-member` only | Gmail address used to send credential emails |
| `SMTP_PASSWORD` | `create-staff-member` only | Gmail App Password (not your account password) |
| `SITE_URL` | Both functions | Admin dashboard base URL, e.g. `https://your-domain.com/admin` |

### Deploying edge functions

```bash
# Install Supabase CLI and link your project first (see Section 6 Option B)
supabase functions deploy create-staff-member
supabase functions deploy invite-staff-member
```

### Setting secrets via CLI

```bash
supabase secrets set SMTP_USER=yourapp@gmail.com
supabase secrets set SMTP_PASSWORD=your-gmail-app-password
supabase secrets set SITE_URL=https://your-domain.com/admin
```

---

## 10. First Login

1. Open **http://localhost:3000** in your browser.
2. Enter the email and password you created in Section 6, Step 4.
3. You will be redirected to the Dashboard.

If `must_change_password` is `true` in the `staff_users` row, the app will prompt for a password change before proceeding.

---

## 11. Useful Commands Reference

All commands verified against `package.json` scripts in the repository.

### From the project root

```bash
# Install all workspace dependencies
pnpm install

# TypeScript check — all packages
pnpm run typecheck

# TypeScript check — shared libraries only (lib/*)
pnpm run typecheck:libs

# Build all packages (runs typecheck first)
pnpm run build
```

### Admin Dashboard (`@workspace/admin-dashboard`)

```bash
# Start dev server (requires PORT and BASE_PATH in .env.local)
pnpm --filter @workspace/admin-dashboard run dev

# Build for production (output: artifacts/admin-dashboard/dist/public/)
pnpm --filter @workspace/admin-dashboard run build

# Preview production build locally
pnpm --filter @workspace/admin-dashboard run serve

# TypeScript check only
pnpm --filter @workspace/admin-dashboard run typecheck
```

### API Server (`@workspace/api-server`)

```bash
# Build + start (development mode, bash required on Windows)
pnpm --filter @workspace/api-server run dev

# Build only (esbuild, output: artifacts/api-server/dist/)
pnpm --filter @workspace/api-server run build

# Start only (requires build to have run first)
pnpm --filter @workspace/api-server run start

# TypeScript check only
pnpm --filter @workspace/api-server run typecheck
```

### Database (`@workspace/db`)

```bash
# Push Drizzle schema to database (requires DATABASE_URL)
pnpm --filter @workspace/db run push

# Push with --force flag (skips confirmation prompts)
pnpm --filter @workspace/db run push-force
```

### API Codegen (`@workspace/api-spec`)

```bash
# Regenerate Zod schemas and TanStack Query hooks from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen
```

Run this whenever `lib/api-spec/` changes.

---

## 12. Troubleshooting

| Problem | Actual cause | Fix |
|---|---|---|
| `"Use pnpm instead"` on install | Ran `npm install` or `yarn install` | Use `pnpm install` |
| `pnpm install` fails with missing esbuild/rollup/tailwindcss binary | Linux-only overrides in `pnpm-workspace.yaml` | Remove the entire `overrides:` block (see Section 3) |
| `export: command not found` or similar on Windows | API server dev script uses bash `export` | Run in Git Bash, not Command Prompt or PowerShell |
| `PORT environment variable is required` | Missing `PORT` in `.env.local` | Add `PORT=3000` to `artifacts/admin-dashboard/.env.local` |
| `BASE_PATH environment variable is required` | Missing `BASE_PATH` in `.env.local` | Add `BASE_PATH=/` to `artifacts/admin-dashboard/.env.local` |
| Vite starts but login fails silently | Missing or wrong Supabase env vars | Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` |
| `DATABASE_URL must be set` | `DATABASE_URL` missing when api-server starts | Add `DATABASE_URL` to `artifacts/api-server/.env` |
| Port 3000 already in use | Another process using that port | Change `PORT=` in `.env.local` or kill the process |
| Port 5000 already in use | Another process using that port | Change `PORT=` in `artifacts/api-server/.env` |
| Migration error: `relation does not exist` | Migrations applied out of order | Re-apply all migrations strictly in numeric order (001 → 035) |
| Login works but no data appears | Seed not applied, or wrong `VITE_CAFE_ID` | Apply `supabase/seed/001_cup_and_cozy.sql`; set `VITE_CAFE_ID=a1b2c3d4-0000-0000-0000-000000000001` |
| Staff account login fails: "Invalid login credentials" | User exists in `auth.users` but not in `staff_users` | Run the INSERT from Section 6, Step 4 |
| `minimum release age` install error | A package is < 24 hours old (supply-chain guard) | Wait 24 hours and retry |
| Realtime not working | Realtime not enabled for tables | Run migration 010 if not yet applied; check Dashboard → Database → Replication |
| Storage upload fails | RLS blocks non-owner roles | Only `owner` role can upload to `website-assets` (see migration 030) |
| Node version mismatch | Using Node 18 or 20 | Install Node 24 — use `nvm` to switch if needed |

---

## 13. Project Structure

Every folder listed here was verified by reading the repository.

```
.
├── artifacts/
│   ├── admin-dashboard/        @workspace/admin-dashboard — React + Vite staff dashboard
│   │   ├── src/
│   │   │   ├── components/     UI components (shadcn/ui wrappers + custom)
│   │   │   ├── hooks/          TanStack Query data hooks (useMenu, useBookings, useStaff, …)
│   │   │   ├── lib/            supabase.ts (client), utils.ts (formatCurrency, cn)
│   │   │   ├── pages/          One file per page (MenuPage, BookingsPage, AnalyticsPage, …)
│   │   │   └── types/          TypeScript types mirroring the Supabase schema
│   │   ├── vite.config.ts      Requires PORT and BASE_PATH env vars at startup
│   │   └── package.json        Scripts: dev, build, serve, typecheck
│   │
│   ├── api-server/             @workspace/api-server — Express 5 REST API
│   │   ├── src/
│   │   │   ├── app.ts          Express setup: CORS (open), JSON body, routes at /api
│   │   │   ├── index.ts        Entry: reads PORT, starts server
│   │   │   ├── routes/         API route handlers
│   │   │   └── lib/logger.ts   Pino logger; reads LOG_LEVEL (default "info"), NODE_ENV
│   │   └── package.json        Scripts: dev, build, start, typecheck
│   │
│   └── mockup-sandbox/         Design preview server (Replit canvas tool — not needed locally)
│
├── lib/
│   ├── db/                     @workspace/db — Drizzle ORM schema + pg Pool
│   │   ├── src/index.ts        Reads DATABASE_URL; throws if missing
│   │   ├── drizzle.config.ts   Reads DATABASE_URL; used by "pnpm run push"
│   │   └── package.json        Scripts: push, push-force
│   │
│   ├── api-spec/               @workspace/api-spec — OpenAPI YAML spec (source of truth)
│   │   └── package.json        Scripts: codegen (runs orval)
│   │
│   ├── api-zod/                @workspace/api-zod — Zod schemas (auto-generated by codegen)
│   └── api-client-react/       @workspace/api-client-react — TanStack Query hooks (auto-generated)
│
├── scripts/                    @workspace/scripts — workspace utility scripts
│   ├── post-merge.sh           Runs after task merges: pnpm install + db push
│   └── package.json            Scripts: hello (tsx), typecheck
│
├── supabase/
│   ├── migrations/             35 SQL files (001–035) — full database schema
│   ├── seed/
│   │   └── 001_cup_and_cozy.sql  Creates "Cup & Cozy" demo tenant
│   └── README.md               Migration index (documents 001–018; 019–035 not yet listed)
│
├── docs/
│   └── auth/                   Role permission matrix reference
│
├── .gitignore                  Does NOT include .env or .env.local — add them manually
├── package.json                Root scripts: build, typecheck, typecheck:libs
├── pnpm-workspace.yaml         Workspace config; overrides block must be removed on non-Linux
└── tsconfig.base.json          Shared TypeScript base config
```

### Packages and their names

| Directory | Package name (`name` in package.json) |
|---|---|
| `artifacts/admin-dashboard` | `@workspace/admin-dashboard` |
| `artifacts/api-server` | `@workspace/api-server` |
| `lib/db` | `@workspace/db` |
| `lib/api-spec` | `@workspace/api-spec` |
| `lib/api-zod` | `@workspace/api-zod` |
| `lib/api-client-react` | `@workspace/api-client-react` |
| `scripts` | `@workspace/scripts` |
| Root | `workspace` (private, not publishable) |

Use the package name with `pnpm --filter` to run scripts in a specific package:

```bash
pnpm --filter @workspace/admin-dashboard run dev
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-spec run codegen
```
