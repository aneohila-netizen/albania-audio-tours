/**
 * MapSideCards — desktop only. Uses the empty sea / neighbouring-country areas beside Albania on
 * the map for things a visitor can act on:
 *   left:  Download for offline (any destination), Unlock plans (only while the paywall is on)
 *   right: My Journey progress (real visited / points data)
 * Hidden below 1280px, where the map has no spare space. Each side can be closed for the session.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { X, Lock, BookOpen } from "lucide-react";
import { useApp } from "@/App";
import { useSubscription } from "@/lib/subscriptionContext";
import { getGlobalPaywallActive } from "@/components/PaywallGate";
import OfflinePackCard from "@/components/OfflinePackCard";
import { findNearestDestination, getSavedUserPosition } from "@/lib/nearestDestination";
import { getPacks } from "@/lib/offline";

interface Dest { slug: string; lat: number; lng: number }
interface Props {
  destinations: Dest[];
  destName: (slug: string) => string;
  /** hide while a pin sheet / guide / loading screen is open */
  suppressed?: boolean;
}

const HIDE_KEY = "alb_side_cards_hidden";
const readHidden = (): { left: boolean; right: boolean } => {
  try { return { left: false, right: false, ...JSON.parse(sessionStorage.getItem(HIDE_KEY) || "{}") }; } catch { return { left: false, right: false }; }
};

export default function MapSideCards({ destinations, destName, suppressed }: Props) {
  const { lang, visitedSiteIds, totalPoints } = useApp();
  const { sub } = useSubscription();
  const [hidden, setHidden] = useState(readHidden);
  const [globalLocked, setGlobalLocked] = useState<boolean | null>(null);
  const [slug, setSlug] = useState<string>("");

  useEffect(() => { getGlobalPaywallActive().then(setGlobalLocked); }, []);

  const sorted = useMemo(
    () => destinations.slice().sort((a, b) => destName(a.slug).localeCompare(destName(b.slug))),
    [destinations, destName],
  );

  // Default choice: a destination already saved on this device, else the nearest to the visitor, else A–Z first.
  useEffect(() => {
    if (slug || sorted.length === 0) return;
    const saved = Object.values(getPacks()).find(p => p.lang === lang && sorted.some(d => d.slug === p.slug));
    const pos = getSavedUserPosition();
    const nearest = pos ? findNearestDestination(sorted, pos)?.dest.slug : undefined;
    setSlug(saved?.slug || nearest || sorted[0].slug);
  }, [sorted, slug, lang]);

  const hide = (side: "left" | "right") => {
    const next = { ...hidden, [side]: true };
    setHidden(next);
    try { sessionStorage.setItem(HIDE_KEY, JSON.stringify(next)); } catch {}
  };

  if (suppressed || sorted.length === 0) return null;
  const showPlans = globalLocked === true && !sub.active;
  const close = (side: "left" | "right") => (
    <button
      type="button" aria-label="Hide these cards" onClick={() => hide(side)}
      className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-card border border-border shadow flex items-center justify-center text-muted-foreground hover:text-foreground"
    ><X size={12} /></button>
  );

  return (
    <>
      {!hidden.left && (
        <div className="hidden xl:flex flex-col gap-3 absolute z-[900] left-[18%] top-[24%] w-[21%] min-w-[230px] max-w-[300px] pointer-events-none" data-testid="map-side-left">
          <div className="relative pointer-events-auto rounded-xl bg-card/95 backdrop-blur shadow-lg border border-border p-3">
            {close("left")}
            <label className="block text-[11px] font-medium text-muted-foreground mb-1" htmlFor="side-dest">Destination</label>
            <select
              id="side-dest" value={slug} onChange={(e) => setSlug(e.target.value)}
              className="w-full mb-2 text-xs rounded-lg border border-border bg-background px-2 py-1.5"
              data-testid="side-dest-select"
            >
              {sorted.map(d => <option key={d.slug} value={d.slug}>{destName(d.slug)}</option>)}
            </select>
            {slug && <OfflinePackCard key={`${slug}:${lang}`} slug={slug} name={destName(slug)} compact />}
          </div>
          {showPlans && (
            <div className="pointer-events-auto rounded-xl bg-card/95 backdrop-blur shadow-lg border border-border p-3" data-testid="side-plans">
              <div className="flex items-start gap-2">
                <Lock size={15} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">Unlock every tour</div>
                  <p className="text-xs text-muted-foreground mt-0.5">A subscription opens all audio tours and itineraries, with offline downloads.</p>
                </div>
              </div>
              <Link href="/subscriptions">
                <span className="mt-2.5 flex items-center justify-center w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold cursor-pointer">See plans</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {!hidden.right && (
        <div className="hidden xl:block absolute z-[900] left-[61%] top-[24%] w-[21%] min-w-[230px] max-w-[300px] pointer-events-none" data-testid="map-side-right">
          <div className="relative pointer-events-auto rounded-xl bg-card/95 backdrop-blur shadow-lg border border-border p-3">
            {close("right")}
            <div className="flex items-start gap-2">
              <BookOpen size={15} className="text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-sm">My Journey</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {visitedSiteIds.size === 0
                    ? "Visit a destination to start collecting points and stamps."
                    : `${visitedSiteIds.size} ${visitedSiteIds.size === 1 ? "site" : "sites"} visited · ${totalPoints} pts`}
                </p>
              </div>
            </div>
            <Link href="/passport">
              <span className="mt-2.5 flex items-center justify-center w-full py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted cursor-pointer">Open My Journey</span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
