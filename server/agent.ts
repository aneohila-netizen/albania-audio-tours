/**
 * agent.ts — AI-agent readiness layer (Cloudflare "Agent Readiness" / isitagentready.com)
 *
 * Everything here is READ-ONLY and exposes only content that is already public on the site
 * (published CMS pages, destinations, attractions, published walking itineraries).
 * Nothing under /api/admin is referenced, advertised or reachable from these routes.
 *
 *  - Markdown for Agents:   GET / or /p/:slug with "Accept: text/markdown"  → text/markdown
 *                           GET /p/:slug.md                                  → text/markdown
 *  - Link headers (RFC 8288) on the homepage and /p/* pages
 *  - /llms.txt, /llms-full.txt                       (llmstxt.org)
 *  - /.well-known/api-catalog                         (RFC 9727, application/linkset+json)
 *  - /openapi.json                                    (OpenAPI 3.1, public read-only endpoints)
 *  - /mcp                                             (MCP Streamable HTTP, stateless, read-only tools)
 *  - /.well-known/mcp/server-card.json                (MCP Server Card, SEP-1649)
 *  - /.well-known/agent-skills/index.json             (Agent Skills Discovery v0.2.0)
 *  - /.well-known/ai-catalog.json                     (ARD / ai-catalog manifest)
 */

