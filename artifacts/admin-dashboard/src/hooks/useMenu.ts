import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MenuCategory, MenuItem } from "@/types";
import { useAuth } from "./useAuth";

const CATEGORIES_KEY = (cafeId: string) => ["menu-categories", cafeId];
const ITEMS_KEY = (cafeId: string) => ["menu-items", cafeId];
const ARCHIVED_ITEMS_KEY = (cafeId: string) => ["menu-items-archived", cafeId];
const ORDER_HISTORY_KEY = (cafeId: string) => ["menu-item-order-history", cafeId];

// ─── Shared helper ────────────────────────────────────────────────────────────
/**
 * Returns the ID of the "Archived Items" system category for a given cafe.
 * Creates the category if it is somehow missing (defensive; the migration
 * should have created it for every existing cafe).
 */
export async function getArchivedCategoryId(cafeId: string): Promise<string> {
  const { data } = await supabase
    .from("menu_categories")
    .select("id")
    .eq("cafe_id", cafeId)
    .eq("is_system", true)
    .limit(1)
    .maybeSingle();

  if (data?.id) return data.id;

  // Defensive fallback — create if missing
  const { data: created, error } = await supabase
    .from("menu_categories")
    .insert({
      cafe_id: cafeId,
      name: "Archived Items",
      description:
        "System category. Holds archived menu items that have order history, " +
        "preserving data integrity without blocking deletion of normal categories.",
      position: 999999,
      is_visible: false,
      is_system: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useMenuCategories() {
  const { user } = useAuth();

  return useQuery({
    queryKey: CATEGORIES_KEY(user?.cafeId ?? ""),
    queryFn: async (): Promise<MenuCategory[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("cafe_id", user.cafeId)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useMenuItems() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ITEMS_KEY(user?.cafeId ?? ""),
    queryFn: async (): Promise<MenuItem[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("menu_items")
        .select("*, menu_categories(id, name)")
        .eq("cafe_id", user.cafeId)
        .eq("is_archived", false)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useArchivedMenuItems() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ARCHIVED_ITEMS_KEY(user?.cafeId ?? ""),
    queryFn: async (): Promise<MenuItem[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("menu_items")
        .select("*, menu_categories(id, name)")
        .eq("cafe_id", user.cafeId)
        .eq("is_archived", true)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useMenuItemOrderHistory() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ORDER_HISTORY_KEY(user?.cafeId ?? ""),
    queryFn: async (): Promise<string[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("order_items")
        .select("menu_item_id")
        .eq("cafe_id", user.cafeId);
      if (error) throw error;
      const unique = Array.from(
        new Set((data ?? []).map((r: { menu_item_id: string }) => r.menu_item_id))
      );
      return unique;
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

// ─── Category mutations ───────────────────────────────────────────────────────

export function useCreateCategory() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Omit<MenuCategory, "id" | "cafe_id" | "is_system" | "created_at" | "updated_at">
    ) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("menu_categories")
        .insert({ ...input, cafe_id: user.cafeId, is_system: false })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY(user?.cafeId ?? "") }),
  });
}

export function useUpdateCategory() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<MenuCategory> & { id: string }) => {
      // Guard: system categories cannot be modified
      const { data: cat } = await supabase
        .from("menu_categories")
        .select("is_system")
        .eq("id", id)
        .maybeSingle();
      if (cat?.is_system) {
        const err = new Error("System categories cannot be modified.") as Error & {
          code: string;
        };
        err.code = "SYSTEM_CATEGORY";
        throw err;
      }

      const { data, error } = await supabase
        .from("menu_categories")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY(user?.cafeId ?? "") }),
  });
}

