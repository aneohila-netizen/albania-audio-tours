/**
 * AdminCmsManager — full CMS for managing pages from the admin panel.
 * Handles: footer info pages (contact/terms/refund), blog posts, SEO landing pages.
 * Uses a textarea-based rich HTML editor with toolbar shortcuts.
 */

import { useState, useRef } from "react";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, ArrowLeft, Save, Globe,
  FileText, BookOpen, Megaphone, LayoutDashboard, ExternalLink,
  Tag, AlignLeft, Image as ImageIcon, Search, CheckCircle2,
  X, ChevronDown, ChevronUp, AlertTriangle, Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  system: { label: "System Page", icon: LayoutDashboard, color: "bg-slate-100 text-slate-700", desc: "Core pages like Contact, Terms, Refund Policy" },
  info:   { label: "Info Page",   icon: FileText,        color: "bg-blue-100 text-blue-700",  desc: "General information pages" },
  blog:   { label: "Blog Post",   icon: BookOpen,        color: "bg-green-100 text-green-700", desc: "Travel stories, tips, destination guides" },
  landing:{ label: "Landing Page",icon: Megaphone,       color: "bg-amber-100 text-amber-700", desc: "SEO-optimised pages targeting specific keywords" },
};

// ─── Toolbar for the HTML editor ──────────────────────────────────────────────
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
      {btn("IMG","Image",      '<img src="" alt="" style="max-width:100%;border-radius:8px;" />', "")}
      {btn("SECTION", "Section wrap", "<section>\n", "\n</section>")}
    </div>
  );
}

