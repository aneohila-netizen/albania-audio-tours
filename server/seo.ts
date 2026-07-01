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

// Localised CTA text [heading, subtext, audio-btn, book-btn]
const CTA_HEADINGS: Record<string, [string, string, string, string]> = {   en: ["Ready to Explore Albania?",     "Listen to this destination's audio tour free — or book a private guided experience.",     "Open Audio Tour", "Book a Guided Tour"],   al: ["Eksploroni Shqiperine me ekspert vendor",     "Degjoni turin audio falas — ose rezervoni eksperience private me udherrefyes.",     "Hap Turneu Audio", "Rezervo nje Tur"],   de: ["Albanien entdecken — mit einem lokalen Experten",     "Kostenlose Audio-Tour anhoeren oder eine private gefuehrte Tour buchen.",     "Audio-Tour oeffnen", "Gefuehrte Tour buchen"],   it: ["Esplora l'Albania con un esperto locale",     "Ascolta la visita audio gratuita — o prenota un'esperienza con guida privata.",     "Apri Audio Tour", "Prenota un Tour"],   fr: ["Decouvrez l'Albanie avec un expert local",     "Ecoutez la visite audio gratuite — ou reservez une experience guidee privee.",     "Ouvrir l'Audio Tour", "Reserver un Tour"],   es: ["Explora Albania con un experto local",     "Escucha el audio tour gratuito — o reserva una experiencia guiada privada.",     "Abrir Audio Tour", "Reservar un Tour"],   gr: ["Eksploraate tin Albania",     "Akousteite tin xenagisi ihou dorean — e kleiste idiotiki xenagisi.",     "Anoichti Audio Tour", "Kleisteite Tour"],   ru: ["Otkroyte dlya sebya Albaniyu",     "Besplatnyy audiogid — ili zakazhite chastnuyu ekskursiyu s gidom.",     "Otkryt Audiotour", "Zabronirovat Tur"],   ar: ["Iktashif Albania maa khabir mahali",     "Istami ila al-jawla al-sawtiyya majjanan — aw ihriz jawla khassa maa murshid.",     "Fath al-Jawla al-Sawtiyya", "Ihjiz Jawla"],   pt: ["Explore a Albania com um especialista local",     "Ouca o audio tour gratuito — ou reserve uma experiencia com guia privado.",     "Abrir Audio Tour", "Reservar Tour"],   cn: ["Yu dangdi zhuanjia yiqi tansuo Aerbaoniya",     "Mienfei shoudeng yinpin daolan — huo yudong siren daoyou tiyan.",     "Dakai Yinpin Daolan", "Yudong Daoyou Xing"], };
  