export function useDeleteCategory() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Guard: system categories cannot be deleted
      const { data: cat } = await supabase
        .from("menu_categories")
        .select("is_system")
        .eq("id", id)
        .maybeSingle();
      if (cat?.is_system) {
        const err = new Error("System categories cannot be deleted.") as Error & {
          code: string;
        };
        err.code = "SYSTEM_CATEGORY";
        throw err;
      }

      // Guard: block if any active (non-archived) items still belong to this category.
      // Archived items are automatically moved to "Archived Items" on archive, so any
      // remaining items here are active and block deletion.
      const { data: activeItems, error: itemsError } = await supabase
        .from("menu_items")
        .select("id")
        .eq("category_id", id)
        .eq("is_archived", false)
        .limit(1);
      if (itemsError) throw itemsError;

      if (activeItems && activeItems.length > 0) {
        const err = new Error(
          "This category still contains active menu items."
        ) as Error & { code: string };
        err.code = "CATEGORY_HAS_ITEMS";
        throw err;
      }

      // Safe to delete — no active items remain.
      // (Any archived items should already be in "Archived Items"; if somehow any
      // remain here and have order history, the DB will throw 23503 which the UI
      // catches and surfaces.)
      const { error } = await supabase
        .from("menu_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY(user?.cafeId ?? "") });
      qc.invalidateQueries({ queryKey: ITEMS_KEY(user?.cafeId ?? "") });
      qc.invalidateQueries({ queryKey: ARCHIVED_ITEMS_KEY(user?.cafeId ?? "") });
    },
  });
}

// ─── Item mutations ───────────────────────────────────────────────────────────

export function useCreateMenuItem() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Omit<
        MenuItem,
        "id" | "cafe_id" | "created_at" | "updated_at" | "is_archived" | "menu_categories"
      >
    ) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("menu_items")
        .insert({ ...input, cafe_id: user.cafeId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ITEMS_KEY(user?.cafeId ?? "") }),
  });
}

export function useUpdateMenuItem() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<MenuItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("menu_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ITEMS_KEY(user?.cafeId ?? "") }),
  });
}

export function useDeleteMenuItem() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onError: () => {},
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ITEMS_KEY(user?.cafeId ?? "") });
      qc.invalidateQueries({ queryKey: ARCHIVED_ITEMS_KEY(user?.cafeId ?? "") });
    },
  });
}

export function useArchiveMenuItem() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      // Move the item into the "Archived Items" system category so that its
      // original category can be deleted without hitting the FK RESTRICT on
      // order_items.menu_item_id.
      const archivedCategoryId = await getArchivedCategoryId(user.cafeId);
      const { error } = await supabase
        .from("menu_items")
        .update({
          is_archived: true,
          is_available: false,
          category_id: archivedCategoryId,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onError: () => {},
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ITEMS_KEY(user?.cafeId ?? "") });
      qc.invalidateQueries({ queryKey: ARCHIVED_ITEMS_KEY(user?.cafeId ?? "") });
      // Category item counts change when an item moves to Archived Items
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY(user?.cafeId ?? "") });
    },
  });
}

export function useRestoreMenuItem() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    /**
     * Restores an archived item into the specified destination category.
     * The admin must explicitly choose a valid active category — items are
     * never automatically restored back into "Archived Items".
     */
    mutationFn: async ({
      id,
      category_id,
    }: {
      id: string;
      category_id: string;
    }) => {
      const { error } = await supabase
        .from("menu_items")
        .update({ is_archived: false, category_id })
        .eq("id", id);
      if (error) throw error;
    },
    onError: () => {},
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ITEMS_KEY(user?.cafeId ?? "") });
      qc.invalidateQueries({ queryKey: ARCHIVED_ITEMS_KEY(user?.cafeId ?? "") });
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY(user?.cafeId ?? "") });
    },
  });
}

export function useToggleItemAvailability() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      is_available,
    }: {
      id: string;
      is_available: boolean;
    }) => {
      const { error } = await supabase
        .from("menu_items")
        .update({ is_available })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, is_available }) => {
      await qc.cancelQueries({ queryKey: ITEMS_KEY(user?.cafeId ?? "") });
      const prev = qc.getQueryData<MenuItem[]>(ITEMS_KEY(user?.cafeId ?? ""));
      qc.setQueryData<MenuItem[]>(ITEMS_KEY(user?.cafeId ?? ""), (old) =>
        old?.map((item) =>
          item.id === id ? { ...item, is_available } : item
        ) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev)
        qc.setQueryData(ITEMS_KEY(user?.cafeId ?? ""), ctx.prev);
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: ITEMS_KEY(user?.cafeId ?? "") }),
  });
}
