import { QueryClient, QueryFunction } from "@tanstack/react-query";

// APP_URL: use custom domain in production, Railway URL as fallback
export const RAILWAY_URL = "https://albaniaaudiotours.com";
export const RAILWAY_URL_FALLBACK = "https://albania-audio-tours-production.up.railway.app";
// Always use Railway URL directly — this frontend is statically hosted and always
// calls the Railway backend regardless of where it's served from.
const API_BASE = RAILWAY_URL;

/** Direct Railway fetch — always goes to Railway, never through Perplexity proxy */
export async function railwayFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${RAILWAY_URL}${path}`, { credentials: "include" });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, { credentials: "include" });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes — refreshes audio URLs when re-uploaded
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
