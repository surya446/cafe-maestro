import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { GalleryImage } from "@/types";

/**
 * Anon-safe: fetches visible gallery images for a cafe.
 * Relies on the `gallery_images_public_read` RLS policy:
 *   is_visible = true
 */
export function usePublicGallery(cafeId: string | null | undefined) {
  return useQuery({
    queryKey: ["public_gallery", cafeId],
    queryFn: async (): Promise<GalleryImage[]> => {
      if (!cafeId) return [];
      const { data, error } = await supabase
        .from("gallery_images")
        .select("*")
        .eq("cafe_id", cafeId)
        .eq("is_visible", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GalleryImage[];
    },
    enabled: !!cafeId,
    staleTime: 60_000,
  });
}
