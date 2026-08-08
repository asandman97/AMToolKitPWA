/* Fieldmark service worker.
   Bump VERSION whenever you change index.html, or phones keep serving the old copy. */
const VERSION = 'v5';
const SHELL = 'fieldmark-shell-' + VERSION;
const RUNTIME = 'fieldmark-runtime-' + VERSION;
const TILES = 'fieldmark-tiles';          /* not versioned: saved tiles survive updates */

const LOCAL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const VENDOR = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate-src.js'
];
const TILE_RE = /\/\d+\/\d+\/\d+(@2x)?(\.(png|jpe?g|webp))?$/;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(LOCAL);
    // Vendor files best-effort, so a CDN hiccup can't fail the whole install.
    await Promise.all(VENDOR.map(u => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = [SHELL, RUNTIME, TILES];
    for(const k of await caches.keys()) if(!keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // Map tiles: anything saved for offline wins, otherwise straight to the network.
  // Tiles are never cached automatically — only what "Save this view" put there.
  if(url.origin !== location.origin && TILE_RE.test(url.pathname)){
    e.respondWith(
      caches.open(TILES)
        .then(c => c.match(req.url))
        .then(hit => hit || fetch(req))
        .catch(() => fetch(req))
    );
    return;
  }

  // Page loads: fresh if possible, cached copy if the network is gone.
  if(req.mode === 'navigate'){
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }

  // Everything else: cache first, then network, remembering what we fetch.
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if(hit) return hit;
    try{
      const res = await fetch(req);
      if(res.ok && (url.origin === location.origin || VENDOR.includes(req.url))){
        const cache = await caches.open(RUNTIME);
        cache.put(req, res.clone());
      }
      return res;
    }catch(err){
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
