// ============================================================
// Supabase Client Setup — Cafe Maestro Platform
// ============================================================
// Three clients, three contexts. Never mix them.
//
//  1. server.ts   → React Server Components, API Routes, middleware
//  2. client.ts   → Client components ('use client')
//  3. service.ts  → Server-only, bypasses RLS (use sparingly)
//
// Copy into: lib/supabase/
// ============================================================

// ── 1. SERVER CLIENT (server.ts) ─────────────────────────────
// Use in: React Server Components, Server Actions, API Route Handlers

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: ()     => cookieStore.getAll(),
        setAll: (pairs) =>
          pairs.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );
}

// ── 2. BROWSER CLIENT (client.ts) ────────────────────────────
// Use in: 'use client' components, TanStack Query hooks, Realtime subscriptions
// Singleton — do not create multiple instances.

import { createBrowserClient } from '@supabase/ssr';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return browserClient;
}

// ── 3. SERVICE CLIENT (service.ts) ───────────────────────────
// Bypasses RLS. Use ONLY in:
//   - Session creation (guest flow — anon cannot INSERT sessions directly)
//   - pg_cron expiry function calls
//   - Admin bulk operations that need cross-cafe access
//   - NEVER in client components or code reachable by guests
//
// This file must NEVER be imported by client-side code.

import { createClient } from '@supabase/supabase-js';

export const supabaseServiceClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,  // Server-only secret
  { auth: { persistSession: false } }
);
