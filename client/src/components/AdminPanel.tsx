/**
 * AdminPanel — unified admin UI with NO wouter navigation.
 *
 * State machine: "login" | "sites" | "editor" | "attractions" | "attr-editor"
 * No navigation = no remount = token stays alive.
 *
 * Fixes in this version:
 * 1. Attractions management (list + add/edit/delete per destination)
 * 2. Interactive Leaflet map picker for lat/lng
 * 3. Image upload persisted via localStorage (prototype persistence)
 * 4. Softer "content mode" banner instead of alarming "static prototype" warning
 */

import { useState, useEffect, useRef, useCallback } from "react";
import GallerySlideshow from "@/components/GallerySlideshow";
import {
  Lock, Eye, EyeOff, Plus, Pencil, Trash2, LogOut,
  MapPin, Globe, Music, Image, Info, ArrowLeft, Save,
  Upload, Play, Pause, Loader2, X, Link, CheckCircle2,
  LayoutList, Star, Route, FileText, Settings, Megaphone, Power, PowerOff,
  Phone, Mail, ExternalLink, ChevronLeft, ChevronRight, ArrowLeftRight, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { setAdminToken, getAdminToken, clearAdminToken } from "@/lib/adminAuth";
import { STATIC_SITES, DESTINATIONS, ATTRACTIONS } from "@/lib/staticData";
import type { Destination, Attraction } from "@/lib/staticData";
import type { TourSite } from "@shared/schema";
import ItineraryManager from "@/components/ItineraryManager";
import AdminCmsManager from "@/components/AdminCmsManager";
import AdminSubscriptions from "@/components/AdminSubscriptions";
import { queryClient } from "@/lib/queryClient";

// ─── Auth ─────────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "AlbaTour2026!";
const TOKEN_VALUE = "albatour-admin-secret-token";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  archaeology: "bg-amber-100 text-amber-800",
  castle: "bg-slate-100 text-slate-800",
  beach: "bg-cyan-100 text-cyan-800",
  "historic-town": "bg-purple-100 text-purple-800",
  nature: "bg-green-100 text-green-800",
  mosque: "bg-yellow-100 text-yellow-800",
  museum: "bg-blue-100 text-blue-800",
  monument: "bg-orange-100 text-orange-800",
  district: "bg-pink-100 text-pink-800",
  promenade: "bg-teal-100 text-teal-800",
  landmark: "bg-indigo-100 text-indigo-800",
  ruins: "bg-stone-100 text-stone-800",
  city: "bg-gray-100 text-gray-800",
  cultural: "bg-purple-100 text-purple-800",
};

// cultural is included for admin editing but hidden from the public filter bar until ready
const DEST_CATEGORIES = ["archaeology", "castle", "beach", "historic-town", "nature", "city", "cultural"];
const ATTR_CATEGORIES = [
  "castle", "mosque", "museum", "monument", "district", "church",
  "promenade", "landmark", "ruins", "nature", "archaeology", "market", "hot-springs",
];
const DIFFICULTIES = ["easy", "moderate", "hard"];
const REGIONS = ["Tirana", "Durrës", "Shkodër", "Lezha", "Berat", "Elbasan", "Korçë", "Vlorë", "Gjirokastër", "Sarandë", "Fier", "Other"];
const LANGS: { key: "en" | "al" | "gr" | "it" | "es" | "de" | "fr" | "ar" | "sl" | "pt" | "cn"; label: string; flag: string }[] = [
  { key: "en", label: "English", flag: "🇬🇧" },
  { key: "al", label: "Albanian", flag: "🇦🇱" },
  { key: "gr", label: "Greek", flag: "🇬🇷" },
  { key: "it", label: "Italian", flag: "🇮🇹" },
  { key: "es", label: "Spanish", flag: "🇪🇸" },
  { key: "de", label: "German", flag: "🇩🇪" },
  { key: "fr", label: "French", flag: "🇫🇷" },
  { key: "ar", label: "Arabic", flag: "🇸🇦" },
  { key: "sl", label: "Slovenian", flag: "🇸🇮" },
  { key: "pt", label: "Portuguese", flag: "🇵🇹" },
  { key: "cn", label: "Chinese", flag: "🇨🇳" },
];

// ─── In-memory session persistence (survives component remounts, not page reload)
// localStorage/sessionStorage are blocked in sandboxed iframes.
let _sites: TourSite[] | null = null;
let _attractions: Attraction[] | null = null;

function loadPersistedSites(): TourSite[] {
  if (_sites === null) _sites = [...(STATIC_SITES as unknown as TourSite[])];
  return _sites;
}

function savePersistedSites(sites: TourSite[]) {
  _sites = sites;
}

function loadPersistedAttractions(): Attraction[] {
  if (_attractions === null) _attractions = [...ATTRACTIONS];
  return _attractions;
}

function savePersistedAttractions(attrs: Attraction[]) {
  _attractions = attrs;
}

// ─── View type ────────────────────────────────────────────────────────────────
type View =
  | { screen: "login" }
  | { screen: "sites" }
  | { screen: "editor"; siteId: number | null }
  | { screen: "attractions"; destinationSlug: string; destinationName: string }
  | { screen: "attr-editor"; attractionId: number | null; destinationSlug: string; destinationName: string };

// ─── Admin fetch helper ────────────────────────────────────────────────────────
const RAILWAY_API = "https://albania-audio-tours-production.up.railway.app";

function adminFetch(url: string, options?: RequestInit) {
  const token = getAdminToken() || "";
  // Always use absolute Railway URL so calls work from any hosting
  const fullUrl = url.startsWith("http") ? url : `${RAILWAY_API}${url}`;
  return fetch(fullUrl, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
      ...(options?.headers || {}),
    },
  });
}

// For multipart/file uploads (no Content-Type header — browser sets boundary)
function adminUpload(url: string, formData: FormData) {
  const token = getAdminToken() || "";
  const fullUrl = url.startsWith("http") ? url : `${RAILWAY_API}${url}`;
  return fetch(fullUrl, {
    method: "POST",
    credentials: "include",
    headers: { "x-admin-token": token },
    body: formData,
  });
}

// ─── BACKEND STATUS BANNER ───────────────────────────────────────────────────
function BackendStatusBanner() {
  const [status, setStatus] = useState<"checking" | "connected" | "offline">("checking");
  const [dbType, setDbType] = useState("");

  useEffect(() => {
    fetch(`${RAILWAY_API}/api/health`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setStatus("connected"); setDbType(d.db || ""); })
      .catch(() => setStatus("offline"));
  }, []);

  if (status === "checking") return (
    <div className="rounded-lg bg-muted/50 border border-border/40 px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting to backend...
    </div>
  );
  if (status === "connected") return (
    <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 px-4 py-3 text-xs text-green-800 dark:text-green-300 flex items-center gap-2">
      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
      <span><strong>Connected to Railway backend</strong> — all changes save permanently to {dbType === "postgres" ? "PostgreSQL database" : "server storage"}. Edits sync across all devices instantly.</span>
    </div>
  );
  return (
    <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
      <strong>Backend offline</strong> — changes saved locally this session only.
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
// ─── Two-step admin login ────────────────────────────────────────────────────
// Step 1: password check (client-side)
// Step 2: 6-digit OTP emailed to book@albanianeagletours.com — verified server-side
const ADMIN_OTP_EMAIL = "book@albanianeagletours.com";

// ─── Forgot Password — 3-step automated reset ──────────────────────────
// Step 1: choose email (primary / secondary)
// Step 2: enter phone number for verification
// Step 3: success — reset link sent

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep]           = useState<"choose" | "phone" | "sent">("choose");
  const [emailChoice, setChoice]  = useState<"primary" | "secondary">("primary");
  const [phone, setPhone]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [sentTo, setSentTo]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${RAILWAY_API}/api/admin/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailChoice, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setSentTo(data.sentTo || "");
      setStep("sent");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-card rounded-2xl shadow-2xl border border-border p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-bold text-base text-foreground">
              {step === "sent" ? "Check your email" : "Reset Password"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === "choose" && "Choose where to send your reset link"}
              {step === "phone"  && "Verify your identity with your phone number"}
              {step === "sent"   && "A reset link has been sent"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step indicator dots */}
        {step !== "sent" && (
          <div className="flex items-center gap-1.5 justify-center">
            {(["choose", "phone"] as const).map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  step === s ? "w-5 bg-primary" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>
        )}

        {/* ── Step 1: Choose email ── */}
        {step === "choose" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              A time-limited reset link will be sent to your chosen email. You will also need to verify your phone number on the next step.
            </p>
            <div className="space-y-2">
              {[
                { value: "primary",   label: "Primary email",   desc: "book@albanianeagletours.com" },
                { value: "secondary", label: "Secondary email",  desc: "aneo.hila@gmail.com" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChoice(opt.value as "primary" | "secondary")}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                    emailChoice === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    emailChoice === opt.value ? "bg-primary/15" : "bg-muted"
                  }`}>
                    <Mail size={14} className={emailChoice === opt.value ? "text-primary" : "text-muted-foreground"} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{opt.desc}</p>
                  </div>
                  {emailChoice === opt.value && (
                    <div className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4l1.8 1.8L6.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep("phone")}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── Step 2: Phone verification ── */}
        {step === "phone" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-0.5">
              <p className="font-semibold text-foreground">Identity verification</p>
              <p>Enter the phone number registered with this account to confirm you are the account owner.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Phone number
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0682060901"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  autoFocus
                  required
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Enter digits only — e.g. 0682060901 or +355682060901
              </p>
            </div>
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStep("choose"); setError(""); }}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading || !phone}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Sending…</>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: Success ── */}
        {step === "sent" && (
          <div className="space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <Mail size={24} className="text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">Reset link sent</p>
              {sentTo && (
                <p className="text-xs text-muted-foreground">
                  Check <span className="font-mono text-primary">{sentTo}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                The link expires in <strong>1 hour</strong> and can only be used once.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground text-left space-y-1">
              <p className="font-semibold text-foreground">What happens next</p>
              <p>1. Click the link in your email</p>
              <p>2. Set a new password</p>
              <p>3. Railway redeploys automatically (2–3 min)</p>
              <p>4. Confirmation sent to both email addresses</p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
            >
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

function LoginView({ onLogin }: { onLogin: () => void }) {
  const [step, setStep] = useState<"password" | "otp">("password");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showForgot, setShowForgot] = useState(false);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Step 1 — verify password, then request OTP email
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== ADMIN_PASSWORD) {
      setError("Incorrect password. Please try again.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${RAILWAY_API}/api/admin/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStep("otp");
      setOtpSentAt(Date.now());
      setResendCooldown(60);
    } catch (err: any) {
      setError("Failed to send verification email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Step 2 — verify OTP
  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) { setError("Enter the 6-digit code from your email."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${RAILWAY_API}/api/admin/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Invalid code");
      setAdminToken(TOKEN_VALUE);
      onLogin();
    } catch (err: any) {
      setError(err.message || "Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Resend OTP
  async function resendOtp() {
    if (resendCooldown > 0) return;
    setError(""); setLoading(true);
    try {
      await fetch(`${RAILWAY_API}/api/admin/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setOtpSentAt(Date.now());
      setResendCooldown(60);
    } catch {
      setError("Failed to resend. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10" aria-label="AlbaniaAudioTours">
              <path d="M20 4 L36 32 L20 26 L4 32 Z" fill="hsl(var(--primary))" opacity="0.9" />
              <path d="M20 4 L20 26" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">AlbaniaAudioTours Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Content Management Dashboard</p>
        </div>

        <Card className="border border-border/60 shadow-lg">
          <CardHeader className="pb-0 pt-6 px-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Lock className="w-4 h-4" />
              <span>{step === "password" ? "Sign in to manage tours" : "Email verification"}</span>
            </div>
          </CardHeader>
          <CardContent className="p-6">

            {/* ── Step 1: Password ── */}
            {step === "password" && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
                      autoComplete="current-password"
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
                <Button type="submit" className="w-full" disabled={loading || !password}>
                  {loading ? "Sending verification…" : "Continue →"}
                </Button>
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                  >
                    Forgot password?
                  </button>
                </div>
              </form>
            )}

            {/* ── Step 2: OTP ── */}
            {step === "otp" && (
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground space-y-0.5">
                  <p className="font-semibold text-foreground text-sm">Check your email</p>
                  <p>A 6-digit verification code was sent to</p>
                  <p className="font-mono text-primary">{ADMIN_OTP_EMAIL}</p>
                  <p className="text-[11px] mt-1">Code expires in 10 minutes. Check your spam folder if needed.</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    Verification Code
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full text-center text-xl font-mono tracking-[0.4em] h-12"
                    autoFocus
                    autoComplete="one-time-code"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                  {loading ? "Verifying…" : "Verify & Sign In"}
                </Button>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <button type="button" onClick={() => { setStep("password"); setOtp(""); setError(""); }}
                    className="hover:text-foreground transition-colors underline underline-offset-2">
                    ← Back
                  </button>
                  <button type="button" onClick={resendOtp} disabled={resendCooldown > 0}
                    className="hover:text-foreground transition-colors disabled:opacity-40">
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                </div>
              </form>
            )}

          </CardContent>
        </Card>
      </div>

      {/* Forgot Password modal */}
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}

// ─── SITES LIST ───────────────────────────────────────────────────────────────
// ─── ADMIN SETTINGS ─────────────────────────────────────────────────────────────
// ─── CacheFlushButton ───────────────────────────────────────────────────────
// One button per cache scope. Calls queryClient.invalidateQueries() with the
// provided keys then shows a "Flushed!" confirmation for 2 seconds.
function CacheFlushButton({
  label, description, keys, variant,
}: {
  label: string;
  description: string;
  keys: (string | string[])[];
  variant: "all" | "destinations" | "attractions";
}) {
  const [state, setState] = useState<"idle" | "flushing" | "done">("idle");

  async function flush() {
    setState("flushing");
    // Invalidate all specified query key prefixes
    await Promise.all(
      keys.map(k => queryClient.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] }))
    );
    // Also reset so queries are considered stale and will refetch immediately
    await Promise.all(
      keys.map(k => queryClient.resetQueries({ queryKey: Array.isArray(k) ? k : [k] }))
    );
    setState("done");
    setTimeout(() => setState("idle"), 2500);
  }

  const colors = {
    all:          { bg: "bg-primary/5 hover:bg-primary/10 border-primary/20",   text: "text-primary",     icon: "text-primary" },
    destinations: { bg: "bg-blue-50 hover:bg-blue-100 border-blue-200",          text: "text-blue-700",    icon: "text-blue-500" },
    attractions:  { bg: "bg-green-50 hover:bg-green-100 border-green-200",       text: "text-green-700",   icon: "text-green-500" },
  };
  const c = colors[variant];

  return (
    <button
      type="button"
      onClick={flush}
      disabled={state !== "idle"}
      className={`flex flex-col items-start gap-1 rounded-xl border p-3 transition-all text-left ${c.bg} disabled:opacity-60`}
    >
      <div className="flex items-center gap-2">
        <RefreshCw
          size={14}
          className={`${c.icon} ${state === "flushing" ? "animate-spin" : ""}`}
        />
        <span className={`text-xs font-semibold ${c.text}`}>
          {state === "done" ? "✓ Flushed!" : state === "flushing" ? "Flushing…" : label}
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground leading-tight">{description}</span>
    </button>
  );
}

