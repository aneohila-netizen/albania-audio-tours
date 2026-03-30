import { useState, useEffect } from "react";
import { Eye, EyeOff, Lock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

const RAILWAY_API = "https://albania-audio-tours-production.up.railway.app";

type Stage = "form" | "loading" | "success" | "error" | "invalid";

export default function ResetPasswordPage() {
  const [stage, setStage]         = useState<Stage>("form");
  const [token, setToken]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [showConf, setShowConf]   = useState(false);
  const [error, setError]         = useState("");
  const [message, setMessage]     = useState("");

  // Extract token from hash query string: /#/reset-password?token=xxx
  useEffect(() => {
    const hash   = window.location.hash; // e.g. #/reset-password?token=abc123
    const qIndex = hash.indexOf("?");
    if (qIndex === -1) { setStage("invalid"); return; }
    const params = new URLSearchParams(hash.slice(qIndex + 1));
    const t      = params.get("token") || "";
    if (!t || t.length < 10) { setStage("invalid"); return; }
    setToken(t);
  }, []);

  // Password strength
  const strength = (() => {
    if (password.length === 0)  return null;
    if (password.length < 8)    return { level: 0, label: "Too short",  color: "bg-red-500" };
    const hasUpper  = /[A-Z]/.test(password);
    const hasLower  = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    const score = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
    if (score <= 1) return { level: 1, label: "Weak",   color: "bg-orange-400" };
    if (score === 2) return { level: 2, label: "Fair",   color: "bg-yellow-400" };
    if (score === 3) return { level: 3, label: "Good",   color: "bg-blue-500"   };
    return           { level: 4, label: "Strong", color: "bg-green-500"  };
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setStage("loading");
    try {
      const res  = await fetch(`${RAILWAY_API}/api/admin/reset-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setMessage(data.message || "Password updated successfully.");
      setStage("success");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setStage("error");
    }
  }

  // ── Invalid / missing token ──────────────────────────────────────────────
  if (stage === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle size={26} className="text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Invalid Reset Link</h1>
          <p className="text-sm text-muted-foreground">
            This reset link is missing or invalid. Please request a new one from the admin login page.
          </p>
          <a
            href="/#/admin"
            className="inline-block mt-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <Loader2 size={36} className="animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Updating your password on Railway…</p>
          <p className="text-xs text-muted-foreground">This may take a few seconds.</p>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (stage === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold">Password Updated</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          <div className="p-4 rounded-xl bg-muted/50 text-sm text-left space-y-2 text-muted-foreground">
            <p className="font-semibold text-foreground">What happens now</p>
            <p>✅ Your new password has been saved to Railway</p>
            <p>⏳ Railway is redeploying — takes 2–3 minutes</p>
            <p>📧 Confirmation sent to both email addresses</p>
            <p>🔐 You can log in with your new password once the redeploy finishes</p>
          </div>
          <a
            href="/#/admin"
            className="inline-block w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold text-center"
          >
            Go to Admin Login
          </a>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle size={26} className="text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Reset Failed</h1>
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { setStage("form"); setError(""); }}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
            >
              Try Again
            </button>
            <a
              href="/#/admin"
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Back to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">

        {/* Logo / header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10" aria-label="AlbaniaAudioTours">
              <path d="M20 4 L36 32 L20 26 L4 32 Z" fill="hsl(var(--primary))" opacity="0.9" />
              <path d="M20 4 L20 26" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Set New Password</h1>
          <p className="text-sm text-muted-foreground mt-1">AlbaTour Admin — Password Reset</p>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-lg p-6 space-y-5">

          {/* Security info */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/15">
            <Lock size={14} className="text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Choose a strong password. It will be saved to Railway and take effect after a 2–3 minute redeploy. A confirmation email will be sent to both your registered addresses.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* New password */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full pr-10 pl-3 py-2.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {/* Strength bar */}
              {strength && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3, 4].map(lvl => (
                      <div
                        key={lvl}
                        className={`flex-1 rounded-full transition-colors ${
                          lvl <= strength.level ? strength.color : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-[11px] ${
                    strength.level <= 1 ? "text-red-500" :
                    strength.level === 2 ? "text-yellow-600" :
                    strength.level === 3 ? "text-blue-500" : "text-green-600"
                  }`}>
                    {strength.label}
                    {strength.level < 3 && " — add uppercase, numbers or symbols"}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Confirm password
              </label>
              <div className="relative">
                <input
                  type={showConf ? "text" : "password"}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  className={`w-full pr-10 pl-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                    confirm && confirm !== password
                      ? "border-destructive focus:ring-destructive/40"
                      : "border-border"
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConf(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showConf ? "Hide password" : "Show password"}
                >
                  {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirm && confirm !== password && (
                <p className="text-[11px] text-destructive mt-1">Passwords don't match</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!password || !confirm || password !== confirm || password.length < 8}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 transition-opacity"
            >
              Set New Password
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Changed your mind?{" "}
              <a href="/#/admin" className="text-primary hover:underline">
                Back to login
              </a>
            </p>

          </form>
        </div>
      </div>
    </div>
  );
}
