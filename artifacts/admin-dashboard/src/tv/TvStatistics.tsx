/**
 * TvStatistics — compact order-count pills for the top bar.
 *
 * Horizontal layout with a coloured accent number + label.
 * Intentionally compact: the top bar is only 64 px tall.
 */

interface Props {
  pending: number;
  preparing: number;
  ready: number;
  completedToday: number;
}

interface PillProps {
  label: string;
  value: number;
  color: string;
  bg: string;
  border: string;
}

function Pill({ label, value, color, bg, border }: PillProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 14px",
        borderRadius: "8px",
        backgroundColor: bg,
        border: `1px solid ${border}`,
        userSelect: "none",
      }}
    >
      <span
        style={{
          fontSize: "1.35rem",
          fontWeight: 800,
          color,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
          minWidth: "1.6ch",
          textAlign: "right",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: "0.68rem",
          color: "#6B7280",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function TvStatistics({
  pending,
  preparing,
  ready,
  completedToday,
}: Props) {
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <Pill
        label="Pending"
        value={pending}
        color="#F59E0B"
        bg="rgba(245,158,11,0.08)"
        border="rgba(245,158,11,0.2)"
      />
      <Pill
        label="Preparing"
        value={preparing}
        color="#3B82F6"
        bg="rgba(59,130,246,0.08)"
        border="rgba(59,130,246,0.2)"
      />
      <Pill
        label="Ready"
        value={ready}
        color="#10B981"
        bg="rgba(16,185,129,0.08)"
        border="rgba(16,185,129,0.2)"
      />
      <div
        style={{
          width: "1px",
          height: "28px",
          backgroundColor: "#374151",
          flexShrink: 0,
        }}
      />
      <Pill
        label="Done Today"
        value={completedToday}
        color="#6B7280"
        bg="rgba(107,114,128,0.06)"
        border="rgba(107,114,128,0.15)"
      />
    </div>
  );
}
