/* Dawn PWA service worker — offline icons + last HTML fallback.
   Do not precache HTML routes. /dashboard redirects when logged out, and
   cache.addAll() then fails the whole install — the old worker keeps serving
   hashed /_next chunks from a previous deploy and the app white-screens.
   Bump CACHE when HTML/JS must not stay stuck on an old deploy. */
const CACHE = "dawn-v12";
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

function isAuthRoute(pathname) {
  return (
    pathname.startsWith("/api/auth") ||
    pathname === "/login" ||
    pathname === "/signup"
  );
}

function isNetworkFirst(req, url) {
  if (req.mode === "navigate") return true;
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/_next/")) return true;
  return url.pathname.endsWith(".js") || url.pathname.endsWith(".css");
}

function canCache(res) {
  return Boolean(res && res.ok && res.type === "basic" && !res.redirected);
}

function remember(req, res) {
  if (!canCache(res)) return;
  let copy;
  try {
    copy = res.clone();
  } catch {
    return;
  }
  caches.open(CACHE).then((cache) => cache.put(req, copy).catch(() => undefined));
}

function fallbackResponse(req) {
  const acceptsHtml =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");
  if (acceptsHtml) {
    return new Response(
      "<!doctype html><meta charset=utf-8><title>Dawn</title><p>You are offline. Reopen Dawn when you are back online.</p>",
      {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }
  return new Response("", {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Never touch POST/PATCH — iPhone Send now must hit Vercel directly.
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Do not intercept NextAuth or the sign-in pages.
  // A worker fetch of the Discord/Google callback drops the state/PKCE
  // cookies, so the first Continue fails and NextAuth sends the browser to
  // /login?callbackUrl=…&error=OAuthCallback. That login navigation is also
  // intercepted; when it redirects (already signed in → /dashboard) or the
  // network fails, caches.match() resolves to undefined and Chrome throws
  // "Failed to convert value to 'Response'".
  if (isAuthRoute(url.pathname)) return;

  if (isNetworkFirst(req, url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (req.mode === "navigate") remember(req, res);
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || fallbackResponse(req);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          remember(req, res);
          return res;
        })
        .catch(() => cached || fallbackResponse(req));
      return cached || network;
    })
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Dawn", body: "", url: "/dashboard", tag: "dawn" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    try {
      const text = event.data && event.data.text();
      if (text) data.body = text;
    } catch {
      /* ignore */
    }
  }
  const origin = self.location.origin;
  const title = data.title || "Dawn";
  const body = data.body || "Open Dawn.";
  const tag = data.tag || "dawn";
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body,
        icon: origin + "/icons/icon-192.png",
        badge: origin + "/icons/icon-192.png",
        tag,
        renotify: true,
        silent: false,
        requireInteraction: true,
        data: { url: data.url || "/dashboard" },
      }),
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) => {
          for (const client of clients) {
            client.postMessage({
              type: "dawn-push",
              title,
              body,
            });
          }
        }),
    ])
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
