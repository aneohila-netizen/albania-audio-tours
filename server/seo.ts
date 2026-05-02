/**
 * seo.ts — Server-side rendering for landing pages (/p/:slug)
 *
 * Phase 1 SEO Foundation:
 * - Real URLs: GET /p/:slug (no # hash) → fully pre-rendered HTML
 * - Per-page <title>, <meta description>, <meta keywords>
 * - hreflang alternate links for all 11 language variants
 * - JSON-LD schema: TouristAttraction + TourPackage
 * - Open Graph / Twitter Card tags
 * - GET /sitemap.xml → auto-generated from all published CMS pages + destination pages
 *
 * Landing pages are rendered as standalone HTML (not the React SPA) so Google,
 * Bing, and AI crawlers can index them without executing JavaScript.
 * They link back into the SPA (/#/) for the audio tour experience.
 */

import { type Express } from "express";
import { storage } from "./storage";

const SITE_URL = "https://albaniaaudiotours.com";
const AET_URL  = "https://albanianeagletours.com";

// 11 supported languages — Slovenian replaced with Russian
const LANGUAGES: { code: string; label: string; hreflangCode: string }[] = [
  { code: "en", label: "English",    hreflangCode: "en" },
  { code: "al", label: "Shqip",      hreflangCode: "sq" },   // ISO 639-1 for Albanian is sq
  { code: "de", label: "Deutsch",    hreflangCode: "de" },
  { code: "it", label: "Italiano",   hreflangCode: "it" },
  { code: "fr", label: "Français",   hreflangCode: "fr" },
  { code: "es", label: "Español",    hreflangCode: "es" },
  { code: "gr", label: "Ελληνικά",   hreflangCode: "el" },
  { code: "ru", label: "Русский",    hreflangCode: "ru" },
  { code: "ar", label: "العربية",    hreflangCode: "ar" },
  { code: "pt", label: "Português",  hreflangCode: "pt" },
  { code: "cn", label: "中文",        hreflangCode: "zh" },
];

// Direction per language (for <html dir="">)
const RTL_LANGS = new Set(["ar"]);

