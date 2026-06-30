import { useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AuthUser, UserRole } from "@/types";

interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  const buildAuthUser = useCallback(
    async (supabaseUser: User): Promise<AuthUser | null> => {
      // Single query — fetches all needed fields including must_change_password.
      // If the must_change_password column is absent (migration 028 not applied),
      // Supabase will return an error; we handle it gracefully by defaulting to false.
      const { data: member, error: memberError } = await supabase
        .from("staff_users")
        .select("role, full_name, cafe_id, must_change_password, cafes(name)")
        .eq("id", supabaseUser.id)
        .eq("is_active", true)
        .single();

      if (memberError) {
        // If the error is specifically about the missing column, retry without it.
        if (memberError.message?.includes("must_change_password")) {
          const { data: fallback, error: fallbackError } = await supabase
            .from("staff_users")
            .select("role, full_name, cafe_id, cafes(name)")
            .eq("id", supabaseUser.id)
            .eq("is_active", true)
            .single();
          if (fallbackError || !fallback) return null;
          const cafe = fallback.cafes as unknown as { name: string } | null;
          return {
            id: supabaseUser.id,
            email: supabaseUser.email ?? "",
            role: fallback.role as UserRole,
            displayName: fallback.full_name,
            cafeId: fallback.cafe_id,
            cafeName: cafe?.name ?? "",
            mustChangePassword: false,
          };
        }
        return null;
      }
      if (!member) return null;

      const cafe = member.cafes as unknown as { name: string } | null;

      return {
        id: supabaseUser.id,
        email: supabaseUser.email ?? "",
        role: member.role as UserRole,
        displayName: member.full_name,
        cafeId: member.cafe_id,
        cafeName: cafe?.name ?? "",
        mustChangePassword: (member as any).must_change_password ?? false,
      };
    },
    [],
  );

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const user = await buildAuthUser(session.user);
        setState({ user, session, loading: false, error: null });
      } else {
        setState({ user: null, session: null, loading: false, error: null });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const user = await buildAuthUser(session.user);
        setState({ user, session, loading: false, error: null });
      } else {
        setState({ user: null, session: null, loading: false, error: null });
      }
    });

    return () => subscription.unsubscribe();
  }, [buildAuthUser]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setState((s) => ({
          ...s,
          loading: false,
          error: error.message,
        }));
        return error.message;
      }
      return null;
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ user: null, session: null, loading: false, error: null });
  }, []);

  const isOwner = state.user?.role === "owner";
  const isManagerOrAbove =
    state.user?.role === "owner" || state.user?.role === "manager";

  return {
    ...state,
    signIn,
    signOut,
    isOwner,
    isManagerOrAbove,
  };
}
