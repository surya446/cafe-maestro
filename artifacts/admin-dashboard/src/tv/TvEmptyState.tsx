/**
 * TvEmptyState — shown when there are no active kitchen orders.
 * Full-screen centred content, readable from across the kitchen.
 */

export function TvEmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        gap: "24px",
        userSelect: "none",
        padding: "60px 0",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: "120px",
          height: "120px",
          borderRadius: "32px",
          backgroundColor: "rgba(107,114,128,0.1)",
          border: "1px solid rgba(107,114,128,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "56px",
        }}
      >
        🍽️
      </div>

      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            color: "#9ca3af",
            letterSpacing: "-0.01em",
          }}
        >
          No active kitchen orders
        </div>
        <div
          style={{
            fontSize: "1.1rem",
            color: "#4b5563",
            marginTop: "10px",
            fontWeight: 400,
          }}
        >
          New orders will appear here automatically
        </div>
      </div>

      {/* Pulsing dot to show the system is live */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
        <div
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: "#22c55e",
            animation: "tv-idle-pulse 2s ease-in-out infinite",
          }}
        />
        <span style={{ fontSize: "0.85rem", color: "#4b5563", fontWeight: 500 }}>
          Kitchen is ready
        </span>
      </div>

      <style>{`
        @keyframes tv-idle-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.9); }
          50%       { opacity: 1;   transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