import type { Express, Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { storage } from "./storage";

const SITE = "https://albaniaaudiotours.com";
const SERVER_VERSION = "1.0.0";
const MCP_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

// ── Small helpers ──────────────────────────────────────────────────────────────
const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&apos;": "'",
  "&nbsp;": " ", "&ndash;": "–", "&mdash;": "—", "&hellip;": "…", "&rsquo;": "’", "&lsquo;": "‘",
  "&rdquo;": "”", "&ldquo;": "“", "&euro;": "€",
};
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, m => ENTITIES[m.toLowerCase()] ?? m);
}
function plain(s: unknown): string {
  return decodeEntities(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}
function snippet(s: unknown, max = 280): string {
  const t = plain(s);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40)) + "…";
}
function absUrl(u: string): string {
  if (!u) return u;
  if (/^https?:\/\//i.test(u) || u.startsWith("mailto:") || u.startsWith("tel:")) return u;
  if (u.startsWith("/")) return SITE + u;
  return u;
}
function tokenEstimate(s: string): number { return Math.ceil(s.length / 4); }

/** Convert the site's clean CMS HTML (p, h2/h3, ul/ol/li, strong, em, a, table, img) to Markdown. */
export function htmlToMarkdown(html: string): string {
  let h = String(html || "");
  h = h.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|noscript|iframe)[\s\S]*?<\/\1>/gi, "");

  // Tables first (keep simple pipe tables)
  h = h.replace(/<table[\s\S]*?<\/table>/gi, (tbl) => {
    const rows = (tbl.match(/<tr[\s\S]*?<\/tr>/gi) || []).map(r =>
      (r.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) || []).map(c => plain(c.replace(/^<t[hd][^>]*>|<\/t[hd]>$/gi, "")).replace(/\|/g, "\\|")),
    ).filter(r => r.length);
    if (!rows.length) return "";
    const width = Math.max(...rows.map(r => r.length));
    const line = (r: string[]) => "| " + Array.from({ length: width }, (_, i) => r[i] ?? "").join(" | ") + " |";
    return "\n\n" + [line(rows[0]), "| " + Array(width).fill("---").join(" | ") + " |", ...rows.slice(1).map(line)].join("\n") + "\n\n";
  });

  h = h.replace(/<img[^>]*>/gi, (tag) => {
    const src = /src=["']([^"']+)["']/i.exec(tag)?.[1] || "";
    const alt = /alt=["']([^"']*)["']/i.exec(tag)?.[1] || "";
    if (!src || src.startsWith("data:")) return "";
    return `![${decodeEntities(alt)}](${absUrl(src)})`;
  });
  h = h.replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
    const t = plain(text);
    return t ? `[${t}](${absUrl(decodeEntities(href))})` : "";
  });
  h = h.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, lvl, text) => `\n\n${"#".repeat(Number(lvl))} ${plain(text)}\n\n`);
  h = h.replace(/<(strong|b)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (_m, _t, _a, text) => `**${text.trim()}**`);
  h = h.replace(/<(em|i)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (_m, _t, _a, text) => `*${text.trim()}*`);
  h = h.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, text) => `\n- ${text.replace(/<\/?p[^>]*>/gi, " ").trim()}`);
  h = h.replace(/<\/(ul|ol)>/gi, "\n\n").replace(/<(ul|ol)[^>]*>/gi, "\n");
  h = h.replace(/<br\s*\/?>/gi, "\n");
  h = h.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, text) => "\n\n> " + plain(text) + "\n\n");
  h = h.replace(/<\/p>/gi, "\n\n").replace(/<p[^>]*>/gi, "");
  h = h.replace(/<\/?(div|section|article|header|footer|span|figure|figcaption|main)[^>]*>/gi, "\n");
  h = h.replace(/<[^>]+>/g, "");
  h = decodeEntities(h);
  return h.split("\n").map(l => l.replace(/[ \t]+/g, " ").replace(/^ (?=\S)/, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── Public data (cached 5 minutes) ─────────────────────────────────────────────
type Dest = {
  slug: string; name: string; nameAl: string; region: string; summary: string; description: string;
  funFact: string; lat: number | null; lng: number | null; guideUrl: string | null; audioTourUrl: string;
  attractionCount: number; premium: boolean;
};
type Attr = {
  slug: string; destinationSlug: string; destination: string; name: string; nameAl: string; category: string;
  summary: string; description: string; funFact: string; lat: number | null; lng: number | null;
  visitDuration: number | null; audioTourUrl: string; premium: boolean;
};
type PageInfo = { slug: string; title: string; excerpt: string; pageType: string; publishedAt: string; url: string };

type DataSet = { at: number; dests: Dest[]; attrs: Attr[]; pages: PageInfo[] };
let cache: DataSet | null = null;
let inflight: Promise<DataSet> | null = null;

async function loadData(): Promise<DataSet> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache;
  if (inflight) return inflight;
  inflight = (async (): Promise<DataSet> => {
    const [sites, attractions, pages] = await Promise.all([
      storage.getAllSites(), storage.getAllAttractions(), storage.getPublishedCmsPages(),
    ]);
    const pageSlugs = new Set(pages.map((p: any) => p.slug));
    const siteName = new Map<string, string>();
    for (const s of sites as any[]) siteName.set(s.slug, plain(s.nameEn).split("\n")[0] || s.slug);
    const counts = new Map<string, number>();
    for (const a of attractions as any[]) counts.set(a.destinationSlug, (counts.get(a.destinationSlug) || 0) + 1);

    const dests: Dest[] = (sites as any[]).map(s => ({
      slug: s.slug,
      name: siteName.get(s.slug)!,
      nameAl: plain(s.nameAl),
      region: s.region || "",
      summary: snippet(s.descEn, 300),
      description: plain(s.descEn),
      funFact: plain(s.funFactEn),
      lat: s.lat ?? null, lng: s.lng ?? null,
      guideUrl: pageSlugs.has(`${s.slug}-en`) ? `${SITE}/p/${s.slug}-en` : null,
      audioTourUrl: `${SITE}/#/sites/${s.slug}`,
      attractionCount: counts.get(s.slug) || 0,
      premium: !!s.isLocked,
    }));
    const attrs: Attr[] = (attractions as any[]).map(a => ({
      slug: a.slug,
      destinationSlug: a.destinationSlug,
      destination: siteName.get(a.destinationSlug) || a.destinationSlug,
      name: plain(a.nameEn),
      nameAl: plain(a.nameAl),
      category: a.category || "",
      summary: snippet(a.descEn, 240),
      description: plain(a.descEn),
      funFact: plain(a.funFactEn),
      lat: a.lat ?? null, lng: a.lng ?? null,
      visitDuration: a.visitDuration ?? null,
      audioTourUrl: `${SITE}/#/sites/${a.destinationSlug}/${a.slug}`,
      premium: !!a.isLocked,
    }));
    const pageInfos: PageInfo[] = (pages as any[]).map(p => ({
      slug: p.slug, title: plain(p.title), excerpt: plain(p.excerpt || p.seoDescription || ""),
      pageType: p.pageType || "info", publishedAt: p.publishedAt || "", url: `${SITE}/p/${p.slug}`,
    }));
    const fresh: DataSet = { at: Date.now(), dests, attrs, pages: pageInfos };
    cache = fresh;
    return fresh;
  })();
  try { return await inflight; } finally { inflight = null; }
}

function blogPosts(pages: PageInfo[]) {
  return pages.filter(p => p.pageType === "blog").sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
}
function englishGuides(pages: PageInfo[]) {
  return pages.filter(p => p.pageType !== "blog" && p.slug.endsWith("-en"));
}

// ── Markdown documents ─────────────────────────────────────────────────────────
async function homepageMarkdown(): Promise<string> {
  const { dests, attrs, pages } = await loadData();
  const posts = blogPosts(pages).slice(0, 15);
  return [
    "# Albania Audio Tours — Self-Guided Audio Tours of Albania",
    "",
    `> Self-guided, GPS-triggered audio tours for ${dests.length} destinations and ${attrs.length} attractions across Albania (and Prizren, Kosovo), in 11 languages. Created by Albanian Eagle Tours, a local travel company in Tirana.`,
    "",
    "## What you can do here",
    "- Listen to audio stories at each site, on your phone, at your own pace (open the web app: " + SITE + "/).",
    "- Read destination guides and a travel blog written from the Albanian point of view.",
    "- Ask the author a question: " + SITE + "/p/contact",
    "",
    "## Destinations",
    ...dests.map(d => `- [${d.name}](${d.guideUrl || d.audioTourUrl})${d.region ? ` (${d.region})` : ""}: ${d.summary}`),
    "",
    "## Latest travel articles",
    ...posts.map(p => `- [${p.title}](${p.url})${p.excerpt ? `: ${p.excerpt}` : ""}`),
    "",
    "## For AI agents",
    `- Site index for LLMs: ${SITE}/llms.txt (full text: ${SITE}/llms-full.txt)`,
    `- Read-only MCP server (Streamable HTTP): ${SITE}/mcp`,
    `- OpenAPI description of the public read-only API: ${SITE}/openapi.json`,
    `- Any page as Markdown: send "Accept: text/markdown" or append ".md" to a /p/ URL.`,
    "",
  ].join("\n");
}

async function pageMarkdown(slug: string): Promise<string | null> {
  const page: any = await storage.getCmsPageBySlug(slug);
  if (!page || !page.isPublished) return null;
  const parts = [`# ${plain(page.title)}`, ""];
  if (page.excerpt) parts.push(`> ${plain(page.excerpt)}`, "");
  const meta = [`URL: ${SITE}/p/${page.slug}`];
  if (page.author) meta.push(`Author: ${plain(page.author)}`);
  if (page.publishedAt) meta.push(`Published: ${String(page.publishedAt).slice(0, 10)}`);
  if (page.updatedAt) meta.push(`Updated: ${String(page.updatedAt).slice(0, 10)}`);
  parts.push(meta.join("  \n"), "");
  if (page.coverImage && !String(page.coverImage).startsWith("data:")) parts.push(`![${plain(page.title)}](${page.coverImage})`, "");
  let body = htmlToMarkdown(page.body || "");
  if (!body) {
    // Destination landing pages are rendered from destination data when the CMS body is empty
    const base = slug.replace(/-[a-z]{2}$/, "");
    const { dests, attrs } = await loadData();
    const d = dests.find(x => x.slug === base);
    if (d) {
      body = [d.description, d.funFact ? `**Fun fact:** ${d.funFact}` : "", "## Attractions",
        ...attrs.filter(a => a.destinationSlug === d.slug).map(a => `- [${a.name}](${a.audioTourUrl}): ${a.summary}`),
        "", `Open the audio tour: ${d.audioTourUrl}`].filter(Boolean).join("\n\n");
    }
  }
  parts.push(body, "");
  return parts.join("\n");
}

async function llmsTxt(): Promise<string> {
  const { dests, pages } = await loadData();
  const guides = englishGuides(pages);
  const posts = blogPosts(pages);
  const info = pages.filter(p => p.pageType !== "blog" && !p.slug.match(/-[a-z]{2}$/));
  return [
    "# Albania Audio Tours",
    "",
    `> Self-guided, GPS-triggered audio tours of Albania: ${dests.length} destinations, 11 languages, plus destination guides and a travel blog written by a local author (A Hila) from the Albanian point of view. Operated by Albanian Eagle Tours, Tirana.`,
    "",
    "Every page listed below is also available as Markdown: append `.md` to the URL or send `Accept: text/markdown`.",
    "",
    "## Destination guides",
    ...guides.map(p => `- [${p.title}](${p.url}.md)${p.excerpt ? `: ${p.excerpt}` : ""}`),
    "",
    "## Travel blog",
    ...posts.map(p => `- [${p.title}](${p.url}.md)${p.excerpt ? `: ${p.excerpt}` : ""}`),
    "",
    "## Agent access (read-only)",
    `- [MCP server](${SITE}/mcp): Streamable HTTP; tools to list destinations, search attractions, find nearby sites and read guides. Card: ${SITE}/.well-known/mcp/server-card.json`,
    `- [OpenAPI](${SITE}/openapi.json): public read-only JSON endpoints for destinations, attractions, walking routes and articles`,
    `- [Agent skill](${SITE}/.well-known/agent-skills/albania-audio-tours/SKILL.md): how to plan an Albania visit with this site`,
    "",
    "## Optional",
    ...info.map(p => `- [${p.title}](${p.url}.md)`),
    `- [Full text for LLMs](${SITE}/llms-full.txt)`,
    `- [Contact the author](${SITE}/p/contact)`,
    "",
  ].join("\n");
}

async function llmsFullTxt(): Promise<string> {
  const { dests, attrs, pages } = await loadData();
  const out: string[] = ["# Albania Audio Tours — full content", "", "> Destinations, attractions and travel articles from albaniaaudiotours.com (English).", ""];
  out.push("## Destinations and attractions", "");
  for (const d of dests) {
    out.push(`### ${d.name}${d.region ? ` (${d.region})` : ""}`, "", d.description, "");
    if (d.funFact) out.push(`Fun fact: ${d.funFact}`, "");
    out.push(`Audio tour: ${d.audioTourUrl}${d.guideUrl ? ` · Guide: ${d.guideUrl}` : ""}`, "");
    for (const a of attrs.filter(x => x.destinationSlug === d.slug)) {
      out.push(`- **${a.name}**${a.category ? ` (${a.category})` : ""}: ${snippet(a.description, 600)} — ${a.audioTourUrl}`);
    }
    out.push("");
  }
  out.push("## Travel articles", "");
  for (const p of blogPosts(pages)) {
    const md = await pageMarkdown(p.slug);
    if (md) out.push(md.replace(/^# /, "### "), "", "---", "");
  }
  return out.join("\n");
}

// ── Discovery documents ───────────────────────────────────────────────────────
const LINK_HEADER = [
  `</.well-known/api-catalog>; rel="api-catalog"`,
  `</openapi.json>; rel="service-desc"; type="application/openapi+json"`,
  `</llms.txt>; rel="service-doc"; type="text/plain"`,
  `</.well-known/mcp/server-card.json>; rel="describedby"; type="application/json"`,
  `</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"`,
  `</.well-known/ai-catalog.json>; rel="ai-catalog"; type="application/json"`,
  `</sitemap.xml>; rel="sitemap"; type="application/xml"`,
].join(", ");

const MCP_INSTRUCTIONS =
  "Read-only access to Albania Audio Tours: destinations, attractions with GPS coordinates, walking routes, destination guides and travel articles about Albania written by a local author. Use list_destinations or search_attractions first, then get_destination / get_attraction for details, and give travelers the audioTourUrl so they can listen on site.";

function serverCard() {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json",
    version: "1.0",
    protocolVersion: MCP_PROTOCOL_VERSIONS[1],
    serverInfo: { name: "albania-audio-tours", title: "Albania Audio Tours", version: SERVER_VERSION },
    description: "Read-only MCP server for Albania travel: destinations, attractions, walking routes, guides and local travel articles from albaniaaudiotours.com.",
    url: `${SITE}/mcp`,
    documentationUrl: `${SITE}/llms.txt`,
    iconUrl: `${SITE}/icon-512.png`,
    transport: { type: "streamable-http", endpoint: `${SITE}/mcp` },
    capabilities: { tools: { listChanged: false } },
    authentication: { required: false },
    instructions: MCP_INSTRUCTIONS,
    tools: TOOLS.map(t => ({ name: t.name, title: t.title, description: t.description })),
  };
}

function apiCatalog() {
  return {
    linkset: [
      {
        anchor: `${SITE}/api/`,
        "service-desc": [{ href: `${SITE}/openapi.json`, type: "application/openapi+json" }],
        "service-doc": [{ href: `${SITE}/llms.txt`, type: "text/plain" }],
        status: [{ href: `${SITE}/health`, type: "application/json" }],
      },
      {
        anchor: `${SITE}/mcp`,
        "service-desc": [{ href: `${SITE}/.well-known/mcp/server-card.json`, type: "application/json" }],
        "service-doc": [{ href: `${SITE}/.well-known/agent-skills/albania-audio-tours/SKILL.md`, type: "text/markdown" }],
      },
    ],
  };
}

function openApi() {
  const lang = { name: "lang", in: "query", required: false, schema: { type: "string", enum: ["en", "al", "de", "it", "fr", "es", "gr", "ru", "ar", "pt", "cn"], default: "en" } };
  const lite = { name: "view", in: "query", required: false, schema: { type: "string", enum: ["lite"] }, description: "Use 'lite' for a compact list (short descriptions, first image)." };
  const ok = (desc: string) => ({ "200": { description: desc, content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } } });
  const one = (desc: string) => ({ "200": { description: desc, content: { "application/json": { schema: { type: "object" } } } }, "404": { description: "Not found" } });
  return {
    openapi: "3.1.0",
    info: {
      title: "Albania Audio Tours public API",
      version: SERVER_VERSION,
      description: "Public, read-only JSON endpoints used by albaniaaudiotours.com. No authentication. For AI agents, the MCP server at /mcp offers the same data in a tool-friendly form.",
      contact: { name: "Albania Audio Tours", url: `${SITE}/p/contact` },
    },
    servers: [{ url: SITE }],
    paths: {
      "/api/sites": { get: { operationId: "listDestinations", summary: "List destinations", parameters: [lite, lang], responses: ok("Destinations") } },
      "/api/sites/{slug}": { get: { operationId: "getDestination", summary: "Get one destination", parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }], responses: one("Destination") } },
      "/api/attractions": { get: { operationId: "listAttractions", summary: "List attractions", parameters: [lite, lang], responses: ok("Attractions") } },
      "/api/attractions/{destinationSlug}": { get: { operationId: "listAttractionsByDestination", summary: "Attractions of one destination", parameters: [{ name: "destinationSlug", in: "path", required: true, schema: { type: "string" } }], responses: ok("Attractions") } },
      "/api/attractions/{destinationSlug}/{slug}": { get: { operationId: "getAttraction", summary: "Get one attraction", parameters: [{ name: "destinationSlug", in: "path", required: true, schema: { type: "string" } }, { name: "slug", in: "path", required: true, schema: { type: "string" } }], responses: one("Attraction") } },
      "/api/itineraries": { get: { operationId: "listWalkingRoutes", summary: "Published walking routes", responses: ok("Walking routes") } },
      "/api/cms/pages": { get: { operationId: "listPages", summary: "Published pages and articles", parameters: [{ name: "type", in: "query", required: false, schema: { type: "string", enum: ["blog", "landing", "info"] } }, { name: "view", in: "query", required: false, schema: { type: "string", enum: ["list"] }, description: "Use 'list' for titles, excerpts and URLs only." }], responses: ok("Pages") } },
      "/api/cms/pages/{slug}": { get: { operationId: "getPage", summary: "Get one published page", parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }], responses: one("Page") } },
      "/p/{slug}.md": { get: { operationId: "getPageMarkdown", summary: "Published page as Markdown", parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Markdown", content: { "text/markdown": { schema: { type: "string" } } } }, "404": { description: "Not found" } } } },
    },
  };
}

