/**
 * Offline packs — lets a visitor save one destination (audio, pictures, page data) on the phone
 * and use it without a signal. The service worker (public/sw.js) serves what is saved here.
 *
 * A pack is keyed by destination + language. Saved state lives in localStorage (small record) and
 * Cache Storage (the files). Audio is stored under a path-based key so it matches whichever host
 * the app points at.
 */
import { RAILWAY_URL } from "@/lib/queryClient";

export interface PackAudio { type: "site" | "attraction"; id: number; lang: string; url: string; v: number; bytes: number; label: string }
export interface PackPlan {
  slug: string; lang: string; name: string; siteId: number;
  stops: number; audioCount: number; audioBytes: number;
  audio: PackAudio[]; images: string[]; api: string[];
}
export interface PackRecord {
  slug: string; lang: string; name: string; bytes: number;
  audioCount: number; stops: number; savedAt: number;
  audioKeys: string[]; images: string[];
}
export interface Progress { doneBytes: number; totalBytes: number; doneFiles: number; totalFiles: number; stage: "data" | "pictures" | "audio" | "done" }

const AUDIO_CACHE = "aat-audio-v1";
const API_CACHE = "aat-api-v1";
const IMG_CACHE = "aat-img-v1";
const EXTRA_CACHE = "aat-extra-v1";
const SHELL_CACHE = "aat-shell-v1"; // must match SHELL in public/sw.js
const STORE_KEY = "alb_offline_packs";
const EVENT = "aat-offline-change";

export const packId = (slug: string, lang: string) => `${slug}:${lang}`;

export function offlineSupported(): boolean {
  try {
    return typeof window !== "undefined" && "serviceWorker" in navigator && "caches" in window && window.isSecureContext;
  } catch { return false; }
}

/** Registers the worker once the page has loaded; failures are silent (the site works without it). */
export function registerOfflineWorker(): void {
  if (!offlineSupported()) return;
  const go = () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); };
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}

export function audioCacheKey(type: string, id: number, lang: string): string {
  return `${window.location.origin}/__aat_audio/${type}/${id}/${lang}`;
}

// ── Saved-pack records ─────────────────────────────────────────────────────────
export function getPacks(): Record<string, PackRecord> {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch { return {}; }
}
function setPacks(p: Record<string, PackRecord>) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch {}
  window.dispatchEvent(new Event(EVENT));
}
export function onPacksChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}
export function getPack(slug: string, lang: string): PackRecord | undefined {
  return getPacks()[packId(slug, lang)];
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${Math.round(n / 1024 / 1024)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export async function fetchPackPlan(slug: string, lang: string, signal?: AbortSignal): Promise<PackPlan> {
  const res = await fetch(`${RAILWAY_URL}/api/offline/pack/${encodeURIComponent(slug)}?lang=${encodeURIComponent(lang)}`, { signal });
  if (!res.ok) throw new Error(`Could not prepare the download (${res.status})`);
  return res.json();
}

/** Room check before a large download. Browsers that can't report storage are allowed through. */
export async function checkRoom(neededBytes: number): Promise<{ ok: boolean; freeBytes?: number }> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.quota != null && est.usage != null) {
      const free = est.quota - est.usage;
      return { ok: free > neededBytes * 1.2 + 20 * 1024 * 1024, freeBytes: free };
    }
  } catch {}
  return { ok: true };
}

async function persistStorage() {
  try { await navigator.storage?.persist?.(); } catch {}
}

/** Pages whose code the offline view needs; loading them once puts their files in the cache. */
async function warmPageCode() {
  await Promise.allSettled([
    import("@/pages/DestinationPage"), import("@/pages/AttractionDetailPage"),
    import("@/pages/SiteDetailPage"), import("@/pages/SitesPage"), import("@/pages/PassportPage"),
  ]);
}

/**
 * Saves the app itself (entry page + every build file loaded so far) so the site opens with no
 * signal. The worker only starts caching after its first reload, so the files this visit already
 * loaded must be added here.
 */
async function warmShell() {
  const shell = await caches.open(SHELL_CACHE);
  const idx = await fetch("/", { cache: "reload" });
  if (idx.ok) await shell.put("/index.html", idx);
  const urls = Array.from(new Set(
    performance.getEntriesByType("resource").map(e => e.name).filter(u => {
      try { const x = new URL(u); return x.origin === window.location.origin && x.pathname.startsWith("/assets/"); } catch { return false; }
    }),
  ));
  await Promise.allSettled(urls.map(async (u) => {
    if (await shell.match(u)) return;
    const r = await fetch(u);
    if (r.ok) await shell.put(u, r);
  }));
}

async function warmThirdParty() {
  const extra = await caches.open(EXTRA_CACHE);
  const urls = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    .map(l => l.href).filter(h => /unpkg\.com|fontshare\.com/.test(h));
  await Promise.allSettled(urls.map(async (u) => {
    if (await extra.match(u)) return;
    const r = await fetch(u, { mode: "no-cors" });
    await extra.put(u, r);
  }));
}

