/**
 * ActivatePage — post-checkout landing page.
 * URL: /#/activate?order_id=X&email=Y
 * Reads order_id + email from query params (set by Shopify Additional Scripts redirect).
 * Calls /api/subscription/activate → stores session token → shows success.
 */

import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { CheckCircle2, AlertCircle, Loader2, Headphones, Map } from "lucide-react";
import { useSubscription } from "@/lib/subscriptionContext";

const RAILWAY_URL = "https://albania-audio-tours-production.up.railway.app";

// Generate a stable device fingerprint from browser signals (not stored cross-origin)
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

export default function ActivatePage() {
  const [, navigate] = useLocation();
  const { setToken } = useSubscription();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "retrying">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [planName, setPlanName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  // Parse query params from hash URL: /#/activate?order_id=X&email=Y
  const query = new URLSearchParams(window.location.hash.includes("?")
    ? window.location.hash.split("?")[1]
    : window.location.search);
  const orderId = query.get("order_id") || query.get("order_id") || "";
  const email = query.get("email") || "";

  async function activate(attempt = 0) {
    if (!orderId || !email) {
      setStatus("error");
      setErrorMsg("Missing order details. Please contact support at info@albaniaaudiotours.com");
      return;
    }

    setStatus(attempt > 0 ? "retrying" : "loading");
    try {
      const res = await fetch(`${RAILWAY_URL}/api/subscription/activate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": getDeviceId(),
        },
        body: JSON.stringify({ orderId, email }),
      });
      const data = await res.json();

      if (res.ok && data.token) {
        setToken(data.token);
        setPlanName(data.planName || "Subscription");
        setExpiresAt(data.expiresAt || "");
        setStatus("success");
      } else if (res.status === 404 && attempt < 4) {
        // Webhook may still be processing — retry up to 4 times with backoff
        setRetryCount(attempt + 1);
        setStatus("retrying");
        setTimeout(() => activate(attempt + 1), 2500);
      } else if (data.code === "DEVICE_LIMIT") {
        setStatus("error");
        setErrorMsg("You've reached the 2-device limit for this subscription. Please contact support to manage your devices.");
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Activation failed. Please contact info@albaniaaudiotours.com");
      }
    } catch {
      if (attempt < 3) {
        setTimeout(() => activate(attempt + 1), 3000);
      } else {
        setStatus("error");
        setErrorMsg("Connection error. Please try refreshing the page or contact support.");
      }
    }
  }

  useEffect(() => { activate(); }, []);

  const expiryDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div className="max-w-md mx-auto px-4 py-16 pb-28 text-center space-y-6">
      {(status === "loading" || status === "retrying") && (
        <>
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Loader2 size={28} className="text-primary animate-spin" />
          </div>
          <h1 className="text-xl font-bold">Activating your subscription…</h1>
          {status === "retrying" && (
            <p className="text-sm text-muted-foreground">
              Almost there — confirming your payment (attempt {retryCount}/4)…
            </p>
          )}
        </>
      )}

      {status === "success" && (
        <>
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold">You're all set!</h1>
            <p className="text-sm text-muted-foreground">
              <strong>{planName}</strong> is now active on this device.
            </p>
            {expiryDate && (
              <p className="text-xs text-muted-foreground">Access until <strong>{expiryDate}</strong></p>
            )}
          </div>

          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm text-left space-y-2">
            <p className="font-semibold text-sm">What's unlocked:</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>✓ All audio tours — 43 destinations, 305+ attractions</li>
              <li>✓ 10 guided walking tours with GPS narration</li>
              <li>✓ Offline audio playback</li>
              <li>✓ All 11 languages</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              Your subscription is active on this device. You can activate on 1 more device (2 total).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate("/")}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
            >
              <Map size={16} /> Start Exploring
            </button>
            <Link href="/sites">
              <a className="w-full py-3 rounded-xl border border-border font-medium text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors">
                <Headphones size={14} /> Browse Audio Tours
              </a>
            </Link>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <AlertCircle size={28} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold">Activation issue</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => activate()}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold">
              Try Again
            </button>
            <a href="mailto:info@albaniaaudiotours.com"
              className="text-xs text-primary hover:underline">
              Contact support
            </a>
          </div>
        </>
      )}
    </div>
  );
}