const SKILL_MD = `---
name: albania-audio-tours
description: Plan a visit to Albania with Albania Audio Tours — find destinations and attractions, read local guides and articles, and send travelers to the right self-guided audio tour. Use when a user asks what to see in Albania, about a specific Albanian town or site, or wants an audio guide.
---

# Albania Audio Tours

Albania Audio Tours (${SITE}) offers self-guided, GPS-triggered audio tours for destinations across Albania and Prizren (Kosovo), in 11 languages, plus destination guides and a travel blog written by a local author from the Albanian point of view.

## How to use

1. Connect to the read-only MCP server at \`${SITE}/mcp\` (Streamable HTTP, no authentication), or use the public JSON API described at \`${SITE}/openapi.json\`.
2. Call \`list_destinations\` to see all destinations, or \`search_attractions\` with a keyword (e.g. "castle", "Butrint", "beach").
3. Call \`get_destination\` or \`get_attraction\` for full descriptions, fun facts and coordinates.
4. Use \`find_nearby_attractions\` with a latitude/longitude to suggest sites near the traveler.
5. Use \`list_articles\` and \`get_page\` to read guides and blog posts (as Markdown) for practical advice.
6. Give the traveler the \`audioTourUrl\` to open the audio tour on their phone, and \`${SITE}/p/contact\` for questions to the author.

## Notes

- All data is public and read-only. Do not attempt to call /api/admin endpoints.
- Every page is also available as Markdown: append \`.md\` to a \`/p/\` URL or send \`Accept: text/markdown\`.
- Some premium tours are marked \`premium: true\`; the rest are free.
`;
const SKILL_DIGEST = "sha256:" + createHash("sha256").update(Buffer.from(SKILL_MD, "utf8")).digest("hex");

