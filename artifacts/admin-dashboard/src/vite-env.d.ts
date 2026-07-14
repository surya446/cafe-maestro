/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Build-time variant. "mobile" = Android Mobile APK, "tv" = Android TV APK, absent = web/dev. */
  readonly VITE_APP_VARIANT?: "mobile" | "tv";
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
