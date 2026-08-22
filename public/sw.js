/* Dawn PWA service worker — offline icons + last HTML fallback.
   Do not precache HTML routes. /dashboard redirects when logged out, and
   cache.addAll() then fails the whole install — the old worker keeps serving
   hashed /_next chunks from a previous deploy and the app white-screens.
   Bump CACHE when HTML/JS must not stay stuck on an old deploy. */
const CACHE = "dawn-v8";
const PRECACHE = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isNetworkFirst(req, url) {
  if (req.mode === "navigate") return true;
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/_next/")) return true;
  return url.pathname.endsWith(".js") || url.pathname.endsWith(".css");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Never touch POST/PATCH — iPhone Send now must hit Vercel directly.
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Do not intercept NextAuth. On iPhone, a SW fetch of the Discord
  // callback drops the state/PKCE cookies, so the first Continue with
  // Discord fails and the second tap then works.
  if (url.pathname.startsWith("/api/auth")) return;

  if (isNetworkFirst(req, url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok && req.mode === "navigate") {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const fromData =
    event.notification.data && typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : "";
  const target = fromData || "/dashboard?ritual=1";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          c.navigate(target);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
