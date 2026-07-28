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
      // Always place new items at the bottom of their category so they never
      // displace existing items. Query the current max position and add 1.
      const { data: maxRow } = await supabase
        .from("menu_items")
        .select("position")
        .eq("cafe_id", user.cafeId)
        .eq("category_id", input.category_id)
        .eq("is_archived", false)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextPosition = (maxRow?.position ?? -1) + 1;
      const { data, error } = await supabase
        .from("menu_items")
        .insert({ ...input, cafe_id: user.cafeId, position: nextPosition })
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
      if (!user) throw new Error("Not authenticated");
      // Strip position unconditionally: editing an item must NEVER change its
      // display order. Position is only modified via useMoveMenuItem.
      const { position: _stripped, ...safeUpdates } = updates;
      let finalUpdates: Partial<MenuItem> = safeUpdates;

      // If the item is being moved to a different category, place it at the
      // bottom of the destination category so it does not displace existing items.
      if (safeUpdates.category_id !== undefined) {
        const { data: current } = await supabase
          .from("menu_items")
          .select("category_id")
          .eq("id", id)
          .maybeSingle();
        if (current && current.category_id !== safeUpdates.category_id) {
          const { data: maxRow } = await supabase
            .from("menu_items")
            .select("position")
            .eq("cafe_id", user.cafeId)
            .eq("category_id", safeUpdates.category_id)
            .eq("is_archived", false)
            .order("position", { ascending: false })
            .limit(1)
            .maybeSingle();
          finalUpdates = { ...safeUpdates, position: (maxRow?.position ?? -1) + 1 };
        }
      }

      const { data, error } = await supabase
        .from("menu_items")
        .update(finalUpdates)
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
      if (!user) throw new Error("Not authenticated");
      // Place the restored item at the bottom of the destination category.
      const { data: maxRow } = await supabase
        .from("menu_items")
        .select("position")
        .eq("cafe_id", user.cafeId)
        .eq("category_id", category_id)
        .eq("is_archived", false)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await supabase
        .from("menu_items")
        .update({ is_archived: false, category_id, position: (maxRow?.position ?? -1) + 1 })
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

// ─── Move item within its category ───────────────────────────────────────────
// Reorders items within a single category by swapping or repositioning one item.
// Accepts all items in the category (sorted by position); computes the new order
// and batch-updates only the rows whose position value actually changed.
// Optimistic update: cache is rewritten immediately for instant UI feedback.
export function useMoveMenuItem() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      direction,
      categoryItems,
    }: {
      id: string;
      direction: "up" | "down" | "top" | "bottom";
      categoryItems: MenuItem[];
    }) => {
      if (!user) throw new Error("Not authenticated");

      const sorted = [...categoryItems].sort((a, b) => a.position - b.position);
      const idx = sorted.findIndex((i) => i.id === id);
      if (idx === -1) return;

      const ordered = [...sorted];
      if (direction === "up") {
        if (idx === 0) return;
        [ordered[idx - 1], ordered[idx]] = [ordered[idx], ordered[idx - 1]];
      } else if (direction === "down") {
        if (idx === ordered.length - 1) return;
        [ordered[idx + 1], ordered[idx]] = [ordered[idx], ordered[idx + 1]];
      } else if (direction === "top") {
        if (idx === 0) return;
        const [item] = ordered.splice(idx, 1);
        ordered.unshift(item);
      } else {
        if (idx === ordered.length - 1) return;
        const [item] = ordered.splice(idx, 1);
        ordered.push(item);
      }

      // Assign sequential positions 0..n-1; only write rows that changed.
      const updates = ordered
        .map((item, pos) => ({ id: item.id, position: pos }))
        .filter((u, i) => u.position !== sorted[i].position);

      if (updates.length === 0) return;

      await Promise.all(
        updates.map(({ id: itemId, position }) =>
          supabase.from("menu_items").update({ position }).eq("id", itemId)
        )
      );
    },

    onMutate: async ({ id, direction, categoryItems }) => {
      const cafeId = user?.cafeId ?? "";
      await qc.cancelQueries({ queryKey: ITEMS_KEY(cafeId) });
      const prev = qc.getQueryData<MenuItem[]>(ITEMS_KEY(cafeId));

      const sorted = [...categoryItems].sort((a, b) => a.position - b.position);
      const idx = sorted.findIndex((i) => i.id === id);
      if (idx === -1) return { prev };

      const ordered = [...sorted];
      if (direction === "up" && idx > 0) {
        [ordered[idx - 1], ordered[idx]] = [ordered[idx], ordered[idx - 1]];
      } else if (direction === "down" && idx < ordered.length - 1) {
        [ordered[idx + 1], ordered[idx]] = [ordered[idx], ordered[idx + 1]];
      } else if (direction === "top" && idx > 0) {
        const [item] = ordered.splice(idx, 1);
        ordered.unshift(item);
      } else if (direction === "bottom" && idx < ordered.length - 1) {
        const [item] = ordered.splice(idx, 1);
        ordered.push(item);
      }

      const posMap = new Map<string, number>(ordered.map((item, i) => [item.id, i]));

      qc.setQueryData<MenuItem[]>(ITEMS_KEY(cafeId), (old) =>
        (old ?? [])
          .map((item) =>
            posMap.has(item.id) ? { ...item, position: posMap.get(item.id)! } : item
          )
          .sort((a, b) => a.position - b.position)
      );

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ITEMS_KEY(user?.cafeId ?? ""), ctx.prev);
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: ITEMS_KEY(user?.cafeId ?? "") }),
  });
}

// ─── Normalize positions ──────────────────────────────────────────────────────
// Detects items whose positions are not unique within their category (the common
// case when all rows defaulted to position=0) and assigns sequential 0-based
// positions sorted by (current position, created_at).  Only the rows that
// actually need updating are written.  Called once on MenuPage mount.
export function useNormalizeMenuPositions() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (items: MenuItem[]) => {
      if (!user || items.length === 0) return;

      // Group by category
      const catMap = new Map<string, MenuItem[]>();
      for (const item of items) {
        const list = catMap.get(item.category_id) ?? [];
        list.push(item);
        catMap.set(item.category_id, list);
      }

      const updates: Array<{ id: string; position: number }> = [];
      for (const catList of catMap.values()) {
        const positions = catList.map((i) => i.position);
        if (new Set(positions).size === positions.length) continue; // already unique

        const sorted = [...catList].sort(
          (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)
        );
        sorted.forEach((item, idx) => {
          if (item.position !== idx) updates.push({ id: item.id, position: idx });
        });
      }

      if (updates.length === 0) return;

      await Promise.all(
        updates.map(({ id, position }) =>
          supabase.from("menu_items").update({ position }).eq("id", id)
        )
      );
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ITEMS_KEY(user?.cafeId ?? "") }),
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
