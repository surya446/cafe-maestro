// ============================================================
// Auth Types — Cafe Maestro Platform
// Copy into: lib/auth/types.ts
// ============================================================

export type StaffRole = 'owner' | 'manager' | 'staff' | 'chef';

// Ordered lowest → highest privilege
export const ROLE_HIERARCHY: StaffRole[] = ['chef', 'staff', 'manager', 'owner'];

export interface StaffUser {
  id: string;
  cafe_id: string;
  full_name: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
}

// ── Permission keys ──────────────────────────────────────────
// Single source of truth. Matches the `permissions` table in migration 017.

export type Permission =
  | 'sessions.read'
  | 'sessions.end'
  | 'orders.read'
  | 'orders.approve'
  | 'orders.reject'
  | 'orders.mark_served'
  | 'orders.kitchen_update'
  | 'bill_requests.read'
  | 'bill_requests.acknowledge'
  | 'menu.read_hidden'
  | 'menu.write'
  | 'menu.delete'
  | 'tables.write'
  | 'tables.delete'
  | 'bookings.read'
  | 'bookings.manage'
  | 'bookings.delete'
  | 'reviews.moderate'
  | 'reviews.delete'
  | 'gallery.write'
  | 'offers.write'
  | 'staff.read'
  | 'staff.create'
  | 'staff.manage'
  | 'staff.manage_owners'
  | 'staff.delete'
  | 'analytics.read'
  | 'audit_logs.read'
  | 'audit_logs.read_operations'
  | 'settings.write';

// ── Static permission map (mirrors role_permissions table) ───
// Used client-side so dashboards can hide/show UI without a DB call.
// Single source of truth is still the DB — this is a read-only mirror.

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  chef: [
    'orders.read',
    'orders.kitchen_update',
    'menu.read_hidden',
  ],

  staff: [
    'orders.read',
    'orders.approve',
    'orders.reject',
    'orders.mark_served',
    'orders.kitchen_update',
    'menu.read_hidden',
    'sessions.read',
    'sessions.end',
    'bill_requests.read',
    'bill_requests.acknowledge',
    'bookings.read',
    'bookings.manage',
  ],

  manager: [
    'orders.read',
    'orders.approve',
    'orders.reject',
    'orders.mark_served',
    'orders.kitchen_update',
    'menu.read_hidden',
    'menu.write',
    'sessions.read',
    'sessions.end',
    'bill_requests.read',
    'bill_requests.acknowledge',
    'bookings.read',
    'bookings.manage',
    'bookings.delete',
    'reviews.moderate',
    'gallery.write',
    'offers.write',
    'tables.write',
    'staff.read',
    'staff.create',
    'staff.manage',
    'analytics.read',
    'audit_logs.read_operations',
  ],

  owner: [
    'orders.read',
    'orders.approve',
    'orders.reject',
    'orders.mark_served',
    'orders.kitchen_update',
    'menu.read_hidden',
    'menu.write',
    'menu.delete',
    'sessions.read',
    'sessions.end',
    'bill_requests.read',
    'bill_requests.acknowledge',
    'bookings.read',
    'bookings.manage',
    'bookings.delete',
    'reviews.moderate',
    'reviews.delete',
    'gallery.write',
    'offers.write',
    'tables.write',
    'tables.delete',
    'staff.read',
    'staff.create',
    'staff.manage',
    'staff.manage_owners',
    'staff.delete',
    'analytics.read',
    'audit_logs.read',
    'settings.write',
  ],
};

// ── Helpers ──────────────────────────────────────────────────

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasMinimumRole(userRole: StaffRole, minimumRole: StaffRole): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(minimumRole);
}

// Roles that can access a given route group
export const ROUTE_ROLES: Record<string, StaffRole[]> = {
  '/kitchen':  ['chef', 'staff', 'manager', 'owner'],
  '/staff':    ['staff', 'manager', 'owner'],
  '/manager':  ['manager', 'owner'],
  '/admin':    ['owner'],
};
