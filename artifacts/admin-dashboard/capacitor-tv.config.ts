import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the Android TV build.
 *
 * Used by:
 *   pnpm cap:sync:tv   →  npx cap sync android --config capacitor-tv.config.ts
 *   pnpm cap:open:tv   →  npx cap open android --config capacitor-tv.config.ts
 *
 * Key differences from capacitor.config.ts (mobile):
 *   - appId:         com.cafemaestro.tv
 *   - appName:       Cafe Maestro TV
 *   - webDir:        dist/tv-public  (TV Vite build output; see build:tv in package.json)
 *   - android.path:  android-tv      (separate Android project; not android/)
 *
 * Architecture decision: we use two independent Android projects (android/ and
 * android-tv/) instead of product flavors because Capacitor 8's cap sync always
 * writes to a single assets directory, making product flavors introduce permanent
 * maintenance friction.  This decision is final.
 */
const config: CapacitorConfig = {
  appId: "com.cafemaestro.tv",
  appName: "Cafe Maestro TV",
  webDir: "dist/tv-public",
  android: {
    path: "android-tv",
  },
  server: {
    androidScheme: "https",
    cleartext: false,
  },
};

export default config;
