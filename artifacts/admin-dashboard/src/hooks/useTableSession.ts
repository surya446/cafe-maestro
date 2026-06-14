import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ─── Public types ──────────────────────────────────────────────────────────────

export type SessionState =
  | "loading"
  | "entering_name"
  | "active"
  | "expired"
  | "ended"
  | "invalid";

export interface SessionInfo {
  sessionId: string;
  deviceToken: string;
  cafeId: string;
  cafeName: string;
  tableId: string;
  tableNumber: number;
  tableName: string | null;
  expiresAt: string;
  customerName: string;
}

export interface GuestOrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
}

export interface GuestOrder {
  orderId: string;
  sessionId: string;
  customerName: string;
  status: string;
  staffNote: string | null;
  createdAt: string;
  items: GuestOrderItem[];
}

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
}

// ─── localStorage helpers ──────────────────────────────────────────────────────

interface StoredDevice {
  deviceToken: string;
  sessionId: string;
  customerName: string;
}

interface EndedMarker {
  ended: true;
}

function storageKey(qrToken: string) {
  return `cafe_session_${qrToken}`;
}

function loadStored(qrToken: string): StoredDevice | EndedMarker | null {
  try {
    const raw = localStorage.getItem(storageKey(qrToken));
    return raw ? (JSON.parse(raw) as StoredDevice | EndedMarker) : null;
  } catch {
    return null;
  }
}

function isStoredDevice(s: StoredDevice | EndedMarker): s is StoredDevice {
  return "deviceToken" in s;
}

function saveStored(
  qrToken: string,
  deviceToken: string,
  sessionId: string,
  customerName: string
) {
  localStorage.setItem(
    storageKey(qrToken),
    JSON.stringify({ deviceToken, sessionId, customerName })
  );
}

function clearStored(qrToken: string) {
  localStorage.removeItem(storageKey(qrToken));
}

// Writes an ended marker so reloads stay on the ended screen.
function markEnded(qrToken: string) {
  localStorage.setItem(storageKey(qrToken), JSON.stringify({ ended: true }));
}

// Returns true when the page was opened via fresh navigation (QR scan, link,
// address-bar) rather than a reload or back/forward traversal.
function isFreshNavigation(): boolean {
  const entries = performance.getEntriesByType(
    "navigation"
  ) as PerformanceNavigationTiming[];
  return entries.length === 0 || entries[0].type === "navigate";
}

// ─── RPC types ─────────────────────────────────────────────────────────────────

interface CreateSessionResult {
  session_id: string;
  device_token: string;
  cafe_id: string;
  cafe_name: string;
  table_id: string;
  table_number: number;
  table_name: string | null;
  expires_at: string;
  customer_name: string;
}

interface ValidateResult {
  is_valid: boolean;
  session_id: string;
  session_status: string;
  expires_at: string;
  cafe_id: string;
  cafe_name: string;
  table_id: string;
  table_number: number;
  table_name: string | null;
  customer_name: string;
}

// ─── RPC wrappers ──────────────────────────────────────────────────────────────

async function rpcCreateSession(
  qrToken: string,
  customerName: string,
  userAgent: string
): Promise<CreateSessionResult> {
  const { data, error } = await supabase.rpc("create_session", {
    p_qr_token: qrToken,
    p_customer_name: customerName,
    p_user_agent: userAgent,
  });
  if (error) throw new Error(error.message);
  const rows = data as CreateSessionResult[] | null;
  if (!rows || rows.length === 0) throw new Error("TABLE_NOT_FOUND");
  return rows[0];
}

async function rpcValidateDevice(deviceToken: string): Promise<ValidateResult | null> {
  const { data, error } = await supabase.rpc("validate_device", {
    p_device_token: deviceToken,
  });
  if (error) return null;
  const rows = data as ValidateResult[] | null;
  return rows && rows.length > 0 ? rows[0] : null;
}