function AdminSettings() {
  const token = getAdminToken() || "";
  const headers = { "Content-Type": "application/json", "x-admin-token": token };

  const [bannerEnabled, setBannerEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [error, setError] = useState("");

  // Load current value
  useEffect(() => {
    fetch(`${RAILWAY_API}/api/admin/settings`, { headers: { "x-admin-token": token } })
      .then(r => r.json())
      .then((settings: { key: string; value: string }[]) => {
        const s = settings.find(s => s.key === "launch_banner_enabled");
        setBannerEnabled(s ? s.value === "true" : true);
      })
      .catch(() => setBannerEnabled(true));
  }, []);

  async function toggle() {
    if (bannerEnabled === null) return;
    setSaving(true); setError("");
    const next = !bannerEnabled;
    try {
      const res = await fetch(`${RAILWAY_API}/api/admin/settings/launch_banner_enabled`, {
        method: "PUT", headers,
        body: JSON.stringify({ value: String(next) }),
      });
      if (!res.ok) throw new Error(await res.text());
      setBannerEnabled(next);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-bold text-base">Settings</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Global flags that control live features on the site.</p>
      </div>

      {/* Launch Banner toggle */}
      <Card>
        <CardContent className="px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                bannerEnabled ? "bg-amber-100" : "bg-muted"
              }`}>
                <Megaphone size={18} className={bannerEnabled ? "text-amber-600" : "text-muted-foreground"} />
              </div>
              <div>
                <p className="font-semibold text-sm">Launch Banner</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                  The announcement bar shown at the top of every page. Toggle it on for launch periods or promotional campaigns, off once the promotion ends.
                </p>
                {savedAt && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 size={11} /> Saved at {savedAt}
                  </p>
                )}
                {error && (
                  <p className="text-xs text-red-500 mt-1">{error}</p>
                )}
              </div>
            </div>

            {/* Toggle switch */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <button
                onClick={toggle}
                disabled={saving || bannerEnabled === null}
                className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none ${
                  bannerEnabled ? "bg-amber-500" : "bg-muted-foreground/30"
                } disabled:opacity-50`}
                aria-label={bannerEnabled ? "Disable launch banner" : "Enable launch banner"}
              >
                {saving ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    bannerEnabled ? "translate-x-6" : "translate-x-0.5"
                  }`} />
                )}
              </button>
              <span className={`text-xs font-semibold ${
                bannerEnabled ? "text-amber-600" : "text-muted-foreground"
              }`}>
                {bannerEnabled === null ? "Loading…" : bannerEnabled ? "ON" : "OFF"}
              </span>
            </div>
          </div>

          {/* Status callout */}
          <div className={`mt-4 p-3 rounded-lg text-xs ${
            bannerEnabled
              ? "bg-amber-50 border border-amber-200 text-amber-800"
              : "bg-muted border border-border text-muted-foreground"
          }`}>
            {bannerEnabled ? (
              <span>⚡ <strong>Banner is live.</strong> All visitors see the launch announcement at the top of every page. Turn it off when the promotion ends or you are ready to switch to paid plans.</span>
            ) : (
              <span>💬 <strong>Banner is hidden.</strong> No announcement is shown to visitors. Turn it back on at any time for a new campaign or pricing announcement.</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Cache / Data Refresh ─────────────────────────────────────────
           Invalidates the client-side TanStack Query cache so all pages 
           re-fetch fresh data from Railway on next view. */}
      <Card>
        <CardContent className="px-5 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <RefreshCw size={18} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Refresh Page Data</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                After editing destinations or attractions, use these buttons to force all pages to reload fresh data immediately. Clears the 5-minute browser cache.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Flush all */}
            <CacheFlushButton
              label="Flush All"
              description="Pages + Destinations + Attractions"
              keys={["railway"]}
              variant="all"
            />
            {/* Flush destinations only */}
            <CacheFlushButton
              label="Flush Destinations"
              description="Destination list and detail pages"
              keys={[["railway", "sites"]]}
              variant="destinations"
            />
            {/* Flush attractions only */}
            <CacheFlushButton
              label="Flush Attractions"
              description="Attraction list and detail pages"
              keys={[["railway", "attractions"]]}
              variant="attractions"
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            ℹ️ Visitors will also see updated data within 5 minutes automatically. These buttons are for when you need it to be immediate.
          </p>
        </CardContent>
      </Card>

      {/* Placeholder for future settings */}
      <div className="text-xs text-muted-foreground border border-dashed border-border rounded-xl p-4 text-center">
        More settings will appear here as the platform grows — maintenance mode, subscription pricing visibility, and more.
      </div>
    </div>
  );
}

function SitesView({
  onEdit,
  onNew,
  onLogout,
  onManageAttractions,
}: {
  onEdit: (id: number) => void;
  onNew: () => void;
  onLogout: () => void;
  onManageAttractions: (slug: string, name: string) => void;
}) {
  const [sites, setSites] = useState<TourSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [adminTab, setAdminTab] = useState<"destinations" | "pages" | "settings" | "subscriptions">("destinations");

  useEffect(() => { fetchSites(); }, []);

  async function fetchSites() {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/sites");
      if (res.ok) {
        setSites(await res.json());
      } else {
        setSites(loadPersistedSites());
      }
    } catch {
      setSites(loadPersistedSites());
    }
    setLoading(false);
  }

  async function deleteSite(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await adminFetch(`/api/admin/sites/${id}`, { method: "DELETE", headers: { "x-confirm-delete": "yes" } });
    } catch { /* offline */ }
    const updated = sites.filter(s => s.id !== id);
    setSites(updated);
    savePersistedSites(updated);
    setDeleting(null);
  }

  // Count attractions per destination
  const allAttrs = loadPersistedAttractions();
  const attrCounts: Record<string, number> = {};
  allAttrs.forEach(a => {
    attrCounts[a.destinationSlug] = (attrCounts[a.destinationSlug] || 0) + 1;
  });

  const stats = {
    total: sites.length,
    withAudio: sites.filter(s => s.audioUrlEn || s.audioUrlAl || s.audioUrlGr).length,
    regions: new Set(sites.map(s => s.region)).size,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 40 40" fill="none" className="w-7 h-7">
              <path d="M20 4 L36 32 L20 26 L4 32 Z" fill="hsl(var(--primary))" opacity="0.9" />
            </svg>
            <div>
              <span className="font-semibold text-foreground text-sm">AlbaniaAudioTours Admin</span>
              <span className="text-muted-foreground text-xs ml-2">Content Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => window.open("/#/", "_blank")} className="gap-1.5 text-xs">
              <Eye className="w-3.5 h-3.5" /> View App
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout} className="gap-1.5 text-xs text-muted-foreground">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Admin top nav tabs */}
      <div className="border-b border-border/60 bg-background">
        <div className="max-w-5xl mx-auto px-4 flex gap-0">
          {([
            { id: "destinations",  label: "Destinations & Tours", icon: MapPin },
            { id: "pages",         label: "Page Manager",          icon: FileText },
            { id: "subscriptions", label: "Subscriptions",          icon: Megaphone },
            { id: "settings",      label: "Settings",              icon: Settings },
          ] as { id: "destinations" | "pages" | "settings" | "subscriptions"; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAdminTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                adminTab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* CMS PAGE MANAGER */}
        {adminTab === "pages" && (
          <AdminCmsManager />
        )}

        {adminTab === "settings" && (
          <AdminSettings />
        )}

        {adminTab === "subscriptions" && (
          <AdminSubscriptions />
        )}

        {adminTab === "destinations" && (<>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: MapPin, label: "Destinations", value: stats.total },
            { icon: Music, label: "With Audio", value: stats.withAudio },
            { icon: Globe, label: "Regions", value: stats.regions },
          ].map(({ icon: Icon, label, value }) => (
            <Card key={label} className="border-border/60">
              <CardContent className="pt-4 pb-4 px-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold text-foreground">{loading ? "–" : value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Backend status banner */}
        <BackendStatusBanner />

        {/* Destinations list */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-semibold text-foreground">Destinations</h2>
          <div className="flex items-center gap-2">
            {/* Inline cache flush — instantly refreshes destination data on all visitor pages */}
            <CacheFlushButton
              label="Refresh"
              description="Flush destination cache"
              keys={[["railway", "sites"]]}
              variant="destinations"
            />
            <Button size="sm" onClick={onNew} className="gap-1.5" data-testid="button-new-site">
              <Plus className="w-4 h-4" /> Add Destination
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : sites.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No destinations yet. Add your first one!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sites.map(site => {
              const audioCount = [site.audioUrlEn, site.audioUrlAl, site.audioUrlGr].filter(Boolean).length;
              const attrCount = attrCounts[site.slug] || 0;
              return (
                <div
                  key={site.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:border-primary/30 transition-colors"
                  data-testid={`row-site-${site.id}`}
                >
                  {site.imageUrl ? (
                    <img
                      src={site.imageUrl.includes('/api/images/db/') ? `${site.imageUrl}?_t=${Date.now()}` : site.imageUrl}
                      alt={site.nameEn}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground truncate">{site.nameEn}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[site.category] || "bg-muted text-muted-foreground"}`}>
                        {site.category}
                      </span>
                      {audioCount > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          🎵 {audioCount}/3
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {attrCount} attraction{attrCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {site.region} · {site.points} XP · {site.difficulty}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onManageAttractions(site.slug, site.nameEn)}
                      className="h-8 px-3 text-xs gap-1"
                      data-testid={`button-attractions-${site.id}`}
                    >
                      <LayoutList className="w-3.5 h-3.5" /> Attractions
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(site.id)}
                      className="h-8 px-3 text-xs gap-1"
                      data-testid={`button-edit-${site.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSite(site.id, site.nameEn)}
                      disabled={deleting === site.id}
                      className="h-8 px-3 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                      data-testid={`button-delete-${site.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {deleting === site.id ? "…" : "Delete"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>)}
      </main>
    </div>
  );
}

