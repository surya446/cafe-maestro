---
name: Android native-shell patterns
description: How the Capacitor Android admin-dashboard app implements back-button/exit, pull-to-refresh, external links, resume, and offline handling without touching the web build or business logic.
---

## Rule
All native-Android-only shell behavior lives under `src/native/` and `src/components/native/` (admin-dashboard artifact), gated through a single `isNativeAndroid()` helper (`src/native/platform.ts`). Every hook/component in this set is a documented no-op on web/desktop.

**Why:** The instruction set for this work explicitly forbade touching Orders/Sessions/Kitchen/Billing/QR/Auth/Realtime/App Releases business logic or redesigning the UI, and required the web build to stay byte-for-byte behaviorally unchanged. Centralizing the platform gate is what makes that verifiable.

## How to apply
- **Back button**: no reliable "canGoBack" API exists for wouter, so depth is tracked by monkey-patching `history.pushState` (`popstate` only fires on back nav, never on push) — see `src/native/androidHistoryDepth.ts`. Depth 0 → show exit confirm dialog instead of exiting immediately.
- **External links**: implemented as one capture-phase `document` click listener (`src/native/externalLinks.ts`) that opens off-origin `<a href>` via `@capacitor/browser`'s `Browser.open()` (Custom Tabs), rather than editing every page with a `target="_blank"` link. Internal `/`-prefixed hrefs and `mailto:`/`tel:` are left alone.
- **Pull-to-refresh**: touch-handler hook (`usePullToRefresh`) wrapping `AppLayout`'s `<main>`; refresh action is just `queryClient.invalidateQueries()` — never a WebView/page reload, so realtime subscriptions survive untouched.
- **Safe area**: `env(safe-area-inset-*)` in inline styles on the mobile header/sidebar is safe to apply unconditionally (it resolves to 0 in a normal browser tab), so no JS platform gate is needed for that specific case — only `viewport-fit=cover` in `index.html` is required for the value to be non-zero on native.
- No Android SDK/Java toolchain is available in this container — verification stops at `pnpm run build:cap && npx cap sync android` succeeding; a real Gradle/APK build isn't possible here.
