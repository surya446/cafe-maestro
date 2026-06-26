// ============================================================
// Server Auth Helpers — Cup & Cozy Management System
// Copy into: lib/auth/server.ts
// ============================================================
// Used in API Route Handlers and Server Components.
// Never import from client components.
// ============================================================

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { StaffRole, Permission, StaffUser } from '@/lib/auth/types';
import { hasPermission } from '@/lib/auth/types';
import { NextResponse } from 'next/server';

// ── getAuthenticatedStaff ────────────────────────────────────
// Call at the top of every protected API route handler.
// Returns the full StaffUser record or throws a 401/403 response.

export async function getAuthenticatedStaff(): Promise<{
  user: StaffUser;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}> {
  const supabase = await createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } },
      { status: 401 }
    );
  }

  const { data: staffUser, error: profileError } = await supabase
    .from('staff_users')
    .select('id, cafe_id, full_name, email, role, is_active')
    .eq('id', user.id)
    .single();

  if (profileError || !staffUser) {
    throw NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Staff profile not found.' } },
      { status: 403 }
    );
  }

  if (!staffUser.is_active) {
    throw NextResponse.json(
      { error: { code: 'ACCOUNT_INACTIVE', message: 'Account has been deactivated.' } },
      { status: 403 }
    );
  }

  return { user: staffUser as StaffUser, supabase };
}

// ── requirePermission ────────────────────────────────────────
// Use inside API route handlers after getAuthenticatedStaff().
//
// Example:
//   const { user, supabase } = await getAuthenticatedStaff();
//   requirePermission(user, 'menu.write');

export function requirePermission(user: StaffUser, permission: Permission): void {
  if (!hasPermission(user.role, permission)) {
    throw NextResponse.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: `Your role (${user.role}) does not have the '${permission}' permission.`,
        },
      },
      { status: 403 }
    );
  }
}

// ── requireRole ──────────────────────────────────────────────
// Shorthand when you need to check a specific set of roles.

export function requireRole(user: StaffUser, roles: StaffRole[]): void {
  if (!roles.includes(user.role)) {
    throw NextResponse.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: `This action requires one of these roles: ${roles.join(', ')}.`,
        },
      },
      { status: 403 }
    );
  }
}

// ── setAuditActor ────────────────────────────────────────────
// Call before any DML so triggers can record who performed the action.
// Must be called within the same DB transaction as the DML.
//
// Example:
//   await supabase.rpc('set_audit_actor', { actor_id: user.id, actor_type: 'staff' });

export async function setAuditActor(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  actorId: string,
  actorType: 'staff' | 'guest' | 'system' = 'staff'
): Promise<void> {
  await supabase.rpc('set_audit_actor', {
    p_actor_id:   actorId,
    p_actor_type: actorType,
  });
}

// ── validateGuestDevice ──────────────────────────────────────
// For guest-facing API routes. Validates device_token and session.
// Returns the session_device record or throws 401.

export async function validateGuestDevice(deviceToken: string, sessionId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: device, error } = await supabase
    .from('session_devices')
    .select('id, session_id, is_active')
    .eq('device_token', deviceToken)
    .eq('session_id', sessionId)
    .single();

  if (error || !device) {
    throw NextResponse.json(
      { error: { code: 'INVALID_DEVICE', message: 'Device token not recognised.' } },
      { status: 401 }
    );
  }

  if (!device.is_active) {
    throw NextResponse.json(
      { error: { code: 'SESSION_ENDED', message: 'Session has ended. Please scan the QR code again.' } },
      { status: 401 }
    );
  }

  return device;
}
