/**
 * TvTopBar — fixed top bar for the Kitchen Display System.
 *
 * Contains:
 *   Left:   app identity (icon + name + kitchen name)
 *   Centre: live statistics (Pending / Preparing / Ready / Done Today)
 *   Right:  connection status pill + live clock
 */

import { TvClock } from "./TvClock";
import { TvConnectionStatus } from "./TvConnectionStatus";
import { TvStatistics } from "./TvStatistics";

const TV_BAR_HEIGHT = 88;

interface Props {
  cafeName: string;
  pending: number;
  preparing: number;
  ready: number;
  completedToday: number;
}

export function TvTopBar({ cafeName, pending, preparing, ready, completedToday }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: `${TV_BAR_HEIGHT}px`,
        backgroundColor: "#0d0f14",
        borderBottom: "1px solid #1e2230",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        zIndex: 50,
        gap: "24px",
      }}
    >
      {/* ── Left: identity ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", flexShrink: 0 }}>
        {/* Chef hat icon */}
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            backgroundColor: "rgba(249,115,22,0.15)",
            border: "1px solid rgba(249,115,22,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            flexShrink: 0,
          }}
        >
          👨‍🍳
        </div>
        <div>
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}
          >
            Cafe Maestro Kitchen
          </div>
          {cafeName && (
            <div
              style={{
                fontSize: "0.8rem",
                color: "#6b7280",
                marginTop: "3px",
                fontWeight: 500,
              }}
            >
              {cafeName}
            </div>
          )}
        </div>
      </div>

      {/* ── Centre: statistics ──────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <TvStatistics
          pending={pending}
          preparing={preparing}
          ready={ready}
          completedToday={completedToday}
        />
      </div>

      {/* ── Right: status + clock ───────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "24px",
          flexShrink: 0,
        }}
      >
        <TvConnectionStatus />
        <TvClock />
      </div>
    </div>
  );
}

export { TV_BAR_HEIGHT };
