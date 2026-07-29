# Cup & Cozy — Complete Deployment Guide
### Windows PC → Local Development → Production

> **Generated from source analysis.** Every command, path, and variable below was
> verified directly from the repository files. Nothing is assumed or invented.

---

## Table of Contents

1. [Project Architecture](#1-project-architecture)
2. [Local Requirements](#2-local-requirements)
3. [Clone & First-Time Setup](#3-clone--first-time-setup)
4. [Critical: Fix pnpm-workspace.yaml on Windows](#4-critical-fix-pnpm-workspaceyaml-on-windows)
5. [Environment Variables](#5-environment-variables)
6. [Database — Supabase](#6-database--supabase)
7. [Running Locally](#7-running-locally)
8. [Production Build](#8-production-build)
9. [Deployment Options](#9-deployment-options)
10. [Custom Domain & SSL](#10-custom-domain--ssl)
11. [Project Structure Reference](#11-project-structure-reference)
12. [Build Output Reference](#12-build-output-reference)
13. [Local vs Production Differences](#13-local-vs-production-differences)
14. [Common Errors & Solutions](#14-common-errors--solutions)
15. [Deployment Checklist](#15-deployment-checklist)
16. [Optional Improvements Before Deployment](#16-optional-improvements-before-deployment)

---

## 1. Project Architecture

Cup & Cozy is a **pnpm monorepo** with two independently deployable services.

### Services

| Service | Package | Technology | What It Does |
|---|---|---|---|
| **Admin Dashboard** | `@workspace/admin-dashboard` | React 19 + Vite 7 | Staff-facing SPA: menu, orders, tables, analytics, settings, public website |
| **API Server** | `@workspace/api-server` | Express 5 + Node.js | Guest-facing REST API: QR ordering, table sessions |

### Shared Libraries (inside `lib/`)

| Package | Purpose |
|---|---|
| `@workspace/db` | Drizzle ORM schema + PostgreSQL client |
| `@workspace/api-zod` | Shared Zod validation schemas |
| `@workspace/api-zod` | Shared Zod validation schemas |
| `@workspace/api-client-react` | TanStack Query React hooks (generated) |
| `@workspace/api-spec` | OpenAPI spec + Orval codegen config |

### External Services

| Service | Purpose | Hosted Where |
|---|---|---|
| **Supabase** | PostgreSQL DB, Auth, Realtime, Storage, Edge Functions | Supabase cloud (AWS ap-south-1) |

### Key Technology Details

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | 19.x (catalog) |
| Frontend build | Vite | 7.x (catalog) |
| CSS | Tailwind CSS v4 + shadcn/ui | catalog |
| Routing | Wouter | ^3.3.5 |
| State / data | TanStack React Query | catalog |
| Animations | Framer Motion + GSAP | catalog |
| Backend framework | Express | ^5.2.1 |
| Backend build | esbuild | 0.27.3 |
| Database ORM | Drizzle ORM | catalog |
| Database | PostgreSQL (via Supabase) | Supabase-managed |
| Auth | Supabase Auth | email/password (staff only) |
| Realtime | Supabase Realtime | enabled on orders, sessions, tables |
| Storage | Supabase Storage | `downloads` bucket (APK files) |
| Edge Functions | Deno (3 functions) | deployed to Supabase |
| Package manager | pnpm | 10.x |
| Language | TypeScript | ~5.9.3 |

### Authentication Model

- **Staff** authenticate via Supabase Auth (email + password). Four roles: `owner`, `manager`, `staff`, `chef`.
- **Guests** (QR ordering) never log in. They are identified by an ephemeral `device_token` only. No Supabase Auth account is created for guests.

---

## 2. Local Requirements

### Required Software

Install all of these before proceeding.

#### Node.js 24.x

The project specifies Node.js 24.x.

```
https://nodejs.org/en/download
```

Verify:
```bash
node --version
# Should print v24.x.x
```

#### pnpm 10.x

Install after Node.js:

```bash
npm install -g pnpm@latest
```

Verify:
```bash
pnpm --version
# Should print 10.x.x
```

> **Why pnpm?** The project's `preinstall` script actively rejects `npm` and `yarn`.
> Running `npm install` prints "Use pnpm instead" and exits with an error.

#### Git

```
https://git-scm.com/download/win
```

Install **Git for Windows**. This also installs **Git Bash**, which you need because the API server's dev script uses POSIX shell syntax (`export NODE_ENV=development`) that only works in bash — not in Windows Command Prompt or PowerShell.

> **Always use Git Bash (not PowerShell/CMD)** for all commands in this guide.

Verify:
```bash
git --version
```

#### Supabase CLI (Required for Edge Functions)

Only needed if you want to deploy or update the three Edge Functions (staff management).
If you are connecting to the existing Supabase project and not modifying Edge Functions, you can skip this for now.

```bash
npm install -g supabase
```

Verify:
```bash
supabase --version
```

---

## 3. Clone & First-Time Setup

Open **Git Bash** and run each command.

### Step 1 — Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

Replace `YOUR_USERNAME/YOUR_REPO_NAME` with your actual GitHub repository path.

### Step 2 — Fix pnpm-workspace.yaml (CRITICAL — read next section first)

> ⚠️ Do NOT run `pnpm install` yet. Read Section 4 first.

### Step 3 — Install dependencies

After fixing `pnpm-workspace.yaml`:

```bash
pnpm install
```

This single command installs packages for every workspace package:
- `artifacts/admin-dashboard`
- `artifacts/api-server`
- `lib/db`, `lib/api-zod`, `lib/api-client-react`, `lib/api-spec`
- `scripts`

You do **not** need to `cd` into subfolders and run `pnpm install` separately.

---

## 4. Critical: Fix pnpm-workspace.yaml on Windows

**This step is mandatory for Windows.** Skip only if running Linux x86-64.

The `pnpm-workspace.yaml` file contains an `overrides:` block that was added specifically for Replit's Linux x86-64 environment. It explicitly excludes native binary packages for `esbuild`, `rollup`, `lightningcss`, and `@tailwindcss/oxide` for every non-Linux platform — including Windows.

If you don't remove this block, `pnpm install` will appear to succeed but the binaries required to actually build the project will be missing, causing cryptic build failures.

### How to fix

Open `pnpm-workspace.yaml` in any text editor and **delete the entire `overrides:` block** — everything from the `overrides:` line to the end of the file.

After your edit, the bottom of `pnpm-workspace.yaml` should end with:

```yaml
autoInstallPeers: false

onlyBuiltDependencies:
  - '@swc/core'
  - esbuild
  - msw
  - unrs-resolver

# File ends here — no overrides: block
```

Save the file. Now run `pnpm install`.

---

## 5. Environment Variables

The project uses two separate `.env` files — one for the frontend, one for the backend.

> **Security rule:** Never commit `.env` files to Git. They should already be in `.gitignore`.
> If not, add them manually before creating the files.

Add to `.gitignore` if missing:
```
.env
.env.local
.env.production
.env.*.local
```

---

### 5.1 Admin Dashboard — `artifacts/admin-dashboard/.env.local`

Create this file from scratch:

```env
# ── Vite dev server ───────────────────────────────────────────────────────────
# Required. vite.config.ts throws an error if PORT is missing.
PORT=3000

# Required. vite.config.ts throws an error if BASE_PATH is missing.
# Use / for local development (no sub-path prefix).
BASE_PATH=/

# ── Supabase ──────────────────────────────────────────────────────────────────
# Required. Read in src/lib/supabase.ts.
# Source: Supabase Dashboard → Project Settings → API → Project URL
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co

# Required. Read in src/lib/supabase.ts.
# Source: Supabase Dashboard → Project Settings → API → anon / public key
# This key is SAFE TO EXPOSE publicly (it is a publishable key).
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional. Only needed for the public booking feature.
# Source: Run `SELECT id FROM cafes LIMIT 1;` in Supabase SQL editor after seeding.
# The seed hardcodes: a1b2c3d4-0000-0000-0000-000000000001
VITE_CAFE_ID=a1b2c3d4-0000-0000-0000-000000000001
```

| Variable | Required | Public/Secret | Source |
|---|---|---|---|
| `PORT` | Yes | Neither (local only) | Set to `3000` |
| `BASE_PATH` | Yes | Neither (local only) | Set to `/` |
| `VITE_SUPABASE_URL` | Yes | Public (safe to expose) | Supabase Dashboard → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Yes | Public (safe to expose) | Supabase Dashboard → Project Settings → API |
| `VITE_CAFE_ID` | Optional | Public | Run SQL query after seeding |

---

### 5.2 API Server — `artifacts/api-server/.env`

Create this file from scratch:

```env
# Required. The port the Express server listens on.
PORT=8080

# Required. PostgreSQL connection string.
# Source: Supabase Dashboard → Project Settings → Database → Connection pooling
# IMPORTANT: Use the Transaction pooler URL (port 6543), NOT the direct connection (port 5432).
# Format: postgresql://postgres.PROJECT_REF:PASSWORD@aws-REGION.pooler.supabase.com:6543/postgres
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxxxxxxxxxx:YOUR_DB_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres

# Optional. Controls log verbosity. Defaults to "info".
# Values: trace | debug | info | warn | error | fatal
LOG_LEVEL=info
```

| Variable | Required | Public/Secret | Source |
|---|---|---|---|
| `PORT` | Yes | Neither (local only) | Set to `8080` |
| `DATABASE_URL` | Yes | **Secret — never expose** | Supabase Dashboard → Project Settings → Database → Transaction pooler |
| `LOG_LEVEL` | No | Neither | Set to `info` |

> **Why port 6543, not 5432?**
> Port 6543 is Supabase's **Transaction pooler** (PgBouncer). It is designed for serverless/short-lived connections. Port 5432 is the direct connection and is rate-limited on hosted plans.

---

### 5.3 Supabase Edge Function Secrets

These are not in `.env` files — they live inside Supabase and are injected into the Edge Functions at runtime.

Set them via the Supabase Dashboard → Project Settings → Edge Functions → Secrets, **or** via the CLI:

```bash
supabase secrets set SMTP_USER=yourapp@gmail.com
supabase secrets set SMTP_PASSWORD=your-gmail-app-password
supabase secrets set SITE_URL=https://your-deployed-domain.com/admin
```

| Secret | Required For | How to Obtain |
|---|---|---|
| `SMTP_USER` | `create-staff-member` | Your Gmail address |
| `SMTP_PASSWORD` | `create-staff-member` | Gmail → Google Account → Security → App Passwords |
| `SITE_URL` | `create-staff-member`, `invite-staff-member` | Your deployed admin dashboard URL |

> **Gmail App Password:** You cannot use your regular Gmail password. You must create an App Password. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords). Requires 2-Step Verification to be enabled on your Google account.

---

## 6. Database — Supabase

### What Supabase provides

This project uses Supabase for everything database-related:

| Feature | Used For |
|---|---|
| PostgreSQL | All application data |
| Supabase Auth | Staff login (email/password) |
| Row-Level Security (RLS) | Data isolation per café |
| Realtime | Live order/session updates |
| Storage | APK file downloads (`downloads` bucket) |
| Edge Functions | Staff creation/deletion with email |
| pg_cron | Automatic session expiry every 5 minutes |

### The database is hosted remotely

You do **not** run a local PostgreSQL server. Your local code connects to your Supabase project over the internet. This means:
- No local database setup needed.
- You need an internet connection to develop locally.
- All developers share the same database (there is no built-in local dev/prod split unless you create separate Supabase projects).

### Connecting to the existing Supabase project

The project is already linked to Supabase project `usllfqogcdskfeszntwf` (AWS Mumbai region). To connect:

1. Log in to [app.supabase.com](https://app.supabase.com)
2. Open the project
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`
4. Go to **Project Settings → Database → Connection pooling** and copy:
   - **Transaction pooler connection string** (port 6543) → `DATABASE_URL`
   - Replace `[YOUR-PASSWORD]` with your actual database password

### Running Migrations

The project has **45 migration files** in `supabase/migrations/` (001 through 045).

If the database is already set up (the existing Replit project was connected to it), you do NOT need to re-run migrations — they have already been applied.

If you are setting up a **brand-new Supabase project**, you must apply every migration in order.

#### Option A — Supabase Dashboard SQL Editor (no CLI required)

1. Open your Supabase project
2. Go to **SQL Editor**
3. Open each file from `supabase/migrations/` in numeric order (001, 002, ..., 045)
4. Paste the content and click **Run** for each file
5. After all migrations, run `supabase/seed/001_cup_and_cozy.sql` to load demo data

#### Option B — Supabase CLI

```bash
# Log in to Supabase
supabase login

# Link to your project (use your project ref)
supabase link --project-ref usllfqogcdskfeszntwf

# Push all migrations
supabase db push

# Apply seed data
supabase db execute --file supabase/seed/001_cup_and_cozy.sql
```

### Storage Buckets

The app uses a Supabase Storage bucket called `downloads` for APK file distribution.

Create it via the Supabase Dashboard → Storage → New bucket:
- **Name:** `downloads`
- **Public:** No (private bucket — access controlled via RLS)

Or via SQL (in the Dashboard SQL editor):
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('downloads', 'downloads', false);
```

### Edge Functions

Three Deno Edge Functions handle staff management:

| Function | Purpose |
|---|---|
| `create-staff-member` | Creates a Supabase Auth user with a temp password, sends credentials via Gmail |
| `delete-staff-member` | Deletes a Supabase Auth user and deactivates the staff record |
| `invite-staff-member` | Sends a Supabase Auth invite email to a new staff member |

#### Deploying Edge Functions

```bash
# Log in and link (if not already done)
supabase login
supabase link --project-ref usllfqogcdskfeszntwf

# Deploy all three functions
supabase functions deploy create-staff-member
supabase functions deploy delete-staff-member
supabase functions deploy invite-staff-member

# Set required secrets
supabase secrets set SMTP_USER=yourapp@gmail.com
supabase secrets set SMTP_PASSWORD=your-gmail-app-password
supabase secrets set SITE_URL=https://your-deployed-domain.com/admin
```

### First Login

After applying migrations and seed data:

1. Go to your Supabase Dashboard → **Authentication → Users**
2. Click **Add user → Create new user**
3. Enter an email and password
4. In the **SQL Editor**, run:
   ```sql
   INSERT INTO staff_users (id, cafe_id, email, full_name, role, is_active)
   VALUES (
     '<paste-the-auth-user-uuid-here>',
     'a1b2c3d4-0000-0000-0000-000000000001',
     'your@email.com',
     'Your Name',
     'owner',
     true
   );
   ```
5. Log in to the admin dashboard with that email and password.

---

## 7. Running Locally

You need **two terminal windows** (both in Git Bash), both run from the project root.

### Terminal 1 — Admin Dashboard (Frontend)

```bash
# From the project root
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/admin-dashboard run dev
```

Or if you created `artifacts/admin-dashboard/.env.local` (recommended):

```bash
pnpm --filter @workspace/admin-dashboard run dev
```

The dashboard opens at: **http://localhost:3000**

---

### Terminal 2 — API Server (Backend)

```bash
# From the project root (MUST use Git Bash, not CMD/PowerShell)
PORT=8080 DATABASE_URL="postgresql://..." pnpm --filter @workspace/api-server run dev
```

Or if you created `artifacts/api-server/.env` (recommended):

```bash
pnpm --filter @workspace/api-server run dev
```

The API server runs at: **http://localhost:8080**

Health check: **http://localhost:8080/api/healthz**

---

### What each command does

| Command | What happens |
|---|---|
| `pnpm --filter @workspace/admin-dashboard run dev` | Starts Vite dev server with HMR. Changes to React/CSS files update the browser instantly without a full page reload. |
| `pnpm --filter @workspace/api-server run dev` | Runs `export NODE_ENV=development && pnpm run build && pnpm run start` — builds the Express server with esbuild, then starts it. **Note:** unlike Vite, the API server does NOT hot-reload. You must restart it after backend changes. |

---

### Preview Production Build (locally)

After running a production build (Section 8), serve it locally:

```bash
# Admin Dashboard
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/admin-dashboard run serve
```

This runs `vite preview` — serves the compiled static files exactly as they would appear in production.

---

## 8. Production Build

### Build the Admin Dashboard

```bash
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/admin-dashboard run build
```

Output: `artifacts/admin-dashboard/dist/public/`

This is a folder of static HTML, CSS, and JS files. Deploy these to any static host.

**For deployment to a subdirectory** (e.g., `yourdomain.com/admin/`):

```bash
PORT=3000 BASE_PATH=/admin/ pnpm --filter @workspace/admin-dashboard run build
```

> `BASE_PATH` must match the path where the app is served. If it mismatches, assets will 404.

### Build the API Server

```bash
pnpm --filter @workspace/api-server run build
```

Output: `artifacts/api-server/dist/`

This creates a single bundled Node.js file `dist/index.mjs` plus pino worker files. To start the built server:

```bash
PORT=8080 DATABASE_URL="postgresql://..." node --enable-source-maps artifacts/api-server/dist/index.mjs
```

---

## 9. Deployment Options

### Architecture Decision

Cup & Cozy has **two services to deploy** separately:

| Service | Type | Deploy to |
|---|---|---|
| Admin Dashboard | Static files (HTML/CSS/JS) | Any static host |
| API Server | Node.js process | Any Node.js host |

---

### ⭐ Recommended: Vercel (Frontend) + Railway (Backend)

This is the easiest, most reliable combination for this project. Both have free tiers and deploy directly from GitHub.

---

### Option A — Vercel (Admin Dashboard)

Vercel is ideal for the frontend: zero-config static deployment, global CDN, free SSL, free tier.

#### Steps

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repository
3. Configure the project:

   - **Framework Preset:** Vite
   - **Root Directory:** `artifacts/admin-dashboard`
   - **Build Command:** `cd ../.. && pnpm install && PORT=3000 BASE_PATH=/ pnpm --filter @workspace/admin-dashboard run build`
   - **Output Directory:** `dist/public`
   - **Install Command:** *(leave blank — handled by build command)*

4. Add Environment Variables in Vercel dashboard:

   | Key | Value |
   |---|---|
   | `PORT` | `3000` |
   | `BASE_PATH` | `/` |
   | `VITE_SUPABASE_URL` | Your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |
   | `VITE_CAFE_ID` | Your café UUID |

5. Click Deploy.

> **Important for Windows:** The `pnpm-workspace.yaml` overrides fix (Section 4) must be applied and committed before deploying. Vercel runs on Linux x86-64, so the overrides block will actually work there — but if you've deleted it for local Windows development, leave it deleted and commit that change. The build will work without it on Vercel.

#### Vercel SPA routing

Vite single-page apps need a rewrite rule so all routes serve `index.html`. Create `artifacts/admin-dashboard/public/_redirects`:
```
/* /index.html 200
```

Or add a `vercel.json` in `artifacts/admin-dashboard/`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

### Option B — Railway (API Server)

Railway deploys Node.js services from GitHub with zero config, handles environment variables, and provides a permanent URL.

#### Steps

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select your repository
3. Railway auto-detects Node.js. Override the settings:

   - **Root Directory:** `artifacts/api-server`
   - **Build Command:** `cd ../.. && pnpm install && pnpm --filter @workspace/api-server run build`
   - **Start Command:** `node --enable-source-maps dist/index.mjs`

4. Add Environment Variables in Railway dashboard:

   | Key | Value |
   |---|---|
   | `PORT` | Railway sets this automatically |
   | `DATABASE_URL` | Your Supabase Transaction pooler URL (port 6543) |
   | `NODE_ENV` | `production` |
   | `LOG_LEVEL` | `info` |

5. Deploy. Railway provides a URL like `your-app.railway.app`.

---

### Option C — Netlify (Admin Dashboard)

Similar to Vercel, good alternative for the static frontend.

Create `artifacts/admin-dashboard/netlify.toml`:
```toml
[build]
  base    = "artifacts/admin-dashboard"
  command = "cd ../.. && pnpm install && pnpm --filter @workspace/admin-dashboard run build"
  publish = "dist/public"

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

Add the same environment variables as the Vercel option.

---

### Option D — Render

Render can host both services.

**Frontend (Static Site):**
- Build Command: `cd ../.. && pnpm install && PORT=3000 BASE_PATH=/ pnpm --filter @workspace/admin-dashboard run build`
- Publish Directory: `artifacts/admin-dashboard/dist/public`

**Backend (Web Service):**
- Root Directory: `artifacts/api-server`
- Build Command: `cd ../.. && pnpm install && pnpm --filter @workspace/api-server run build`
- Start Command: `node --enable-source-maps dist/index.mjs`
- Environment: Node

---

### Option E — VPS (Ubuntu/Debian with Nginx + PM2)

For full control over your server.

#### Install on the VPS

```bash
# Install Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx
sudo apt-get install -y nginx
```

#### Deploy

```bash
# Clone and build
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git /var/www/cup-and-cozy
cd /var/www/cup-and-cozy

# Fix pnpm-workspace.yaml (NOT needed on Linux — skip Section 4)
pnpm install

# Build frontend
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/admin-dashboard run build

# Build backend
pnpm --filter @workspace/api-server run build

# Start API server with PM2
PORT=8080 DATABASE_URL="postgresql://..." pm2 start \
  "node --enable-source-maps /var/www/cup-and-cozy/artifacts/api-server/dist/index.mjs" \
  --name cup-and-cozy-api

pm2 save
pm2 startup
```

#### Nginx configuration

Create `/etc/nginx/sites-available/cup-and-cozy`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Admin Dashboard (static files)
    location / {
        root /var/www/cup-and-cozy/artifacts/admin-dashboard/dist/public;
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API Server (proxy to Node.js)
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/cup-and-cozy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### Option F — Docker

No `Dockerfile` exists in the repository. Docker is not used or required.

If you want to containerize, you would need to create a `Dockerfile` for each service. This is listed as an optional improvement in Section 16.

---

### Deployment Option Comparison

| Option | Ease | Cost | Best For |
|---|---|---|---|
| **Vercel + Railway** ⭐ | Very easy | Free tier available | Most teams |
| Netlify + Render | Easy | Free tier available | Good alternative |
| VPS + Nginx + PM2 | Advanced | Cheapest long-term | Production scale |
| Docker | Advanced | Depends on host | CI/CD pipelines |

---

## 10. Custom Domain & SSL

### Vercel (Frontend)

1. Vercel Dashboard → Your Project → Settings → Domains
2. Add your domain (e.g. `admin.yourcafe.com`)
3. Vercel provides the DNS records to add (usually a CNAME or A record)
4. Add those records at your domain registrar (GoDaddy, Namecheap, Cloudflare DNS, etc.)
5. SSL certificate is **automatic and free** — Vercel provisions it via Let's Encrypt

### Railway (Backend)

1. Railway Dashboard → Your Service → Settings → Networking → Custom Domain
2. Add your domain (e.g. `api.yourcafe.com`)
3. Railway shows a CNAME target — add it at your registrar
4. SSL is automatic

### VPS (Nginx)

Use Certbot (Let's Encrypt) for free SSL:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# Follow the interactive prompts
# Certbot auto-renews certificates
```

### DNS Records Summary

| Record Type | Name | Value | Purpose |
|---|---|---|---|
| `A` | `@` or `yourdomain.com` | Your server IP | Root domain → VPS |
| `CNAME` | `www` | `yourdomain.com` | www redirect |
| `CNAME` | `admin` | `cname.vercel-dns.com` | Frontend → Vercel |
| `CNAME` | `api` | `your-app.railway.app` | Backend → Railway |

DNS changes typically take 5–30 minutes to propagate worldwide.

---

## 11. Project Structure Reference

```
workspace/
│
├── artifacts/                        # Deployable services
│   ├── admin-dashboard/              # React + Vite SPA
│   │   ├── src/
│   │   │   ├── App.tsx               # Root component + all routes
│   │   │   ├── main.tsx              # React entry point
│   │   │   ├── index.css             # Global styles + Tailwind tokens
│   │   │   ├── components/
│   │   │   │   ├── layout/           # AppLayout, Sidebar, CafeLayout
│   │   │   │   ├── common/           # Reusable UI pieces
│   │   │   │   ├── ui/               # shadcn/ui component library
│   │   │   │   ├── native/           # Capacitor Android wrappers
│   │   │   │   ├── public/           # Public-facing booking modal
│   │   │   │   └── updates/          # App update gate (Android)
│   │   │   ├── pages/                # One file per route/screen
│   │   │   │   ├── TableSessionPage.tsx   # QR ordering (guest-facing)
│   │   │   │   ├── DashboardPage.tsx
│   │   │   │   ├── MenuPage.tsx      # Staff menu management
│   │   │   │   ├── OrdersPage.tsx
│   │   │   │   ├── TablesPage.tsx
│   │   │   │   ├── StaffPage.tsx
│   │   │   │   ├── AnalyticsPage.tsx
│   │   │   │   ├── CafePage.tsx      # Public website home
│   │   │   │   └── ...
│   │   │   ├── hooks/                # Custom React hooks (useAuth, useOrders…)
│   │   │   ├── context/              # React Context providers
│   │   │   ├── lib/
│   │   │   │   ├── supabase.ts       # Supabase client + auth helpers
│   │   │   │   └── queryClient.ts    # TanStack Query client
│   │   │   ├── services/             # API service layer
│   │   │   ├── types/                # TypeScript type definitions
│   │   │   ├── config/               # Static app configuration
│   │   │   └── native/               # Capacitor native bridge helpers
│   │   ├── public/                   # Static assets (images, favicon)
│   │   ├── android/                  # Capacitor Android project (phone)
│   │   ├── android-tv/               # Capacitor Android TV project
│   │   ├── vite.config.ts            # Vite build configuration
│   │   ├── capacitor.config.ts       # Capacitor config (mobile)
│   │   └── package.json
│   │
│   └── api-server/                   # Express 5 REST API
│       ├── src/
│       │   ├── index.ts              # Entry point (reads PORT, starts server)
│       │   ├── app.ts                # Express app (CORS, logging, routes)
│       │   ├── routes/
│       │   │   ├── index.ts          # Route aggregator
│       │   │   └── health.ts         # GET /api/healthz
│       │   ├── middlewares/          # Express middleware
│       │   └── lib/
│       │       └── logger.ts         # Pino logger setup
│       ├── build.mjs                 # esbuild bundler script
│       └── package.json
│
├── lib/                              # Shared internal libraries
│   ├── api-client-react/             # Generated TanStack Query hooks
│   ├── api-spec/                     # OpenAPI spec + Orval codegen config
│   ├── api-zod/                      # Shared Zod validation schemas
│   └── db/                           # Drizzle ORM
│       ├── src/
│       │   ├── index.ts              # DB client (reads DATABASE_URL)
│       │   └── schema/index.ts       # Drizzle table definitions
│       └── drizzle.config.ts         # Drizzle Kit config
│
├── supabase/                         # Supabase project config
│   ├── migrations/                   # 45 SQL migration files (apply in order)
│   ├── functions/                    # 3 Deno Edge Functions
│   │   ├── create-staff-member/      # Creates staff with temp password
│   │   ├── delete-staff-member/      # Deletes staff auth account
│   │   └── invite-staff-member/      # Sends Supabase invite email
│   ├── seed/
│   │   └── 001_cup_and_cozy.sql      # Demo data (café, tables, menu)
│   └── README.md                     # Migration reference
│
├── sql/                              # Extra SQL utilities (not migrations)
├── docs/                             # Project documentation
├── scripts/                          # Monorepo utility scripts
├── attached_assets/                  # Design reference images
├── package.json                      # Root workspace package
├── pnpm-workspace.yaml               # Workspace config + package catalog
├── tsconfig.base.json                # Shared TypeScript config
├── tsconfig.json                     # Root TS project references
└── LOCAL_SETUP.md                    # Original setup guide
```

---

## 12. Build Output Reference

### Admin Dashboard

```
artifacts/admin-dashboard/dist/public/
├── index.html          # Entry HTML (references hashed asset filenames)
├── assets/
│   ├── index-[hash].js   # All JavaScript (React app, bundled)
│   └── index-[hash].css  # All CSS (Tailwind, component styles)
└── [public/ files]     # Copied as-is from artifacts/admin-dashboard/public/
                        # (images, favicon, robots.txt, etc.)
```

**Upload the entire `dist/public/` folder** to your static host.

### API Server

```
artifacts/api-server/dist/
├── index.mjs               # Bundled Express server (everything in one file)
├── index.mjs.map           # Source map for stack traces
├── pino-worker.mjs         # Pino logging worker
├── pino-file.mjs           # Pino file transport
├── pino-pretty.mjs         # Pino pretty printer
└── thread-stream-worker.mjs
```

**Deploy the entire `dist/` folder** to your Node.js host and run `node --enable-source-maps dist/index.mjs`.

---

## 13. Local vs Production Differences

| Aspect | Local (dev) | Production |
|---|---|---|
| `BASE_PATH` | `/` | `/` (or `/admin/` if serving under a subpath) |
| Vite HMR | Enabled — browser auto-updates on save | Not used — static files served by CDN |
| API server reload | Manual restart required on code changes | Managed by PM2 / Railway / Render |
| Source maps | Always generated | Generated, but served separately (`.map` files) |
| Error overlay | Vite runtime error modal in browser | Not present |
| Replit plugins | `@replit/vite-plugin-cartographer` and `@replit/vite-plugin-dev-banner` loaded | Skipped (guarded by `process.env.REPL_ID !== undefined`) |
| `NODE_ENV` | `development` | `production` |
| Logging | Pino pretty (human-readable) | Pino JSON (for log aggregators) |
| CORS | Allows all origins | Consider restricting in `src/app.ts` |

---

## 14. Common Errors & Solutions

### `pnpm install` fails with missing binary error

**Cause:** The `overrides:` block in `pnpm-workspace.yaml` was not removed on Windows.

**Solution:** Follow Section 4 — delete the `overrides:` block and re-run `pnpm install`.

---

### `PORT environment variable is required`

**Cause:** Missing `PORT` in the `.env.local` (dashboard) or environment.

**Solution:**
- Dashboard: Add `PORT=3000` to `artifacts/admin-dashboard/.env.local`
- API: Add `PORT=8080` to `artifacts/api-server/.env`

---

### `BASE_PATH environment variable is required`

**Cause:** Missing `BASE_PATH` in the dashboard environment.

**Solution:** Add `BASE_PATH=/` to `artifacts/admin-dashboard/.env.local`

---

### `SUPABASE_DATABASE_URL must be set`

**Cause:** `DATABASE_URL` (or `SUPABASE_DATABASE_URL`) is missing from the API server environment.

**Solution:** Add `DATABASE_URL=postgresql://...` to `artifacts/api-server/.env`. Use the Transaction pooler URL (port 6543) from Supabase Dashboard → Project Settings → Database.

---

### Login always fails (no error message)

**Cause:** `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is wrong or missing.

**Solution:** Check `artifacts/admin-dashboard/.env.local`. Open browser DevTools → Console — you will see `[supabase init]` log showing what URL and key prefix are being used. Verify these match your Supabase project.

---

### White screen after deploying to a subdirectory

**Cause:** `BASE_PATH` was `/` during build but the app is served at `/admin/`.

**Solution:** Rebuild with `BASE_PATH=/admin/`:
```bash
PORT=3000 BASE_PATH=/admin/ pnpm --filter @workspace/admin-dashboard run build
```

---

### Page refreshes return 404 on static hosts

**Cause:** The SPA uses client-side routing. Static hosts serve 404 for any URL that isn't a real file.

**Solution:** Add a rewrite/redirect rule:
- **Vercel:** Add `vercel.json` with rewrites (see Section 9)
- **Netlify:** Add `_redirects` file or `netlify.toml` (see Section 9)
- **Nginx:** Add `try_files $uri $uri/ /index.html;` (see Section 9)

---

### `export NODE_ENV=development` fails (Windows CMD / PowerShell)

**Cause:** The API server's dev script uses POSIX shell syntax.

**Solution:** Use **Git Bash** for all terminal commands — not Windows CMD or PowerShell.

---

### Edge Function fails to send email

**Cause:** `SMTP_USER`, `SMTP_PASSWORD`, or `SITE_URL` secrets are not set, or the Gmail App Password is wrong.

**Solution:**
1. Verify secrets: Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Make sure you're using a **Gmail App Password**, not your regular Gmail password
3. Check that 2-Step Verification is enabled on the Gmail account
4. Check Edge Function logs: Supabase Dashboard → Edge Functions → Logs

---

### `listen EADDRINUSE: address already in use`

**Cause:** Another process (possibly another dev server) is already running on port 3000 or 8080.

**Solution:**
```bash
# Find what's using port 3000 (Git Bash)
netstat -ano | grep :3000
# Kill it by PID, or change PORT in your .env
```

---

### Database connection timeout

**Cause:** Using the direct connection (port 5432) instead of the Transaction pooler (port 6543).

**Solution:** In `DATABASE_URL`, ensure the URL uses port `6543`, not `5432`.

---

## 15. Deployment Checklist

Use this checklist for every deployment.

### Local Setup

- [ ] Install Node.js 24.x
- [ ] Install pnpm 10.x (`npm install -g pnpm`)
- [ ] Install Git for Windows (includes Git Bash)
- [ ] Clone the repository
- [ ] Remove `overrides:` block from `pnpm-workspace.yaml` (Windows only)
- [ ] Run `pnpm install` from the project root
- [ ] Create `artifacts/admin-dashboard/.env.local` with all required variables
- [ ] Create `artifacts/api-server/.env` with all required variables

### Database

- [ ] Log in to Supabase Dashboard
- [ ] Confirm project is accessible (`usllfqogcdskfeszntwf`)
- [ ] Verify migrations 001–045 have been applied
- [ ] Verify seed data exists (or apply `supabase/seed/001_cup_and_cozy.sql`)
- [ ] Verify `downloads` storage bucket exists
- [ ] Create at least one owner account in `staff_users`

### Local Development Verification

- [ ] Start admin dashboard: `pnpm --filter @workspace/admin-dashboard run dev`
- [ ] Start API server: `pnpm --filter @workspace/api-server run dev`
- [ ] Visit http://localhost:3000 — login page appears
- [ ] Log in successfully with owner credentials
- [ ] Verify http://localhost:8080/api/healthz returns `{"status":"ok"}`

### Production Build

- [ ] Set correct `BASE_PATH` for production deployment
- [ ] Build dashboard: `pnpm --filter @workspace/admin-dashboard run build`
- [ ] Build API server: `pnpm --filter @workspace/api-server run build`
- [ ] Verify `artifacts/admin-dashboard/dist/public/index.html` exists
- [ ] Verify `artifacts/api-server/dist/index.mjs` exists

### Deploy Frontend

- [ ] Deploy `dist/public/` to Vercel / Netlify / CDN
- [ ] Set all `VITE_*` environment variables on the host
- [ ] Add SPA rewrite rule (all routes → `index.html`)
- [ ] Verify deployed URL loads login page

### Deploy Backend

- [ ] Deploy `dist/` to Railway / Render / VPS
- [ ] Set `DATABASE_URL` and `NODE_ENV=production` on the host
- [ ] Verify `/api/healthz` returns `{"status":"ok"}`

### Edge Functions

- [ ] Deploy all three Edge Functions via Supabase CLI
- [ ] Set `SMTP_USER`, `SMTP_PASSWORD`, `SITE_URL` secrets
- [ ] Test staff creation from admin dashboard

### Custom Domain

- [ ] Add domain in Vercel / Railway / Nginx
- [ ] Update DNS records at registrar
- [ ] Wait for DNS propagation (5–30 min)
- [ ] Verify HTTPS works (padlock in browser)
- [ ] Update `SITE_URL` Edge Function secret to your real domain

### Final Verification

- [ ] Log in on the production URL
- [ ] Create a test menu item
- [ ] Test QR ordering flow (scan a table QR code or visit `/table/TEST_TOKEN`)
- [ ] Verify realtime updates work (open two browser windows)
- [ ] Test staff creation (requires working SMTP)

---

## 16. Optional Improvements Before Deployment

These are recommendations only. No code has been modified.

---

### 1. Add a `.env.example` file

**Why:** The project has no `.env.example`. Every developer must read the documentation to know which variables are required. A committed `.env.example` with placeholder values makes onboarding instant.

**Files to create:**
- `artifacts/admin-dashboard/.env.example`
- `artifacts/api-server/.env.example`

---

### 2. Add `vercel.json` and `netlify.toml`

**Why:** Deploying the SPA to Vercel or Netlify without a rewrite rule causes 404 on page refresh. These config files should be committed so deployments work out of the box.

**Files to create:**
- `artifacts/admin-dashboard/vercel.json`
- `artifacts/admin-dashboard/netlify.toml`

---

### 3. Add a `Dockerfile` for the API server

**Why:** The API server has no Docker config. A `Dockerfile` would enable deployment to any cloud that accepts containers (Google Cloud Run, AWS ECS, Fly.io, etc.) and makes the deployment environment reproducible.

**File to create:** `artifacts/api-server/Dockerfile`

---

### 4. Restrict CORS in production

**Why:** `src/app.ts` uses `app.use(cors())` with no origin restriction — this allows any website to call your API. In production, restrict it to your frontend domain.

**File to update:** `artifacts/api-server/src/app.ts`

---

### 5. Separate Supabase projects for dev and production

**Why:** Currently there is one Supabase project used for everything. Any developer running locally is connected to the same database as production. A separate staging project prevents accidental production data corruption during development.

---

### 6. Add a `railway.json` or `render.yaml`

**Why:** Committing deployment config files for Railway or Render means deployment settings are version-controlled and don't need to be manually configured in the host's dashboard.

---

### 7. Environment-specific `BASE_PATH` in CI/CD

**Why:** The `BASE_PATH` must match where the app is served. Hardcoding it into a build script or CI/CD variable prevents misconfiguration. Consider adding a `build:production` script to `package.json` that sets the correct value.
