/**
 * PaywallGate — Wraps locked content. When isLocked=true, shows paywall overlay
 * instead of content. Visitor can unlock with a code (checked against /api/unlock).
 * Session-level unlock: once unlocked, stays unlocked until page reload.
 */
import { useState } from "react";
import { Lock, Unlock, ExternalLink, Loader2 } from "lucide-react";
import { RAILWAY_URL } from "@/lib/queryClient";

// Session-level unlock state (persists across navigation, resets on hard refresh)
let sessionUnlocked = false;

interface PaywallGateProps {
  isLocked: boolean;
  siteName: string;
  shopifyUrl?: string | null;
  children: React.ReactNode;
}

export default function PaywallGate({ isLocked, siteName, shopifyUrl, children }: PaywallGateProps) {
  const [unlocked, setUnlocked] = useState(sessionUnlocked);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Not locked — render children as-is
  if (!isLocked || unlocked) return <>{children}</>;

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
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Lock icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock size={36} className="text-primary" />
          </div>
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-xl font-bold mb-2">{siteName}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            This tour content is part of the <strong>Albania Audio Tours Premium Pass</strong>.
            Unlock all destinations, audio guides, and itineraries with a one-time purchase.
          </p>
        </div>

        {/* Shopify CTA */}
        {shopifyUrl && (
          <a
            href={shopifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm transition-colors"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            <ExternalLink size={16} />
            Unlock All Tours — Book Now
          </a>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">Already purchased?</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Code entry */}
        <div className="space-y-2">
          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value); setError(null); }}
            onKeyDown={e => e.key === "Enter" && handleUnlock()}
            placeholder="Enter your unlock code"
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Unlock code"
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
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

        <p className="text-xs text-muted-foreground">
          Your code is sent by email after purchase on{" "}
          <a
            href="https://albanianEagleTours.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            AlbanianEagleTours.com
          </a>
        </p>
      </div>
    </div>
  );
}
