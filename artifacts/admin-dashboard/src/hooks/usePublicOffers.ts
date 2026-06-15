import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Offer } from "@/types";

/**
 * Anon-safe: fetches active, public offers for a cafe.
 * Relies on the `offers_public_read` RLS policy:
 *   is_active = true AND is_public = true
 */
export function usePublicOffers(cafeId: string | null | undefined) {
  return useQuery({
    queryKey: ["public_offers", cafeId],
    queryFn: async (): Promise<Offer[]> => {
      if (!cafeId) return [];
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .eq("cafe_id", cafeId)
        .eq("is_active", true)
        .eq("is_public", true)
        .or(`valid_until.is.null,valid_until.gte.${today}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Offer[];
    },
    enabled: !!cafeId,
    staleTime: 60_000,
  });
}
