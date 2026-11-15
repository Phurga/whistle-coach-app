// Offline support for the installed app. Everything runs on the device; this only keeps the
// app's files (and the last shared tune list) so it opens without a connection.
//  - the page itself: network first (so updates show up), cached copy when offline
//  - hashed build files (assets/*), icons: cache first (their names change when they change)
//  - the shared tune list: network first, last copy when offline
const CACHE = 'whistle-coach-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    throw e;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('.workers.dev') && url.pathname === '/tunes') { event.respondWith(networkFirst(req)); return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // local dev API: never cache
  if (req.mode === 'navigate') { event.respondWith(networkFirst(req)); return; }
  event.respondWith(cacheFirst(req));
});
