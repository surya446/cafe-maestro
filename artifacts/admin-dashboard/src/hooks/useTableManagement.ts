import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

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

const TABLE_QUERY_KEY = ["managed_tables"];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTableManagement() {
  const qc = useQueryClient();
  const { user } = useAuth();

  // ── All tables (active + archived) ─────────────────────────────────────────
  const { data: tables = [], isLoading } = useQuery<ManagedTable[]>({
    queryKey: TABLE_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cafe_tables")
        .select("*")
        .order("number", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((t: any) => ({
        id:           t.id,
        cafeId:       t.cafe_id,
        number:       t.number,
        name:         t.name ?? "",
        capacity:     t.capacity ?? 2,
        section:      t.section ?? null,
        displayOrder: t.display_order ?? t.number,
        qrCodeToken:  t.qr_code_token ?? null,
        isActive:     t.is_active,
        createdAt:    t.created_at,
        updatedAt:    t.updated_at,
      }));
    },
    staleTime: 30_000,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: TABLE_QUERY_KEY });
    qc.invalidateQueries({ queryKey: ["staff_tables"] });
  }

  // ── Create table ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (input: CreateTableInput) => {
      if (!user?.cafeId) throw new Error("Not authenticated");
      const token = crypto.randomUUID();

      // Try inserting with optional columns first; fall back if columns
      // don't exist yet (migration 034 not yet applied).
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
        const isColumnMissing =
          msg.includes("display_order") || msg.includes("section");
        if (isColumnMissing) {
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

  // ── Update table ─────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateTableInput;
    }) => {
      const patch: Record<string, unknown> = {};
      if (input.name      !== undefined) patch.name     = input.name?.trim();
      if (input.capacity  !== undefined) patch.capacity = input.capacity;
      if (input.number    !== undefined) patch.number   = input.number;

      const patchWithOptional = { ...patch };
      if (input.section      !== undefined) patchWithOptional.section       = input.section?.trim() || null;
      if (input.displayOrder !== undefined) patchWithOptional.display_order = input.displayOrder;

      let { error } = await supabase
        .from("cafe_tables")
        .update(patchWithOptional)
        .eq("id", id);

      // Retry without optional columns if migration 034 not yet applied
      if (error) {
        const msg = error.message ?? "";
        if (msg.includes("display_order") || msg.includes("section")) {
          const fallback = await supabase
            .from("cafe_tables")
            .update(patch)
            .eq("id", id);
          error = fallback.error;
        }
      }

      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ── Archive (soft-delete) ──────────────────────────────────────────────────
  const archiveMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const { error } = await supabase
        .from("cafe_tables")
        .update({ is_active: false })
        .eq("id", tableId);
      if (error) throw error;
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

  // ── Derive active / archived splits ──────────────────────────────────────
  const activeTables   = tables.filter((t) => t.isActive);
  const archivedTables = tables.filter((t) => !t.isActive);

  const nextNumber: number =
    tables.length > 0
      ? Math.max(...tables.map((t) => t.number)) + 1
      : 1;

  return {
    tables,
    activeTables,
    archivedTables,
    isLoading,
    nextNumber,

    createTable:        createMutation.mutateAsync,
    isCreating:         createMutation.isPending,

    updateTable:        updateMutation.mutateAsync,
    isUpdating:         updateMutation.isPending,
    updatingTableId:    (updateMutation.variables as { id: string } | undefined)?.id,

    archiveTable:       archiveMutation.mutateAsync,
    isArchiving:        archiveMutation.isPending,
    archivingTableId:   archiveMutation.variables as string | undefined,

    restoreTable:       restoreMutation.mutateAsync,
    isRestoring:        restoreMutation.isPending,
    restoringTableId:   restoreMutation.variables as string | undefined,

    regenerateQr:       regenerateQrMutation.mutateAsync,
    isRegeneratingQr:   regenerateQrMutation.isPending,
    regeneratingTableId: regenerateQrMutation.variables as string | undefined,
  };
}