function skillsIndex() {
  return {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: [{
      name: "albania-audio-tours",
      type: "skill-md",
      description: "Plan a visit to Albania: find destinations and attractions, read local guides and articles, and link travelers to self-guided audio tours.",
      url: `${SITE}/.well-known/agent-skills/albania-audio-tours/SKILL.md`,
      digest: SKILL_DIGEST,
    }],
  };
}

function aiCatalog() {
  return {
    specVersion: "1.0",
    host: { displayName: "Albania Audio Tours", identifier: "did:web:albaniaaudiotours.com", url: SITE },
    entries: [
      {
        identifier: "urn:air:albaniaaudiotours.com:server:albania-audio-tours",
        displayName: "Albania Audio Tours MCP server",
        description: "Read-only tools for Albanian destinations, attractions, walking routes and travel articles.",
        type: "application/mcp-server-card+json",
        url: `${SITE}/.well-known/mcp/server-card.json`,
        representativeQueries: ["what to see in Berat Albania", "audio guide for Gjirokastër castle", "attractions near Sarandë", "is Albania safe to visit"],
      },
      {
        identifier: "urn:air:albaniaaudiotours.com:skill:albania-audio-tours",
        displayName: "Plan an Albania visit with audio tours",
        description: "Agent skill describing how to use the site's data to plan visits.",
        type: "text/markdown",
        url: `${SITE}/.well-known/agent-skills/albania-audio-tours/SKILL.md`,
        representativeQueries: ["plan a trip to Albania", "best audio tours in Albania", "self-guided tour of Tirana"],
      },
      {
        identifier: "urn:air:albaniaaudiotours.com:api:public",
        displayName: "Albania Audio Tours public API",
        description: "OpenAPI 3.1 description of the public read-only JSON API.",
        type: "application/openapi+json",
        url: `${SITE}/openapi.json`,
        representativeQueries: ["list Albanian destinations with coordinates", "list attractions in Shkodër"],
      },
    ],
  };
}