// ─── Preview renderer ─────────────────────────────────────────────────────────
function HtmlPreview({ html }: { html: string }) {
  if (!html.trim()) {
    return <p className="text-sm text-muted-foreground italic">No content yet — start writing in the editor.</p>;
  }
  return (
    <div
      className="prose prose-sm max-w-none text-sm text-foreground"
      style={{ lineHeight: 1.7 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ─── Blank page form ──────────────────────────────────────────────────────────
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
  const token = getAdminToken();

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // ── Load pages ──────────────────────────────────────────────────────────────
  async function loadPages() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${RAILWAY_URL}/api/admin/cms/pages`, { headers });
      if (!res.ok) throw new Error(await res.text());
      setPages(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Load on mount (when this tab is first shown)
  const [loaded, setLoaded] = useState(false);
  if (!loaded) { setLoaded(true); loadPages(); }

  // ── Save (create or update) ─────────────────────────────────────────────────
  async function savePage() {
    if (!editPage) return;
    if (!editPage.title.trim()) { setError("Title is required."); return; }
    if (!editPage.slug.trim()) { setError("URL slug is required."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const isNew = !editPage.id;
      const url = isNew
        ? `${RAILWAY_URL}/api/admin/cms/pages`
        : `${RAILWAY_URL}/api/admin/cms/pages/${editPage.id}`;
      const method = isNew ? "POST" : "PUT";
      const payload = { ...editPage };
      if (payload.isPublished && !payload.publishedAt) {
        payload.publishedAt = new Date().toISOString();
      }
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      const saved: CmsPage = await res.json();
      if (isNew) {
        setPages(prev => [saved, ...prev]);
      } else {
        setPages(prev => prev.map(p => p.id === saved.id ? saved : p));
      }
      setSuccess(`"${saved.title}" saved successfully.`);
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
        headers: { ...headers, "x-confirm-delete": "yes" },
      });
      if (!res.ok) throw new Error(await res.text());
      setPages(prev => prev.filter(p => p.id !== id));
      setDeletingId(null);
    } catch (e: any) {
      setError(e.message); setDeletingId(null);
    }
  }

  // ── Toggle publish ──────────────────────────────────────────────────────────
  async function togglePublish(page: CmsPage) {
    const updated = {
      ...page,
      isPublished: !page.isPublished,
      publishedAt: !page.isPublished ? new Date().toISOString() : page.publishedAt,
    };
    try {
      const res = await fetch(`${RAILWAY_URL}/api/admin/cms/pages/${page.id}`, {
        method: "PUT", headers,
        body: JSON.stringify({ isPublished: updated.isPublished, publishedAt: updated.publishedAt }),
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
    const end = ta.selectionEnd;
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

  // ── PAGE: List ──────────────────────────────────────────────────────────────
  if (mode === "list") {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">Page Manager</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage footer pages, blog posts, SEO landing pages
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => { setEditPage(blankPage()); setMode("new"); setPreviewMode(false); setSeoOpen(false); }}
          >
            <Plus size={14} className="mr-1" /> New Page
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

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
              {type === "all" ? `All (${pages.length})` : `${PAGE_TYPE_LABELS[type]?.label} (${pages.filter(p => p.pageType === type).length})`}
            </button>
          ))}
        </div>

        {/* Page list */}
        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-8">Loading pages…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            No pages yet. Click <strong>New Page</strong> to create your first one.
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
                        : <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">Draft</span>
                      }
                      {page.showInFooter && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Footer</span>}
                      {page.showInBlog && <span className="text-xs px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">Blog</span>}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">/{page.slug}</span>
                      <a
                        href={`${RAILWAY_URL}/#/p/${page.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:opacity-70 transition-opacity"
                        title="View page"
                      >
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    {page.excerpt && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{page.excerpt}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      title={page.isPublished ? "Unpublish" : "Publish"}
                      onClick={() => togglePublish(page)}
                    >
                      {page.isPublished ? <Eye size={13} /> : <EyeOff size={13} />}
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      title="Edit"
                      onClick={() => { setEditPage({ ...page }); setMode("edit"); setPreviewMode(false); setSeoOpen(false); setError(""); setSuccess(""); }}
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600"
                      title="Delete"
                      onClick={() => { if (confirm(`Delete "${page.title}"? This cannot be undone.`)) deletePage(page.id); }}
                      disabled={deletingId === page.id}
                    >
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

  // ── PAGE: Edit / New ────────────────────────────────────────────────────────
  if ((mode === "edit" || mode === "new") && editPage) {
    return (
      <div className="space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => { setMode("list"); setEditPage(null); setError(""); setSuccess(""); }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <h2 className="font-bold text-sm flex-1 text-center">
            {mode === "new" ? "New Page" : `Editing: ${editPage.title || "Untitled"}`}
          </h2>
          <Button size="sm" onClick={savePage} disabled={saving}>
            {saving ? <><div className="w-3 h-3 border border-t-transparent rounded-full animate-spin mr-1" />Saving…</> : <><Save size={13} className="mr-1" />Save</>}
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

        {/* ── Page meta ── */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm">Page Details</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* Type */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Page Type</label>
              <Select
                value={editPage.pageType}
                onValueChange={v => setEditPage(p => p ? { ...p, pageType: v } : p)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System Page (Contact, Terms, Refund…)</SelectItem>
                  <SelectItem value="info">Info Page</SelectItem>
                  <SelectItem value="blog">Blog Post</SelectItem>
                  <SelectItem value="landing">SEO Landing Page</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {PAGE_TYPE_LABELS[editPage.pageType]?.desc}
              </p>
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
                URL Slug *
                <span className="ml-1 text-muted-foreground font-normal">(live at /#/p/slug)</span>
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
              {/* Special slugs for system pages */}
              {editPage.pageType === "system" && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {["contact", "terms", "refund-policy"].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditPage(p => p ? { ...p, slug: s } : p)}
                      className="text-xs px-2 py-0.5 rounded border border-border bg-muted hover:bg-muted/80 font-mono"
                    >
                      {s}
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground self-center">← Use these to override footer pages</span>
                </div>
              )}
            </div>

            {/* Excerpt */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Excerpt / Subtitle
                <span className="ml-1 text-muted-foreground font-normal">(shows on blog cards)</span>
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
                <Input
                  value={editPage.author}
                  onChange={e => setEditPage(p => p ? { ...p, author: e.target.value } : p)}
                  placeholder="AlbaTour"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Sort Order</label>
                <Input
                  type="number"
                  value={editPage.sortOrder}
                  onChange={e => setEditPage(p => p ? { ...p, sortOrder: parseInt(e.target.value) || 0 } : p)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-3 pt-1">
              {[
                { key: "isPublished",  label: "Published",       color: "text-green-600" },
                { key: "showInFooter", label: "Show in Footer",   color: "text-purple-600" },
                { key: "showInBlog",   label: "Show in Blog",     color: "text-teal-600" },
              ].map(({ key, label, color }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setEditPage(p => p ? { ...p, [key]: !(p as any)[key] } : p)}
                    className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${
                      (editPage as any)[key] ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                      (editPage as any)[key] ? "translate-x-4" : "translate-x-0.5"
                    }`} />
                  </div>
                  <span className={`text-xs font-medium ${(editPage as any)[key] ? color : "text-muted-foreground"}`}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Body editor ── */}
        <Card>
          <CardHeader className="pb-0 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Content (HTML)</CardTitle>
              <button
                type="button"
                onClick={() => setPreviewMode(v => !v)}
                className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {previewMode ? <><Pencil size={11} /> Edit</> : <><Eye size={11} /> Preview</>}
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
                  placeholder="<h2>Welcome</h2><p>Write your page content here in HTML…</p>"
                  className="font-mono text-xs min-h-[280px] rounded-t-none border-t-0 resize-y"
                />
              </>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Write standard HTML. Use the toolbar above for quick formatting. Toggle Preview to check the result.
            </p>
          </CardContent>
        </Card>

        {/* ── SEO fields (collapsible) ── */}
        <Card>
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3"
            onClick={() => setSeoOpen(v => !v)}
          >
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
                  SEO Title
                  <span className="ml-1 font-normal">(what appears in Google search results)</span>
                </label>
                <Input
                  value={editPage.seoTitle}
                  onChange={e => setEditPage(p => p ? { ...p, seoTitle: e.target.value } : p)}
                  placeholder="Best Audio Tours in Berat, Albania | AlbaTour"
                  className="h-8 text-sm"
                />
                <p className="text-xs text-muted-foreground mt-0.5">
                  Keep under 60 characters. Include your main keyword + brand name.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  SEO Description
                  <span className="ml-1 font-normal">(the snippet shown under the title in Google)</span>
                </label>
                <Textarea
                  value={editPage.seoDescription}
                  onChange={e => setEditPage(p => p ? { ...p, seoDescription: e.target.value } : p)}
                  placeholder="Discover Berat's UNESCO heritage with a free self-guided audio tour. Walk the ancient streets, hear the history, explore at your own pace."
                  className="text-sm min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground mt-0.5">
                  Keep under 160 characters. Make it compelling — this is your ad copy to Google users.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Keywords
                  <span className="ml-1 font-normal">(comma-separated)</span>
                </label>
                <Input
                  value={editPage.seoKeywords}
                  onChange={e => setEditPage(p => p ? { ...p, seoKeywords: e.target.value } : p)}
                  placeholder="audio tour Albania, self-guided Berat, things to do Albania"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Cover Image URL
                  <span className="ml-1 font-normal">(for blog cards and social sharing)</span>
                </label>
                <Input
                  value={editPage.coverImage}
                  onChange={e => setEditPage(p => p ? { ...p, coverImage: e.target.value } : p)}
                  placeholder="https://… or leave empty"
                  className="h-8 text-sm"
                />
              </div>

              {/* SEO tips */}
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1">
                <p className="text-xs font-semibold text-amber-800">SEO Tips for AlbaTour</p>
                <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                  <li>Target one specific keyword per landing page (e.g. "audio tour Tirana")</li>
                  <li>Use the keyword naturally in the H1 title and first paragraph</li>
                  <li>Blog posts rank well for "best things to do in [city]" searches</li>
                  <li>Internal links between pages help Google understand your site structure</li>
                  <li>Publish date matters — older articles can outrank newer ones if content is better</li>
                </ul>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Bottom save */}
        <div className="flex justify-end gap-2 pb-4">
          <Button variant="outline" size="sm" onClick={() => { setMode("list"); setEditPage(null); }}>
            Cancel
          </Button>
          <Button size="sm" onClick={savePage} disabled={saving}>
            {saving ? "Saving…" : <><Save size={13} className="mr-1" />Save Page</>}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
