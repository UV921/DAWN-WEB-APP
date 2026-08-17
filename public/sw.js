/* Dawn PWA service worker — cache shell for offline open.
   Bump CACHE when HTML/JS must not stay stuck on an old deploy. */
const CACHE = "dawn-v4";
const PRECACHE = [
  "/",
  "/login",
  "/dashboard",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
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
  const target = "/dashboard?ritual=1";
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
