/**
 * Centralized route paths and URL helpers.
 *
 * Import from here instead of writing path strings directly. All navigation
 * references stay in sync when routes change, and TypeScript catches typos.
 */

// ── Public / customer-facing ─────────────────────────────────────────────
export const ROUTES = {
  HOME:    "/",
  ABOUT:   "/about",
  MENU:    "/menu",
  GALLERY: "/gallery",
  OFFERS:  "/offers",
  REVIEWS: "/reviews",
  CONTACT: "/contact",
  BOOK:    "/book",
  TABLE:   (token: string) => `/table/${token}`,

  // ── Auth ────────────────────────────────────────────────────────────────
  LOGIN:           "/login",
  AUTH_CONFIRM:    "/auth/confirm",
  CHANGE_PASSWORD: "/change-password",

  // ── Admin (protected) ───────────────────────────────────────────────────
  ADMIN: {
    ROOT:             "/admin",
    ORDERS:           "/admin/orders",
    TABLES:           "/admin/tables",
    MENU:             "/admin/menu",
    GALLERY:          "/admin/gallery",
    OFFERS:           "/admin/offers",
    BOOKINGS:         "/admin/bookings",
    STAFF:            "/admin/staff",
    ANALYTICS:        "/admin/analytics",
    WEBSITE_SETTINGS: "/admin/website-settings",
    DOWNLOADS:        "/admin/downloads",
    SETTINGS:         "/admin/settings",
  },
} as const;

/**
 * Builds the full absolute URL for a table's QR code.
 *
 * Uses BASE_URL so it works correctly in every deployment environment
 * (Replit dev, production, Capacitor) without configuration.
 */
export function buildTableQrUrl(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}table/${token}`;
}
