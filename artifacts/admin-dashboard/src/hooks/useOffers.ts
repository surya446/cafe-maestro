import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Offer } from "@/types";
import { useAuth } from "./useAuth";

const OFFERS_KEY = (cafeId: string) => ["offers", cafeId];

export function useOffers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: OFFERS_KEY(user?.cafeId ?? ""),
    queryFn: async (): Promise<Offer[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .eq("cafe_id", user.cafeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useCreateOffer() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Omit<Offer, "id" | "cafe_id" | "created_at">
    ) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("offers")
        .insert({ ...input, cafe_id: user.cafeId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: OFFERS_KEY(user?.cafeId ?? "") }),
  });
}

export function useUpdateOffer() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Offer> & { id: string }) => {
      const { data, error } = await supabase
        .from("offers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: OFFERS_KEY(user?.cafeId ?? "") }),
  });
}

export function useDeleteOffer() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("offers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: OFFERS_KEY(user?.cafeId ?? "") }),
  });
}

export function useToggleOffer() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("offers")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, is_active }) => {
      await qc.cancelQueries({ queryKey: OFFERS_KEY(user?.cafeId ?? "") });
      const prev = qc.getQueryData<Offer[]>(OFFERS_KEY(user?.cafeId ?? ""));
      qc.setQueryData<Offer[]>(OFFERS_KEY(user?.cafeId ?? ""), (old) =>
        old?.map((o) => (o.id === id ? { ...o, is_active } : o)) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev)
        qc.setQueryData(OFFERS_KEY(user?.cafeId ?? ""), ctx.prev);
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: OFFERS_KEY(user?.cafeId ?? "") }),
  });
}