// ── Helper: escape HTML special characters ─────────────────────────────────
function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Helper: strip HTML tags for plain text use ─────────────────────────────
function stripHtml(s: string): string {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Build hreflang link tags ───────────────────────────────────────────────
function buildHreflang(slugBase: string, langs: string[]): string {
  // slugBase = "berat" → alternates are berat-en, berat-de, etc.
  // If the slug already has a lang suffix we strip it to get the base.
  const lines = langs.map(lang => {
    const langObj = LANGUAGES.find(l => l.code === lang);
    if (!langObj) return "";
    const url = `${SITE_URL}/p/${slugBase}-${lang}`;
    return `  <link rel="alternate" hreflang="${langObj.hreflangCode}" href="${esc(url)}" />`;
  });
  // x-default points to English
  lines.push(`  <link rel="alternate" hreflang="x-default" href="${esc(`${SITE_URL}/p/${slugBase}-en`)}" />`);
  return lines.filter(Boolean).join("\n");
}

// ── Build JSON-LD schema ───────────────────────────────────────────────────
function buildJsonLd(page: {
  title: string; seoDescription: string; coverImage?: string;
  slug: string; publishedAt?: string; seoKeywords?: string;
}): string {
  // Detect if this is a destination page (slug pattern: destination-langcode)
  const isDestPage = LANGUAGES.some(l => page.slug.endsWith(`-${l.code}`));

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": isDestPage ? "TouristAttraction" : "WebPage",
    "name": page.title,
    "description": stripHtml(page.seoDescription || ""),
    "url": `${SITE_URL}/p/${page.slug}`,
    "image": page.coverImage && !page.coverImage.startsWith("data:") ? page.coverImage : undefined,
    "inLanguage": "en",
    "publisher": {
      "@type": "TravelAgency",
      "name": "Albanian Eagle Tours",
      "url": AET_URL,
    },
  };

  if (page.publishedAt) {
    schema["datePublished"] = page.publishedAt;
  }

  // Add BreadcrumbList
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Albania Audio Tours", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": page.title, "item": `${SITE_URL}/p/${page.slug}` },
    ],
  };

  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>\n` +
         `  <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`;
}

// ── Render full HTML for a landing page ───────────────────────────────────
function renderLandingPage(page: {
  slug: string; title: string; excerpt: string; body: string;
  coverImage?: string; seoTitle?: string; seoDescription?: string;
  seoKeywords?: string; author?: string; publishedAt?: string;
  isPublished?: boolean;
}, langCode: string): string {

  const title     = esc(page.seoTitle || page.title);
  const desc      = esc(page.seoDescription || stripHtml(page.excerpt || "").slice(0, 160));
  const keywords  = esc(page.seoKeywords || "");
  const coverImg  = (page.coverImage && !page.coverImage.startsWith("data:")) ? page.coverImage : "";
  const canonical = `${SITE_URL}/p/${esc(page.slug)}`;
  const dir       = RTL_LANGS.has(langCode) ? "rtl" : "ltr";

  // Detect language variants from slug (e.g. "berat-en" → base "berat", langs all 11)
  const slugLangSuffix = LANGUAGES.find(l => page.slug.endsWith(`-${l.code}`));
  const slugBase = slugLangSuffix
    ? page.slug.slice(0, page.slug.length - slugLangSuffix.code.length - 1)
    : page.slug;
  const hasLangVariants = !!slugLangSuffix;
  const hreflangBlock = hasLangVariants
    ? buildHreflang(slugBase, LANGUAGES.map(l => l.code))
    : "";

  // Language switcher links
  const langSwitcher = hasLangVariants ? LANGUAGES.map(l => {
    const active = l.code === langCode;
    return `<a href="/p/${slugBase}-${l.code}" style="margin:0 4px;padding:4px 8px;border-radius:4px;font-size:12px;text-decoration:none;` +
           `background:${active ? "#c0392b" : "#f3f4f6"};color:${active ? "#fff" : "#333"};font-weight:${active ? "700" : "400"}">${l.label}</a>`;
  }).join("") : "";

  const pubDate = page.publishedAt
    ? new Date(page.publishedAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return `<!DOCTYPE html>
<html lang="${LANGUAGES.find(l => l.code === langCode)?.hreflangCode || "en"}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Primary SEO -->
  <title>${title}</title>
  <meta name="description" content="${desc}" />
  ${keywords ? `<meta name="keywords" content="${keywords}" />` : ""}
  <link rel="canonical" href="${canonical}" />

  <!-- hreflang alternates -->
  ${hreflangBlock}

  <!-- Open Graph -->
  <meta property="og:type"        content="article" />
  <meta property="og:title"       content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:url"         content="${canonical}" />
  <meta property="og:site_name"   content="Albania Audio Tours" />
  ${coverImg ? `<meta property="og:image" content="${esc(coverImg)}" />` : ""}

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${title}" />
  <meta name="twitter:description" content="${desc}" />
  ${coverImg ? `<meta name="twitter:image" content="${esc(coverImg)}" />` : ""}

  <!-- JSON-LD Structured Data -->
  ${buildJsonLd(page)}

  <!-- Fonts -->
  <link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,500,700&f[]=general-sans@400,500,600&display=swap" rel="stylesheet" />

  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'General Sans', Arial, sans-serif;
      font-size: 15px;
      line-height: 1.7;
      color: #1a1a1a;
      background: #fff;
    }
    .seo-header {
      background: #1a1a2e;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }
    .seo-header a.logo {
      font-family: 'Zodiak', serif;
      font-size: 18px;
      color: #fff;
      text-decoration: none;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .seo-header .cta-header {
      background: #c0392b;
      color: #fff;
      padding: 8px 18px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
    }
    .lang-bar {
      background: #f8f8f8;
      border-bottom: 1px solid #e5e7eb;
      padding: 8px 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }
    .lang-bar span {
      font-size: 11px;
      color: #888;
      margin-right: 6px;
    }
    .hero {
      width: 100%;
      max-height: 420px;
      object-fit: cover;
      display: block;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
      padding: 32px 20px 60px;
    }
    h1 {
      font-family: 'Zodiak', serif;
      font-size: clamp(22px, 4vw, 32px);
      font-weight: 700;
      line-height: 1.25;
      color: #0f172a;
      margin: 0 0 12px;
    }
    .excerpt {
      font-size: 16px;
      color: #555;
      margin: 0 0 8px;
      line-height: 1.6;
    }
    .meta {
      font-size: 12px;
      color: #999;
      margin-bottom: 28px;
    }
    .body-content {
      font-size: 15px;
      line-height: 1.75;
      color: #222;
    }
    .body-content h2 { font-size: 20px; color: #0f172a; margin-top: 32px; }
    .body-content h3 { font-size: 17px; color: #0f172a; margin-top: 24px; }
    .body-content a  { color: #c0392b; }
    .body-content ul, .body-content ol { padding-left: 20px; }
    .body-content img { max-width: 100%; border-radius: 8px; margin: 16px 0; }
    .cta-box {
      background: linear-gradient(135deg, #1a1a2e 0%, #c0392b 100%);
      border-radius: 12px;
      padding: 28px 24px;
      text-align: center;
      margin: 40px 0 20px;
      color: #fff;
    }
    .cta-box h2 {
      font-family: 'Zodiak', serif;
      font-size: 20px;
      margin: 0 0 8px;
      color: #fff;
    }
    .cta-box p  { font-size: 14px; opacity: 0.9; margin: 0 0 18px; }
    .cta-box a  {
      display: inline-block;
      background: #fff;
      color: #c0392b;
      font-weight: 700;
      padding: 11px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-size: 14px;
      margin: 4px;
    }
    .cta-box a.outline {
      background: transparent;
      color: #fff;
      border: 1px solid rgba(255,255,255,0.6);
    }
    .back-link {
      display: inline-block;
      font-size: 13px;
      color: #888;
      text-decoration: none;
      margin-bottom: 16px;
    }
    .back-link:hover { color: #c0392b; }
    footer {
      text-align: center;
      padding: 20px;
      font-size: 11px;
      color: #aaa;
      border-top: 1px solid #eee;
    }
    @media (max-width: 600px) {
      .seo-header { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <header class="seo-header">
    <a class="logo" href="${SITE_URL}/#/">🎧 Albania Audio Tours</a>
    <a class="cta-header" href="${AET_URL}/collections/all" target="_blank" rel="noopener">
      Book a Guided Tour →
    </a>
  </header>

  <!-- Language switcher -->
  ${langSwitcher ? `<div class="lang-bar"><span>🌐</span>${langSwitcher}</div>` : ""}

  <!-- Hero image -->
  ${coverImg ? `<img class="hero" src="${esc(coverImg)}" alt="${esc(page.title)}" loading="eager" fetchpriority="high" />` : ""}

  <!-- Main content -->
  <div class="container">
    <a class="back-link" href="${SITE_URL}/#/">← Back to Audio Tours</a>

    <h1>${esc(page.title)}</h1>
    ${page.excerpt ? `<p class="excerpt">${esc(stripHtml(page.excerpt))}</p>` : ""}
    ${pubDate || page.author ? `<p class="meta">${[page.author, pubDate].filter(Boolean).join(" · ")}</p>` : ""}

    <!-- Page body (trusted HTML from CMS) -->
    <div class="body-content">
      ${page.body || ""}
    </div>

    <!-- CTA Block -->
    <div class="cta-box">
      <h2>Ready to Explore Albania?</h2>
      <p>Listen to this destination's audio tour free — or book a private guided experience with a local expert.</p>
      <a href="${SITE_URL}/#/sites" target="_self">🎧 Open Audio Tour</a>
      <a href="${AET_URL}/collections/car-driver" target="_blank" rel="noopener" class="outline">Car &amp; Driver Tours</a>
    </div>
  </div>

  <!-- Footer -->
  <footer>
    <p>© ${new Date().getFullYear()} Albania Audio Tours · <a href="${SITE_URL}/#/">albaniaaudiotours.com</a> · Powered by <a href="${AET_URL}" target="_blank" rel="noopener">Albanian Eagle Tours</a></p>
    <p><a href="${SITE_URL}/sitemap.xml">Sitemap</a> · <a href="${SITE_URL}/#/terms">Terms</a> · <a href="${SITE_URL}/#/contact">Contact</a></p>
  </footer>

</body>
</html>`;
}

