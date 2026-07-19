/**
 * TvLoginScreen — diagnostic build.
 *
 * On mount runs four probes (logged to Logcat under the "chromium" tag):
 *   1. fetch identity — native, Capacitor-patched, or custom?
 *   2. window.Capacitor — which plugins are registered?
 *   3. raw HTTPS probe — can the WebView reach supabase.co at all?
 *   4. Supabase client init values — URL and key prefix from the singleton.
 *
 * On submit: monkey-patches global fetch for ONE call so every request URL
 * and the first header key/value are logged before signInWithPassword fires.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// ─── styles ──────────────────────────────────────────────────────────────────

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
};

const BUTTON_BASE: React.CSSProperties = {
  width: "100%",
  padding: "18px",
  fontSize: "1.2rem",
  fontWeight: 700,
  borderRadius: "12px",
  border: "none",
  letterSpacing: "-0.01em",
};

// ─── diagnostic helpers ───────────────────────────────────────────────────────

/** Returns a short description of what window.fetch actually is. */
function describeFetch(): string {
  try {
    const s = (window.fetch as any)?.toString?.() ?? "";
    if (s.includes("native code")) return "native (WebView built-in)";
    if (s.includes("CapacitorHttp") || s.includes("capacitor"))
      return "Capacitor-patched";
    if (s.length < 200) return `custom wrapper: ${s.substring(0, 120)}`;
    return `overridden function (${s.length} chars)`;
  } catch (e) {
    return `error reading fetch: ${e}`;
  }
}

/** Enumerate window.Capacitor and its registered plugin keys. */
function describeCapacitor(): string {
  const cap = (window as any).Capacitor;
  if (!cap) return "window.Capacitor is undefined";
  const pluginKeys = Object.keys(cap.Plugins ?? {});
  return `isNative=${cap.isNativePlatform?.()}, plugins=[${pluginKeys.join(", ")}]`;
}

// ─── component ───────────────────────────────────────────────────────────────

interface TvLoginScreenProps {
  accountError?: string;
}

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
  const [probeResult, setProbeResult] = useState<string | null>(null);

  // ── Probe 1-3: run once on mount ──────────────────────────────────────────
  useEffect(() => {
    async function runProbes() {
      // 1. fetch identity
      const fetchDesc = describeFetch();
      console.log("[DIAG] fetch implementation:", fetchDesc);

      // 2. Capacitor
      const capDesc = describeCapacitor();
      console.log("[DIAG] Capacitor:", capDesc);

      // 3. Supabase singleton values (logged in supabase.ts at init, repeat here)
      const clientUrl = (supabase as any).supabaseUrl ?? "(not exposed)";
      const clientKey = (supabase as any).supabaseKey ?? (supabase as any).anonKey ?? "(not exposed)";
      console.log(
        "[DIAG] Supabase singleton — url:", clientUrl,
        "| key length:", String(clientKey).length,
        "| key prefix:", String(clientKey).substring(0, 20)
      );

      // 4. Raw HTTPS probe — isolates whether ALL fetch to supabase.co fails
      const probeUrl = "https://usllfqogcdskfeszntwf.supabase.co/rest/v1/";
      console.log("[DIAG] raw fetch probe →", probeUrl);
      try {
        const r = await fetch(probeUrl, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const msg = `[DIAG] probe OK — status ${r.status} ${r.statusText}`;
        console.log(msg);
        setProbeResult(`✓ HTTPS probe ${r.status}`);
      } catch (err: any) {
        const msg = `[DIAG] probe FAILED — ${err?.name}: ${err?.message}`;
        console.error(msg);
        setProbeResult(`✗ probe: ${err?.name}: ${err?.message}`);
      }
    }

    runProbes();
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────
  const displayError = accountError
    ?? (signInError
          ? `${signInError.message}${signInError.code ? ` (code: ${signInError.code})` : ""}${signInError.status ? ` [${signInError.status}]` : ""}`
          : null);

  const canSubmit = email.trim() !== "" && password !== "" && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSignInError(null);
    setLoading(true);

    // Monkey-patch fetch for this sign-in call only, so every outgoing URL
    // and the first Authorization/apikey header is logged before the real
    // fetch fires.  We restore the original immediately after.
    const origFetch = window.fetch;
    window.fetch = async function diagFetch(input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === "string" ? input
                : input instanceof URL     ? input.href
                : (input as Request).url;
      const headers = init?.headers ?? (input instanceof Request ? input.headers : undefined);
      let headerSummary = "(none)";
      if (headers) {
        try {
          const entries = headers instanceof Headers
            ? [...headers.entries()].slice(0, 4)
            : Object.entries(headers as Record<string, string>).slice(0, 4);
          headerSummary = entries.map(([k, v]) =>
            `${k}: ${k.toLowerCase().includes("key") || k.toLowerCase().includes("auth")
              ? v.substring(0, 24) + "…"
              : v}`
          ).join(" | ");
        } catch {
          headerSummary = "(could not read)";
        }
      }
      console.log("[DIAG] fetch intercepted →", url);
      console.log("[DIAG] headers (first 4):", headerSummary);
      console.log("[DIAG] method:", init?.method ?? "GET");
      return origFetch.call(this, input, init);
    } as typeof fetch;

    console.group("[TvLoginScreen] signInWithPassword");
    console.log("email:", email.trim());

    let data: any, error: any;
    try {
      ({ data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      }));
    } catch (thrown: any) {
      // signInWithPassword itself threw (not just returned an error object)
      console.error("[TvLoginScreen] signInWithPassword THREW:", thrown?.name, thrown?.message, thrown?.stack);
      window.fetch = origFetch;
      setLoading(false);
      setSignInError({ message: thrown?.message ?? "Unknown thrown error", code: thrown?.name, status: undefined });
      console.groupEnd();
      return;
    } finally {
      window.fetch = origFetch; // always restore
    }

    console.log("error:", error ? JSON.stringify({
      message: error.message,
      code:    (error as any).code,
      status:  (error as any).status,
      name:    error.name,
    }) : null);
    console.log("data.session exists:", !!data?.session);
    console.log("data.user exists:",    !!data?.user);
    console.groupEnd();

    setLoading(false);

    if (error) {
      setSignInError({
        message: error.message,
        code:    (error as any).code,
        status:  (error as any).status,
      });
    }
    // On success: onAuthStateChange fires in TvAuthShell → unmounts this screen.
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
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "72px", lineHeight: 1, marginBottom: "24px" }}>👨‍🍳</div>
        <div style={{ fontSize: "2.75rem", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.03em", lineHeight: 1 }}>
          Kitchen Display
        </div>
        <div style={{ fontSize: "1.1rem", color: "#6b7280", marginTop: "12px" }}>
          Sign in with your staff account to continue
        </div>
      </div>

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

        {/* Diagnostic probe result — shown on screen so it's visible without Logcat */}
        {probeResult && (
          <div style={{
            padding: "8px 14px",
            borderRadius: "8px",
            backgroundColor: probeResult.startsWith("✓") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${probeResult.startsWith("✓") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: probeResult.startsWith("✓") ? "#86efac" : "#fca5a5",
            fontSize: "0.85rem",
            textAlign: "center",
            fontFamily: "monospace",
          }}>
            {probeResult}
          </div>
        )}

        {displayError && (
          <div style={{
            padding: "14px 18px",
            borderRadius: "10px",
            backgroundColor: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5",
            fontSize: "1rem",
            textAlign: "center",
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}>
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