// ── MCP tools ─────────────────────────────────────────────────────────────────
type Tool = { name: string; title: string; description: string; inputSchema: any; run: (args: any) => Promise<any> };

function haversineKm(a: number, b: number, c: number, d: number) {
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(c - a), dLng = r(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const clampInt = (v: any, def: number, min: number, max: number) => {
  const n = Number.isFinite(Number(v)) ? Math.floor(Number(v)) : def;
  return Math.min(max, Math.max(min, n));
};
const attrBrief = (a: Attr) => ({ name: a.name, slug: a.slug, destination: a.destination, destinationSlug: a.destinationSlug, category: a.category, summary: a.summary, lat: a.lat, lng: a.lng, premium: a.premium, audioTourUrl: a.audioTourUrl });

const TOOLS: Tool[] = [
  {
    name: "list_destinations", title: "List destinations",
    description: "List all Albania Audio Tours destinations with region, short summary, guide URL and audio tour URL.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async () => {
      const { dests } = await loadData();
      return { destinations: dests.map(d => ({ name: d.name, slug: d.slug, region: d.region, summary: d.summary, attractionCount: d.attractionCount, lat: d.lat, lng: d.lng, premium: d.premium, guideUrl: d.guideUrl, audioTourUrl: d.audioTourUrl })) };
    },
  },
  {
    name: "get_destination", title: "Get destination",
    description: "Full description, fun fact, attractions and walking routes for one destination (e.g. 'berat', 'gjirokaster', 'tirana').",
    inputSchema: { type: "object", properties: { slug: { type: "string", description: "Destination slug from list_destinations" } }, required: ["slug"], additionalProperties: false },
    run: async ({ slug }) => {
      const { dests, attrs } = await loadData();
      const d = dests.find(x => x.slug === String(slug || "").toLowerCase().trim());
      if (!d) throw new Error(`Unknown destination '${slug}'. Call list_destinations for valid slugs.`);
      const routes = (await storage.getItinerariesBySite(d.slug)).filter((i: any) => i.isPublished)
        .map((i: any) => ({ name: i.name, description: i.description, durationMinutes: i.durationMinutes, distanceKm: i.distanceKm, difficulty: i.difficulty }));
      return { ...d, description: d.description.slice(0, 8000), attractions: attrs.filter(a => a.destinationSlug === d.slug).map(attrBrief), walkingRoutes: routes };
    },
  },
  {
    name: "search_attractions", title: "Search attractions",
    description: "Search attractions by keyword (name, category or description), optionally within one destination.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Keyword, e.g. 'castle', 'mosque', 'beach', 'Butrint'" }, destination: { type: "string", description: "Optional destination slug" }, limit: { type: "integer", minimum: 1, maximum: 25, default: 10 } }, required: ["query"], additionalProperties: false },
    run: async ({ query, destination, limit }) => {
      const { attrs } = await loadData();
      const terms = norm(String(query || "")).split(/\s+/).filter(Boolean);
      if (!terms.length) throw new Error("query is required");
      const scored = attrs
        .filter(a => !destination || a.destinationSlug === String(destination).toLowerCase())
        .map(a => {
          const name = norm(`${a.name} ${a.nameAl}`), meta = norm(`${a.category} ${a.destination}`), body = norm(a.description);
          let s = 0;
          for (const t of terms) { if (name.includes(t)) s += 5; if (meta.includes(t)) s += 3; if (body.includes(t)) s += 1; }
          return { a, s };
        })
        .filter(x => x.s > 0).sort((x, y) => y.s - x.s).slice(0, clampInt(limit, 10, 1, 25));
      return { results: scored.map(x => attrBrief(x.a)) };
    },
  },
  {
    name: "get_attraction", title: "Get attraction",
    description: "Full description, fun fact, visit duration and coordinates of one attraction.",
    inputSchema: { type: "object", properties: { destination: { type: "string", description: "Destination slug" }, slug: { type: "string", description: "Attraction slug" } }, required: ["destination", "slug"], additionalProperties: false },
    run: async ({ destination, slug }) => {
      const { attrs } = await loadData();
      const a = attrs.find(x => x.destinationSlug === String(destination || "").toLowerCase() && x.slug === String(slug || "").toLowerCase());
      if (!a) throw new Error("Attraction not found. Use search_attractions or get_destination to find valid slugs.");
      return { ...a, description: a.description.slice(0, 8000) };
    },
  },
  {
    name: "find_nearby_attractions", title: "Find nearby attractions",
    description: "Attractions closest to a latitude/longitude in Albania, sorted by distance.",
    inputSchema: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, radiusKm: { type: "number", minimum: 0.1, maximum: 200, default: 15 }, limit: { type: "integer", minimum: 1, maximum: 25, default: 10 } }, required: ["lat", "lng"], additionalProperties: false },
    run: async ({ lat, lng, radiusKm, limit }) => {
      const la = Number(lat), lo = Number(lng);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) throw new Error("lat and lng must be numbers");
      const r = Math.min(200, Math.max(0.1, Number(radiusKm) || 15));
      const { attrs } = await loadData();
      const near = attrs.filter(a => a.lat != null && a.lng != null)
        .map(a => ({ a, km: haversineKm(la, lo, a.lat!, a.lng!) }))
        .filter(x => x.km <= r).sort((x, y) => x.km - y.km).slice(0, clampInt(limit, 10, 1, 25));
      return { results: near.map(x => ({ ...attrBrief(x.a), distanceKm: Math.round(x.km * 10) / 10 })) };
    },
  },
  {
    name: "list_articles", title: "List guides and articles",
    description: "List published travel articles and destination guides (title, excerpt, URL), newest first. Optional keyword filter.",
    inputSchema: { type: "object", properties: { query: { type: "string" }, type: { type: "string", enum: ["blog", "guide", "all"], default: "all" }, limit: { type: "integer", minimum: 1, maximum: 50, default: 20 } }, additionalProperties: false },
    run: async ({ query, type, limit }) => {
      const { pages } = await loadData();
      let list = type === "blog" ? blogPosts(pages) : type === "guide" ? englishGuides(pages) : [...blogPosts(pages), ...englishGuides(pages)];
      if (query) { const q = norm(String(query)); list = list.filter(p => norm(`${p.title} ${p.excerpt} ${p.slug}`).includes(q)); }
      return { articles: list.slice(0, clampInt(limit, 20, 1, 50)).map(p => ({ title: p.title, slug: p.slug, type: p.pageType === "blog" ? "blog" : "guide", excerpt: p.excerpt, publishedAt: p.publishedAt, url: p.url, markdownUrl: `${p.url}.md` })) };
    },
  },
  {
    name: "get_page", title: "Read a page",
    description: "Read a published guide or article as Markdown, by slug (from list_articles).",
    inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"], additionalProperties: false },
    run: async ({ slug }) => {
      const md = await pageMarkdown(String(slug || "").trim());
      if (!md) throw new Error("Page not found or not published.");
      return md.length > 40000 ? md.slice(0, 40000) + "\n\n[truncated]" : md;
    },
  },
];

