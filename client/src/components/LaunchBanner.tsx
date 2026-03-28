/**
 * LaunchBanner — slim top-of-page announcement bar.
 * Communicates that the service is free during an introductory launch period,
 * and will move to a subscription model. Creates urgency without being aggressive.
 * Dismissible per session (no localStorage — not blocked by sandbox).
 */

import { useState } from "react";
import { X, Sparkles } from "lucide-react";

export default function LaunchBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="relative flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white"
      style={{
        background: "linear-gradient(90deg, #1a1a2e 0%, #c0392b 50%, #1a1a2e 100%)",
        minHeight: "36px",
      }}
    >
      {/* Subtle shimmer line */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 3s infinite linear",
        }}
      />

      <Sparkles size={12} className="shrink-0 opacity-80" />

      <span className="text-center leading-snug">
        <span className="font-semibold">Free during launch</span>
        <span className="opacity-80 mx-1">—</span>
        <span className="opacity-90">
          Albania Audio Tours is currently free as we launch. A subscription plan will follow — early explorers enjoy full access now.
        </span>
      </span>

      <button
        onClick={() => setDismissed(true)}
        className="ml-1 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
