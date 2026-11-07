/**
 * OfflinePackCard — "Download for offline" for one destination.
 *
 * Free while the platform is free; the moment the paywall is on, it works for subscribers only
 * (same rule as the audio player). Files are saved on the device and served by the service worker.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Download, CheckCircle2, Trash2, Loader2, Lock, WifiOff, RefreshCw, X } from "lucide-react";
import { useApp } from "@/App";
import { useSubscription } from "@/lib/subscriptionContext";
import { getGlobalPaywallActive } from "@/components/PaywallGate";
import {
  offlineSupported, fetchPackPlan, downloadPack, deletePack, getPack, onPacksChange,
  verifyPack, checkRoom, formatBytes, type PackPlan, type PackRecord, type Progress,
} from "@/lib/offline";

interface Props {
  slug: string;
  name: string;
  /** destination flagged as locked in the admin */
  itemLocked?: boolean;
  compact?: boolean;
}

const LANG_NAMES: Record<string, string> = {
  en: "English", al: "Shqip", gr: "Ελληνικά", it: "Italiano", es: "Español", de: "Deutsch",
  fr: "Français", ar: "العربية", ru: "Русский", pt: "Português", cn: "中文",
};
const BIG_DOWNLOAD = 120 * 1024 * 1024;

export default function OfflinePackCard({ slug, name, itemLocked = false, compact = false }: Props) {
  const { lang } = useApp();
  const { sub } = useSubscription();
  const [globalLocked, setGlobalLocked] = useState<boolean | null>(null);
  const [saved, setSaved] = useState<PackRecord | undefined>(() => getPack(slug, lang));
  const [intact, setIntact] = useState(true);
  const [plan, setPlan] = useState<PackPlan | null>(null);
  const [planError, setPlanError] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmBig, setConfirmBig] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const busy = progress !== null;

  useEffect(() => { getGlobalPaywallActive().then(setGlobalLocked); }, []);

  // Keep the saved state in step with other cards / tabs, and check the files are really there.
  useEffect(() => {
    const read = () => {
      const rec = getPack(slug, lang);
      setSaved(rec);
      if (rec) verifyPack(slug, lang).then(setIntact);
    };
    read();
    return onPacksChange(read);
  }, [slug, lang]);

  // Size of the download, fetched once per destination + language.
  useEffect(() => {
    if (!offlineSupported()) return;
    const ac = new AbortController();
    setPlan(null); setPlanError(false);
    fetchPackPlan(slug, lang, ac.signal).then(setPlan).catch((e) => { if (e?.name !== "AbortError") setPlanError(true); });
    return () => ac.abort();
  }, [slug, lang]);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!offlineSupported()) {
    return (
      <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground flex items-center gap-2" data-testid="offline-unsupported">
        <WifiOff size={14} /> Offline downloads need a newer browser. Try Chrome or Safari, and open the site over https.
      </div>
    );
  }

  const locked = (itemLocked || globalLocked === true) && !sub.active;
  const langName = LANG_NAMES[lang] || lang;

  const start = async (force = false) => {
    if (!plan) return;
    setError(null);
    if (!force && plan.audioBytes > BIG_DOWNLOAD) { setConfirmBig(true); return; }
    setConfirmBig(false);
    const room = await checkRoom(plan.audioBytes);
    if (!room.ok) {
      setError(`Not enough free space on this device. This pack needs ${formatBytes(plan.audioBytes)}${room.freeBytes != null ? ` and about ${formatBytes(Math.max(0, room.freeBytes))} is free` : ""}.`);
      return;
    }
    const ac = new AbortController();
    abortRef.current = ac;
    setProgress({ doneBytes: 0, totalBytes: plan.audioBytes, doneFiles: 0, totalFiles: plan.audioCount, stage: "data" });
    try {
      await downloadPack(plan, setProgress, ac.signal);
      setIntact(true);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError("The download stopped before it finished. Tap Retry; it continues where it stopped.");
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  const remove = async () => {
    await deletePack(slug, lang);
    setSaved(undefined);
  };

  const pct = progress && progress.totalBytes > 0 ? Math.min(100, Math.round((progress.doneBytes / progress.totalBytes) * 100)) : 0;
  const stageText = progress
    ? progress.stage === "data" ? "Preparing…" : progress.stage === "pictures" ? "Saving pictures…" : `Saving audio ${pct}% · ${formatBytes(progress.doneBytes)} of ${formatBytes(progress.totalBytes)}`
    : "";

  const shell = `rounded-xl border border-border bg-card ${compact ? "p-3" : "p-4"}`;

  // ── Saved ──
  if (saved && !busy) {
    return (
      <div className={shell} data-testid="offline-saved">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 size={18} className={intact ? "text-green-600 shrink-0 mt-0.5" : "text-amber-600 shrink-0 mt-0.5"} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{intact ? "Saved on this phone" : "Needs to be downloaded again"}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {intact
                ? `${name} · ${langName} · ${saved.audioCount} audio ${saved.audioCount === 1 ? "tour" : "tours"} · ${formatBytes(saved.bytes)}. Works without a signal.`
                : "Your browser cleared part of the saved files. Download again to restore them."}
            </p>
            {intact && <p className="text-[11px] text-muted-foreground mt-1">Tip: add this site to your Home Screen so the phone keeps the files.</p>}
          </div>
        </div>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        <div className="flex gap-2 mt-3">
          {(!intact || (plan && !locked)) && (
            <button onClick={() => start(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors" data-testid="offline-update">
              <RefreshCw size={13} /> {intact ? "Update" : "Download again"}
            </button>
          )}
          <button onClick={remove} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors" data-testid="offline-remove">
            <Trash2 size={13} /> Remove
          </button>
        </div>
      </div>
    );
  }

  // ── Downloading ──
  if (busy) {
    return (
      <div className={shell} data-testid="offline-progress">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 size={16} className="animate-spin text-primary" />
          <span className="font-semibold text-sm">Downloading {name}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-green-600 transition-all duration-300" style={{ width: `${progress!.stage === "audio" ? pct : 4}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{stageText}</p>
        <p className="text-[11px] text-muted-foreground mt-1">Keep this screen open until it finishes.</p>
        <button onClick={() => abortRef.current?.abort()} className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <X size={12} /> Cancel
        </button>
      </div>
    );
  }

  // ── Locked (paywall on, not subscribed) ──
  if (locked) {
    return (
      <div className={shell} data-testid="offline-locked">
        <div className="flex items-start gap-2.5">
          <Lock size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-sm">Download for offline</div>
            <p className="text-xs text-muted-foreground mt-0.5">Save this destination's audio tours on your phone for places with no signal. Included with a subscription.</p>
          </div>
        </div>
        <Link href="/subscriptions">
          <span className="mt-3 flex items-center justify-center w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold cursor-pointer">See plans</span>
        </Link>
      </div>
    );
  }

  // ── Ready to download ──
  const noAudio = plan && plan.audioCount === 0;
  return (
    <div className={shell} data-testid="offline-ready">
      <div className="flex items-start gap-2.5">
        <Download size={16} className="text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Download for offline</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {planError ? "Can't reach the server right now. Try again when you have a signal."
              : !plan ? "Checking the size…"
              : noAudio ? `There is no ${langName} audio for ${name} yet.`
              : `${name} · ${langName} · ${plan.audioCount} audio ${plan.audioCount === 1 ? "tour" : "tours"} · ${formatBytes(plan.audioBytes)}. Pictures and details are included. Use Wi-Fi if you can.`}
          </p>
        </div>
      </div>
      {confirmBig && plan && (
        <p className="text-xs mt-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2">
          This is a large download ({formatBytes(plan.audioBytes)}). Wi-Fi is recommended.
        </p>
      )}
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      <button
        onClick={() => start(confirmBig)}
        disabled={!plan || !!noAudio}
        className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
        data-testid="offline-download"
      >
        <Download size={14} /> {confirmBig ? "Download anyway" : error ? "Retry" : "Download"}
      </button>
    </div>
  );
}
