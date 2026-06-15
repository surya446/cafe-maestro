import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MenuCategory, MenuItem } from "@/types";
import { useAuth } from "./useAuth";

const CATEGORIES_KEY = (cafeId: string) => ["menu-categories", cafeId];
const ITEMS_KEY = (cafeId: string) => ["menu-items", cafeId];
const ARCHIVED_ITEMS_KEY = (cafeId: string) => ["menu-items-archived", cafeId];
const ORDER_HISTORY_KEY = (cafeId: string) => ["menu-item-order-history", cafeId];

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
      const unique = Array.from(new Set((data ?? []).map((r: { menu_item_id: string }) => r.menu_item_id)));
      return unique;
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useCreateCategory() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Omit<MenuCategory, "id" | "cafe_id" | "created_at" | "updated_at">
    ) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("menu_categories")
        .insert({ ...input, cafe_id: user.cafeId })
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
      const { error } = await supabase
        .from("menu_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY(user?.cafeId ?? "") });
      qc.invalidateQueries({ queryKey: ITEMS_KEY(user?.cafeId ?? "") });
    },
  });
}

export function useCreateMenuItem() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Omit<MenuItem, "id" | "cafe_id" | "created_at" | "updated_at" | "is_archived" | "menu_categories">
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
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ITEMS_KEY(user?.cafeId ?? "") }),
  });
}

export function useArchiveMenuItem() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log("[DIAG][ARCHIVE] STEP 2 — before DB update", { id });
      const { data, error } = await supabase
        .from("menu_items")
        .update({ is_archived: true, is_available: false })
        .eq("id", id)
        .select("id, name, is_available, is_archived, category_id")
        .single();
      if (error) throw error;
      console.log("[DIAG][ARCHIVE] STEP 2 — after DB update (returned row)", data);
    },
    onError: () => {},
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ITEMS_KEY(user?.cafeId ?? "") });
      qc.invalidateQueries({ queryKey: ARCHIVED_ITEMS_KEY(user?.cafeId ?? "") });
    },
  });
}

export function useRestoreMenuItem() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log("[DIAG][RESTORE] STEP 2 — before DB update", { id });
      const { data, error } = await supabase
        .from("menu_items")
        .update({ is_archived: false })
        .eq("id", id)
        .select("id, name, is_available, is_archived, category_id")
        .single();
      if (error) throw error;
      console.log("[DIAG][RESTORE] STEP 2 — after DB update (returned row)", data);
    },
    onError: () => {},
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ITEMS_KEY(user?.cafeId ?? "") });
      qc.invalidateQueries({ queryKey: ARCHIVED_ITEMS_KEY(user?.cafeId ?? "") });
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
