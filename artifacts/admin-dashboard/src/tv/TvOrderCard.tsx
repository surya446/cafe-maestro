/**
 * TvOrderCard — a single kitchen order card for the TV/KDS display.
 *
 * Designed to be readable from several metres away:
 *   - Large typography (table, items, elapsed time)
 *   - Colour-coded elapsed timer (green → orange → red → pulse)
 *   - Large action buttons (Accept / Start Cooking / Mark Ready / Mark Served)
 *   - Status badge prominently placed in the card header
 *
 * Reuses StaffOrder and OrderStatus from the existing useOrders hook.
 * No new data models — the existing kitchen backend is the source of truth.
 */

import { useState, useEffect } from "react";
import { format } from "date-fns";
import type { StaffOrder, OrderStatus } from "@/hooks/useOrders";

// ── Elapsed timer ─────────────────────────────────────────────────────────────

function useElapsedSeconds(createdAt: string): number {
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000))
  );
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [createdAt]);
  return elapsed;
}

function ElapsedTimer({ createdAt }: { createdAt: string }) {
  const elapsed = useElapsedSeconds(createdAt);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const isPulsing = mins >= 20;
  const color =
    mins < 5  ? "#22c55e"
    : mins < 10 ? "#f97316"
    : "#ef4444";

  const bg =
    mins < 5  ? "rgba(34,197,94,0.12)"
    : mins < 10 ? "rgba(249,115,22,0.12)"
    : "rgba(239,68,68,0.12)";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 14px",
        borderRadius: "9999px",
        backgroundColor: bg,
        border: `1.5px solid ${color}44`,
        animation: isPulsing ? "tv-card-pulse 2s ease-in-out infinite" : undefined,
      }}
    >
      <div
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          fontSize: "1.1rem",
          color,
          letterSpacing: "0.04em",
        }}
      >
        {formatted}
      </span>
    </div>
  );
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  pending_approval: { label: "NEW",       color: "#f59e0b", bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.4)" },
  approved:         { label: "ACCEPTED",  color: "#a78bfa", bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.4)" },
  in_kitchen:       { label: "PREPARING", color: "#60a5fa", bg: "rgba(96,165,250,0.15)", border: "rgba(96,165,250,0.4)"  },
  ready:            { label: "READY",     color: "#4ade80", bg: "rgba(74,222,128,0.15)", border: "rgba(74,222,128,0.4)"  },
  served:           { label: "SERVED",    color: "#6b7280", bg: "rgba(107,114,128,0.15)", border: "rgba(107,114,128,0.4)" },
  cancelled:        { label: "CANCELLED", color: "#ef4444", bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.4)"   },
};

// ── Action button config ──────────────────────────────────────────────────────

const NEXT_STATUS: Partial<Record<OrderStatus, { label: string; next: OrderStatus; color: string }>> = {
  pending_approval: { label: "✓  Accept Order",  next: "approved",   color: "#22c55e" },
  approved:         { label: "🍳  Start Cooking", next: "in_kitchen", color: "#3b82f6" },
  in_kitchen:       { label: "✓  Mark Ready",    next: "ready",      color: "#22c55e" },
  ready:            { label: "✓  Mark Served",   next: "served",     color: "#6b7280" },
};

// ── Action button ─────────────────────────────────────────────────────────────

function TvActionButton({
  label,
  onClick,
  busy,
  color,
  variant = "primary",
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  color: string;
  variant?: "primary" | "outline";
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        flex: 1,
        height: "64px",
        borderRadius: "12px",
        border: isPrimary ? "none" : `2px solid ${color}66`,
        backgroundColor: isPrimary ? color : "transparent",
        color: isPrimary ? "#fff" : color,
        fontSize: "1.05rem",
        fontWeight: 700,
        letterSpacing: "0.02em",
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.5 : 1,
        transition: "opacity 0.15s, transform 0.1s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
      }}
    >
      {busy ? "…" : label}
    </button>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

interface Props {
  order: StaffOrder;
  onUpdate: (id: string, status: OrderStatus, note?: string | null) => Promise<void>;
  isUpdating: boolean;
}

