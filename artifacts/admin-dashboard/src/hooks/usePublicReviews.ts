import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Review } from "@/types";

/**
 * Anon-safe: fetches approved (visible) reviews for a cafe.
 * Relies on the `reviews_public_read` RLS policy:
 *   is_visible = true
 */
export function usePublicReviews(cafeId: string | null | undefined) {
  return useQuery({
    queryKey: ["public_reviews", cafeId],
    queryFn: async (): Promise<Review[]> => {
      if (!cafeId) return [];
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("cafe_id", cafeId)
        .eq("is_visible", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Review[];
    },
    enabled: !!cafeId,
    staleTime: 60_000,
  });
}