async function pool<T>(items: T[], size: number, worker: (item: T) => Promise<void>, signal?: AbortSignal) {
  let i = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const item = items[i++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/**
 * Downloads a pack. Resumable: files already saved (same version) are skipped, so retrying after
 * a dropped connection continues where it stopped. Throws on failure or cancel.
 */
export async function downloadPack(
  plan: PackPlan,
  onProgress: (p: Progress) => void,
  signal?: AbortSignal,
): Promise<PackRecord> {
  const total = plan.audioBytes;
  const totalFiles = plan.audio.length;
  let doneBytes = 0;
  let doneFiles = 0;
  const emit = (stage: Progress["stage"]) => onProgress({ doneBytes, totalBytes: total, doneFiles, totalFiles, stage });

  await persistStorage();
  emit("data");

  // 1. page code + data reads the pages make
  const api = await caches.open(API_CACHE);
  await Promise.allSettled([warmPageCode(), warmThirdParty()]);
  await warmShell().catch(() => {});
  await pool(plan.api, 4, async (path) => {
    const url = `${RAILWAY_URL}${path}`;
    const r = await fetch(url, { signal });
    if (r.ok) await api.put(url, r.clone());
  }, signal).catch((e) => { if (e?.name === "AbortError") throw e; });

  // 2. pictures (relayed by the server because the picture host sends no CORS headers)
  emit("pictures");
  const img = await caches.open(IMG_CACHE);
  const savedImages: string[] = [];
  await pool(plan.images, 4, async (u) => {
    try {
      if (await img.match(u)) { savedImages.push(u); return; }
      const r = await fetch(`${RAILWAY_URL}/api/offline/img?u=${encodeURIComponent(u)}`, { signal });
      if (r.ok) { await img.put(u, r); savedImages.push(u); }
    } catch (e: any) { if (e?.name === "AbortError") throw e; }
  }, signal);

  // 3. audio — the big part; progress counts bytes as they arrive
  emit("audio");
  const audio = await caches.open(AUDIO_CACHE);
  const keys: string[] = [];
  await pool(plan.audio, 2, async (a) => {
    const key = audioCacheKey(a.type, a.id, a.lang);
    keys.push(key);
    const existing = await audio.match(key);
    if (existing && existing.headers.get("x-aat-v") === String(a.v)) {
      doneBytes += a.bytes; doneFiles += 1; emit("audio");
      return;
    }
    const r = await fetch(a.url.startsWith("http") ? a.url : `${RAILWAY_URL}${a.url}`, { signal });
    if (!r.ok || !r.body) throw new Error(`Audio for ${a.label} could not be downloaded (${r.status})`);
    let counted = 0;
    const counter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctl) {
        counted += chunk.byteLength;
        doneBytes += chunk.byteLength;
        emit("audio");
        ctl.enqueue(chunk);
      },
    });
    const headers: Record<string, string> = {
      "Content-Type": r.headers.get("content-type") || "audio/mpeg",
      "x-aat-v": String(a.v),
    };
    const len = r.headers.get("content-length");
    if (len) headers["Content-Length"] = len;
    try {
      await audio.put(key, new Response(r.body.pipeThrough(counter), { headers }));
    } catch (e) {
      doneBytes -= counted; // this file will be fetched again on retry
      await audio.delete(key).catch(() => {});
      throw e;
    }
    doneFiles += 1;
    emit("audio");
  }, signal);

  const rec: PackRecord = {
    slug: plan.slug, lang: plan.lang, name: plan.name,
    bytes: plan.audio.reduce((n, a) => n + a.bytes, 0),
    audioCount: plan.audio.length, stops: plan.stops, savedAt: Date.now(),
    audioKeys: keys, images: savedImages,
  };
  const all = getPacks();
  all[packId(plan.slug, plan.lang)] = rec;
  setPacks(all);
  emit("done");
  return rec;
}

export async function deletePack(slug: string, lang: string): Promise<void> {
  const all = getPacks();
  const rec = all[packId(slug, lang)];
  if (!rec) return;
  try {
    const audio = await caches.open(AUDIO_CACHE);
    await Promise.all(rec.audioKeys.map(k => audio.delete(k)));
    const stillUsed = new Set<string>();
    for (const [id, other] of Object.entries(all)) if (id !== packId(slug, lang)) other.images.forEach(u => stillUsed.add(u));
    const img = await caches.open(IMG_CACHE);
    await Promise.all(rec.images.filter(u => !stillUsed.has(u)).map(u => img.delete(u)));
    const api = await caches.open(API_CACHE);
    const keys = await api.keys();
    const mine = new RegExp(`/api/(sites|attractions|itineraries|ratings)/${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/|$|\\?)`);
    await Promise.all(keys.filter(k => mine.test(new URL(k.url).pathname + "/")).map(k => api.delete(k)));
  } catch {}
  delete all[packId(slug, lang)];
  setPacks(all);
}

/** True when a saved pack's audio is really still in storage (the browser may clear it). */
export async function verifyPack(slug: string, lang: string): Promise<boolean> {
  const rec = getPack(slug, lang);
  if (!rec) return false;
  try {
    const audio = await caches.open(AUDIO_CACHE);
    for (const k of rec.audioKeys) if (!(await audio.match(k))) return false;
    return true;
  } catch { return false; }
}
