import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// [DIAG] Log exactly once at module initialisation so Logcat shows
// whether the singleton is created with the real values or the placeholders.
console.log(
  "[supabase init]",
  "url:", supabaseUrl ?? "(undefined → placeholder)",
  "| key length:", supabaseAnonKey?.length ?? 0,
  "| key prefix:", supabaseAnonKey?.substring(0, 20) ?? "(none)",
  "| isTV:", import.meta.env.VITE_APP_VARIANT === "tv"
);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase env vars not set. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getCurrentSession() {
  return supabase.auth.getSession();
}

export async function getCurrentUser() {
  return supabase.auth.getUser();
}
