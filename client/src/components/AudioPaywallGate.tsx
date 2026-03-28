/**
 * AudioPaywallGate — wraps any audio player UI.
 * Shows content to subscribed users; shows unlock prompt to free users.
 * Pass children = the audio player component.
 */

import { Headphones, Lock, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useSubscription } from "@/lib/subscriptionContext";

interface Props {
  children: React.ReactNode;
  /** Optional: show a compact inline gate instead of full card */
  compact?: boolean;
}

export default function AudioPaywallGate({ children, compact = false }: Props) {
  const { sub } = useSubscription();

  // Still checking subscription — show nothing (avoids flash of paywall for subscribers)
  if (sub.checking) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Subscribed — show the audio player
  if (sub.active) {
    return <>{children}</>;
  }

  // Not subscribed — show unlock prompt
  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Lock size={14} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">Audio tours require a subscription</p>
          <p className="text-xs text-muted-foreground">From €7.99 for 7 days</p>
        </div>
        <Link href="/subscriptions">
          <a className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline shrink-0">
            Unlock <ArrowRight size={11} />
          </a>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-4 text-center">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <Headphones size={22} className="text-primary" />
      </div>
      <div className="space-y-1">
        <p className="font-bold text-sm">Audio tours are a premium feature</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Subscribe for full access to all audio narration, offline playback, and all 11 languages.
          The map and text descriptions are always free.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Link href="/subscriptions">
          <a className="block w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold text-center">
            View Plans — from €7.99
          </a>
        </Link>
        <p className="text-xs text-muted-foreground">
          Already subscribed?{" "}
          <Link href="/subscriptions">
            <a className="text-primary hover:underline">Sign in with your email</a>
          </Link>
        </p>
      </div>
    </div>
  );
}