// ── Helper: escape HTML special characters ─────────────────────────────────
function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Helper: strip HTML tags for plain text use ─────────────────────────────────────────
function stripHtml(s: string): string {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
// ── Helper: rewrite broken AET links in CMS page body HTML ─────────────────────────
function rewriteAetLinks(html: string): string {
  return (html || "")
    .replace(
      /https?:\/\/(?:www\.)?albanianeagletours\.com\/collections\/(?:albania-)?city-breaks(["'\s>?#])/gi,
      "https://albanianeagletours.com/collections/albania-city-breaks$1"
    )
    .replace(
      /https?:\/\/(?:www\.)?albanianeagletours\.com\/collections\/(?:albania-tours-with-)?car-(?:and-)?driver[^"'\s>?]*/gi,
      "https://albanianeagletours.com/collections/albania-tours-with-car-driver-included-popular"
    )
    .replace(
      /https?:\/\/(?:www\.)?albanianeagletours\.com\/(?:pages\/)?contact(?!\/us)(["'\s>?#])/gi,
      "https://albanianeagletours.com/pages/contact-us$1"
    )
    .replace(
      /https?:\/\/(?:www\.)?albanianeagletours\.com\/collections\/all(["'\s>?#])/gi,
      "https://albanianeagletours.com/collections/guided-tours$1"
    )
    .replace(
      /href="(https?:\/\/(?:www\.)?albanianeagletours\.com\/(?!collections\/albania-city-breaks|collections\/albania-tours-with-car-driver-included-popular|pages\/contact-us|collections\/guided-tours|products\/)[^"]*)"/gi,
      'href="https://albanianeagletours.com/"'
    );
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
// ── Extract FAQ items from <details>/<summary> HTML ────────────────────────
function extractFaqItems(html: string): Array<{q: string; a: string}> {
  const items: Array<{q: string; a: string}> = [];

  // Pattern 1: <details>/<summary> (standard HTML5 accordion)
  const detailsRe = /<details[^>]*>(.*?)<\/details>/gis;
  const summaryRe = /<summary[^>]*>(.*?)<\/summary>/is;
  let m: RegExpExecArray | null;
  while ((m = detailsRe.exec(html)) !== null) {
    const inner = m[1];
    const sumMatch = summaryRe.exec(inner);
    if (!sumMatch) continue;
    const q = stripHtml(sumMatch[1]).trim();
    const a = stripHtml(inner.replace(sumMatch[0], "")).trim();
    if (q && a) items.push({ q, a });
  }

  // Pattern 2: <h3>Question</h3><p>Answer</p> inside a section containing "FAQ"
  // Find the FAQ section boundary first
  const faqStart = html.search(/<[hH][23][^>]*>[^<]*(FAQ|Frequently|Questions)/i);
  if (faqStart >= 0 && items.length === 0) {
    const faqSection = html.slice(faqStart);
    // Match pairs of <h3>Q</h3><p>A</p>
    const pairRe = /<h3[^>]*>(.*?)<\/h3>\s*<p[^>]*>(.*?)<\/p>/gis;
    let pm: RegExpExecArray | null;
    while ((pm = pairRe.exec(faqSection)) !== null && items.length < 8) {
      const q = stripHtml(pm[1]).trim();
      const a = stripHtml(pm[2]).trim();
      if (q && a && q.length < 200) items.push({ q, a });
    }
  }

  return items;
}

function buildJsonLd(page: {
  title: string; seoDescription: string; coverImage?: string;
  slug: string; publishedAt?: string; seoKeywords?: string;
  body?: string; pageType?: string;
}): string {
  // Detect page type from slug and pageType field
  const isDestPage  = LANGUAGES.some(l => page.slug.endsWith(`-${l.code}`));
  const isBlogPost  = !isDestPage && (page.pageType === "blog" ||
    ["7-day","best-places","albania-vs","albania-travel","albanian","albania-unesco","albania-travel-guide"]
      .some(k => page.slug.startsWith(k)));

  const imgUrl = page.coverImage && !page.coverImage.startsWith("data:") ? page.coverImage : undefined;

  // ── Primary schema block ──────────────────────────────────────────────────
  let primarySchema: Record<string, unknown>;

  if (isBlogPost) {
    // BlogPosting — author, dates, publisher for Google article rich results
    primarySchema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": page.title,
      "description": stripHtml(page.seoDescription || ""),
      "url": `${SITE_URL}/p/${page.slug}`,
      "image": imgUrl,
      "datePublished": page.publishedAt || new Date().toISOString(),
      "dateModified":  page.publishedAt || new Date().toISOString(),
      "author": {
        "@type": "Organization",
        "name": "AlbaniaAudioTours",
        "url": SITE_URL,
      },
      "publisher": {
        "@type": "Organization",
        "name": "AlbaniaAudioTours",
        "url": SITE_URL,
        "logo": { "@type": "ImageObject", "url": `${SITE_URL}/icon-192.png` },
      },
      "mainEntityOfPage": `${SITE_URL}/p/${page.slug}`,
      "keywords": page.seoKeywords || "",
    };
  } else if (isDestPage) {
    // TouristAttraction — for Google travel/places cards
    primarySchema = {
      "@context": "https://schema.org",
      "@type": "TouristAttraction",
      "name": page.title,
      "description": stripHtml(page.seoDescription || ""),
      "url": `${SITE_URL}/p/${page.slug}`,
      "image": imgUrl,
      "inLanguage": "en",
      "touristType": "Cultural tourists, History enthusiasts, Adventure travelers",
      "availableLanguage": ["en","sq","de","it","fr","es","el","ru","ar","pt","zh"],
      "publisher": {
        "@type": "TravelAgency",
        "name": "Albanian Eagle Tours",
        "url": AET_URL,
      },
    };
  } else {
    primarySchema = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": page.title,
      "description": stripHtml(page.seoDescription || ""),
      "url": `${SITE_URL}/p/${page.slug}`,
      "image": imgUrl,
      "publisher": { "@type": "TravelAgency", "name": "Albanian Eagle Tours", "url": AET_URL },
    };
  }

  // ── BreadcrumbList ────────────────────────────────────────────────────────
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Albania Audio Tours", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": page.title, "item": `${SITE_URL}/p/${page.slug}` },
    ],
  };

  let output = `<script type="application/ld+json">${JSON.stringify(primarySchema)}</script>\n` +
               `  <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`;

  // ── FAQPage schema — only when page body has <details> FAQ items ──────────
  if (page.body) {
    const faqItems = extractFaqItems(page.body);
    if (faqItems.length >= 2) {
      const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqItems.map(item => ({
          "@type": "Question",
          "name": item.q,
          "acceptedAnswer": { "@type": "Answer", "text": item.a },
        })),
      };
      output += `\n  <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>`;
    }
  }

  return output;
}

// ── Render full HTML for a landing page ───────────────────────────────────
function renderLandingPage(page: {
  slug: string; title: string; excerpt: string; body: string;
  coverImage?: string; seoTitle?: string; seoDescription?: string;
  seoKeywords?: string; author?: string; publishedAt?: string;
  isPublished?: boolean; pageType?: string;
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

  // CTA text localised per language (was missing — caused 500 error)
  const cta = CTA_HEADINGS[langCode] || CTA_HEADINGS["en"];

  return `<!DOCTYPE html>
<html lang="${LANGUAGES.find(l => l.code === langCode)?.hreflangCode || "en"}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Primary SEO -->
  <title>${title}</title>
  <meta name="description" content="${desc}" />
  ${keywords ? `<meta name="keywords" content="${keywords}" />` : ""}

  <!-- Canonical: English version is always the canonical for each destination.
       Non-English pages point to the English version to consolidate ranking signals.
       hreflang tells Google which language each URL serves (handled separately). -->
  <link rel="canonical" href="${esc(`${SITE_URL}/p/${hasLangVariants ? slugBase + '-en' : page.slug}`)}" />

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
  ${buildJsonLd({ ...page, body: page.body, pageType: page.pageType })}

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
    <a class="cta-header" href="${AET_URL}/collections/guided-tours" target="_blank" rel="noopener">
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
      ${rewriteAetLinks(page.body || "")}
    </div>

    <!-- 3-Step Journey Block (P1-C) -->
    <div style="margin:40px 0;padding:28px 24px;background:#f8faff;border-radius:12px;border:1px solid #e2e8f0">
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin:0 0 16px">How it works</p>
      <div style="display:flex;gap:0;flex-wrap:wrap">
        <div style="flex:1;min-width:160px;padding:0 16px 0 0;border-right:1px solid #e2e8f0;margin-bottom:12px">
          <div style="font-size:24px;margin-bottom:6px">🎧</div>
          <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px">1. Listen Free</div>
          <div style="font-size:12px;color:#64748b;line-height:1.5">Open the audio tour on your phone as you explore — GPS triggers each story automatically.</div>
        </div>
        <div style="flex:1;min-width:160px;padding:0 16px;border-right:1px solid #e2e8f0;margin-bottom:12px">
          <div style="font-size:24px;margin-bottom:6px">🗺️</div>
          <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px">2. Follow the Map</div>
          <div style="font-size:12px;color:#64748b;line-height:1.5">Navigate between sites, earn points, and discover hidden details most visitors miss.</div>
        </div>
        <div style="flex:1;min-width:160px;padding:0 16px;margin-bottom:12px">
          <div style="font-size:24px;margin-bottom:6px">🦅</div>
          <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px">3. Book a Tour</div>
          <div style="font-size:12px;color:#64748b;line-height:1.5">Want a guide, driver, or full itinerary? Albanian Eagle Tours covers every destination here.</div>
        </div>
      </div>
    </div>

    <!-- Plan Your Visit Block -->     <div style="margin:40px 0;padding:28px 24px;background:#1a1a2e;border-radius:12px;text-align:center;color:#fff">       <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin:0 0 8px">Plan Your Visit to Albania</p>       <p style="font-size:13px;color:rgba(255,255,255,0.75);margin:0 0 20px">Choose how you want to explore</p>       <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">         <a href="https://albanianeagletours.com/collections/albania-city-breaks" target="_blank" rel="noopener" style="display:inline-block;background:#fff;color:#1a1a2e;font-weight:700;padding:11px 20px;border-radius:6px;text-decoration:none;font-size:13px">🏙️ City Breaks</a>         <a href="https://albanianeagletours.com/collections/albania-tours-with-car-driver-included-popular" target="_blank" rel="noopener" style="display:inline-block;background:#fff;color:#1a1a2e;font-weight:700;padding:11px 20px;border-radius:6px;text-decoration:none;font-size:13px">🚗 Car &amp; Driver</a>         <a href="https://albanianeagletours.com/pages/contact-us" target="_blank" rel="noopener" style="display:inline-block;background:transparent;color:#fff;font-weight:700;padding:11px 20px;border-radius:6px;text-decoration:none;font-size:13px;border:1px solid rgba(255,255,255,0.5)">💬 Ask an Expert</a>         <a href="https://albanianeagletours.com/collections/guided-tours" target="_blank" rel="noopener" style="display:inline-block;background:#c0392b;color:#fff;font-weight:700;padding:11px 20px;border-radius:6px;text-decoration:none;font-size:13px">🦅 Book a Guided Tour</a>       </div>     </div>     <!-- CTA Block -->
    <div class="cta-box">
      <h2>${cta[0]}</h2>
      <p>${cta[1]}</p>
      <a href="${SITE_URL}/#/sites/${hasLangVariants ? slugBase : ""}" target="_self">${cta[2]}</a>
      <a href="${AET_URL}/collections/guided-tours" target="_blank" rel="noopener" class="outline">${cta[3]}</a>
    </div>
  </div>

  <!-- Footer -->
  <footer>
    <p>© ${new Date().getFullYear()} Albania Audio Tours · <a href="${SITE_URL}/#/">albaniaaudiotours.com</a> · Powered by <a href="${AET_URL}" target="_blank" rel="noopener">Albanian Eagle Tours</a></p>
    <p><a href="${SITE_URL}/sitemap.xml">Sitemap</a> · <a href="${SITE_URL}/#/terms">Terms</a> · <a href="${AET_URL}/pages/contact-us">Contact</a></p>
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
// redeploy trigger 1777913272