// ── MCP JSON-RPC handler (stateless Streamable HTTP, JSON responses) ──────────
async function handleRpc(msg: any): Promise<any | null> {
  const isNotification = msg && msg.id === undefined;
  const reply = (result: any) => (isNotification ? null : { jsonrpc: "2.0", id: msg.id, result });
  const fail = (code: number, message: string) => (isNotification ? null : { jsonrpc: "2.0", id: msg?.id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(-32600, "Invalid Request");

  switch (msg.method) {
    case "initialize": {
      const requested = msg.params?.protocolVersion;
      return reply({
        protocolVersion: MCP_PROTOCOL_VERSIONS.includes(requested) ? requested : MCP_PROTOCOL_VERSIONS[1],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "albania-audio-tours", title: "Albania Audio Tours", version: SERVER_VERSION },
        instructions: MCP_INSTRUCTIONS,
      });
    }
    case "ping": return reply({});
    case "tools/list":
      return reply({ tools: TOOLS.map(t => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: { readOnlyHint: true, openWorldHint: false } })) });
    case "tools/call": {
      const tool = TOOLS.find(t => t.name === msg.params?.name);
      if (!tool) return fail(-32602, `Unknown tool: ${msg.params?.name}`);
      try {
        const out = await tool.run(msg.params?.arguments || {});
        const text = typeof out === "string" ? out : JSON.stringify(out, null, 2);
        return reply({ content: [{ type: "text", text }], ...(typeof out === "object" ? { structuredContent: out } : {}), isError: false });
      } catch (e: any) {
        return reply({ content: [{ type: "text", text: String(e?.message || e) }], isError: true });
      }
    }
    case "resources/list": return reply({ resources: [] });
    case "prompts/list": return reply({ prompts: [] });
    default:
      if (msg.method.startsWith("notifications/")) return null;
      return fail(-32601, `Method not found: ${msg.method}`);
  }
}

