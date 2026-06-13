import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Booking, BookingStatus, CafeTable } from "@/types";
import { useAuth } from "./useAuth";

// ── Query key factories ────────────────────────────────────────

const BOOKINGS_KEY = (cafeId: string, date?: string) =>
  ["bookings", cafeId, date] as const;

const TABLES_KEY = (cafeId: string) =>
  ["cafe_tables", cafeId] as const;

// ── Queries ────────────────────────────────────────────────────

export function useBookings(date?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Realtime subscription — invalidates on any change to this cafe's bookings
  useEffect(() => {
    if (!user?.cafeId) return;
    const channel = supabase
      .channel(`bookings-rt:${user.cafeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `cafe_id=eq.${user.cafeId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["bookings", user.cafeId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.cafeId, qc]);

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

export function useCafeTables() {
  const { user } = useAuth();
  return useQuery({
    queryKey: TABLES_KEY(user?.cafeId ?? ""),
    queryFn: async (): Promise<
      Pick<CafeTable, "id" | "number" | "name" | "capacity">[]
    > => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("cafe_tables")
        .select("id, number, name, capacity")
        .eq("cafe_id", user.cafeId)
        .eq("is_active", true)
        .order("number");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

// ── Mutations ──────────────────────────────────────────────────

export function useCreateBooking() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Omit<
        Booking,
        "id" | "cafe_id" | "created_at" | "updated_at" | "confirmed_at" | "confirmed_by"
      >
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

export function useUpdateBooking() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Booking> & { id: string }) => {
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

export function useUpdateBookingStatus() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: BookingStatus;
    }) => {
      const patch: Record<string, unknown> = { status };
      if (status === "confirmed") {
        patch.confirmed_at = new Date().toISOString();
        patch.confirmed_by = user?.id ?? null;
      }
      const { data, error } = await supabase
        .from("bookings")
        .update(patch)
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

export function useUpdateStaffNotes() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      staff_notes,
    }: {
      id: string;
      staff_notes: string | null;
    }) => {
      const { data, error } = await supabase
        .from("bookings")
        .update({ staff_notes })
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

export function useAssignTable() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      table_id,
    }: {
      id: string;
      table_id: string | null;
    }) => {
      const { data, error } = await supabase
        .from("bookings")
        .update({ table_id })
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