export function TvOrderCard({ order, onUpdate, isUpdating }: Props) {
  const [busy, setBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending_approval;
  const advance = NEXT_STATUS[order.status];

  const tableLabel =
    order.tableNumber !== null && order.tableName
      ? `${order.tableName} (${order.tableNumber})`
      : order.tableNumber !== null
      ? `Table ${order.tableNumber}`
      : order.tableName ?? "Unknown table";

  const orderTime = format(new Date(order.createdAt), "HH:mm");

  async function act(status: OrderStatus, note?: string | null) {
    setBusy(true);
    try {
      await onUpdate(order.id, status, note);
    } finally {
      setBusy(false);
      setShowReject(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#111318",
        border: "1px solid #1e2230",
        borderRadius: "16px",
        overflow: "hidden",
        minHeight: "300px",
        position: "relative",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
          padding: "18px 20px 14px",
          borderBottom: "1px solid #1e2230",
          backgroundColor: "#13161d",
        }}
      >
        <div style={{ minWidth: 0 }}>
          {/* Table name */}
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {tableLabel}
          </div>
          {/* Customer name + order time */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "6px",
              flexWrap: "wrap",
            }}
          >
            {order.customerName && (
              <span style={{ fontSize: "0.9rem", color: "#9ca3af", fontWeight: 500 }}>
                {order.customerName}
              </span>
            )}
            <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
              Ordered at {orderTime}
            </span>
          </div>
        </div>

        {/* Status badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "5px 12px",
            borderRadius: "8px",
            backgroundColor: cfg.bg,
            border: `1.5px solid ${cfg.border}`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "0.8rem", fontWeight: 800, color: cfg.color, letterSpacing: "0.08em" }}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* ── Items ───────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 20px", flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {order.items.map((item) => (
            <div key={item.id} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              {/* Quantity bubble */}
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(249,115,22,0.15)",
                  border: "1px solid rgba(249,115,22,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  color: "#f97316",
                }}
              >
                {item.quantity}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    color: "#e5e7eb",
                    lineHeight: 1.2,
                  }}
                >
                  {item.name}
                </div>
                {item.notes && (
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "#f59e0b",
                      marginTop: "3px",
                      fontStyle: "italic",
                      fontWeight: 500,
                    }}
                  >
                    ⚠ {item.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Staff note */}
        {order.staffNote && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 12px",
              borderRadius: "8px",
              backgroundColor: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
              fontSize: "0.9rem",
              color: "#fcd34d",
              fontStyle: "italic",
            }}
          >
            📋 {order.staffNote}
          </div>
        )}
      </div>

      {/* ── Footer: timer + actions ──────────────────────────────────── */}
      <div
        style={{
          padding: "14px 20px",
          borderTop: "1px solid #1e2230",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          backgroundColor: "#0d0f14",
        }}
      >
        {/* Elapsed timer row */}
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <ElapsedTimer createdAt={order.createdAt} />
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "10px" }}>
          {/* Reject button (pending_approval only) */}
          {order.status === "pending_approval" && !showReject && (
            <TvActionButton
              label="✗  Reject"
              onClick={() => setShowReject(true)}
              busy={busy}
              color="#ef4444"
              variant="outline"
            />
          )}

          {/* Reject confirm */}
          {order.status === "pending_approval" && showReject && (
            <>
              <TvActionButton
                label="Confirm Reject"
                onClick={() => act("cancelled")}
                busy={busy}
                color="#ef4444"
              />
              <TvActionButton
                label="Cancel"
                onClick={() => setShowReject(false)}
                busy={false}
                color="#6b7280"
                variant="outline"
              />
            </>
          )}

          {/* Advance button */}
          {advance && !showReject && (
            <TvActionButton
              label={advance.label}
              onClick={() => act(advance.next)}
              busy={busy || isUpdating}
              color={advance.color}
            />
          )}
        </div>
      </div>

      {/* Global pulse animation */}
      <style>{`
        @keyframes tv-card-pulse {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
