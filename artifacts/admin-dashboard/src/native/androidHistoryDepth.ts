/**
 * androidHistoryDepth
 *
 * Tracks how many SPA (wouter) navigations deep the user currently is,
 * so the Android hardware/gesture back button can decide between
 * "go back one screen" and "show exit confirmation".
 *
 * Technique: `popstate` only fires for back/forward navigation, never
 * for `pushState`. So every `pushState` call increases depth by one,
 * and every `popstate` decreases it by one. This is the standard trick
 * used by SPA back-button integrations; it does not change navigation
 * behaviour, it only counts it.
 *
 * Installed lazily and only when running as the native Android app —
 * the web/desktop admin dashboard never patches `history`.
 */

let depth = 0;
let installed = false;

export function installAndroidHistoryDepthTracking(): void {
  if (installed) return;
  installed = true;

  const originalPushState = window.history.pushState.bind(window.history);

  window.history.pushState = function patchedPushState(
    ...args: Parameters<typeof window.history.pushState>
  ) {
    depth += 1;
    return originalPushState(...args);
  };

  window.addEventListener("popstate", () => {
    depth = Math.max(0, depth - 1);
  });
}

export function getAndroidHistoryDepth(): number {
  return depth;
}

export function goBackOneAndroidHistoryStep(): void {
  window.history.back();
}
