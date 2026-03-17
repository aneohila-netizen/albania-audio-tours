import { useState } from "react";
import { useLocation } from "wouter";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { setAdminToken } from "@/lib/adminAuth";

// Hardcoded for static deploy — no backend required
const ADMIN_PASSWORD = "AlbaTour2026!";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    // Client-side check — works in static deploy without a backend
    setTimeout(() => {
      if (password === ADMIN_PASSWORD) {
        setAdminToken("albatour-admin-secret-token");
        setLocation("/admin/sites");
      } else {
        setError("Incorrect password. Please try again.");
      }
      setLoading(false);
    }, 300);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10" aria-label="AlbaniaAudioTours">
              <path d="M20 4 L36 32 L20 26 L4 32 Z" fill="hsl(var(--primary))" opacity="0.9"/>
              <path d="M20 4 L20 26" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.5"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">AlbaniaAudioTours Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Content Management Dashboard</p>
        </div>

        <Card className="border border-border/60 shadow-lg">
          <CardHeader className="pb-0 pt-6 px-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Lock className="w-4 h-4" />
              <span>Sign in to manage tours</span>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Admin Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your admin password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pr-10"
                    autoFocus
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !password}
                data-testid="button-login"
              >
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Default password: <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">AlbaTour2026!</code>
        </p>
      </div>
    </div>
  );
}
