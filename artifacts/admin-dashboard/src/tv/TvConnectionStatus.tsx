/**
 * TvConnectionStatus — online / offline pill for the top bar.
 * Uses the existing useNetworkStatus hook (Capacitor Network API on
 * Android; always "online" in the browser dev server).
 */

import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function TvConnectionStatus() {
  const isOnline = useNetworkStatus();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 16px",
        borderRadius: "9999px",
        backgroundColor: isOnline ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        border: `1px solid ${isOnline ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
        userSelect: "none",
      }}
    >
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          backgroundColor: isOnline ? "#22c55e" : "#ef4444",
          boxShadow: isOnline ? "0 0 6px #22c55e" : "0 0 6px #ef4444",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: "0.9rem",
          color: isOnline ? "#22c55e" : "#ef4444",
          fontWeight: 600,
          letterSpacing: "0.03em",
        }}
      >
        {isOnline ? "Online" : "Offline"}
      </span>
    </div>
  );
}
