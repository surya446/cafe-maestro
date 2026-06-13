import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { GalleryImage } from "@/types";
import { useAuth } from "./useAuth";

const GALLERY_KEY = (cafeId: string) => ["gallery", cafeId];

export function useGallery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: GALLERY_KEY(user?.cafeId ?? ""),
    queryFn: async (): Promise<GalleryImage[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("gallery_images")
        .select("*")
        .eq("cafe_id", user.cafeId)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useAddGalleryImage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { url: string; caption?: string; display_order?: number }) => {
      if (!user) throw new Error("Not authenticated");
      const { data: existing } = await supabase
        .from("gallery_images")
        .select("display_order")
        .eq("cafe_id", user.cafeId)
        .order("display_order", { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (existing?.display_order ?? 0) + 1;

      const { data, error } = await supabase
        .from("gallery_images")
        .insert({
          cafe_id: user.cafeId,
          url: input.url,
          caption: input.caption ?? null,
          display_order: input.display_order ?? nextOrder,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: GALLERY_KEY(user?.cafeId ?? "") }),
  });
}

export function useUpdateGalleryImage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<GalleryImage> & { id: string }) => {
      const { data, error } = await supabase
        .from("gallery_images")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: GALLERY_KEY(user?.cafeId ?? "") }),
  });
}

export function useDeleteGalleryImage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("gallery_images")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: GALLERY_KEY(user?.cafeId ?? "") }),
  });
}

export function useUploadGalleryImage() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      if (!user) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop();
      const path = `${user.cafeId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("gallery")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("gallery").getPublicUrl(path);
      return data.publicUrl;
    },
  });
}
