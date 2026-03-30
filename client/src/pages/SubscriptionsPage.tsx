/**
 * SubscriptionsPage — public-facing pricing page.
 * Plans loaded from DB. Shopify checkout URL per plan when wired.
 * Falls back to lead capture (email) until Shopify is connected.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Zap, Building2, Star, ArrowRight, Mail, X, AlertCircle } from "lucide-react";

const RAILWAY_URL = "https://albania-audio-tours-production.up.railway.app";

interface Plan {
  id: number;
  slug: string;
  tier: string;
  name: string;
  tagline: string;
  priceEur: number;
  billingPeriod: string;
  features: string;
  isPopular: boolean;
  ctaLabel: string;
  shopifyCheckoutUrl: string;
}

const PERIOD_LABEL: Record<string, string> = {
  "7-day": "7-day pass",
  month: "/ month",
  year: "/ year",
};

const TIER_ICON: Record<string, any> = {
  individual: Zap,
  commercial: Building2,
};

// ── Lead capture modal ────────────────────────────────────────────────────────
function LeadModal({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setErr("");
    try {
      const res = await fetch(`${RAILWAY_URL}/api/plans/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, planSlug: plan.slug, planName: plan.name }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDone(true);
    } catch (e: any) {
      setErr("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X size={18} />
        </button>

        {done ? (
          <div className="text-center space-y-3 py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Check size={22} className="text-green-600" />
            </div>
            <h3 className="font-bold text-base">You're on the list</h3>
            <p className="text-sm text-muted-foreground">
              We'll email you at <strong>{email}</strong> as soon as <strong>{plan.name}</strong> is available to purchase.
            </p>
            <button onClick={onClose} className="w-full mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
              Got it
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-1">Interested in</p>
              <h3 className="font-bold text-base">{plan.name} — €{plan.priceEur} / {PERIOD_LABEL[plan.billingPeriod] || plan.billingPeriod}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Payments launch soon. Leave your email and we'll notify you the moment it's live — plus an early-bird discount.
              </p>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              {err && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{err}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</> : <><Mail size={13} />Notify Me</>}
              </button>
              <p className="text-xs text-center text-muted-foreground">No spam. One email when payments launch.</p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, onSelect }: { plan: Plan; onSelect: (p: Plan) => void }) {
  const features: string[] = (() => { try { return JSON.parse(plan.features); } catch { return []; } })();
  const Icon = TIER_ICON[plan.tier] || Zap;

  function handleCta() {
    if (plan.shopifyCheckoutUrl) {
      window.open(plan.shopifyCheckoutUrl, "_blank", "noopener noreferrer");
    } else {
      onSelect(plan);
    }
  }

  return (
    <div className={`relative flex flex-col rounded-2xl border p-6 transition-shadow hover:shadow-lg ${
      plan.isPopular
        ? "border-primary shadow-md bg-card ring-2 ring-primary/20"
        : "border-border bg-card"
    }`}>
      {plan.isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white"
            style={{ background: "hsl(var(--primary))" }}>
            <Star size={10} fill="currentColor" /> Most Popular
          </span>
        </div>
      )}

      <div className="flex items-start gap-3 mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          plan.tier === "commercial" ? "bg-slate-100" : "bg-primary/10"
        }`}>
          <Icon size={16} className={plan.tier === "commercial" ? "text-slate-600" : "text-primary"} />
        </div>
        <div>
          <h3 className="font-bold text-sm">{plan.name}</h3>
          <p className="text-xs text-muted-foreground">{plan.tagline}</p>
        </div>
      </div>

      {/* Price */}
      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black">€{plan.priceEur % 1 === 0 ? plan.priceEur.toFixed(0) : plan.priceEur.toFixed(2)}</span>
          <span className="text-sm text-muted-foreground">{PERIOD_LABEL[plan.billingPeriod] || `/ ${plan.billingPeriod}`}</span>
        </div>
        {plan.billingPeriod === "year" && plan.priceEur < 100 && (
          <p className="text-xs text-green-600 font-medium mt-0.5">
            ≈ €{(plan.priceEur / 12).toFixed(2)} / month
          </p>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-2 mb-6 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <Check size={13} className="text-green-500 shrink-0 mt-0.5" />
            <span className="text-foreground">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={handleCta}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
          plan.isPopular
            ? "bg-primary text-primary-foreground hover:opacity-90"
            : "border border-primary text-primary hover:bg-primary hover:text-primary-foreground"
        }`}
      >
        {plan.ctaLabel} <ArrowRight size={14} />
      </button>

      {!plan.shopifyCheckoutUrl && (
        <p className="text-center text-xs text-muted-foreground mt-2">Payments launching soon</p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SubscriptionsPage() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
    queryFn: async () => {
      const res = await fetch(`${RAILWAY_URL}/api/plans`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const individual = plans.filter(p => p.tier === "individual");
  const commercial = plans.filter(p => p.tier === "commercial");

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 pb-28 space-y-12">

      {/* Hero */}
      <div className="text-center space-y-3 max-w-xl mx-auto">
        <p className="text-xs font-semibold text-primary uppercase tracking-widest">Subscriptions</p>
        <h1 className="text-2xl font-black leading-snug" style={{ fontFamily: "var(--font-display)" }}>
          Explore Albania — <span style={{ color: "hsl(var(--primary))" }}>on your terms</span>
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The map, destinations, and text descriptions are always free.
          Subscribe for full audio tours, offline playback, and all 11 languages.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-200 text-xs text-green-700 font-medium">
          <Check size={12} className="text-green-500" /> Free tier available — no credit card needed
        </div>
      </div>

      {/* Comparison anchor */}
      <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto text-center text-xs">
        {[
          { label: "Destinations", value: "43" },
          { label: "Attractions", value: "305+" },
          { label: "Audio Tours", value: "10" },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl border border-border bg-muted/30">
            <p className="font-black text-lg text-foreground">{s.value}</p>
            <p className="text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Individual plans */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <Zap size={16} className="text-primary" />
          <h2 className="font-bold text-base">Individual Plans</h2>
          <span className="text-xs text-muted-foreground">— for travellers & solo explorers</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-72 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Free tier — always shown */}
            <div className="flex flex-col rounded-2xl border border-border p-6 bg-card">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Check size={16} className="text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Free</h3>
                  <p className="text-xs text-muted-foreground">Always free, forever</p>
                </div>
              </div>
              <div className="mb-5">
                <span className="text-3xl font-black">€0</span>
                <span className="text-sm text-muted-foreground"> / always</span>
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {["Interactive map of all destinations","Text descriptions for all 305 attractions","Destination overview pages","Passport & journey tracker","Leaderboard"].map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs">
                    <Check size={13} className="text-green-500 shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <a href="/#/"
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-border hover:bg-muted transition-colors text-center block">
                Start Exploring Free
              </a>
            </div>

            {individual.map(plan => (
              <PlanCard key={plan.id} plan={plan} onSelect={setSelectedPlan} />
            ))}
          </div>
        )}
      </section>

      {/* Commercial plans */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Building2 size={16} className="text-slate-500" />
          <h2 className="font-bold text-base">Commercial Licences</h2>
          <span className="text-xs text-muted-foreground">— for operators, agencies & hostels</span>
        </div>
        <p className="text-xs text-muted-foreground mb-5 max-w-lg">
          Use AlbaTour professionally — for guided tours, hospitality, or travel agencies.
          Commercial licences include permitted commercial use, multi-guide access, and priority support.
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-72 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {commercial.map(plan => (
              <PlanCard key={plan.id} plan={plan} onSelect={setSelectedPlan} />
            ))}
          </div>
        )}
      </section>

      {/* FAQ / trust */}
      <section className="border-t border-border pt-8 space-y-4 max-w-xl mx-auto">
        <h3 className="font-bold text-sm text-center">Common questions</h3>
        {[
          { q: "Do I need to create an account?", a: "Not for the free tier — open the map and explore immediately. Paid plans will require a simple email login to verify your subscription." },
          { q: "Will the free tier ever disappear?", a: "No. The map and text descriptions are free forever. Audio tours are the premium feature that subscriptions unlock." },
          { q: "Can a travel agency use one subscription for multiple guides?", a: "Personal plans are single-user. The Operator Licence covers up to 10 guides. The Agency Licence is unlimited." },
          { q: "When will payments launch?", a: "We're integrating Shopify Payments now. Leave your email on any plan and we'll notify you the moment it's live — with an early-bird discount." },
        ].map(({ q, a }) => (
          <div key={q} className="space-y-1">
            <p className="text-xs font-semibold">{q}</p>
            <p className="text-xs text-muted-foreground">{a}</p>
          </div>
        ))}
      </section>

      {/* Lead modal */}
      {selectedPlan && <LeadModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
    </div>
  );
}
