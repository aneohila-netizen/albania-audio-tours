import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState, createContext, useContext } from "react";
import { Toaster } from "@/components/ui/toaster";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import type { Lang, Translations } from "@/lib/i18n";
import { TRANSLATIONS } from "@/lib/i18n";
import { AudioPlayerProvider } from "@/components/StickyAudioPlayer";
import RatingSheet from "@/components/RatingSheet";
import type { AudioTrack } from "@/components/StickyAudioPlayer";
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
  const [, navigate] = useLocation();
  const [ratingState, setRatingState] = useState<{
    siteId: number; siteName: string; trigger: "completion" | "exit"; listenedSeconds: number;
  } | null>(null);

  const handleAudioComplete = (track: AudioTrack, listenedSec: number) => {
    setRatingState({ siteId: track.siteId, siteName: track.siteName, trigger: "completion", listenedSeconds: listenedSec });
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <Router hook={useHashLocation}>
      <AudioPlayerProvider onComplete={handleAudioComplete} onNavigate={handleNavigate}>
        <Switch>
          {/* Admin */}
          <Route path="/admin" component={AdminPanel} />

          {/* Public routes */}
          <Route>
            <div className="flex flex-col min-h-screen bg-background text-foreground">
              <NavBar />
              <main className="flex-1 pb-28"> {/* pb-28 = space for sticky player */}
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

        {/* Rating sheet */}
        {ratingState && (
          <RatingSheet
            siteId={ratingState.siteId}
            siteName={ratingState.siteName}
            trigger={ratingState.trigger}
            listenedSeconds={ratingState.listenedSeconds}
            onClose={() => setRatingState(null)}
          />
        )}
      </AudioPlayerProvider>
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
