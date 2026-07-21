/**
 * Static configuration for platforms that are "Coming Soon".
 *
 * Android and Android TV releases are now managed entirely through
 * the database (app_releases table) and Supabase Storage.
 * This file only describes future platforms that have no DB records yet.
 */

export interface ComingSoonPlatform {
  id: string;
  label: string;
  description: string;
}

export const COMING_SOON_PLATFORMS: ComingSoonPlatform[] = [
  {
    id: "windows",
    label: "Cup & Cozy for Windows",
    description: "Native Windows desktop application. Planned for a future release.",
  },
  {
    id: "macos",
    label: "Cup & Cozy for macOS",
    description: "Native macOS desktop application. Planned for a future release.",
  },
  {
    id: "linux",
    label: "Cup & Cozy for Linux",
    description: "Native Linux desktop application. Planned for a future release.",
  },
  {
    id: "ios",
    label: "Cup & Cozy for iOS",
    description: "iPhone and iPad support is planned for a future release.",
  },
];
