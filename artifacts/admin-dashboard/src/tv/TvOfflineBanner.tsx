/**
 * TvOfflineBanner — persistent banner shown when the device loses
 * network connectivity. Auto-dismisses when the connection returns.
 * Uses the existing useNetworkStatus hook (Capacitor Network API on
 * Android; always online in the browser dev server).
 */

import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function TvOfflineBanner() {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div
      style={{
        backgroundColor: "#7f1d1d",
        borderBottom: "1px solid #991b1b",
        padding: "12px 32px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        userSelect: "none",
      }}
    >
      {/* Pulsing dot */}
      <div
        style={{
          width: "12px",
          height: "12px",
          borderRadius: "50%",
          backgroundColor: "#fca5a5",
          flexShrink: 0,
          animation: "tv-offline-pulse 1.5s ease-in-out infinite",
        }}
      />
      <span
        style={{
          fontSize: "1.1rem",
          fontWeight: 700,
          color: "#fca5a5",
          letterSpacing: "0.01em",
        }}
      >
        Network connection lost — waiting to reconnect
      </span>
      <span
        style={{
          marginLeft: "auto",
          fontSize: "0.85rem",
          color: "#f87171",
          fontWeight: 500,
        }}
      >
        Orders will resume automatically when the connection returns
      </span>

      <style>{`
        @keyframes tv-offline-pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
