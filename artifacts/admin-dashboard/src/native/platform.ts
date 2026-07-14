/**
 * Platform utilities — single source of truth for all native-shell and
 * build-variant guards used across the codebase.
 *
 * isNativeAndroid()  — true when running inside the Capacitor WebView on
 *                      Android (applies to BOTH the Mobile and TV APKs).
 *
 * getAppVariant()    — returns the build-time variant baked in by Vite via
 *                      VITE_APP_VARIANT.  Never guesses at runtime; the value
 *                      is a compile-time constant so Vite's dead-code
 *                      elimination removes unused branches from each bundle.
 *
 * isTvApp()          — true only in the Android TV build
 * isMobileApp()      — true only in the Android Mobile build
 */

import { Capacitor } from "@capacitor/core";

/** True when running inside the Capacitor WebView on Android (mobile OR TV). */
export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export type AppVariant = "mobile" | "tv" | "web";

/**
 * Returns the build-time variant injected by VITE_APP_VARIANT.
 * Defaults to "web" when the variable is absent (dev server / browser).
 */
export function getAppVariant(): AppVariant {
  const v = import.meta.env.VITE_APP_VARIANT;
  if (v === "tv") return "tv";
  if (v === "mobile") return "mobile";
  return "web";
}

/** True only in the Android TV APK (VITE_APP_VARIANT=tv). */
export function isTvApp(): boolean {
  return getAppVariant() === "tv";
}

/** True only in the Android Mobile APK (VITE_APP_VARIANT=mobile). */
export function isMobileApp(): boolean {
  return getAppVariant() === "mobile";
}
