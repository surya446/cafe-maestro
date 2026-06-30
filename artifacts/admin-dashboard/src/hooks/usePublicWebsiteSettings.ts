import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { WebsiteSettings } from "@/types";

/**
 * Anon-safe version of useWebsiteSettings.
 * Uses the website_settings__public__select RLS policy
 * (active cafes readable without auth).
 */
export function usePublicWebsiteSettings(cafeId: string | null | undefined) {
  return useQuery({
    queryKey: ["public_website_settings", cafeId],
    queryFn: async (): Promise<WebsiteSettings | null> => {
      if (!cafeId) return null;
      const { data, error } = await supabase
        .from("website_settings")
        .select("*")
        .eq("cafe_id", cafeId)
        .maybeSingle<WebsiteSettings>();
      if (error) throw error;
      return data;
    },
    enabled: !!cafeId,
    staleTime: 60_000,
  });
}
