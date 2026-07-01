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
const CTA_HEADINGS: Record<string, [string, string, string, string]> = {
  en: ["Ready to Explore Albania?",
       "Listen to this destination's audio tour free \u2014 or book a private guided experience.",
       "Open Audio Tour", "Book a Guided Tour"],
  al: ["Eksploroni Shqip\u00ebrin\u00eb me ekspert\u00eb vendor\u00eb",
       "D\u00ebgjoni turin audio falas \u2014 ose rezervoni eksperienc\u00eb private me udh\u00ebrr\u00ebfyes.",
       "Hap Turneu Audio", "Rezervo nje Tur"],
  de: ["Albanien entdecken \u2014 mit einem lokalen Experten",
       "Kostenlose Audio-Tour anh\u00f6ren oder eine private gef\u00fchrte Tour buchen.",
       "Audio-Tour \u00f6ffnen", "Gef\u00fchrte Tour buchen"],
  it: ["Esplora l'Albania con un esperto locale",
       "Ascolta la visita audio gratuita \u2014 o prenota un'esperienza con guida privata.",
       "Apri Audio Tour", "Prenota un Tour"],
  fr: ["D\u00e9couvrez l'Albanie avec un expert local",
       "\u00c9coutez la visite audio gratuite \u2014 ou r\u00e9servez une exp\u00e9rience guid\u00e9e priv\u00e9e.",
       "Ouvrir l'Audio Tour", "R\u00e9server un Tour"],
  es: ["Explora Albania con un experto local",
       "Escucha el audio tour gratuito \u2014 o reserva una experiencia guiada privada.",
       "Abrir Audio Tour", "Reservar un Tour"],
  gr: ["\u0395\u03be\u03b5\u03c1\u03b5\u03c5\u03bd\u03ae\u03c3\u03c4\u03b5 \u03c4\u03b7\u03bd \u0391\u03bb\u03b2\u03b1\u03bd\u03af\u03b1 \u03bc\u03b5 \u03ad\u03bd\u03b1\u03bd \u03c4\u03bf\u03c0\u03b9\u03ba\u03cc \u03b5\u03bc\u03c0\u03b5\u03b9\u03c1\u03bf\u03b3\u03bd\u03ce\u03bc\u03bf\u03bd\u03b1",
       "\u0391\u03ba\u03bf\u03cd\u03c3\u03c4\u03b5 \u03b4\u03c9\u03c1\u03b5\u03ac\u03bd \u03be\u03b5\u03bd\u03ac\u03b3\u03b7\u03c3\u03b7 \u03ae\u03c7\u03bf\u03c5 \u2014 \u03ae \u03ba\u03bb\u03b5\u03af\u03c3\u03c4\u03b5 \u03b9\u03b4\u03b9\u03c9\u03c4\u03b9\u03ba\u03ae \u03be\u03b5\u03bd\u03ac\u03b3\u03b7\u03c3\u03b7.",
       "\u0391\u03bd\u03bf\u03b9\u03c7\u03c4\u03ae Audio Tour", "\u039a\u03bb\u03b5\u03af\u03c3\u03c4\u03b5 \u03a4\u03bf\u03c5\u03c1"],
  ru: ["\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0434\u043b\u044f \u0441\u0435\u0431\u044f \u0410\u043b\u0431\u0430\u043d\u0438\u044e",
       "\u0411\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u044b\u0439 \u0430\u0443\u0434\u0438\u043e\u0433\u0438\u0434 \u2014 \u0438\u043b\u0438 \u0437\u0430\u043a\u0430\u0436\u0438\u0442\u0435 \u0447\u0430\u0441\u0442\u043d\u0443\u044e \u044d\u043a\u0441\u043a\u0443\u0440\u0441\u0438\u044e \u0441 \u0433\u0438\u0434\u043e\u043c.",
       "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0410\u0443\u0434\u0438\u043e\u0442\u0443\u0440", "\u0417\u0430\u0431\u0440\u043e\u043d\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0422\u0443\u0440"],
  ar: ["\u0627\u0643\u062a\u0634\u0641 \u0623\u0644\u0628\u0627\u0646\u064a\u0627 \u0645\u0639 \u062e\u0628\u064a\u0631 \u0645\u062d\u0644\u064a",
       "\u0627\u0633\u062a\u0645\u0639 \u0625\u0644\u0649 \u0627\u0644\u062c\u0648\u0644\u0629 \u0627\u0644\u0635\u0648\u062a\u064a\u0629 \u0645\u062c\u0627\u0646\u064b\u0627 \u2014 \u0623\u0648 \u0627\u062d\u062c\u0632 \u062c\u0648\u0644\u0629 \u062e\u0627\u0635\u0629 \u0645\u0639 \u0645\u0631\u0634\u062f.",
       "\u0641\u062a\u062d \u0627\u0644\u062c\u0648\u0644\u0629 \u0627\u0644\u0635\u0648\u062a\u064a\u0629", "\u0627\u062d\u062c\u0632 \u062c\u0648\u0644\u0629"],
  pt: ["Explore a Alb\u00e2nia com um especialista local",
       "Ou\u00e7a o audio tour gratuito \u2014 ou reserve uma experi\u00eancia com guia privado.",
       "Abrir Audio Tour", "Reservar Tour"],
  cn: ["\u4e0e\u5f53\u5730\u4e13\u5bb6\u4e00\u8d77\u63a2\u7d22\u963f\u5c14\u5df4\u5c3c\u4e9a",
       "\u514d\u8d39\u6536\u542c\u97f3\u9891\u5bfc\u89c8\u2014\u2014\u6216\u9884\u8ba2\u79c1\u4eba\u5bfc\u6e38\u4f53\u9a8c\u3002",
       "\u6253\u5f00\u97f3\u9891\u5bfc\u89c8", "\u9884\u8ba2\u5bfc\u6e38\u884c"],
};

