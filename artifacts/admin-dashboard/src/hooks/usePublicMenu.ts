import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { MenuCategory, MenuItem } from "@/types";

export interface PublicMenuCategory extends MenuCategory {
  items: MenuItem[];
}

/**
 * Fetches the public menu for a cafe:
 *   - Visible categories only (is_visible = true), ordered by position.
 *   - Available, non-archived items only (is_available = true, is_archived = false).
 *   - Categories that end up with zero items are omitted automatically.
 *   - A Supabase realtime subscription ensures the UI updates instantly when
 *     the admin toggles availability — no page refresh required.
 *
 * Does NOT require auth — uses the anon Supabase key.
 */
export function usePublicMenu(cafeId: string | null | undefined) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const query = useQuery({
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
          .eq("is_available", true)
          .order("position"),
      ]);

      if (catRes.error) throw catRes.error;
      if (itemRes.error) throw itemRes.error;

      const categories = (catRes.data ?? []) as MenuCategory[];
      const items = (itemRes.data ?? []) as MenuItem[];

      return categories
        .map((cat) => ({
          ...cat,
          items: items.filter((item) => item.category_id === cat.id),
        }))
        .filter((cat) => cat.items.length > 0);
    },
    enabled: !!cafeId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!cafeId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`public_menu_rt_${cafeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `cafe_id=eq.${cafeId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["public_menu", cafeId] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [cafeId, queryClient]);

  return query;
}
