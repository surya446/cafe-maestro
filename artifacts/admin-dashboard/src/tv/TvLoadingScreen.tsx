/**
 * TvLoadingScreen — professional full-screen loading state shown while
 * the initial kitchen order data is being fetched.
 */

export function TvLoadingScreen() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#080a0d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "32px",
        userSelect: "none",
      }}
    >
      {/* Animated ring */}
      <div style={{ position: "relative", width: "96px", height: "96px" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "4px solid rgba(249,115,22,0.15)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "4px solid transparent",
            borderTopColor: "#f97316",
            animation: "tv-spin 1s linear infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
          }}
        >
          👨‍🍳
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.02em",
          }}
        >
          Kitchen Display
        </div>
        <div
          style={{
            fontSize: "1rem",
            color: "#6b7280",
            marginTop: "8px",
            fontWeight: 500,
          }}
        >
          Loading orders…
        </div>
      </div>

      {/* Pulsing dots */}
      <div style={{ display: "flex", gap: "8px" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#f97316",
              animation: `tv-dot-pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes tv-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes tv-dot-pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}
