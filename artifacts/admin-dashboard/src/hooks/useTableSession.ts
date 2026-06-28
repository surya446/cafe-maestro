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
  | "invalid"
  | "maintenance";

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
//
// localStorage persists across browser closure so active sessions resume silently.
//
// TERMINATION STRATEGY
// When a session ends or expires we do NOT clear the stored record. Instead we
// write a `terminated` marker alongside the deviceToken so that on the next
// page load we can:
//   1. Confirm the terminal state with the server (backend is source of truth).
//   2. Show the correct ended/expired screen instead of the name-entry screen.
//
// This prevents the regression where clearing storage on session end causes a
// refresh to fall through to name-entry, allowing a customer to bypass a
// staff-forced session termination by simply re-entering their name.
//
// KEY DESIGN
// Storage key = `cafe_session_${qrToken}` (one record per QR code / URL).
// This means:
//   • Different QR tokens (different tables or regenerated codes) → separate keys.
//   • Same QR token on a new day → same key; the terminated marker persists until
//     the customer explicitly taps "Start new session" on the terminal screen.
//
// RESETTING
// The only way to clear a terminated marker and reach name-entry is via
// `resetToNameEntry()`, which is exposed from the hook and wired to a button on
// the ended/expired screen. This gives customers a conscious exit path while
// preventing accidental or malicious refresh-to-rejoin.

interface StoredSession {
  deviceToken: string;
  sessionId: string;
  customerName: string;
  terminated?: "ended" | "expired"; // present when session was terminated
}

function storageKey(qrToken: string) {
  return `cafe_session_${qrToken}`;
}

