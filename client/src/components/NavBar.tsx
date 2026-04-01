import { Link, useLocation } from "wouter";
import { useApp } from "@/App";
import { LANG_LABELS, LANG_NAMES, type Lang } from "@/lib/i18n";
import { Map, List, Route, Trophy, Moon, Sun, Settings, ChevronDown, Search, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useDestinations, useAttractions } from "@/lib/useApiData";
import { getLangText } from "@/lib/i18n";

export default function NavBar() {
  const [location] = useLocation();
  const { t, lang, setLang, totalPoints, visitedSiteIds, dark, toggleDark } = useApp();

  const navItems = [
    { href: "/", icon: Map, label: t.exploreMap },
    { href: "/sites", icon: List, label: t.tourSites },
    { href: "/passport", icon: Route, label: t.myPassport },
    { href: "/leaderboard", icon: Trophy, label: t.leaderboard },
  ];

  const allLangs: Lang[] = ["en", "al", "gr", "it", "es", "de", "fr", "ar", "sl", "pt", "cn"];
  const FLAG: Record<Lang, string> = {
    en: "🇬🇧", al: "🇦🇱", gr: "🇬🇷", it: "🇮🇹",
    es: "🇪🇸", de: "🇩🇪", fr: "🇫🇷", ar: "🇸🇦", sl: "🇸🇮",
  };

  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Global search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const DESTINATIONS_DATA = useDestinations();
  const ATTRACTIONS_DATA = useAttractions();

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
    else setSearchQuery("");
  }, [searchOpen]);

  // Close search on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Compute search results — destinations + attractions, max 8
  const searchResults = searchQuery.trim().length < 2 ? [] : (() => {
    const q = searchQuery.toLowerCase();
    const results: Array<{
      type: "destination" | "attraction";
      slug: string;
      destSlug?: string;
      name: string;
      sub: string;
    }> = [];

    // Search destinations
    for (const d of DESTINATIONS_DATA) {
      const name = getLangText(d, "name", lang);
      if (name.toLowerCase().includes(q) && results.length < 4) {
        results.push({ type: "destination", slug: d.slug, name, sub: d.region || d.category });
      }
    }
    // Search attractions
    for (const a of ATTRACTIONS_DATA) {
      const name = getLangText(a, "name", lang);
      if (name.toLowerCase().includes(q) && results.length < 8) {
        results.push({ type: "attraction", slug: a.slug, destSlug: a.destinationSlug, name, sub: a.category });
      }
    }
    return results;
  })();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-[2000] border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 h-14 max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/">
          <a className="flex items-center gap-2 text-primary no-underline" data-testid="logo-link">
            {/* Eagle SVG logo */}
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="AlbaniaAudioTours logo">
              <circle cx="16" cy="16" r="15" fill="hsl(var(--primary))" />
              {/* Stylized eagle silhouette */}
              <path d="M16 8 C16 8 10 12 8 16 C10 15 13 15 16 20 C19 15 22 15 24 16 C22 12 16 8 16 8Z" fill="white" />
              <circle cx="16" cy="14" r="2" fill="white" />
              <path d="M14 22 L16 26 L18 22" fill="white" />
            </svg>
            <span className="font-bold text-lg hidden sm:block" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
              AlbaniaAudioTours
            </span>
          </a>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = location === href || (href !== "/" && location.startsWith(href));
            return (
              <Link key={href} href={href}>
                <a
                  data-testid={`nav-${href.replace("/", "") || "map"}`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Right controls — flex-1 on mobile when search open so it fills the gap */}
        <div className={`flex items-center gap-2 ${searchOpen ? "flex-1 min-w-0" : ""}`}>

          {/* ── Global Search ───────────────────────────────────────── */}
          <div className={`relative ${searchOpen ? "flex-1 md:flex-none" : ""}`} ref={searchRef}>
            {/* Search button — expands to input on click */}
            {!searchOpen ? (
              <button
                onClick={() => setSearchOpen(true)}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Search destinations and attractions"
                title="Search"
              >
                <Search size={20} className="sm:w-4 sm:h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1 bg-card border border-primary/30 rounded-xl px-2.5 py-1.5 shadow-md w-full md:w-56">
                <Search size={14} className="text-muted-foreground shrink-0" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Escape" && setSearchOpen(false)}
                  placeholder="Search destinations, tours…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 min-w-0"
                  aria-label="Search"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
            {/* Results dropdown */}
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-border bg-card shadow-xl overflow-hidden z-[3000]">
                {searchResults.map((r, i) => (
                  <a
                    key={i}
                    href={r.type === "destination"
                      ? `${window.location.href.split("#")[0]}#/sites/${r.slug}`
                      : `${window.location.href.split("#")[0]}#/sites/${r.destSlug}/${r.slug}`}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors border-b border-border/40 last:border-0"
                  >
                    <span className="text-base shrink-0">
                      {r.type === "destination" ? "📍" : "🎯"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground capitalize truncate">
                        {r.type === "destination" ? "Destination" : "Attraction"} · {r.sub}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
            {/* No results message */}
            {searchOpen && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
              <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-border bg-card shadow-xl z-[3000] px-4 py-3">
                <p className="text-sm text-muted-foreground">No results for "{searchQuery}"</p>
              </div>
            )}
          </div>

          {/* Points display */}
          <div className="points-badge hidden sm:flex items-center gap-1" data-testid="total-points">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 1L7.5 4.5H11L8 6.5L9.5 10L6 8L2.5 10L4 6.5L1 4.5H4.5L6 1Z" />
            </svg>
            {totalPoints} pts
          </div>

          {/* Language switcher — compact dropdown */}
          <div className="relative" ref={langRef}>
            <button
              data-testid="lang-dropdown-trigger"
              onClick={() => setLangOpen(v => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-border bg-card hover:bg-muted transition-colors"
              aria-haspopup="listbox"
              aria-expanded={langOpen}
            >
              <span>{FLAG[lang as Lang]}</span>
              <span>{LANG_LABELS[lang as Lang]}</span>
              <ChevronDown size={11} className={`transition-transform duration-150 ${langOpen ? "rotate-180" : ""}`} />
            </button>
            {langOpen && (
              <div
                role="listbox"
                className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-[3000]"
              >
                {allLangs.map(l => (
                  <button
                    key={l}
                    role="option"
                    aria-selected={lang === l}
                    data-testid={`lang-${l}`}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left ${
                      lang === l
                        ? "bg-primary/10 text-primary font-semibold"
                        : "hover:bg-muted text-foreground"
                    }`}
                    onClick={() => { setLang(l); setLangOpen(false); }}
                  >
                    <span className="text-base leading-none">{FLAG[l]}</span>
                    <span className="flex-1">{LANG_NAMES[l]}</span>
                    <span className="text-xs text-muted-foreground">{LANG_LABELS[l]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dark mode toggle */}
          <button
            data-testid="dark-toggle"
            onClick={toggleDark}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Admin link — opens in new tab to escape embed */}
          <a
            href={`${window.location.href.split('#')[0]}#/admin`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="admin-link"
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Admin Panel"
          >
            <Settings size={16} />
          </a>
        </div>
      </div>

      {/* Mobile bottom nav — full-width, 44px touch targets, full labels */}
      <nav className="md:hidden flex border-t border-border bg-background">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <a
                data-testid={`mobile-nav-${href.replace("/", "") || "map"}`}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors relative ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ minHeight: 52 }}
              >
                {/* Active indicator bar at top */}
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                )}
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                <span
                  className={`leading-none text-center font-medium ${
                    active ? "font-semibold" : ""
                  }`}
                  style={{ fontSize: "11px" }}
                >
                  {label}
                </span>
              </a>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
