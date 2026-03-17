import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, LogOut, MapPin, Music, Globe, BarChart3, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TourSite } from "@shared/schema";
import { getAdminToken, clearAdminToken } from "@/lib/adminAuth";

const CATEGORY_COLORS: Record<string, string> = {
  archaeology: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  castle: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  beach: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  "historic-town": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  nature: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

function adminFetch(url: string, options?: RequestInit) {
  const token = getAdminToken() || "";
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
      ...(options?.headers || {}),
    },
  });
}

export default function AdminSitesPage() {
  const [, setLocation] = useLocation();
  const [sites, setSites] = useState<TourSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      setLocation("/admin");
      return;
    }
    fetchSites();
  }, []);

  async function fetchSites() {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/sites");
      if (res.status === 401) {
        setLocation("/admin");
        return;
      }
      setSites(await res.json());
    } catch {
      // offline — show empty
    }
    setLoading(false);
  }

  async function deleteSite(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    await adminFetch(`/api/admin/sites/${id}`, { method: "DELETE" });
    setSites(prev => prev.filter(s => s.id !== id));
    setDeleting(null);
  }

  function logout() {
    clearAdminToken();
    setLocation("/admin");
  }

  const stats = {
    total: sites.length,
    withAudio: sites.filter(s => s.audioUrlEn || s.audioUrlAl || s.audioUrlGr).length,
    regions: new Set(sites.map(s => s.region)).size,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 40 40" fill="none" className="w-7 h-7">
              <path d="M20 4 L36 32 L20 26 L4 32 Z" fill="hsl(var(--primary))" opacity="0.9"/>
            </svg>
            <div>
              <span className="font-semibold text-foreground text-sm">AlbaniaAudioTours Admin</span>
              <span className="text-muted-foreground text-xs ml-2">Content Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open("/#/", "_blank")}
              className="gap-1.5 text-xs"
            >
              <Eye className="w-3.5 h-3.5" /> View App
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5 text-xs text-muted-foreground">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: MapPin, label: "Tour Sites", value: stats.total },
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

        {/* Actions */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Tour Sites</h2>
          <Button
            size="sm"
            onClick={() => setLocation("/admin/sites/new")}
            className="gap-1.5"
            data-testid="button-new-site"
          >
            <Plus className="w-4 h-4" /> Add Site
          </Button>
        </div>

        {/* Sites list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : sites.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No tour sites yet. Add your first one!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sites.map(site => {
              const audioCount = [site.audioUrlEn, site.audioUrlAl, site.audioUrlGr].filter(Boolean).length;
              return (
                <div
                  key={site.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:border-primary/30 transition-colors"
                  data-testid={`row-site-${site.id}`}
                >
                  {/* Thumbnail */}
                  {site.imageUrl ? (
                    <img
                      src={site.imageUrl}
                      alt={site.nameEn}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground truncate">{site.nameEn}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[site.category] || "bg-muted text-muted-foreground"}`}>
                        {site.category}
                      </span>
                      {audioCount > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                          🎵 {audioCount}/3 audio
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {site.region} · {site.points} XP · {site.difficulty}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation(`/admin/sites/${site.id}`)}
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
