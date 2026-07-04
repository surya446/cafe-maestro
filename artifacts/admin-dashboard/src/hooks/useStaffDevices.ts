import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface StaffDeviceRow {
  id: string;
  staff_id: string;
  device_name: string | null;
  device_model: string | null;
  android_version: string | null;
  app_version: string | null;
  build_number: number | null;
  last_seen: string | null;
  last_login: string | null;
  staff_users: { full_name: string; role: string } | null;
}

/** Owner/manager only (enforced by RLS). Used by the Device Versions card. */
export function useStaffDevices() {
  return useQuery({
    queryKey: ["staff_devices"],
    queryFn: async (): Promise<StaffDeviceRow[]> => {
      const { data, error } = await supabase
        .from("staff_devices")
        .select("*, staff_users(full_name, role)")
        .order("last_seen", { ascending: false });

      if (error) {
        if (error.code === "42P01") return []; // table not migrated yet
        throw error;
      }
      return (data ?? []) as unknown as StaffDeviceRow[];
    },
  });
}
