/**
 * AdminSubscriptions — manage subscription plans + view leads in admin panel.
 * Plans: create, edit price/features/Shopify URL, toggle active, reorder.
 * Leads: view all email signups with plan interest.
 * Paywall Control: global activate/deactivate + free_until date + countdown ribbon.
 */

import { useState, useEffect } from "react";
import {
  Plus, Pencil, Trash2, ArrowLeft, Save, CheckCircle2,
  AlertTriangle, Users, CreditCard, ExternalLink, Star,
  Eye, EyeOff, Building2, Zap, Mail, Download,
  Lock, LockOpen, Clock, CalendarDays, Bell, BellOff, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAdminToken } from "@/lib/adminAuth";

const RAILWAY_URL = "https://albania-audio-tours-production.up.railway.app";

interface Plan {
  id: number; slug: string; tier: string; name: string; tagline: string;
  priceEur: number; billingPeriod: string; features: string;
  isPopular: boolean; isActive: boolean; sortOrder: number;
  shopifyVariantId: string; shopifyCheckoutUrl: string;
  ctaLabel: string; notes: string;
}

interface Lead {
  id: number; email: string; planSlug: string; planName: string;
  source: string; createdAt: string;
}

interface Subscriber {
  id: number; email: string; planSlug: string; planName: string;
  shopifyOrderId: string; priceEur: number;
  startsAt: string; expiresAt: string;
  isActive: boolean; deviceCount: number; notes: string; createdAt: string;
}

type SubView = "plans" | "edit" | "new" | "leads" | "subscribers" | "test";

function blankPlan(): Omit<Plan, "id"> {
  return {
    slug: "", tier: "individual", name: "", tagline: "", priceEur: 0,
    billingPeriod: "year", features: '["Feature 1","Feature 2"]',
    isPopular: false, isActive: true, sortOrder: 0,
    shopifyVariantId: "", shopifyCheckoutUrl: "", ctaLabel: "Get Started", notes: "",
  };
}