// ─── ATTRACTIONS LIST ─────────────────────────────────────────────────────────
function AttractionsView({
  destinationSlug,
  destinationName,
  onBack,
  onEdit,
  onNew,
}: {
  destinationSlug: string;
  destinationName: string;
  onBack: () => void;
  onEdit: (id: number) => void;
  onNew: () => void;
}) {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminFetch(`/api/admin/attractions/${destinationSlug}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Attraction[]) => { setAttractions(data); })
      .catch(() => {
        // Fall back to local cache
        const all = loadPersistedAttractions();
        setAttractions(all.filter(a => a.destinationSlug === destinationSlug));
      })
      .finally(() => setLoading(false));
  }, [destinationSlug]);

  async function deleteAttraction(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await adminFetch(`/api/admin/attractions/${id}`, { method: "DELETE", headers: { "x-confirm-delete": "yes" } });
      if (res.ok) {
        setAttractions(prev => prev.filter(a => a.id !== id));
      } else {
        alert("Delete failed");
      }
    } catch {
      alert("Delete failed: network error");
    }
    setDeleting(null);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Destinations
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-medium text-foreground">
              {destinationName} — Attractions
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Inline cache flush for attractions */}
            <CacheFlushButton
              label="Refresh"
              description="Flush attraction cache"
              keys={[["railway", "attractions"]]}
              variant="attractions"
            />
            <Button size="sm" onClick={onNew} className="gap-1.5" data-testid="button-new-attraction">
              <Plus className="w-4 h-4" /> Add Attraction
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        {attractions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No attractions yet for {destinationName}. Add the first one!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {attractions.map(attr => (
              <div
                key={attr.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:border-primary/30 transition-colors"
              >
                {attr.imageUrl ? (
                  <img
                    src={attr.imageUrl.includes('/api/images/db/') ? `${attr.imageUrl}?_t=${Date.now()}` : attr.imageUrl}
                    alt={attr.nameEn}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Star className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{attr.nameEn}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[attr.category.split(",")[0].trim()] || "bg-muted text-muted-foreground"}`}>
                      {attr.category.split(",")[0].trim()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {attr.points} XP · {attr.visitDuration} min · {attr.lat.toFixed(4)}, {attr.lng.toFixed(4)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(attr.id)} className="h-8 px-3 text-xs gap-1">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAttraction(attr.id, attr.nameEn)}
                    disabled={deleting === attr.id}
                    className="h-8 px-3 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleting === attr.id ? "…" : "Delete"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// Tile layer definitions — shared by all map pickers
const TILES = {
  street: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "\u00a9 CartoDB \u00a9 OpenStreetMap contributors",
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, USGS, NOAA",
    maxZoom: 19,
  },
} as const;

