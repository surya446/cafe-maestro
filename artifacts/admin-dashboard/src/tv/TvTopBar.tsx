/**
 * TvTopBar — fixed top bar for the Kitchen Display System.
 *
 * Left:   Kitchen identity
 * Centre: Live order counts (Pending / Preparing / Ready / Done Today)
 * Right:  Connection status pill + live clock
 *
 * Responsive fixes:
 *  - Right section has flexShrink: 0 and overflow: visible so the clock
 *    is never clipped regardless of how wide the centre section grows.
 *  - Padding-right increased to 48px to protect against TV overscan cutting
 *    off the edges (a common issue on consumer TVs).
 *  - Centre section uses minWidth: 0 so it can shrink rather than pushing
 *    the clock off screen on narrower TVs.
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
        // Extra right padding guards against TV overscan cutting off the clock.
        padding: "0 48px 0 24px",
        zIndex: 50,
        gap: "16px",
        // overflow visible ensures the clock is never cropped by this container.
        overflow: "visible",
        boxSizing: "border-box",
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
              whiteSpace: "nowrap",
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
                whiteSpace: "nowrap",
              }}
            >
              {cafeName}
            </div>
          )}
        </div>
      </div>

      {/* ── Centre: statistics ────────────────────────────────────── */}
      {/* minWidth: 0 lets this section shrink so it never displaces the clock */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <TvStatistics
          pending={pending}
          preparing={preparing}
          ready={ready}
          completedToday={completedToday}
        />
      </div>

      {/* ── Right: status + clock ─────────────────────────────────── */}
      {/* flexShrink: 0 guarantees the clock always has its natural width */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexShrink: 0,
          overflow: "visible",
        }}
      >
        <TvConnectionStatus />
        <TvClock />
      </div>
    </div>
  );
}
