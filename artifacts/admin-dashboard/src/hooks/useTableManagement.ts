import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TableStatus = "free" | "busy" | "booked" | "maintenance" | "archived";

export interface TodayBooking {
  id: string;
  guestName: string;
  partySize: number;
  bookingTime: string;
  status: string;
}

export interface ManagedTable {
  id: string;
  cafeId: string;
  number: number;
  name: string;
  capacity: number;
  section: string | null;
  displayOrder: number;
  qrCodeToken: string | null;
  isActive: boolean;
  isUnderMaintenance: boolean;
  status: TableStatus;
  todayBookings: TodayBooking[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTableInput {
  name: string;
  capacity: number;
  section?: string;
  displayOrder: number;
  number: number;
}

export interface UpdateTableInput {
  name?: string;
  capacity?: number;
  section?: string | null;
  displayOrder?: number;
  number?: number;
}

// ─── Status derivation ────────────────────────────────────────────────────────
//
// Priority: archived > maintenance > busy > booked > free
// Only one state is active at a time.

function deriveStatus(
  t: { is_active: boolean; is_under_maintenance?: boolean; id: string },
  activeSessionTableIds: Set<string>,
  bookingsByTable: Map<string, TodayBooking[]>
): TableStatus {
  if (!t.is_active) return "archived";
  if (t.is_under_maintenance) return "maintenance";
  if (activeSessionTableIds.has(t.id)) return "busy";
  const bookings = bookingsByTable.get(t.id) ?? [];
  if (bookings.some((b) => b.status === "confirmed")) return "booked";
  return "free";
}

const TABLE_QUERY_KEY = ["managed_tables", "v2"];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTableManagement() {
  const qc = useQueryClient();
  const { user } = useAuth();

  // ── Combined data fetch: tables + active sessions + today's bookings ────────
  const { data: tables = [], isLoading } = useQuery<ManagedTable[]>({
    queryKey: TABLE_QUERY_KEY,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      const [tablesRes, sessionsRes, bookingsRes] = await Promise.all([
        supabase
          .from("cafe_tables")
          .select("*")
          .order("number", { ascending: true }),
        supabase
          .from("table_sessions")
          .select("table_id")
          .eq("status", "active"),
        supabase
          .from("bookings")
          .select("id, table_id, name, party_size, booking_time, status")
          .eq("booking_date", today)
          .in("status", ["confirmed", "pending"])
          .not("table_id", "is", null),
      ]);

      if (tablesRes.error) throw tablesRes.error;

      const activeTableIds = new Set<string>(
        (sessionsRes.data ?? []).map((s: any) => s.table_id as string)
      );

      const bookingsByTable = new Map<string, TodayBooking[]>();
      for (const b of bookingsRes.data ?? []) {
        if (!b.table_id) continue;
        if (!bookingsByTable.has(b.table_id)) bookingsByTable.set(b.table_id, []);
        bookingsByTable.get(b.table_id)!.push({
          id:          b.id,
          guestName:   b.name,
          partySize:   b.party_size,
          bookingTime: b.booking_time,
          status:      b.status,
        });
      }

      return (tablesRes.data ?? []).map((t: any): ManagedTable => ({
        id:                 t.id,
        cafeId:             t.cafe_id,
        number:             t.number,
        name:               t.name ?? "",
        capacity:           t.capacity ?? 2,
        section:            t.section ?? null,
        displayOrder:       t.display_order ?? t.number,
        qrCodeToken:        t.qr_code_token ?? null,
        isActive:           t.is_active,
        isUnderMaintenance: t.is_under_maintenance ?? false,
        status:             deriveStatus(t, activeTableIds, bookingsByTable),
        todayBookings:      bookingsByTable.get(t.id) ?? [],
        createdAt:          t.created_at,
        updatedAt:          t.updated_at,
      }));
    },
    staleTime: 20_000,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["managed_tables"] });
    qc.invalidateQueries({ queryKey: ["staff_tables"] });
  }

