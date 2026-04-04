/**
 * AdminCmsManager — full CMS for managing pages from the admin panel.
 * Handles: footer info pages, blog posts, SEO landing pages.
 * Auth: x-admin-token header (not Bearer).
 * Image upload: converts to base64, stored in coverImage field or inline via toolbar.
 */

import { useState, useRef, useCallback } from "react";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, ArrowLeft, Save,
  FileText, BookOpen, Megaphone, LayoutDashboard, ExternalLink,
  Image as ImageIcon, Search, CheckCircle2,
  ChevronDown, ChevronUp, AlertTriangle, Upload, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getAdminToken } from "@/lib/adminAuth";

const RAILWAY_URL = "https://albania-audio-tours-production.up.railway.app";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CmsPage {
  id: number;
  slug: string;
  pageType: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  author: string;
  publishedAt: string;
  isPublished: boolean;
  showInFooter: boolean;
  showInBlog: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

type PageMode = "list" | "edit" | "new";

const PAGE_TYPE_LABELS: Record<string, { label: string; icon: any; color: string; desc: string }> = {
  system:  { label: "System Page",    icon: LayoutDashboard, color: "bg-slate-100 text-slate-700",  desc: "Core pages like Contact, Terms, Refund Policy" },
  info:    { label: "Info Page",      icon: FileText,        color: "bg-blue-100 text-blue-700",    desc: "General information pages" },
  blog:    { label: "Blog Post",      icon: BookOpen,        color: "bg-green-100 text-green-700",  desc: "Travel stories, tips, destination guides" },
  landing: { label: "Landing Page",   icon: Megaphone,       color: "bg-amber-100 text-amber-700",  desc: "SEO-optimised pages targeting specific keywords" },
};

// ─── Free tour alternative landing page template ──────────────────────────────
const FREE_TOUR_TEMPLATE = {
  pageType: "landing",
  title: "Skip the Tip Jar — Albania\'s Self-Guided Audio Tour Is Free During Launch",
  slug: "free-audio-tour-albania",
  excerpt: "No group, no guide, no tip jar. Explore Albania at your own pace — and right now, during our launch period, it\'s completely free.",
  seoTitle: "Free Self-Guided Audio Tour Albania — No Tips, No Groups, No Schedules",
  seoDescription: "Albania\'s self-guided audio tour is free during our launch period. No tip pressure, no fixed schedule. Explore Tirana, Berat, Gjirokastër at your own pace — before subscription pricing begins.",
  seoKeywords: "free tour albania, self-guided tour albania, albania audio tour free, alternative free tour albania, berat walking tour, tirana walking tour",
  author: "AlbaTour",
  isPublished: false,
  showInFooter: false,
  showInBlog: false,
  sortOrder: 0,
  publishedAt: "",
  coverImage: "",
  body: `<section style="max-width:680px;margin:0 auto;">

  <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:14px 18px;margin-bottom:28px;">
    <p style="margin:0;font-size:14px;"><strong>🚨 Launch period — free access, limited time.</strong> AlbaTour is currently free while we build and launch. A subscription plan will follow. Travellers using the platform now get full access at no cost — no strings attached, no credit card, no expiry date announced yet.</p>
  </div>

  <h1>Skip the Tip Jar. Explore Albania on Your Own Terms.</h1>

  <p>You've probably seen the "free" walking tours in Tirana or Berat. They're free — until the end, when a hat goes around and you feel the pressure to tip. What if you could skip all that and still get a rich, detailed, historically accurate audio experience of Albania?</p>

  <p>That's what AlbaTour is. No group. No schedule. No guide waiting for a donation. Just you, your phone, and the stories of one of Europe's most fascinating countries — told at your pace, on your terms.</p>

  <hr />

  <h2>Why Self-Guided Beats "Free" Tours</h2>

  <ul>
    <li><strong>No fixed schedule.</strong> Start when you wake up. Pause for coffee. Resume after lunch. The tour waits for you.</li>
    <li><strong>No group pace.</strong> Spend as long as you want at any spot. No one is rushing you to the next stop.</li>
    <li><strong>No tip pressure.</strong> During launch, AlbaTour is genuinely free. No donation box, no awkward moment at the end.</li>
    <li><strong>No waiting.</strong> Open the app and go. No meeting points, no late arrivals, no stragglers.</li>
    <li><strong>Works offline.</strong> The audio plays without a signal — perfect for old towns and mountain villages with patchy coverage.</li>
  </ul>

  <hr />

  <h2>What's Included Right Now</h2>

  <p>During the launch period, you get full access to everything AlbaTour has built so far:</p>

  <ul>
    <li>🏛️ <strong>Tirana</strong> — Communist history, Ottoman bazaars, and modern street art</li>
    <li>🏰 <strong>Berat</strong> — The UNESCO "City of a Thousand Windows"</li>
    <li>🏯 <strong>Gjirokastër</strong> — A hilltop Ottoman town frozen in time</li>
    <li>🌊 <strong>Sarandë</strong> — Riviera beaches and the ancient ruins of Butrint</li>
    <li>🏔️ <strong>Albanian Alps</strong> — Theth, Valbona, and Europe's last truly wild mountains</li>
    <li>…and <strong>38 more destinations</strong>, 300+ individual sites, 10 walking tours</li>
  </ul>

  <p>New destinations and audio tours are being added regularly throughout the launch period.</p>

  <hr />

  <h2>How It Works</h2>

  <ol>
    <li><strong>Open AlbaTour</strong> on your phone — no download or account needed.</li>
    <li><strong>Find your destination</strong> on the interactive map or browse the full list.</li>
    <li><strong>Tap a site</strong> to start the audio narration and begin walking.</li>
    <li><strong>Collect passport stamps</strong> as you visit each site and build your Albania travel record.</li>
  </ol>

  <hr />

  <h2>Built for Independent Travellers</h2>

  <p>AlbaTour was made for the kind of traveller who doesn't want to be herded around. You've done your research, you know what you want to see, and you want the freedom to explore on your own terms. The audio gives you the context — the history, the stories, the local details — without taking control of your day.</p>

  <p>Whether you have an afternoon in Tirana or a full week in the south, AlbaTour fits around your time, not the other way around.</p>

  <hr />

  <h2>Start Now — While It's Still Free</h2>

  <p>No sign-up. No payment. No tip at the end. Open the map and start exploring. This won't always be free — but it is right now.</p>

  <p style="text-align:center;margin-top:24px;">
    <a href="/#/" style="display:inline-block;background:#c0392b;color:#fff;padding:14px 32px;border-radius:8px;font-weight:bold;text-decoration:none;font-size:16px;">
      Open the Map →
    </a>
  </p>

  <p style="text-align:center;margin-top:12px;font-size:12px;color:#888;">Free during launch period. Subscription pricing will be announced in advance.</p>

</section>`,
};

// ─── Toolbar ──────────────────────────────────────────────────────────────────
function EditorToolbar({ onInsert }: { onInsert: (before: string, after: string) => void }) {
  const btn = (label: string, title: string, before: string, after = "") => (
    <button
      type="button"
      title={title}
      onClick={() => onInsert(before, after)}
      className="px-2 py-1 text-xs font-mono rounded border border-border bg-card hover:bg-muted transition-colors"
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap gap-1 p-2 bg-muted border border-border border-b-0 rounded-t-lg">
      {btn("H1", "Heading 1", "<h1>", "</h1>")}
      {btn("H2", "Heading 2", "<h2>", "</h2>")}
      {btn("H3", "Heading 3", "<h3>", "</h3>")}
      {btn("P",  "Paragraph", "<p>", "</p>")}
      {btn("B",  "Bold",      "<strong>", "</strong>")}
      {btn("I",  "Italic",    "<em>", "</em>")}
      {btn("UL", "Unordered list", "<ul>\n  <li>", "</li>\n</ul>")}
      {btn("OL", "Ordered list",   "<ol>\n  <li>", "</li>\n</ol>")}
      {btn("LI", "List item",  "<li>", "</li>")}
      {btn("A",  "Link",       '<a href="">', "</a>")}
      {btn("HR", "Divider",    "<hr />", "")}
      {btn("BR", "Line break", "<br />", "")}
      {btn("IMG","Inline image",'<img src="" alt="" style="max-width:100%;border-radius:8px;margin:12px 0;" />', "")}
    </div>
  );
}

// ─── Cover image uploader ─────────────────────────────────────────────────────
function CoverImageUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (base64: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);

    // Resize + compress via canvas before storing as base64
    // Target: max 1200px wide, 16:9 aspect, JPEG quality 0.82 — keeps size well under 500kb
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_W = 1200;
      const MAX_H = 675; // 16:9
      let { width, height } = img;

      // Scale down proportionally if too large
      if (width > MAX_W) { height = Math.round(height * MAX_W / width); width = MAX_W; }
      if (height > MAX_H) { width = Math.round(width * MAX_H / height); height = MAX_H; }

      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      const base64 = canvas.toDataURL("image/jpeg", 0.82);
      URL.revokeObjectURL(objectUrl);
      onChange(base64);
      setUploading(false);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); setUploading(false); };
    img.src = objectUrl;
  }, [onChange]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground block">
        Cover Image
        <span className="ml-1 font-normal">(used on blog cards and social sharing)</span>
      </label>

      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-border">
          <div className="w-full" style={{ aspectRatio: "16/9" }}>
            <img src={value} alt="Cover" className="w-full h-full object-cover" loading="lazy" />
          </div>
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" />
              Uploading…
            </div>
          ) : (
            <>
              <Upload size={20} className="mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Drop an image here or <span className="text-primary font-medium">click to upload</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WebP — stored directly</p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      <p className="text-xs text-muted-foreground">
        Or paste a URL below:
      </p>
      <Input
        value={value.startsWith("data:") ? "" : value}
        onChange={e => onChange(e.target.value)}
        placeholder="https://example.com/image.jpg"
        className="h-8 text-sm"
      />
    </div>
  );
}

