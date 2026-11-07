/* AlbaniaAudioTours service worker
 *
 * Two jobs:
 *  1. Offline downloads: serves audio / pictures / data a visitor saved with "Download for offline".
 *  2. Weak-signal resilience: the app shell, data reads and fonts fall back to the last good copy
 *     when the network is slow or gone.
 *
 * Everything not listed below is left alone (map tiles, Google Places, admin, POSTs, ...).
 * Downloaded audio / data caches are user data: they are never purged when the worker updates.
 */
const VERSION = "v1";
const SHELL = "aat-shell-" + VERSION; // app shell + hashed assets (safe to rebuild)
const EXTRA = "aat-extra-" + VERSION; // third-party css / fonts (leaflet, fontshare)
const AUDIO = "aat-audio-v1"; // user downloads
const API = "aat-api-v1";
const IMG = "aat-img-v1";
const KEEP = [SHELL, EXTRA, AUDIO, API, IMG];

const AUDIO_PATH = /^\/api\/audio\/serve\/(site|attraction)\/(\d+)\/([a-z]{2})$/;
const API_PATH = /^\/api\/(sites|attractions|itineraries|ratings|cms\/pages|settings\/(paywall_active|free_until|itinerary_hero_image))(\/|$)/;
const EXTRA_HOSTS = ["unpkg.com", "api.fontshare.com", "cdn.fontshare.com"];
const WAIT_FOR_NETWORK_MS = 4000; // when a saved copy exists, how long to wait for the network first

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("aat-") && !KEEP.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

const audioKey = (url) => {
  const m = url.pathname.match(AUDIO_PATH);
  return m ? self.location.origin + "/__aat_audio/" + m[1] + "/" + m[2] + "/" + m[3] : null;
};

function timeout(ms) {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

// Network first; if a saved copy exists, use it when the network fails, errors, or is too slow.
async function networkFirst(req, cacheName, waitMs) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(req, { ignoreVary: true });
  const net = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  });
  if (!saved) return net;
  try {
    const res = await Promise.race([net, timeout(waitMs)]);
    return res && res.status < 500 ? res : saved;
  } catch (e) {
    return saved;
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(req, { ignoreVary: true });
  if (saved) return saved;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function shellNavigation(req) {
  const cache = await caches.open(SHELL);
  const saved = await cache.match("/index.html");
  const net = fetch(req).then((res) => {
    if (res && res.ok) cache.put("/index.html", res.clone()).catch(() => {});
    return res;
  });
  if (!saved) return net;
  try {
    const res = await Promise.race([net, timeout(WAIT_FOR_NETWORK_MS)]);
    return res && res.status < 500 ? res : saved;
  } catch (e) {
    return saved;
  }
}

// Serves a saved audio file, including the byte ranges <audio> asks for.
async function audioResponse(req, key, requestedVersion) {
  const cache = await caches.open(AUDIO);
  const saved = await cache.match(key);
  if (!saved) return fetch(req); // not downloaded: behave exactly as before
  const savedVersion = saved.headers.get("x-aat-v");
  if (requestedVersion && savedVersion && requestedVersion !== savedVersion) {
    // The audio was re-generated after the download: prefer the new one, keep the old as a fallback.
    try {
      const res = await Promise.race([fetch(req), timeout(WAIT_FOR_NETWORK_MS)]);
      if (res && res.status < 500) return res;
    } catch (e) {
      /* fall through to the saved copy */
    }
  }
  const type = saved.headers.get("content-type") || "audio/mpeg";
  const blob = await saved.blob();
  const total = blob.size;
  const range = req.headers.get("range");
  if (!range) {
    return new Response(blob, { status: 200, headers: { "Content-Type": type, "Content-Length": String(total), "Accept-Ranges": "bytes" } });
  }
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : total - 1;
  if (m && !m[1] && m[2]) {
    start = Math.max(0, total - parseInt(m[2], 10)); // suffix range
    end = total - 1;
  }
  if (isNaN(start) || start >= total) {
    return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + total } });
  }
  end = Math.min(isNaN(end) ? total - 1 : end, total - 1);
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": type,
      "Content-Length": String(end - start + 1),
      "Content-Range": "bytes " + start + "-" + end + "/" + total,
      "Accept-Ranges": "bytes",
    },
  });
}

async function imageResponse(req) {
  const cache = await caches.open(IMG);
  const saved = await cache.match(req.url, { ignoreVary: true });
  return saved || fetch(req);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  const sameOrigin = url.origin === self.location.origin;

  // 1. Saved audio (any origin: the app points at the API host, packs are keyed by path)
  const key = audioKey(url);
  if (key) {
    event.respondWith(audioResponse(req, key, url.searchParams.get("v")));
    return;
  }

  // 2. App shell: the single-page entry document
  if (req.mode === "navigate" && sameOrigin && (url.pathname === "/" || url.pathname === "/index.html")) {
    event.respondWith(shellNavigation(req));
    return;
  }

  // 3. Hashed build files never change under the same name
  if (sameOrigin && url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(req, SHELL));
    return;
  }
  if (sameOrigin && /^\/(manifest\.json|favicon[^/]*|icon-\d+\.png|apple-touch-icon\.png|mascot\/.+)$/.test(url.pathname)) {
    event.respondWith(networkFirst(req, SHELL, WAIT_FOR_NETWORK_MS)); // art can be replaced under the same name
    return;
  }

  // 4. Data reads the pages make
  if (url.pathname.startsWith("/api/") && API_PATH.test(url.pathname)) {
    event.respondWith(networkFirst(req, API, WAIT_FOR_NETWORK_MS));
    return;
  }

  // 5. Pictures saved with a pack (picture bucket); everything else about images is untouched
  if (req.destination === "image" && /\.r2\.dev$/.test(url.hostname)) {
    event.respondWith(imageResponse(req));
    return;
  }

  // 6. Map stylesheet and fonts from third parties: keep the first copy
  if (EXTRA_HOSTS.indexOf(url.hostname) !== -1) {
    event.respondWith(cacheFirst(req, EXTRA));
  }
});
