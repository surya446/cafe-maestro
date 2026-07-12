/**
 * externalLinks
 *
 * On native Android, any link the user taps that points off-app
 * (restaurant website, Instagram/Facebook/WhatsApp, Google Maps,
 * documentation, privacy policy, etc.) must open in the system
 * browser (Custom Tabs) via `@capacitor/browser`, never inside the
 * Capacitor WebView. Internal routes (starting with "/", "#", or
 * matching the app's own origin) must keep using normal in-app
 * (wouter) navigation.
 *
 * Implemented as a single capture-phase document click listener so no
 * individual page has to be touched — every current and future
 * `<a>` tag is covered automatically.
 */

import { Browser } from "@capacitor/browser";
import { isNativeAndroid } from "@/native/platform";

function isExternalHref(href: string): boolean {
  if (!href) return false;
  if (href.startsWith("#")) return false;
  if (href.startsWith("/")) return false;
  // System already routes these via an Android intent from inside the WebView.
  if (
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("sms:") ||
    href.startsWith("intent:")
  ) {
    return false;
  }

  try {
    const url = new URL(href, window.location.href);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

let installed = false;

export function installExternalLinkHandler(): void {
  if (installed || !isNativeAndroid()) return;
  installed = true;

  document.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || !isExternalHref(href)) return;

      event.preventDefault();
      event.stopPropagation();
      void Browser.open({ url: href });
    },
    true,
  );
}
