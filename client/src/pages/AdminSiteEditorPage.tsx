import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Save, Upload, Trash2, Play, Pause, Loader2,
  MapPin, Globe, Music, Image, Info, Route
} from "lucide-react";
import ItineraryManager from "@/components/ItineraryManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { TourSite } from "@shared/schema";
import { getAdminToken } from "@/lib/adminAuth";

const CATEGORIES = ["archaeology", "castle", "beach", "historic-town", "nature"];
const DIFFICULTIES = ["easy", "moderate", "hard"];
const REGIONS = ["Sarandë", "Gjirokastër", "Fier", "Berat", "Shkodër", "Tirana", "Durrës", "Vlorë", "Korçë", "Other"];
const LANGS: { key: "en" | "al" | "gr" | "it" | "es" | "de" | "fr" | "ar" | "sl" | "pt" | "cn"; label: string; flag: string }[] = [
  { key: "en", label: "English", flag: "🇬🇧" },
  { key: "al", label: "Albanian", flag: "🇦🇱" },
  { key: "gr", label: "Greek", flag: "🇬🇷" },
  { key: "it", label: "Italian", flag: "🇮🇹" },
  { key: "es", label: "Spanish", flag: "🇪🇸" },
  { key: "de", label: "German", flag: "🇩🇪" },
  { key: "fr", label: "French", flag: "🇫🇷" },
  { key: "ar", label: "Arabic", flag: "🇸🇦" },
  { key: "sl", label: "Slovenian", flag: "🇸🇮" },
  { key: "pt", label: "Portuguese", flag: "🇵🇹" },
  { key: "cn", label: "Chinese", flag: "🇨🇳" },
];

function adminFetch(url: string, options?: RequestInit) {
  const token = getAdminToken() || "";
  return fetch(url, {
    ...options,
    headers: {
      "x-admin-token": token,
      ...(options?.headers || {}),
    },
  });
}

