/**
 * TvOrderCard — display-only kitchen order card for the TV/KDS.
 *
 * Design goals:
 *   - Fixed 300 px height — never grows, never overflows the grid.
 *   - Items dominate the card; customer name is de-emphasised.
 *   - Long item lists are truncated with "+N more items".
 *   - Long modifier strings are truncated with "+N more".
 *   - Status indicated by a top border accent + badge.
 *   - Timer shows elapsed kitchen time with colour urgency cues.
 *   - NO action buttons — kitchen staff use the staff dashboard.
 *   - New cards fade in; status changes trigger a brief highlight.
 */

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import type { StaffOrder, OrderStatus } from "@/hooks/useOrders";

// ── Layout constants ──────────────────────────────────────────────────────────

/** Fixed card height in px. Must stay constant regardless of item count. */
const CARD_HEIGHT = 300;
/** Max item rows shown before "+N more items" overflow label. */
const MAX_VISIBLE_ITEMS = 4;
/** Max modifier fragments shown per item before "+N more". */
const MAX_VISIBLE_MODS = 2;

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string; border: string; glow: string }
> = {
  pending_approval: {
    label: "NEW",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.35)",
    glow: "rgba(245,158,11,0.08)",
  },
  approved: {
    label: "ACCEPTED",
    color: "#8B5CF6",
    bg: "rgba(139,92,246,0.1)",
    border: "rgba(139,92,246,0.3)",
    glow: "rgba(139,92,246,0.06)",
  },
  in_kitchen: {
    label: "PREPARING",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.1)",
    border: "rgba(59,130,246,0.3)",
    glow: "rgba(59,130,246,0.06)",
  },
  ready: {
    label: "READY",
    color: "#10B981",
    bg: "rgba(16,185,129,0.1)",
    border: "rgba(16,185,129,0.3)",
    glow: "rgba(16,185,129,0.1)",
  },
  served: {
    label: "DONE",
    color: "#6B7280",
    bg: "rgba(107,114,128,0.08)",
    border: "rgba(107,114,128,0.2)",
    glow: "transparent",
  },
  cancelled: {
    label: "CANCELLED",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.25)",
    glow: "rgba(239,68,68,0.05)",
  },
};

// ── Elapsed timer ─────────────────────────────────────────────────────────────

function useElapsedSeconds(createdAt: string): number {
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000))
  );
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(
        Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000))
      );
    }, 1000);
    return () => clearInterval(id);
  }, [createdAt]);
  return elapsed;
}

function ElapsedTimer({ createdAt }: { createdAt: string }) {
  const elapsed = useElapsedSeconds(createdAt);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const label = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const color =
    mins < 5 ? "#22C55E" : mins < 10 ? "#F59E0B" : "#EF4444";
  const isPulsing = mins >= 15;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        animation: isPulsing ? "kds-pulse 1.8s ease-in-out infinite" : undefined,
      }}
    >
      <div
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          fontSize: "1rem",
          color,
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Modifier helpers ──────────────────────────────────────────────────────────

