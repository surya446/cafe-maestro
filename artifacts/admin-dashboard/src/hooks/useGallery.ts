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
        .order("position");
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
    mutationFn: async (input: {
      url: string;
      storage_path: string;
      caption?: string;
      alt_text?: string;
      position?: number;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data: existing } = await supabase
        .from("gallery_images")
        .select("position")
        .eq("cafe_id", user.cafeId)
        .order("position", { ascending: false })
        .limit(1)
        .single();

      const nextPosition = (existing?.position ?? 0) + 1;

      const { data, error } = await supabase
        .from("gallery_images")
        .insert({
          cafe_id: user.cafeId,
          url: input.url,
          storage_path: input.storage_path,
          caption: input.caption ?? null,
          alt_text: input.alt_text ?? null,
          position: input.position ?? nextPosition,
          is_visible: true,
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
    mutationFn: async (file: File): Promise<{ publicUrl: string; path: string }> => {
      if (!user) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop();
      const path = `${user.cafeId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("gallery")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("gallery").getPublicUrl(path);
      return { publicUrl: data.publicUrl, path };
    },
  });
}
