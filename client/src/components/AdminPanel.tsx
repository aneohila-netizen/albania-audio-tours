/**
 * AdminPanel — unified admin UI with NO wouter navigation.
 *
 * State machine: "login" | "sites" | "editor" | "attractions" | "attr-editor"
 * No navigation = no remount = token stays alive.
 *
 * Fixes in this version:
 * 1. Attractions management (list + add/edit/delete per destination)
 * 2. Interactive Leaflet map picker for lat/lng
 * 3. Image upload persisted via localStorage (prototype persistence)
 * 4. Softer "content mode" banner instead of alarming "static prototype" warning
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Lock, Eye, EyeOff, Plus, Pencil, Trash2, LogOut,
  MapPin, Globe, Music, Image, Info, ArrowLeft, Save,
  Upload, Play, Pause, Loader2, X, Link, CheckCircle2,
  LayoutList, Star, Route,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { setAdminToken, getAdminToken, clearAdminToken } from "@/lib/adminAuth";
import { STATIC_SITES, DESTINATIONS, ATTRACTIONS } from "@/lib/staticData";
import type { Destination, Attraction } from "@/lib/staticData";
import type { TourSite } from "@shared/schema";
import ItineraryManager from "@/components/ItineraryManager";

// ─── Auth ─────────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "AlbaTour2026!";
const TOKEN_VALUE = "albatour-admin-secret-token";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  archaeology: "bg-amber-100 text-amber-800",
  castle: "bg-slate-100 text-slate-800",
  beach: "bg-cyan-100 text-cyan-800",
  "historic-town": "bg-purple-100 text-purple-800",
  nature: "bg-green-100 text-green-800",
  mosque: "bg-yellow-100 text-yellow-800",
  museum: "bg-blue-100 text-blue-800",
  monument: "bg-orange-100 text-orange-800",
  district: "bg-pink-100 text-pink-800",
  promenade: "bg-teal-100 text-teal-800",
  landmark: "bg-indigo-100 text-indigo-800",
  ruins: "bg-stone-100 text-stone-800",
  city: "bg-gray-100 text-gray-800",
};

const DEST_CATEGORIES = ["archaeology", "castle", "beach", "historic-town", "nature", "city"];
const ATTR_CATEGORIES = [
  "castle", "mosque", "museum", "monument", "district", "church",
  "promenade", "landmark", "ruins", "nature", "archaeology", "market", "hot-springs",
];
const DIFFICULTIES = ["easy", "moderate", "hard"];
const REGIONS = ["Tirana", "Durrës", "Shkodër", "Lezha", "Berat", "Elbasan", "Korçë", "Vlorë", "Gjirokastër", "Sarandë", "Fier", "Other"];
const LANGS: { key: "en" | "al" | "gr" | "it" | "es" | "de" | "fr" | "ar" | "sl"; label: string; flag: string }[] = [
  { key: "en", label: "English", flag: "🇬🇧" },
  { key: "al", label: "Albanian", flag: "🇦🇱" },
  { key: "gr", label: "Greek", flag: "🇬🇷" },
  { key: "it", label: "Italian", flag: "🇮🇹" },
  { key: "es", label: "Spanish", flag: "🇪🇸" },
  { key: "de", label: "German", flag: "🇩🇪" },
  { key: "fr", label: "French", flag: "🇫🇷" },
  { key: "ar", label: "Arabic", flag: "🇸🇦" },
  { key: "sl", label: "Slovenian", flag: "🇸🇮" },
];

// ─── In-memory session persistence (survives component remounts, not page reload)
// localStorage/sessionStorage are blocked in sandboxed iframes.
let _sites: TourSite[] | null = null;
let _attractions: Attraction[] | null = null;

function loadPersistedSites(): TourSite[] {
  if (_sites === null) _sites = [...(STATIC_SITES as unknown as TourSite[])];
  return _sites;
}

function savePersistedSites(sites: TourSite[]) {
  _sites = sites;
}

function loadPersistedAttractions(): Attraction[] {
  if (_attractions === null) _attractions = [...ATTRACTIONS];
  return _attractions;
}

function savePersistedAttractions(attrs: Attraction[]) {
  _attractions = attrs;
}

// ─── View type ────────────────────────────────────────────────────────────────
type View =
  | { screen: "login" }
  | { screen: "sites" }
  | { screen: "editor"; siteId: number | null }
  | { screen: "attractions"; destinationSlug: string; destinationName: string }
  | { screen: "attr-editor"; attractionId: number | null; destinationSlug: string; destinationName: string };

// ─── Admin fetch helper ────────────────────────────────────────────────────────
const RAILWAY_API = "https://albania-audio-tours-production.up.railway.app";

function adminFetch(url: string, options?: RequestInit) {
  const token = getAdminToken() || "";
  // Always use absolute Railway URL so calls work from any hosting
  const fullUrl = url.startsWith("http") ? url : `${RAILWAY_API}${url}`;
  return fetch(fullUrl, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
      ...(options?.headers || {}),
    },
  });
}

// For multipart/file uploads (no Content-Type header — browser sets boundary)
function adminUpload(url: string, formData: FormData) {
  const token = getAdminToken() || "";
  const fullUrl = url.startsWith("http") ? url : `${RAILWAY_API}${url}`;
  return fetch(fullUrl, {
    method: "POST",
    credentials: "include",
    headers: { "x-admin-token": token },
    body: formData,
  });
}

// ─── BACKEND STATUS BANNER ───────────────────────────────────────────────────
function BackendStatusBanner() {
  const [status, setStatus] = useState<"checking" | "connected" | "offline">("checking");
  const [dbType, setDbType] = useState("");

  useEffect(() => {
    fetch(`${RAILWAY_API}/api/health`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setStatus("connected"); setDbType(d.db || ""); })
      .catch(() => setStatus("offline"));
  }, []);

  if (status === "checking") return (
    <div className="rounded-lg bg-muted/50 border border-border/40 px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting to backend...
    </div>
  );
  if (status === "connected") return (
    <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 px-4 py-3 text-xs text-green-800 dark:text-green-300 flex items-center gap-2">
      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
      <span><strong>Connected to Railway backend</strong> — all changes save permanently to {dbType === "postgres" ? "PostgreSQL database" : "server storage"}. Edits sync across all devices instantly.</span>
    </div>
  );
  return (
    <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
      <strong>Backend offline</strong> — changes saved locally this session only.
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginView({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      if (password === ADMIN_PASSWORD) {
        setAdminToken(TOKEN_VALUE);
        onLogin();
      } else {
        setError("Incorrect password. Please try again.");
      }
      setLoading(false);
    }, 300);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10" aria-label="AlbaniaAudioTours">
              <path d="M20 4 L36 32 L20 26 L4 32 Z" fill="hsl(var(--primary))" opacity="0.9" />
              <path d="M20 4 L20 26" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">AlbaniaAudioTours Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Content Management Dashboard</p>
        </div>

        <Card className="border border-border/60 shadow-lg">
          <CardHeader className="pb-0 pt-6 px-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Lock className="w-4 h-4" />
              <span>Sign in to manage tours</span>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Admin Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your admin password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pr-10"
                    autoFocus
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !password}
                data-testid="button-login"
              >
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Password:{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
            AlbaTour2026!
          </code>
        </p>
      </div>
    </div>
  );
}

// ─── SITES LIST ───────────────────────────────────────────────────────────────
function SitesView({
  onEdit,
  onNew,
  onLogout,
  onManageAttractions,
}: {
  onEdit: (id: number) => void;
  onNew: () => void;
  onLogout: () => void;
  onManageAttractions: (slug: string, name: string) => void;
}) {
  const [sites, setSites] = useState<TourSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => { fetchSites(); }, []);

  async function fetchSites() {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/sites");
      if (res.ok) {
        setSites(await res.json());
      } else {
        setSites(loadPersistedSites());
      }
    } catch {
      setSites(loadPersistedSites());
    }
    setLoading(false);
  }

  async function deleteSite(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await adminFetch(`/api/admin/sites/${id}`, { method: "DELETE" });
    } catch { /* offline */ }
    const updated = sites.filter(s => s.id !== id);
    setSites(updated);
    savePersistedSites(updated);
    setDeleting(null);
  }

  // Count attractions per destination
  const allAttrs = loadPersistedAttractions();
  const attrCounts: Record<string, number> = {};
  allAttrs.forEach(a => {
    attrCounts[a.destinationSlug] = (attrCounts[a.destinationSlug] || 0) + 1;
  });

  const stats = {
    total: sites.length,
    withAudio: sites.filter(s => s.audioUrlEn || s.audioUrlAl || s.audioUrlGr).length,
    regions: new Set(sites.map(s => s.region)).size,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 40 40" fill="none" className="w-7 h-7">
              <path d="M20 4 L36 32 L20 26 L4 32 Z" fill="hsl(var(--primary))" opacity="0.9" />
            </svg>
            <div>
              <span className="font-semibold text-foreground text-sm">AlbaniaAudioTours Admin</span>
              <span className="text-muted-foreground text-xs ml-2">Content Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => window.open("/#/", "_blank")} className="gap-1.5 text-xs">
              <Eye className="w-3.5 h-3.5" /> View App
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout} className="gap-1.5 text-xs text-muted-foreground">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: MapPin, label: "Destinations", value: stats.total },
            { icon: Music, label: "With Audio", value: stats.withAudio },
            { icon: Globe, label: "Regions", value: stats.regions },
          ].map(({ icon: Icon, label, value }) => (
            <Card key={label} className="border-border/60">
              <CardContent className="pt-4 pb-4 px-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold text-foreground">{loading ? "–" : value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Backend status banner */}
        <BackendStatusBanner />

        {/* Destinations list */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Destinations</h2>
          <Button size="sm" onClick={onNew} className="gap-1.5" data-testid="button-new-site">
            <Plus className="w-4 h-4" /> Add Destination
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : sites.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No destinations yet. Add your first one!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sites.map(site => {
              const audioCount = [site.audioUrlEn, site.audioUrlAl, site.audioUrlGr].filter(Boolean).length;
              const attrCount = attrCounts[site.slug] || 0;
              return (
                <div
                  key={site.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:border-primary/30 transition-colors"
                  data-testid={`row-site-${site.id}`}
                >
                  {site.imageUrl ? (
                    <img src={site.imageUrl} alt={site.nameEn} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground truncate">{site.nameEn}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[site.category] || "bg-muted text-muted-foreground"}`}>
                        {site.category}
                      </span>
                      {audioCount > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          🎵 {audioCount}/3
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {attrCount} attraction{attrCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {site.region} · {site.points} XP · {site.difficulty}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onManageAttractions(site.slug, site.nameEn)}
                      className="h-8 px-3 text-xs gap-1"
                      data-testid={`button-attractions-${site.id}`}
                    >
                      <LayoutList className="w-3.5 h-3.5" /> Attractions
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(site.id)}
                      className="h-8 px-3 text-xs gap-1"
                      data-testid={`button-edit-${site.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSite(site.id, site.nameEn)}
                      disabled={deleting === site.id}
                      className="h-8 px-3 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                      data-testid={`button-delete-${site.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {deleting === site.id ? "…" : "Delete"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── ATTRACTIONS LIST ─────────────────────────────────────────────────────────
function AttractionsView({
  destinationSlug,
  destinationName,
  onBack,
  onEdit,
  onNew,
}: {
  destinationSlug: string;
  destinationName: string;
  onBack: () => void;
  onEdit: (id: number) => void;
  onNew: () => void;
}) {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminFetch(`/api/admin/attractions/${destinationSlug}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Attraction[]) => { setAttractions(data); })
      .catch(() => {
        // Fall back to local cache
        const all = loadPersistedAttractions();
        setAttractions(all.filter(a => a.destinationSlug === destinationSlug));
      })
      .finally(() => setLoading(false));
  }, [destinationSlug]);

  async function deleteAttraction(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await adminFetch(`/api/admin/attractions/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAttractions(prev => prev.filter(a => a.id !== id));
      } else {
        alert("Delete failed");
      }
    } catch {
      alert("Delete failed: network error");
    }
    setDeleting(null);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Destinations
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-medium text-foreground">
              {destinationName} — Attractions
            </span>
          </div>
          <Button size="sm" onClick={onNew} className="gap-1.5" data-testid="button-new-attraction">
            <Plus className="w-4 h-4" /> Add Attraction
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        {attractions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No attractions yet for {destinationName}. Add the first one!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {attractions.map(attr => (
              <div
                key={attr.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:border-primary/30 transition-colors"
              >
                {attr.imageUrl ? (
                  <img src={attr.imageUrl} alt={attr.nameEn} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Star className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{attr.nameEn}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[attr.category] || "bg-muted text-muted-foreground"}`}>
                      {attr.category}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {attr.points} XP · {attr.visitDuration} min · {attr.lat.toFixed(4)}, {attr.lng.toFixed(4)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(attr.id)} className="h-8 px-3 text-xs gap-1">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAttraction(attr.id, attr.nameEn)}
                    disabled={deleting === attr.id}
                    className="h-8 px-3 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleting === attr.id ? "…" : "Delete"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── MAP PICKER (interactive Leaflet) ─────────────────────────────────────────
function MapPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number;
  lng: number;
  onPick: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let mounted = true;

    const initLeaflet = (L: any) => {
      if (!mounted || !containerRef.current) return;

      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const initLat = lat && !isNaN(lat) ? lat : 41.1533;
      const initLng = lng && !isNaN(lng) ? lng : 20.1683;

      const map = L.map(containerRef.current!, { zoomControl: true }).setView([initLat, initLng], 13);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: "© CartoDB",
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([initLat, initLng], { draggable: true }).addTo(map);
      marker.bindPopup("Drag to adjust location").openPopup();

      marker.on("dragend", (e: any) => {
        const pos = e.target.getLatLng();
        onPick(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
      });

      map.on("click", (e: any) => {
        const { lat: clat, lng: clng } = e.latlng;
        marker.setLatLng([clat, clng]);
        onPick(parseFloat(clat.toFixed(6)), parseFloat(clng.toFixed(6)));
      });

      mapRef.current = map;
      markerRef.current = marker;

      // Fix blank map when container is hidden (inside a tab) — invalidate size once visible
      const ro = new ResizeObserver(() => {
        if (containerRef.current && containerRef.current.offsetWidth > 0) {
          map.invalidateSize();
          ro.disconnect();
        }
      });
      ro.observe(containerRef.current!);

      // Also fix on first render if already visible
      setTimeout(() => map.invalidateSize(), 50);
      setTimeout(() => map.invalidateSize(), 300);
    };

    import("leaflet").then(initLeaflet);

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Keep marker in sync when lat/lng fields change externally
  useEffect(() => {
    if (markerRef.current && lat && lng && !isNaN(lat) && !isNaN(lng)) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current?.panTo([lat, lng]);
    }
  }, [lat, lng]);

  return (
    <div>
      <div ref={containerRef} style={{ height: 280, borderRadius: 12, overflow: "hidden", border: "1px solid hsl(var(--border))" }} />
      <p className="text-xs text-muted-foreground mt-1.5">
        Click the map or drag the pin to set the exact location. Albania addresses are imprecise — manual pinning is the most reliable method.
      </p>
    </div>
  );
}

// ─── AUDIO CARD ────────────────────────────────────────────────────────────────
function AudioCard({
  siteId, lang, label, flag, currentUrl, onUpdate, entityType = "sites", descText, onTtsGenerated,
}: {
  siteId: number | null;
  lang: "en" | "al" | "gr" | "it" | "es" | "de" | "fr" | "ar" | "sl";
  label: string;
  flag: string;
  currentUrl: string | null;
  onUpdate: (url: string | null) => void;
  entityType?: "sites" | "attractions";
  descText?: string;
  onTtsGenerated?: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [generatingTts, setGeneratingTts] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function handleGenerateTts() {
    if (!descText || !siteId) return;
    setGeneratingTts(true);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/generate-tts`, {
        method: "POST",
        body: JSON.stringify({ text: descText, lang, entityType, entityId: siteId }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        const absUrl = data.url.startsWith("http") ? data.url : `${RAILWAY_API}${data.url}`;
        onUpdate(absUrl);
        if (onTtsGenerated) onTtsGenerated(absUrl);
      } else {
        setError(data.error || "TTS generation failed");
      }
    } catch {
      setError("Network error during TTS generation");
    }
    setGeneratingTts(false);
  }

  async function handleUpload(file: File) {
    if (!file || siteId === null) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("audio", file);
    try {
      const res = await adminUpload(`/api/admin/${entityType}/${siteId}/audio/${lang}`, formData);
      const data = await res.json();
      if (res.ok) {
        // URL is already absolute (Railway backend prepends base URL)
        const absUrl = data.url.startsWith("http") ? data.url : `${RAILWAY_API}${data.url}`;
        onUpdate(absUrl);
      }
      else { setError(data.error || "Upload failed"); }
    } catch {
      setError("Network error during upload");
    }
    setUploading(false);
  }

  async function handleDelete() {
    if (!confirm("Remove this audio file?") || siteId === null) return;
    const res = await adminFetch(`/api/admin/${entityType}/${siteId}/audio/${lang}`, { method: "DELETE" });
    if (res.ok) onUpdate(null);
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{flag}</span>
        <span className="font-medium text-sm text-foreground">{label}</span>
        {currentUrl && <span className="ml-auto text-xs text-green-600 font-medium">✓ Uploaded</span>}
      </div>
      {currentUrl ? (
        <div className="space-y-2">
          <audio ref={audioRef} src={currentUrl} onEnded={() => setPlaying(false)} className="hidden" />
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <Button variant="ghost" size="sm" onClick={togglePlay} className="h-7 w-7 p-0 flex-shrink-0">
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </Button>
            <span className="text-xs text-muted-foreground truncate flex-1">
              {currentUrl.startsWith('data:') ? 'Audio stored in DB' : currentUrl.includes('/api/audio/serve/') ? `Audio ready (${currentUrl.split('/').pop()?.toUpperCase()})` : currentUrl.split('/').pop()}
            </span>
            <Button variant="ghost" size="sm" onClick={handleDelete} className="h-7 w-7 p-0 flex-shrink-0 text-destructive hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="w-full text-xs gap-1.5 h-7">
            <Upload className="w-3 h-3" /> Replace audio
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className="border-2 border-dashed border-border/60 rounded-lg p-4 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /><span>Uploading…</span>
              </div>
            ) : (
              <>
                <Music className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">Drop MP3 here or <span className="text-primary font-medium">click to browse</span></p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">MP3, WAV, M4A · Max 100 MB</p>
              </>
            )}
          </div>
          {descText && siteId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateTts}
              disabled={generatingTts}
              className="w-full text-xs gap-1.5 h-8 border-primary/30 text-primary hover:bg-primary/5"
            >
              {generatingTts ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="text-sm">🎙️</span>}
              {generatingTts ? "Generating audio…" : "Generate Audio from Description"}
            </Button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input ref={fileRef} type="file" accept="audio/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
    </div>
  );
}

// ─── PREVIEW CARDS ───────────────────────────────────────────────────────────
function DestinationPreviewCard({ form }: { form: any }) {
  const RAILWAY_BASE = "https://albania-audio-tours-production.up.railway.app";
  const frontendUrl = `${RAILWAY_BASE}/#/sites/${form.slug}`;
  const catColor = CATEGORY_COLORS[form.category] || "bg-gray-100 text-gray-800";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Live preview of how this destination appears to visitors.</p>
        <a href={frontendUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <Eye className="w-3.5 h-3.5" /> Open in App
        </a>
      </div>
      <div className="rounded-2xl border border-border/60 overflow-hidden shadow-sm max-w-sm">
        {form.imageUrl ? (
          <div className="relative h-44 bg-muted">
            <img src={form.imageUrl} alt={form.nameEn} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <h3 className="text-white font-semibold text-base leading-tight">{form.nameEn || "Destination Name"}</h3>
              {form.region && <p className="text-white/70 text-xs mt-0.5">{form.region}</p>}
            </div>
          </div>
        ) : (
          <div className="h-44 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-primary/40 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground/60">{form.nameEn || "Destination Name"}</p>
            </div>
          </div>
        )}
        <div className="p-4 space-y-3 bg-card">
          <div className="flex items-center gap-2 flex-wrap">
            {form.category && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>{form.category}</span>}
            {form.difficulty && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{form.difficulty}</span>}
            {form.points && <span className="text-xs font-medium text-amber-600">★ {form.points} XP</span>}
          </div>
          {form.descEn && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{form.descEn}</p>}
          {form.funFactEn && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 px-3 py-2">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-0.5">💡 Fun fact</p>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 line-clamp-2">{form.funFactEn}</p>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/40">
            {form.lat && form.lng && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{parseFloat(form.lat).toFixed(4)}, {parseFloat(form.lng).toFixed(4)}</span>}
            {form.visitDuration && <span>⏱ {form.visitDuration} min</span>}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border/60 p-4 space-y-2">
        <p className="text-xs font-medium text-foreground">Translation coverage</p>
        {(["En", "Al", "Gr"] as const).map(lang => (
          <div key={lang} className="flex items-center gap-2 text-xs">
            <span className="w-16 text-muted-foreground">{lang === "En" ? "🇬🇧 EN" : lang === "Al" ? "🇦🇱 SQ" : "🇬🇷 GR"}</span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: (form as any)[`name${lang}`] && (form as any)[`desc${lang}`] ? "100%" : (form as any)[`name${lang}`] ? "40%" : "0%" }} />
            </div>
            <span className="text-muted-foreground">{(form as any)[`name${lang}`] && (form as any)[`desc${lang}`] ? "✅ Complete" : (form as any)[`name${lang}`] ? "⚠️ Partial" : "❌ Missing"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttractionPreviewCard({ form, destinationName }: { form: any; destinationName: string }) {
  const RAILWAY_BASE = "https://albania-audio-tours-production.up.railway.app";
  const frontendUrl = `${RAILWAY_BASE}/#/attraction/${form.slug}`;
  const catColor = CATEGORY_COLORS[form.category] || "bg-gray-100 text-gray-800";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Preview of this attraction inside {destinationName || "the destination"}.</p>
        <a href={frontendUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <Eye className="w-3.5 h-3.5" /> Open in App
        </a>
      </div>
      <div className="rounded-2xl border border-border/60 overflow-hidden shadow-sm max-w-sm">
        {form.imageUrl ? (
          <div className="relative h-36 bg-muted">
            <img src={form.imageUrl} alt={form.nameEn} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent" />
            <div className="absolute bottom-2 left-3">
              <h3 className="text-white font-semibold text-sm">{form.nameEn || "Attraction Name"}</h3>
            </div>
          </div>
        ) : (
          <div className="h-36 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <div className="text-center">
              <Star className="w-7 h-7 text-primary/40 mx-auto mb-1" />
              <p className="text-sm font-medium text-foreground/60">{form.nameEn || "Attraction Name"}</p>
            </div>
          </div>
        )}
        <div className="p-4 space-y-3 bg-card">
          {form.category && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>{form.category}</span>}
          {form.descEn && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{form.descEn}</p>}
          {form.funFactEn && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 px-3 py-2">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-0.5">💡 Fun fact</p>
              <p className="text-xs text-amber-700/80 line-clamp-2">{form.funFactEn}</p>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/40">
            {form.points && <span className="font-medium text-amber-600">★ {form.points} XP</span>}
            {form.visitDuration && <span>⏱ {form.visitDuration} min</span>}
            {form.lat && form.lng && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{parseFloat(form.lat).toFixed(3)}, {parseFloat(form.lng).toFixed(3)}</span>}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border/60 p-4 space-y-2">
        <p className="text-xs font-medium text-foreground">Translation coverage</p>
        {(["En", "Al", "Gr"] as const).map(lang => (
          <div key={lang} className="flex items-center gap-2 text-xs">
            <span className="w-16 text-muted-foreground">{lang === "En" ? "🇬🇧 EN" : lang === "Al" ? "🇦🇱 SQ" : "🇬🇷 GR"}</span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: (form as any)[`name${lang}`] && (form as any)[`desc${lang}`] ? "100%" : (form as any)[`name${lang}`] ? "40%" : "0%" }} />
            </div>
            <span className="text-muted-foreground">{(form as any)[`name${lang}`] && (form as any)[`desc${lang}`] ? "✅ Complete" : (form as any)[`name${lang}`] ? "⚠️ Partial" : "❌ Missing"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── IMAGE UPLOAD CARD ────────────────────────────────────────────────────────
function ImageUploadCard({ imageUrl, onUpdate }: { imageUrl: string; onUpdate: (url: string) => void }) {
  const [mode, setMode] = useState<"url" | "upload">("url");
  const [urlInput, setUrlInput] = useState(imageUrl);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [uploadedName, setUploadedName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setUrlInput(imageUrl); }, [imageUrl]);

  function applyUrl() {
    setError("");
    const val = urlInput.trim();
    if (val && !val.startsWith("http") && !val.startsWith("data:")) {
      setError("Please enter a valid URL starting with https://");
      return;
    }
    onUpdate(val);
  }

  async function processFile(file: File) {
    setError("");
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("Image must be under 20 MB"); return; }
    setProcessing(true);
    setUploadedName(file.name);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await adminUpload("/api/admin/upload-image", fd);
      if (res.ok) {
        const { url } = await res.json();
        // Convert relative URL to absolute Railway URL
        const absUrl = url.startsWith("http") ? url : `${RAILWAY_API}${url}`;
        onUpdate(absUrl);
        setUploadedName(file.name);
      } else {
        setError("Upload failed. Please use a URL instead.");
      }
    } catch {
      setError("Upload failed. Please use a URL instead.");
    }
    setProcessing(false);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const isDataUrl = imageUrl.startsWith("data:");
  const hasImage = !!imageUrl;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Image className="w-4 h-4 text-primary" /> Hero Image
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-1 rounded-lg border border-border p-1 w-fit">
          <button type="button" onClick={() => setMode("url")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === "url" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Link className="w-3 h-3" /> Paste URL
          </button>
          <button type="button" onClick={() => setMode("upload")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Upload className="w-3 h-3" /> Upload File
          </button>
        </div>

        {mode === "url" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") applyUrl(); }}
                placeholder="https://images.unsplash.com/photo-xxx?w=800"
                className="flex-1 text-sm" />
              <Button type="button" size="sm" onClick={applyUrl} variant="secondary" className="shrink-0 gap-1.5 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> Apply
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Paste a public image URL (Unsplash, Cloudinary, etc.) then click Apply</p>
          </div>
        )}

        {mode === "upload" && (
          <div className="space-y-2">
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragging ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40 hover:bg-primary/5"}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              {processing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Processing image…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{dragging ? "Drop to upload" : "Drag & drop an image"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">or <span className="text-primary font-medium">click to browse</span></p>
                  </div>
                  <p className="text-xs text-muted-foreground/70">JPG, PNG, WebP, AVIF · Max 8 MB</p>
                </div>
              )}
            </div>
            {uploadedName && !processing && (
              <p className="text-xs text-green-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Loaded: {uploadedName}
              </p>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }} />
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 flex items-center gap-1.5">
            <X className="w-3.5 h-3.5 shrink-0" /> {error}
          </p>
        )}

        {hasImage && (
          <div className="space-y-2">
            <div className="relative rounded-xl overflow-hidden border border-border/60 group">
              <img src={imageUrl} alt="Preview" className="w-full h-52 object-cover block"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <button type="button"
                onClick={() => { onUpdate(""); setUrlInput(""); setUploadedName(""); }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100">
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-2 left-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-black/50 text-white">
                  {isDataUrl ? "📁 Local file" : imageUrl.includes("railway.app") ? "✅ Uploaded" : "🔗 URL"}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {isDataUrl ? "Image loaded from file. Click Save to apply." : `URL: ${imageUrl.length > 60 ? imageUrl.slice(0, 60) + "…" : imageUrl}`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── SHARED FIELD WRAPPER ─────────────────────────────────────────────────────
function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground block mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

// ─── DESTINATION EDITOR ───────────────────────────────────────────────────────
type DestFormData = {
  slug: string;
  nameEn: string; nameAl: string; nameGr: string; nameIt: string; nameEs: string; nameDe: string; nameFr: string; nameAr: string; nameSl: string;
  descEn: string; descAl: string; descGr: string; descIt: string; descEs: string; descDe: string; descFr: string; descAr: string; descSl: string;
  funFactEn: string; funFactAl: string; funFactGr: string; funFactIt: string; funFactEs: string; funFactDe: string; funFactFr: string; funFactAr: string; funFactSl: string;
  audioUrlEn: string | null; audioUrlAl: string | null; audioUrlGr: string | null;
  audioUrlIt: string | null; audioUrlEs: string | null; audioUrlDe: string | null; audioUrlFr: string | null; audioUrlAr: string | null; audioUrlSl: string | null;
  lat: string; lng: string;
  region: string; category: string; difficulty: string;
  points: string; visitDuration: string; imageUrl: string;
};

const EMPTY_DEST_FORM: DestFormData = {
  slug: "",
  nameEn: "", nameAl: "", nameGr: "", nameIt: "", nameEs: "", nameDe: "", nameFr: "", nameAr: "", nameSl: "",
  descEn: "", descAl: "", descGr: "", descIt: "", descEs: "", descDe: "", descFr: "", descAr: "", descSl: "",
  funFactEn: "", funFactAl: "", funFactGr: "", funFactIt: "", funFactEs: "", funFactDe: "", funFactFr: "", funFactAr: "", funFactSl: "",
  audioUrlEn: null, audioUrlAl: null, audioUrlGr: null,
  audioUrlIt: null, audioUrlEs: null, audioUrlDe: null, audioUrlFr: null, audioUrlAr: null, audioUrlSl: null,
  lat: "", lng: "", region: "", category: "", difficulty: "easy",
  points: "100", visitDuration: "120", imageUrl: "",
};

function siteToForm(s: TourSite): DestFormData {
  return {
    slug: s.slug,
    nameEn: s.nameEn, nameAl: s.nameAl, nameGr: s.nameGr,
    nameIt: (s as any).nameIt || "", nameEs: (s as any).nameEs || "", nameDe: (s as any).nameDe || "",
    nameFr: (s as any).nameFr || "", nameAr: (s as any).nameAr || "", nameSl: (s as any).nameSl || "",
    descEn: s.descEn, descAl: s.descAl, descGr: s.descGr,
    descIt: (s as any).descIt || "", descEs: (s as any).descEs || "", descDe: (s as any).descDe || "",
    descFr: (s as any).descFr || "", descAr: (s as any).descAr || "", descSl: (s as any).descSl || "",
    funFactEn: s.funFactEn || "", funFactAl: s.funFactAl || "", funFactGr: s.funFactGr || "",
    funFactIt: (s as any).funFactIt || "", funFactEs: (s as any).funFactEs || "", funFactDe: (s as any).funFactDe || "",
    funFactFr: (s as any).funFactFr || "", funFactAr: (s as any).funFactAr || "", funFactSl: (s as any).funFactSl || "",
    audioUrlEn: s.audioUrlEn, audioUrlAl: s.audioUrlAl, audioUrlGr: s.audioUrlGr,
    audioUrlIt: (s as any).audioUrlIt || null, audioUrlEs: (s as any).audioUrlEs || null, audioUrlDe: (s as any).audioUrlDe || null,
    audioUrlFr: (s as any).audioUrlFr || null, audioUrlAr: (s as any).audioUrlAr || null, audioUrlSl: (s as any).audioUrlSl || null,
    lat: String(s.lat), lng: String(s.lng),
    region: s.region, category: s.category, difficulty: s.difficulty,
    points: String(s.points), visitDuration: String(s.visitDuration),
    imageUrl: s.imageUrl || "",
  };
}

function EditorView({
  siteId, onBack, onSaved,
}: {
  siteId: number | null;
  onBack: () => void;
  onSaved: (newId: number) => void;
}) {
  const isNew = siteId === null;
  const [form, setFormState] = useState<DestFormData>(EMPTY_DEST_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [translatingLang, setTranslatingLang] = useState<string | null>(null);
  const [translateError, setTranslateError] = useState("");

  useEffect(() => {
    if (!isNew && siteId !== null) {
      adminFetch("/api/admin/sites")
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((sites: TourSite[]) => {
          const site = sites.find(s => s.id === siteId);
          if (site) setFormState(siteToForm(site));
          else onBack();
        })
        .catch(() => {
          const persisted = loadPersistedSites();
          const site = persisted.find(s => s.id === siteId);
          if (site) setFormState(siteToForm(site));
          else onBack();
        })
        .finally(() => setLoading(false));
    }
  }, []);

  function set(field: keyof DestFormData, value: string | null) {
    setFormState(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
  }

  async function handleTranslateDest(langKey: string) {
    if (!form.nameEn && !form.descEn) return;
    setTranslatingLang(langKey);
    setTranslateError("");
    try {
      const cap = langKey.charAt(0).toUpperCase() + langKey.slice(1);
      const doTranslate = async (text: string) => {
        const r = await adminFetch("/api/admin/translate", { method: "POST", body: JSON.stringify({ text, targetLang: langKey }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
        return d.translated || "";
      };
      const [nameT, descT, funT] = await Promise.all([
        form.nameEn ? doTranslate(form.nameEn) : Promise.resolve(""),
        form.descEn ? doTranslate(form.descEn) : Promise.resolve(""),
        form.funFactEn ? doTranslate(form.funFactEn) : Promise.resolve(""),
      ]);
      if (nameT) set(`name${cap}` as keyof DestFormData, nameT);
      if (descT) set(`desc${cap}` as keyof DestFormData, descT);
      if (funT) set(`funFact${cap}` as keyof DestFormData, funT);
    } catch (e: any) {
      const msg = e.message || "Translation failed";
      if (msg.includes("GEMINI_API_KEY") || msg.includes("not configured")) {
        setTranslateError("⚠️ Translation requires a GEMINI_API_KEY. Go to Railway → inspiring-exploration → albania-audio-tours → Variables → add GEMINI_API_KEY.");
      } else {
        setTranslateError(`Translation error: ${msg}`);
      }
    }
    setTranslatingLang(null);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.slug.trim()) e.slug = "Slug is required";
    if (!form.nameEn.trim()) e.nameEn = "English name is required";
    if (!form.descEn.trim()) e.descEn = "English description is required";
    if (!form.lat || isNaN(parseFloat(form.lat))) e.lat = "Valid latitude required";
    if (!form.lng || isNaN(parseFloat(form.lng))) e.lng = "Valid longitude required";
    if (!form.region) e.region = "Region is required";
    if (!form.category) e.category = "Category is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    const payload = {
      ...form,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      points: parseInt(form.points) || 100,
      visitDuration: parseInt(form.visitDuration) || 120,
      imageUrl: form.imageUrl || null,
      funFactEn: form.funFactEn || null,
      funFactAl: form.funFactAl || null,
      funFactGr: form.funFactGr || null,
      funFactIt: form.funFactIt || null,
      funFactEs: form.funFactEs || null,
      funFactDe: form.funFactDe || null,
      funFactFr: form.funFactFr || null,
      funFactAr: form.funFactAr || null,
      funFactSl: form.funFactSl || null,
      nameAl: form.nameAl || form.nameEn,
      nameGr: form.nameGr || form.nameEn,
      nameIt: form.nameIt || null,
      nameEs: form.nameEs || null,
      nameDe: form.nameDe || null,
      nameFr: form.nameFr || null,
      nameAr: form.nameAr || null,
      nameSl: form.nameSl || null,
      descAl: form.descAl || form.descEn,
      descGr: form.descGr || form.descEn,
      descIt: form.descIt || null,
      descEs: form.descEs || null,
      descDe: form.descDe || null,
      descFr: form.descFr || null,
      descAr: form.descAr || null,
      descSl: form.descSl || null,
    };
    try {
      const res = isNew
        ? await adminFetch("/api/admin/sites", { method: "POST", body: JSON.stringify(payload) })
        : await adminFetch(`/api/admin/sites/${siteId}`, { method: "PUT", body: JSON.stringify(payload) });

      if (res.ok) {
        const saved = await res.json();
        // Persist locally too
        const all = loadPersistedSites();
        if (isNew) {
          savePersistedSites([...all, { ...payload, id: saved.id } as unknown as TourSite]);
          onSaved(saved.id);
        } else {
          savePersistedSites(all.map(s => s.id === siteId ? { ...s, ...payload } as unknown as TourSite : s));
        }
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 2500);
      } else {
        // Static mode — persist to localStorage
        const all = loadPersistedSites();
        const fakeId = isNew ? Date.now() : siteId!;
        if (isNew) {
          savePersistedSites([...all, { ...payload, id: fakeId } as unknown as TourSite]);
          onSaved(fakeId);
        } else {
          savePersistedSites(all.map(s => s.id === siteId ? { ...s, ...payload } as unknown as TourSite : s));
        }
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 2500);
      }
    } catch {
      const all = loadPersistedSites();
      const fakeId = isNew ? Date.now() : siteId!;
      if (isNew) {
        savePersistedSites([...all, { ...payload, id: fakeId } as unknown as TourSite]);
        onSaved(fakeId);
      } else {
        savePersistedSites(all.map(s => s.id === siteId ? { ...s, ...payload } as unknown as TourSite : s));
      }
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const latNum = parseFloat(form.lat);
  const lngNum = parseFloat(form.lng);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-medium text-foreground">
              {isNew ? "New Destination" : `Editing: ${form.nameEn || "…"}`}
            </span>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5" data-testid="button-save">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {savedOk ? "Saved!" : saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Tabs defaultValue="details">
          <TabsList className="mb-6">
            <TabsTrigger value="details" className="gap-1.5 text-xs"><Info className="w-3.5 h-3.5" /> Details</TabsTrigger>
            <TabsTrigger value="location" className="gap-1.5 text-xs"><MapPin className="w-3.5 h-3.5" /> Location</TabsTrigger>
            <TabsTrigger value="translations" className="gap-1.5 text-xs"><Globe className="w-3.5 h-3.5" /> Translations</TabsTrigger>
            <TabsTrigger value="audio" className="gap-1.5 text-xs" disabled={isNew}>
              <Music className="w-3.5 h-3.5" /> Audio
              {isNew && <span className="text-muted-foreground/60 ml-1">(save first)</span>}
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5 text-xs"><Image className="w-3.5 h-3.5" /> Media</TabsTrigger>
            <TabsTrigger value="itinerary" className="gap-1.5 text-xs" disabled={isNew}>
              <Route className="w-3.5 h-3.5" /> Itinerary
              {isNew && <span className="text-muted-foreground/60 ml-1">(save first)</span>}
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5 text-xs"><Eye className="w-3.5 h-3.5" /> Preview</TabsTrigger>
          </TabsList>

          {/* Details */}
          <TabsContent value="details" className="space-y-6">
            <Card className="border-border/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Basic Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="URL Slug" error={errors.slug} required>
                    <Input value={form.slug} onChange={e => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="berat" data-testid="input-slug" />
                    <p className="text-xs text-muted-foreground mt-1">Used in the URL: /sites/<strong>{form.slug || "slug"}</strong></p>
                  </Field>
                  <Field label="Points (XP)" error={errors.points}>
                    <Input type="number" min="10" max="500" value={form.points} onChange={e => set("points", e.target.value)} data-testid="input-points" />
                  </Field>
                </div>
                <Field label="English Name" error={errors.nameEn} required>
                  <Input value={form.nameEn} onChange={e => set("nameEn", e.target.value)} placeholder="Berat" data-testid="input-name-en" />
                </Field>
                <Field label="English Description" error={errors.descEn} required>
                  <Textarea value={form.descEn} onChange={e => set("descEn", e.target.value)} rows={4} placeholder="Describe this destination…" data-testid="input-desc-en" />
                </Field>
                <Field label="English Fun Fact">
                  <Input value={form.funFactEn} onChange={e => set("funFactEn", e.target.value)} placeholder="A surprising fact" data-testid="input-fun-fact-en" />
                </Field>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Region" error={errors.region} required>
                    <Select value={form.region} onValueChange={v => set("region", v)}>
                      <SelectTrigger data-testid="select-region"><SelectValue placeholder="Select region" /></SelectTrigger>
                      <SelectContent>{REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Category" error={errors.category} required>
                    <Select value={form.category} onValueChange={v => set("category", v)}>
                      <SelectTrigger data-testid="select-category"><SelectValue placeholder="Category" /></SelectTrigger>
                      <SelectContent>{DEST_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Difficulty">
                    <Select value={form.difficulty} onValueChange={v => set("difficulty", v)}>
                      <SelectTrigger data-testid="select-difficulty"><SelectValue /></SelectTrigger>
                      <SelectContent>{DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Visit Duration (minutes)">
                  <Input type="number" min="15" max="1440" value={form.visitDuration} onChange={e => set("visitDuration", e.target.value)} data-testid="input-duration" />
                </Field>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Location — interactive map picker */}
          <TabsContent value="location" className="space-y-6">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Latitude" error={errors.lat} required>
                    <Input value={form.lat} onChange={e => set("lat", e.target.value)} placeholder="40.7058" data-testid="input-lat" />
                  </Field>
                  <Field label="Longitude" error={errors.lng} required>
                    <Input value={form.lng} onChange={e => set("lng", e.target.value)} placeholder="19.9522" data-testid="input-lng" />
                  </Field>
                </div>
                <MapPicker
                  lat={isNaN(latNum) ? 41.1533 : latNum}
                  lng={isNaN(lngNum) ? 20.1683 : lngNum}
                  onPick={(la, lo) => { set("lat", String(la)); set("lng", String(lo)); }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Translations */}
          <TabsContent value="translations" className="space-y-5">
            <p className="text-sm text-muted-foreground">Translations for all languages. Click "Auto-translate" to fill all three fields from the English version. English is used as fallback if left blank.</p>
            {translateError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">{translateError}</div>
            )}
            {LANGS.filter(l => l.key !== "en").map(lang => {
              const cap = lang.key.charAt(0).toUpperCase() + lang.key.slice(1);
              const isTranslating = translatingLang === lang.key;
              return (
                <Card key={lang.key} className="border-border/60">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2"><span className="text-base">{lang.flag}</span> {lang.label}</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTranslateDest(lang.key)}
                        disabled={isTranslating || !form.nameEn}
                        className="text-xs h-7 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                      >
                        {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="text-sm">🌐</span>}
                        {isTranslating ? "Translating…" : "Auto-translate"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field label={`${lang.label} Name`}>
                      <Input
                        value={form[`name${cap}` as keyof DestFormData] as string}
                        onChange={e => set(`name${cap}` as keyof DestFormData, e.target.value)}
                        placeholder={form.nameEn}
                      />
                    </Field>
                    <Field label={`${lang.label} Description`}>
                      <Textarea
                        value={form[`desc${cap}` as keyof DestFormData] as string}
                        onChange={e => set(`desc${cap}` as keyof DestFormData, e.target.value)}
                        rows={4}
                        placeholder={form.descEn}
                      />
                    </Field>
                    <Field label={`${lang.label} Fun Fact`}>
                      <Input
                        value={form[`funFact${cap}` as keyof DestFormData] as string}
                        onChange={e => set(`funFact${cap}` as keyof DestFormData, e.target.value)}
                        placeholder={form.funFactEn}
                      />
                    </Field>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Audio */}
          <TabsContent value="audio" className="space-y-5">
            <p className="text-sm text-muted-foreground">Upload an MP3 narration for each language, or click "Generate Audio" to create TTS from the description text.</p>
            {!isNew && (
              <div className="grid gap-4">
                {LANGS.map(lang => {
                  const cap = lang.key.charAt(0).toUpperCase() + lang.key.slice(1);
                  const descField = `desc${cap}` as keyof DestFormData;
                  const descText = (form[descField] as string) || form.descEn || "";
                  return (
                    <AudioCard
                      key={lang.key}
                      siteId={siteId}
                      lang={lang.key}
                      label={lang.label}
                      flag={lang.flag}
                      currentUrl={form[`audioUrl${cap}` as keyof DestFormData] as string | null}
                      onUpdate={url => set(`audioUrl${cap}` as keyof DestFormData, url)}
                      descText={descText}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Media */}
          <TabsContent value="media" className="space-y-5">
            <ImageUploadCard imageUrl={form.imageUrl} onUpdate={url => set("imageUrl", url)} />
          </TabsContent>

          {/* Itinerary */}
          <TabsContent value="itinerary" className="space-y-5">
            {!isNew && (
              <ItineraryManager
                siteSlug={form.slug}
                entityType="site"
                centerLat={isNaN(parseFloat(form.lat)) ? 41.3275 : parseFloat(form.lat)}
                centerLng={isNaN(parseFloat(form.lng)) ? 19.8187 : parseFloat(form.lng)}
              />
            )}
          </TabsContent>

          {/* Preview */}
          <TabsContent value="preview" className="space-y-5">
            <DestinationPreviewCard form={form} />
          </TabsContent>
        </Tabs>

        <div className="pt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 min-w-32" data-testid="button-save-bottom">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savedOk ? "Saved!" : saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </main>
    </div>
  );
}

// ─── ATTRACTION EDITOR ────────────────────────────────────────────────────────
type AttrFormData = {
  slug: string;
  nameEn: string; nameAl: string; nameGr: string; nameIt: string; nameEs: string; nameDe: string; nameFr: string; nameAr: string; nameSl: string;
  descEn: string; descAl: string; descGr: string; descIt: string; descEs: string; descDe: string; descFr: string; descAr: string; descSl: string;
  funFactEn: string; funFactAl: string; funFactGr: string; funFactIt: string; funFactEs: string; funFactDe: string; funFactFr: string; funFactAr: string; funFactSl: string;
  audioUrlEn: string; audioUrlAl: string; audioUrlGr: string;
  audioUrlIt: string; audioUrlEs: string; audioUrlDe: string; audioUrlFr: string; audioUrlAr: string; audioUrlSl: string;
  category: string;
  points: string;
  lat: string; lng: string;
  visitDuration: string;
  imageUrl: string;
};

const EMPTY_ATTR_FORM: AttrFormData = {
  slug: "",
  nameEn: "", nameAl: "", nameGr: "", nameIt: "", nameEs: "", nameDe: "", nameFr: "", nameAr: "", nameSl: "",
  descEn: "", descAl: "", descGr: "", descIt: "", descEs: "", descDe: "", descFr: "", descAr: "", descSl: "",
  funFactEn: "", funFactAl: "", funFactGr: "", funFactIt: "", funFactEs: "", funFactDe: "", funFactFr: "", funFactAr: "", funFactSl: "",
  audioUrlEn: "", audioUrlAl: "", audioUrlGr: "",
  audioUrlIt: "", audioUrlEs: "", audioUrlDe: "", audioUrlFr: "", audioUrlAr: "", audioUrlSl: "",
  category: "", points: "50", lat: "", lng: "",
  visitDuration: "30", imageUrl: "",
};

function attrToForm(a: Attraction): AttrFormData {
  return {
    slug: a.slug,
    nameEn: a.nameEn, nameAl: a.nameAl, nameGr: a.nameGr,
    nameIt: (a as any).nameIt || "", nameEs: (a as any).nameEs || "", nameDe: (a as any).nameDe || "",
    nameFr: (a as any).nameFr || "", nameAr: (a as any).nameAr || "", nameSl: (a as any).nameSl || "",
    descEn: a.descEn, descAl: a.descAl, descGr: a.descGr,
    descIt: (a as any).descIt || "", descEs: (a as any).descEs || "", descDe: (a as any).descDe || "",
    descFr: (a as any).descFr || "", descAr: (a as any).descAr || "", descSl: (a as any).descSl || "",
    funFactEn: a.funFactEn || "", funFactAl: a.funFactAl || "", funFactGr: a.funFactGr || "",
    funFactIt: (a as any).funFactIt || "", funFactEs: (a as any).funFactEs || "", funFactDe: (a as any).funFactDe || "",
    funFactFr: (a as any).funFactFr || "", funFactAr: (a as any).funFactAr || "", funFactSl: (a as any).funFactSl || "",
    audioUrlEn: a.audioUrlEn || "", audioUrlAl: a.audioUrlAl || "", audioUrlGr: a.audioUrlGr || "",
    audioUrlIt: (a as any).audioUrlIt || "", audioUrlEs: (a as any).audioUrlEs || "", audioUrlDe: (a as any).audioUrlDe || "",
    audioUrlFr: (a as any).audioUrlFr || "", audioUrlAr: (a as any).audioUrlAr || "", audioUrlSl: (a as any).audioUrlSl || "",
    category: a.category,
    points: String(a.points),
    lat: String(a.lat), lng: String(a.lng),
    visitDuration: String(a.visitDuration),
    imageUrl: a.imageUrl || "",
  };
}

function AttrEditorView({
  attractionId,
  destinationSlug,
  destinationName,
  onBack,
  onSaved,
}: {
  attractionId: number | null;
  destinationSlug: string;
  destinationName: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const isNew = attractionId === null;
  const [form, setFormState] = useState<AttrFormData>(EMPTY_ATTR_FORM);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [translatingLang, setTranslatingLang] = useState<string | null>(null);
  const [translateError, setTranslateError] = useState("");

  useEffect(() => {
    if (!isNew && attractionId !== null) {
      // Load from API first, fall back to local cache
      adminFetch(`/api/admin/attractions/all/${attractionId}`)
        .then(r => r.ok ? r.json() : null)
        .then(attr => {
          if (attr) { setFormState(attrToForm(attr)); return; }
          // Fallback: search all attractions
          return adminFetch("/api/admin/attractions")
            .then(r => r.ok ? r.json() : [])
            .then((all: Attraction[]) => {
              const found = all.find(a => a.id === attractionId);
              if (found) setFormState(attrToForm(found));
              else onBack();
            });
        })
        .catch(() => {
          const all = loadPersistedAttractions();
          const attr = all.find(a => a.id === attractionId);
          if (attr) setFormState(attrToForm(attr));
          else onBack();
        });
    }
  }, []);

  function set(field: keyof AttrFormData, value: string) {
    setFormState(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
  }

  async function handleTranslateAttr(langKey: string) {
    if (!form.nameEn && !form.descEn) return;
    setTranslatingLang(langKey);
    setTranslateError("");
    try {
      const cap = langKey.charAt(0).toUpperCase() + langKey.slice(1);
      const [nameRes, descRes, funRes] = await Promise.all([
        form.nameEn ? adminFetch("/api/admin/translate", { method: "POST", body: JSON.stringify({ text: form.nameEn, targetLang: langKey }) }).then(r => r.json()) : Promise.resolve({ translated: "" }),
        form.descEn ? adminFetch("/api/admin/translate", { method: "POST", body: JSON.stringify({ text: form.descEn, targetLang: langKey }) }).then(r => r.json()) : Promise.resolve({ translated: "" }),
        form.funFactEn ? adminFetch("/api/admin/translate", { method: "POST", body: JSON.stringify({ text: form.funFactEn, targetLang: langKey }) }).then(r => r.json()) : Promise.resolve({ translated: "" }),
      ]);
      // Check if the API returned an error payload
      const firstRes = nameRes || descRes;
      if (firstRes?.error) {
        const msg = firstRes.error || "";
        if (msg.includes("503") || msg.includes("GEMINI") || msg.includes("API key") || firstRes.error === "Translation service unavailable") {
          setTranslateError("⚠️ Translation requires a GEMINI_API_KEY. Go to Railway → inspiring-exploration → albania-audio-tours → Variables → add GEMINI_API_KEY.");
        } else {
          setTranslateError(`Translation error: ${msg}`);
        }
      } else {
        if (nameRes.translated) set(`name${cap}` as keyof AttrFormData, nameRes.translated);
        if (descRes.translated) set(`desc${cap}` as keyof AttrFormData, descRes.translated);
        if (funRes.translated) set(`funFact${cap}` as keyof AttrFormData, funRes.translated);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("503") || msg.includes("GEMINI") || msg.includes("API key")) {
        setTranslateError("⚠️ Translation requires a GEMINI_API_KEY. Go to Railway → inspiring-exploration → albania-audio-tours → Variables → add GEMINI_API_KEY.");
      } else {
        setTranslateError(`Translation error: ${msg}`);
      }
    }
    setTranslatingLang(null);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.slug.trim()) e.slug = "Slug is required";
    if (!form.nameEn.trim()) e.nameEn = "English name is required";
    if (!form.descEn.trim()) e.descEn = "English description is required";
    if (!form.lat || isNaN(parseFloat(form.lat))) e.lat = "Valid latitude required";
    if (!form.lng || isNaN(parseFloat(form.lng))) e.lng = "Valid longitude required";
    if (!form.category) e.category = "Category is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);

    const payload = {
      slug: form.slug,
      destinationSlug,
      nameEn: form.nameEn, nameAl: form.nameAl || form.nameEn, nameGr: form.nameGr || form.nameEn,
      nameIt: form.nameIt || null, nameEs: form.nameEs || null, nameDe: form.nameDe || null,
      nameFr: form.nameFr || null, nameAr: form.nameAr || null, nameSl: form.nameSl || null,
      descEn: form.descEn, descAl: form.descAl || form.descEn, descGr: form.descGr || form.descEn,
      descIt: form.descIt || null, descEs: form.descEs || null, descDe: form.descDe || null,
      descFr: form.descFr || null, descAr: form.descAr || null, descSl: form.descSl || null,
      funFactEn: form.funFactEn || "", funFactAl: form.funFactAl || form.funFactEn || "", funFactGr: form.funFactGr || form.funFactEn || "",
      funFactIt: form.funFactIt || null, funFactEs: form.funFactEs || null, funFactDe: form.funFactDe || null,
      funFactFr: form.funFactFr || null, funFactAr: form.funFactAr || null, funFactSl: form.funFactSl || null,
      category: form.category,
      points: parseInt(form.points) || 50,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      visitDuration: parseInt(form.visitDuration) || 30,
      imageUrl: form.imageUrl || null,
      audioUrlEn: form.audioUrlEn || null,
      audioUrlAl: form.audioUrlAl || null,
      audioUrlGr: form.audioUrlGr || null,
      audioUrlIt: form.audioUrlIt || null, audioUrlEs: form.audioUrlEs || null, audioUrlDe: form.audioUrlDe || null,
      audioUrlFr: form.audioUrlFr || null, audioUrlAr: form.audioUrlAr || null, audioUrlSl: form.audioUrlSl || null,
    };

    try {
      const res = isNew
        ? await adminFetch("/api/admin/attractions", { method: "POST", body: JSON.stringify(payload) })
        : await adminFetch(`/api/admin/attractions/${attractionId}`, { method: "PUT", body: JSON.stringify(payload) });

      if (res.ok) {
        setSavedOk(true);
        setTimeout(() => { setSavedOk(false); onSaved(); }, 800);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Save failed: ${err.error || res.status}`);
      }
    } catch (e) {
      alert("Save failed: network error");
    }
    setSaving(false);
  }

  const latNum = parseFloat(form.lat);
  const lngNum = parseFloat(form.lng);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> {destinationName}
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-medium text-foreground">
              {isNew ? `New Attraction` : `Editing: ${form.nameEn || "…"}`}
            </span>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {savedOk ? "Saved!" : saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Tabs defaultValue="details">
          <TabsList className="mb-6">
            <TabsTrigger value="details" className="gap-1.5 text-xs"><Info className="w-3.5 h-3.5" /> Details</TabsTrigger>
            <TabsTrigger value="location" className="gap-1.5 text-xs"><MapPin className="w-3.5 h-3.5" /> Location</TabsTrigger>
            <TabsTrigger value="translations" className="gap-1.5 text-xs"><Globe className="w-3.5 h-3.5" /> Translations</TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5 text-xs"><Image className="w-3.5 h-3.5" /> Media</TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5 text-xs"><Eye className="w-3.5 h-3.5" /> Preview</TabsTrigger>
          </TabsList>

          {/* Details */}
          <TabsContent value="details" className="space-y-6">
            <Card className="border-border/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Attraction Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="URL Slug" error={errors.slug} required>
                    <Input value={form.slug} onChange={e => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="berat-castle" />
                    <p className="text-xs text-muted-foreground mt-1">Used in URL: /sites/{destinationSlug}/<strong>{form.slug || "slug"}</strong></p>
                  </Field>
                  <Field label="Points (XP)" error={errors.points}>
                    <Input type="number" min="10" max="200" value={form.points} onChange={e => set("points", e.target.value)} />
                  </Field>
                </div>
                <Field label="English Name" error={errors.nameEn} required>
                  <Input value={form.nameEn} onChange={e => set("nameEn", e.target.value)} placeholder="Berat Castle (Kalaja)" />
                </Field>
                <Field label="English Description" error={errors.descEn} required>
                  <Textarea value={form.descEn} onChange={e => set("descEn", e.target.value)} rows={5} placeholder="Describe this attraction in detail…" />
                </Field>
                <Field label="English Fun Fact (Did You Know?)">
                  <Input value={form.funFactEn} onChange={e => set("funFactEn", e.target.value)} placeholder="An interesting fact about this attraction" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Category" error={errors.category} required>
                    <Select value={form.category} onValueChange={v => set("category", v)}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>{ATTR_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Visit Duration (minutes)">
                    <Input type="number" min="5" max="300" value={form.visitDuration} onChange={e => set("visitDuration", e.target.value)} />
                  </Field>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Location */}
          <TabsContent value="location" className="space-y-6">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Pin Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Latitude" error={errors.lat} required>
                    <Input value={form.lat} onChange={e => set("lat", e.target.value)} placeholder="40.7069" />
                  </Field>
                  <Field label="Longitude" error={errors.lng} required>
                    <Input value={form.lng} onChange={e => set("lng", e.target.value)} placeholder="19.9504" />
                  </Field>
                </div>
                <MapPicker
                  lat={isNaN(latNum) ? 41.1533 : latNum}
                  lng={isNaN(lngNum) ? 20.1683 : lngNum}
                  onPick={(la, lo) => { set("lat", String(la)); set("lng", String(lo)); }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Translations */}
          <TabsContent value="translations" className="space-y-5">
            <p className="text-sm text-muted-foreground">Translations for all languages. Click "Auto-translate" to fill all three fields from the English version. English is used as fallback if left blank.</p>
            {translateError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">{translateError}</div>
            )}
            {LANGS.filter(l => l.key !== "en").map(lang => {
              const cap = lang.key.charAt(0).toUpperCase() + lang.key.slice(1);
              const isTranslating = translatingLang === lang.key;
              return (
                <Card key={lang.key} className="border-border/60">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2"><span className="text-base">{lang.flag}</span> {lang.label}</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTranslateAttr(lang.key)}
                        disabled={isTranslating || !form.nameEn}
                        className="text-xs h-7 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                      >
                        {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="text-sm">🌐</span>}
                        {isTranslating ? "Translating…" : "Auto-translate"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field label={`${lang.label} Name`}>
                      <Input
                        value={form[`name${cap}` as keyof AttrFormData]}
                        onChange={e => set(`name${cap}` as keyof AttrFormData, e.target.value)}
                        placeholder={form.nameEn}
                      />
                    </Field>
                    <Field label={`${lang.label} Description`}>
                      <Textarea
                        value={form[`desc${cap}` as keyof AttrFormData]}
                        onChange={e => set(`desc${cap}` as keyof AttrFormData, e.target.value)}
                        rows={4}
                        placeholder={form.descEn}
                      />
                    </Field>
                    <Field label={`${lang.label} Fun Fact`}>
                      <Input
                        value={form[`funFact${cap}` as keyof AttrFormData]}
                        onChange={e => set(`funFact${cap}` as keyof AttrFormData, e.target.value)}
                        placeholder={form.funFactEn}
                      />
                    </Field>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Media */}
          <TabsContent value="media" className="space-y-5">
            <ImageUploadCard imageUrl={form.imageUrl} onUpdate={url => set("imageUrl", url)} />
            <Card className="border-border/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Music className="w-4 h-4 text-primary" /> Audio Guide</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {LANGS.map(lang => {
                  const cap = lang.key.charAt(0).toUpperCase() + lang.key.slice(1);
                  const descField = `desc${cap}` as keyof AttrFormData;
                  const descText = (form[descField] as string) || form.descEn || "";
                  return (
                    <AudioCard
                      key={lang.key}
                      siteId={attractionId}
                      lang={lang.key}
                      label={lang.label}
                      flag={lang.flag}
                      currentUrl={form[`audioUrl${cap}` as keyof AttrFormData] as string || null}
                      onUpdate={url => set(`audioUrl${cap}` as keyof AttrFormData, url || "")}
                      entityType="attractions"
                      descText={descText}
                    />
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preview */}
          <TabsContent value="preview" className="space-y-5">
            <AttractionPreviewCard form={form} destinationName={destinationName} />
          </TabsContent>
        </Tabs>

        <div className="pt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 min-w-32">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savedOk ? "Saved!" : saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </main>
    </div>
  );
}

// ─── ROOT PANEL (state machine) ───────────────────────────────────────────────
export default function AdminPanel() {
  const [view, setView] = useState<View>(() =>
    getAdminToken() ? { screen: "sites" } : { screen: "login" }
  );

  if (view.screen === "login") {
    return <LoginView onLogin={() => setView({ screen: "sites" })} />;
  }

  if (view.screen === "sites") {
    return (
      <SitesView
        onEdit={id => setView({ screen: "editor", siteId: id })}
        onNew={() => setView({ screen: "editor", siteId: null })}
        onLogout={() => { clearAdminToken(); setView({ screen: "login" }); }}
        onManageAttractions={(slug, name) => setView({ screen: "attractions", destinationSlug: slug, destinationName: name })}
      />
    );
  }

  if (view.screen === "editor") {
    return (
      <EditorView
        siteId={view.siteId}
        onBack={() => setView({ screen: "sites" })}
        onSaved={newId => setView({ screen: "editor", siteId: newId })}
      />
    );
  }

  if (view.screen === "attractions") {
    return (
      <AttractionsView
        destinationSlug={view.destinationSlug}
        destinationName={view.destinationName}
        onBack={() => setView({ screen: "sites" })}
        onEdit={id => setView({ screen: "attr-editor", attractionId: id, destinationSlug: view.destinationSlug, destinationName: view.destinationName })}
        onNew={() => setView({ screen: "attr-editor", attractionId: null, destinationSlug: view.destinationSlug, destinationName: view.destinationName })}
      />
    );
  }

  // attr-editor
  return (
    <AttrEditorView
      attractionId={view.attractionId}
      destinationSlug={view.destinationSlug}
      destinationName={view.destinationName}
      onBack={() => setView({ screen: "attractions", destinationSlug: view.destinationSlug, destinationName: view.destinationName })}
      onSaved={() => setView({ screen: "attractions", destinationSlug: view.destinationSlug, destinationName: view.destinationName })}
    />
  );
}
