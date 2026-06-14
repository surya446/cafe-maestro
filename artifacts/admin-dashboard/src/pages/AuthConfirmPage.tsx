import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Coffee, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PageState = "checking" | "ready" | "error" | "success";

// Parse key=value pairs from the URL hash fragment.
// Supabase appends tokens as: #access_token=...&refresh_token=...&type=invite
function parseHash(): URLSearchParams {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export function AuthConfirmPage() {
  const [, navigate] = useLocation();
  const [pageState, setPageState] = useState<PageState>("checking");
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Guard against calling setPageState after unmount or after already settled.
  const settled = useRef(false);
  function settle(state: PageState, errorMsg?: string) {
    if (settled.current) return;
    settled.current = true;
    if (errorMsg) setSessionError(errorMsg);
    setPageState(state);
  }

  useEffect(() => {
    const params = parseHash();

    // ── 1. Supabase error in hash (expired, invalid, already used) ──
    const hashError = params.get("error");
    const hashErrorDesc = params.get("error_description");
    if (hashError) {
      settle(
        "error",
        hashErrorDesc?.replace(/\+/g, " ") ??
          "This invite link is invalid or has already been used."
      );
      return;
    }

    // ── 2. No tokens in hash at all — not a valid invite URL ──────
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) {
      settle(
        "error",
        "This invite link is missing required tokens. Please ask your administrator to send a new invite."
      );
      return;
    }

    // ── 3. Explicitly establish the session from the hash tokens ──
    // detectSessionInUrl:true processes the hash asynchronously.
    // We also call setSession directly to guarantee timing.
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data, error }) => {
        if (error || !data.session) {
          settle(
            "error",
            "This invite link has expired or has already been used. Please ask your administrator to send a new invite."
          );
        } else {
          settle("ready");
        }
      });

    // ── 4. Also listen for auth state (covers detectSessionInUrl path) ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session) {
          settle("ready");
        }
      }
    );

    // ── 5. Timeout fallback — treat silence as expired ────────────
    const timeout = setTimeout(() => {
      settle(
        "error",
        "This invite link has expired or has already been used. Please ask your administrator to send a new invite."
      );
    }, 10_000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (pageState === "success") {
      const timer = setTimeout(() => navigate("/login"), 2500);
      return () => clearTimeout(timer);
    }
  }, [pageState, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setSubmitError(
        error.message ?? "Failed to set password. Please try again."
      );
    } else {
      await supabase.auth.signOut();
      setPageState("success");
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left — brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-96 bg-sidebar p-10 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-primary/20 text-sidebar-primary">
              <Coffee className="w-6 h-6" />
            </div>
            <span className="text-lg font-bold text-sidebar-foreground">
              Cafe Maestro
            </span>
          </div>
          <h2 className="text-3xl font-bold text-sidebar-foreground leading-tight">
            You&rsquo;ve been invited
            <br />
            <span className="text-sidebar-primary">to the team.</span>
          </h2>
          <p className="mt-4 text-sm text-sidebar-foreground/60 leading-relaxed">
            Set a password to activate your account and access the Cafe Maestro
            admin dashboard.
          </p>
        </div>

        <div className="space-y-4">
          {[
            "Menu & category management",
            "Real-time table sessions",
            "Booking management",
            "Gallery & offers",
            "Staff & role control",
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-sidebar-primary shrink-0" />
              <span className="text-sm text-sidebar-foreground/70">
                {feature}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right — content panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
              <Coffee className="w-5 h-5" />
            </div>
            <span className="text-base font-bold text-foreground">
              Cafe Maestro
            </span>
          </div>

          {/* Checking */}
          {pageState === "checking" && (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Verifying invite…</p>
            </div>
          )}

          {/* Invalid / expired invite */}
          {pageState === "error" && (
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">
                Link unavailable
              </h1>
              <p className="text-sm text-muted-foreground mb-6">
                This invite link could not be verified.
              </p>
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-sm">{sessionError}</p>
              </div>
            </div>
          )}

          {/* Password form */}
          {pageState === "ready" && (
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">
                Create your password
              </h1>
              <p className="text-sm text-muted-foreground mb-8">
                Choose a secure password to activate your account.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirm ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {submitError && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-sm">{submitError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !password || !confirmPassword}
                >
                  {loading ? "Setting password…" : "Set Password & Activate"}
                </Button>
              </form>

              <p className="text-xs text-muted-foreground text-center mt-8">
                Password must be at least 8 characters.
              </p>
            </div>
          )}

          {/* Success */}
          {pageState === "success" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 text-green-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">
                  Password set!
                </h1>
                <p className="text-sm text-muted-foreground">
                  Your account is active. Redirecting you to sign in…
                </p>
              </div>
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mt-2" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
