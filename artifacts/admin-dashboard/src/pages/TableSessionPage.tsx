import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coffee, QrCode, Clock, AlertCircle, XCircle, CheckCircle2,
  ChefHat, Bell, ShoppingCart, Minus, Plus, X, Loader2,
  UtensilsCrossed, Receipt, User, Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  useTableSession, GuestOrder, CartItem, SessionInfo,
} from "@/hooks/useTableSession";
import { QRScannerModal } from "@/components/QRScannerModal";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:         "#0C0A09",
  surface:    "#141210",
  card:       "#1C1917",
  cardHover:  "#231F1B",
  gold:       "#D4A853",
  goldDim:    "rgba(212,168,83,0.13)",
  goldBorder: "rgba(212,168,83,0.22)",
  text:       "#F2EDE4",
  text2:      "#A89880",
  text3:      "#6B5D50",
  border:     "rgba(255,255,255,0.065)",
  overlay:    "rgba(10,8,7,0.85)",
} as const;

const SERIF: React.CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
const SANS: React.CSSProperties  = { fontFamily: "'Inter', ui-sans-serif, sans-serif" };

// ─── Types ───────────────────────────────────────────────────────────────────────
interface MenuCategory { id: string; name: string; description: string | null; position: number; }
interface MenuItem {
  id: string; category_id: string; name: string; description: string | null;
  price: number; image_url: string | null; tags: string[];
  prep_time_min: number | null; allergens: string[]; is_available: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────
function fmt(n: number) { return `₹${n % 1 === 0 ? n : n.toFixed(2)}`; }

function formatTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60_000);
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function groupOrdersBySession(
  orders: GuestOrder[], mySessionId: string
): Array<{ sessionId: string; customerName: string; orders: GuestOrder[] }> {
  const map = new Map<string, { sessionId: string; customerName: string; orders: GuestOrder[] }>();
  for (const o of orders) {
    if (!map.has(o.sessionId)) map.set(o.sessionId, { sessionId: o.sessionId, customerName: o.customerName, orders: [] });
    map.get(o.sessionId)!.orders.push(o);
  }
  return Array.from(map.values()).sort((a, b) => (a.sessionId === mySessionId ? -1 : b.sessionId === mySessionId ? 1 : 0));
}

// ─── Status config ───────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; bg: string; icon: React.ReactNode }> = {
  pending_approval: { label: "Awaiting confirmation", bg: "rgba(251,191,36,0.11)",   icon: <Clock       className="w-3 h-3" style={{ color: "#FBBF24" }} /> },
  approved:         { label: "Confirmed",            bg: "rgba(96,165,250,0.11)",    icon: <CheckCircle2 className="w-3 h-3" style={{ color: "#60A5FA" }} /> },
  in_kitchen:       { label: "Being prepared",       bg: "rgba(251,146,60,0.11)",    icon: <ChefHat     className="w-3 h-3" style={{ color: "#FB923C" }} /> },
  ready:            { label: "Ready — enjoy!",       bg: "rgba(52,211,153,0.14)",    icon: <Sparkles    className="w-3 h-3" style={{ color: "#34D399" }} /> },
  served:           { label: "Served ✓",             bg: "rgba(255,255,255,0.04)",   icon: null },
  cancelled:        { label: "Not accepted",         bg: "rgba(248,113,113,0.11)",   icon: <XCircle     className="w-3 h-3" style={{ color: "#F87171" }} /> },
};

// ─── Branded loader ───────────────────────────────────────────────────────────────
// Shows for a minimum of MIN_MS to give a deliberate, premium feel on QR scan.
const MIN_MS = 1800;

