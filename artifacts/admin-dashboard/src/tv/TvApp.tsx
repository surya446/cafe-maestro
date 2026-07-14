/**
 * TvApp — root of the Android TV build (VITE_APP_VARIANT=tv).
 *
 * Mounted by src/main.tsx when the TV APK is loaded.
 * Completely replaces App.tsx — no sidebar, no dashboard, no admin shell.
 *
 * Phase 1: scaffold and placeholder only.
 *
 * Phase 2 will add:
 *   - TvAuthShell  (login + kitchen selector, persisted to localStorage)
 *   - TvKitchenPage (full-screen Kitchen Display System)
 *   - TvUpdateGate  (mandatory update check against "android-tv" platform)
 *   - D-pad / remote navigation
 *   - Screen wake lock
 *   - Hidden settings panel (5-second hold)
 *   - Sound on new orders
 */

export default function TvApp() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#0f1117",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        gap: "16px",
        userSelect: "none",
      }}
    >
      <div style={{ fontSize: "64px", lineHeight: 1 }}>📺</div>
      <h1
        style={{
          fontSize: "36px",
          margin: 0,
          fontWeight: 700,
          letterSpacing: "-0.5px",
        }}
      >
        Cafe Maestro TV
      </h1>
      <p style={{ fontSize: "18px", color: "#6b7280", margin: 0 }}>
        Kitchen Display System — Phase 2
      </p>
    </div>
  );
}
