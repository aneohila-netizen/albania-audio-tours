import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState, createContext, useContext, useEffect, lazy, Suspense } from "react";
import { SubscriptionProvider } from "@/lib/subscriptionContext";
import { Toaster } from "@/components/ui/toaster";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import type { Lang, Translations } from "@/lib/i18n";
import { TRANSLATIONS } from "@/lib/i18n";
import { AudioPlayerProvider } from "@/components/StickyAudioPlayer";
import RatingSheet from "@/components/RatingSheet";
import type { AudioTrack } from "@/components/StickyAudioPlayer";
import NavBar from "@/components/NavBar";
import LaunchBanner from "@/components/LaunchBanner";

// Map page loads eagerly — it’s the homepage
import MapPage from "@/pages/MapPage";

// All other pages load lazily — only downloaded when the user navigates there
const SitesPage            = lazy(() => import("@/pages/SitesPage"));
const SiteDetailPage       = lazy(() => import("@/pages/SiteDetailPage"));
const DestinationPage      = lazy(() => import("@/pages/DestinationPage"));
const AttractionDetailPage = lazy(() => import("@/pages/AttractionDetailPage"));
const PassportPage         = lazy(() => import("@/pages/PassportPage"));
const LeaderboardPage      = lazy(() => import("@/pages/LeaderboardPage"));
const ContactPage          = lazy(() => import("@/pages/ContactPage"));
const TermsPage            = lazy(() => import("@/pages/TermsPage"));
const RefundPage           = lazy(() => import("@/pages/RefundPage"));
const BlogPage             = lazy(() => import("@/pages/BlogPage"));
const SubscriptionsPage    = lazy(() => import("@/pages/SubscriptionsPage"));
const ActivatePage         = lazy(() => import("@/pages/ActivatePage"));
const ResetPasswordPage    = lazy(() => import("@/pages/ResetPasswordPage"));
const CmsPageRenderer      = lazy(() => import("@/pages/CmsPageRenderer"));
const AdminPanel           = lazy(() => import("@/components/AdminPanel"));

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

// ─── Dynamic footer — merges fixed links with CMS pages marked showInFooter ─
const RAILWAY_URL = "https://albania-audio-tours-production.up.railway.app";

interface CmsFooterPage { id: number; slug: string; title: string; }

