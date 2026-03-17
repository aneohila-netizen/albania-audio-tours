import { Link, useLocation } from "wouter";
import { useApp } from "@/App";
import { LANG_LABELS, type Lang } from "@/lib/i18n";
import { Map, List, BookOpen, Trophy, Moon, Sun, Settings } from "lucide-react";

export default function NavBar() {
  const [location] = useLocation();
  const { t, lang, setLang, totalPoints, visitedSiteIds, dark, toggleDark } = useApp();

  const navItems = [
    { href: "/", icon: Map, label: t.exploreMap },
    { href: "/sites", icon: List, label: t.tourSites },
    { href: "/passport", icon: BookOpen, label: t.myPassport },
    { href: "/leaderboard", icon: Trophy, label: t.leaderboard },
  ];

  const langs: Lang[] = ["en", "al", "gr"];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
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

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Points display */}
          <div className="points-badge hidden sm:flex items-center gap-1" data-testid="total-points">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 1L7.5 4.5H11L8 6.5L9.5 10L6 8L2.5 10L4 6.5L1 4.5H4.5L6 1Z" />
            </svg>
            {totalPoints} pts
          </div>

          {/* Language switcher */}
          <div className="flex items-center gap-0.5 bg-muted rounded-full p-0.5">
            {langs.map(l => (
              <button
                key={l}
                data-testid={`lang-${l}`}
                className={`lang-btn ${lang === l ? "active" : ""}`}
                onClick={() => setLang(l)}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
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

      {/* Mobile bottom nav */}
      <nav className="md:hidden flex border-t border-border">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <a
                data-testid={`mobile-nav-${href.replace("/", "") || "map"}`}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon size={18} />
                <span className="leading-none" style={{ fontSize: "10px" }}>{label.split(" ")[0]}</span>
              </a>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
