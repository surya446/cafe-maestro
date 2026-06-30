import { useState } from "react";
import { useLocation } from "wouter";
import { Coffee, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  const { signIn } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = await signIn(email, password);
    setLoading(false);
    if (err) {
      setError("Invalid email or password. Please try again.");
    } else {
      navigate("/");
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
              Cup & Cozy
            </span>
          </div>
          <h2 className="text-3xl font-bold text-sidebar-foreground leading-tight">
            Your cafe,
            <br />
            <span className="text-sidebar-primary">beautifully managed.</span>
          </h2>
          <p className="mt-4 text-sm text-sidebar-foreground/60 leading-relaxed">
            Menu management, table sessions, bookings, staff, and analytics —
            all in one elegant dashboard.
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
              <span className="text-sm text-sidebar-foreground/70">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
              <Coffee className="w-5 h-5" />
            </div>
            <span className="text-base font-bold text-foreground">
              Cup & Cozy
            </span>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            Sign in to your admin dashboard
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@yourcafe.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
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

            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !email || !password}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-8">
            Access is managed by your cafe owner.
            <br />
            Contact them if you need an account.
          </p>
        </div>
      </div>
    </div>
  );
}
