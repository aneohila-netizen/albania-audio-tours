/**
 * ActivatePage — activate a subscription in three ways:
 *   1. Auto  — URL params: /#/activate?order_id=X&email=Y  (from activation email link)
 *   2. Code  — User types their ALB-XXXX access code (family / no-redirect fallback)
 *   3. Order — User types order ID + email manually
 */

import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import {
  CheckCircle2, AlertCircle, Loader2, Headphones, Map,
  KeyRound, Mail, Hash, ChevronRight, RefreshCw,
} from "lucide-react";
import { useSubscription } from "@/lib/subscriptionContext";

const RAILWAY_URL = "https://albania-audio-tours-production.up.railway.app";

function getDeviceId(): string {
  const key = "alb_dev_id";
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = `${navigator.userAgent.length}-${screen.width}x${screen.height}-${Date.now()}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch { return "unknown"; }
}

type Mode = "auto" | "code" | "order";
type Status = "idle" | "loading" | "success" | "error" | "retrying";

interface SuccessData {
  planName: string;
  expiresAt: string;
  deviceCount: number;
  deviceLimit: number;
}

export default function ActivatePage() {
  const [, navigate] = useLocation();
  const { setToken } = useSubscription();

  // Parse URL params
  const hashQuery = window.location.hash.includes("?")
    ? window.location.hash.split("?")[1]
    : window.location.search.replace(/^\?/, "");
  const query = new URLSearchParams(hashQuery);
  const urlOrderId = query.get("order_id") || "";
  const urlEmail   = query.get("email") || "";

  const hasAutoParams = !!(urlOrderId && urlEmail);

  // Mode tabs — if URL params present, start in auto mode
  const [mode, setMode] = useState<Mode>(hasAutoParams ? "auto" : "code");

  // Shared state
  const [status, setStatus]     = useState<Status>(hasAutoParams ? "loading" : "idle");
  const [retryCount, setRetry]  = useState(0);
  const [errorMsg, setError]    = useState("");
  const [success, setSuccess]   = useState<SuccessData | null>(null);

  // Code entry
  const [codeInput, setCodeInput] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  // Order entry
  const [orderInput, setOrderInput] = useState(urlOrderId);
  const [emailInput, setEmailInput] = useState(decodeURIComponent(urlEmail));

  // ── Auto-activate on mount if URL params present ──────────────────────────
  useEffect(() => {
    if (hasAutoParams) activateByOrder(urlOrderId, decodeURIComponent(urlEmail), 0);
  }, []);

  // ── Focus code input when switching to code tab ───────────────────────────
  useEffect(() => {
    if (mode === "code" && status === "idle") codeRef.current?.focus();
  }, [mode]);

  // ── Helper: handle success response ──────────────────────────────────────
  function handleSuccess(data: any) {
    setToken(data.token);
    setSuccess({
      planName: data.planName || "Subscription",
      expiresAt: data.expiresAt || "",
      deviceCount: data.deviceCount || 1,
      deviceLimit: data.deviceLimit || 2,
    });
    setStatus("success");
  }

  // ── Activate by order ID + email ──────────────────────────────────────────
  async function activateByOrder(orderId: string, email: string, attempt = 0) {
    if (!orderId || !email) {
      setError("Please enter your order number and email address.");
      setStatus("error");
      return;
    }
    setStatus(attempt > 0 ? "retrying" : "loading");
    setError("");
    try {
      const res = await fetch(`${RAILWAY_URL}/api/subscription/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": getDeviceId() },
        body: JSON.stringify({ orderId, email }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        handleSuccess(data);
      } else if (res.status === 404 && attempt < 5) {
        setRetry(attempt + 1);
        setStatus("retrying");
        setTimeout(() => activateByOrder(orderId, email, attempt + 1), 3000);
      } else if (data.code === "DEVICE_LIMIT") {
        setError(`All ${data.deviceLimit || "available"} device slots are in use. Contact book@albanianeagletours.com to manage devices.`);
        setStatus("error");
      } else {
        setError(data.error || "Activation failed. Please try your access code instead, or contact support.");
        setStatus("error");
      }
    } catch {
      if (attempt < 3) setTimeout(() => activateByOrder(orderId, email, attempt + 1), 3000);
      else { setError("Connection error. Please try again."); setStatus("error"); }
    }
  }

  // ── Activate by code ──────────────────────────────────────────────────────
  async function activateByCode() {
    const code = codeInput.trim().toUpperCase();
    if (!code) { setError("Please enter your access code."); return; }
    setStatus("loading"); setError("");
    try {
      const res = await fetch(`${RAILWAY_URL}/api/subscription/activate-by-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": getDeviceId() },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        handleSuccess(data);
      } else if (data.code === "DEVICE_LIMIT") {
        setError(`All device slots for this code are used. Contact book@albanianeagletours.com to reset.`);
        setStatus("error");
      } else {
        setError(data.error || "Code not recognised. Check the code and try again.");
        setStatus("error");
      }
    } catch {
      setError("Connection error. Please try again.");
      setStatus("error");
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (status === "success" && success) {
    const expiry = success.expiresAt
      ? new Date(success.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "";
    return (
      <div className="max-w-md mx-auto px-4 py-16 pb-28 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold">You're all set!</h1>
          <p className="text-sm text-muted-foreground">
            <strong>{success.planName}</strong> is now active on this device.
          </p>
          {expiry && <p className="text-xs text-muted-foreground">Access until <strong>{expiry}</strong></p>}
        </div>
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm text-left space-y-2">
          <p className="font-semibold text-sm">What's unlocked:</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>✓ All audio tours — 43 destinations, 305+ attractions</li>
            <li>✓ 10 guided walking tours with GPS narration</li>
            <li>✓ Offline audio playback</li>
            <li>✓ All 11 languages</li>
          </ul>
          {success.deviceLimit > 1 && (
            <p className="text-xs text-muted-foreground pt-1 border-t border-border">
              Device {success.deviceCount} of {success.deviceLimit} activated.
              {success.deviceCount < success.deviceLimit &&
                " Share your access code with travel companions to activate their devices too."}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={() => navigate("/")}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2">
            <Map size={16} /> Start Exploring
          </button>
          <Link href="/sites">
            <a className="w-full py-3 rounded-xl border border-border font-medium text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors">
              <Headphones size={14} /> Browse Audio Tours
            </a>
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading / retrying ────────────────────────────────────────────────────
  if (status === "loading" || status === "retrying") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 pb-28 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Loader2 size={28} className="text-primary animate-spin" />
        </div>
        <h1 className="text-xl font-bold">Activating your subscription…</h1>
        {status === "retrying" && (
          <p className="text-sm text-muted-foreground">
            Confirming payment — attempt {retryCount}/5…
          </p>
        )}
      </div>
    );
  }

  // ── Main activation UI ────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto px-4 py-10 pb-28 space-y-5">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <KeyRound size={22} className="text-primary" />
        </div>
        <h1 className="text-xl font-bold">Activate Your Subscription</h1>
        <p className="text-sm text-muted-foreground">
          Choose how you'd like to activate audio tour access on this device.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted">
        {([
          { id: "code",  label: "Access Code",  icon: KeyRound },
          { id: "order", label: "Order + Email", icon: Mail },
        ] as { id: Mode; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setMode(id); setStatus("idle"); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              mode === id
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {status === "error" && errorMsg && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Code tab ── */}
      {mode === "code" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800 space-y-1">
            <p className="font-semibold">Where to find your code</p>
            <p>Check the confirmation email sent after your purchase. The code looks like <strong className="font-mono">ALB-7X2K</strong>. You can also find it on your Shopify order receipt.</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Access Code</label>
            <input
              ref={codeRef}
              type="text"
              value={codeInput}
              onChange={e => { setCodeInput(e.target.value.toUpperCase()); setError(""); }}
              onKeyDown={e => e.key === "Enter" && activateByCode()}
              placeholder="ALB-XXXX"
              maxLength={8}
              className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-lg text-center tracking-[.3em] font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 uppercase"
              aria-label="Access code"
              autoComplete="off"
              autoCapitalize="characters"
            />
          </div>
          <button
            onClick={activateByCode}
            disabled={codeInput.length < 4}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
          >
            <KeyRound size={15} /> Activate with Code
          </button>
          <p className="text-xs text-center text-muted-foreground">
            Families: each person enters the same code on their own device (up to your plan's device limit).
          </p>
        </div>
      )}

      {/* ── Order + Email tab ── */}
      {mode === "order" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Hash size={11} /> Order Number
            </label>
            <input
              type="text"
              value={orderInput}
              onChange={e => { setOrderInput(e.target.value.trim()); setError(""); }}
              placeholder="e.g. 6781681500354"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Mail size={11} /> Email used at checkout
            </label>
            <input
              type="email"
              value={emailInput}
              onChange={e => { setEmailInput(e.target.value.trim()); setError(""); }}
              onKeyDown={e => e.key === "Enter" && activateByOrder(orderInput, emailInput)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <button
            onClick={() => activateByOrder(orderInput, emailInput)}
            disabled={!orderInput || !emailInput}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
          >
            <ChevronRight size={15} /> Activate with Order
          </button>
          <p className="text-xs text-center text-muted-foreground">
            Your order number is in the Shopify confirmation email.
          </p>
        </div>
      )}

      {/* Divider + plans link */}
      <div className="border-t border-border pt-4 text-center space-y-1">
        <p className="text-xs text-muted-foreground">Don't have a subscription yet?</p>
        <Link href="/subscriptions">
          <a className="text-sm font-semibold text-primary hover:underline">
            View plans — from €7.99
          </a>
        </Link>
      </div>
    </div>
  );
}
