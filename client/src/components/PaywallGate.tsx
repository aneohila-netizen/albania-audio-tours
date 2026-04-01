/**
 * PaywallGate — Wraps locked content. Shows paywall when either:
 *   1. isLocked=true on this specific site/destination, OR
 *   2. Global paywall_active=true in app_settings (admin-controlled), OR
 *   3. Global free_until date has passed
 *
 * Uses subscription token (from SubscriptionContext) to auto-unlock for subscribers.
 * Falls back to unlock-code entry for legacy one-time purchases.
 */
import { useState, useEffect } from "react";
import { Lock, Unlock, ExternalLink, Loader2, Headphones, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { RAILWAY_URL } from "@/lib/queryClient";
import { useSubscription } from "@/lib/subscriptionContext";

// Session-level code-unlock state (resets on hard refresh)
let sessionUnlocked = false;

interface PaywallGateProps {
  isLocked: boolean;
  siteName: string;
  shopifyUrl?: string | null;
  children: React.ReactNode;
}

// Fetch the global paywall state once per session and cache it
let _globalPaywallCache: boolean | null = null;
let _globalPaywallFetching: Promise<boolean> | null = null;

async function getGlobalPaywallActive(): Promise<boolean> {
  if (_globalPaywallCache !== null) return _globalPaywallCache;
  if (_globalPaywallFetching) return _globalPaywallFetching;

  _globalPaywallFetching = (async () => {
    try {
      const [pwRes, fuRes] = await Promise.all([
        fetch(`${RAILWAY_URL}/api/settings/paywall_active`),
        fetch(`${RAILWAY_URL}/api/settings/free_until`),
      ]);
      const pw = await pwRes.json();
      const fu = await fuRes.json();

      // Check free_until: if set and in the future, content is still free
      if (fu.value) {
        const freeUntilDate = new Date(fu.value);
        if (!isNaN(freeUntilDate.getTime()) && freeUntilDate > new Date()) {
          _globalPaywallCache = false;
          return false;
        }
        // free_until is in the past → treat as locked (paywall effective)
        _globalPaywallCache = true;
        return true;
      }

      _globalPaywallCache = pw.value === "true";
      return _globalPaywallCache;
    } catch {
      // Fail open: if we can't reach the server, don't block content
      _globalPaywallCache = false;
      return false;
    }
  })();

  return _globalPaywallFetching;
}

// Invalidate the global cache when admin changes settings
export function invalidatePaywallCache() {
  _globalPaywallCache = null;
  _globalPaywallFetching = null;
}

export default function PaywallGate({ isLocked, siteName, shopifyUrl, children }: PaywallGateProps) {
  const { sub } = useSubscription();
  const [globalLocked, setGlobalLocked] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(sessionUnlocked);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    getGlobalPaywallActive().then(setGlobalLocked);
  }, []);

  // Still loading global state
  if (globalLocked === null) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const effectiveLocked = (isLocked || globalLocked) && !sub.active && !unlocked;

  // Not locked or subscriber — show content
  if (!effectiveLocked) return <>{children}</>;

  const handleUnlock = async () => {
    if (!code.trim()) { setError("Please enter your unlock code."); return; }
    setChecking(true);
    setError(null);
    try {
      const r = await fetch(`${RAILWAY_URL}/api/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await r.json();
      if (data.success) {
        sessionUnlocked = true;
        setUnlocked(true);
      } else {
        setError("Invalid code. Check your purchase confirmation email.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex items-center justify-center px-2 py-6">
      <div className="w-full max-w-md space-y-4 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Headphones size={24} className="text-primary" />
          </div>
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-base font-bold mb-1">{siteName}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Audio tours are a <strong>premium feature</strong>.
            Subscribe to unlock all narrated tours, offline playback, and all 11 languages.
            The map and text descriptions are always free.
          </p>
        </div>

        {/* Subscribe CTA */}
        <Link href="/subscriptions">
          <a className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm transition-colors"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
            View Plans — from €7.99 <ArrowRight size={15} />
          </a>
        </Link>

        {/* Shopify direct CTA */}
        {shopifyUrl && (
          <a
            href={shopifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm border border-primary text-primary hover:bg-primary/5 transition-colors"
          >
            <ExternalLink size={14} />
            Buy Direct — Unlock All Tours
          </a>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">Already subscribed?</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Already subscribed — go activate */}
        <p className="text-xs text-muted-foreground">
          If you've purchased,{" "}
          <Link href="/activate">
            <a className="text-primary underline hover:opacity-80">activate your subscription here</a>
          </Link>
          {" "}or{" "}
          <Link href="/subscriptions">
            <a className="text-primary underline hover:opacity-80">sign in with your email</a>
          </Link>
          .
        </p>

        {/* Legacy unlock code entry */}
        <details className="text-left">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground text-center">
            Have an unlock code instead?
          </summary>
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={code}
              onChange={e => { setCode(e.target.value); setError(null); }}
              onKeyDown={e => e.key === "Enter" && handleUnlock()}
              placeholder="Enter your unlock code"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Unlock code"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              onClick={handleUnlock}
              disabled={checking || !code.trim()}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-medium text-sm border border-border hover:bg-muted transition-colors disabled:opacity-50"
            >
              {checking
                ? <><Loader2 size={14} className="animate-spin" /> Checking…</>
                : <><Unlock size={14} /> Unlock with code</>
              }
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
