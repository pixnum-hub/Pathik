const VERSION = "pathik-v2026-09-07-04";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const TILE_CACHE = `${VERSION}-tiles`;
const SHELL_FILES = ["./", "./index.html", "./manifest.json", "./offline.html", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL).then(cache => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => ![SHELL, RUNTIME, TILE_CACHE].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isTile(url) {
  return /tile\.openstreetmap\.org|tile-a\.openstreetmap\.fr|opentopomap\.org|arcgisonline\.com\/ArcGIS\/rest\/services\/.+\/tile\//i.test(url.hostname + url.pathname);
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        const copy = response.clone();
        caches.open(RUNTIME).then(c => c.put("./index.html", copy)).catch(() => {});
        return response;
      }).catch(() => caches.match(request).then(r => r || caches.match("./index.html") || caches.match("./offline.html")))
    );
    return;
  }

  if (isTile(url)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request).then(response => {
          if (response && (response.ok || response.type === "opaque")) {
            const copy = response.clone();
            caches.open(TILE_CACHE).then(c => c.put(request, copy)).catch(() => {});
          }
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(RUNTIME).then(c => c.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match("./offline.html")))
  );
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