// ── Helper: escape HTML special characters ─────────────────────────────────
function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Helper: strip HTML tags for plain text use ─────────────────────────────
// — Helper: rewrite broken AET links in CMS page body HTML function rewriteAetLinks(html: string): string {   return (html || "")     // City Breaks: /collections/albania-city-breaks -> /collections/albania-city-breaks     .replace(       /https?:\/\/(?:www\.)?albanianeagletours\.com\/collections\/(?:albania-)?city-breaks(["'\s>?#])/gi,       "https://albanianeagletours.com/collections/albania-city-breaks$1"     )     // Car & Driver: /collections/albania-tours-with-car-driver-included-popular -> /collections/albania-tours-with-car-driver-included-popular     .replace(       /https?:\/\/(?:www\.)?albanianeagletours\.com\/collections\/(?:albania-tours-with-)?car-(?:and-)?driver[^"'\s>]*/gi,       "https://albanianeagletours.com/collections/albania-tours-with-car-driver-included-popular"     )     // Contact: /contact or /pages/contact-us (not /pages/contact-us) -> /pages/contact-us     .replace(       /https?:\/\/(?:www\.)?albanianeagletours\.com\/(?:pages\/)?contact(?!\/us)(["'\s>?#])/gi,       "https://albanianeagletours.com/pages/contact-us$1"     )     // All tours: /collections/all -> /collections/guided-tours     .replace(       /https?:\/\/(?:www\.)?albanianeagletours\.com\/collections\/all(["'\s>?#])/gi,       "https://albanianeagletours.com/collections/guided-tours$1"     )     // Fallback: any remaining AET href not matching a known working path -> homepage     .replace(       /href="(https?:\/\/(?:www\.)?albanianeagletours\.com\/(?!collections\/albania-city-breaks|collections\/albania-tours-with-car-driver-included-popular|pages\/contact-us|collections\/guided-tours|products\/)[^"]*)"/gi,       'href="https://albanianeagletours.com/"'     ); }  function stripHtml(s: string): string {
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

    <!-- CTA Block -->
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