// ── Render 404 ─────────────────────────────────────────────────────────────
function render404(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Page Not Found — Albania Audio Tours</title>
  <meta name="robots" content="noindex"/></head><body style="font-family:sans-serif;text-align:center;padding:80px 20px">
  <h1>404 — Page Not Found</h1><p>This page doesn't exist or isn't published yet.</p>
  <a href="${SITE_URL}/#/" style="color:#c0392b">← Back to Albania Audio Tours</a></body></html>`;
}

// ── Main: register SEO routes on Express ──────────────────────────────────
export function registerSeoRoutes(app: Express): void {

  // ── /p/:slug — server-rendered landing page ──────────────────────────────
  app.get("/p/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      const page = await storage.getCmsPageBySlug(slug);

      if (!page || !page.isPublished) {
        return res.status(404).send(render404());
      }

      // Detect language from slug suffix (e.g. "berat-en" → "en")
      const langSuffix = LANGUAGES.find(l => slug.endsWith(`-${l.code}`));
      const langCode   = langSuffix?.code || "en";

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.send(renderLandingPage(page, langCode));
    } catch (err) {
      console.error("[seo] /p/:slug error:", err);
      res.status(500).send(render404());
    }
  });

  // ── /sitemap.xml — auto-generated XML sitemap ────────────────────────────
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const pages = await storage.getPublishedCmsPages();

      const now = new Date().toISOString().split("T")[0];

      // CMS landing pages
      const pageUrls = pages.map(p => `
  <url>
    <loc>${SITE_URL}/p/${esc(p.slug)}</loc>
    <lastmod>${p.updatedAt ? p.updatedAt.split("T")[0] : now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join("");

      // Static SPA routes
      const staticUrls = [
        { path: "/", priority: "1.0", freq: "weekly" },
        { path: "/#/sites", priority: "0.9", freq: "weekly" },
        { path: "/#/blog", priority: "0.7", freq: "weekly" },
        { path: "/#/subscriptions", priority: "0.8", freq: "monthly" },
        { path: "/#/contact", priority: "0.5", freq: "monthly" },
      ].map(r => `
  <url>
    <loc>${SITE_URL}${r.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${r.freq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join("");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${staticUrls}
${pageUrls}
</urlset>`;

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch (err) {
      console.error("[seo] /sitemap.xml error:", err);
      res.status(500).send("<?xml version='1.0'?><urlset/>");
    }
  });

  // ── /robots.txt ──────────────────────────────────────────────────────────
  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.send(
`User-agent: *
Allow: /
Allow: /p/
Disallow: /api/
Disallow: /admin

Sitemap: ${SITE_URL}/sitemap.xml`
    );
  });
}
