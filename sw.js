const CACHE_NAME = "arqueo-v1";

// Todos los recursos para cachear al instalar
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  // CDN resources — se cachean en el primer uso
];

// CDN origins a cachear dinamicamente
const CDN_ORIGINS = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdnjs.cloudflare.com",
  "unpkg.com",
];

// ── Install: pre-cachear shell ──────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS)
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: limpiar caches viejos ─────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Cache First para CDN, Network First para la app ──────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isCDN = CDN_ORIGINS.some((o) => url.hostname.includes(o));

  if (isCDN) {
    // Cache First — recursos externos no cambian seguido
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
  } else {
    // Network First — contenido propio, fallback a cache
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match("/index.html")))
    );
  }
});

// ── Mensaje desde la app ─────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
