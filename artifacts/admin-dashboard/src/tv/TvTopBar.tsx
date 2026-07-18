/**
 * TvTopBar — slimmed fixed top bar for the Kitchen Display System.
 *
 * 64 px tall (down from 88 px) to give more vertical space to the order grid.
 *
 * Left:   Kitchen identity
 * Centre: Live order counts (Pending / Preparing / Ready / Done Today)
 * Right:  Connection status pill + live clock
 */

import { TvClock } from "./TvClock";
import { TvConnectionStatus } from "./TvConnectionStatus";
import { TvStatistics } from "./TvStatistics";
import { TV_BAR_HEIGHT } from "./tvConstants";

export { TV_BAR_HEIGHT };

interface Props {
  cafeName: string;
  pending: number;
  preparing: number;
  ready: number;
  completedToday: number;
}

export function TvTopBar({
  cafeName,
  pending,
  preparing,
  ready,
  completedToday,
}: Props) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: `${TV_BAR_HEIGHT}px`,
        backgroundColor: "#0D1117",
        borderBottom: "1px solid #374151",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        zIndex: 50,
        gap: "20px",
      }}
    >
      {/* ── Left: identity ────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            backgroundColor: "rgba(249,115,22,0.12)",
            border: "1px solid rgba(249,115,22,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            flexShrink: 0,
          }}
        >
          👨‍🍳
        </div>
        <div>
          <div
            style={{
              fontSize: "0.95rem",
              fontWeight: 700,
              color: "#F9FAFB",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            Kitchen Display
          </div>
          {cafeName && (
            <div
              style={{
                fontSize: "0.72rem",
                color: "#6B7280",
                fontWeight: 500,
                marginTop: "1px",
              }}
            >
              {cafeName}
            </div>
          )}
        </div>
      </div>

      {/* ── Centre: statistics ────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <TvStatistics
          pending={pending}
          preparing={preparing}
          ready={ready}
          completedToday={completedToday}
        />
      </div>

      {/* ── Right: status + clock ─────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          flexShrink: 0,
        }}
      >
        <TvConnectionStatus />
        <TvClock />
      </div>
    </div>
  );
}
