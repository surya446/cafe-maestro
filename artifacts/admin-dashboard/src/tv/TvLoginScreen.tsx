/**
 * TvLoginScreen — full-screen login form for the TV Kitchen Display System.
 *
 * Shown by TvAuthShell when no valid authenticated Supabase session exists.
 * Uses raw inline styles (no Tailwind, no Shadcn) to match the rest of the
 * TV build and remain legible on a large kitchen display screen.
 *
 * On successful sign-in the Supabase client fires onAuthStateChange, which
 * updates TvAuthShell's useAuth state and unmounts this screen automatically.
 * No manual navigation or state lifting required.
 */

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Session } from "@supabase/supabase-js";

interface TvLoginScreenProps {
  /**
   * Passed by TvAuthShell when session is non-null but user is null —
   * meaning Supabase auth succeeded but there is no matching staff_users row.
   */
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
  cursor: "pointer",
  transition: "opacity 0.15s",
  letterSpacing: "-0.01em",
};

export function TvLoginScreen({ accountError }: TvLoginScreenProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);

  const displayError = accountError ?? credentialError;
  const canSubmit = email.trim() !== "" && password !== "" && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCredentialError(null);
    setLoading(true);
    const err = await signIn(email.trim(), password);
    setLoading(false);
    if (err) {
      setCredentialError("Invalid email or password. Please try again.");
    }
    // On success: onAuthStateChange fires → TvAuthShell detects user → this
    // component is unmounted and TvKitchenPage is shown instead.
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
        <div style={{ fontSize: "72px", lineHeight: 1, marginBottom: "24px" }}>
          👨‍🍳
        </div>
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
        <div
          style={{
            fontSize: "1.1rem",
            color: "#6b7280",
            marginTop: "12px",
            fontWeight: 400,
          }}
        >
          Sign in with your staff account to continue
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          width: "420px",
        }}
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
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = "#f97316")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "#374151")
          }
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
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = "#f97316")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "#374151")
          }
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
              lineHeight: 1.4,
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
            color: canSubmit ? "#ffffff" : "#6b7280",
            opacity: loading ? 0.7 : 1,
            cursor: canSubmit ? "pointer" : "not-allowed",
            marginTop: "4px",
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {/* Footer */}
      <div style={{ color: "#374151", fontSize: "0.9rem", textAlign: "center" }}>
        Contact your cafe manager if you need access
      </div>

      {/* Keyframe for any future animation reuse */}
      <style>{`
        input::placeholder { color: #4b5563; }
        input:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