function BrandedLoader() {
  return (
    <motion.div
      key="loader"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeInOut" } }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 flex flex-col items-center justify-center z-50"
      style={{ background: C.bg }}
    >
      <style>{`
        @keyframes qr-steam {
          0%   { transform: translateY(0)    scaleX(1)    opacity: 0; }
          20%  { opacity: 0.55; }
          80%  { opacity: 0.3; }
          100% { transform: translateY(-22px) scaleX(1.15); opacity: 0; }
        }
        @keyframes qr-glow {
          0%,100% { box-shadow: 0 0 18px 3px rgba(212,168,83,0.12); }
          50%      { box-shadow: 0 0 40px 10px rgba(212,168,83,0.28); }
        }
        @keyframes qr-progress {
          0%   { width: 0%; }
          85%  { width: 88%; }
          100% { width: 100%; }
        }
        .qr-steam-1 { animation: qr-steam 1.6s ease-in-out 0.0s infinite; }
        .qr-steam-2 { animation: qr-steam 1.6s ease-in-out 0.35s infinite; }
        .qr-steam-3 { animation: qr-steam 1.6s ease-in-out 0.7s infinite; }
        .qr-glow    { animation: qr-glow 2s ease-in-out infinite; }
        .qr-bar     { animation: qr-progress ${MIN_MS}ms cubic-bezier(0.4,0,0.2,1) forwards; }
      `}</style>

      {/* Steam wisps */}
      <div className="relative mb-1 flex items-end justify-center gap-2 h-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-0.5 h-5 rounded-full qr-steam-${i + 1}`}
            style={{ background: `linear-gradient(to top, ${C.gold}80, transparent)`, opacity: 0 }}
          />
        ))}
      </div>

      {/* Cup icon */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-7 qr-glow"
        style={{ background: C.goldDim, border: `1px solid ${C.goldBorder}` }}
      >
        <Coffee className="w-7 h-7" style={{ color: C.gold }} />
      </div>

      {/* Label */}
      <p className="text-[11px] uppercase tracking-[0.3em] font-medium" style={{ color: C.text3, ...SANS }}>
        Preparing your menu
      </p>

      {/* Gold progress bar */}
      <div className="mt-8 w-24 h-px overflow-hidden rounded-full" style={{ background: C.goldDim }}>
        <div className="h-full qr-bar rounded-full" style={{ background: C.gold }} />
      </div>
    </motion.div>
  );
}

// ─── Skeleton card ───────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <div className="aspect-[4/3] sm:aspect-[8/3] w-full" style={{ background: C.cardHover, animation: "pulse 2s cubic-bezier(.4,0,.6,1) infinite" }} />
      <div className="p-4 space-y-2.5">
        <div className="h-4 w-3/5 rounded-full" style={{ background: C.cardHover, animation: "pulse 2s cubic-bezier(.4,0,.6,1) infinite" }} />
        <div className="h-3 w-full rounded-full" style={{ background: C.cardHover, animation: "pulse 2s cubic-bezier(.4,0,.6,1) .15s infinite" }} />
        <div className="h-3 w-2/5 rounded-full" style={{ background: C.cardHover, animation: "pulse 2s cubic-bezier(.4,0,.6,1) .3s infinite" }} />
      </div>
    </div>
  );
}

// ─── Terminal state screen ───────────────────────────────────────────────────────
function QRSessionScreen({
  icon, title, body, onScan,
}: {
  icon: React.ReactNode; title: string; body: string;
  onScan?: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: C.bg }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center"
      >
        <div className="mb-6 opacity-30">{icon}</div>
        <h1 className="text-3xl font-light mb-3" style={{ color: C.text, ...SERIF }}>{title}</h1>
        <div className="w-6 h-px mx-auto mb-4" style={{ background: C.goldBorder }} />
        <p className="text-sm leading-relaxed max-w-xs" style={{ color: C.text2, ...SANS }}>{body}</p>
        {onScan && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onScan}
            className="mt-8 flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold"
            style={{ background: C.goldDim, color: C.gold, border: `1px solid ${C.goldBorder}`, ...SANS }}
          >
            <QrCode className="w-4 h-4" />
            Scan QR Again
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}

