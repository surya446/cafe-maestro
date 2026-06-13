// ============================================================
// Next.js Middleware — Route Protection
// Cafe Maestro Platform
// Copy into: middleware.ts (project root)
// ============================================================
// Protection layers (innermost wins):
//
//  1. /table/[tableId]/*  → Guest route. Validates device_token cookie.
//                           Redirects to /session-ended if token invalid.
//
//  2. /kitchen/*          → Requires auth + role IN (chef, staff, manager, owner)
//
//  3. /staff/*            → Requires auth + role IN (staff, manager, owner)
//
//  4. /manager/*          → Requires auth + role IN (manager, owner)
//
//  5. /admin/*            → Requires auth + role = owner
//
//  6. /[cafeSlug]/*       → Public. No auth. Resolves cafe from DB.
//
//  7. All else            → Pass through.
//
// Supabase session is refreshed on every request so the JWT
// never silently expires mid-session.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { StaffRole } from '@/lib/auth/types';
import { ROUTE_ROLES } from '@/lib/auth/types';

// Protected route prefixes mapped to minimum allowed roles
const PROTECTED_ROUTES: Array<{ prefix: string; roles: StaffRole[] }> = [
  { prefix: '/admin',   roles: ROUTE_ROLES['/admin']   },
  { prefix: '/manager', roles: ROUTE_ROLES['/manager'] },
  { prefix: '/staff',   roles: ROUTE_ROLES['/staff']   },
  { prefix: '/kitchen', roles: ROUTE_ROLES['/kitchen'] },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  // ── 1. Supabase SSR client (refreshes JWT on every request) ────────────

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:  ()     => request.cookies.getAll(),
        setAll: (pairs) => {
          pairs.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          pairs.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — must be called before getUser()
  const { data: { user } } = await supabase.auth.getUser();

  // ── 2. Guest table route ────────────────────────────────────────────────

  if (pathname.startsWith('/table/')) {
    const deviceToken = request.cookies.get('device_token')?.value;

    if (!deviceToken) {
      // No token — they'll get one when they land on the page
      return response;
    }

    // Validate token is still active (checks session_devices.is_active)
    const { data: device } = await supabase
      .from('session_devices')
      .select('is_active, session_id')
      .eq('device_token', deviceToken)
      .single();

    if (!device || !device.is_active) {
      // Session ended or expired — clear cookie and redirect
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/session-ended';
      const redirect = NextResponse.redirect(redirectUrl);
      redirect.cookies.delete('device_token');
      redirect.cookies.delete('session_id');
      return redirect;
    }

    return response;
  }

  // ── 3. Staff dashboard route protection ────────────────────────────────

  const matchedRoute = PROTECTED_ROUTES.find(r => pathname.startsWith(r.prefix));

  if (matchedRoute) {
    // Not authenticated at all
    if (!user) {
      return redirectToLogin(request, pathname);
    }

    // Look up role for this user
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('role, is_active, cafe_id')
      .eq('id', user.id)
      .single();

    // Account deactivated or not a staff member
    if (!staffUser || !staffUser.is_active) {
      return redirectToLogin(request, pathname, 'account_inactive');
    }

    const userRole = staffUser.role as StaffRole;

    // Role not permitted for this route
    if (!matchedRoute.roles.includes(userRole)) {
      return redirectToCorrectDashboard(request, userRole);
    }

    // Stamp role onto request headers so RSC layout components
    // can read it without a DB call
    response.headers.set('x-staff-role',    userRole);
    response.headers.set('x-staff-cafe-id', staffUser.cafe_id);
    response.headers.set('x-staff-user-id', user.id);

    return response;
  }

  return response;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function redirectToLogin(
  request: NextRequest,
  from: string,
  reason?: string
): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.searchParams.set('redirect', from);
  if (reason) loginUrl.searchParams.set('reason', reason);
  return NextResponse.redirect(loginUrl);
}

function redirectToCorrectDashboard(
  request: NextRequest,
  role: StaffRole
): NextResponse {
  const dest = request.nextUrl.clone();
  dest.pathname = DEFAULT_DASHBOARD[role];
  return NextResponse.redirect(dest);
}

// Where each role lands after login or when accessing a forbidden route
const DEFAULT_DASHBOARD: Record<StaffRole, string> = {
  owner:   '/admin/dashboard',
  manager: '/manager/dashboard',
  staff:   '/staff/dashboard',
  chef:    '/kitchen/display',
};

// ── Matcher ───────────────────────────────────────────────────────────────
// Only run middleware on dashboard + table routes.
// Skip static files, API routes, public pages.

export const config = {
  matcher: [
    '/table/:path*',
    '/kitchen/:path*',
    '/staff/:path*',
    '/manager/:path*',
    '/admin/:path*',
  ],
};
