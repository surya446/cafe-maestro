import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Booking, BookingStatus } from "@/types";
import { useAuth } from "./useAuth";

const BOOKINGS_KEY = (cafeId: string, date?: string) => ["bookings", cafeId, date];

export function useBookings(date?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: BOOKINGS_KEY(user?.cafeId ?? "", date),
    queryFn: async (): Promise<Booking[]> => {
      if (!user) return [];
      let q = supabase
        .from("bookings")
        .select("*")
        .eq("cafe_id", user.cafeId)
        .order("booking_date")
        .order("booking_time");
      if (date) q = q.eq("booking_date", date);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}

export function useCreateBooking() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Omit<Booking, "id" | "cafe_id" | "created_at" | "updated_at" | "confirmed_at" | "confirmed_by">
    ) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("bookings")
        .insert({ ...input, cafe_id: user.cafeId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["bookings", user?.cafeId] }),
  });
}

export function useUpdateBookingStatus() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BookingStatus }) => {
      const { data, error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["bookings", user?.cafeId] }),
  });
}

export function useUpdateBooking() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Booking> & { id: string }) => {
      const { data, error } = await supabase
        .from("bookings")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["bookings", user?.cafeId] }),
  });
}

export function useDeleteBooking() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["bookings", user?.cafeId] }),
  });
}
