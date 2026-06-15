import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coffee, QrCode, Clock, AlertCircle, XCircle, CheckCircle2,
  ChefHat, Bell, ShoppingCart, Minus, Plus, X, Loader2,
  UtensilsCrossed, Receipt, User, Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  useTableSession, SessionState, GuestOrder, CartItem, SessionInfo,
} from "@/hooks/useTableSession";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:        "#0C0A09",
  surface:   "#141210",
  card:      "#1C1917",
  cardHover: "#221E1B",
  gold:      "#D4A853",
  goldDim:   "rgba(212,168,83,0.14)",
  goldBorder:"rgba(212,168,83,0.18)",
  text:      "#F5F0E8",
  text2:     "#A89880",
  text3:     "#6B5D50",
  border:    "rgba(255,255,255,0.06)",
  overlay:   "rgba(12,10,9,0.82)",
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────────
interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  position: number;
}

interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  tags: string[];
  prep_time_min: number | null;
  allergens: string[];
  is_available: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return `₹${n % 1 === 0 ? n : n.toFixed(2)}`;
}

function formatTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function groupOrdersBySession(
  orders: GuestOrder[], mySessionId: string
): Array<{ sessionId: string; customerName: string; orders: GuestOrder[] }> {
  const map = new Map<string, { sessionId: string; customerName: string; orders: GuestOrder[] }>();
  for (const order of orders) {
    if (!map.has(order.sessionId)) {
      map.set(order.sessionId, { sessionId: order.sessionId, customerName: order.customerName, orders: [] });
    }
    map.get(order.sessionId)!.orders.push(order);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.sessionId === mySessionId) return -1;
    if (b.sessionId === mySessionId) return 1;
    return 0;
  });
}

// ─── Status config ──────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; color: string; pulse?: boolean; icon: React.ReactNode }> = {
  pending_approval: {
    label: "Awaiting confirmation",
    color: "rgba(251,191,36,0.12)",
    icon: <Clock className="w-3 h-3" style={{ color: "#FBB724" }} />,
  },
  approved: {
    label: "Confirmed",
    color: "rgba(96,165,250,0.12)",
    icon: <CheckCircle2 className="w-3 h-3" style={{ color: "#60A5FA" }} />,
  },
  in_kitchen: {
    label: "Being prepared",
    color: "rgba(251,146,60,0.12)",
    pulse: true,
    icon: <ChefHat className="w-3 h-3" style={{ color: "#FB923C" }} />,
  },
  ready: {
    label: "Ready — enjoy!",
    color: "rgba(52,211,153,0.15)",
    pulse: true,
    icon: <Sparkles className="w-3 h-3" style={{ color: "#34D399" }} />,
  },
  served: {
    label: "Served ✓",
    color: "rgba(255,255,255,0.05)",
    icon: null,
  },
  cancelled: {
    label: "Not accepted",
    color: "rgba(248,113,113,0.12)",
    icon: <XCircle className="w-3 h-3" style={{ color: "#F87171" }} />,
  },
};

// ─── Skeleton loader ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <div className="aspect-[4/3] w-full animate-pulse" style={{ background: C.cardHover }} />
      <div className="p-4 space-y-2">
        <div className="h-4 w-2/3 rounded-full animate-pulse" style={{ background: C.cardHover }} />
        <div className="h-3 w-full rounded-full animate-pulse" style={{ background: C.cardHover }} />
        <div className="h-3 w-1/2 rounded-full animate-pulse" style={{ background: C.cardHover }} />
      </div>
    </div>
  );
}

// ─── Session terminal screens ───────────────────────────────────────────────────
function QRSessionScreen({ icon, title, body }: {
  icon: React.ReactNode; title: string; body: string;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: C.bg }}>
      <div className="mb-5 opacity-40">{icon}</div>
      <h1 className="font-serif text-2xl font-light mb-2" style={{ color: C.text }}>{title}</h1>
      <p className="text-sm leading-relaxed max-w-xs" style={{ color: C.text2 }}>{body}</p>
    </div>
  );
}

