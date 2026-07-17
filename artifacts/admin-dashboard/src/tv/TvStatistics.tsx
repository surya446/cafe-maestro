/**
 * TvStatistics — Pending / Preparing / Ready / Completed Today counts
 * displayed in the top bar. Props are passed from TvKitchenPage which
 * derives them from useOrders and a today count query.
 */

interface Props {
  pending: number;
  preparing: number;
  ready: number;
  completedToday: number;
}

interface StatProps {
  label: string;
  value: number;
  color: string;
  bg: string;
}

function Stat({ label, value, color, bg }: StatProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minWidth: "72px",
        padding: "8px 16px",
        borderRadius: "12px",
        backgroundColor: bg,
        userSelect: "none",
      }}
    >
      <span
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          color,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: "0.65rem",
          color: "#6b7280",
          marginTop: "4px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 600,
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function TvStatistics({ pending, preparing, ready, completedToday }: Props) {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
      <Stat label="Pending"    value={pending}        color="#f59e0b" bg="rgba(245,158,11,0.1)"  />
      <Stat label="Preparing"  value={preparing}      color="#3b82f6" bg="rgba(59,130,246,0.1)"  />
      <Stat label="Ready"      value={ready}          color="#22c55e" bg="rgba(34,197,94,0.1)"   />
      <Stat label="Done Today" value={completedToday} color="#6b7280" bg="rgba(107,114,128,0.1)" />
    </div>
  );
}
