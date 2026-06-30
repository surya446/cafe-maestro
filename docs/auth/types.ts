// ============================================================
// Auth Types — Cup & Cozy Management System
// Final Authorization Model (no inheritance)
// Copy into: lib/auth/types.ts
// ============================================================

export type StaffRole = 'owner' | 'manager' | 'staff' | 'chef';

export interface StaffUser {
  id: string;
  cafe_id: string;
  full_name: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
}

// ── Permissions ───────────────────────────────────────────────
// Every permission is explicit. No role inherits from another.
// Matches the `permissions` table in migration 017.

export type Permission =
  // Session management (floor roles only — chef excluded)
  | 'sessions.view'
  | 'sessions.end'

  // Order management
  | 'orders.view'               // all staff see orders
  | 'orders.approve'            // staff | manager | owner
  | 'orders.reject'             // staff | manager | owner  (sets status=cancelled)
  | 'orders.mark_served'        // staff | manager | owner
  | 'orders.kitchen_update'     // chef | manager | owner   (in_kitchen → ready)
  | 'orders.archive'            // manager | owner          (served|cancelled → archived)

  // Bill requests (floor roles — chef excluded)
  | 'bill_requests.view'
  | 'bill_requests.acknowledge'

  // Menu (operations — chef reads only, no write access)
  | 'menu.view_all'             // all staff see unavailable/hidden items
  | 'menu.write'                // manager | owner   (create, update, toggle availability)
  | 'menu.delete'               // owner only        (permanent delete)

  // Tables & QR (manager | owner)
  | 'tables.write'
  | 'tables.delete'             // owner only

  // Bookings (floor roles — chef excluded)
  | 'bookings.view'
  | 'bookings.manage'           // confirm, cancel, seat
  | 'bookings.delete'           // manager | owner

  // Reviews (manager | owner)
  | 'reviews.moderate'
  | 'reviews.delete'            // owner only

  // Gallery & offers (manager | owner)
  | 'gallery.write'
  | 'offers.write'

  // Staff management
  | 'staff.view'                // manager | owner
  | 'staff.create_non_owner'    // manager (staff | chef only) | owner (any role)
  | 'staff.manage_non_owner'    // manager (staff | chef only) | owner (any role)
  | 'staff.manage_all'          // owner only (includes manager and owner accounts)

  // Analytics (manager | owner)
  | 'analytics.view'

  // Audit logs
  | 'audit_logs.view_operations' // manager (excludes staff account events)
  | 'audit_logs.view_all'        // owner only

  // Cafe settings
  | 'settings.write';            // owner only


// ── Explicit permission assignments ──────────────────────────
// No inheritance. Each role's permissions are fully enumerated.

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {

  // ── Chef ─────────────────────────────────────────────────
  // Kitchen operations only. Cannot access floor, admin, or settings.
  chef: [
    'orders.view',
    'orders.kitchen_update',    // approved → in_kitchen, in_kitchen → ready
    'menu.view_all',            // full item detail needed for KDS display
  ],

  // ── Staff ─────────────────────────────────────────────────
  // Floor operations. No admin access. No menu writes.
  staff: [
    'orders.view',
    'orders.approve',
    'orders.reject',
    'orders.mark_served',
    'sessions.view',
    'sessions.end',
    'bill_requests.view',
    'bill_requests.acknowledge',
    'bookings.view',
    'bookings.manage',
    'menu.view_all',            // needed to answer guest questions about unavailable items
  ],

  // ── Manager ───────────────────────────────────────────────
  // Full operations + admin dashboard (restricted).
  // No cafe settings, no owner account management, no full audit log.
  manager: [
    // Order workflow
    'orders.view',
    'orders.approve',
    'orders.reject',
    'orders.mark_served',
    'orders.kitchen_update',    // manager can step in on kitchen if needed
    'orders.archive',

    // Session & floor
    'sessions.view',
    'sessions.end',
    'bill_requests.view',
    'bill_requests.acknowledge',

    // Bookings
    'bookings.view',
    'bookings.manage',
    'bookings.delete',

    // Menu
    'menu.view_all',
    'menu.write',

    // Tables & QR
    'tables.write',

    // Content
    'reviews.moderate',
    'gallery.write',
    'offers.write',

    // Staff management (staff and chef only — not other managers or owners)
    'staff.view',
    'staff.create_non_owner',
    'staff.manage_non_owner',

    // Reporting
    'analytics.view',
    'audit_logs.view_operations', // operational events; no staff account events
  ],

  // ── Owner ─────────────────────────────────────────────────
  // Full platform access. All permissions explicit.
  owner: [
    // Order workflow
    'orders.view',
    'orders.approve',
    'orders.reject',
    'orders.mark_served',
    'orders.kitchen_update',
    'orders.archive',

    // Session & floor
    'sessions.view',
    'sessions.end',
    'bill_requests.view',
    'bill_requests.acknowledge',

    // Bookings
    'bookings.view',
    'bookings.manage',
    'bookings.delete',

    // Menu
    'menu.view_all',
    'menu.write',
    'menu.delete',

    // Tables & QR
    'tables.write',
    'tables.delete',

    // Content
    'reviews.moderate',
    'reviews.delete',
    'gallery.write',
    'offers.write',

    // Staff management (all roles including other owners)
    'staff.view',
    'staff.create_non_owner',
    'staff.manage_non_owner',
    'staff.manage_all',

    // Reporting
    'analytics.view',
    'audit_logs.view_operations',
    'audit_logs.view_all',

    // Settings
    'settings.write',
  ],
};

// ── Helpers ───────────────────────────────────────────────────
// hasPermission: explicit lookup — no hierarchy logic.

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

// ── Route access (which roles may enter each route group) ─────
// No /manager/* route exists.
// Manager and Owner both use /admin/*.
// Individual pages within /admin/* enforce finer checks.

export const ROUTE_ACCESS: Record<string, StaffRole[]> = {
  '/kitchen': ['chef', 'staff', 'manager', 'owner'],
  '/staff':   ['staff', 'manager', 'owner'],
  '/admin':   ['manager', 'owner'],
};

// Default dashboard path after login for each role
export const DEFAULT_DASHBOARD: Record<StaffRole, string> = {
  chef:    '/kitchen/display',
  staff:   '/staff/dashboard',
  manager: '/admin/dashboard',
  owner:   '/admin/dashboard',
};

// Admin sub-pages restricted to owner only
// (middleware allows managers into /admin/*, but these pages
//  enforce owner-only via requirePermission at the API/page level)
export const OWNER_ONLY_ADMIN_PAGES = [
  '/admin/settings',
  '/admin/audit-logs',
] as const;
