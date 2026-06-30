import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { WebsiteSettings } from "@/types";
import { useAuth } from "./useAuth";

const KEY = (cafeId: string) => ["website_settings", cafeId];

export function useWebsiteSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: KEY(user?.cafeId ?? ""),
    queryFn: async (): Promise<WebsiteSettings | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("website_settings")
        .select("*")
        .eq("cafe_id", user.cafeId)
        .maybeSingle<WebsiteSettings>();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useUpsertWebsiteSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<WebsiteSettings, "id" | "created_at" | "updated_at">>) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("website_settings")
        .upsert(
          { cafe_id: user.cafeId, ...updates },
          { onConflict: "cafe_id" },
        )
        .select()
        .single<WebsiteSettings>();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(user?.cafeId ?? "") }),
  });
}

export function useUploadWebsiteImage() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      file,
      slot,
    }: {
      file: File;
      slot: "logo" | "hero";
    }): Promise<{ publicUrl: string; path: string }> => {
      if (!user) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.cafeId}/${slot}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("website-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("website-assets").getPublicUrl(path);
      return { publicUrl: data.publicUrl, path };
    },
  });
}

export function useDeleteWebsiteImage() {
  return useMutation({
    mutationFn: async (path: string) => {
      const { error } = await supabase.storage
        .from("website-assets")
        .remove([path]);
      if (error) throw error;
    },
  });
}