// ─── Audio upload card for one language ──────────────────────────────────────
function AudioCard({
  siteId,
  lang,
  label,
  flag,
  currentUrl,
  onUpdate,
}: {
  siteId: number;
  lang: "en" | "al" | "gr";
  label: string;
  flag: string;
  currentUrl: string | null;
  onUpdate: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function handleUpload(file: File) {
    if (!file) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("audio", file);
    try {
      const token = getAdminToken() || "";
      const res = await fetch(`/api/admin/sites/${siteId}/audio/${lang}`, {
        method: "POST",
        headers: { "x-admin-token": token },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        onUpdate(data.url);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Network error during upload");
    }
    setUploading(false);
  }

  async function handleDelete() {
    if (!confirm("Remove this audio file?")) return;
    const res = await adminFetch(`/api/admin/sites/${siteId}/audio/${lang}`, { method: "DELETE" });
    if (res.ok) onUpdate(null);
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{flag}</span>
        <span className="font-medium text-sm text-foreground">{label}</span>
        {currentUrl && (
          <span className="ml-auto text-xs text-green-600 dark:text-green-400 font-medium">✓ Uploaded</span>
        )}
      </div>

      {currentUrl ? (
        <div className="space-y-2">
          <audio ref={audioRef} src={currentUrl} onEnded={() => setPlaying(false)} className="hidden" />
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePlay}
              className="h-7 w-7 p-0 flex-shrink-0"
              data-testid={`button-play-${lang}`}
            >
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </Button>
            <span className="text-xs text-muted-foreground truncate flex-1">
              {currentUrl.split("/").pop()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-7 w-7 p-0 flex-shrink-0 text-destructive hover:text-destructive"
              data-testid={`button-delete-audio-${lang}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            className="w-full text-xs gap-1.5 h-7"
          >
            <Upload className="w-3 h-3" /> Replace audio
          </Button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-border/60 rounded-lg p-4 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Uploading…</span>
            </div>
          ) : (
            <>
              <Music className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                Drop MP3 here or <span className="text-primary font-medium">click to browse</span>
              </p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">MP3, WAV, M4A · Max 100 MB</p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
      />
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────
type FormData = {
  slug: string;
  nameEn: string; nameAl: string; nameGr: string;
  descEn: string; descAl: string; descGr: string;
  funFactEn: string; funFactAl: string; funFactGr: string;
  audioUrlEn: string | null; audioUrlAl: string | null; audioUrlGr: string | null;
  lat: string; lng: string;
  region: string; category: string; difficulty: string;
  points: string; visitDuration: string; imageUrl: string;
};

const EMPTY_FORM: FormData = {
  slug: "", nameEn: "", nameAl: "", nameGr: "",
  descEn: "", descAl: "", descGr: "",
  funFactEn: "", funFactAl: "", funFactGr: "",
  audioUrlEn: null, audioUrlAl: null, audioUrlGr: null,
  lat: "", lng: "", region: "", category: "", difficulty: "easy",
  points: "100", visitDuration: "60", imageUrl: "",
};

function siteToForm(s: TourSite): FormData {
  return {
    slug: s.slug,
    nameEn: s.nameEn, nameAl: s.nameAl, nameGr: s.nameGr,
    descEn: s.descEn, descAl: s.descAl, descGr: s.descGr,
    funFactEn: s.funFactEn || "", funFactAl: s.funFactAl || "", funFactGr: s.funFactGr || "",
    audioUrlEn: s.audioUrlEn, audioUrlAl: s.audioUrlAl, audioUrlGr: s.audioUrlGr,
    lat: String(s.lat), lng: String(s.lng),
    region: s.region, category: s.category, difficulty: s.difficulty,
    points: String(s.points), visitDuration: String(s.visitDuration),
    imageUrl: s.imageUrl || "",
  };
}

export default function AdminSiteEditorPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const isNew = params.id === "new";
  const siteId = isNew ? null : parseInt(params.id);

  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!getAdminToken()) {
      setLocation("/admin");
      return;
    }
    if (!isNew && siteId) {
      adminFetch(`/api/admin/sites`)
        .then(r => r.json())
        .then((sites: TourSite[]) => {
          const site = sites.find(s => s.id === siteId);
          if (site) setForm(siteToForm(site));
          else setLocation("/admin/sites");
        })
        .finally(() => setLoading(false));
    }
  }, []);

  function set(field: keyof FormData, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
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
      visitDuration: parseInt(form.visitDuration) || 60,
      imageUrl: form.imageUrl || null,
      funFactEn: form.funFactEn || null,
      funFactAl: form.funFactAl || null,
      funFactGr: form.funFactGr || null,
      nameAl: form.nameAl || form.nameEn,
      nameGr: form.nameGr || form.nameEn,
      descAl: form.descAl || form.descEn,
      descGr: form.descGr || form.descEn,
    };
    try {
      const res = isNew
        ? await adminFetch("/api/admin/sites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await adminFetch(`/api/admin/sites/${siteId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

      if (res.ok) {
        const saved = await res.json();
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        if (isNew) setLocation(`/admin/sites/${saved.id}`);
      } else {
        const d = await res.json();
        alert("Save failed: " + (d.error || JSON.stringify(d)));
      }
    } catch {
      alert("Network error while saving");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/admin/sites")}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-medium text-foreground">
              {isNew ? "New Tour Site" : `Editing: ${form.nameEn || "…"}`}
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5"
            data-testid="button-save"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? "Saved!" : saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Tabs defaultValue="details">
          <TabsList className="mb-6">
            <TabsTrigger value="details" className="gap-1.5 text-xs">
              <Info className="w-3.5 h-3.5" /> Details
            </TabsTrigger>
            <TabsTrigger value="translations" className="gap-1.5 text-xs">
              <Globe className="w-3.5 h-3.5" /> Translations
            </TabsTrigger>
            <TabsTrigger value="audio" className="gap-1.5 text-xs" disabled={isNew}>
              <Music className="w-3.5 h-3.5" /> Audio
              {isNew && <span className="text-muted-foreground/60 ml-1">(save first)</span>}
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5 text-xs">
              <Image className="w-3.5 h-3.5" /> Media
            </TabsTrigger>
            <TabsTrigger value="itinerary" className="gap-1.5 text-xs" disabled={isNew}>
              <Route className="w-3.5 h-3.5" /> Itinerary
              {isNew && <span className="text-muted-foreground/60 ml-1">(save first)</span>}
            </TabsTrigger>
          </TabsList>

          {/* ── Details tab ─────────────────────────────────────────── */}
          <TabsContent value="details" className="space-y-6">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="URL Slug" error={errors.slug} required>
                    <Input
                      value={form.slug}
                      onChange={e => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                      placeholder="butrint-national-park"
                      data-testid="input-slug"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Used in the URL: /sites/<strong>{form.slug || "slug"}</strong></p>
                  </Field>
                  <Field label="Points (XP)" error={errors.points}>
                    <Input
                      type="number" min="10" max="500"
                      value={form.points}
                      onChange={e => set("points", e.target.value)}
                      data-testid="input-points"
                    />
                  </Field>
                </div>

                <Field label="English Name" error={errors.nameEn} required>
                  <Input
                    value={form.nameEn}
                    onChange={e => set("nameEn", e.target.value)}
                    placeholder="Butrint National Park"
                    data-testid="input-name-en"
                  />
                </Field>

                <Field label="English Description" error={errors.descEn} required>
                  <Textarea
                    value={form.descEn}
                    onChange={e => set("descEn", e.target.value)}
                    rows={4}
                    placeholder="Describe this site in detail…"
                    data-testid="input-desc-en"
                  />
                </Field>

                <Field label="English Fun Fact">
                  <Input
                    value={form.funFactEn}
                    onChange={e => set("funFactEn", e.target.value)}
                    placeholder="A surprising or interesting fact about this site"
                    data-testid="input-fun-fact-en"
                  />
                </Field>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Location & Classification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Latitude" error={errors.lat} required>
                    <Input
                      value={form.lat}
                      onChange={e => set("lat", e.target.value)}
                      placeholder="39.7447"
                      data-testid="input-lat"
                    />
                  </Field>
                  <Field label="Longitude" error={errors.lng} required>
                    <Input
                      value={form.lng}
                      onChange={e => set("lng", e.target.value)}
                      placeholder="20.0175"
                      data-testid="input-lng"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Field label="Region" error={errors.region} required>
                    <Select value={form.region} onValueChange={v => set("region", v)}>
                      <SelectTrigger data-testid="select-region">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Category" error={errors.category} required>
                    <Select value={form.category} onValueChange={v => set("category", v)}>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Difficulty">
                    <Select value={form.difficulty} onValueChange={v => set("difficulty", v)}>
                      <SelectTrigger data-testid="select-difficulty">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field label="Visit Duration (minutes)">
                  <Input
                    type="number" min="15" max="1440"
                    value={form.visitDuration}
                    onChange={e => set("visitDuration", e.target.value)}
                    data-testid="input-duration"
                  />
                </Field>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Translations tab ────────────────────────────────────── */}
          <TabsContent value="translations" className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Add translations for Albanian and Greek. If left blank, the English content will be used as a fallback.
            </p>
            {LANGS.filter(l => l.key !== "en").map(lang => (
              <Card key={lang.key} className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="text-base">{lang.flag}</span> {lang.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field label={`${lang.label} Name`}>
                    <Input
                      value={form[`name${lang.key.charAt(0).toUpperCase() + lang.key.slice(1)}` as keyof FormData] as string}
                      onChange={e => set(`name${lang.key.charAt(0).toUpperCase() + lang.key.slice(1)}` as keyof FormData, e.target.value)}
                      placeholder={form.nameEn}
                    />
                  </Field>
                  <Field label={`${lang.label} Description`}>
                    <Textarea
                      value={form[`desc${lang.key.charAt(0).toUpperCase() + lang.key.slice(1)}` as keyof FormData] as string}
                      onChange={e => set(`desc${lang.key.charAt(0).toUpperCase() + lang.key.slice(1)}` as keyof FormData, e.target.value)}
                      rows={4}
                      placeholder={form.descEn}
                    />
                  </Field>
                  <Field label={`${lang.label} Fun Fact`}>
                    <Input
                      value={form[`funFact${lang.key.charAt(0).toUpperCase() + lang.key.slice(1)}` as keyof FormData] as string}
                      onChange={e => set(`funFact${lang.key.charAt(0).toUpperCase() + lang.key.slice(1)}` as keyof FormData, e.target.value)}
                      placeholder={form.funFactEn}
                    />
                  </Field>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ── Audio tab ───────────────────────────────────────────── */}
          <TabsContent value="audio" className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Upload an MP3 narration for each language. Visitors will hear this when they tap "Play Audio Tour" on the site detail page.
            </p>
            {!isNew && siteId && (
              <div className="grid gap-4">
                {LANGS.map(lang => (
                  <AudioCard
                    key={lang.key}
                    siteId={siteId}
                    lang={lang.key}
                    label={lang.label}
                    flag={lang.flag}
                    currentUrl={form[`audioUrl${lang.key.charAt(0).toUpperCase() + lang.key.slice(1)}` as keyof FormData] as string | null}
                    onUpdate={url => set(`audioUrl${lang.key.charAt(0).toUpperCase() + lang.key.slice(1)}` as keyof FormData, url)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Media tab ───────────────────────────────────────────── */}
          <TabsContent value="media" className="space-y-5">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Image className="w-4 h-4 text-primary" /> Hero Image
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Image URL">
                  <Input
                    value={form.imageUrl}
                    onChange={e => set("imageUrl", e.target.value)}
                    placeholder="https://images.unsplash.com/photo-xxx?w=800"
                    data-testid="input-image-url"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste a public image URL (Unsplash, Cloudinary, etc.)
                  </p>
                </Field>
                {form.imageUrl && (
                  <img
                    src={form.imageUrl}
                    alt="Preview"
                    className="w-full h-40 object-cover rounded-lg border border-border/60"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Itinerary tab ────────────────────────── */}
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
        </Tabs>

        {/* Save button at bottom */}
        <div className="pt-6 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5 min-w-32"
            data-testid="button-save-bottom"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? "Saved!" : saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </main>
    </div>
  );
}

// ─── Helper component ─────────────────────────────────────────────────────────
function Field({
  label, required, error, children,
}: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
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
