/**
 * TvLoginScreen — full-screen login form for the TV Kitchen Display System.
 *
 * Calls supabase.auth.signInWithPassword directly (does NOT go through
 * useAuth.signIn) so we get the complete AuthError object — message, code,
 * status — not just the message string.
 *
 * On success onAuthStateChange fires in TvAuthShell's useAuth instance,
 * user becomes non-null, and this component is unmounted automatically.
 */

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface TvLoginScreenProps {
  /** Set by TvAuthShell when session exists but no staff_users row found. */
  accountError?: string;
}

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "16px 20px",
  fontSize: "1.2rem",
  borderRadius: "12px",
  border: "1.5px solid #374151",
  backgroundColor: "#1F2937",
  color: "#f9fafb",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const BUTTON_BASE: React.CSSProperties = {
  width: "100%",
  padding: "18px",
  fontSize: "1.2rem",
  fontWeight: 700,
  borderRadius: "12px",
  border: "none",
  transition: "opacity 0.15s",
  letterSpacing: "-0.01em",
};

interface SignInError {
  message: string;
  code: string | undefined;
  status: number | undefined;
}

export function TvLoginScreen({ accountError }: TvLoginScreenProps) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [signInError, setSignInError] = useState<SignInError | null>(null);

  const displayError = accountError
    ?? (signInError
          ? `${signInError.message}${signInError.code ? ` (code: ${signInError.code})` : ""}${signInError.status ? ` [${signInError.status}]` : ""}`
          : null);

  const canSubmit = email.trim() !== "" && password !== "" && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSignInError(null);
    setLoading(true);

    console.group("[TvLoginScreen] signInWithPassword attempt");
    console.log("email:", email.trim());
    console.log("supabase url:", (supabase as any).supabaseUrl ?? "unknown");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    console.log("--- raw result ---");
    console.log("error:", error ? JSON.stringify({
      message: error.message,
      code:    (error as any).code,
      status:  (error as any).status,
      name:    error.name,
    }) : null);
    console.log("data.session exists:", !!data?.session);
    console.log("data.user exists:",    !!data?.user);
    console.log("data.user.id:",        data?.user?.id ?? null);
    console.groupEnd();

    setLoading(false);

    if (error) {
      setSignInError({
        message: error.message,
        code:    (error as any).code,
        status:  (error as any).status,
      });
      return;
    }

    // Success — onAuthStateChange fires in TvAuthShell → unmounts this screen.
    // No manual navigation needed.
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#080a0d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "40px",
        userSelect: "none",
      }}
    >
      {/* Icon + title */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "72px", lineHeight: 1, marginBottom: "24px" }}>👨‍🍳</div>
        <div
          style={{
            fontSize: "2.75rem",
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          Kitchen Display
        </div>
        <div style={{ fontSize: "1.1rem", color: "#6b7280", marginTop: "12px" }}>
          Sign in with your staff account to continue
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "14px", width: "420px" }}
      >
        <input
          type="email"
          autoComplete="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          style={INPUT}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
          onBlur={(e)  => (e.currentTarget.style.borderColor = "#374151")}
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          style={INPUT}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
          onBlur={(e)  => (e.currentTarget.style.borderColor = "#374151")}
        />

        {displayError && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "10px",
              backgroundColor: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#fca5a5",
              fontSize: "1rem",
              textAlign: "center",
              lineHeight: 1.5,
              wordBreak: "break-word",
            }}
          >
            {displayError}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            ...BUTTON_BASE,
            backgroundColor: canSubmit ? "#f97316" : "#374151",
            color:           canSubmit ? "#ffffff"  : "#6b7280",
            opacity:         loading   ? 0.7        : 1,
            cursor:          canSubmit ? "pointer"  : "not-allowed",
            marginTop: "4px",
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div style={{ color: "#374151", fontSize: "0.9rem", textAlign: "center" }}>
        Contact your cafe manager if you need access
      </div>

      <style>{`
        input::placeholder { color: #4b5563; }
        input:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
