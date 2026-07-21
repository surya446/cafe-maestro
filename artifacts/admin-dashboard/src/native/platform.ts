/**
 * Platform utilities — single source of truth for all native-shell and
 * build-variant guards used across the codebase.
 *
 * isNativeAndroid()  — true when running inside the Capacitor WebView on
 *                      Android (applies to BOTH the Mobile and TV APKs).
 *
 * isNativePlatform() — true when running inside any Capacitor native shell
 *                      (Android or iOS).
 *
 * openExternalUrl()  — open a URL in the system browser on native (via
 *                      @capacitor/browser), or a new tab on the web. Always
 *                      use this instead of window.open() so the URL is never
 *                      trapped inside the Capacitor WebView.
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
import { Browser } from "@capacitor/browser";

/** True when running inside the Capacitor WebView on Android (mobile OR TV). */
export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

/** True when running inside any Capacitor native shell (Android or iOS). */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Open a URL in the appropriate browser for the current platform.
 *
 * - Native (Android/iOS): uses @capacitor/browser to open the URL in the
 *   system browser (Chrome, Safari, etc.), never inside the Capacitor WebView.
 * - Web: opens in a new tab via window.open().
 *
 * Always prefer this over bare window.open() for URLs that should leave the
 * app, so the link is never trapped inside the WebView on mobile.
 *
 * NOTE: on native the URL must be absolute (https://…). If you are linking to
 * a route within the web deployment, set VITE_APP_URL to the deployed base URL
 * (e.g. https://yourapp.replit.app/admin/) and prepend it to the path.
 */
export function openExternalUrl(url: string): void {
  if (Capacitor.isNativePlatform()) {
    void Browser.open({ url });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
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