// Simple per-IP rate limit for /mcp (public, unauthenticated)
const hits = new Map<string, { n: number; t: number }>();
function rateLimited(req: Request): boolean {
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) { hits.set(ip, { n: 1, t: now }); if (hits.size > 5000) hits.clear(); return false; }
  h.n++;
  return h.n > 120;
}

function sendMarkdown(res: Response, md: string, status = 200) {
  res.status(status);
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("x-markdown-tokens", String(tokenEstimate(md)));
  res.setHeader("Vary", "Accept");
  res.setHeader("Cache-Control", "public, max-age=600");
  res.send(md);
}
function wantsMarkdown(req: Request): boolean {
  const a = String(req.headers.accept || "").toLowerCase();
  return a.includes("text/markdown") || a.includes("text/x-markdown");
}
function json(res: Response, body: any, type = "application/json") {
  res.setHeader("Content-Type", `${type}; charset=utf-8`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  res.send(JSON.stringify(body, null, 2));
}

// ── Register ──────────────────────────────────────────────────────────────────
export function registerAgentRoutes(app: Express): void {
  // Link headers + Markdown content negotiation on the homepage and /p/* pages
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const p = req.path;
    const isHome = p === "/" || p === "/index.html";
    const mdSuffix = /^\/p\/([a-z0-9][a-z0-9-]*)\.md$/i.exec(p);
    const pageMatch = /^\/p\/([a-z0-9][a-z0-9-]*)\/?$/i.exec(p);
    if (isHome || pageMatch) {
      res.append("Link", LINK_HEADER);
      res.append("Vary", "Accept");
    }
    try {
      if (isHome && wantsMarkdown(req)) return sendMarkdown(res, await homepageMarkdown());
      const slug = mdSuffix?.[1] || (pageMatch && wantsMarkdown(req) ? pageMatch[1] : null);
      if (slug) {
        const md = await pageMarkdown(slug.toLowerCase());
        return md ? sendMarkdown(res, md) : sendMarkdown(res, "# Not found\n\nThis page does not exist or is not published.\n", 404);
      }
    } catch (err) {
      console.error("[agent] markdown error:", err);
    }
    next();
  });

  app.get("/llms.txt", async (_req, res) => {
    try { res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.setHeader("Cache-Control", "public, max-age=600"); res.send(await llmsTxt()); }
    catch (e) { console.error("[agent] llms.txt", e); res.status(500).send("error"); }
  });
  app.get("/llms-full.txt", async (_req, res) => {
    try { res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.setHeader("Cache-Control", "public, max-age=1800"); res.send(await llmsFullTxt()); }
    catch (e) { console.error("[agent] llms-full.txt", e); res.status(500).send("error"); }
  });

  app.get("/.well-known/api-catalog", (_req, res) => {
    res.setHeader("Link", `</.well-known/api-catalog>; rel="api-catalog"`);
    json(res, apiCatalog(), "application/linkset+json");
  });
  app.get("/openapi.json", (_req, res) => json(res, openApi()));
  app.get(["/.well-known/mcp/server-card.json", "/.well-known/mcp.json"], (_req, res) => json(res, serverCard()));
  app.get("/.well-known/agent-skills/index.json", (_req, res) => json(res, skillsIndex()));
  app.get("/.well-known/agent-skills/albania-audio-tours/SKILL.md", (_req, res) => {
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
    res.send(Buffer.from(SKILL_MD, "utf8"));
  });
  app.get("/.well-known/ai-catalog.json", (_req, res) => json(res, aiCatalog()));

  // MCP endpoint
  app.options("/mcp", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version");
    res.status(204).end();
  });
  app.get("/mcp", (_req, res) => {
    res.setHeader("Allow", "POST, OPTIONS");
    res.status(405).json({ error: "Use POST with JSON-RPC (MCP Streamable HTTP). Server card: /.well-known/mcp/server-card.json" });
  });
  app.post("/mcp", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (rateLimited(req)) return res.status(429).json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Too many requests" } });
    const body = req.body;
    try {
      if (Array.isArray(body)) {
        if (body.length > 20) return res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Batch too large" } });
        const out = (await Promise.all(body.map(handleRpc))).filter(Boolean);
        return out.length ? res.json(out) : res.status(202).end();
      }
      const out = await handleRpc(body);
      return out ? res.json(out) : res.status(202).end();
    } catch (e) {
      console.error("[agent] mcp error:", e);
      return res.status(500).json({ jsonrpc: "2.0", id: body?.id ?? null, error: { code: -32603, message: "Internal error" } });
    }
  });
}