function mapRpcError(msg: string): string {
  if (msg.includes("CUSTOMER_NAME_REQUIRED"))
    return "Please enter your name to start ordering.";
  if (msg.includes("TABLE_NOT_FOUND"))
    return "This QR code is no longer active. Please ask your waiter for a new one.";
  if (msg.includes("DEVICE_INVALID"))
    return "Your session has ended. Please scan the QR code again.";
  if (msg.includes("SESSION_INVALID") || msg.includes("SESSION_MISMATCH"))
    return "Session expired. Please scan the QR code again.";
  if (msg.includes("ITEM_UNAVAILABLE"))
    return "One or more items are no longer available. Please remove them and try again.";
  if (msg.includes("NO_ITEMS"))
    return "Please add at least one item to your order.";
  return "Something went wrong. Please try again.";
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useTableSession(qrToken: string) {
  const qc = useQueryClient();

  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [billRequested, setBillRequested] = useState(false);
  const [nameEntryError, setNameEntryError] = useState<string | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);

  const deviceToken = sessionInfo?.deviceToken ?? null;
  const sessionId   = sessionInfo?.sessionId   ?? null;

  // ─── Initialization: validate stored token or show name-entry screen ──────

  useEffect(() => {
    if (!qrToken) {
      setSessionState("invalid");
      return;
    }

    let cancelled = false;

    async function init() {
      const freshNav = isFreshNavigation();
      const stored = loadStored(qrToken);

      // Ended marker present
      if (stored && !isStoredDevice(stored)) {
        if (!freshNav) {
          // Reload after staff-ended session → keep showing ended screen.
          setSessionState("ended");
          return;
        }
        // Fresh QR scan → clear ended marker and show name entry.
        clearStored(qrToken);
        setSessionState("entering_name");
        return;
      }

      // Valid stored device → try to resume without re-asking the name.
      if (stored && isStoredDevice(stored)) {
        const result = await rpcValidateDevice(stored.deviceToken);
        if (cancelled) return;

        if (result?.is_valid) {
          // Source of truth for customer_name is validate_device(), not localStorage.
          const info: SessionInfo = {
            sessionId:    stored.sessionId,
            deviceToken:  stored.deviceToken,
            cafeId:       result.cafe_id,
            cafeName:     result.cafe_name,
            tableId:      result.table_id,
            tableNumber:  result.table_number,
            tableName:    result.table_name ?? null,
            expiresAt:    result.expires_at,
            customerName: result.customer_name,
          };
          // Keep localStorage in sync with the authoritative server value.
          saveStored(qrToken, stored.deviceToken, stored.sessionId, result.customer_name);
          setSessionInfo(info);
          setSessionState("active");
          return;
        }

        if (result?.session_status === "ended") {
          markEnded(qrToken);
          setSessionState("ended");
          return;
        }

        if (result?.session_status === "expired") {
          clearStored(qrToken);
          setSessionState("expired");
          return;
        }

        // Device record missing or unknown → clear and fall to name entry.
        clearStored(qrToken);
      }

      // No stored device (or just cleared) → show name-entry screen.
      setSessionState("entering_name");
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken]);

  // ─── Session validity polling (heartbeat + expiry check) ─────────────────

  useQuery({
    queryKey: ["validate_device", deviceToken],
    queryFn: async () => {
      if (!deviceToken) return null;
      const result = await rpcValidateDevice(deviceToken);

      if (!result) {
        clearStored(qrToken);
        setSessionState("expired");
        return null;
      }

      if (!result.is_valid) {
        if (result.session_status === "ended") {
          markEnded(qrToken);
        } else {
          clearStored(qrToken);
        }
        setSessionState(result.session_status === "ended" ? "ended" : "expired");
      }

      return result;
    },
    enabled: !!deviceToken && sessionState === "active",
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // ─── Supabase Realtime subscription ──────────────────────────────────────

  useEffect(() => {
    if (!sessionId || sessionState !== "active") return;

    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "table_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const rec = payload.new as { status?: string };
          if (rec.status === "ended") {
            markEnded(qrToken);
            setSessionState("ended");
          } else if (rec.status === "expired") {
            clearStored(qrToken);
            setSessionState("expired");
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["table_orders", deviceToken] });
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, sessionState, qrToken, deviceToken, qc]);

  // ─── Table orders (all sessions on the same physical table) ──────────────

  const { data: orders = [], isLoading: ordersLoading } = useQuery<GuestOrder[]>({
    queryKey: ["table_orders", deviceToken],
    queryFn: async () => {
      if (!deviceToken) return [];
      const { data, error } = await supabase.rpc("get_table_orders", {
        p_device_token: deviceToken,
      });
      if (error) throw error;

      return ((data as RawOrderRow[]) ?? []).map((row) => ({
        orderId:      row.order_id,
        sessionId:    row.session_id,
        customerName: row.customer_name,
        status:       row.status,
        staffNote:    row.staff_note,
        createdAt:    row.created_at,
        items: parseItems(row.items),
      }));
    },
    enabled: !!deviceToken && sessionState === "active",
    refetchInterval: 8_000,
    refetchIntervalInBackground: false,
  });

  // ─── startSession: called from NameEntryScreen ────────────────────────────
  // Does NOT change sessionState to "loading" — the form shows its own spinner.
  // Source of truth for customerName is the server; we persist it to localStorage
  // so it survives reloads, but validate_device() is always the final authority.

  const startSession = useCallback(
    async (customerName: string) => {
      setNameEntryError(null);
      setIsStartingSession(true);
      try {
        const row = await rpcCreateSession(
          qrToken,
          customerName.trim(),
          navigator.userAgent
        );
        const info: SessionInfo = {
          sessionId:    row.session_id,
          deviceToken:  row.device_token,
          cafeId:       row.cafe_id,
          cafeName:     row.cafe_name,
          tableId:      row.table_id,
          tableNumber:  row.table_number,
          tableName:    row.table_name ?? null,
          expiresAt:    row.expires_at,
          customerName: row.customer_name,
        };
        saveStored(qrToken, info.deviceToken, info.sessionId, info.customerName);
        setSessionInfo(info);
        setSessionState("active");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        setNameEntryError(mapRpcError(msg));
      } finally {
        setIsStartingSession(false);
      }
    },
    [qrToken]
  );

  // ─── Actions ──────────────────────────────────────────────────────────────

  const placeOrderMutation = useMutation({
    mutationFn: async (cartItems: CartItem[]) => {
      if (!deviceToken || !sessionId) throw new Error("No active session");

      const items = cartItems.map((ci) => ({
        menu_item_id: ci.menuItemId,
        quantity:     ci.quantity,
        notes:        ci.notes || null,
      }));

      const { data, error } = await supabase.rpc("place_order", {
        p_device_token: deviceToken,
        p_session_id:   sessionId,
        p_items:        items,
      });
      if (error) throw new Error(mapRpcError(error.message));
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["table_orders", deviceToken] });
    },
  });

  const requestBillMutation = useMutation({
    mutationFn: async () => {
      if (!deviceToken || !sessionId) throw new Error("No active session");
      const { error } = await supabase.rpc("request_bill", {
        p_device_token: deviceToken,
        p_session_id:   sessionId,
      });
      if (error) throw new Error(mapRpcError(error.message));
    },
    onSuccess: () => setBillRequested(true),
  });

  const placeOrder = useCallback(
    (cartItems: CartItem[]) => placeOrderMutation.mutateAsync(cartItems),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placeOrderMutation.mutateAsync]
  );

  const requestBill = useCallback(
    () => requestBillMutation.mutateAsync(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requestBillMutation.mutateAsync]
  );

  return {
    sessionState,
    sessionInfo,
    orders,
    ordersLoading,
    billRequested,
    nameEntryError,
    isStartingSession,
    startSession,
    placeOrder,
    requestBill,
    isPlacingOrder:    placeOrderMutation.isPending,
    isRequestingBill:  requestBillMutation.isPending,
    placeOrderError:   placeOrderMutation.error?.message ?? null,
    requestBillError:  requestBillMutation.error?.message ?? null,
  };
}

// ─── Internal types ────────────────────────────────────────────────────────────

interface RawOrderRow {
  order_id:      string;
  session_id:    string;
  customer_name: string;
  status:        string;
  staff_note:    string | null;
  created_at:    string;
  items:         GuestOrderItem[] | string;
}

function parseItems(raw: GuestOrderItem[] | string): GuestOrderItem[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    return (arr as Array<{
      id: string;
      name: string;
      quantity: number;
      unit_price: number;
      notes: string | null;
    }>).map((r) => ({
      id:        r.id,
      name:      r.name,
      quantity:  r.quantity,
      unitPrice: r.unit_price,
      notes:     r.notes,
    }));
  } catch {
    return [];
  }
}
