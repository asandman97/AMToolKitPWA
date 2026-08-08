/* OLS Plotter service worker.
   Shell is cached for offline use. Map tiles are network-first with a small
   runtime cache, so recently viewed imagery stays available offline. */
const SHELL = "ols-shell-v1";
const TILES = "ols-tiles-v1";
const SHELL_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== SHELL && k !== TILES).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isTile = /tile|basemaps|\.png$|\.jpg$/.test(url.pathname) && url.origin !== location.origin;
  const isVendor = /cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);

  if (isTile) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(TILES).then(c => c.put(req, copy).then(() => trim(TILES, 400)));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  if (isVendor || url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put(req, copy));
        return res;
      }).catch(() => hit))
    );
  }
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  if (keys.length > max) for (const k of keys.slice(0, keys.length - max)) await c.delete(k);
}