// ─── MAP PICKER (interactive Leaflet) ─────────────────────────────────────────
function MapPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number;
  lng: number;
  onPick: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef      = useRef<any>(null);
  const markerRef   = useRef<any>(null);
  const tileRef     = useRef<any>(null);
  const [isSat, setIsSat] = useState(false);

  // Swap tile layer when satellite toggle changes
  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L || !tileRef.current) return;
    tileRef.current.remove();
    const t = isSat ? TILES.satellite : TILES.street;
    tileRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: t.maxZoom }).addTo(map);
  }, [isSat]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let mounted = true;

    const initLeaflet = (L: any) => {
      if (!mounted || !containerRef.current) return;

      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const initLat = lat && !isNaN(lat) ? lat : 41.1533;
      const initLng = lng && !isNaN(lng) ? lng : 20.1683;

      const map = L.map(containerRef.current!, { zoomControl: true }).setView([initLat, initLng], 13);
      const tile = L.tileLayer(TILES.street.url, { attribution: TILES.street.attribution, maxZoom: TILES.street.maxZoom }).addTo(map);
      tileRef.current = tile;

      const marker = L.marker([initLat, initLng], { draggable: true }).addTo(map);
      marker.bindPopup("Drag to adjust location").openPopup();

      marker.on("dragend", (e: any) => {
        const pos = e.target.getLatLng();
        onPick(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
      });

      map.on("click", (e: any) => {
        const { lat: clat, lng: clng } = e.latlng;
        marker.setLatLng([clat, clng]);
        onPick(parseFloat(clat.toFixed(6)), parseFloat(clng.toFixed(6)));
      });

      mapRef.current = map;
      markerRef.current = marker;

      // Fix blank map when container is hidden (inside a tab) — invalidate size once visible
      const ro = new ResizeObserver(() => {
        if (containerRef.current && containerRef.current.offsetWidth > 0) {
          map.invalidateSize();
          ro.disconnect();
        }
      });
      ro.observe(containerRef.current!);

      // Also fix on first render if already visible
      setTimeout(() => map.invalidateSize(), 50);
      setTimeout(() => map.invalidateSize(), 300);
    };

    import("leaflet").then(initLeaflet);

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        tileRef.current = null;
      }
    };
  }, []);

  // Keep marker in sync when lat/lng fields change externally
  useEffect(() => {
    if (markerRef.current && lat && lng && !isNaN(lat) && !isNaN(lng)) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current?.panTo([lat, lng]);
    }
  }, [lat, lng]);

  return (
    <div>
      <div style={{ position: "relative" }}>
        <div ref={containerRef} style={{ height: 280, borderRadius: 12, overflow: "hidden", border: "1px solid hsl(var(--border))" }} />
        {/* Map / Satellite toggle — overlaid top-right */}
        <div style={{
          position: "absolute", top: 8, right: 8, zIndex: 1000,
          display: "flex", borderRadius: 8, overflow: "hidden",
          border: "1px solid rgba(0,0,0,0.25)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        }}>
          {(["Map", "Satellite"] as const).map((label) => {
            const active = label === "Map" ? !isSat : isSat;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setIsSat(label === "Satellite")}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  background: active ? "hsl(var(--primary))" : "rgba(255,255,255,0.92)",
                  color: active ? "#fff" : "#333",
                  border: "none",
                  cursor: "pointer",
                  lineHeight: 1.5,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        Click the map or drag the pin to set the exact location. Albania addresses are imprecise — manual pinning is the most reliable method.
      </p>
    </div>
  );
}

// ─── AUDIO CARD ────────────────────────────────────────────────────────────────
function AudioCard({
  siteId, lang, label, flag, currentUrl, onUpdate, entityType = "sites", descText, onTtsGenerated,
}: {
  siteId: number | null;
  lang: "en" | "al" | "gr" | "it" | "es" | "de" | "fr" | "ar" | "sl";
  label: string;
  flag: string;
  currentUrl: string | null;
  onUpdate: (url: string | null) => void;
  entityType?: "sites" | "attractions";
  descText?: string;
  onTtsGenerated?: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [generatingTts, setGeneratingTts] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function handleGenerateTts() {
    if (!descText || !siteId) return;
    setGeneratingTts(true);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/generate-tts`, {
        method: "POST",
        body: JSON.stringify({ text: descText, lang, entityType, entityId: siteId }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        const absUrl = data.url.startsWith("http") ? data.url : `${RAILWAY_API}${data.url}`;
        onUpdate(absUrl);
        if (onTtsGenerated) onTtsGenerated(absUrl);
      } else {
        setError(data.error || "TTS generation failed");
      }
    } catch {
      setError("Network error during TTS generation");
    }
    setGeneratingTts(false);
  }

  async function handleUpload(file: File) {
    if (!file || siteId === null) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("audio", file);
    try {
      const res = await adminUpload(`/api/admin/${entityType}/${siteId}/audio/${lang}`, formData);
      const data = await res.json();
      if (res.ok) {
        // URL is already absolute (Railway backend prepends base URL)
        const absUrl = data.url.startsWith("http") ? data.url : `${RAILWAY_API}${data.url}`;
        onUpdate(absUrl);
      }
      else { setError(data.error || "Upload failed"); }
    } catch {
      setError("Network error during upload");
    }
    setUploading(false);
  }

  async function handleDelete() {
    if (!confirm("Remove this audio file?") || siteId === null) return;
    const res = await adminFetch(`/api/admin/${entityType}/${siteId}/audio/${lang}`, { method: "DELETE", headers: { "x-confirm-delete": "yes" } });
    if (res.ok) onUpdate(null);
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{flag}</span>
        <span className="font-medium text-sm text-foreground">{label}</span>
        {currentUrl && <span className="ml-auto text-xs text-green-600 font-medium">✓ Uploaded</span>}
      </div>
      {currentUrl ? (
        <div className="space-y-2">
          <audio ref={audioRef} src={currentUrl} onEnded={() => setPlaying(false)} className="hidden" />
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <Button variant="ghost" size="sm" onClick={togglePlay} className="h-7 w-7 p-0 flex-shrink-0">
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </Button>
            <span className="text-xs text-muted-foreground truncate flex-1">
              {currentUrl.startsWith('data:') ? 'Audio stored in DB' : currentUrl.includes('/api/audio/serve/') ? `Audio ready (${currentUrl.split('/').pop()?.toUpperCase()})` : currentUrl.split('/').pop()}
            </span>
            <Button variant="ghost" size="sm" onClick={handleDelete} className="h-7 w-7 p-0 flex-shrink-0 text-destructive hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="w-full text-xs gap-1.5 h-7">
            <Upload className="w-3 h-3" /> Replace audio
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className="border-2 border-dashed border-border/60 rounded-lg p-4 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /><span>Uploading…</span>
              </div>
            ) : (
              <>
                <Music className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">Drop MP3 here or <span className="text-primary font-medium">click to browse</span></p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">MP3, WAV, M4A · Max 100 MB</p>
              </>
            )}
          </div>
          {descText && siteId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateTts}
              disabled={generatingTts}
              className="w-full text-xs gap-1.5 h-8 border-primary/30 text-primary hover:bg-primary/5"
            >
              {generatingTts ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="text-sm">🎙️</span>}
              {generatingTts ? "Generating audio…" : "Generate Audio from Description"}
            </Button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input ref={fileRef} type="file" accept="audio/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
    </div>
  );
}

// ─── PREVIEW CARDS ───────────────────────────────────────────────────────────
function DestinationPreviewCard({ form }: { form: any }) {
  const RAILWAY_BASE = "https://albania-audio-tours-production.up.railway.app";
  const frontendUrl = `${RAILWAY_BASE}/#/sites/${form.slug}`;
  const catColor = CATEGORY_COLORS[form.category] || "bg-gray-100 text-gray-800";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Live preview of how this destination appears to visitors.</p>
        <a href={frontendUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <Eye className="w-3.5 h-3.5" /> Open in App
        </a>
      </div>
      <div className="rounded-2xl border border-border/60 overflow-hidden shadow-sm max-w-sm">
        <GallerySlideshow
          imageUrl={form.imageUrl || null}
          images={form.images || []}
          alt={form.nameEn || "Destination"}
          showControls={(form.images || []).length > 0}
        >
          {((form.images || []).length > 0 || form.imageUrl) ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
                <h3 className="text-white font-semibold text-base leading-tight">{form.nameEn || "Destination Name"}</h3>
                {form.region && <p className="text-white/70 text-xs mt-0.5">{form.region}</p>}
              </div>
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-8 h-8 text-primary/40 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground/60">{form.nameEn || "Destination Name"}</p>
              </div>
            </div>
          )}
        </GallerySlideshow>
        <div className="p-4 space-y-3 bg-card">
          <div className="flex items-center gap-2 flex-wrap">
            {form.category && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>{form.category}</span>}
            {form.difficulty && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{form.difficulty}</span>}
            {form.points && <span className="text-xs font-medium text-amber-600">★ {form.points} XP</span>}
          </div>
          {form.descEn && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{form.descEn}</p>}
          {form.funFactEn && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 px-3 py-2">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-0.5">💡 Fun fact</p>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 line-clamp-2">{form.funFactEn}</p>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/40">
            {form.lat && form.lng && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{parseFloat(form.lat).toFixed(4)}, {parseFloat(form.lng).toFixed(4)}</span>}
            {form.visitDuration && <span>⏱ {form.visitDuration} min</span>}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border/60 p-4 space-y-2">
        <p className="text-xs font-medium text-foreground">Translation coverage</p>
        {(["En", "Al", "Gr"] as const).map(lang => (
          <div key={lang} className="flex items-center gap-2 text-xs">
            <span className="w-16 text-muted-foreground">{lang === "En" ? "🇬🇧 EN" : lang === "Al" ? "🇦🇱 SQ" : "🇬🇷 GR"}</span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: (form as any)[`name${lang}`] && (form as any)[`desc${lang}`] ? "100%" : (form as any)[`name${lang}`] ? "40%" : "0%" }} />
            </div>
            <span className="text-muted-foreground">{(form as any)[`name${lang}`] && (form as any)[`desc${lang}`] ? "✅ Complete" : (form as any)[`name${lang}`] ? "⚠️ Partial" : "❌ Missing"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttractionPreviewCard({ form, destinationName, destinationSlug }: { form: any; destinationName: string; destinationSlug?: string }) {
  const RAILWAY_BASE = "https://albania-audio-tours-production.up.railway.app";
  // Correct route: /#/sites/:destinationSlug/:attractionSlug
  const frontendUrl = destinationSlug
    ? `${RAILWAY_BASE}/#/sites/${destinationSlug}/${form.slug}`
    : `${RAILWAY_BASE}/#/sites/${form.destinationSlug || ""}/${form.slug}`;
  const catColor = CATEGORY_COLORS[form.category] || "bg-gray-100 text-gray-800";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Preview of this attraction inside {destinationName || "the destination"}.</p>
        <a href={frontendUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <Eye className="w-3.5 h-3.5" /> Open in App
        </a>
      </div>
      <div className="rounded-2xl border border-border/60 overflow-hidden shadow-sm max-w-sm">
        <GallerySlideshow
          imageUrl={form.imageUrl || null}
          images={form.images || []}
          alt={form.nameEn || "Attraction"}
          showControls={(form.images || []).length > 0}
        >
          {((form.images || []).length > 0 || form.imageUrl) ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent pointer-events-none" />
              <div className="absolute bottom-2 left-3 pointer-events-none">
                <h3 className="text-white font-semibold text-sm">{form.nameEn || "Attraction Name"}</h3>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
              <div className="text-center">
                <Star className="w-7 h-7 text-primary/40 mx-auto mb-1" />
                <p className="text-sm font-medium text-foreground/60">{form.nameEn || "Attraction Name"}</p>
              </div>
            </div>
          )}
        </GallerySlideshow>
        <div className="p-4 space-y-3 bg-card">
          {form.category && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>{form.category}</span>}
          {form.descEn && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{form.descEn}</p>}
          {form.funFactEn && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 px-3 py-2">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-0.5">💡 Fun fact</p>
              <p className="text-xs text-amber-700/80 line-clamp-2">{form.funFactEn}</p>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/40">
            {form.points && <span className="font-medium text-amber-600">★ {form.points} XP</span>}
            {form.visitDuration && <span>⏱ {form.visitDuration} min</span>}
            {form.lat && form.lng && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{parseFloat(form.lat).toFixed(3)}, {parseFloat(form.lng).toFixed(3)}</span>}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border/60 p-4 space-y-2">
        <p className="text-xs font-medium text-foreground">Translation coverage</p>
        {(["En", "Al", "Gr"] as const).map(lang => (
          <div key={lang} className="flex items-center gap-2 text-xs">
            <span className="w-16 text-muted-foreground">{lang === "En" ? "🇬🇧 EN" : lang === "Al" ? "🇦🇱 SQ" : "🇬🇷 GR"}</span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: (form as any)[`name${lang}`] && (form as any)[`desc${lang}`] ? "100%" : (form as any)[`name${lang}`] ? "40%" : "0%" }} />
            </div>
            <span className="text-muted-foreground">{(form as any)[`name${lang}`] && (form as any)[`desc${lang}`] ? "✅ Complete" : (form as any)[`name${lang}`] ? "⚠️ Partial" : "❌ Missing"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── IMAGE GALLERY CARD ─────────────────────────────────────────────────────
// ─── ImageGalleryCard (v4 — click-based reorder, per-thumbnail delete) ───────
//
// DELETE: Each thumbnail has its own ❌ button. It reads the DB index directly
//   from the serve URL (.../gallery/N) — completely independent of visual position.
//   No slideshow X button needed. Cannot accidentally delete the wrong image.
//
// REORDER: No drag API (unreliable in React). Instead:
//   1. Click a thumbnail to SELECT it (highlighted in amber).
//   2. Click ‹ or › arrows to move it one step left or right.
//   3. Click the thumbnail again (or any other thumbnail) to deselect.
//   Position 0 = HERO. Moving a thumbnail to position 0 makes it the hero.
function ImageGalleryCard({
  entityType, entityId, imageUrl, images, onUpdate,
}: {
  entityType: "sites" | "attractions";
  entityId: number | null;
  imageUrl: string;
  images: string[];
  onUpdate: (imageUrl: string, images: string[]) => void;
}) {
  const [uploading, setUploading]       = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError]               = useState("");
  const [slideIdx, setSlideIdx]         = useState(0);
  const [selectedIdx, setSelectedIdx]   = useState<number | null>(null);
  const [moving, setMoving]             = useState(false);
  // cacheBust increments after every reorder/delete so <img src> changes
  // and the browser re-fetches the image even though the URL path is the same.
  const [cacheBust, setCacheBust]       = useState(() => Date.now());
  const fileRef                         = useRef<HTMLInputElement>(null);

  const allImages = images.filter(Boolean);

  // Helper: append cache-bust param to any gallery serve URL
  // Only added in admin view — visitor-facing pages are unaffected.
  function bust(url: string): string {
    if (!url) return url;
    return url.includes('?') ? `${url}&_t=${cacheBust}` : `${url}?_t=${cacheBust}`;
  }

  // Keep slideIdx in bounds when array shrinks
  useEffect(() => {
    if (allImages.length === 0) { setSlideIdx(0); setSelectedIdx(null); return; }
    if (slideIdx >= allImages.length) setSlideIdx(allImages.length - 1);
    if (selectedIdx !== null && selectedIdx >= allImages.length) setSelectedIdx(null);
  }, [allImages.length]);

  // Auto-advance preview every 4s — paused when an image is selected for reorder
  useEffect(() => {
    if (allImages.length <= 1 || selectedIdx !== null) return;
    const t = setInterval(() => setSlideIdx(i => (i + 1) % allImages.length), 4000);
    return () => clearInterval(t);
  }, [allImages.length, selectedIdx]);

  // ── Upload ──────────────────────────────────────────────────────────────
  async function uploadOne(file: File): Promise<string[]> {
    if (!entityId) { setError("Save the record first, then add images."); return []; }
    const fd = new FormData();
    fd.append("image", file);
    const res = await adminUpload(`/api/admin/${entityType}/${entityId}/gallery`, fd);
    if (!res.ok) throw new Error("Upload failed");
    return (await res.json()).images || [];
  }

  async function handleFiles(files: FileList | File[]) {
    if (!entityId) { setError("Save the record first, then add images."); return; }
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!arr.length) return;
    setError(""); setUploading(true);
    let last: string[] = [];
    for (let i = 0; i < arr.length; i++) {
      setUploadProgress(arr.length > 1 ? `Uploading ${i + 1} of ${arr.length}…` : "Uploading…");
      try { last = await uploadOne(arr[i]); onUpdate(last[0] || "", last); }
      catch { setError(`Failed on image ${i + 1}.`); }
    }
    if (last.length) setSlideIdx(last.length - 1);
    setUploadProgress(""); setUploading(false);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  // Reads DB index from the serve URL string, NEVER from visual position.
  // .../api/images/db/site/7/gallery/3  →  dbIdx = 3
  // This is correct even after reorders because the serve URL always reflects
  // the actual position in the DB array at the time it was served.
  async function deleteImage(visualIdx: number) {
    if (!entityId) return;
    const url = allImages[visualIdx];
    if (!url) return;
    // R2 URLs use visual index === DB index. Legacy serve URLs embed index in path.
    const legacyMatch = url.match(/\/gallery\/([0-9]+)/);
    const dbIdx = legacyMatch ? parseInt(legacyMatch[1], 10) : visualIdx;
    if (!window.confirm(`Delete image ${visualIdx + 1} of ${allImages.length}? This cannot be undone.`)) return;
    setError("");
    try {
      const res = await adminFetch(`/api/admin/${entityType}/${entityId}/gallery/${dbIdx}`, {
        method: "DELETE",
        headers: { "x-confirm-delete": "yes" }, // HARDCODED — never remove
      });
      if (!res.ok) { setError("Delete failed. Please try again."); return; }
      const d = await res.json();
      const imgs: string[] = d.images || [];
      onUpdate(d.imageUrl || imgs[0] || "", imgs);
      setSelectedIdx(null);
      setSlideIdx(s => Math.max(0, Math.min(s, imgs.length - 1)));
      setCacheBust(Date.now()); // force re-fetch of all gallery images
    } catch {
      setError("Delete failed. Please try again.");
    }
  }

  // ── Move selected image left or right ────────────────────────────────────
  // Re-orders the gallery by swapping the selected image one step left or right.
  // Sends the new ordering to the server immediately.
  async function moveSelected(direction: -1 | 1) {
    if (selectedIdx === null || !entityId) return;
    const n = allImages.length;
    const newPos = selectedIdx + direction;
    if (newPos < 0 || newPos >= n) return;

    // Build the new visual order as an index permutation:
    // order[i] = which old index goes to new position i
    // We want to swap positions selectedIdx and newPos.
    const order = Array.from({ length: n }, (_, i) => i);
    // Swap: position selectedIdx gets newPos's old item, and vice versa
    order[selectedIdx] = newPos;
    order[newPos] = selectedIdx;

    setMoving(true);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/${entityType}/${entityId}/gallery/reorder`, {
        method: "PUT",
        body: JSON.stringify({ order }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(`Move failed: ${d?.error || res.status}`);
        return;
      }
      const newImgs: string[] = d.images || [];
      onUpdate(d.imageUrl || newImgs[0] || "", newImgs);
      setSelectedIdx(newPos);
      setSlideIdx(newPos);
      setCacheBust(Date.now()); // force re-fetch so new order is visible
    } catch (e: any) {
      setError(`Move failed: ${e?.message || "network error"}`);
    } finally {
      setMoving(false);
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Image className="w-4 h-4 text-primary" /> Images
          <span className="text-xs font-normal text-muted-foreground">
            — first image is the hero · auto-slideshow for visitors
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* Large preview */}
        {allImages.length > 0 ? (
          <div className="relative rounded-xl overflow-hidden border border-border/60 bg-muted" style={{aspectRatio:"16/9"}}>
            <img
              key={bust(allImages[slideIdx])}
              src={bust(allImages[slideIdx])}
              alt={`Image ${slideIdx + 1}`}
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.opacity="0.2"; }}
            />
            {allImages.length > 1 && (
              <>
                <button type="button" onClick={() => setSlideIdx(i => (i - 1 + allImages.length) % allImages.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center">
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => setSlideIdx(i => (i + 1) % allImages.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center">
                  <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                </button>
              </>
            )}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {allImages.map((_, i) => (
                <button key={i} type="button" onClick={() => setSlideIdx(i)}
                  className={`rounded-full transition-all ${i === slideIdx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"}`} />
              ))}
            </div>
            <div className="absolute top-2 left-2">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-black/50 text-white">
                {slideIdx === 0 ? "Hero" : `Slide ${slideIdx + 1}`} · {slideIdx + 1}/{allImages.length}
              </span>
            </div>
            {moving && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-border/60 bg-muted/30 flex items-center justify-center text-muted-foreground text-xs" style={{aspectRatio:"16/9"}}>
            No images yet — upload below
          </div>
        )}

        {/* Thumbnail strip with per-image delete + move controls */}
        {allImages.length > 0 && (
          <div className="space-y-1.5">
            {/* Move controls — only shown when an image is selected */}
            {selectedIdx !== null && (
              <div className="flex items-center gap-1.5 px-1 py-1 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-[11px] text-amber-700 font-medium flex-1">
                  {moving ? "Moving…" : `Image ${selectedIdx + 1} selected${selectedIdx === 0 ? " — already hero" : ""}`}
                </span>
                {/* Move to hero directly if not already hero */}
                {selectedIdx > 0 && (
                  <button type="button"
                    onClick={async () => {
                      // Build order that moves selectedIdx to position 0
                      const order = Array.from({ length: allImages.length }, (_, i) => i);
                      order.splice(selectedIdx, 1);
                      order.unshift(selectedIdx);
                      setMoving(true); setError("");
                      try {
                        const res = await adminFetch(`/api/admin/${entityType}/${entityId}/gallery/reorder`, {
                          method: "PUT", body: JSON.stringify({ order }),
                        });
                        const d = await res.json();
                        if (!res.ok) { setError(`Failed: ${d?.error || res.status}`); return; }
                        onUpdate(d.imageUrl || d.images?.[0] || "", d.images || []);
                        setSelectedIdx(0); setSlideIdx(0);
                        setCacheBust(Date.now()); // force re-fetch
                      } catch (e: any) { setError(`Failed: ${e?.message}`); }
                      finally { setMoving(false); }
                    }}
                    disabled={moving}
                    className="text-[10px] px-2 h-6 rounded bg-primary text-white hover:bg-primary/80 disabled:opacity-40 font-medium whitespace-nowrap">
                    ★ Set Hero
                  </button>
                )}
                <button type="button"
                  onClick={() => moveSelected(-1)}
                  disabled={selectedIdx === 0 || moving}
                  title="Move left"
                  className="w-7 h-7 rounded-lg bg-amber-200 hover:bg-amber-300 disabled:opacity-30 flex items-center justify-center text-amber-800">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button type="button"
                  onClick={() => moveSelected(1)}
                  disabled={selectedIdx === allImages.length - 1 || moving}
                  title="Move right"
                  className="w-7 h-7 rounded-lg bg-amber-200 hover:bg-amber-300 disabled:opacity-30 flex items-center justify-center text-amber-800">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button type="button"
                  onClick={() => setSelectedIdx(null)}
                  title="Deselect"
                  className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/60 flex items-center justify-center text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {selectedIdx === null && allImages.length > 1 && (
              <p className="text-[10px] text-muted-foreground/70 px-1">
                Click a thumbnail to select it, then use ‹ › arrows to reposition · first = hero
              </p>
            )}

            <div className="flex gap-2 overflow-x-auto pb-1">
              {allImages.map((img, i) => {
                const isSelected = selectedIdx === i;
                const isViewing  = slideIdx === i;
                return (
                  <div key={img} className="relative shrink-0 flex flex-col gap-0.5" style={{width:64}}>
                    {/* Thumbnail */}
                    <button
                      type="button"
                      onClick={() => {
                        setSlideIdx(i);
                        setSelectedIdx(prev => prev === i ? null : i);
                      }}
                      title={isSelected ? "Click to deselect" : `Click to select image ${i + 1}`}
                      className={[
                        "relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                        isSelected  ? "border-amber-500 ring-2 ring-amber-400/60 scale-95" :
                        isViewing   ? "border-primary" :
                        "border-transparent hover:border-primary/40",
                      ].join(" ")}>
                      <img src={bust(img)} alt={`img-${i+1}`} className="w-full h-full object-cover" loading="lazy" />
                      {i === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-primary/80 text-[8px] text-white text-center font-bold py-0.5">HERO</div>
                      )}
                      {i > 0 && (
                        <div className="absolute top-0.5 left-0.5 bg-black/60 text-[8px] text-white rounded px-0.5 leading-4">{i + 1}</div>
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-amber-400/20 flex items-center justify-center">
                          <ArrowLeftRight className="w-4 h-4 text-amber-600" />
                        </div>
                      )}
                    </button>
                    {/* Per-thumbnail delete button */}
                    <button
                      type="button"
                      onClick={() => deleteImage(i)}
                      title={`Delete image ${i + 1}`}
                      className="w-full h-5 rounded bg-destructive/10 hover:bg-destructive hover:text-white text-destructive flex items-center justify-center transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upload zone */}
        <div
          className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all border-border/60 hover:border-primary/40 hover:bg-primary/5"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-primary","bg-primary/5"); }}
          onDragLeave={e => { e.currentTarget.classList.remove("border-primary","bg-primary/5"); }}
          onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove("border-primary","bg-primary/5"); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">{uploadProgress || "Uploading…"}</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <Upload className="w-4 h-4 text-primary/60" />
                <p className="text-xs font-medium">
                  {allImages.length === 0 ? "Upload images (first becomes hero)" : "Add more images"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground/70">Select files or drag &amp; drop — saved immediately</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value=""; }} />
        </div>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 flex items-center gap-1.5">
            <X className="w-3.5 h-3.5 shrink-0" /> {error}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          First image = hero · all images cycle as slideshow for visitors · stored permanently in DB
        </p>
      </CardContent>
    </Card>
  );
}


// ─── SHARED FIELD WRAPPER ─────────────────────────────────────────────────────
function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground block mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

// ─── DESTINATION EDITOR ───────────────────────────────────────────────────────
type DestFormData = {
  slug: string;
  nameEn: string; nameAl: string; nameGr: string; nameIt: string; nameEs: string; nameDe: string; nameFr: string; nameAr: string; nameSl: string; namePt: string; nameCn: string;
  descEn: string; descAl: string; descGr: string; descIt: string; descEs: string; descDe: string; descFr: string; descAr: string; descSl: string; descPt: string; descCn: string;
  funFactEn: string; funFactAl: string; funFactGr: string; funFactIt: string; funFactEs: string; funFactDe: string; funFactFr: string; funFactAr: string; funFactSl: string; funFactPt: string; funFactCn: string;
  audioUrlEn: string | null; audioUrlAl: string | null; audioUrlGr: string | null;
  audioUrlIt: string | null; audioUrlEs: string | null; audioUrlDe: string | null; audioUrlFr: string | null; audioUrlAr: string | null; audioUrlSl: string | null;
  lat: string; lng: string;
  region: string; category: string; difficulty: string;
  points: string; visitDuration: string; imageUrl: string;
  images: string[];
  isLocked: boolean; shopifyUrl: string;
};

const EMPTY_DEST_FORM: DestFormData = {
  slug: "",
  nameEn: "", nameAl: "", nameGr: "", nameIt: "", nameEs: "", nameDe: "", nameFr: "", nameAr: "", nameSl: "", namePt: "", nameCn: "",
  descEn: "", descAl: "", descGr: "", descIt: "", descEs: "", descDe: "", descFr: "", descAr: "", descSl: "", descPt: "", descCn: "",
  funFactEn: "", funFactAl: "", funFactGr: "", funFactIt: "", funFactEs: "", funFactDe: "", funFactFr: "", funFactAr: "", funFactSl: "", funFactPt: "", funFactCn: "",
  audioUrlEn: null, audioUrlAl: null, audioUrlGr: null,
  audioUrlIt: null, audioUrlEs: null, audioUrlDe: null, audioUrlFr: null, audioUrlAr: null, audioUrlSl: null,
  lat: "", lng: "", region: "", category: "", difficulty: "easy",
  points: "100", visitDuration: "120", imageUrl: "", images: [],
  isLocked: false, shopifyUrl: "",
};

function siteToForm(s: TourSite): DestFormData {
  return {
    slug: s.slug,
    nameEn: s.nameEn, nameAl: s.nameAl, nameGr: s.nameGr,
    nameIt: (s as any).nameIt || "", nameEs: (s as any).nameEs || "", nameDe: (s as any).nameDe || "",
    nameFr: (s as any).nameFr || "", nameAr: (s as any).nameAr || "", nameSl: (s as any).nameSl || "",
    namePt: (s as any).namePt || "", nameCn: (s as any).nameCn || "",
    descEn: s.descEn, descAl: s.descAl, descGr: s.descGr,
    descIt: (s as any).descIt || "", descEs: (s as any).descEs || "", descDe: (s as any).descDe || "",
    descFr: (s as any).descFr || "", descAr: (s as any).descAr || "", descSl: (s as any).descSl || "",
    descPt: (s as any).descPt || "", descCn: (s as any).descCn || "",
    funFactEn: s.funFactEn || "", funFactAl: s.funFactAl || "", funFactGr: s.funFactGr || "",
    funFactIt: (s as any).funFactIt || "", funFactEs: (s as any).funFactEs || "", funFactDe: (s as any).funFactDe || "",
    funFactFr: (s as any).funFactFr || "", funFactAr: (s as any).funFactAr || "", funFactSl: (s as any).funFactSl || "",
    funFactPt: (s as any).funFactPt || "", funFactCn: (s as any).funFactCn || "",
    audioUrlEn: s.audioUrlEn, audioUrlAl: s.audioUrlAl, audioUrlGr: s.audioUrlGr,
    audioUrlIt: (s as any).audioUrlIt || null, audioUrlEs: (s as any).audioUrlEs || null, audioUrlDe: (s as any).audioUrlDe || null,
    audioUrlFr: (s as any).audioUrlFr || null, audioUrlAr: (s as any).audioUrlAr || null, audioUrlSl: (s as any).audioUrlSl || null,
    lat: String(s.lat), lng: String(s.lng),
    region: s.region, category: s.category, difficulty: s.difficulty,
    points: String(s.points), visitDuration: String(s.visitDuration),
    imageUrl: s.imageUrl || "",
    images: (s as any).images || [],
    isLocked: (s as any).isLocked || false,
    shopifyUrl: (s as any).shopifyUrl || "",
  };
}

function EditorView({
  siteId, onBack, onSaved,
}: {
  siteId: number | null;
  onBack: () => void;
  onSaved: (newId: number) => void;
}) {
  const isNew = siteId === null;
  const [form, setFormState] = useState<DestFormData>(EMPTY_DEST_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [translatingLang, setTranslatingLang] = useState<string | null>(null);
  const [translateError, setTranslateError] = useState("");

  useEffect(() => {
    if (!isNew && siteId !== null) {
      adminFetch("/api/admin/sites")
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((sites: TourSite[]) => {
          const site = sites.find(s => s.id === siteId);
          if (site) setFormState(siteToForm(site));
          else onBack();
        })
        .catch(() => {
          const persisted = loadPersistedSites();
          const site = persisted.find(s => s.id === siteId);
          if (site) setFormState(siteToForm(site));
          else onBack();
        })
        .finally(() => setLoading(false));
    }
  }, []);

  function set(field: keyof DestFormData, value: string | null | string[]) {
    setFormState(prev => ({ ...prev, [field]: value }));
    if (errors[field as string]) setErrors(prev => { const e = { ...prev }; delete (e as any)[field]; return e; });
  }

  async function handleTranslateDest(langKey: string) {
    if (!form.nameEn && !form.descEn) return;
    setTranslatingLang(langKey);
    setTranslateError("");
    try {
      const cap = langKey.charAt(0).toUpperCase() + langKey.slice(1);
      const doTranslate = async (text: string) => {
        const r = await adminFetch("/api/admin/translate", { method: "POST", body: JSON.stringify({ text, targetLang: langKey }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
        return d.translated || "";
      };
      const [nameT, descT, funT] = await Promise.all([
        form.nameEn ? doTranslate(form.nameEn) : Promise.resolve(""),
        form.descEn ? doTranslate(form.descEn) : Promise.resolve(""),
        form.funFactEn ? doTranslate(form.funFactEn) : Promise.resolve(""),
      ]);
      if (nameT) set(`name${cap}` as keyof DestFormData, nameT);
      if (descT) set(`desc${cap}` as keyof DestFormData, descT);
      if (funT) set(`funFact${cap}` as keyof DestFormData, funT);
    } catch (e: any) {
      const msg = e.message || "Translation failed";
      if (msg.includes("GEMINI_API_KEY") || msg.includes("not configured")) {
        setTranslateError("⚠️ Translation requires a GEMINI_API_KEY. Go to Railway → inspiring-exploration → albania-audio-tours → Variables → add GEMINI_API_KEY.");
      } else {
        setTranslateError(`Translation error: ${msg}`);
      }
    }
    setTranslatingLang(null);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.slug.trim()) e.slug = "Slug is required";
    if (!form.nameEn.trim()) e.nameEn = "English name is required";
    if (!form.descEn.trim()) e.descEn = "English description is required";
    if (!form.lat || isNaN(parseFloat(form.lat))) e.lat = "Valid latitude required";
    if (!form.lng || isNaN(parseFloat(form.lng))) e.lng = "Valid longitude required";
    if (!form.region) e.region = "Region is required";
    if (!form.category) e.category = "Category is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);

    // If imageUrl is a data URI, upload it via the dedicated endpoint first
    // This avoids the 10MB JSON body limit and ensures permanent DB storage
    let resolvedImageUrl = form.imageUrl || null;
    if (resolvedImageUrl && resolvedImageUrl.startsWith("data:") && !isNew && siteId) {
      try {
        const blob = await (await fetch(resolvedImageUrl)).blob();
        const fd = new FormData();
        fd.append("image", blob, "hero.jpg");
        const imgRes = await adminUpload(`/api/admin/sites/${siteId}/image`, fd);
        if (imgRes.ok) {
          const { url } = await imgRes.json();
          resolvedImageUrl = url;
        }
      } catch { /* keep data URI as fallback */ }
    }

    // NEVER include images in the PUT payload — gallery images are managed
    // exclusively via /api/admin/sites/:id/gallery endpoints, not via PUT.
    // Including serve URLs here would overwrite data URIs in the DB.
    const { images: _excludeImages, ...formWithoutImages } = form as any;
    const payload = {
      ...formWithoutImages,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      points: parseInt(form.points) || 100,
      visitDuration: parseInt(form.visitDuration) || 120,
      imageUrl: resolvedImageUrl,
      funFactEn: form.funFactEn || null,
      funFactAl: form.funFactAl || null,
      funFactGr: form.funFactGr || null,
      funFactIt: form.funFactIt || null,
      funFactEs: form.funFactEs || null,
      funFactDe: form.funFactDe || null,
      funFactFr: form.funFactFr || null,
      funFactAr: form.funFactAr || null,
      funFactSl: form.funFactSl || null,
      funFactPt: form.funFactPt || null,
      funFactCn: form.funFactCn || null,
      nameAl: form.nameAl || form.nameEn,
      nameGr: form.nameGr || form.nameEn,
      nameIt: form.nameIt || null,
      nameEs: form.nameEs || null,
      nameDe: form.nameDe || null,
      nameFr: form.nameFr || null,
      nameAr: form.nameAr || null,
      nameSl: form.nameSl || null,
      descAl: form.descAl || form.descEn,
      descGr: form.descGr || form.descEn,
      descIt: form.descIt || null,
      descEs: form.descEs || null,
      descDe: form.descDe || null,
      descFr: form.descFr || null,
      descAr: form.descAr || null,
      descSl: form.descSl || null,
    };
    try {
      const res = isNew
        ? await adminFetch("/api/admin/sites", { method: "POST", body: JSON.stringify(payload) })
        : await adminFetch(`/api/admin/sites/${siteId}`, { method: "PUT", body: JSON.stringify(payload) });

      if (res.ok) {
        const saved = await res.json();
        // Persist locally too
        const all = loadPersistedSites();
        if (isNew) {
          savePersistedSites([...all, { ...payload, id: saved.id } as unknown as TourSite]);
          onSaved(saved.id);
        } else {
          savePersistedSites(all.map(s => s.id === siteId ? { ...s, ...payload } as unknown as TourSite : s));
        }
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 2500);
      } else {
        // Static mode — persist to localStorage
        const all = loadPersistedSites();
        const fakeId = isNew ? Date.now() : siteId!;
        if (isNew) {
          savePersistedSites([...all, { ...payload, id: fakeId } as unknown as TourSite]);
          onSaved(fakeId);
        } else {
          savePersistedSites(all.map(s => s.id === siteId ? { ...s, ...payload } as unknown as TourSite : s));
        }
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 2500);
      }
    } catch {
      const all = loadPersistedSites();
      const fakeId = isNew ? Date.now() : siteId!;
      if (isNew) {
        savePersistedSites([...all, { ...payload, id: fakeId } as unknown as TourSite]);
        onSaved(fakeId);
      } else {
        savePersistedSites(all.map(s => s.id === siteId ? { ...s, ...payload } as unknown as TourSite : s));
      }
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const latNum = parseFloat(form.lat);
  const lngNum = parseFloat(form.lng);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-medium text-foreground">
              {isNew ? "New Destination" : `Editing: ${form.nameEn || "…"}`}
            </span>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5" data-testid="button-save">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {savedOk ? "Saved!" : saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Tabs defaultValue="details">
          <TabsList className="mb-6">
            <TabsTrigger value="details" className="gap-1.5 text-xs"><Info className="w-3.5 h-3.5" /> Details</TabsTrigger>
            <TabsTrigger value="location" className="gap-1.5 text-xs"><MapPin className="w-3.5 h-3.5" /> Location</TabsTrigger>
            <TabsTrigger value="translations" className="gap-1.5 text-xs"><Globe className="w-3.5 h-3.5" /> Translations</TabsTrigger>
            <TabsTrigger value="audio" className="gap-1.5 text-xs" disabled={isNew}>
              <Music className="w-3.5 h-3.5" /> Audio
              {isNew && <span className="text-muted-foreground/60 ml-1">(save first)</span>}
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5 text-xs"><Image className="w-3.5 h-3.5" /> Media</TabsTrigger>
            <TabsTrigger value="itinerary" className="gap-1.5 text-xs" disabled={isNew}>
              <Route className="w-3.5 h-3.5" /> Itinerary
              {isNew && <span className="text-muted-foreground/60 ml-1">(save first)</span>}
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5 text-xs"><Eye className="w-3.5 h-3.5" /> Preview</TabsTrigger>
          </TabsList>

          {/* Details */}
          <TabsContent value="details" className="space-y-6">
            <Card className="border-border/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Basic Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="URL Slug" error={errors.slug} required>
                    <Input value={form.slug} onChange={e => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="berat" data-testid="input-slug" />
                    <p className="text-xs text-muted-foreground mt-1">Used in the URL: /sites/<strong>{form.slug || "slug"}</strong></p>
                  </Field>
                  <Field label="Points (XP)" error={errors.points}>
                    <Input type="number" min="10" max="500" value={form.points} onChange={e => set("points", e.target.value)} data-testid="input-points" />
                  </Field>
                </div>
                <Field label="English Name" error={errors.nameEn} required>
                  <Input value={form.nameEn} onChange={e => set("nameEn", e.target.value)} placeholder="Berat" data-testid="input-name-en" />
                </Field>
                <Field label="English Description" error={errors.descEn} required>
                  <Textarea value={form.descEn} onChange={e => set("descEn", e.target.value)} rows={4} placeholder="Describe this destination…" data-testid="input-desc-en" />
                </Field>
                <Field label="English Fun Fact">
                  <Input value={form.funFactEn} onChange={e => set("funFactEn", e.target.value)} placeholder="A surprising fact" data-testid="input-fun-fact-en" />
                </Field>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Region" error={errors.region} required>
                    <Select value={form.region} onValueChange={v => set("region", v)}>
                      <SelectTrigger data-testid="select-region"><SelectValue placeholder="Select region" /></SelectTrigger>
                      <SelectContent>{REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  {/* Category — multi-select checkboxes (stored as comma-separated string).
                      A destination can belong to multiple categories, e.g. city + historic-town.
                      At least one must be selected. */}
                  <Field label="Category" error={errors.category} required>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {DEST_CATEGORIES.map(c => {
                        const selected = form.category.split(",").map(x => x.trim()).filter(Boolean).includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            data-testid={`cat-${c}`}
                            onClick={() => {
                              const current = form.category.split(",").map(x => x.trim()).filter(Boolean);
                              const next = selected
                                ? current.filter(x => x !== c)          // deselect
                                : [...current, c];                        // select
                              set("category", next.join(","));
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              selected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                            }`}
                          >
                            {selected && <span className="text-[10px] leading-none">✓</span>}
                            {c}
                          </button>
                        );
                      })}
                    </div>
                    {form.category && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Selected: <span className="font-medium text-foreground">{form.category}</span>
                      </p>
                    )}
                  </Field>
                  <Field label="Difficulty">
                    <Select value={form.difficulty} onValueChange={v => set("difficulty", v)}>
                      <SelectTrigger data-testid="select-difficulty"><SelectValue /></SelectTrigger>
                      <SelectContent>{DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Visit Duration (minutes)">
                  <Input type="number" min="15" max="1440" value={form.visitDuration} onChange={e => set("visitDuration", e.target.value)} data-testid="input-duration" />
                </Field>
              </CardContent>
            </Card>

            {/* Monetization — lock + Shopify */}
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" /> Monetization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Lock this page</p>
                    <p className="text-xs text-muted-foreground">Visitors need an unlock code or payment to access</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormState(f => ({ ...f, isLocked: !f.isLocked }))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      form.isLocked
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                    data-testid="lock-toggle"
                    aria-pressed={form.isLocked}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {form.isLocked ? "Locked 🔒" : "Unlocked 🔓"}
                  </button>
                </div>
                <Field label="Shopify booking URL (optional)">
                  <Input
                    value={form.shopifyUrl}
                    onChange={e => set("shopifyUrl", e.target.value)}
                    placeholder="https://albanianEagleTours.com/products/tirana-private-tour"
                    data-testid="input-shopify-url"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    When set, a "Book with a Guide" button appears at the bottom of this page.
                  </p>
                </Field>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Location — interactive map picker */}
          <TabsContent value="location" className="space-y-6">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Latitude" error={errors.lat} required>
                    <Input value={form.lat} onChange={e => set("lat", e.target.value)} placeholder="40.7058" data-testid="input-lat" />
                  </Field>
                  <Field label="Longitude" error={errors.lng} required>
                    <Input value={form.lng} onChange={e => set("lng", e.target.value)} placeholder="19.9522" data-testid="input-lng" />
                  </Field>
                </div>
                <MapPicker
                  lat={isNaN(latNum) ? 41.1533 : latNum}
                  lng={isNaN(lngNum) ? 20.1683 : lngNum}
                  onPick={(la, lo) => { set("lat", String(la)); set("lng", String(lo)); }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Translations */}
          <TabsContent value="translations" className="space-y-5">
            <p className="text-sm text-muted-foreground">Translations for all languages. Click "Auto-translate" to fill all three fields from the English version. English is used as fallback if left blank.</p>
            {translateError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">{translateError}</div>
            )}
            {LANGS.filter(l => l.key !== "en").map(lang => {
              const cap = lang.key.charAt(0).toUpperCase() + lang.key.slice(1);
              const isTranslating = translatingLang === lang.key;
              return (
                <Card key={lang.key} className="border-border/60">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2"><span className="text-base">{lang.flag}</span> {lang.label}</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTranslateDest(lang.key)}
                        disabled={isTranslating || !form.nameEn}
                        className="text-xs h-7 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                      >
                        {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="text-sm">🌐</span>}
                        {isTranslating ? "Translating…" : "Auto-translate"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field label={`${lang.label} Name`}>
                      <Input
                        value={form[`name${cap}` as keyof DestFormData] as string}
                        onChange={e => set(`name${cap}` as keyof DestFormData, e.target.value)}
                        placeholder={form.nameEn}
                      />
                    </Field>
                    <Field label={`${lang.label} Description`}>
                      <Textarea
                        value={form[`desc${cap}` as keyof DestFormData] as string}
                        onChange={e => set(`desc${cap}` as keyof DestFormData, e.target.value)}
                        rows={4}
                        placeholder={form.descEn}
                      />
                    </Field>
                    <Field label={`${lang.label} Fun Fact`}>
                      <Input
                        value={form[`funFact${cap}` as keyof DestFormData] as string}
                        onChange={e => set(`funFact${cap}` as keyof DestFormData, e.target.value)}
                        placeholder={form.funFactEn}
                      />
                    </Field>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Audio */}
          <TabsContent value="audio" className="space-y-5">
            <p className="text-sm text-muted-foreground">Upload an MP3 narration for each language, or click "Generate Audio" to create TTS from the description text.</p>
            {!isNew && (
              <div className="grid gap-4">
                {LANGS.map(lang => {
                  const cap = lang.key.charAt(0).toUpperCase() + lang.key.slice(1);
                  const descField = `desc${cap}` as keyof DestFormData;
                  const descText = (form[descField] as string) || form.descEn || "";
                  return (
                    <AudioCard
                      key={lang.key}
                      siteId={siteId}
                      lang={lang.key}
                      label={lang.label}
                      flag={lang.flag}
                      currentUrl={form[`audioUrl${cap}` as keyof DestFormData] as string | null}
                      onUpdate={url => set(`audioUrl${cap}` as keyof DestFormData, url)}
                      descText={descText}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Media */}
          <TabsContent value="media" className="space-y-5">
            <ImageGalleryCard
              entityType="sites"
              entityId={siteId ?? null}
              imageUrl={form.imageUrl}
              images={form.images || []}
              onUpdate={(url, imgs) => { set("imageUrl", url); set("images", imgs); }}
            />
          </TabsContent>

          {/* Itinerary */}
          <TabsContent value="itinerary" className="space-y-5">
            {!isNew && (
              <ItineraryManager
                siteSlug={form.slug}
                entityType="site"
                centerLat={isNaN(parseFloat(form.lat)) ? 41.3275 : parseFloat(form.lat)}
                centerLng={isNaN(parseFloat(form.lng)) ? 19.8187 : parseFloat(form.lng)}
              />
            )}
          </TabsContent>

          {/* Preview */}
          <TabsContent value="preview" className="space-y-5">
            <DestinationPreviewCard form={form} />
          </TabsContent>
        </Tabs>

        <div className="pt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 min-w-32" data-testid="button-save-bottom">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savedOk ? "Saved!" : saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </main>
    </div>
  );
}

// ─── ATTRACTION EDITOR ────────────────────────────────────────────────────────
type AttrFormData = {
  slug: string;
  nameEn: string; nameAl: string; nameGr: string; nameIt: string; nameEs: string; nameDe: string; nameFr: string; nameAr: string; nameSl: string; namePt: string; nameCn: string;
  descEn: string; descAl: string; descGr: string; descIt: string; descEs: string; descDe: string; descFr: string; descAr: string; descSl: string; descPt: string; descCn: string;
  funFactEn: string; funFactAl: string; funFactGr: string; funFactIt: string; funFactEs: string; funFactDe: string; funFactFr: string; funFactAr: string; funFactSl: string; funFactPt: string; funFactCn: string;
  audioUrlEn: string; audioUrlAl: string; audioUrlGr: string;
  audioUrlIt: string; audioUrlEs: string; audioUrlDe: string; audioUrlFr: string; audioUrlAr: string; audioUrlSl: string;
  category: string;
  points: string;
  lat: string; lng: string;
  visitDuration: string;
  imageUrl: string;
  images: string[];
};

const EMPTY_ATTR_FORM: AttrFormData = {
  slug: "",
  nameEn: "", nameAl: "", nameGr: "", nameIt: "", nameEs: "", nameDe: "", nameFr: "", nameAr: "", nameSl: "", namePt: "", nameCn: "",
  descEn: "", descAl: "", descGr: "", descIt: "", descEs: "", descDe: "", descFr: "", descAr: "", descSl: "", descPt: "", descCn: "",
  funFactEn: "", funFactAl: "", funFactGr: "", funFactIt: "", funFactEs: "", funFactDe: "", funFactFr: "", funFactAr: "", funFactSl: "", funFactPt: "", funFactCn: "",
  audioUrlEn: "", audioUrlAl: "", audioUrlGr: "",
  audioUrlIt: "", audioUrlEs: "", audioUrlDe: "", audioUrlFr: "", audioUrlAr: "", audioUrlSl: "",
  category: "", points: "50", lat: "", lng: "",
  visitDuration: "30", imageUrl: "", images: [],
  isLocked: false, shopifyUrl: "",
};

function attrToForm(a: Attraction): AttrFormData {
  return {
    slug: a.slug,
    nameEn: a.nameEn, nameAl: a.nameAl, nameGr: a.nameGr,
    nameIt: (a as any).nameIt || "", nameEs: (a as any).nameEs || "", nameDe: (a as any).nameDe || "",
    nameFr: (a as any).nameFr || "", nameAr: (a as any).nameAr || "", nameSl: (a as any).nameSl || "",
    namePt: (a as any).namePt || "", nameCn: (a as any).nameCn || "",
    descEn: a.descEn, descAl: a.descAl, descGr: a.descGr,
    descIt: (a as any).descIt || "", descEs: (a as any).descEs || "", descDe: (a as any).descDe || "",
    descFr: (a as any).descFr || "", descAr: (a as any).descAr || "", descSl: (a as any).descSl || "",
    descPt: (a as any).descPt || "", descCn: (a as any).descCn || "",
    funFactEn: a.funFactEn || "", funFactAl: a.funFactAl || "", funFactGr: a.funFactGr || "",
    funFactIt: (a as any).funFactIt || "", funFactEs: (a as any).funFactEs || "", funFactDe: (a as any).funFactDe || "",
    funFactFr: (a as any).funFactFr || "", funFactAr: (a as any).funFactAr || "", funFactSl: (a as any).funFactSl || "",
    funFactPt: (a as any).funFactPt || "", funFactCn: (a as any).funFactCn || "",
    audioUrlEn: a.audioUrlEn || "", audioUrlAl: a.audioUrlAl || "", audioUrlGr: a.audioUrlGr || "",
    audioUrlIt: (a as any).audioUrlIt || "", audioUrlEs: (a as any).audioUrlEs || "", audioUrlDe: (a as any).audioUrlDe || "",
    audioUrlFr: (a as any).audioUrlFr || "", audioUrlAr: (a as any).audioUrlAr || "", audioUrlSl: (a as any).audioUrlSl || "",
    category: a.category,
    points: String(a.points),
    lat: String(a.lat), lng: String(a.lng),
    visitDuration: String(a.visitDuration),
    imageUrl: a.imageUrl || "",
    images: (a as any).images || [],
  };
}

function AttrEditorView({
  attractionId,
  destinationSlug,
  destinationName,
  onBack,
  onSaved,
}: {
  attractionId: number | null;
  destinationSlug: string;
  destinationName: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const isNew = attractionId === null;
  const [form, setFormState] = useState<AttrFormData>(EMPTY_ATTR_FORM);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [translatingLang, setTranslatingLang] = useState<string | null>(null);
  const [translateError, setTranslateError] = useState("");

  useEffect(() => {
    if (!isNew && attractionId !== null) {
      // Load from API first, fall back to local cache
      adminFetch(`/api/admin/attractions/all/${attractionId}`)
        .then(r => r.ok ? r.json() : null)
        .then(attr => {
          if (attr) { setFormState(attrToForm(attr)); return; }
          // Fallback: search all attractions
          return adminFetch("/api/admin/attractions")
            .then(r => r.ok ? r.json() : [])
            .then((all: Attraction[]) => {
              const found = all.find(a => a.id === attractionId);
              if (found) setFormState(attrToForm(found));
              else onBack();
            });
        })
        .catch(() => {
          const all = loadPersistedAttractions();
          const attr = all.find(a => a.id === attractionId);
          if (attr) setFormState(attrToForm(attr));
          else onBack();
        });
    }
  }, []);

  function set(field: keyof AttrFormData, value: string | string[]) {
    setFormState(prev => ({ ...prev, [field]: value }));
    if (errors[field as string]) setErrors(prev => { const e = { ...prev }; delete (e as any)[field]; return e; });
  }

  async function handleTranslateAttr(langKey: string) {
    if (!form.nameEn && !form.descEn) return;
    setTranslatingLang(langKey);
    setTranslateError("");
    try {
      const cap = langKey.charAt(0).toUpperCase() + langKey.slice(1);
      const [nameRes, descRes, funRes] = await Promise.all([
        form.nameEn ? adminFetch("/api/admin/translate", { method: "POST", body: JSON.stringify({ text: form.nameEn, targetLang: langKey }) }).then(r => r.json()) : Promise.resolve({ translated: "" }),
        form.descEn ? adminFetch("/api/admin/translate", { method: "POST", body: JSON.stringify({ text: form.descEn, targetLang: langKey }) }).then(r => r.json()) : Promise.resolve({ translated: "" }),
        form.funFactEn ? adminFetch("/api/admin/translate", { method: "POST", body: JSON.stringify({ text: form.funFactEn, targetLang: langKey }) }).then(r => r.json()) : Promise.resolve({ translated: "" }),
      ]);
      // Check if the API returned an error payload
      const firstRes = nameRes || descRes;
      if (firstRes?.error) {
        const msg = firstRes.error || "";
        if (msg.includes("503") || msg.includes("GEMINI") || msg.includes("API key") || firstRes.error === "Translation service unavailable") {
          setTranslateError("⚠️ Translation requires a GEMINI_API_KEY. Go to Railway → inspiring-exploration → albania-audio-tours → Variables → add GEMINI_API_KEY.");
        } else {
          setTranslateError(`Translation error: ${msg}`);
        }
      } else {
        if (nameRes.translated) set(`name${cap}` as keyof AttrFormData, nameRes.translated);
        if (descRes.translated) set(`desc${cap}` as keyof AttrFormData, descRes.translated);
        if (funRes.translated) set(`funFact${cap}` as keyof AttrFormData, funRes.translated);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("503") || msg.includes("GEMINI") || msg.includes("API key")) {
        setTranslateError("⚠️ Translation requires a GEMINI_API_KEY. Go to Railway → inspiring-exploration → albania-audio-tours → Variables → add GEMINI_API_KEY.");
      } else {
        setTranslateError(`Translation error: ${msg}`);
      }
    }
    setTranslatingLang(null);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.slug.trim()) e.slug = "Slug is required";
    if (!form.nameEn.trim()) e.nameEn = "English name is required";
    if (!form.descEn.trim()) e.descEn = "English description is required";
    if (!form.lat || isNaN(parseFloat(form.lat))) e.lat = "Valid latitude required";
    if (!form.lng || isNaN(parseFloat(form.lng))) e.lng = "Valid longitude required";
    if (!form.category) e.category = "Category is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);

    // If imageUrl is a data URI, upload it via dedicated endpoint first
    let resolvedAttrImageUrl = form.imageUrl || null;
    if (resolvedAttrImageUrl && resolvedAttrImageUrl.startsWith("data:") && !isNew && attrId) {
      try {
        const blob = await (await fetch(resolvedAttrImageUrl)).blob();
        const fd = new FormData();
        fd.append("image", blob, "hero.jpg");
        const imgRes = await adminUpload(`/api/admin/attractions/${attrId}/image`, fd);
        if (imgRes.ok) {
          const { url } = await imgRes.json();
          resolvedAttrImageUrl = url;
        }
      } catch { /* keep data URI as fallback */ }
    }

    // NEVER include images in PUT payload
    const { images: _excludeAttrImages, ...attrFormWithoutImages } = form as any;
    const payload = {
      slug: form.slug,
      destinationSlug,
      nameEn: form.nameEn, nameAl: form.nameAl || form.nameEn, nameGr: form.nameGr || form.nameEn,
      nameIt: form.nameIt || null, nameEs: form.nameEs || null, nameDe: form.nameDe || null,
      nameFr: form.nameFr || null, nameAr: form.nameAr || null, nameSl: form.nameSl || null,
      namePt: form.namePt || null, nameCn: form.nameCn || null,
      descEn: form.descEn, descAl: form.descAl || form.descEn, descGr: form.descGr || form.descEn,
      descIt: form.descIt || null, descEs: form.descEs || null, descDe: form.descDe || null,
      descFr: form.descFr || null, descAr: form.descAr || null, descSl: form.descSl || null,
      descPt: form.descPt || null, descCn: form.descCn || null,
      funFactEn: form.funFactEn || "", funFactAl: form.funFactAl || form.funFactEn || "", funFactGr: form.funFactGr || form.funFactEn || "",
      funFactIt: form.funFactIt || null, funFactEs: form.funFactEs || null, funFactDe: form.funFactDe || null,
      funFactFr: form.funFactFr || null, funFactAr: form.funFactAr || null, funFactSl: form.funFactSl || null,
      funFactPt: form.funFactPt || null, funFactCn: form.funFactCn || null,
      category: form.category,
      points: parseInt(form.points) || 50,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      visitDuration: parseInt(form.visitDuration) || 30,
      imageUrl: resolvedAttrImageUrl,
      audioUrlEn: form.audioUrlEn || null,
      audioUrlAl: form.audioUrlAl || null,
      audioUrlGr: form.audioUrlGr || null,
      audioUrlIt: form.audioUrlIt || null, audioUrlEs: form.audioUrlEs || null, audioUrlDe: form.audioUrlDe || null,
      audioUrlFr: form.audioUrlFr || null, audioUrlAr: form.audioUrlAr || null, audioUrlSl: form.audioUrlSl || null,
    };

    try {
      const res = isNew
        ? await adminFetch("/api/admin/attractions", { method: "POST", body: JSON.stringify(payload) })
        : await adminFetch(`/api/admin/attractions/${attractionId}`, { method: "PUT", body: JSON.stringify(payload) });

      if (res.ok) {
        setSavedOk(true);
        if (isNew) {
          // New attraction: navigate to the list after save
          setTimeout(() => { setSavedOk(false); onSaved(); }, 800);
        } else {
          // Existing attraction: stay on page, just show confirmation
          setTimeout(() => setSavedOk(false), 2500);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Save failed: ${err.error || res.status}`);
      }
    } catch (e) {
      alert("Save failed: network error");
    }
    setSaving(false);
  }

  const latNum = parseFloat(form.lat);
  const lngNum = parseFloat(form.lng);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> {destinationName}
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-medium text-foreground">
              {isNew ? `New Attraction` : `Editing: ${form.nameEn || "…"}`}
            </span>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {savedOk ? "Saved!" : saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Tabs defaultValue="details">
          <TabsList className="mb-6">
            <TabsTrigger value="details" className="gap-1.5 text-xs"><Info className="w-3.5 h-3.5" /> Details</TabsTrigger>
            <TabsTrigger value="location" className="gap-1.5 text-xs"><MapPin className="w-3.5 h-3.5" /> Location</TabsTrigger>
            <TabsTrigger value="translations" className="gap-1.5 text-xs"><Globe className="w-3.5 h-3.5" /> Translations</TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5 text-xs"><Image className="w-3.5 h-3.5" /> Media</TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5 text-xs"><Eye className="w-3.5 h-3.5" /> Preview</TabsTrigger>
          </TabsList>

          {/* Details */}
          <TabsContent value="details" className="space-y-6">
            <Card className="border-border/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Attraction Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="URL Slug" error={errors.slug} required>
                    <Input value={form.slug} onChange={e => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="berat-castle" />
                    <p className="text-xs text-muted-foreground mt-1">Used in URL: /sites/{destinationSlug}/<strong>{form.slug || "slug"}</strong></p>
                  </Field>
                  <Field label="Points (XP)" error={errors.points}>
                    <Input type="number" min="10" max="200" value={form.points} onChange={e => set("points", e.target.value)} />
                  </Field>
                </div>
                <Field label="English Name" error={errors.nameEn} required>
                  <Input value={form.nameEn} onChange={e => set("nameEn", e.target.value)} placeholder="Berat Castle (Kalaja)" />
                </Field>
                <Field label="English Description" error={errors.descEn} required>
                  <Textarea value={form.descEn} onChange={e => set("descEn", e.target.value)} rows={5} placeholder="Describe this attraction in detail…" />
                </Field>
                <Field label="English Fun Fact (Did You Know?)">
                  <Input value={form.funFactEn} onChange={e => set("funFactEn", e.target.value)} placeholder="An interesting fact about this attraction" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  {/* Category — multi-select checkboxes, same pattern as destinations.
                      Stored as comma-separated string e.g. "landmark,museum".
                      Primary category (first) drives pin colour and badges. */}
                  <Field label="Category" error={errors.category} required>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {ATTR_CATEGORIES.map(c => {
                        const selected = form.category.split(",").map((x: string) => x.trim()).filter(Boolean).includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              const current = form.category.split(",").map((x: string) => x.trim()).filter(Boolean);
                              const next = selected
                                ? current.filter((x: string) => x !== c)
                                : [...current, c];
                              set("category", next.join(","));
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              selected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                            }`}
                          >
                            {selected && <span className="text-[10px] leading-none">✓</span>}
                            {c}
                          </button>
                        );
                      })}
                    </div>
                    {form.category && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Selected: <span className="font-medium text-foreground">{form.category}</span>
                      </p>
                    )}
                  </Field>
                  <Field label="Visit Duration (minutes)">
                    <Input type="number" min="5" max="300" value={form.visitDuration} onChange={e => set("visitDuration", e.target.value)} />
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* Monetization */}
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" /> Monetization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Lock this page</p>
                    <p className="text-xs text-muted-foreground">Requires unlock code or payment</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormState((f: any) => ({ ...f, isLocked: !f.isLocked }))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      (form as any).isLocked
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {(form as any).isLocked ? "Locked 🔒" : "Unlocked 🔓"}
                  </button>
                </div>
                <Field label="Shopify booking URL (optional)">
                  <Input
                    value={(form as any).shopifyUrl || ""}
                    onChange={e => set("shopifyUrl" as any, e.target.value)}
                    placeholder="https://albanianEagleTours.com/products/..."
                  />
                </Field>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Location */}
          <TabsContent value="location" className="space-y-6">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Pin Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Latitude" error={errors.lat} required>
                    <Input value={form.lat} onChange={e => set("lat", e.target.value)} placeholder="40.7069" />
                  </Field>
                  <Field label="Longitude" error={errors.lng} required>
                    <Input value={form.lng} onChange={e => set("lng", e.target.value)} placeholder="19.9504" />
                  </Field>
                </div>
                <MapPicker
                  lat={isNaN(latNum) ? 41.1533 : latNum}
                  lng={isNaN(lngNum) ? 20.1683 : lngNum}
                  onPick={(la, lo) => { set("lat", String(la)); set("lng", String(lo)); }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Translations */}
          <TabsContent value="translations" className="space-y-5">
            <p className="text-sm text-muted-foreground">Translations for all languages. Click "Auto-translate" to fill all three fields from the English version. English is used as fallback if left blank.</p>
            {translateError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">{translateError}</div>
            )}
            {LANGS.filter(l => l.key !== "en").map(lang => {
              const cap = lang.key.charAt(0).toUpperCase() + lang.key.slice(1);
              const isTranslating = translatingLang === lang.key;
              return (
                <Card key={lang.key} className="border-border/60">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2"><span className="text-base">{lang.flag}</span> {lang.label}</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTranslateAttr(lang.key)}
                        disabled={isTranslating || !form.nameEn}
                        className="text-xs h-7 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                      >
                        {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="text-sm">🌐</span>}
                        {isTranslating ? "Translating…" : "Auto-translate"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field label={`${lang.label} Name`}>
                      <Input
                        value={form[`name${cap}` as keyof AttrFormData]}
                        onChange={e => set(`name${cap}` as keyof AttrFormData, e.target.value)}
                        placeholder={form.nameEn}
                      />
                    </Field>
                    <Field label={`${lang.label} Description`}>
                      <Textarea
                        value={form[`desc${cap}` as keyof AttrFormData]}
                        onChange={e => set(`desc${cap}` as keyof AttrFormData, e.target.value)}
                        rows={4}
                        placeholder={form.descEn}
                      />
                    </Field>
                    <Field label={`${lang.label} Fun Fact`}>
                      <Input
                        value={form[`funFact${cap}` as keyof AttrFormData]}
                        onChange={e => set(`funFact${cap}` as keyof AttrFormData, e.target.value)}
                        placeholder={form.funFactEn}
                      />
                    </Field>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Media */}
          <TabsContent value="media" className="space-y-5">
            <ImageGalleryCard
              entityType="attractions"
              entityId={attractionId ?? null}
              imageUrl={form.imageUrl}
              images={form.images || []}
              onUpdate={(url, imgs) => { set("imageUrl", url); set("images", imgs); }}
            />
            <Card className="border-border/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Music className="w-4 h-4 text-primary" /> Audio Guide</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {LANGS.map(lang => {
                  const cap = lang.key.charAt(0).toUpperCase() + lang.key.slice(1);
                  const descField = `desc${cap}` as keyof AttrFormData;
                  const descText = (form[descField] as string) || form.descEn || "";
                  return (
                    <AudioCard
                      key={lang.key}
                      siteId={attractionId}
                      lang={lang.key}
                      label={lang.label}
                      flag={lang.flag}
                      currentUrl={form[`audioUrl${cap}` as keyof AttrFormData] as string || null}
                      onUpdate={url => set(`audioUrl${cap}` as keyof AttrFormData, url || "")}
                      entityType="attractions"
                      descText={descText}
                    />
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preview */}
          <TabsContent value="preview" className="space-y-5">
            <AttractionPreviewCard form={form} destinationName={destinationName} destinationSlug={destinationSlug} />
          </TabsContent>
        </Tabs>

        <div className="pt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 min-w-32">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savedOk ? "Saved!" : saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </main>
    </div>
  );
}

// ─── ROOT PANEL (state machine) ───────────────────────────────────────────────
export default function AdminPanel() {
  const [view, setView] = useState<View>(() =>
    getAdminToken() ? { screen: "sites" } : { screen: "login" }
  );

  if (view.screen === "login") {
    return <LoginView onLogin={() => setView({ screen: "sites" })} />;
  }

  if (view.screen === "sites") {
    return (
      <SitesView
        onEdit={id => setView({ screen: "editor", siteId: id })}
        onNew={() => setView({ screen: "editor", siteId: null })}
        onLogout={() => { clearAdminToken(); setView({ screen: "login" }); }}
        onManageAttractions={(slug, name) => setView({ screen: "attractions", destinationSlug: slug, destinationName: name })}
      />
    );
  }

  if (view.screen === "editor") {
    return (
      <EditorView
        siteId={view.siteId}
        onBack={() => setView({ screen: "sites" })}
        onSaved={newId => setView({ screen: "editor", siteId: newId })}
      />
    );
  }

  if (view.screen === "attractions") {
    return (
      <AttractionsView
        destinationSlug={view.destinationSlug}
        destinationName={view.destinationName}
        onBack={() => setView({ screen: "sites" })}
        onEdit={id => setView({ screen: "attr-editor", attractionId: id, destinationSlug: view.destinationSlug, destinationName: view.destinationName })}
        onNew={() => setView({ screen: "attr-editor", attractionId: null, destinationSlug: view.destinationSlug, destinationName: view.destinationName })}
      />
    );
  }

  // attr-editor
  return (
    <AttrEditorView
      attractionId={view.attractionId}
      destinationSlug={view.destinationSlug}
      destinationName={view.destinationName}
      onBack={() => setView({ screen: "attractions", destinationSlug: view.destinationSlug, destinationName: view.destinationName })}
      onSaved={() => setView({ screen: "attractions", destinationSlug: view.destinationSlug, destinationName: view.destinationName })}
    />
  );
}
