import { useState, useMemo, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Coffee, QrCode, Clock, AlertCircle, XCircle, CheckCircle2,
  ChefHat, Bell, ShoppingCart, Minus, Plus, X, Loader2,
  UtensilsCrossed, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import {
  useTableSession, SessionState, GuestOrder, CartItem,
} from "@/hooks/useTableSession";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  tags: string[];
  prep_time_min: number | null;
  allergens: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  return `$${n.toFixed(2)}`;
}

function formatTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

const ORDER_STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending_approval: { label: "Waiting for approval", color: "bg-amber-100 text-amber-800 border-amber-200",    icon: <Clock className="h-3 w-3" /> },
  approved:         { label: "Confirmed",            color: "bg-blue-100 text-blue-800 border-blue-200",       icon: <CheckCircle2 className="h-3 w-3" /> },
  in_kitchen:       { label: "Being prepared",       color: "bg-orange-100 text-orange-800 border-orange-200", icon: <ChefHat className="h-3 w-3" /> },
  ready:            { label: "Ready for pickup!",    color: "bg-green-100 text-green-800 border-green-200",    icon: <CheckCircle2 className="h-3 w-3" /> },
  served:           { label: "Served ✓",             color: "bg-gray-100 text-gray-500 border-gray-200",       icon: null },
  cancelled:        { label: "Not accepted",         color: "bg-red-100 text-red-700 border-red-200",          icon: <XCircle className="h-3 w-3" /> },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SessionScreen({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
      <div className="mb-4 text-muted-foreground">{icon}</div>
      <h1 className="text-xl font-semibold mb-2">{title}</h1>
      <p className="text-muted-foreground text-sm max-w-xs">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const cfg = ORDER_STATUS_LABELS[status] ?? {
    label: status,
    color: "bg-gray-100 text-gray-600 border-gray-200",
    icon: null,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function OrderCard({ order }: { order: GuestOrder }) {
  const total = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const isReady = order.status === "ready";

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        isReady ? "border-green-400 bg-green-50" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        <OrderStatusBadge status={order.status} />
      </div>

      <ul className="space-y-1">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between text-sm">
            <span className="text-foreground">
              {item.quantity}× {item.name}
              {item.notes && (
                <span className="text-muted-foreground"> — {item.notes}</span>
              )}
            </span>
            <span className="text-muted-foreground ml-2 shrink-0">
              {formatPrice(item.unitPrice * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex justify-between text-sm font-medium border-t pt-2">
        <span>Order total</span>
        <span>{formatPrice(total)}</span>
      </div>

      {order.status === "cancelled" && order.staffNote && (
        <p className="text-xs text-red-600 bg-red-50 rounded p-2">
          Note from staff: {order.staffNote}
        </p>
      )}
    </div>
  );
}

// ─── Cart modal ───────────────────────────────────────────────────────────────

function CartModal({
  cart,
  onUpdateQty,
  onUpdateNote,
  onRemove,
  onClose,
  onPlace,
  isPlacing,
  placeError,
}: {
  cart: Map<string, CartItem>;
  onUpdateQty: (id: string, delta: number) => void;
  onUpdateNote: (id: string, note: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  onPlace: () => void;
  isPlacing: boolean;
  placeError: string | null;
}) {
  const items = Array.from(cart.values());
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative mt-auto bg-background rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b shrink-0">
          <h2 className="font-semibold text-lg">Your Order</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Item list */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
          {items.map((item) => (
            <div key={item.menuItemId} className="space-y-2">
              <div className="flex items-center gap-3">
                {/* Quantity control */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onUpdateQty(item.menuItemId, -1)}
                    className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-muted"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQty(item.menuItemId, +1)}
                    className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-muted"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                  <button
                    onClick={() => onRemove(item.menuItemId)}
                    className="p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Per-item note */}
              <input
                type="text"
                placeholder="Special instructions (optional)"
                value={item.notes}
                onChange={(e) => onUpdateNote(item.menuItemId, e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-lg border bg-muted/50 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t px-4 pt-3 pb-6 space-y-3">
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>

          {placeError && (
            <div className="flex gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{placeError}</span>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={onPlace}
            disabled={isPlacing || items.length === 0}
          >
            {isPlacing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Placing order…
              </>
            ) : (
              "Place Order"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Active session UI ────────────────────────────────────────────────────────

function ActiveSession({
  cafeId,
  cafeName,
  tableNumber,
  tableName,
  expiresAt,
  orders,
  billRequested,
  placeOrder,
  requestBill,
  isPlacingOrder,
  isRequestingBill,
  placeOrderError,
  requestBillError,
}: {
  cafeId: string;
  cafeName: string;
  tableNumber: number;
  tableName: string | null;
  expiresAt: string;
  orders: GuestOrder[];
  billRequested: boolean;
  placeOrder: (items: CartItem[]) => Promise<string>;
  requestBill: () => Promise<void>;
  isPlacingOrder: boolean;
  isRequestingBill: boolean;
  placeOrderError: string | null;
  requestBillError: string | null;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(expiresAt));

  // Keep the time-remaining display updated
  useEffect(() => {
    const id = setInterval(() => setTimeLeft(formatTimeLeft(expiresAt)), 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // ── Menu data ──────────────────────────────────────────────

  const { data: categories = [] } = useQuery<MenuCategory[]>({
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

  const { data: menuItems = [] } = useQuery<MenuItem[]>({
    queryKey: ["menu_items", cafeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, category_id, name, description, price, tags, prep_time_min, allergens")
        .eq("cafe_id", cafeId)
        .eq("is_available", true)
        .order("position");
      if (error) throw error;
      return (data ?? []) as MenuItem[];
    },
    staleTime: 60_000,
  });

  // Default to first category
  const activeCategoryId = selectedCategory ?? categories[0]?.id ?? null;

  const visibleItems = useMemo(
    () => menuItems.filter((i) => i.category_id === activeCategoryId),
    [menuItems, activeCategoryId]
  );

  // ── Cart helpers ───────────────────────────────────────────

  const cartCount = Array.from(cart.values()).reduce((s, i) => s + i.quantity, 0);
  const cartTotal = Array.from(cart.values()).reduce((s, i) => s + i.price * i.quantity, 0);

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(item.id);
      if (existing) {
        next.set(item.id, { ...existing, quantity: existing.quantity + 1 });
      } else {
        next.set(item.id, {
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          notes: "",
        });
      }
      return next;
    });
  }

  function updateCartQty(menuItemId: string, delta: number) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(menuItemId);
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        next.delete(menuItemId);
      } else {
        next.set(menuItemId, { ...existing, quantity: newQty });
      }
      return next;
    });
  }

  function updateCartNote(menuItemId: string, note: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(menuItemId);
      if (!existing) return prev;
      next.set(menuItemId, { ...existing, notes: note });
      return next;
    });
  }

  function removeFromCart(menuItemId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(menuItemId);
      return next;
    });
  }

  async function handlePlaceOrder() {
    try {
      await placeOrder(Array.from(cart.values()));
      setCart(new Map());
      setCartOpen(false);
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 4000);
    } catch {
      // error shown via placeOrderError
    }
  }

  const tableLabel = tableName ? `${tableName} (${tableNumber})` : `Table ${tableNumber}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Coffee className="h-5 w-5 text-primary shrink-0" />
            <span className="font-semibold text-base truncate">{cafeName}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-medium text-muted-foreground">{tableLabel}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeLeft}
            </span>
          </div>
        </div>
      </div>

      {/* ── Category tabs ── */}
      {categories.length > 0 && (
        <div className="sticky top-[57px] z-20 bg-background border-b">
          <div className="flex gap-1 overflow-x-auto px-3 py-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategoryId === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className={`flex-1 px-4 py-4 space-y-3 ${cartCount > 0 ? "pb-28" : "pb-6"}`}>

        {/* Order placed success toast */}
        {orderSuccess && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-300 text-green-800 rounded-xl px-4 py-3 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Order placed! We'll confirm it shortly.
          </div>
        )}

        {/* Menu items */}
        {visibleItems.length === 0 && categories.length > 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No items in this category.
          </div>
        )}

        {visibleItems.map((item) => {
          const cartItem = cart.get(item.id);
          const qty = cartItem?.quantity ?? 0;

          return (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-xl border bg-card p-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    {item.prep_time_min && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        ~{item.prep_time_min} min
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold shrink-0 text-primary">
                    {formatPrice(item.price)}
                  </span>
                </div>

                {/* Quantity control */}
                <div className="mt-3 flex justify-end">
                  {qty === 0 ? (
                    <button
                      onClick={() => addToCart(item)}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateCartQty(item.id, -1)}
                        className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-muted"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold">{qty}</span>
                      <button
                        onClick={() => addToCart(item)}
                        className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* ── Your Orders ── */}
        {orders.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Your Orders
              </h2>
            </div>
            <div className="space-y-3">
              {orders.map((order) => (
                <OrderCard key={order.orderId} order={order} />
              ))}
            </div>
          </div>
        )}

        {/* ── Request bill ── */}
        {orders.some((o) => o.status === "served" || o.status === "ready") && (
          <div className="pt-2 border-t">
            {requestBillError && (
              <p className="text-xs text-destructive mb-2">{requestBillError}</p>
            )}
            <Button
              variant="outline"
              className="w-full"
              disabled={billRequested || isRequestingBill}
              onClick={() => requestBill()}
            >
              {isRequestingBill ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Requesting…</>
              ) : billRequested ? (
                <><CheckCircle2 className="h-4 w-4 mr-2 text-green-600" /> Bill requested</>
              ) : (
                <><Bell className="h-4 w-4 mr-2" /> Request the Bill</>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* ── Sticky cart bar ── */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-6 pt-3 bg-gradient-to-t from-background via-background">
          <Button
            className="w-full h-14 text-base shadow-lg"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            View Order · {cartCount} {cartCount === 1 ? "item" : "items"} · {formatPrice(cartTotal)}
          </Button>
        </div>
      )}

      {/* ── Cart modal ── */}
      {cartOpen && (
        <CartModal
          cart={cart}
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

// ─── Main page ────────────────────────────────────────────────────────────────

export function TableSessionPage() {
  const { token } = useParams<{ token: string }>();

  const {
    sessionState,
    sessionInfo,
    orders,
    billRequested,
    placeOrder,
    requestBill,
    isPlacingOrder,
    isRequestingBill,
    placeOrderError,
    requestBillError,
  } = useTableSession(token ?? "");

  // ── Static screens ────────────────────────────────────────

  if (sessionState === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Coffee className="h-10 w-10 text-primary animate-pulse" />
        <p className="text-muted-foreground text-sm">Joining your table…</p>
      </div>
    );
  }

  if (sessionState === "invalid") {
    return (
      <SessionScreen
        icon={<QrCode className="h-12 w-12" />}
        title="Table not found"
        body="This QR code is no longer active. Please ask your waiter for a new one."
      />
    );
  }

  if (sessionState === "expired") {
    return (
      <SessionScreen
        icon={<Clock className="h-12 w-12" />}
        title="Session expired"
        body="Your session has expired after 2 hours. Please scan the QR code on your table to start a new session."
      />
    );
  }

  if (sessionState === "ended") {
    return (
      <SessionScreen
        icon={<XCircle className="h-12 w-12" />}
        title="Session ended"
        body="Session ended. Please scan the QR code again to start a new session."
      />
    );
  }

  // ── Active session ────────────────────────────────────────

  if (!sessionInfo) return null;

  return (
    <ActiveSession
      cafeId={sessionInfo.cafeId}
      cafeName={sessionInfo.cafeName}
      tableNumber={sessionInfo.tableNumber}
      tableName={sessionInfo.tableName}
      expiresAt={sessionInfo.expiresAt}
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