// ─── Order status badge ─────────────────────────────────────────────────────────
function QROrderStatusBadge({ status }: { status: string }) {
  const cfg = STATUS[status] ?? { label: status, color: "rgba(255,255,255,0.06)", icon: null };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
      style={{ background: cfg.color, color: C.text }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Order card ─────────────────────────────────────────────────────────────────
function QROrderCard({ order }: { order: GuestOrder }) {
  const total = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const isReady = order.status === "ready";
  const cfg = STATUS[order.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: C.card,
        border: `1px solid ${isReady ? "rgba(52,211,153,0.3)" : C.border}`,
        boxShadow: isReady ? "0 0 20px rgba(52,211,153,0.08)" : "none",
      }}
    >
      {/* status bar */}
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ background: cfg?.color ?? "transparent" }}
      >
        <span className="text-[11px] font-medium" style={{ color: C.text2 }}>
          {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        <QROrderStatusBadge status={order.status} />
      </div>

      <div className="px-4 py-3 space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between items-baseline gap-2 text-sm">
            <span style={{ color: C.text }}>
              <span className="font-medium">{item.quantity}×</span>{" "}
              <span className="font-light">{item.name}</span>
              {item.notes && (
                <span className="text-xs ml-1" style={{ color: C.text3 }}>— {item.notes}</span>
              )}
            </span>
            <span className="text-xs shrink-0" style={{ color: C.text2 }}>{fmt(item.unitPrice * item.quantity)}</span>
          </div>
        ))}

        <div
          className="flex justify-between items-center pt-2 mt-1"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          <span className="text-xs font-medium" style={{ color: C.text2 }}>Order total</span>
          <span className="text-sm font-semibold" style={{ color: C.gold }}>{fmt(total)}</span>
        </div>

        {order.status === "cancelled" && order.staffNote && (
          <div className="text-xs rounded-xl px-3 py-2" style={{ background: "rgba(248,113,113,0.1)", color: "#F87171" }}>
            {order.staffNote}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Name entry screen ──────────────────────────────────────────────────────────
function QRNameEntry({ cafeName, tableLabel, onStart, error, isSubmitting }: {
  cafeName: string; tableLabel: string;
  onStart: (name: string) => Promise<void>;
  error: string | null; isSubmitting: boolean;
}) {
  const [name, setName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    await onStart(name.trim());
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: C.bg }}
    >
      {/* top fade */}
      <div className="fixed inset-x-0 top-0 h-32 pointer-events-none"
        style={{ background: `linear-gradient(to bottom, ${C.bg}, transparent)` }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        {/* Icon + cafe name */}
        <div className="text-center mb-10">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: C.goldDim, border: `1px solid ${C.goldBorder}` }}
          >
            <Coffee className="w-6 h-6" style={{ color: C.gold }} />
          </div>
          <h1 className="font-serif text-3xl font-light mb-1" style={{ color: C.text }}>{cafeName}</h1>
          <p className="text-sm" style={{ color: C.text2 }}>{tableLabel}</p>
        </div>

        {/* Divider */}
        <div className="w-8 h-px mx-auto mb-8" style={{ background: C.goldBorder }} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: C.text3 }} />
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              autoComplete="given-name"
              maxLength={50}
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-base outline-none transition-all"
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                color: C.text,
                caretColor: C.gold,
              }}
              onFocus={(e) => { e.target.style.borderColor = C.goldBorder; }}
              onBlur={(e) => { e.target.style.borderColor = C.border; }}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-2 text-xs rounded-xl px-3 py-2.5"
                style={{ background: "rgba(248,113,113,0.1)", color: "#F87171" }}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
            style={{
              background: C.gold,
              color: C.bg,
              opacity: (!name.trim() || isSubmitting) ? 0.5 : 1,
            }}
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
            ) : (
              "Begin Ordering"
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Menu item card ─────────────────────────────────────────────────────────────
function QRMenuItemCard({
  item, qty, onAdd, onDecrement, justAdded,
}: {
  item: MenuItem; qty: number;
  onAdd: () => void; onDecrement: () => void;
  justAdded: boolean;
}) {
  const unavailable = !item.is_available;

  return (
    <motion.div
      layout
      className="rounded-2xl overflow-hidden"
      animate={{ scale: justAdded ? [1, 1.015, 1] : 1 }}
      transition={{ duration: 0.3 }}
      style={{
        background: C.card,
        border: `1px solid ${justAdded ? C.goldBorder : C.border}`,
        opacity: unavailable ? 0.55 : 1,
        transition: "border-color 0.4s ease",
      }}
    >
      {/* Image */}
      {item.image_url ? (
        <div className="relative aspect-[16/9] overflow-hidden">
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover"
            style={{ transition: "transform 0.4s ease" }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(12,10,9,0.6) 0%, transparent 50%)" }} />

          {/* Qty overlay badge */}
          <AnimatePresence>
            {qty > 0 && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute top-2.5 right-2.5 flex items-center gap-0 rounded-full overflow-hidden shadow-lg"
                style={{ background: C.bg, border: `1px solid ${C.goldBorder}` }}
              >
                <button
                  onClick={onDecrement}
                  className="flex items-center justify-center w-7 h-7 active:opacity-60 transition-opacity"
                  style={{ color: C.gold }}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-bold w-5 text-center" style={{ color: C.text }}>{qty}</span>
                <button
                  onClick={onAdd}
                  className="flex items-center justify-center w-7 h-7 active:opacity-60 transition-opacity"
                  style={{ background: C.gold, color: C.bg }}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {unavailable && (
            <div
              className="absolute bottom-2 left-2 text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ background: "rgba(12,10,9,0.85)", color: C.text3 }}
            >
              Unavailable
            </div>
          )}
        </div>
      ) : (
        /* No image: elegant accent bar */
        <div className="h-1" style={{ background: `linear-gradient(to right, ${C.gold}60, transparent)` }} />
      )}

      {/* Info row */}
      <div className="px-4 pt-3 pb-3.5">
        <div className="flex items-start gap-2 justify-between mb-1">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-snug" style={{ color: C.text }}>{item.name}</h3>
            {item.description && (
              <p className="text-xs mt-0.5 leading-relaxed line-clamp-2" style={{ color: C.text2 }}>{item.description}</p>
            )}
          </div>
          <span className="text-sm font-semibold shrink-0 ml-2" style={{ color: C.gold }}>{fmt(item.price)}</span>
        </div>

        <div className="flex items-center justify-between mt-3">
          {item.prep_time_min ? (
            <span className="text-[11px] flex items-center gap-1" style={{ color: C.text3 }}>
              <Clock className="w-2.5 h-2.5" /> ~{item.prep_time_min} min
            </span>
          ) : <div />}

          {unavailable ? (
            <div />
          ) : !item.image_url ? (
            /* For no-image items, show qty control inline */
            qty === 0 ? (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onAdd}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: C.goldDim, color: C.gold, border: `1px solid ${C.goldBorder}` }}
              >
                <Plus className="w-3 h-3" /> Add
              </motion.button>
            ) : (
              <div className="flex items-center gap-0 rounded-full overflow-hidden" style={{ border: `1px solid ${C.goldBorder}` }}>
                <button onClick={onDecrement} className="w-8 h-7 flex items-center justify-center active:opacity-60" style={{ color: C.gold }}>
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-bold w-5 text-center" style={{ color: C.text }}>{qty}</span>
                <button onClick={onAdd} className="w-8 h-7 flex items-center justify-center active:opacity-60" style={{ background: C.gold, color: C.bg }}>
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )
          ) : (
            /* For image items, show "Add" button only when qty === 0 */
            qty === 0 ? (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onAdd}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: C.goldDim, color: C.gold, border: `1px solid ${C.goldBorder}` }}
              >
                <Plus className="w-3 h-3" /> Add
              </motion.button>
            ) : (
              /* Already in cart + has image → qty shown in image overlay, just confirm */
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onAdd}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: C.gold, color: C.bg }}
              >
                <Plus className="w-3 h-3" /> Add more
              </motion.button>
            )
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Cart drawer ────────────────────────────────────────────────────────────────
function QRCartDrawer({
  cart, unavailableInCart, onUpdateQty, onUpdateNote, onRemove, onClose, onPlace, isPlacing, placeError,
}: {
  cart: Map<string, CartItem>; unavailableInCart: Set<string>;
  onUpdateQty: (id: string, delta: number) => void;
  onUpdateNote: (id: string, note: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void; onPlace: () => void;
  isPlacing: boolean; placeError: string | null;
}) {
  const items = Array.from(cart.values());
  const availableItems = items.filter((i) => !unavailableInCart.has(i.menuItemId));
  const allUnavailable = items.length > 0 && availableItems.length === 0;
  const total = availableItems.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
          style={{ background: C.overlay, backdropFilter: "blur(6px)" }}
          onClick={onClose}
        />

        {/* Drawer */}
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 300 }}
          className="relative max-h-[88vh] flex flex-col rounded-t-3xl overflow-hidden"
          style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-8 h-0.5 rounded-full" style={{ background: C.text3 }} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-2 pb-4 shrink-0">
            <div>
              <h2 className="font-serif text-xl font-light" style={{ color: C.text }}>Your Order</h2>
              <p className="text-xs mt-0.5" style={{ color: C.text2 }}>{items.length} {items.length === 1 ? "item" : "items"}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: C.card }}
            >
              <X className="w-4 h-4" style={{ color: C.text2 }} />
            </button>
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-2">
            {unavailableInCart.size > 0 && (
              <div className="flex gap-2 text-xs rounded-2xl px-3 py-2.5" style={{ background: "rgba(251,191,36,0.08)", color: "#FBB724" }}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Some items are no longer available and won't be included.</span>
              </div>
            )}

            {items.map((item) => {
              const isUnavailable = unavailableInCart.has(item.menuItemId);
              return (
                <div key={item.menuItemId} style={{ opacity: isUnavailable ? 0.45 : 1 }}>
                  <div className="flex items-center gap-3">
                    {/* Qty stepper */}
                    <div className="flex items-center gap-0 rounded-full overflow-hidden shrink-0" style={{ border: `1px solid ${C.border}` }}>
                      <button
                        onClick={() => onUpdateQty(item.menuItemId, -1)}
                        disabled={isUnavailable}
                        className="w-8 h-8 flex items-center justify-center active:opacity-60"
                        style={{ color: C.gold }}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold" style={{ color: C.text }}>{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQty(item.menuItemId, +1)}
                        disabled={isUnavailable}
                        className="w-8 h-8 flex items-center justify-center active:opacity-60"
                        style={{ background: C.gold, color: C.bg }}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: C.text }}>{item.name}</p>
                      {isUnavailable && (
                        <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#F87171" }}>Unavailable</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isUnavailable && (
                        <span className="text-sm font-semibold" style={{ color: C.gold }}>{fmt(item.price * item.quantity)}</span>
                      )}
                      <button onClick={() => onRemove(item.menuItemId)} className="p-1 active:opacity-60">
                        <X className="w-3.5 h-3.5" style={{ color: C.text3 }} />
                      </button>
                    </div>
                  </div>

                  {!isUnavailable && (
                    <input
                      type="text"
                      placeholder="Special instructions (optional)"
                      value={item.notes}
                      onChange={(e) => onUpdateNote(item.menuItemId, e.target.value)}
                      className="w-full mt-2 text-xs px-3 py-2 rounded-xl outline-none"
                      style={{
                        background: C.card,
                        border: `1px solid ${C.border}`,
                        color: C.text,
                        caretColor: C.gold,
                      }}
                      onFocus={(e) => { e.target.style.borderColor = C.goldBorder; }}
                      onBlur={(e) => { e.target.style.borderColor = C.border; }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 pt-4 pb-8" style={{ borderTop: `1px solid ${C.border}` }}>
            {!allUnavailable && (
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-light" style={{ color: C.text2 }}>Order total</span>
                <span className="font-serif text-xl font-light" style={{ color: C.gold }}>{fmt(total)}</span>
              </div>
            )}

            <AnimatePresence>
              {placeError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex gap-2 text-xs rounded-xl px-3 py-2 mb-3"
                  style={{ background: "rgba(248,113,113,0.1)", color: "#F87171" }}
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{placeError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onPlace}
              disabled={isPlacing || allUnavailable}
              className="w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{
                background: (isPlacing || allUnavailable) ? C.card : C.gold,
                color: (isPlacing || allUnavailable) ? C.text2 : C.bg,
                transition: "background 0.2s",
              }}
            >
              {isPlacing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Placing…</>
              ) : (
                "Place Order"
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─── Active session ─────────────────────────────────────────────────────────────
function ActiveSession({
  sessionInfo, orders, billRequested,
  placeOrder, requestBill,
  isPlacingOrder, isRequestingBill, placeOrderError, requestBillError,
}: {
  sessionInfo: SessionInfo; orders: GuestOrder[]; billRequested: boolean;
  placeOrder: (items: CartItem[]) => Promise<string>;
  requestBill: () => Promise<void>;
  isPlacingOrder: boolean; isRequestingBill: boolean;
  placeOrderError: string | null; requestBillError: string | null;
}) {
  const {
    cafeId, cafeName, tableNumber, tableName, expiresAt, sessionId, customerName,
  } = sessionInfo;

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [cartBounce, setCartBounce] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(expiresAt));
  const [activeTab, setActiveTab] = useState<"menu" | "orders">("menu");
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(formatTimeLeft(expiresAt)), 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // ── Menu data ─────────────────────────────────────────────
  const { data: categories = [], isLoading: catsLoading } = useQuery<MenuCategory[]>({
    queryKey: ["menu_categories", cafeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select("id, name, description, position")
        .eq("cafe_id", cafeId)
        .eq("is_visible", true)
        .order("position");
      if (error) throw error;
      return (data ?? []) as MenuCategory[];
    },
    staleTime: 60_000,
  });

  const { data: menuItems = [], isLoading: itemsLoading } = useQuery<MenuItem[]>({
    queryKey: ["menu_items", cafeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, category_id, name, description, price, image_url, tags, prep_time_min, allergens, is_available, is_archived")
        .eq("cafe_id", cafeId)
        .eq("is_archived", false)
        .order("position");
      if (error) throw error;
      return (data ?? []) as MenuItem[];
    },
    staleTime: Infinity,
  });

  // Realtime menu_items updates
  const qc = useQueryClient();
  useEffect(() => {
    if (!cafeId) return;
    const channel = supabase
      .channel(`menu_items:${cafeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items", filter: `cafe_id=eq.${cafeId}` }, (payload) => {
        const KEY = ["menu_items", cafeId];
        const newRow = payload.new as unknown as MenuItem & { is_archived?: boolean };
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id: string }).id;
          qc.setQueryData<MenuItem[]>(KEY, (old) => old?.filter((i) => i.id !== id) ?? old);
        } else if (payload.eventType === "INSERT") {
          if (!newRow.is_archived) qc.setQueryData<MenuItem[]>(KEY, (old) => old ? [...old, newRow] : old);
        } else if (payload.eventType === "UPDATE") {
          if (newRow.is_archived) {
            qc.setQueryData<MenuItem[]>(KEY, (old) => old?.filter((i) => i.id !== newRow.id) ?? old);
          } else {
            qc.setQueryData<MenuItem[]>(KEY, (old) => {
              if (!old) return old;
              const exists = old.some((i) => i.id === newRow.id);
              return exists ? old.map((i) => i.id === newRow.id ? { ...i, ...newRow } : i) : [...old, newRow];
            });
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cafeId, qc]);

  const activeCategoryId = selectedCategory ?? categories[0]?.id ?? null;

  // Auto-scroll active category tab into view
  useEffect(() => {
    if (!activeCategoryId) return;
    const btn = categoryButtonRefs.current[activeCategoryId];
    if (btn && categoryScrollRef.current) {
      btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeCategoryId]);

  const visibleItems = useMemo(
    () => menuItems.filter((i) => i.category_id === activeCategoryId),
    [menuItems, activeCategoryId]
  );

  const unavailableInCart = useMemo(() => {
    const unavailableIds = new Set(menuItems.filter((m) => !m.is_available || m.is_archived).map((m) => m.id));
    const result = new Set<string>();
    for (const [id] of cart) { if (unavailableIds.has(id)) result.add(id); }
    return result;
  }, [cart, menuItems]);

  const cartCount = Array.from(cart.values()).reduce((s, i) => s + i.quantity, 0);
  const cartTotal = Array.from(cart.values())
    .filter((i) => !unavailableInCart.has(i.menuItemId))
    .reduce((s, i) => s + i.price * i.quantity, 0);

  const addToCart = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(item.id);
      if (existing) {
        next.set(item.id, { ...existing, quantity: existing.quantity + 1 });
      } else {
        next.set(item.id, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, notes: "" });
      }
      return next;
    });
    setJustAddedId(item.id);
    setCartBounce(true);
    setTimeout(() => setJustAddedId(null), 600);
    setTimeout(() => setCartBounce(false), 400);
  }, []);

  const updateCartQty = useCallback((menuItemId: string, delta: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(menuItemId);
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      if (newQty <= 0) { next.delete(menuItemId); } else { next.set(menuItemId, { ...existing, quantity: newQty }); }
      return next;
    });
  }, []);

  const updateCartNote = useCallback((menuItemId: string, note: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(menuItemId);
      if (!existing) return prev;
      next.set(menuItemId, { ...existing, notes: note });
      return next;
    });
  }, []);

  const removeFromCart = useCallback((menuItemId: string) => {
    setCart((prev) => { const next = new Map(prev); next.delete(menuItemId); return next; });
  }, []);

  async function handlePlaceOrder() {
    const availableItems = Array.from(cart.values()).filter((i) => !unavailableInCart.has(i.menuItemId));
    if (availableItems.length === 0) return;
    try {
      await placeOrder(availableItems);
      setCart(new Map());
      setCartOpen(false);
      setOrderSuccess(true);
      setActiveTab("orders");
      setTimeout(() => setOrderSuccess(false), 5000);
    } catch { /* shown via placeOrderError */ }
  }

  const orderGroups = useMemo(() => groupOrdersBySession(orders, sessionId), [orders, sessionId]);

  const tableTotal = useMemo(() =>
    orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0), 0),
    [orders]
  );

  const hasBillableOrder = orders.some((o) => o.status === "served" || o.status === "ready");
  const tableLabel = tableName ? `${tableName} · Table ${tableNumber}` : `Table ${tableNumber}`;
  const isMenuLoading = catsLoading || itemsLoading;

  // Pending order count for badge
  const pendingCount = orders.filter((o) => ["pending_approval", "approved", "in_kitchen", "ready"].includes(o.status)).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.bg }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30 px-4 pt-4 pb-3"
        style={{
          background: `${C.bg}F5`,
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.goldDim }}>
              <Coffee className="w-3.5 h-3.5" style={{ color: C.gold }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-none truncate" style={{ color: C.text }}>{cafeName}</p>
              <p className="text-[11px] mt-0.5 leading-none" style={{ color: C.text2 }}>{tableLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] flex items-center gap-1" style={{ color: C.text3 }}>
              <Clock className="w-3 h-3" />
              {timeLeft}
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-full" style={{ background: C.goldDim, color: C.gold }}>
              {customerName}
            </span>
          </div>
        </div>

        {/* ── Tab bar: Menu / Orders ─────────────────────── */}
        <div className="flex gap-1 mt-3" style={{ background: C.card, borderRadius: 12, padding: 3 }}>
          {(["menu", "orders"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 relative py-1.5 rounded-[9px] text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5"
              style={{
                background: activeTab === tab ? C.gold : "transparent",
                color: activeTab === tab ? C.bg : C.text2,
              }}
            >
              {tab === "menu" ? (
                <><UtensilsCrossed className="w-3 h-3" /> Menu</>
              ) : (
                <>
                  <Receipt className="w-3 h-3" /> Orders
                  {pendingCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{ background: "#F87171", color: "#fff" }}
                    >
                      {pendingCount}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Category nav (sticky, only on menu tab) ──────────────── */}
      <AnimatePresence>
        {activeTab === "menu" && categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="sticky z-20 px-4 py-3"
            style={{ top: 130, background: `${C.bg}F0`, backdropFilter: "blur(8px)" }}
          >
            <div ref={categoryScrollRef} className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {categories.map((cat) => {
                const active = activeCategoryId === cat.id;
                return (
                  <motion.button
                    key={cat.id}
                    ref={(el) => { categoryButtonRefs.current[cat.id] = el; }}
                    onClick={() => setSelectedCategory(cat.id)}
                    whileTap={{ scale: 0.94 }}
                    className="shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200"
                    style={{
                      background: active ? C.gold : C.card,
                      color: active ? C.bg : C.text2,
                      border: `1px solid ${active ? C.gold : C.border}`,
                    }}
                  >
                    {cat.name}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className={`flex-1 px-4 py-4 ${cartCount > 0 ? "pb-32" : "pb-10"}`}>

        {/* ── Order success toast ── */}
        <AnimatePresence>
          {orderSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-4 text-sm font-medium"
              style={{ background: "rgba(52,211,153,0.12)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)" }}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Order placed! We'll confirm it shortly.
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MENU TAB ─────────────────────────────────────────── */}
        {activeTab === "menu" && (
          <div>
            {isMenuLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : visibleItems.length === 0 && categories.length > 0 ? (
              <div className="text-center py-16">
                <UtensilsCrossed className="w-8 h-8 mx-auto mb-3 opacity-20" style={{ color: C.text }} />
                <p className="text-sm" style={{ color: C.text3 }}>Nothing here yet</p>
              </div>
            ) : (
              <motion.div
                key={activeCategoryId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-2 gap-3"
              >
                {visibleItems.map((item) => (
                  <QRMenuItemCard
                    key={item.id}
                    item={item}
                    qty={cart.get(item.id)?.quantity ?? 0}
                    onAdd={() => addToCart(item)}
                    onDecrement={() => updateCartQty(item.id, -1)}
                    justAdded={justAddedId === item.id}
                  />
                ))}
              </motion.div>
            )}
          </div>
        )}

        {/* ── ORDERS TAB ───────────────────────────────────────── */}
        {activeTab === "orders" && (
          <div>
            {orderGroups.length === 0 ? (
              <div className="text-center py-20">
                <Receipt className="w-8 h-8 mx-auto mb-3 opacity-20" style={{ color: C.text }} />
                <p className="text-sm mb-1" style={{ color: C.text2 }}>No orders yet</p>
                <p className="text-xs" style={{ color: C.text3 }}>
                  <button onClick={() => setActiveTab("menu")} style={{ color: C.gold }}>Browse the menu</button> to get started
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {orderGroups.map((group) => {
                  const isMe = group.sessionId === sessionId;
                  const groupTotal = group.orders
                    .filter((o) => o.status !== "cancelled")
                    .reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0), 0);
                  return (
                    <div key={group.sessionId}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: C.goldDim }}>
                          <User className="w-3 h-3" style={{ color: C.gold }} />
                        </div>
                        <span className="text-sm font-semibold" style={{ color: C.text }}>
                          {group.customerName}
                          {isMe && <span className="text-xs font-normal ml-1.5" style={{ color: C.text3 }}>(you)</span>}
                        </span>
                        {groupTotal > 0 && (
                          <span className="ml-auto text-xs font-semibold" style={{ color: C.gold }}>{fmt(groupTotal)}</span>
                        )}
                      </div>
                      <div className="space-y-2 pl-8">
                        {group.orders.map((order) => <QROrderCard key={order.orderId} order={order} />)}
                      </div>
                    </div>
                  );
                })}

                {/* Table total */}
                {tableTotal > 0 && (
                  <div
                    className="flex items-center justify-between rounded-2xl px-5 py-4"
                    style={{ background: C.card, border: `1px solid ${C.goldBorder}` }}
                  >
                    <span className="text-sm font-light" style={{ color: C.text2 }}>Table total</span>
                    <span className="font-serif text-xl font-light" style={{ color: C.gold }}>{fmt(tableTotal)}</span>
                  </div>
                )}

                {/* Request bill */}
                {hasBillableOrder && (
                  <div>
                    {requestBillError && (
                      <p className="text-xs mb-2" style={{ color: "#F87171" }}>{requestBillError}</p>
                    )}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => requestBill()}
                      disabled={billRequested || isRequestingBill}
                      className="w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
                      style={{
                        background: billRequested ? "rgba(52,211,153,0.1)" : C.card,
                        color: billRequested ? "#34D399" : C.text,
                        border: `1px solid ${billRequested ? "rgba(52,211,153,0.25)" : C.border}`,
                      }}
                    >
                      {isRequestingBill ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Requesting…</>
                      ) : billRequested ? (
                        <><CheckCircle2 className="w-4 h-4" /> Bill requested</>
                      ) : (
                        <><Bell className="w-4 h-4" style={{ color: C.gold }} /> Request the Bill</>
                      )}
                    </motion.button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Floating cart pill ───────────────────────────────────── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-8 pt-4 pointer-events-none"
            style={{ background: `linear-gradient(to top, ${C.bg} 0%, transparent 100%)` }}>
            <motion.button
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1, scale: cartBounce ? 1.04 : 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 280 }}
              onClick={() => setCartOpen(true)}
              className="pointer-events-auto flex items-center gap-4 px-5 py-3.5 rounded-full shadow-2xl"
              style={{
                background: C.gold,
                color: C.bg,
                boxShadow: "0 8px 32px rgba(212,168,83,0.4)",
              }}
            >
              <div className="relative">
                <ShoppingCart className="w-5 h-5" />
                <span
                  className="absolute -top-2 -right-2 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                  style={{ background: C.bg, color: C.gold }}
                >
                  {cartCount}
                </span>
              </div>
              <span className="text-sm font-semibold">View order</span>
              <span className="text-sm font-semibold opacity-70">·</span>
              <span className="text-sm font-semibold">{fmt(cartTotal)}</span>
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* ── Cart drawer ────────────────────────────────────────── */}
      {cartOpen && (
        <QRCartDrawer
          cart={cart}
          unavailableInCart={unavailableInCart}
          onUpdateQty={updateCartQty}
          onUpdateNote={updateCartNote}
          onRemove={removeFromCart}
          onClose={() => setCartOpen(false)}
          onPlace={handlePlaceOrder}
          isPlacing={isPlacingOrder}
          placeError={placeOrderError}
        />
      )}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────
export function TableSessionPage() {
  const { token } = useParams<{ token: string }>();

  const {
    sessionState, sessionInfo, orders, billRequested,
    nameEntryError, isStartingSession, startSession,
    placeOrder, requestBill,
    isPlacingOrder, isRequestingBill, placeOrderError, requestBillError,
  } = useTableSession(token ?? "");

  if (sessionState === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5" style={{ background: C.bg }}>
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Coffee className="w-10 h-10" style={{ color: C.gold }} />
        </motion.div>
        <p className="text-xs tracking-[0.2em] uppercase font-medium" style={{ color: C.text3 }}>
          Checking your session…
        </p>
      </div>
    );
  }

  if (sessionState === "entering_name") {
    const tableLabel = "Scan complete — you're at your table";
    return (
      <QRNameEntry
        cafeName="Welcome"
        tableLabel={tableLabel}
        onStart={startSession}
        error={nameEntryError}
        isSubmitting={isStartingSession}
      />
    );
  }

  if (sessionState === "invalid") {
    return (
      <QRSessionScreen
        icon={<QrCode className="w-14 h-14" style={{ color: C.text }} />}
        title="Table not found"
        body="This QR code is no longer active. Please ask your server for a new one."
      />
    );
  }

  if (sessionState === "expired") {
    return (
      <QRSessionScreen
        icon={<Clock className="w-14 h-14" style={{ color: C.text }} />}
        title="Session expired"
        body="Your session has timed out. Scan the QR code on your table to start again."
      />
    );
  }

  if (sessionState === "ended") {
    return (
      <QRSessionScreen
        icon={<CheckCircle2 className="w-14 h-14" style={{ color: C.text }} />}
        title="All done"
        body="Your session has ended. We hope you enjoyed your visit."
      />
    );
  }

  if (!sessionInfo) return null;

  return (
    <ActiveSession
      sessionInfo={sessionInfo}
      orders={orders}
      billRequested={billRequested}
      placeOrder={placeOrder}
      requestBill={requestBill}
      isPlacingOrder={isPlacingOrder}
      isRequestingBill={isRequestingBill}
      placeOrderError={placeOrderError}
      requestBillError={requestBillError}
    />
  );
}
