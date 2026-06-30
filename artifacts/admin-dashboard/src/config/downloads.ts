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
    label: "Cafe Maestro for Windows",
    description: "Native Windows desktop application. Planned for a future release.",
  },
  {
    id: "macos",
    label: "Cafe Maestro for macOS",
    description: "Native macOS desktop application. Planned for a future release.",
  },
  {
    id: "linux",
    label: "Cafe Maestro for Linux",
    description: "Native Linux desktop application. Planned for a future release.",
  },
  {
    id: "ios",
    label: "Cafe Maestro for iOS",
    description: "iPhone and iPad support is planned for a future release.",
  },
];
