export type DownloadStatus = "available" | "coming_soon" | "beta";

export interface ReleaseNote {
  type: "feature" | "fix" | "perf";
  text: string;
}

export interface VersionEntry {
  version: string;
  date: string;
  summary: string;
}

export interface PlatformDownload {
  id: string;
  platform: string;
  label: string;
  description: string;
  status: DownloadStatus;
  version?: string;
  buildDate?: string;
  minOs?: string;
  fileSize?: string;
  downloadUrl?: string;
  qrUrl?: string;
  releaseNotesSummary?: string;
}

export interface AppRelease {
  version: string;
  releaseDate: string;
  features: string[];
  fixes: string[];
  perf: string[];
}

export const CURRENT_VERSION = "1.0.0";

export const PLATFORMS: PlatformDownload[] = [
  {
    id: "android",
    platform: "Android",
    label: "Cafe Maestro Android App",
    description: "Full management dashboard for Android phones and tablets.",
    status: "available",
    version: "1.0.0",
    buildDate: "2025-06-30",
    minOs: "Android 9.0 (API 28)",
    fileSize: "12.4 MB",
    downloadUrl: "",
    qrUrl: "",
    releaseNotesSummary: "Initial release with full dashboard, orders, tables, staff, and analytics.",
  },
  {
    id: "android-tv",
    platform: "Android TV",
    label: "Cafe Maestro Kitchen Display",
    description:
      "Optimised for televisions used in the kitchen. Large order cards, realtime updates, and touch-friendly controls.",
    status: "available",
    version: "1.0.0",
    buildDate: "2025-06-30",
    minOs: "Android TV 9.0",
    fileSize: "12.4 MB",
    downloadUrl: "",
    qrUrl: "",
    releaseNotesSummary: "Kitchen Display mode. Chef role auto-opens KDS on launch.",
  },
  {
    id: "windows",
    platform: "Windows",
    label: "Cafe Maestro for Windows",
    description: "Native Windows desktop application.",
    status: "coming_soon",
  },
  {
    id: "macos",
    platform: "macOS",
    label: "Cafe Maestro for macOS",
    description: "Native macOS desktop application.",
    status: "coming_soon",
  },
  {
    id: "linux",
    platform: "Linux",
    label: "Cafe Maestro for Linux",
    description: "Native Linux desktop application.",
    status: "coming_soon",
  },
  {
    id: "ios",
    platform: "iOS",
    label: "Cafe Maestro for iOS",
    description: "iPhone and iPad support is planned for a future release.",
    status: "coming_soon",
  },
  {
    id: "pwa",
    platform: "Web PWA",
    label: "Web App (PWA)",
    description: "Install the web app directly from your browser — no app store required.",
    status: "available",
    version: "1.0.0",
  },
];

export const LATEST_RELEASE: AppRelease = {
  version: "1.0.0",
  releaseDate: "2025-06-30",
  features: [
    "Full management dashboard for orders, tables, staff, bookings, and analytics",
    "Real-time order and bill-request notifications",
    "QR code table ordering system",
    "Kitchen Display System (KDS) for Android TV",
    "Role-based access control (Owner, Manager, Staff, Chef)",
    "PWA support for browser-based installation",
  ],
  fixes: [],
  perf: [
    "Optimised real-time Supabase subscriptions for low-latency updates",
    "Lazy-loaded route components for fast initial load",
  ],
};

export const VERSION_HISTORY: VersionEntry[] = [
  {
    version: "1.0.0",
    date: "2025-06-30",
    summary: "Initial production release.",
  },
];
