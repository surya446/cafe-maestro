import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  formatFileSize,
  buildStoragePath,
  type AppReleasePlatform,
} from "@/services/releaseService";

export interface AppRelease {
  id: string;
  platform: AppReleasePlatform;
  version: string;
  build_number: number;
  release_notes: string | null;
  min_android_version: string | null;
  file_size: string | null;
  download_url: string | null;
  storage_path: string | null;
  is_latest: boolean;
  is_force_update: boolean;
  published_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublishReleaseInput {
  platform: AppReleasePlatform;
  version: string;
  build_number: number;
  release_notes: string;
  min_android_version: string;
  is_force_update: boolean;
  file: File;
}

export interface UpdateReleaseInput {
  id: string;
  release_notes?: string;
  min_android_version?: string;
  is_force_update?: boolean;
}

const RELEASES_BUCKET = "downloads";

function releaseKeys(platform: AppReleasePlatform) {
  return {
    latest: ["app_releases", "latest", platform] as const,
    history: ["app_releases", "history", platform] as const,
    all: ["app_releases"] as const,
  };
}

/** Fetch the is_latest=true release for a given platform. */
export function useLatestRelease(platform: AppReleasePlatform) {
  return useQuery({
    queryKey: releaseKeys(platform).latest,
    queryFn: async (): Promise<AppRelease | null> => {
      const { data, error } = await supabase
        .from("app_releases")
        .select("*")
        .eq("platform", platform)
        .eq("is_latest", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // no rows
        throw error;
      }
      return data as AppRelease;
    },
  });
}

/** Fetch all releases for a given platform, newest first. */
export function useReleaseHistory(platform: AppReleasePlatform) {
  return useQuery({
    queryKey: releaseKeys(platform).history,
    queryFn: async (): Promise<AppRelease[]> => {
      const { data, error } = await supabase
        .from("app_releases")
        .select("*")
        .eq("platform", platform)
        .order("build_number", { ascending: false });

      if (error) throw error;
      return (data ?? []) as AppRelease[];
    },
  });
}

/**
 * Upload an APK to Supabase Storage and create the DB record.
 * The DB trigger auto-sets all previous releases for that platform
 * to is_latest = false when the new row is inserted with is_latest = true.
 */
export function usePublishRelease() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: PublishReleaseInput): Promise<AppRelease> => {
      const storagePath = buildStoragePath(
        input.platform,
        input.version,
        input.build_number
      );

      // 1. Upload APK
      const { error: uploadError } = await supabase.storage
        .from(RELEASES_BUCKET)
        .upload(storagePath, input.file, {
          contentType: "application/vnd.android.package-archive",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from(RELEASES_BUCKET)
        .getPublicUrl(storagePath);

      const downloadUrl = urlData.publicUrl;

      // 3. Insert DB record (trigger handles unsetting previous is_latest)
      const { data, error: dbError } = await supabase
        .from("app_releases")
        .insert({
          platform: input.platform,
          version: input.version.trim(),
          build_number: input.build_number,
          release_notes: input.release_notes.trim() || null,
          min_android_version: input.min_android_version.trim() || null,
          file_size: formatFileSize(input.file.size),
          download_url: downloadUrl,
          storage_path: storagePath,
          is_latest: true,
          is_force_update: input.is_force_update,
          published_at: new Date().toISOString(),
          created_by: user?.id ?? null,
        })
        .select()
        .single();

      if (dbError) {
        // Rollback: remove the uploaded file so storage stays clean
        await supabase.storage.from(RELEASES_BUCKET).remove([storagePath]);
        throw new Error(`Database error: ${dbError.message}`);
      }

      return data as AppRelease;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: releaseKeys(variables.platform).all });
      qc.invalidateQueries({ queryKey: releaseKeys(variables.platform).latest });
      qc.invalidateQueries({ queryKey: releaseKeys(variables.platform).history });
    },
  });
}

/**
 * Rollback to a previous release.
 * Simply sets is_latest = true — the DB trigger unsets all other releases.
 * No file re-upload needed.
 */
export function useRollbackRelease() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      platform,
    }: {
      id: string;
      platform: AppReleasePlatform;
    }): Promise<void> => {
      const { error } = await supabase
        .from("app_releases")
        .update({ is_latest: true })
        .eq("id", id);

      if (error) throw new Error(error.message);
      void platform; // used in onSuccess
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: releaseKeys(variables.platform).latest });
      qc.invalidateQueries({ queryKey: releaseKeys(variables.platform).history });
    },
  });
}

/**
 * Delete a release record and its APK from storage.
 * Cannot delete a release that is currently latest (must rollback first).
 */
export function useDeleteRelease() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      release,
    }: {
      release: AppRelease;
    }): Promise<void> => {
      if (release.is_latest) {
        throw new Error(
          "Cannot delete the current live release. Rollback to another release first."
        );
      }

      // Remove from storage if we have the path
      if (release.storage_path) {
        await supabase.storage
          .from(RELEASES_BUCKET)
          .remove([release.storage_path]);
      }

      const { error } = await supabase
        .from("app_releases")
        .delete()
        .eq("id", release.id);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: releaseKeys(variables.release.platform).history,
      });
    },
  });
}

/** Edit release notes, min Android version, or force-update flag. */
export function useUpdateRelease() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      platform,
      ...updates
    }: UpdateReleaseInput & { platform: AppReleasePlatform }): Promise<void> => {
      const { error } = await supabase
        .from("app_releases")
        .update(updates)
        .eq("id", id);

      if (error) throw new Error(error.message);
      void platform;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: releaseKeys(variables.platform).latest });
      qc.invalidateQueries({ queryKey: releaseKeys(variables.platform).history });
    },
  });
}