// ─── HTML preview ─────────────────────────────────────────────────────────────
function HtmlPreview({ html }: { html: string }) {
  if (!html.trim()) {
    return <p className="text-sm text-muted-foreground italic">No content yet.</p>;
  }
  return (
    <div
      className="prose prose-sm max-w-none text-sm text-foreground"
      style={{ lineHeight: 1.7 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ─── Blank form ───────────────────────────────────────────────────────────────
function blankPage(): Omit<CmsPage, "id" | "createdAt" | "updatedAt"> {
  return {
    slug: "", pageType: "info", title: "", excerpt: "", body: "",
    coverImage: "", seoTitle: "", seoDescription: "", seoKeywords: "",
    author: "AlbaTour", publishedAt: "", isPublished: false,
    showInFooter: false, showInBlog: false, sortOrder: 0,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminCmsManager() {
  const [mode, setMode] = useState<PageMode>("list");
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editPage, setEditPage] = useState<(Omit<CmsPage, "id" | "createdAt" | "updatedAt"> & { id?: number }) | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Correct auth header ──────────────────────────────────────────────────────
  const token = getAdminToken() || "";
  const headers = {
    "Content-Type": "application/json",
    "x-admin-token": token,
  };

  // ── Load pages ──────────────────────────────────────────────────────────────
  async function loadPages() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${RAILWAY_URL}/api/admin/cms/pages`, {
        headers: { "x-admin-token": token },
      });
      if (!res.ok) throw new Error(await res.text());
      setPages(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const [loaded, setLoaded] = useState(false);
  if (!loaded) { setLoaded(true); loadPages(); }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function savePage() {
    if (!editPage) return;
    if (!editPage.title.trim()) { setError("Title is required."); return; }
    if (!editPage.slug.trim())  { setError("URL slug is required."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const isNew = !editPage.id;
      const url = isNew
        ? `${RAILWAY_URL}/api/admin/cms/pages`
        : `${RAILWAY_URL}/api/admin/cms/pages/${editPage.id}`;
      const payload = { ...editPage };
      if (payload.isPublished && !payload.publishedAt) {
        payload.publishedAt = new Date().toISOString();
      }
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const saved: CmsPage = await res.json();
      setPages(prev => isNew ? [saved, ...prev] : prev.map(p => p.id === saved.id ? saved : p));
      setSuccess(`"${saved.title}" saved.`);
      setTimeout(() => { setSuccess(""); setMode("list"); }, 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function deletePage(id: number) {
    setDeletingId(id); setError("");
    try {
      const res = await fetch(`${RAILWAY_URL}/api/admin/cms/pages/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": token, "x-confirm-delete": "yes" },
      });
      if (!res.ok) throw new Error(await res.text());
      setPages(prev => prev.filter(p => p.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  }

  // ── Toggle publish ──────────────────────────────────────────────────────────
  async function togglePublish(page: CmsPage) {
    const updated = {
      isPublished: !page.isPublished,
      publishedAt: !page.isPublished ? new Date().toISOString() : page.publishedAt,
    };
    try {
      const res = await fetch(`${RAILWAY_URL}/api/admin/cms/pages/${page.id}`, {
        method: "PUT", headers, body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error(await res.text());
      const saved: CmsPage = await res.json();
      setPages(prev => prev.map(p => p.id === saved.id ? saved : p));
    } catch (e: any) {
      setError(e.message);
    }
  }

  // ── Toolbar insert ──────────────────────────────────────────────────────────
  function handleInsert(before: string, after: string) {
    const ta = textareaRef.current;
    if (!ta || !editPage) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const selected = ta.value.slice(start, end);
    const newVal = ta.value.slice(0, start) + before + selected + after + ta.value.slice(end);
    setEditPage(p => p ? { ...p, body: newVal } : p);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  }

  // ── Slug auto-gen ───────────────────────────────────────────────────────────
  function titleToSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = filterType === "all" ? pages : pages.filter(p => p.pageType === filterType);

  // ════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ════════════════════════════════════════════════════════════════
  if (mode === "list") {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">Page Manager</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Manage footer pages, blog posts, SEO landing pages</p>
          </div>
          <Button size="sm" onClick={() => { setEditPage(blankPage()); setMode("new"); setPreviewMode(false); setSeoOpen(false); }}>
            <Plus size={14} className="mr-1" /> New Page
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Template shortcut */}
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-amber-800">Ready-made template available</p>
            <p className="text-xs text-amber-700 mt-0.5">
              "Skip the Tip Jar" — a landing page targeting travellers looking for a free alternative to donation-based tours.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 text-xs border-amber-400 text-amber-800 hover:bg-amber-100"
            onClick={() => {
              setEditPage({ ...blankPage(), ...FREE_TOUR_TEMPLATE });
              setMode("new");
              setPreviewMode(false);
              setSeoOpen(true);
            }}
          >
            Use Template
          </Button>
        </div>

        {/* Page type guide */}
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(PAGE_TYPE_LABELS).map(([type, info]) => {
            const Icon = info.icon;
            return (
              <div key={type} className="flex items-start gap-2 p-2 rounded-lg border border-border bg-card text-xs">
                <Icon size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                <div>
                  <span className="font-semibold">{info.label}</span>
                  <p className="text-muted-foreground">{info.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 flex-wrap">
          {["all", "system", "info", "blog", "landing"].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {type === "all"
                ? `All (${pages.length})`
                : `${PAGE_TYPE_LABELS[type]?.label} (${pages.filter(p => p.pageType === type).length})`}
            </button>
          ))}
        </div>

        {/* Page list */}
        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            No pages yet. Click <strong>New Page</strong> to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(page => {
              const typeInfo = PAGE_TYPE_LABELS[page.pageType] || PAGE_TYPE_LABELS.info;
              const Icon = typeInfo.icon;
              return (
                <div key={page.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={14} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{page.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${typeInfo.color}`}>{typeInfo.label}</span>
                      {page.isPublished
                        ? <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Published</span>
                        : <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">Draft</span>}
                      {page.showInFooter && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Footer</span>}
                      {page.showInBlog   && <span className="text-xs px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">Blog</span>}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">/#/p/{page.slug}</span>
                      <a href={`${RAILWAY_URL}/#/p/${page.slug}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:opacity-70">
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    {page.excerpt && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{page.excerpt}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title={page.isPublished ? "Unpublish" : "Publish"} onClick={() => togglePublish(page)}>
                      {page.isPublished ? <Eye size={13} /> : <EyeOff size={13} />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit"
                      onClick={() => { setEditPage({ ...page }); setMode("edit"); setPreviewMode(false); setSeoOpen(false); setError(""); setSuccess(""); }}>
                      <Pencil size={13} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" title="Delete"
                      onClick={() => { if (confirm(`Delete "${page.title}"? This cannot be undone.`)) deletePage(page.id); }}
                      disabled={deletingId === page.id}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // EDIT / NEW VIEW
  // ════════════════════════════════════════════════════════════════
  if ((mode === "edit" || mode === "new") && editPage) {
    return (
      <div className="space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => { setMode("list"); setEditPage(null); setError(""); setSuccess(""); }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <h2 className="font-bold text-sm flex-1 text-center">
            {mode === "new" ? "New Page" : `Editing: ${editPage.title || "Untitled"}`}
          </h2>
          <Button size="sm" onClick={savePage} disabled={saving}>
            {saving
              ? <><div className="w-3 h-3 border border-t-transparent rounded-full animate-spin mr-1" />Saving…</>
              : <><Save size={13} className="mr-1" />Save</>}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            <AlertTriangle size={14} /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs">
            <CheckCircle2 size={14} /> {success}
          </div>
        )}

        {/* Page meta */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm">Page Details</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* Type */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Page Type</label>
              <Select value={editPage.pageType} onValueChange={v => setEditPage(p => p ? { ...p, pageType: v } : p)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System Page (Contact, Terms, Refund…)</SelectItem>
                  <SelectItem value="info">Info Page</SelectItem>
                  <SelectItem value="blog">Blog Post</SelectItem>
                  <SelectItem value="landing">SEO Landing Page</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{PAGE_TYPE_LABELS[editPage.pageType]?.desc}</p>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
              <Input
                value={editPage.title}
                onChange={e => {
                  const t = e.target.value;
                  setEditPage(p => {
                    if (!p) return p;
                    const autoSlug = !p.id && !p.slug ? titleToSlug(t) : p.slug;
                    return { ...p, title: t, slug: autoSlug };
                  });
                }}
                placeholder="Page title"
                className="h-8 text-sm"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                URL Slug * <span className="font-normal">(live at /#/p/slug)</span>
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground font-mono shrink-0">/#/p/</span>
                <Input
                  value={editPage.slug}
                  onChange={e => setEditPage(p => p ? { ...p, slug: titleToSlug(e.target.value) } : p)}
                  placeholder="url-slug"
                  className="h-8 text-sm font-mono"
                />
              </div>
              {editPage.pageType === "system" && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {["contact", "terms", "refund-policy"].map(s => (
                    <button key={s} type="button" onClick={() => setEditPage(p => p ? { ...p, slug: s } : p)}
                      className="text-xs px-2 py-0.5 rounded border border-border bg-muted hover:bg-muted/80 font-mono">
                      {s}
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground self-center">← use these to override footer pages</span>
                </div>
              )}
            </div>

            {/* Excerpt */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Excerpt / Subtitle <span className="font-normal">(shown on blog cards)</span>
              </label>
              <Input
                value={editPage.excerpt}
                onChange={e => setEditPage(p => p ? { ...p, excerpt: e.target.value } : p)}
                placeholder="Short description or subtitle…"
                className="h-8 text-sm"
              />
            </div>

            {/* Author + Sort */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Author</label>
                <Input value={editPage.author} onChange={e => setEditPage(p => p ? { ...p, author: e.target.value } : p)}
                  placeholder="AlbaTour" className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Sort Order</label>
                <Input type="number" value={editPage.sortOrder}
                  onChange={e => setEditPage(p => p ? { ...p, sortOrder: parseInt(e.target.value) || 0 } : p)}
                  className="h-8 text-sm" />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-4 pt-1">
              {[
                { key: "isPublished",  label: "Published",     color: "text-green-600"  },
                { key: "showInFooter", label: "Show in Footer", color: "text-purple-600" },
                { key: "showInBlog",   label: "Show in Blog",   color: "text-teal-600"   },
              ].map(({ key, label, color }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none"
                  onClick={() => setEditPage(p => p ? { ...p, [key]: !(p as any)[key] } : p)}>
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${(editPage as any)[key] ? "bg-primary" : "bg-muted-foreground/30"}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${(editPage as any)[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                  <span className={`text-xs font-medium ${(editPage as any)[key] ? color : "text-muted-foreground"}`}>{label}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cover image upload */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm flex items-center gap-1.5"><ImageIcon size={13} /> Cover Image</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4">
            <CoverImageUploader
              value={editPage.coverImage}
              onChange={v => setEditPage(p => p ? { ...p, coverImage: v } : p)}
            />
          </CardContent>
        </Card>

        {/* Body editor */}
        <Card>
          <CardHeader className="pb-0 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Content (HTML)</CardTitle>
              <button type="button" onClick={() => setPreviewMode(v => !v)}
                className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                {previewMode ? <><Eye size={11} className="mr-0.5" /> Editing</> : <><Eye size={11} className="mr-0.5" /> Preview</>}
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {previewMode ? (
              <div className="min-h-[200px] border border-border rounded-b-lg p-4 bg-white">
                <HtmlPreview html={editPage.body} />
              </div>
            ) : (
              <>
                <EditorToolbar onInsert={handleInsert} />
                <Textarea
                  ref={textareaRef}
                  value={editPage.body}
                  onChange={e => setEditPage(p => p ? { ...p, body: e.target.value } : p)}
                  placeholder="<h2>Heading</h2><p>Write your page content here…</p>"
                  className="font-mono text-xs min-h-[280px] rounded-t-none border-t-0 resize-y"
                />
              </>
            )}
            <p className="text-xs text-muted-foreground mt-1">Write HTML. Toolbar inserts common tags. Toggle Preview to check output.</p>
          </CardContent>
        </Card>

        {/* SEO (collapsible) */}
        <Card>
          <button type="button" className="w-full flex items-center justify-between px-4 py-3" onClick={() => setSeoOpen(v => !v)}>
            <div className="flex items-center gap-2">
              <Search size={13} className="text-muted-foreground" />
              <span className="font-semibold text-sm">SEO Settings</span>
              <span className="text-xs text-muted-foreground">(optional — helps Google ranking)</span>
            </div>
            {seoOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {seoOpen && (
            <CardContent className="px-4 pb-4 space-y-3 pt-0">
              <Separator />
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  SEO Title <span className="font-normal">(what Google shows as the headline)</span>
                </label>
                <Input value={editPage.seoTitle} onChange={e => setEditPage(p => p ? { ...p, seoTitle: e.target.value } : p)}
                  placeholder="Free Self-Guided Audio Tour Albania | AlbaTour" className="h-8 text-sm" />
                <p className="text-xs text-muted-foreground mt-0.5">Keep under 60 characters. Include main keyword + brand.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  SEO Description <span className="font-normal">(snippet under the headline in Google)</span>
                </label>
                <Textarea value={editPage.seoDescription} onChange={e => setEditPage(p => p ? { ...p, seoDescription: e.target.value } : p)}
                  placeholder="No waiting, no tip pressure, no group pace. Explore Albania at your own speed with a full audio tour — completely free." className="text-sm min-h-[72px]" />
                <p className="text-xs text-muted-foreground mt-0.5">Keep under 160 characters. Write it like an ad — it's what convinces someone to click.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Keywords <span className="font-normal">(comma-separated)</span></label>
                <Input value={editPage.seoKeywords} onChange={e => setEditPage(p => p ? { ...p, seoKeywords: e.target.value } : p)}
                  placeholder="free tour albania, self-guided albania, audio tour tirana" className="h-8 text-sm" />
              </div>
              {/* SEO tips */}
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1">
                <p className="text-xs font-semibold text-amber-800">SEO tips for landing pages</p>
                <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                  <li>One keyword per page — don't try to rank for everything at once</li>
                  <li>Put the keyword in the H1, first paragraph, and SEO title</li>
                  <li>"Free tour albania alternative" and "self-guided albania" have low competition — good targets</li>
                  <li>Longer pages rank better — aim for 600+ words on landing pages</li>
                  <li>Add internal links to specific destination pages (Berat, Tirana, etc.)</li>
                </ul>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Bottom save */}
        <div className="flex justify-end gap-2 pb-6">
          <Button variant="outline" size="sm" onClick={() => { setMode("list"); setEditPage(null); }}>Cancel</Button>
          <Button size="sm" onClick={savePage} disabled={saving}>
            {saving ? "Saving…" : <><Save size={13} className="mr-1" />Save Page</>}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
