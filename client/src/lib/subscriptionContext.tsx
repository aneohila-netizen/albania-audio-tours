/**
 * Subscription context — manages the user's active subscription state.
 * Token stored in sessionStorage key "alb_sub_token" (survives refresh, not tab sharing).
 * On mount, checks token against server; auto-clears if expired or revoked.
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const RAILWAY_URL = "https://albania-audio-tours-production.up.railway.app";
const TOKEN_KEY = "alb_sub_token";

export interface SubStatus {
  active: boolean;
  planName?: string;
  planSlug?: string;
  expiresAt?: string;
  email?: string;
  checking: boolean;
}

interface SubContextType {
  sub: SubStatus;
  token: string | null;
  setToken: (t: string) => void;
  clearSub: () => void;
  recheckSub: () => void;
  daysLeft: number | null;
}

const SubContext = createContext<SubContextType>({
  sub: { active: false, checking: true },
  token: null,
  setToken: () => {},
  clearSub: () => {},
  recheckSub: () => {},
  daysLeft: null,
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
  });
  const [sub, setSub] = useState<SubStatus>({ active: false, checking: true });

  const check = useCallback(async (t: string | null) => {
    if (!t) { setSub({ active: false, checking: false }); return; }
    try {
      const res = await fetch(`${RAILWAY_URL}/api/subscription/check`, {
        headers: { "x-subscription-token": t },
      });
      const data = await res.json();
      if (data.active) {
        setSub({ active: true, planName: data.planName, planSlug: data.planSlug, expiresAt: data.expiresAt, email: data.email, checking: false });
      } else {
        // Token expired or revoked — clear it
        try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
        setTokenState(null);
        setSub({ active: false, checking: false });
      }
    } catch {
      // Network error — assume active if we have a token (fail-open for travelers with spotty WiFi)
      setSub({ active: !!t, checking: false });
    }
  }, []);

  useEffect(() => { check(token); }, [token]);

  function setToken(t: string) {
    try { sessionStorage.setItem(TOKEN_KEY, t); } catch {}
    setTokenState(t);
  }

  function clearSub() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
    setTokenState(null);
    setSub({ active: false, checking: false });
  }

  // Days remaining in subscription
  const daysLeft = sub.expiresAt
    ? Math.max(0, Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <SubContext.Provider value={{ sub, token, setToken, clearSub, recheckSub: () => check(token), daysLeft }}>
      {children}
    </SubContext.Provider>
  );
}

export function useSubscription() { return useContext(SubContext); }
