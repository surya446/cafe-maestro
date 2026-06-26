// ============================================================
// useAuth Hook — Cup & Cozy Management System
// Copy into: lib/auth/use-auth.ts
// ============================================================
// Client-side auth hook for 'use client' dashboard components.
// Reads from TanStack Query cache — no waterfall DB calls.
// ============================================================

'use client';

import { useQuery } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { StaffUser, StaffRole, Permission } from '@/lib/auth/types';
import { hasPermission as checkPermission } from '@/lib/auth/types';

const supabase = createSupabaseBrowserClient();

async function fetchCurrentStaff(): Promise<StaffUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('staff_users')
    .select('id, cafe_id, full_name, email, role, is_active')
    .eq('id', user.id)
    .single();

  return (data as StaffUser) ?? null;
}

export function useAuth() {
  const { data: staff, isLoading } = useQuery({
    queryKey: ['auth', 'current-staff'],
    queryFn:  fetchCurrentStaff,
    staleTime: 5 * 60 * 1000,   // 5 minutes — role rarely changes mid-session
    retry: false,
  });

  return {
    staff,
    role:      staff?.role     ?? null,
    cafe_id:   staff?.cafe_id  ?? null,
    isLoading,
    isAuthenticated: !!staff && staff.is_active,

    // Convenience permission checker for conditional UI rendering
    can: (permission: Permission): boolean => {
      if (!staff) return false;
      return checkPermission(staff.role, permission);
    },

    // Convenience role checker
    isRole: (...roles: StaffRole[]): boolean => {
      if (!staff) return false;
      return roles.includes(staff.role);
    },
  };
}

// ── Usage examples in components ──────────────────────────────
//
// const { can, isRole, staff } = useAuth();
//
// // Conditionally show a button
// {can('menu.write') && <button>Edit Menu</button>}
//
// // Conditionally show a section
// {isRole('owner', 'manager') && <AnalyticsPanel />}
//
// // Display actor's name
// <span>{staff?.full_name}</span>
