// ============================================================
// Next.js Middleware — Route Protection
// Cafe Maestro Platform — Final Authorization Model
// Copy into: middleware.ts (project root)
// ============================================================
//
// Route groups and allowed roles:
//
//   /kitchen/*  → chef, staff, manager, owner
//   /staff/*    → staff, manager, owner
//   /admin/*    → manager, owner
//                 Sub-page restrictions (settings, audit-logs)
//                 are enforced at the page/API layer, not here.
//
// No /manager/* route exists.
// Manager and owner both enter /admin/*.
//
// Guest table routes (/table/*) validate device_token cookie.
// Public routes (/[cafeSlug]/*) pass through — no auth required.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { StaffRole } from '@/lib/auth/types';
import { ROUTE_ACCESS, DEFAULT_DASHBOARD } from '@/lib/auth/types';

const PROTECTED_ROUTES: Array<{ prefix: string; roles: StaffRole[] }> = [
  { prefix: '/admin',   roles: ROUTE_ACCESS['/admin']   },
  { prefix: '/staff',   roles: ROUTE_ACCESS['/staff']   },
  { prefix: '/kitchen', roles: ROUTE_ACCESS['/kitchen'] },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  // ── Supabase SSR — refreshes JWT on every request ───────────

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

  const { data: { user } } = await supabase.auth.getUser();

  // ── Guest table routes ──────────────────────────────────────

  if (pathname.startsWith('/table/')) {
    const deviceToken = request.cookies.get('device_token')?.value;

    if (!deviceToken) {
      // First visit — no token yet, allow through to generate one
      return response;
    }

    const { data: device } = await supabase
      .from('session_devices')
      .select('is_active')
      .eq('device_token', deviceToken)
      .single();

    if (!device || !device.is_active) {
      const dest = request.nextUrl.clone();
      dest.pathname = '/session-ended';
      const redirect = NextResponse.redirect(dest);
      redirect.cookies.delete('device_token');
      redirect.cookies.delete('session_id');
      return redirect;
    }

    return response;
  }

  // ── Staff dashboard routes ───────────────────────────────────

  const matched = PROTECTED_ROUTES.find(r => pathname.startsWith(r.prefix));

  if (matched) {
    // Not logged in
    if (!user) {
      return redirectToLogin(request, pathname);
    }

    // Fetch staff profile
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('role, is_active, cafe_id')
      .eq('id', user.id)
      .single();

    if (!staffUser || !staffUser.is_active) {
      return redirectToLogin(request, pathname, 'account_inactive');
    }

    const role = staffUser.role as StaffRole;

    // Role not permitted for this route group
    if (!matched.roles.includes(role)) {
      // Redirect to their correct default dashboard instead of a 403
      const dest = request.nextUrl.clone();
      dest.pathname = DEFAULT_DASHBOARD[role];
      return NextResponse.redirect(dest);
    }

    // Stamp role context on request headers for Server Components
    // (avoids a second DB call inside RSC layout components)
    response.headers.set('x-staff-role',    role);
    response.headers.set('x-staff-cafe-id', staffUser.cafe_id);
    response.headers.set('x-staff-user-id', user.id);

    return response;
  }

  return response;
}

function redirectToLogin(
  request: NextRequest,
  from: string,
  reason?: string
): NextResponse {
  const dest = request.nextUrl.clone();
  dest.pathname = '/login';
  dest.searchParams.set('redirect', from);
  if (reason) dest.searchParams.set('reason', reason);
  return NextResponse.redirect(dest);
}

export const config = {
  matcher: [
    '/table/:path*',
    '/kitchen/:path*',
    '/staff/:path*',
    '/admin/:path*',
  ],
};
