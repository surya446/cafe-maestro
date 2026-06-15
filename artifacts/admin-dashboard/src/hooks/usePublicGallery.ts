import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { GalleryImage } from "@/types";

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
        .order("position");
      if (error) throw error;
      return (data ?? []) as GalleryImage[];
    },
    enabled: !!cafeId,
    staleTime: 60_000,
  });
}
