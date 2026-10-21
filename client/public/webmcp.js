/*
 * WebMCP — exposes read-only Albania Audio Tours actions to in-browser AI agents.
 * https://webmachinelearning.github.io/webmcp/
 * Tools only read public data or navigate within the site; nothing is written.
 */
(function () {
  "use strict";
  if (window.__aatWebMcp) return;
  window.__aatWebMcp = true;

  var cache = {};
  function getJson(url) {
    if (!cache[url]) {
      cache[url] = fetch(url, { headers: { Accept: "application/json" } }).then(function (r) {
        if (!r.ok) { delete cache[url]; throw new Error("Request failed: " + r.status); }
        return r.json();
      });
    }
    return cache[url];
  }
  function text(obj) { return { content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }] }; }
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function clean(s, max) {
    var t = String(s || "").replace(/<[^>]+>/g, " ").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
    return max && t.length > max ? t.slice(0, max) + "…" : t;
  }
  var SITE = location.origin;

  var tools = [
    {
      name: "list_destinations",
      description: "List all Albania Audio Tours destinations (name, slug, region, short summary).",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: function () {
        return getJson("/api/sites?view=lite&lang=en").then(function (rows) {
          return text(rows.map(function (s) {
            return { name: String(s.nameEn || s.slug).split("\n")[0].trim(), slug: s.slug, region: s.region, summary: clean(s.descEn, 200), audioTourUrl: SITE + "/#/sites/" + s.slug };
          }));
        });
      }
    },
    {
      name: "search_attractions",
      description: "Search Albanian attractions by keyword (e.g. castle, mosque, beach, Butrint), optionally within one destination slug.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Keyword to search for" },
          destination: { type: "string", description: "Optional destination slug, e.g. berat" }
        },
        required: ["query"]
      },
      annotations: { readOnlyHint: true },
      execute: function (args) {
        var terms = norm(args && args.query).split(/\s+/).filter(Boolean);
        var dest = args && args.destination ? String(args.destination).toLowerCase() : "";
        return getJson("/api/attractions?view=lite&lang=en").then(function (rows) {
          var out = rows.filter(function (a) { return !dest || a.destinationSlug === dest; }).map(function (a) {
            var hay = norm(a.nameEn + " " + a.nameAl + " " + a.category + " " + a.destinationSlug + " " + a.descEn);
            var score = terms.reduce(function (n, t) { return n + (hay.indexOf(t) >= 0 ? 1 : 0); }, 0);
            return { a: a, score: score };
          }).filter(function (x) { return x.score > 0; }).sort(function (x, y) { return y.score - x.score; }).slice(0, 15);
          return text(out.map(function (x) {
            return { name: clean(x.a.nameEn), destination: x.a.destinationSlug, slug: x.a.slug, category: x.a.category, summary: clean(x.a.descEn, 200), audioTourUrl: SITE + "/#/sites/" + x.a.destinationSlug + "/" + x.a.slug };
          }));
        });
      }
    },
    {
      name: "open_audio_tour",
      description: "Open the audio tour page for a destination, or for one attraction inside it.",
      inputSchema: {
        type: "object",
        properties: {
          destination: { type: "string", description: "Destination slug, e.g. gjirokaster" },
          attraction: { type: "string", description: "Optional attraction slug" }
        },
        required: ["destination"]
      },
      execute: function (args) {
        var d = encodeURIComponent(String(args.destination || "").toLowerCase());
        var a = args.attraction ? "/" + encodeURIComponent(String(args.attraction).toLowerCase()) : "";
        location.hash = "#/sites/" + d + a;
        return Promise.resolve(text("Opened " + SITE + "/#/sites/" + d + a));
      }
    },
    {
      name: "list_articles",
      description: "List published travel articles and guides about Albania (title, excerpt, URL).",
      inputSchema: { type: "object", properties: { query: { type: "string", description: "Optional keyword filter" } } },
      annotations: { readOnlyHint: true },
      execute: function (args) {
        var q = norm(args && args.query);
        return getJson("/api/cms/pages?view=list").then(function (rows) {
          var list = rows.filter(function (p) { return p.pageType === "blog" || /-en$/.test(p.slug); })
            .filter(function (p) { return !q || norm(p.title + " " + p.excerpt + " " + p.slug).indexOf(q) >= 0; })
            .slice(0, 40);
          return text(list.map(function (p) { return { title: p.title, excerpt: p.excerpt, url: p.url, markdownUrl: p.url + ".md" }; }));
        });
      }
    },
    {
      name: "open_page",
      description: "Open a guide or article page by slug (from list_articles).",
      inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] },
      execute: function (args) {
        var slug = encodeURIComponent(String(args.slug || "").toLowerCase());
        location.href = "/p/" + slug;
        return Promise.resolve(text("Opening " + SITE + "/p/" + slug));
      }
    },
    {
      name: "contact_author",
      description: "Open the contact page to ask the author a question about traveling in Albania.",
      inputSchema: { type: "object", properties: {} },
      execute: function () {
        location.href = "/p/contact";
        return Promise.resolve(text("Opening " + SITE + "/p/contact"));
      }
    }
  ];

  var registered = false;
  function register() {
    if (registered) return true;
    var mc = (document && document.modelContext) || (navigator && navigator.modelContext);
    if (!mc) return false;
    registered = true;
    try {
      if (typeof mc.registerTool === "function") {
        var ctrl = typeof AbortController === "function" ? new AbortController() : null;
        window.__aatWebMcpAbort = ctrl;
        tools.forEach(function (t) {
          try {
            var r = mc.registerTool(t, ctrl ? { signal: ctrl.signal } : undefined);
            if (r && typeof r.catch === "function") r.catch(function (e) { console.warn("[webmcp]", t.name, e); });
          } catch (e) { console.warn("[webmcp]", t.name, e); }
        });
      } else if (typeof mc.provideContext === "function") {
        mc.provideContext({ tools: tools });
      }
    } catch (e) {
      console.warn("[webmcp] registration failed", e);
    }
    return true;
  }

  if (!register()) {
    document.addEventListener("DOMContentLoaded", register, { once: true });
    window.addEventListener("load", register, { once: true });
    var tries = 0;
    var iv = setInterval(function () { if (register() || ++tries > 20) clearInterval(iv); }, 250);
  }
})();