function loadStored(qrToken: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(storageKey(qrToken));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    // deviceToken is always required — without it we cannot validate with server.
    if (!parsed.deviceToken || !parsed.sessionId) {
      localStorage.removeItem(storageKey(qrToken));
      return null;
    }
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

function saveStored(
  qrToken: string,
  deviceToken: string,
  sessionId: string,
  customerName: string
) {
  // Saves/updates a clean active-session record (no terminated marker).
  localStorage.setItem(
    storageKey(qrToken),
    JSON.stringify({ deviceToken, sessionId, customerName })
  );
}

// Writes a terminated marker without clearing the deviceToken.
// The deviceToken is preserved so validate_device() can be called on next load.
function markTerminated(qrToken: string, status: "ended" | "expired") {
  try {
    const raw = localStorage.getItem(storageKey(qrToken));
    if (raw) {
      const existing = JSON.parse(raw) as Partial<StoredSession>;
      localStorage.setItem(
        storageKey(qrToken),
        JSON.stringify({ ...existing, terminated: status })
      );
    }
    // If nothing is stored (shouldn't happen mid-session, but be safe), do nothing.
    // There is no point writing a terminated marker with no deviceToken.
  } catch { /* ignore */ }
}

function clearStored(qrToken: string) {
  localStorage.removeItem(storageKey(qrToken));
}

// Returns true when the page was opened by a genuine URL navigation
// (typed address bar, external QR scanner, link click, etc.) as opposed
// to a page refresh (F5 / pull-to-refresh) or browser back/forward.
//
// We use this to distinguish:
//   navigate → guest physically re-scanned the QR code → start fresh
//   reload   → guest just refreshed the ended/expired screen → keep showing it
//              (security: prevents refresh-to-rejoin bypassing staff termination)
function isFreshUrlNavigation(): boolean {
  try {
    // Performance Navigation Timing Level 2 (all modern browsers)
    const entries = performance.getEntriesByType("navigation");
    if (entries.length > 0) {
      return (entries[0] as PerformanceNavigationTiming).type === "navigate";
    }
    // Legacy fallback (IE9+, always present)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacyType = (performance as any).navigation?.type;
    if (legacyType !== undefined) return legacyType === 0; // 0 = TYPE_NAVIGATE
  } catch { /* ignore */ }
  // Unknown: assume fresh navigation (better UX for external scanner case)
  return true;
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
  if (msg.includes("TABLE_UNDER_MAINTENANCE"))
    return "This table is currently under maintenance. Please ask your server for assistance.";
  if (msg.includes("TABLE_NOT_FOUND"))
    return "This QR code is no longer active. Please ask your server for a new one.";
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

  // ─── Initialization ───────────────────────────────────────────────────────
  //
  // Priority order:
  //   1. terminated marker in localStorage → validate with server → terminal screen
  //   2. active stored session → validate with server → restore or show terminal screen
  //   3. nothing stored → name-entry screen

  useEffect(() => {
    if (!qrToken) {
      setSessionState("invalid");
      return;
    }

    let cancelled = false;

    async function init() {
      const stored = loadStored(qrToken);

      if (stored) {
        // ── Branch A: previously terminated session ───────────────────────
        // We have a terminated marker.
        //
        // FRESH NAVIGATION (external QR scan via Google Lens, Camera, etc.):
        // The guest physically re-scanned the QR code. This is a brand-new
        // visit. Clear the stale terminated state and treat it like Branch C
        // (no stored session). A genuine page refresh is `type === 'reload'`
        // and is handled below to keep the ended/expired screen visible —
        // preventing refresh-to-rejoin bypassing a staff-forced termination.
        if (stored.terminated && isFreshUrlNavigation()) {
          clearStored(qrToken);
          // Check maintenance before landing on name-entry (same as Branch C).
          const { data: tableRow } = await supabase
            .from("cafe_tables")
            .select("is_under_maintenance")
            .eq("qr_code_token", qrToken)
            .eq("is_active", true)
            .maybeSingle();
          if (cancelled) return;
          if (tableRow?.is_under_maintenance) {
            setSessionState("maintenance");
            return;
          }
          setSessionState("entering_name");
          return;
        }

        // PAGE REFRESH: validate with server so the server — not localStorage
        // — determines what terminal screen to show.
        if (stored.terminated) {
          const result = await rpcValidateDevice(stored.deviceToken);
          if (cancelled) return;

          if (result === null) {
            // Server has no record for this device (e.g. purged rows).
            // The session is definitively gone; clear everything and allow
            // the customer to start a fresh session.
            clearStored(qrToken);
            setSessionState("entering_name");
            return;
          }

          if (result.is_valid) {
            // Edge case: session was somehow reactivated after we marked it
            // terminated (extremely rare). Restore the active session.
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
            saveStored(qrToken, stored.deviceToken, stored.sessionId, result.customer_name);
            setSessionInfo(info);
            setSessionState("active");
            return;
          }

          // Server confirms the session is ended or expired.
          // Keep the terminated marker in storage so further refreshes also
          // land here and not on the name-entry screen.
          setSessionState(result.session_status === "ended" ? "ended" : "expired");
          return;
        }

        // ── Branch B: active stored session → validate ────────────────────
        const result = await rpcValidateDevice(stored.deviceToken);
        if (cancelled) return;

        if (result?.is_valid) {
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
          saveStored(qrToken, stored.deviceToken, stored.sessionId, result.customer_name);
          setSessionInfo(info);
          setSessionState("active");
          return;
        }

        // Server says invalid: write terminated marker and show terminal screen.
        const termStatus = result?.session_status === "ended" ? "ended" : "expired";
        markTerminated(qrToken, termStatus);
        setSessionState(termStatus);
        return;
      }

      // ── Branch C: nothing stored → check maintenance → name-entry ────
      // Reads is_under_maintenance directly (anon SELECT allowed by migration 035).
      const { data: tableRow } = await supabase
        .from("cafe_tables")
        .select("is_under_maintenance")
        .eq("qr_code_token", qrToken)
        .eq("is_active", true)
        .maybeSingle();

      if (cancelled) return;

      if (tableRow?.is_under_maintenance) {
        setSessionState("maintenance");
        return;
      }

      setSessionState("entering_name");
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken]);

  // ─── Session validity polling (heartbeat) ─────────────────────────────────

  useQuery({
    queryKey: ["validate_device", deviceToken],
    queryFn: async () => {
      if (!deviceToken) return null;
      const result = await rpcValidateDevice(deviceToken);

      if (!result) {
        markTerminated(qrToken, "expired");
        setSessionState("expired");
        return null;
      }

      if (!result.is_valid) {
        const termStatus = result.session_status === "ended" ? "ended" : "expired";
        markTerminated(qrToken, termStatus);
        setSessionState(termStatus);
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
          if (rec.status === "ended" || rec.status === "expired") {
            const termStatus = rec.status === "ended" ? "ended" : "expired";
            // Write terminated marker BEFORE updating state so a concurrent
            // refresh (extremely unlikely but possible) also hits Branch A.
            markTerminated(qrToken, termStatus);
            setSessionState(termStatus);
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

  // ─── Table orders ─────────────────────────────────────────────────────────

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

  // ─── startSession ─────────────────────────────────────────────────────────

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
        if (msg.includes("TABLE_UNDER_MAINTENANCE")) {
          setSessionState("maintenance");
          return;
        }
        setNameEntryError(mapRpcError(msg));
      } finally {
        setIsStartingSession(false);
      }
    },
    [qrToken]
  );

  // ─── resetToNameEntry ─────────────────────────────────────────────────────
  //
  // Exposed to the UI so ended/expired screens can offer a "Start new session"
  // button. This is the only legitimate path back to name-entry after a
  // session terminates — it requires a conscious user action, preventing
  // accidental or malicious refresh-to-rejoin.

  const resetToNameEntry = useCallback(() => {
    clearStored(qrToken);
    setSessionInfo(null);
    setNameEntryError(null);
    setBillRequested(false);
    setSessionState("entering_name");
  }, [qrToken]);

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
    resetToNameEntry,
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
