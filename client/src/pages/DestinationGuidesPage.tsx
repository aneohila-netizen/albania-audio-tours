/**
 * DestinationGuidesPage — lists all 264 landing pages grouped by destination,
 * with a language filter so visitors can browse in their own language.
 */

import { useState } from "react";
import { Globe, Map, ArrowRight } from "lucide-react";

const RAILWAY_URL = "https://albania-audio-tours-production.up.railway.app";

// 24 destinations in display order with their slugs and English names
const DESTINATIONS = [
  { slug: "tirana",                 name: "Tirana",                              flag: "🏛️" },
  { slug: "durres",                 name: "Durrës",                              flag: "⚓" },
  { slug: "kruje",                  name: "Krujë",                               flag: "🏰" },
  { slug: "shkodra",                name: "Shkodra",                             flag: "🦅" },
  { slug: "lezhe",                  name: "Lezhë",                               flag: "⛪" },
  { slug: "nature-alps",            name: "Albanian Alps — Theth & Valbona",     flag: "⛰️" },
  { slug: "berat",                  name: "Berat",                               flag: "🏘️" },
  { slug: "elbasan",                name: "Elbasan",                             flag: "🏯" },
  { slug: "pogradec",               name: "Pogradec & Lake Ohrid",               flag: "🌊" },
  { slug: "korca",                  name: "Korçë",                               flag: "🎭" },
  { slug: "permet-vjosa-valley",    name: "Përmet & Vjosa Valley",               flag: "🌿" },
  { slug: "gjirokaster",            name: "Gjirokastër",                         flag: "🏰" },
  { slug: "saranda",                name: "Sarandë, Ksamil & Butrint",           flag: "🌊" },
  { slug: "vlora",                  name: "Vlorë",                               flag: "🏖️" },
  { slug: "beaches",                name: "Albanian Riviera & Beaches",          flag: "☀️" },
  { slug: "divjake-karavasta-lagoon", name: "Divjakë & Karavasta Lagoon",        flag: "🦩" },
  { slug: "lushnje-region",         name: "Lushnje Region & Ardenica",           flag: "🛕" },
  { slug: "fier",                   name: "Fier Region",                         flag: "🏺" },
  { slug: "apollonia",              name: "Apollonia Archaeological Park",       flag: "🏛️" },
  { slug: "byllis",                 name: "Byllis Archaeological Park",          flag: "🗿" },
  { slug: "corovode",               name: "Çorovodë / Skrapar",                  flag: "🏔️" },
  { slug: "tepelene",               name: "Tepelenë & Ali Pasha Castle",         flag: "🏯" },
  { slug: "kukes-city",             name: "Kukës",                               flag: "💎" },
  { slug: "prizren",                name: "Prizren — Kosovo",                    flag: "🕌" },
];

const LANGUAGES = [
  { code: "en", label: "English",   native: "English"   },
  { code: "al", label: "Albanian",  native: "Shqip"     },
  { code: "de", label: "German",    native: "Deutsch"   },
  { code: "it", label: "Italian",   native: "Italiano"  },
  { code: "fr", label: "French",    native: "Français"  },
  { code: "es", label: "Spanish",   native: "Español"   },
  { code: "gr", label: "Greek",     native: "Ελληνικά"  },
  { code: "ru", label: "Russian",   native: "Русский"   },
  { code: "ar", label: "Arabic",    native: "العربية"   },
  { code: "pt", label: "Portuguese",native: "Português" },
  { code: "cn", label: "Chinese",   native: "中文"       },
];

export default function DestinationGuidesPage() {
  const [activeLang, setActiveLang] = useState("en");
  const [search, setSearch] = useState("");

  const filtered = DESTINATIONS.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 pb-28 space-y-8">

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Globe size={18} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Destination Guides
        </h1>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          In-depth guides for every destination in Albania — available in 11 languages.
          Each guide links to audio tours and organised trips with Albanian Eagle Tours.
        </p>
      </div>

      {/* Language selector */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground text-center uppercase tracking-wide">
          Read in your language
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => setActiveLang(lang.code)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeLang === lang.code
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {lang.native}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Map size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search destinations..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background
                     focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {/* Destination grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(dest => {
          const url = `/p/${dest.slug}-${activeLang}`;
          const langLabel = LANGUAGES.find(l => l.code === activeLang)?.native || "English";
          return (
            <a
              key={dest.slug}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 p-4 rounded-xl border border-border
                         bg-card hover:bg-muted/40 hover:border-primary/40 transition-all"
            >
              <span className="text-2xl flex-shrink-0">{dest.flag}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                  {dest.name}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Guide in {langLabel}
                </div>
              </div>
              <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            </a>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground">
          No destinations match "{search}"
        </div>
      )}

      {/* Count */}
      <p className="text-center text-xs text-muted-foreground">
        {filtered.length} destinations · 11 languages · {filtered.length * 11} guides total
      </p>

      {/* Plan Your Visit */}           <div className="rounded-2xl border border-border bg-muted/30 p-6 text-center space-y-4">             <p className="font-semibold text-sm">Plan Your Visit to Albania</p>             <p className="text-xs text-muted-foreground">Choose how you want to explore with Albanian Eagle Tours</p>             <div className="flex flex-wrap gap-2 justify-center">               <a                 href="https://albanianeagletours.com/collections/albania-city-breaks"                 target="_blank"                 rel="noopener noreferrer"                 className="inline-block bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"               >                 🏙️ City Breaks               </a>               <a                 href="https://albanianeagletours.com/collections/albania-tours-with-car-driver-included-popular"                 target="_blank"                 rel="noopener noreferrer"                 className="inline-block bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"               >                 🚗 Car &amp; Driver               </a>               <a                 href="https://albanianeagletours.com/pages/contact-us"                 target="_blank"                 rel="noopener noreferrer"                 className="inline-block bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"               >                 💬 Ask an Expert               </a>               <a                 href="https://albanianeagletours.com/collections/guided-tours"                 target="_blank"                 rel="noopener noreferrer"                 className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"               >                 🦅 Book a Guided Tour               </a>             </div>           </div>

    </div>
  );
}
