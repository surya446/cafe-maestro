import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { BookingStatus } from "@/types";

// ── Types ──────────────────────────────────────────────────────

export interface PublicCafe {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  address: string | null;
}

export interface PublicBookingInput {
  cafe_id: string;
  name: string;
  email: string;
  phone: string | null;
  party_size: number;
  booking_date: string;
  booking_time: string;
  notes: string | null;
}

export interface PublicBookingResult {
  id: string;
  name: string;
  email: string;
  booking_date: string;
  booking_time: string;
  party_size: number;
}

// ── Hooks ──────────────────────────────────────────────────────

/**
 * Fetches the first active cafe visible to anon users.
 * Works for single-cafe deployments without any env var.
 */
export function usePublicCafe() {
  return useQuery({
    queryKey: ["public_cafe"],
    queryFn: async (): Promise<PublicCafe | null> => {
      const cafeId = import.meta.env.VITE_CAFE_ID as string | undefined;

      let q = supabase
        .from("cafes")
        .select("id, name, description, phone, address")
        .eq("is_active", true);

      if (cafeId) q = (q as ReturnType<typeof q.eq>).eq("id", cafeId);

      const { data, error } = await (q as ReturnType<typeof q.limit>)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
    staleTime: 60_000,
  });
}

/**
 * Submits a customer booking — uses the anon key, relies on the
 * `bookings__public__insert` RLS policy (WITH CHECK (true)).
 */
export function usePublicCreateBooking() {
  return useMutation({
    mutationFn: async (
      input: PublicBookingInput
    ): Promise<PublicBookingResult> => {
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          ...input,
          status: "pending" as BookingStatus,
          staff_notes: null,
          table_id: null,
        })
        .select("id, name, email, booking_date, booking_time, party_size")
        .single();
      if (error) throw error;
      return data as PublicBookingResult;
    },
  });
}
