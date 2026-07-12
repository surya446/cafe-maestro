/**
 * Shared platform guard for the native-shell utilities added under
 * src/native, src/hooks/useAndroidBackButton.ts, useAppResume.ts,
 * useNetworkStatus.ts, usePullToRefresh.ts and their components.
 *
 * Every native-shell feature must be a strict no-op on web/desktop —
 * this is the single source of truth for that check so behaviour stays
 * consistent across all of them.
 */

import { Capacitor } from "@capacitor/core";

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}