  // ── Real-time subscriptions ──────────────────────────────────────────────────
  // Subscribes to cafe_tables, table_sessions, and bookings so all three
  // status-driving signals push updates immediately to the dashboard.
  //
  // Channel name includes a per-mount UUID so that React StrictMode's
  // double-invoke (mount → cleanup → mount) never collides with the previous
  // channel before Supabase finishes tearing it down.  All .on() listeners
  // are registered before .subscribe() — the only correct ordering.
  useEffect(() => {
    if (!user?.cafeId) return;

    const cafeId = user.cafeId;
    const channelName = `table-management-rt-${cafeId}-${crypto.randomUUID()}`;

    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cafe_tables", filter: `cafe_id=eq.${cafeId}` },
        () => { qc.invalidateQueries({ queryKey: TABLE_QUERY_KEY }); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_sessions", filter: `cafe_id=eq.${cafeId}` },
        () => { qc.invalidateQueries({ queryKey: TABLE_QUERY_KEY }); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `cafe_id=eq.${cafeId}` },
        () => { qc.invalidateQueries({ queryKey: TABLE_QUERY_KEY }); }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user?.cafeId]); // qc from useQueryClient() is stable — intentionally omitted

  // ── Create table ───────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (input: CreateTableInput) => {
      if (!user?.cafeId) throw new Error("Not authenticated");
      const token = crypto.randomUUID();

      let result = await supabase
        .from("cafe_tables")
        .insert({
          cafe_id:       user.cafeId,
          number:        input.number,
          name:          input.name.trim(),
          capacity:      input.capacity,
          section:       input.section?.trim() || null,
          display_order: input.displayOrder,
          qr_code_token: token,
          is_active:     true,
        })
        .select()
        .single();

      if (result.error) {
        const msg = result.error.message ?? "";
        if (msg.includes("display_order") || msg.includes("section")) {
          result = await supabase
            .from("cafe_tables")
            .insert({
              cafe_id:       user.cafeId,
              number:        input.number,
              name:          input.name.trim(),
              capacity:      input.capacity,
              qr_code_token: token,
              is_active:     true,
            })
            .select()
            .single();
        }
      }

      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: invalidate,
  });

  // ── Update table ───────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTableInput }) => {
      const patch: Record<string, unknown> = {};
      if (input.name     !== undefined) patch.name     = input.name?.trim();
      if (input.capacity !== undefined) patch.capacity = input.capacity;
      if (input.number   !== undefined) patch.number   = input.number;

      const patchFull = { ...patch };
      if (input.section      !== undefined) patchFull.section       = input.section?.trim() || null;
      if (input.displayOrder !== undefined) patchFull.display_order = input.displayOrder;

      let { error } = await supabase.from("cafe_tables").update(patchFull).eq("id", id);
      if (error) {
        const msg = error.message ?? "";
        if (msg.includes("display_order") || msg.includes("section")) {
          const fallback = await supabase.from("cafe_tables").update(patch).eq("id", id);
          error = fallback.error;
        }
      }
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ── Toggle maintenance ─────────────────────────────────────────────────────
  const toggleMaintenanceMutation = useMutation({
    mutationFn: async ({ tableId, maintenance }: { tableId: string; maintenance: boolean }) => {
      const { error } = await supabase
        .from("cafe_tables")
        .update({ is_under_maintenance: maintenance })
        .eq("id", tableId);
      if (error) {
        if ((error.message ?? "").includes("is_under_maintenance")) {
          throw new Error("Database migration 035 is required. Please apply it in Supabase.");
        }
        throw error;
      }
    },
    onSuccess: invalidate,
  });

  // ── Archive (soft-delete) — also clears maintenance flag ───────────────────
  const archiveMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const { error } = await supabase
        .from("cafe_tables")
        .update({ is_active: false, is_under_maintenance: false })
        .eq("id", tableId);
      if (error) {
        if ((error.message ?? "").includes("is_under_maintenance")) {
          const fallback = await supabase
            .from("cafe_tables")
            .update({ is_active: false })
            .eq("id", tableId);
          if (fallback.error) throw fallback.error;
          return;
        }
        throw error;
      }
    },
    onSuccess: invalidate,
  });

  // ── Restore ────────────────────────────────────────────────────────────────
  const restoreMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const { error } = await supabase
        .from("cafe_tables")
        .update({ is_active: true })
        .eq("id", tableId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ── Permanent delete ───────────────────────────────────────────────────────
  // Only allowed when no historical records reference this table.
  // Throws an error with { orders, sessions, bookings } counts if blocked.
  const permanentDeleteMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const [ordersRes, sessionsRes, bookingsRes] = await Promise.all([
        supabase.from("orders")        .select("id", { count: "exact", head: true }).eq("table_id", tableId),
        supabase.from("table_sessions").select("id", { count: "exact", head: true }).eq("table_id", tableId),
        supabase.from("bookings")      .select("id", { count: "exact", head: true }).eq("table_id", tableId),
      ]);

      const oc = ordersRes.count   ?? 0;
      const sc = sessionsRes.count ?? 0;
      const bc = bookingsRes.count ?? 0;

      if (oc > 0 || sc > 0 || bc > 0) {
        const err = Object.assign(new Error("HAS_REFERENCES"), { orders: oc, sessions: sc, bookings: bc });
        throw err;
      }

      const { error } = await supabase.from("cafe_tables").delete().eq("id", tableId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ── Regenerate QR ─────────────────────────────────────────────────────────
  const regenerateQrMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const newToken = crypto.randomUUID();
      const { error } = await supabase
        .from("cafe_tables")
        .update({ qr_code_token: newToken })
        .eq("id", tableId);
      if (error) throw error;
      return newToken;
    },
    onSuccess: invalidate,
  });

  const activeTables   = tables.filter((t) =>  t.isActive);
  const archivedTables = tables.filter((t) => !t.isActive);
  const nextNumber     = tables.length > 0 ? Math.max(...tables.map((t) => t.number)) + 1 : 1;

  return {
    tables,
    activeTables,
    archivedTables,
    isLoading,
    nextNumber,

    createTable:          createMutation.mutateAsync,
    isCreating:           createMutation.isPending,

    updateTable:          updateMutation.mutateAsync,
    isUpdating:           updateMutation.isPending,
    updatingTableId:      (updateMutation.variables as { id: string } | undefined)?.id,

    toggleMaintenance:      toggleMaintenanceMutation.mutateAsync,
    isTogglingMaintenance:  toggleMaintenanceMutation.isPending,
    togglingMaintenanceId:  (toggleMaintenanceMutation.variables as { tableId: string } | undefined)?.tableId,

    archiveTable:         archiveMutation.mutateAsync,
    isArchiving:          archiveMutation.isPending,
    archivingTableId:     archiveMutation.variables as string | undefined,

    restoreTable:         restoreMutation.mutateAsync,
    isRestoring:          restoreMutation.isPending,
    restoringTableId:     restoreMutation.variables as string | undefined,

    permanentDelete:        permanentDeleteMutation.mutateAsync,
    isDeletingPermanent:    permanentDeleteMutation.isPending,
    deletingPermanentId:    permanentDeleteMutation.variables as string | undefined,

    regenerateQr:         regenerateQrMutation.mutateAsync,
    isRegeneratingQr:     regenerateQrMutation.isPending,
    regeneratingTableId:  regenerateQrMutation.variables as string | undefined,
  };
}
