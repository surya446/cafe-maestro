/**
 * TvClock — live time display for the Kitchen Display top bar.
 * Updates every second. Large, readable from metres away.
 */

import { useState, useEffect } from "react";
import { format } from "date-fns";

export function TvClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ textAlign: "right", userSelect: "none" }}>
      <div
        style={{
          fontSize: "2.75rem",
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.03em",
          color: "#ffffff",
          lineHeight: 1,
        }}
      >
        {format(now, "HH:mm")}
      </div>
      <div
        style={{
          fontSize: "0.875rem",
          color: "#6b7280",
          marginTop: "4px",
          fontWeight: 500,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {format(now, "EEE, d MMM")}
      </div>
    </div>
  );
}