export default function AdminSubscriptions() {
  const token = getAdminToken() || "";
  const headers = { "Content-Type": "application/json", "x-admin-token": token };

  const [view, setView] = useState<SubView>("plans");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [testEmail, setTestEmail] = useState("");
  const [testPlan, setTestPlan] = useState("");
  const [testDays, setTestDays] = useState(7);
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [editPlan, setEditPlan] = useState<(Omit<Plan,"id"> & { id?: number }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ── Load ────────────────────────────────────────────────────────────────────
  async function loadPlans() {
    setLoading(true);
    try {
      const res = await fetch(`${RAILWAY_URL}/api/admin/plans`, { headers: { "x-admin-token": token } });
      if (res.ok) setPlans(await res.json());
    } finally { setLoading(false); }
  }
  async function loadLeads() {
    const res = await fetch(`${RAILWAY_URL}/api/admin/leads`, { headers: { "x-admin-token": token } });
    if (res.ok) setLeads(await res.json());
  }
  async function loadSubscribers() {
    const res = await fetch(`${RAILWAY_URL}/api/admin/subscriptions`, { headers: { "x-admin-token": token } });
    if (res.ok) setSubscribers(await res.json());
  }
  async function revokeSubscriber(id: number) {
    if (!confirm("Revoke this subscription? The user will immediately lose access.")) return;
    const res = await fetch(`${RAILWAY_URL}/api/admin/subscriptions/${id}/revoke`, {
      method: "PUT", headers: { "x-admin-token": token },
    });
    if (res.ok) setSubscribers(prev => prev.map(s => s.id === id ? { ...s, isActive: false } : s));
  }
  async function runTestActivate() {
    if (!testEmail || !testPlan) return;
    setTestLoading(true); setTestResult(null);
    const res = await fetch(`${RAILWAY_URL}/api/admin/subscriptions/test-activate`, {
      method: "POST", headers,
      body: JSON.stringify({ email: testEmail, planSlug: testPlan, daysFromNow: testDays }),
    });
    const data = await res.json();
    setTestResult(data);
    setTestLoading(false);
    if (data.success) loadSubscribers();
  }

  // ── Paywall global settings ─────────────────────────────────────────────────
  const [paywallActive, setPaywallActive] = useState<boolean | null>(null);
  const [freeUntil, setFreeUntil] = useState<string>(""); // ISO date string or ""
  const [countdownEnabled, setCountdownEnabled] = useState<boolean>(false);
  const [paywallSaving, setPaywallSaving] = useState(false);
  const [paywallMsg, setPaywallMsg] = useState("");
  const [paywallErr, setPaywallErr] = useState("");

  async function loadPaywallSettings() {
    try {
      const res = await fetch(`${RAILWAY_URL}/api/admin/settings`, { headers: { "x-admin-token": token } });
      if (!res.ok) return;
      const all: Array<{ key: string; value: string }> = await res.json();
      const pw = all.find(s => s.key === "paywall_active");
      const fu = all.find(s => s.key === "free_until");
      const cd = all.find(s => s.key === "countdown_enabled");
      setPaywallActive(pw ? pw.value === "true" : false);
      setFreeUntil(fu ? fu.value : "");
      setCountdownEnabled(cd ? cd.value === "true" : false);
    } catch {}
  }

  async function savePaywallSetting(key: string, value: string) {
    await fetch(`${RAILWAY_URL}/api/admin/settings/${key}`, {
      method: "PUT", headers,
      body: JSON.stringify({ value }),
    });
  }

  async function applyPaywall(active: boolean) {
    setPaywallSaving(true); setPaywallMsg(""); setPaywallErr("");
    try {
      await savePaywallSetting("paywall_active", String(active));
      // If activating, clear free_until so it doesn't override
      if (active) {
        await savePaywallSetting("free_until", "");
        setFreeUntil("");
      }
      setPaywallActive(active);
      setPaywallMsg(active ? "Paywall activated — audio content is now locked." : "Paywall deactivated — all content is free.");
      setTimeout(() => setPaywallMsg(""), 4000);
    } catch { setPaywallErr("Save failed. Please try again."); }
    finally { setPaywallSaving(false); }
  }

  async function applyFreeUntil() {
    if (!freeUntil) { setPaywallErr("Please select a date."); return; }
    setPaywallSaving(true); setPaywallMsg(""); setPaywallErr("");
    try {
      await savePaywallSetting("free_until", freeUntil);
      // Deactivate the hard paywall so free_until takes effect
      await savePaywallSetting("paywall_active", "false");
      setPaywallActive(false);
      setPaywallMsg(`Free access set until ${new Date(freeUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} — paywall auto-activates after.`);
      setTimeout(() => setPaywallMsg(""), 5000);
    } catch { setPaywallErr("Save failed."); }
    finally { setPaywallSaving(false); }
  }

  async function toggleCountdown(val: boolean) {
    setCountdownEnabled(val);
    await savePaywallSetting("countdown_enabled", String(val));
    setPaywallMsg(val ? "Countdown ribbon enabled." : "Countdown ribbon hidden.");
    setTimeout(() => setPaywallMsg(""), 3000);
  }

  // Compute effective lock state: paywall_active=true, OR free_until is in the past
  const effectiveLocked = paywallActive === true ||
    (!!freeUntil && new Date(freeUntil) < new Date());

  const [loaded, setLoaded] = useState(false);
  if (!loaded) { setLoaded(true); loadPlans(); loadLeads(); loadSubscribers(); loadPaywallSettings(); }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function savePlan() {
    if (!editPlan?.name || !editPlan?.slug) { setError("Name and slug are required."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const isNew = !editPlan.id;
      const url = isNew ? `${RAILWAY_URL}/api/admin/plans` : `${RAILWAY_URL}/api/admin/plans/${editPlan.id}`;
      const res = await fetch(url, { method: isNew ? "POST" : "PUT", headers, body: JSON.stringify(editPlan) });
      if (!res.ok) throw new Error(await res.text());
      const saved: Plan = await res.json();
      setPlans(prev => isNew ? [...prev, saved] : prev.map(p => p.id === saved.id ? saved : p));
      setSuccess(`"${saved.name}" saved.`);
      setTimeout(() => { setSuccess(""); setView("plans"); }, 1200);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  // ── Toggle active ───────────────────────────────────────────────────────────
  async function toggleActive(plan: Plan) {
    const res = await fetch(`${RAILWAY_URL}/api/admin/plans/${plan.id}`, {
      method: "PUT", headers, body: JSON.stringify({ isActive: !plan.isActive }),
    });
    if (res.ok) { const s: Plan = await res.json(); setPlans(prev => prev.map(p => p.id === s.id ? s : p)); }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function deletePlan(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`${RAILWAY_URL}/api/admin/plans/${id}`, {
      method: "DELETE", headers: { "x-admin-token": token, "x-confirm-delete": "yes" },
    });
    if (res.ok) setPlans(prev => prev.filter(p => p.id !== id));
  }

  // ── Export leads CSV ────────────────────────────────────────────────────────
  function exportLeads() {
    const header = "ID,Email,Plan,Source,Date";
    const rows = leads.map(l => `${l.id},"${l.email}","${l.planName}","${l.source}","${l.createdAt}"`);
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `albatour-leads-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  // ── Parse features textarea ─────────────────────────────────────────────────
  function featuresText(features: string): string {
    try { return JSON.parse(features).join("\n"); } catch { return features; }
  }
  function textToFeatures(text: string): string {
    return JSON.stringify(text.split("\n").map(l => l.trim()).filter(Boolean));
  }

  // ════════════════════════════════════════════════════════════════
  // PLANS LIST
  // ════════════════════════════════════════════════════════════════
  if (view === "plans") {
    const individual = plans.filter(p => p.tier === "individual");
    const commercial = plans.filter(p => p.tier === "commercial");

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">Subscriptions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Manage plans, Shopify checkout URLs, and view leads</p>
          </div>
          <div className="flex gap-1 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => { setView("subscribers"); loadSubscribers(); }}>
              <Users size={13} className="mr-1" /> Subscribers {subscribers.length > 0 && `(${subscribers.length})`}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setView("leads"); loadLeads(); }}>
              <Mail size={13} className="mr-1" /> Leads {leads.length > 0 && `(${leads.length})`}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setView("test")}>
              🧪 Test
            </Button>
            <Button size="sm" onClick={() => { setEditPlan(blankPlan()); setView("new"); setError(""); }}>
              <Plus size={13} className="mr-1" /> New Plan
            </Button>
          </div>
        </div>

        {error && <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs"><AlertTriangle size={13} />{error}</div>}

        {/* ── PAYWALL CONTROL PANEL ────────────────────────────────── */}
        <div className={`rounded-2xl border-2 p-4 space-y-4 ${
          effectiveLocked
            ? "border-red-300 bg-red-50"
            : freeUntil && new Date(freeUntil) > new Date()
              ? "border-amber-300 bg-amber-50"
              : "border-green-300 bg-green-50"
        }`}>
          {/* Status header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {effectiveLocked
                ? <Lock size={16} className="text-red-600" />
                : <LockOpen size={16} className="text-green-600" />}
              <span className="font-bold text-sm">
                {effectiveLocked ? "Paywall Active — Content Locked" : "Content Free — Paywall Inactive"}
              </span>
            </div>
            <button
              onClick={loadPaywallSettings}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>

          {/* Status detail */}
          {paywallActive === null ? (
            <p className="text-xs text-muted-foreground">Loading paywall status…</p>
          ) : (
            <p className="text-xs leading-relaxed"
              style={{ color: effectiveLocked ? "#b91c1c" : freeUntil && new Date(freeUntil) > new Date() ? "#92400e" : "#166534" }}>
              {effectiveLocked
                ? "Audio tours are locked. Only subscribed users can access audio content."
                : freeUntil && new Date(freeUntil) > new Date()
                  ? `Free until ${new Date(freeUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} — paywall activates automatically after that date.`
                  : "All audio content is currently free for everyone."}
            </p>
          )}

          {paywallMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-100 border border-green-200 text-green-800 text-xs">
              <CheckCircle2 size={12} /> {paywallMsg}
            </div>
          )}
          {paywallErr && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-100 border border-red-200 text-red-700 text-xs">
              <AlertTriangle size={12} /> {paywallErr}
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => applyPaywall(true)}
              disabled={paywallSaving || effectiveLocked}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition-colors ${
                effectiveLocked
                  ? "bg-red-200 text-red-700 cursor-default"
                  : "bg-red-500 hover:bg-red-600 text-white"
              } disabled:opacity-60`}
            >
              <Lock size={12} />
              {effectiveLocked ? "Currently Locked" : "Activate Paywall"}
            </button>
            <button
              onClick={() => applyPaywall(false)}
              disabled={paywallSaving || (!effectiveLocked && !freeUntil)}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition-colors ${
                !effectiveLocked && !freeUntil
                  ? "bg-green-200 text-green-700 cursor-default"
                  : "bg-green-500 hover:bg-green-600 text-white"
              } disabled:opacity-60`}
            >
              <LockOpen size={12} />
              {!effectiveLocked && !freeUntil ? "Currently Free" : "Deactivate Paywall"}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-black/10" />
            <span className="text-xs font-medium text-muted-foreground">Schedule free access window</span>
            <div className="flex-1 h-px bg-black/10" />
          </div>

          {/* Free Until date picker */}
          <div className="space-y-2">
            <label className="text-xs font-medium flex items-center gap-1.5">
              <CalendarDays size={12} /> Free Until Date
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={freeUntil ? freeUntil.slice(0, 10) : ""}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => {
                  setFreeUntil(e.target.value ? e.target.value + "T23:59:59.000Z" : "");
                  setPaywallErr("");
                }}
                className="flex-1 h-8 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                onClick={applyFreeUntil}
                disabled={paywallSaving || !freeUntil}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
              >
                <Clock size={11} /> Set
              </button>
              {freeUntil && (
                <button
                  onClick={async () => {
                    setFreeUntil("");
                    await savePaywallSetting("free_until", "");
                    setPaywallMsg("Free window cleared.");
                    setTimeout(() => setPaywallMsg(""), 3000);
                  }}
                  className="px-2 py-1.5 rounded-lg border border-border bg-white hover:bg-muted text-xs text-muted-foreground"
                  title="Clear date"
                >
                  ×
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Content stays free until this date, then locks automatically. Leave blank for manual control.
            </p>
          </div>

          {/* Countdown ribbon toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-black/10 bg-white/60">
            <div className="flex items-center gap-2">
              {countdownEnabled ? <Bell size={13} className="text-amber-600" /> : <BellOff size={13} className="text-muted-foreground" />}
              <div>
                <p className="text-xs font-semibold">Countdown Ribbon</p>
                <p className="text-xs text-muted-foreground">Shows a live countdown timer at the top of the page</p>
              </div>
            </div>
            <button
              onClick={() => toggleCountdown(!countdownEnabled)}
              className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                countdownEnabled ? "bg-amber-500" : "bg-muted-foreground/30"
              }`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                countdownEnabled ? "translate-x-5" : "translate-x-0.5"
              }`} />
            </button>
          </div>
        </div>
        {/* ── END PAYWALL CONTROL PANEL ──────────────────────────────── */}

        {/* Shopify setup callout */}
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-xs space-y-1">
          <p className="font-semibold text-blue-800 flex items-center gap-1"><CreditCard size={12} /> Shopify Integration</p>
          <p className="text-blue-700">
            To activate payments: create a product in your Shopify store for each plan, copy the checkout URL (or variant ID),
            and paste it into each plan's "Shopify Checkout URL" field below. Visitors will be sent directly to Shopify checkout.
          </p>
          <p className="text-blue-600 font-medium">Until URLs are set, a lead-capture form collects visitor emails instead.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: CreditCard, label: "Active Plans", value: plans.filter(p => p.isActive).length },
            { icon: Users, label: "Leads Collected", value: leads.length },
            { icon: CreditCard, label: "Shopify Ready", value: plans.filter(p => p.shopifyCheckoutUrl).length },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="p-3 rounded-xl border border-border bg-card text-center">
              <p className="text-xl font-black">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-8">Loading plans…</div>
        ) : (
          <>
            {/* Individual plans */}
            {individual.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Zap size={11} /> Individual Plans
                </div>
                <div className="space-y-2">
                  {individual.map(plan => <PlanRow key={plan.id} plan={plan} onEdit={() => { setEditPlan({...plan}); setView("edit"); setError(""); setSuccess(""); }} onToggle={() => toggleActive(plan)} onDelete={() => deletePlan(plan.id, plan.name)} />)}
                </div>
              </div>
            )}
            {/* Commercial plans */}
            {commercial.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Building2 size={11} /> Commercial Licences
                </div>
                <div className="space-y-2">
                  {commercial.map(plan => <PlanRow key={plan.id} plan={plan} onEdit={() => { setEditPlan({...plan}); setView("edit"); setError(""); setSuccess(""); }} onToggle={() => toggleActive(plan)} onDelete={() => deletePlan(plan.id, plan.name)} />)}
                </div>
              </div>
            )}
            {plans.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <CreditCard size={28} className="mx-auto mb-2 opacity-30" />
                No plans yet. Click <strong>New Plan</strong> to create one.
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // LEADS LIST
  // ════════════════════════════════════════════════════════════════
  if (view === "leads") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setView("plans")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Back
          </button>
          <h2 className="font-bold text-sm flex-1 text-center">Subscription Leads</h2>
          {leads.length > 0 && (
            <Button size="sm" variant="outline" onClick={exportLeads}>
              <Download size={13} className="mr-1" /> Export CSV
            </Button>
          )}
        </div>

        {leads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Mail size={28} className="mx-auto mb-2 opacity-30" />
            No leads yet — they'll appear here when visitors sign up on the pricing page.
          </div>
        ) : (
          <div className="space-y-2">
            {leads.map(lead => (
              <div key={lead.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card text-sm">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail size={12} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{lead.email}</p>
                  <p className="text-xs text-muted-foreground">{lead.planName} · {new Date(lead.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{lead.source}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // EDIT / NEW PLAN
  // ════════════════════════════════════════════════════════════════
  if ((view === "edit" || view === "new") && editPlan) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => { setView("plans"); setEditPlan(null); setError(""); setSuccess(""); }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Back
          </button>
          <h2 className="font-bold text-sm flex-1 text-center">
            {view === "new" ? "New Plan" : `Edit: ${editPlan.name || "Untitled"}`}
          </h2>
          <Button size="sm" onClick={savePlan} disabled={saving}>
            {saving ? <><div className="w-3 h-3 border border-t-transparent rounded-full animate-spin mr-1" />Saving…</> : <><Save size={13} className="mr-1" />Save</>}
          </Button>
        </div>

        {error && <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs"><AlertTriangle size={13} />{error}</div>}
        {success && <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs"><CheckCircle2 size={13} />{success}</div>}

        <Card>
          <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm">Plan Details</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tier</label>
                <Select value={editPlan.tier} onValueChange={v => setEditPlan(p => p ? {...p, tier: v} : p)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Billing Period</label>
                <Select value={editPlan.billingPeriod} onValueChange={v => setEditPlan(p => p ? {...p, billingPeriod: v} : p)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7-day">7-Day Pass</SelectItem>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Plan Name *</label>
              <Input value={editPlan.name} onChange={e => setEditPlan(p => p ? {...p, name: e.target.value, slug: p.id ? p.slug : e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')} : p)} placeholder="e.g. Explorer" className="h-8 text-sm" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Slug (URL key) *</label>
              <Input value={editPlan.slug} onChange={e => setEditPlan(p => p ? {...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')} : p)} placeholder="e.g. explorer" className="h-8 text-sm font-mono" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tagline</label>
              <Input value={editPlan.tagline} onChange={e => setEditPlan(p => p ? {...p, tagline: e.target.value} : p)} placeholder="e.g. Best value for Albania lovers" className="h-8 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Price (€)</label>
                <Input type="number" step="0.01" value={editPlan.priceEur} onChange={e => setEditPlan(p => p ? {...p, priceEur: parseFloat(e.target.value)||0} : p)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Sort Order</label>
                <Input type="number" value={editPlan.sortOrder} onChange={e => setEditPlan(p => p ? {...p, sortOrder: parseInt(e.target.value)||0} : p)} className="h-8 text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CTA Button Label</label>
              <Input value={editPlan.ctaLabel} onChange={e => setEditPlan(p => p ? {...p, ctaLabel: e.target.value} : p)} placeholder="e.g. Start Exploring" className="h-8 text-sm" />
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              {[
                { key: "isPopular", label: "Mark as Popular", color: "text-amber-600" },
                { key: "isActive",  label: "Active (visible to users)", color: "text-green-600" },
              ].map(({ key, label, color }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none"
                  onClick={() => setEditPlan(p => p ? {...p, [key]: !(p as any)[key]} : p)}>
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${(editPlan as any)[key] ? "bg-primary" : "bg-muted-foreground/30"}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${(editPlan as any)[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                  <span className={`text-xs font-medium ${(editPlan as any)[key] ? color : "text-muted-foreground"}`}>{label}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm">Features</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4">
            <Textarea
              value={featuresText(editPlan.features)}
              onChange={e => setEditPlan(p => p ? {...p, features: textToFeatures(e.target.value)} : p)}
              placeholder={"One feature per line:\nAll 43 destinations\n10 audio walking tours\nOffline playback"}
              className="text-sm min-h-[140px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">One feature per line. Each line becomes a bullet on the pricing page.</p>
          </CardContent>
        </Card>

        {/* Shopify */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-1.5"><CreditCard size={13} /> Shopify Integration</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">How to connect this plan to Shopify:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Go to your Shopify admin → Products → Add product</li>
                <li>Name it "AlbaTour {editPlan.name || "Plan"}" and set the price to €{editPlan.priceEur}</li>
                <li>Under "Online store" → copy the product URL, add <code>?checkout=true</code> or use the direct Buy Button URL</li>
                <li>Paste that URL in the "Shopify Checkout URL" field below</li>
                <li>Save — the plan's button will now link directly to Shopify checkout</li>
              </ol>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Shopify Checkout URL</label>
              <Input value={editPlan.shopifyCheckoutUrl} onChange={e => setEditPlan(p => p ? {...p, shopifyCheckoutUrl: e.target.value} : p)}
                placeholder="https://your-store.myshopify.com/cart/..." className="h-8 text-sm" />
              <p className="text-xs text-muted-foreground mt-0.5">Leave empty to show lead-capture form instead.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Shopify Variant ID (optional)</label>
              <Input value={editPlan.shopifyVariantId} onChange={e => setEditPlan(p => p ? {...p, shopifyVariantId: e.target.value} : p)}
                placeholder="e.g. 12345678901234" className="h-8 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Admin Notes (internal only)</label>
              <Textarea value={editPlan.notes} onChange={e => setEditPlan(p => p ? {...p, notes: e.target.value} : p)}
                placeholder="e.g. Check with Shopify team about subscription billing settings" className="text-sm min-h-[60px]" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pb-6">
          <Button variant="outline" size="sm" onClick={() => { setView("plans"); setEditPlan(null); }}>Cancel</Button>
          <Button size="sm" onClick={savePlan} disabled={saving}>
            {saving ? "Saving…" : <><Save size={13} className="mr-1" />Save Plan</>}
          </Button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // SUBSCRIBERS LIST
  // ════════════════════════════════════════════════════════════════
  if (view === "subscribers") {
    const active = subscribers.filter(s => s.isActive && new Date(s.expiresAt) > new Date());
    const expired = subscribers.filter(s => !s.isActive || new Date(s.expiresAt) <= new Date());
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setView("plans")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Back
          </button>
          <h2 className="font-bold text-sm flex-1 text-center">Subscribers ({subscribers.length})</h2>
          <Button size="sm" variant="outline" onClick={loadSubscribers}>Refresh</Button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[{label: "Total", val: subscribers.length}, {label: "Active", val: active.length}, {label: "Expired/Revoked", val: expired.length}].map(({label,val}) => (
            <div key={label} className="p-2 rounded-xl border border-border bg-card">
              <p className="font-black text-lg">{val}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {subscribers.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <Users size={28} className="mx-auto mb-2 opacity-30" />
            No subscribers yet. Use the 🧪 Test button to create a test subscription.
          </div>
        ) : (
          <div className="space-y-2">
            {subscribers.map(sub => {
              const isLive = sub.isActive && new Date(sub.expiresAt) > new Date();
              const expDate = new Date(sub.expiresAt).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
              return (
                <div key={sub.id} className={`flex items-start gap-3 p-3 rounded-xl border bg-card ${
                  isLive ? "border-border" : "border-dashed border-border opacity-60"
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{sub.email}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{sub.planName}</span>
                      {isLive
                        ? <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Active</span>
                        : <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600">{sub.isActive ? "Expired" : "Revoked"}</span>}
                      {sub.notes?.includes("TEST") && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">Test</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isLive ? `Expires: ${expDate}` : `Expired: ${expDate}`} · {sub.deviceCount} device(s) · €{sub.priceEur}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground opacity-60">{sub.shopifyOrderId}</p>
                  </div>
                  {isLive && (
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 text-xs shrink-0"
                      onClick={() => revokeSubscriber(sub.id)}>
                      Revoke
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // TEST ACTIVATION
  // ════════════════════════════════════════════════════════════════
  if (view === "test") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setView("plans")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Back
          </button>
          <h2 className="font-bold text-sm flex-1 text-center">🧪 Test Subscription Activation</h2>
          <div className="w-16" />
        </div>

        <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-xs text-yellow-800">
          <p className="font-semibold">How this test works:</p>
          <ol className="list-decimal list-inside mt-1 space-y-0.5">
            <li>Enter any email and select a plan below</li>
            <li>Click "Create Test Subscription" — creates a real DB record with TEST flag</li>
            <li>Copy the session token, go to <code>/#/activate</code>, paste to verify unlock works</li>
            <li>The test subscription auto-expires after the days you set</li>
            <li>You can also revoke it immediately from the Subscribers list</li>
          </ol>
        </div>

        <Card>
          <CardContent className="px-4 py-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Test Email</label>
              <Input value={testEmail} onChange={e => setTestEmail(e.target.value)}
                placeholder="test@example.com" className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Plan</label>
              <Select value={testPlan} onValueChange={setTestPlan}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select a plan" /></SelectTrigger>
                <SelectContent>
                  {plans.map(p => <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Expires in (days)</label>
              <Input type="number" value={testDays} onChange={e => setTestDays(parseInt(e.target.value)||1)}
                min={1} max={365} className="h-8 text-sm" />
            </div>
            <Button className="w-full" onClick={runTestActivate} disabled={testLoading || !testEmail || !testPlan}>
              {testLoading ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Running…</> : "🧪 Create Test Subscription"}
            </Button>
          </CardContent>
        </Card>

        {testResult && (
          <div className={`p-4 rounded-xl border text-xs font-mono space-y-2 ${
            testResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
          }`}>
            <p className={testResult.success ? "text-green-700 font-bold" : "text-red-700 font-bold"}>
              {testResult.success ? "✓ Test subscription created" : "✗ Error"}
            </p>
            {testResult.success && (
              <>
                <p className="text-green-700">Session token: <span className="break-all">{testResult.sub?.sessionToken}</span></p>
                <p className="text-green-700">Expires: {testResult.sub?.expiresAt}</p>
                <p className="text-muted-foreground mt-2">To test the unlock flow:</p>
                <p className="text-muted-foreground">1. Open <a className="text-primary underline" href={`/#/activate?order_id=${testResult.sub?.shopifyOrderId}&email=${testResult.sub?.email}`} target="_blank">this activation link</a></p>
                <p className="text-muted-foreground">2. The page should show "You're all set" and activate your session</p>
                <p className="text-muted-foreground">3. Navigate to any destination — audio should be unlocked</p>
                <p className="text-muted-foreground">4. To test lock: go to Subscribers and Revoke this subscription, then refresh</p>
              </>
            )}
            {!testResult.success && <p className="text-red-700">{testResult.error}</p>}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Plan row component ────────────────────────────────────────────────────────
function PlanRow({ plan, onEdit, onToggle, onDelete }: {
  plan: Plan;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const period = { "7-day": "7-day pass", month: "/mo", year: "/yr" }[plan.billingPeriod] || plan.billingPeriod;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border bg-card transition-colors ${plan.isActive ? "border-border" : "border-dashed border-border opacity-60"}`}>
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        {plan.tier === "commercial" ? <Building2 size={13} className="text-slate-500" /> : <Zap size={13} className="text-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{plan.name}</span>
          <span className="font-bold text-sm text-primary">€{plan.priceEur % 1 === 0 ? plan.priceEur : plan.priceEur.toFixed(2)}<span className="font-normal text-muted-foreground text-xs"> {period}</span></span>
          {plan.isPopular && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-0.5"><Star size={9} />Popular</span>}
          {!plan.isActive && <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Hidden</span>}
          {plan.shopifyCheckoutUrl ? <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Shopify ✓</span> : <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">Lead capture</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{plan.tagline}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a href={`https://albania-audio-tours-production.up.railway.app/#/subscriptions`} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink size={12} /></Button>
        </a>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle} title={plan.isActive ? "Hide" : "Show"}>
          {plan.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pencil size={13} /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={onDelete}><Trash2 size={13} /></Button>
      </div>
    </div>
  );
}
