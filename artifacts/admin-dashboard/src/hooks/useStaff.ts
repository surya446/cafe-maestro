import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { StaffUser, UserRole } from "@/types";
import { useAuth } from "./useAuth";

const STAFF_KEY = (cafeId: string) => ["staff", cafeId];

export function useStaff() {
  const { user } = useAuth();

  return useQuery({
    queryKey: STAFF_KEY(user?.cafeId ?? ""),
    queryFn: async (): Promise<StaffUser[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("staff_users")
        .select("*")
        .eq("cafe_id", user.cafeId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useUpdateMemberRole() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const { data, error } = await supabase
        .from("staff_users")
        .update({ role })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: STAFF_KEY(user?.cafeId ?? "") }),
  });
}

export function useToggleMemberActive() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => {
      const { data, error } = await supabase
        .from("staff_users")
        .update({ is_active })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: STAFF_KEY(user?.cafeId ?? "") }),
  });
}

export function useInviteMember() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      email: string;
      role: UserRole;
      full_name: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase.functions.invoke(
        "invite-staff-member",
        {
          body: {
            email: input.email,
            role: input.role,
            full_name: input.full_name,
            cafe_id: user.cafeId,
          },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: STAFF_KEY(user?.cafeId ?? "") }),
  });
}
