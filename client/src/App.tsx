import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState, createContext, useContext } from "react";
import { Toaster } from "@/components/ui/toaster";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import type { Lang, Translations } from "@/lib/i18n";
import { TRANSLATIONS } from "@/lib/i18n";
import MapPage from "@/pages/MapPage";
import SitesPage from "@/pages/SitesPage";
import SiteDetailPage from "@/pages/SiteDetailPage";
import DestinationPage from "@/pages/DestinationPage";
import AttractionDetailPage from "@/pages/AttractionDetailPage";
import PassportPage from "@/pages/PassportPage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import AdminPanel from "@/components/AdminPanel";
import NavBar from "@/components/NavBar";

// Global context
interface AppContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
  visitedSiteIds: Set<number>;
  markVisited: (siteId: number, points: number) => void;
  totalPoints: number;
  dark: boolean;
  toggleDark: () => void;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);
export const useApp = () => useContext(AppContext);

function AppProviders({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  const [visitedSiteIds, setVisitedSiteIds] = useState<Set<number>>(new Set());
  const [totalPoints, setTotalPoints] = useState(0);
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  const markVisited = (siteId: number, points: number) => {
    if (!visitedSiteIds.has(siteId)) {
      setVisitedSiteIds(prev => new Set([...prev, siteId]));
      setTotalPoints(prev => prev + points);
    }
  };

  const toggleDark = () => {
    setDark(d => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };

  // Apply dark mode on mount
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", dark);
  }

  return (
    <AppContext.Provider value={{
      lang,
      setLang,
      t: TRANSLATIONS[lang],
      visitedSiteIds,
      markVisited,
      totalPoints,
      dark,
      toggleDark,
    }}>
      {children}
    </AppContext.Provider>
  );
}

function AppRoutes() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        {/* Admin — single component with internal state, no navigation/remount */}
        <Route path="/admin" component={AdminPanel} />

        {/* Public routes — with NavBar */}
        <Route>
          <div className="flex flex-col min-h-screen bg-background text-foreground">
            <NavBar />
            <main className="flex-1">
              <Switch>
                <Route path="/" component={MapPage} />
                <Route path="/sites" component={SitesPage} />
                <Route path="/sites/:dest/:attr" component={AttractionDetailPage} />
                <Route path="/sites/:dest" component={DestinationPage} />
                <Route path="/passport" component={PassportPage} />
                <Route path="/leaderboard" component={LeaderboardPage} />
              </Switch>
            </main>
            <footer className="border-t border-border px-4 py-3 text-center" style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))" }}>
              <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer" className="hover:underline">
                Created with Perplexity Computer
              </a>
              {" · "}
              <span>Albanian Eagle Tours prototype</span>
            </footer>
            <PerplexityAttribution />
          </div>
        </Route>
      </Switch>
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProviders>
        <AppRoutes />
        <Toaster />
      </AppProviders>
    </QueryClientProvider>
  );
}