function parseModifiers(notes: string | null): string[] {
  if (!notes) return [];
  return notes
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ItemModifiers({ notes }: { notes: string | null }) {
  const mods = parseModifiers(notes);
  if (mods.length === 0) return null;

  const shown = mods.slice(0, MAX_VISIBLE_MODS);
  const hidden = mods.length - shown.length;

  return (
    <div style={{ marginTop: "2px", display: "flex", flexWrap: "wrap", gap: "3px" }}>
      {shown.map((mod, i) => (
        <span
          key={i}
          style={{
            fontSize: "0.72rem",
            color: "#9CA3AF",
            backgroundColor: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "4px",
            padding: "1px 6px",
            fontStyle: "italic",
          }}
        >
          {mod}
        </span>
      ))}
      {hidden > 0 && (
        <span
          style={{
            fontSize: "0.72rem",
            color: "#6B7280",
            padding: "1px 4px",
          }}
        >
          +{hidden} more
        </span>
      )}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

interface Props {
  order: StaffOrder;
}

export function TvOrderCard({ order }: Props) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending_approval;

  // ── DIAGNOSTIC: log the exact prop received by this card.
  //    Remove once the root cause is confirmed.
  useEffect(() => {
    console.log(
      `[TvOrderCard] id=${order.id} items.length=${order.items.length}` +
      ` items=${JSON.stringify(order.items)}`
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  // Status-change highlight animation.
  const [highlight, setHighlight] = useState(false);
  const prevStatusRef = useRef(order.status);
  useEffect(() => {
    if (prevStatusRef.current === order.status) return;
    prevStatusRef.current = order.status;
    setHighlight(true);
    const t = setTimeout(() => setHighlight(false), 1200);
    return () => clearTimeout(t);
  }, [order.status]);

  // Derived display values.
  const tableLabel =
    order.tableNumber !== null && order.tableName
      ? `${order.tableName} (${order.tableNumber})`
      : order.tableNumber !== null
      ? `Table ${order.tableNumber}`
      : order.tableName ?? "Unknown";

  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  const itemCountLabel = `${totalQty} ${totalQty === 1 ? "item" : "items"}`;
  const orderTime = format(new Date(order.createdAt), "HH:mm");

  const shownItems = order.items.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenItems = order.items.length - shownItems.length;

  return (
    <div
      style={{
        height: `${CARD_HEIGHT}px`,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#1F2937",
        border: `1px solid ${cfg.border}`,
        borderTop: `3px solid ${cfg.color}`,
        borderRadius: "10px",
        overflow: "hidden",
        position: "relative",
        boxShadow: highlight
          ? `0 0 0 2px ${cfg.color}55, 0 0 20px ${cfg.glow}`
          : `0 0 12px ${cfg.glow}`,
        transition: "box-shadow 0.4s ease",
        animation: "kds-fadein 0.35s ease-out",
        flexShrink: 0,
      }}
    >
      {/* ── Header: status badge + timer ──────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 12px 7px",
          flexShrink: 0,
        }}
      >
        {/* Status badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 10px",
            borderRadius: "5px",
            backgroundColor: cfg.bg,
            border: `1px solid ${cfg.border}`,
          }}
        >
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 800,
              color: cfg.color,
              letterSpacing: "0.1em",
            }}
          >
            {cfg.label}
          </span>
        </div>

        {/* Elapsed timer */}
        <ElapsedTimer createdAt={order.createdAt} />
      </div>

      {/* ── Identity: table + item count ──────────────────────────── */}
      <div style={{ padding: "2px 12px 8px", flexShrink: 0 }}>
        {/* Table label — largest element on the card */}
        <div
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            color: "#F9FAFB",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {tableLabel}
        </div>

        {/* Item count + customer name (de-emphasised) */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "8px",
            marginTop: "3px",
          }}
        >
          <span
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#9CA3AF",
            }}
          >
            {itemCountLabel}
          </span>
          {order.customerName && (
            <span
              style={{
                fontSize: "0.72rem",
                color: "#4B5563",
                fontWeight: 400,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "120px",
              }}
            >
              {order.customerName}
            </span>
          )}
        </div>
      </div>

      {/* ── Divider ───────────────────────────────────────────────── */}
      <div style={{ height: "1px", backgroundColor: "#374151", flexShrink: 0 }} />

      {/* ── Items list ────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          padding: "8px 12px 6px",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          minHeight: 0,
        }}
      >
        {shownItems.map((item) => (
          <div key={item.id} style={{ flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              {/* Quantity */}
              <span
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  color: "#F97316",
                  minWidth: "18px",
                  flexShrink: 0,
                }}
              >
                ×{item.quantity}
              </span>
              {/* Item name */}
              <span
                style={{
                  fontSize: "0.92rem",
                  fontWeight: 600,
                  color: "#E5E7EB",
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.name}
              </span>
            </div>
            <div style={{ paddingLeft: "24px" }}>
              <ItemModifiers notes={item.notes} />
            </div>
          </div>
        ))}

        {/* Overflow label */}
        {hiddenItems > 0 && (
          <div
            style={{
              fontSize: "0.78rem",
              color: "#6B7280",
              fontStyle: "italic",
              flexShrink: 0,
            }}
          >
            +{hiddenItems} more {hiddenItems === 1 ? "item" : "items"}…
          </div>
        )}

        {/* Staff note */}
        {order.staffNote && (
          <div
            style={{
              marginTop: "auto",
              padding: "4px 8px",
              borderRadius: "5px",
              backgroundColor: "rgba(245,158,11,0.07)",
              border: "1px solid rgba(245,158,11,0.18)",
              fontSize: "0.75rem",
              color: "#FCD34D",
              fontStyle: "italic",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            📋 {order.staffNote}
          </div>
        )}
      </div>

      {/* ── Divider ───────────────────────────────────────────────── */}
      <div style={{ height: "1px", backgroundColor: "#374151", flexShrink: 0 }} />

      {/* ── Footer: ordered time ──────────────────────────────────── */}
      <div
        style={{
          padding: "7px 12px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "0.75rem",
            color: "#6B7280",
            fontWeight: 500,
          }}
        >
          Ordered:{" "}
          <span style={{ color: "#9CA3AF", fontWeight: 600 }}>{orderTime}</span>
        </span>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes kds-fadein {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes kds-pulse {
          0%, 100% { opacity: 0.65; }
          50%       { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