function DynamicFooter() {
  const [cmsLinks, setCmsLinks] = useState<CmsFooterPage[]>([]);

  useEffect(() => {
    fetch(`${RAILWAY_URL}/api/cms/pages`)
      .then(r => r.json())
      .then((pages: any[]) => {
        // Only pages with showInFooter=true, exclude slugs already in fixed links
        const fixed = new Set(["contact", "terms", "refund-policy"]);
        setCmsLinks(
          pages
            .filter((p: any) => p.showInFooter && !fixed.has(p.slug))
            .map((p: any) => ({ id: p.id, slug: p.slug, title: p.title }))
        );
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="border-t border-border px-4 py-4 text-center space-y-1.5" style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))" }}>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <a href="#/blog" className="hover:text-primary transition-colors">Blog</a>
                  <a href="#/subscriptions" className="hover:text-primary transition-colors font-medium" style={{color:"hsl(var(--primary))"}}>Subscribe</a>
        {cmsLinks.map(p => (
          <a key={p.id} href={`#/p/${p.slug}`} className="hover:text-primary transition-colors">{p.title}</a>
        ))}
        <a href="#/contact" className="hover:text-primary transition-colors">Contact</a>
        <a href="#/terms" className="hover:text-primary transition-colors">Terms of Service</a>
        <a href="#/refund-policy" className="hover:text-primary transition-colors">Refund Policy</a>
      </div>
      <div>
        <span>AlbaTour — Albania Self-Guided Audio Tours</span>
        {"  ·  "}
        <span>&#169; {new Date().getFullYear()} All Rights Reserved</span>
      </div>
    </footer>
  );
}

function AppRoutes() {
  const [, navigate] = useLocation();
  const [ratingState, setRatingState] = useState<{
    siteId: number; siteSlug: string; siteName: string; trigger: "completion" | "exit"; listenedSeconds: number;
  } | null>(null);

  const handleAudioComplete = (track: AudioTrack, listenedSec: number) => {
    setRatingState({ siteId: track.siteId, siteSlug: track.siteSlug, siteName: track.siteName, trigger: "completion", listenedSeconds: listenedSec });
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <Router hook={useHashLocation}>
      <AudioPlayerProvider onComplete={handleAudioComplete} onNavigate={handleNavigate}>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        }>
        <Switch>
          {/* Admin */}
          <Route path="/admin" component={AdminPanel} />

          {/* Public routes */}
          <Route>
            <div className="flex flex-col min-h-screen bg-background text-foreground">
              {/* data-header-measure: MapPage reads this height to size the map correctly */}
              <div data-header-measure>
                <LaunchBanner />
                <NavBar />
              </div>
              <main className="flex-none"> {/* map page controls its own height; pb-28 added per-page */}
                <Switch>
                  <Route path="/" component={MapPage} />
                  <Route path="/sites" component={SitesPage} />
                  <Route path="/sites/:dest/:attr" component={AttractionDetailPage} />
                  <Route path="/sites/:dest" component={DestinationPage} />
                  <Route path="/passport" component={PassportPage} />
                  <Route path="/leaderboard" component={LeaderboardPage} />
              <Route path="/contact" component={ContactPage} />
              <Route path="/terms" component={TermsPage} />
              <Route path="/refund-policy" component={RefundPage} />
              <Route path="/blog" component={BlogPage} />
              <Route path="/subscriptions" component={SubscriptionsPage} />
              <Route path="/activate" component={ActivatePage} />
              <Route path="/reset-password" component={ResetPasswordPage} />
              <Route path="/p/:slug" component={CmsPageRenderer} />
                </Switch>
              </main>
              <DynamicFooter />
            </div>

            {/* WhatsApp floating button — bottom right, clears zoom controls and audio player */}
            <a
              href="https://wa.me/355686064077"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat with us on WhatsApp"
              title="Chat on WhatsApp"
              style={{
                position: "fixed",
                // RIGHT side. Zoom is now on LEFT on mobile, so no overlap.
                // On desktop zoom is right at ~11.5rem — WhatsApp at 8rem is below it.
                bottom: "8rem",
                right: "0.75rem",
                left: "auto",
                zIndex: 1500,
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "#25D366",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M16 2C8.268 2 2 8.268 2 16c0 2.4.636 4.65 1.748 6.6L2 30l7.6-1.72A13.94 13.94 0 0016 30c7.732 0 14-6.268 14-14S23.732 2 16 2z" fill="white"/>
                <path d="M23.5 19.9c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.89-.8-1.5-1.78-1.67-2.08-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51H12.5c-.2 0-.52.07-.79.37-.27.3-1.02 1-1.02 2.43 0 1.43 1.05 2.82 1.2 3.02.15.2 2.06 3.14 4.99 4.4.7.3 1.24.48 1.67.62.7.22 1.33.19 1.83.12.56-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z" fill="#25D366"/>
              </svg>
            </a>

          </Route>
        </Switch>

        {/* Rating sheet */}
        {ratingState && (
          <RatingSheet
            siteId={ratingState.siteId}
            siteSlug={ratingState.siteSlug}
            siteName={ratingState.siteName}
            trigger={ratingState.trigger}
            listenedSeconds={ratingState.listenedSeconds}
            onClose={() => setRatingState(null)}
          />
        )}
      </Suspense>
      </AudioPlayerProvider>
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider>
        <AppProviders>
          <AppRoutes />
          <Toaster />
        </AppProviders>
      </SubscriptionProvider>
    </QueryClientProvider>
  );
}