// ─── Order status badge ──────────────────────────────────────────────────────────
function QRStatusBadge({ status }: { status: string }) {
  const cfg = STATUS[status] ?? { label: status, bg: "rgba(255,255,255,0.05)", icon: null };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-medium"
      style={{ background: cfg.bg, color: C.text, ...SANS }}
    >
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ─── Order card ──────────────────────────────────────────────────────────────────
function QROrderCard({ order }: { order: GuestOrder }) {
  const total = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const isReady = order.status === "ready";
  const cfg = STATUS[order.status];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: C.card,
        border: `1px solid ${isReady ? "rgba(52,211,153,0.28)" : C.border}`,
        boxShadow: isReady ? "0 0 24px rgba(52,211,153,0.07)" : `0 2px 12px rgba(0,0,0,0.35)`,
      }}
    >
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: cfg?.bg ?? "transparent" }}>
        <span className="text-[11px] tabular-nums" style={{ color: C.text2, ...SANS }}>
          {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        <QRStatusBadge status={order.status} />
      </div>
      <div className="px-4 py-3.5 space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between items-baseline gap-2">
            <span className="text-sm" style={{ color: C.text, ...SANS }}>
              <span className="font-semibold">{item.quantity}×</span>{" "}
              <span className="font-light">{item.name}</span>
              {item.notes && <span className="text-xs ml-1.5" style={{ color: C.text3 }}>— {item.notes}</span>}
            </span>
            <span className="text-xs shrink-0 tabular-nums" style={{ color: C.text2 }}>{fmt(item.unitPrice * item.quantity)}</span>
          </div>
        ))}
        <div className="flex justify-between items-center pt-2.5 mt-1" style={{ borderTop: `1px solid ${C.border}` }}>
          <span className="text-xs" style={{ color: C.text2, ...SANS }}>Total</span>
          <span className="text-sm font-semibold tabular-nums" style={{ color: C.gold, ...SANS }}>{fmt(total)}</span>
        </div>
        {order.status === "cancelled" && order.staffNote && (
          <p className="text-xs rounded-xl px-3 py-2 leading-relaxed" style={{ background: "rgba(248,113,113,0.09)", color: "#F87171", ...SANS }}>
            {order.staffNote}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Name entry ──────────────────────────────────────────────────────────────────
function QRNameEntry({
  cafeName, tableLabel, onStart, error, isSubmitting,
}: { cafeName: string; tableLabel: string; onStart: (name: string) => Promise<void>; error: string | null; isSubmitting: boolean }) {
  const [name, setName] = useState("");
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    await onStart(name.trim());
  }
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: C.bg }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        {/* Icon */}
        <div className="text-center mb-10">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: C.goldDim, border: `1px solid ${C.goldBorder}` }}
          >
            <Coffee className="w-7 h-7" style={{ color: C.gold }} />
          </div>
          <h1 className="text-[2.4rem] font-light leading-none mb-2" style={{ color: C.text, ...SERIF }}>
            {cafeName}
          </h1>
          <p className="text-sm" style={{ color: C.text2, ...SANS }}>{tableLabel}</p>
        </div>

        <div className="w-8 h-px mx-auto mb-8" style={{ background: C.goldBorder }} />

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: C.text3 }} />
            <input
              type="text" placeholder="Your name" value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus autoComplete="given-name" maxLength={50}
              className="w-full pl-11 pr-4 py-4 rounded-2xl text-[15px] outline-none transition-[border-color]"
              style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, caretColor: C.gold, ...SANS }}
              onFocus={(e) => { e.target.style.borderColor = C.goldBorder; }}
              onBlur={(e)  => { e.target.style.borderColor = C.border; }}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="flex gap-2 text-xs rounded-xl px-3 py-2.5 leading-relaxed"
                style={{ background: "rgba(248,113,113,0.09)", color: "#F87171", ...SANS }}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2"
            style={{
              background: C.gold, color: C.bg,
              opacity: (!name.trim() || isSubmitting) ? 0.45 : 1,
              transition: "opacity 0.2s",
              boxShadow: "0 4px 24px rgba(212,168,83,0.25)",
              ...SANS,
            }}
          >
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</> : "Begin Ordering"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Menu item card ───────────────────────────────────────────────────────────────
function QRMenuItemCard({
  item, qty, onAdd, onDecrement, justAdded,
}: { item: MenuItem; qty: number; onAdd: () => void; onDecrement: () => void; justAdded: boolean }) {
  const unavailable = !item.is_available;

  return (
    <motion.div
      layout
      className="rounded-2xl overflow-hidden group"
      animate={justAdded ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      style={{
        background: C.card,
        border: `1px solid ${justAdded ? C.goldBorder : C.border}`,
        boxShadow: `0 2px 14px rgba(0,0,0,0.4)`,
        opacity: unavailable ? 0.5 : 1,
        transition: "border-color 0.35s ease, box-shadow 0.25s ease",
      }}
      whileHover={unavailable ? {} : { boxShadow: "0 6px 28px rgba(0,0,0,0.55)" }}
    >
      {/* Food image — mobile: 4:3, sm+: fixed 144 px (≈35% shorter than 16:9 equivalent) */}
      {item.image_url ? (
        <div className="relative overflow-hidden aspect-[4/3] sm:aspect-auto sm:h-36">
          <img
            src={item.image_url} alt={item.name} loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(12,10,9,0.65) 0%, transparent 55%)" }} />

          {/* Qty pill overlay (image items) */}
          <AnimatePresence>
            {qty > 0 && (
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}
                transition={{ type: "spring", damping: 18, stiffness: 300 }}
                className="absolute top-2.5 right-2.5 flex items-center rounded-full overflow-hidden shadow-lg"
                style={{ background: C.bg, border: `1px solid ${C.goldBorder}` }}
              >
                <motion.button whileTap={{ scale: 0.85 }} onClick={onDecrement}
                  className="w-7 h-7 flex items-center justify-center" style={{ color: C.gold }}>
                  <Minus className="w-3 h-3" />
                </motion.button>
                <motion.span key={qty} initial={{ scale: 1.4 }} animate={{ scale: 1 }}
                  className="w-5 text-center text-xs font-bold" style={{ color: C.text }}>
                  {qty}
                </motion.span>
                <motion.button whileTap={{ scale: 0.85 }} onClick={onAdd}
                  className="w-7 h-7 flex items-center justify-center" style={{ background: C.gold, color: C.bg }}>
                  <Plus className="w-3 h-3" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {unavailable && (
            <div className="absolute bottom-2.5 left-3 text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ background: "rgba(12,10,9,0.88)", color: C.text3, ...SANS }}>
              Unavailable
            </div>
          )}
        </div>
      ) : (
        /* No-image: warm gold gradient top bar */
        <div className="h-[3px] w-full" style={{ background: `linear-gradient(to right, ${C.gold}70, transparent 70%)` }} />
      )}

      {/* Info */}
      <div className="px-4 pt-3.5 pb-4">
        {/* Name + price row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3
            className="text-[1.05rem] leading-[1.25] tracking-[-0.01em]"
            style={{ color: C.text, fontWeight: 400, ...SERIF }}
          >
            {item.name}
          </h3>
          <span
            className="text-sm font-semibold shrink-0 tabular-nums mt-0.5"
            style={{ color: C.gold, ...SANS }}
          >
            {fmt(item.price)}
          </span>
        </div>

        {item.description && (
          <p className="text-xs leading-[1.6] line-clamp-2 mb-2.5" style={{ color: C.text2, ...SANS }}>
            {item.description}
          </p>
        )}

        {/* Bottom row: prep time + CTA */}
        <div className="flex items-center justify-between mt-2">
          {item.prep_time_min ? (
            <span className="text-[11px] flex items-center gap-1" style={{ color: C.text3, ...SANS }}>
              <Clock className="w-2.5 h-2.5" />~{item.prep_time_min} min
            </span>
          ) : <div />}

          {!unavailable && (
            qty === 0 ? (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={onAdd}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: C.goldDim, color: C.gold, border: `1px solid ${C.goldBorder}`, ...SANS }}
              >
                <Plus className="w-3 h-3" /> Add
              </motion.button>
            ) : !item.image_url ? (
              /* No-image items: show qty stepper inline */
              <div className="flex items-center rounded-full overflow-hidden" style={{ border: `1px solid ${C.goldBorder}` }}>
                <motion.button whileTap={{ scale: 0.85 }} onClick={onDecrement}
                  className="w-8 h-7 flex items-center justify-center" style={{ color: C.gold }}>
                  <Minus className="w-3 h-3" />
                </motion.button>
                <motion.span key={qty} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                  className="w-5 text-center text-xs font-bold" style={{ color: C.text, ...SANS }}>{qty}</motion.span>
                <motion.button whileTap={{ scale: 0.85 }} onClick={onAdd}
                  className="w-8 h-7 flex items-center justify-center" style={{ background: C.gold, color: C.bg }}>
                  <Plus className="w-3 h-3" />
                </motion.button>
              </div>
            ) : (
              /* Image item in cart → qty shown in overlay; add-more pill */
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={onAdd}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: C.gold, color: C.bg, ...SANS }}
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

// ─── Cart drawer ─────────────────────────────────────────────────────────────────
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
  const available = items.filter((i) => !unavailableInCart.has(i.menuItemId));
  const allUnavailable = items.length > 0 && available.length === 0;
  const total = available.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0" style={{ background: C.overlay, backdropFilter: "blur(8px)" }}
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280 }}
        className="relative max-h-[88vh] flex flex-col rounded-t-3xl overflow-hidden"
        style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3.5 pb-1 shrink-0">
          <div className="w-9 h-[3px] rounded-full" style={{ background: C.text3 }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4 shrink-0">
          <div>
            <h2 className="text-2xl font-light" style={{ color: C.text, ...SERIF }}>Your Order</h2>
            <p className="text-xs mt-0.5" style={{ color: C.text2, ...SANS }}>{items.length} {items.length === 1 ? "item" : "items"}</p>
          </div>
          <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: C.card }}>
            <X className="w-4 h-4" style={{ color: C.text2 }} />
          </motion.button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-2">
          {unavailableInCart.size > 0 && (
            <div className="flex gap-2 text-xs rounded-2xl px-3 py-2.5" style={{ background: "rgba(251,191,36,0.09)", color: "#FBBF24", ...SANS }}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Some items became unavailable and won't be included.</span>
            </div>
          )}

          {items.map((item) => {
            const isUnavailable = unavailableInCart.has(item.menuItemId);
            return (
              <div key={item.menuItemId} style={{ opacity: isUnavailable ? 0.4 : 1 }}>
                <div className="flex items-center gap-3">
                  {/* Qty stepper */}
                  <div className="flex items-center rounded-full overflow-hidden shrink-0" style={{ border: `1px solid ${C.border}` }}>
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => onUpdateQty(item.menuItemId, -1)} disabled={isUnavailable}
                      className="w-8 h-8 flex items-center justify-center" style={{ color: C.gold }}>
                      <Minus className="w-3 h-3" />
                    </motion.button>
                    <motion.span key={item.quantity} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                      className="w-6 text-center text-sm font-semibold" style={{ color: C.text, ...SANS }}>{item.quantity}</motion.span>
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => onUpdateQty(item.menuItemId, +1)} disabled={isUnavailable}
                      className="w-8 h-8 flex items-center justify-center" style={{ background: C.gold, color: C.bg }}>
                      <Plus className="w-3 h-3" />
                    </motion.button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: C.text, ...SANS }}>{item.name}</p>
                    {isUnavailable && <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#F87171" }}>Unavailable</p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isUnavailable && <span className="text-sm font-semibold tabular-nums" style={{ color: C.gold, ...SANS }}>{fmt(item.price * item.quantity)}</span>}
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => onRemove(item.menuItemId)}>
                      <X className="w-3.5 h-3.5" style={{ color: C.text3 }} />
                    </motion.button>
                  </div>
                </div>

                {!isUnavailable && (
                  <input
                    type="text" placeholder="Special instructions (optional)"
                    value={item.notes} onChange={(e) => onUpdateNote(item.menuItemId, e.target.value)}
                    className="w-full mt-2 text-xs px-3 py-2 rounded-xl outline-none"
                    style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, caretColor: C.gold, ...SANS }}
                    onFocus={(e) => { e.target.style.borderColor = C.goldBorder; }}
                    onBlur={(e)  => { e.target.style.borderColor = C.border; }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 pt-4 pb-8 space-y-4" style={{ borderTop: `1px solid ${C.border}` }}>
          {!allUnavailable && (
            <div className="flex justify-between items-baseline">
              <span className="text-sm" style={{ color: C.text2, ...SANS }}>Order total</span>
              <span className="text-2xl font-light tabular-nums" style={{ color: C.gold, ...SERIF }}>{fmt(total)}</span>
            </div>
          )}

          <AnimatePresence>
            {placeError && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="flex gap-2 text-xs rounded-xl px-3 py-2.5"
                style={{ background: "rgba(248,113,113,0.09)", color: "#F87171", ...SANS }}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{placeError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onPlace}
            disabled={isPlacing || allUnavailable}
            className="w-full py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2"
            style={{
              background: (isPlacing || allUnavailable) ? C.card : C.gold,
              color: (isPlacing || allUnavailable) ? C.text2 : C.bg,
              boxShadow: (isPlacing || allUnavailable) ? "none" : "0 4px 24px rgba(212,168,83,0.25)",
              transition: "background 0.2s, box-shadow 0.2s",
              ...SANS,
            }}
          >
            {isPlacing ? <><Loader2 className="w-4 h-4 animate-spin" /> Placing…</> : "Place Order"}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Active session ───────────────────────────────────────────────────────────────
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
  const { cafeId, cafeName, tableNumber, tableName, expiresAt, sessionId, customerName } = sessionInfo;

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [cartBounce, setCartBounce] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(expiresAt));
  const [activeTab, setActiveTab] = useState<"menu" | "orders">("menu");
  const scrollRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(formatTimeLeft(expiresAt)), 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // ── Menu queries ───────────────────────────────────────────
  const { data: categories = [], isLoading: catsLoading } = useQuery<MenuCategory[]>({
    queryKey: ["menu_categories", cafeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories").select("id, name, description, position")
        .eq("cafe_id", cafeId).eq("is_visible", true).order("position");
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
        .eq("cafe_id", cafeId).eq("is_archived", false).order("position");
      if (error) throw error;
      return (data ?? []) as MenuItem[];
    },
    staleTime: Infinity,
  });

  // Realtime menu updates
  const qc = useQueryClient();
  useEffect(() => {
    if (!cafeId) return;
    const ch = supabase.channel(`menu_items:${cafeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items", filter: `cafe_id=eq.${cafeId}` }, (payload) => {
        const KEY = ["menu_items", cafeId];
        const nr = payload.new as unknown as MenuItem & { is_archived?: boolean };
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id: string }).id;
          qc.setQueryData<MenuItem[]>(KEY, (old) => old?.filter((i) => i.id !== id) ?? old);
        } else if (payload.eventType === "INSERT") {
          if (!nr.is_archived) qc.setQueryData<MenuItem[]>(KEY, (old) => old ? [...old, nr] : old);
        } else if (payload.eventType === "UPDATE") {
          if (nr.is_archived) qc.setQueryData<MenuItem[]>(KEY, (old) => old?.filter((i) => i.id !== nr.id) ?? old);
          else qc.setQueryData<MenuItem[]>(KEY, (old) => {
            if (!old) return old;
            return old.some((i) => i.id === nr.id) ? old.map((i) => i.id === nr.id ? { ...i, ...nr } : i) : [...old, nr];
          });
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cafeId, qc]);

  const activeCategoryId = selectedCategory ?? categories[0]?.id ?? null;

  // Auto-scroll active tab into view
  useEffect(() => {
    const btn = btnRefs.current[activeCategoryId ?? ""];
    if (btn && scrollRef.current) btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeCategoryId]);

  const visibleItems = useMemo(() => menuItems.filter((i) => i.category_id === activeCategoryId), [menuItems, activeCategoryId]);

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
      const ex = next.get(item.id);
      if (ex) next.set(item.id, { ...ex, quantity: ex.quantity + 1 });
      else next.set(item.id, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, notes: "" });
      return next;
    });
    setJustAddedId(item.id);
    setCartBounce(true);
    setTimeout(() => setJustAddedId(null), 500);
    setTimeout(() => setCartBounce(false), 380);
  }, []);

  const updateCartQty = useCallback((menuItemId: string, delta: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const ex = next.get(menuItemId);
      if (!ex) return prev;
      const q = ex.quantity + delta;
      if (q <= 0) next.delete(menuItemId); else next.set(menuItemId, { ...ex, quantity: q });
      return next;
    });
  }, []);

  const updateCartNote   = useCallback((menuItemId: string, note: string) => {
    setCart((prev) => { const n = new Map(prev); const ex = n.get(menuItemId); if (!ex) return prev; n.set(menuItemId, { ...ex, notes: note }); return n; });
  }, []);

  const removeFromCart = useCallback((menuItemId: string) => {
    setCart((prev) => { const n = new Map(prev); n.delete(menuItemId); return n; });
  }, []);

  async function handlePlaceOrder() {
    const avail = Array.from(cart.values()).filter((i) => !unavailableInCart.has(i.menuItemId));
    if (avail.length === 0) return;
    try {
      await placeOrder(avail);
      setCart(new Map());
      setCartOpen(false);
      setOrderSuccess(true);
      setActiveTab("orders");
      setTimeout(() => setOrderSuccess(false), 5000);
    } catch { /* placeOrderError shown in drawer */ }
  }

  const orderGroups = useMemo(() => groupOrdersBySession(orders, sessionId), [orders, sessionId]);
  const tableTotal = useMemo(() =>
    orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0), 0),
    [orders]);
  const hasBillableOrder = orders.some((o) => o.status === "served" || o.status === "ready");
  const pendingCount = orders.filter((o) => ["pending_approval", "approved", "in_kitchen", "ready"].includes(o.status)).length;
  const tableLabel = tableName ? `${tableName} · Table ${tableNumber}` : `Table ${tableNumber}`;
  const isMenuLoading = catsLoading || itemsLoading;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.bg }}>

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30"
        style={{ background: `${C.bg}F2`, backdropFilter: "blur(16px)", borderBottom: `1px solid ${C.border}` }}
      >
        {/* Top row: branding + guest name */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: C.goldDim, border: `1px solid ${C.goldBorder}` }}
            >
              <Coffee className="w-4 h-4" style={{ color: C.gold }} />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-none tracking-[-0.02em] truncate" style={{ color: C.text, ...SANS }}>
                {cafeName}
              </p>
              <p className="text-[11px] mt-[3px] leading-none flex items-center gap-1.5" style={{ color: C.text3, ...SANS }}>
                <span>{tableLabel}</span>
                <span style={{ color: C.border }}>·</span>
                <span>{timeLeft} left</span>
              </p>
            </div>
          </div>
          <div
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full"
            style={{ background: C.goldDim, color: C.gold, border: `1px solid ${C.goldBorder}`, ...SANS }}
          >
            {customerName}
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-4 pb-3 pt-1">
          <div className="flex gap-1 p-[3px] rounded-xl" style={{ background: C.card }}>
            {(["menu", "orders"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="relative flex-1 flex items-center justify-center gap-1.5 py-[7px] rounded-[9px] text-xs font-semibold transition-colors duration-200"
                style={{
                  background: activeTab === tab ? C.gold : "transparent",
                  color: activeTab === tab ? C.bg : C.text2,
                  ...SANS,
                }}
              >
                {tab === "menu"
                  ? <><UtensilsCrossed className="w-3 h-3" /> Menu</>
                  : <>
                      <Receipt className="w-3 h-3" /> Orders
                      {pendingCount > 0 && (
                        <span
                          className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full text-[9px] font-bold flex items-center justify-center"
                          style={{ background: "#F87171", color: "#fff" }}
                        >
                          {pendingCount}
                        </span>
                      )}
                    </>
                }
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CATEGORY NAV — animated sliding pill ────────────────── */}
      <AnimatePresence>
        {activeTab === "menu" && categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="sticky z-20 px-4 py-3"
            style={{
              top: 116,
              background: `${C.bg}EE`,
              backdropFilter: "blur(12px)",
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <div
              ref={scrollRef}
              className="flex gap-2 overflow-x-auto"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {categories.map((cat) => {
                const active = activeCategoryId === cat.id;
                return (
                  <motion.button
                    key={cat.id}
                    ref={(el) => { btnRefs.current[cat.id] = el; }}
                    onClick={() => setSelectedCategory(cat.id)}
                    className="relative shrink-0 px-4 py-[7px] rounded-full text-xs font-semibold overflow-hidden"
                    style={{
                      color: active ? C.bg : C.text2,
                      border: `1px solid ${active ? "transparent" : C.border}`,
                      ...SANS,
                    }}
                    whileTap={{ scale: 0.93 }}
                  >
                    {/* Animated fill background */}
                    {active && (
                      <motion.div
                        layoutId="cat-active"
                        className="absolute inset-0"
                        style={{ background: C.gold, borderRadius: "inherit" }}
                        transition={{ type: "spring", damping: 24, stiffness: 260 }}
                      />
                    )}
                    <span className="relative z-10">{cat.name}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
      <div className={`flex-1 px-4 py-4 ${cartCount > 0 ? "pb-32" : "pb-10"}`}>

        {/* Order success toast */}
        <AnimatePresence>
          {orderSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-4 text-sm font-medium"
              style={{ background: "rgba(52,211,153,0.11)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)", ...SANS }}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Order placed! We'll confirm it shortly.
            </motion.div>
          )}
        </AnimatePresence>

        {/* MENU TAB */}
        {activeTab === "menu" && (
          <>
            {isMenuLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : visibleItems.length === 0 && categories.length > 0 ? (
              <div className="text-center py-20">
                <UtensilsCrossed className="w-7 h-7 mx-auto mb-3 opacity-20" style={{ color: C.text }} />
                <p className="text-sm" style={{ color: C.text3, ...SANS }}>Nothing in this category yet</p>
              </div>
            ) : (
              <motion.div
                key={activeCategoryId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18 }}
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
          </>
        )}

        {/* ORDERS TAB */}
        {activeTab === "orders" && (
          <div>
            {orderGroups.length === 0 ? (
              <div className="text-center py-20">
                <Receipt className="w-7 h-7 mx-auto mb-3 opacity-20" style={{ color: C.text }} />
                <p className="text-sm mb-1" style={{ color: C.text2, ...SANS }}>No orders yet</p>
                <p className="text-xs" style={{ color: C.text3, ...SANS }}>
                  <button onClick={() => setActiveTab("menu")} style={{ color: C.gold }}>Browse the menu</button> to get started
                </p>
              </div>
            ) : (
              <div className="space-y-7">
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
                        <span className="text-sm font-semibold" style={{ color: C.text, ...SANS }}>
                          {group.customerName}
                          {isMe && <span className="text-xs font-normal ml-1.5" style={{ color: C.text3 }}>(you)</span>}
                        </span>
                        {groupTotal > 0 && (
                          <span className="ml-auto text-sm font-semibold tabular-nums" style={{ color: C.gold, ...SANS }}>{fmt(groupTotal)}</span>
                        )}
                      </div>
                      <div className="space-y-2 pl-8">
                        {group.orders.map((order) => <QROrderCard key={order.orderId} order={order} />)}
                      </div>
                    </div>
                  );
                })}

                {tableTotal > 0 && (
                  <div
                    className="flex items-center justify-between rounded-2xl px-5 py-4"
                    style={{ background: C.card, border: `1px solid ${C.goldBorder}` }}
                  >
                    <span className="text-sm" style={{ color: C.text2, ...SANS }}>Table total</span>
                    <span className="text-2xl font-light tabular-nums" style={{ color: C.gold, ...SERIF }}>{fmt(tableTotal)}</span>
                  </div>
                )}

                {hasBillableOrder && (
                  <div>
                    {requestBillError && <p className="text-xs mb-2" style={{ color: "#F87171", ...SANS }}>{requestBillError}</p>}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => requestBill()}
                      disabled={billRequested || isRequestingBill}
                      className="w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
                      style={{
                        background: billRequested ? "rgba(52,211,153,0.1)" : C.card,
                        color: billRequested ? "#34D399" : C.text,
                        border: `1px solid ${billRequested ? "rgba(52,211,153,0.25)" : C.border}`,
                        ...SANS,
                      }}
                    >
                      {isRequestingBill
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Requesting…</>
                        : billRequested
                        ? <><CheckCircle2 className="w-4 h-4" /> Bill requested</>
                        : <><Bell className="w-4 h-4" style={{ color: C.gold }} /> Request the Bill</>
                      }
                    </motion.button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── FLOATING CART PILL ────────────────────────────────────── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <div
            className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-6 pb-8 pt-6 pointer-events-none"
            style={{ background: `linear-gradient(to top, ${C.bg} 0%, transparent 100%)` }}
          >
            <motion.button
              initial={{ y: 72, opacity: 0, scale: 0.92 }}
              animate={{ y: 0, opacity: 1, scale: cartBounce ? 1.05 : 1 }}
              exit={{ y: 72, opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", damping: 20, stiffness: 280 }}
              onClick={() => setCartOpen(true)}
              className="pointer-events-auto flex items-center gap-3.5 px-6 py-3.5 rounded-full"
              style={{
                background: C.gold,
                color: C.bg,
                boxShadow: "0 8px 36px rgba(212,168,83,0.42)",
              }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="relative">
                <ShoppingCart className="w-5 h-5" />
                <motion.span
                  key={cartCount}
                  initial={{ scale: 1.5 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                  style={{ background: C.bg, color: C.gold }}
                >
                  {cartCount}
                </motion.span>
              </div>
              <span className="text-[15px] font-semibold" style={SANS}>View order</span>
              <span className="text-[15px] opacity-50" style={SANS}>·</span>
              <span className="text-[15px] font-semibold tabular-nums" style={SANS}>{fmt(cartTotal)}</span>
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* ── CART DRAWER ──────────────────────────────────────────── */}
      <AnimatePresence>
        {cartOpen && (
          <QRCartDrawer
            cart={cart} unavailableInCart={unavailableInCart}
            onUpdateQty={updateCartQty} onUpdateNote={updateCartNote}
            onRemove={removeFromCart} onClose={() => setCartOpen(false)}
            onPlace={handlePlaceOrder} isPlacing={isPlacingOrder} placeError={placeOrderError}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────────
export function TableSessionPage() {
  const { token } = useParams<{ token: string }>();

  const [, navigate] = useLocation();
  const [scannerOpen, setScannerOpen] = useState(false);

  const {
    sessionState, sessionInfo, orders, billRequested,
    nameEntryError, isStartingSession, startSession,
    resetToNameEntry,
    placeOrder, requestBill,
    isPlacingOrder, isRequestingBill, placeOrderError, requestBillError,
  } = useTableSession(token ?? "");

  const handleScanNavigate = (path: string) => {
    resetToNameEntry();
    navigate(path);
  };

  // ── Minimum branded load time: show loader for at least MIN_MS regardless
  //    of how fast the session validates, for a deliberate premium feel.
  const [minLoadDone, setMinLoadDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMinLoadDone(true), MIN_MS);
    return () => clearTimeout(id);
  }, []);

  const showLoader = !minLoadDone || sessionState === "loading";

  if (showLoader) {
    return (
      <AnimatePresence>
        <BrandedLoader key="loader" />
      </AnimatePresence>
    );
  }

  if (sessionState === "entering_name") {
    const tableLabel = "Scan complete — you're at your table";
    return (
      <motion.div key="name-entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <QRNameEntry cafeName="Welcome" tableLabel={tableLabel} onStart={startSession} error={nameEntryError} isSubmitting={isStartingSession} />
      </motion.div>
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
      <>
        <QRSessionScreen
          icon={<Clock className="w-14 h-14" style={{ color: C.text }} />}
          title="Session expired"
          body="Your session has timed out. To place a new order, scan a table QR code."
          onScan={() => setScannerOpen(true)}
        />
        <QRScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onNavigate={handleScanNavigate}
        />
      </>
    );
  }

  if (sessionState === "ended") {
    return (
      <>
        <QRSessionScreen
          icon={<CheckCircle2 className="w-14 h-14" style={{ color: C.text }} />}
          title="Thank you for visiting."
          body="To place a new order, scan a table QR code."
          onScan={() => setScannerOpen(true)}
        />
        <QRScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onNavigate={handleScanNavigate}
        />
      </>
    );
  }

  if (!sessionInfo) return null;

  return (
    <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
      <ActiveSession
        sessionInfo={sessionInfo} orders={orders} billRequested={billRequested}
        placeOrder={placeOrder} requestBill={requestBill}
        isPlacingOrder={isPlacingOrder} isRequestingBill={isRequestingBill}
        placeOrderError={placeOrderError} requestBillError={requestBillError}
      />
    </motion.div>
  );
}
