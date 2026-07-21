/**
 * TvClock — live time display for the Kitchen Display top bar.
 * Updates every second. Large enough to read from metres away.
 *
 * Font reduced from 2.75rem → 2rem so the clock is never clipped on TVs
 * with hardware overscan or narrow aspect ratios.
 * whiteSpace: nowrap prevents the date line from wrapping and overflowing.
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
    <div
      style={{
        textAlign: "right",
        userSelect: "none",
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.03em",
          color: "#ffffff",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {format(now, "HH:mm")}
      </div>
      <div
        style={{
          fontSize: "0.75rem",
          color: "#6b7280",
          marginTop: "3px",
          fontWeight: 500,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {format(now, "EEE, d MMM")}
      </div>
    </div>
  );
}
