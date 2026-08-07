/* Fieldmark service worker.
   Bump VERSION whenever you change index.html, or phones keep the old copy. */
const VERSION = 'v1';
const SHELL = 'fieldmark-shell-' + VERSION;
const RUNTIME = 'fieldmark-runtime-' + VERSION;

const LOCAL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const VENDOR = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(LOCAL);
    // Vendor files are cached best-effort so a CDN hiccup can't fail the install.
    await Promise.all(VENDOR.map(u => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = [SHELL, RUNTIME];
    for(const k of await caches.keys()) if(!keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // Map tiles: always straight to the network. Caching them would fill the
  // storage quota fast, and iOS evicts it anyway. Delete this block if you
  // want offline tiles for a small area.
  if(/\/\d+\/\d+\/\d+(@2x)?(\.(png|jpe?g|webp|pbf))?$/.test(url.pathname) && url.origin !== location.origin) return;

  // Page loads: fresh if possible, cached copy if the network is gone.
  if(req.mode === 'navigate'){
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }

  // Everything else: cached first, then network, and remember what we fetch.
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
      return new Response('', { status:504, statusText:'Offline' });
    }
  })());
});
