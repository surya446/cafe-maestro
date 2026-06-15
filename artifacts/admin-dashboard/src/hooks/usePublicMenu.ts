import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MenuCategory, MenuItem } from "@/types";

export interface PublicMenuCategory extends MenuCategory {
  items: MenuItem[];
}

/**
 * Fetches the public menu for a cafe:
 *   - All VISIBLE categories (is_visible = true), ordered by position
 *   - All items per category — including out-of-stock (is_available = false)
 *     so the public website can show them with a badge.
 *   - Hidden items (is_visible == false) have no flag on MenuItem, so we
 *     rely on the admin not showing them; the DB returns all items for active
 *     cafes per the menu_items__website__select policy.
 *
 * Does NOT require auth — uses the anon Supabase key.
 */
export function usePublicMenu(cafeId: string | null | undefined) {
  return useQuery({
    queryKey: ["public_menu", cafeId],
    queryFn: async (): Promise<PublicMenuCategory[]> => {
      if (!cafeId) return [];

      const [catRes, itemRes] = await Promise.all([
        supabase
          .from("menu_categories")
          .select("*")
          .eq("cafe_id", cafeId)
          .eq("is_visible", true)
          .order("position"),

        supabase
          .from("menu_items")
          .select("*")
          .eq("cafe_id", cafeId)
          .eq("is_archived", false)
          .order("position"),
      ]);

      if (catRes.error) throw catRes.error;
      if (itemRes.error) throw itemRes.error;

      const categories = (catRes.data ?? []) as MenuCategory[];
      const items = (itemRes.data ?? []) as MenuItem[];

      return categories.map((cat) => ({
        ...cat,
        items: items.filter((item) => item.category_id === cat.id),
      }));
    },
    enabled: !!cafeId,
    staleTime: 60_000,
  });
}
