import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface ActiveSession {
  id: string;
  cafeId: string;
  tableId: string;
  tableNumber: number;
  tableName: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
  activeDeviceCount: number;
}

export interface CafeTable {
  id: string;
  cafeId: string;
  number: number;
  name: string | null;
  qrCodeToken: string | null;
  isActive: boolean;
  isClosed: boolean;
}

export function useTableSessions() {
  const qc = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<ActiveSession[]>({
    queryKey: ["staff_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_sessions")
        .select(
          `id, cafe_id, table_id, status, expires_at, created_at,
           cafe_tables (number, name),
           session_devices (id, is_active)`
        )
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((s: any) => ({
        id: s.id,
        cafeId: s.cafe_id,
        tableId: s.table_id,
        tableNumber: s.cafe_tables?.number ?? 0,
        tableName: s.cafe_tables?.name ?? null,
        status: s.status,
        expiresAt: s.expires_at,
        createdAt: s.created_at,
        activeDeviceCount: (s.session_devices ?? []).filter(
          (d: any) => d.is_active
        ).length,
      }));
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const { data: tables = [], isLoading: tablesLoading } = useQuery<CafeTable[]>({
    queryKey: ["staff_tables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cafe_tables")
        .select("id, cafe_id, number, name, qr_code_token, is_active, is_closed")
        .order("number", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((t: any) => ({
        id: t.id,
        cafeId: t.cafe_id,
        number: t.number,
        name: t.name ?? null,
        qrCodeToken: t.qr_code_token ?? null,
        isActive: t.is_active,
        isClosed: t.is_closed ?? false,
      }));
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("staff_sessions_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_sessions" },
        () => qc.invalidateQueries({ queryKey: ["staff_sessions"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_devices" },
        () => qc.invalidateQueries({ queryKey: ["staff_sessions"] })
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [qc]);

  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc("end_session", {
        p_session_id: sessionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff_sessions"] });
    },
  });

  const regenerateQrMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const newToken = crypto.randomUUID();
      const { error } = await supabase
        .from("cafe_tables")
        .update({ qr_code_token: newToken })
        .eq("id", tableId);
      if (error) throw error;
      return newToken;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff_tables"] });
    },
  });

  const reopenTableMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const { error } = await supabase.rpc("reopen_table", { p_table_id: tableId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff_tables"] });
    },
  });

  return {
    sessions,
    sessionsLoading,
    tables,
    tablesLoading,
    endSession: endSessionMutation.mutateAsync,
    isEndingSession: endSessionMutation.isPending,
    endingSessionId: endSessionMutation.variables as string | undefined,
    regenerateQr: regenerateQrMutation.mutateAsync,
    isRegeneratingQr: regenerateQrMutation.isPending,
    regeneratingTableId: regenerateQrMutation.variables as string | undefined,
    reopenTable: reopenTableMutation.mutateAsync,
    isReopeningTable: reopenTableMutation.isPending,
    reopeningTableId: reopenTableMutation.variables as string | undefined,
  };
}
