// Minimal offline support: network first, falling back to the last cached copy of the app shell. Never caches API calls.
const CACHE = 'aram-shell-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;          // Supabase, fonts, etc. go straight to the network
  e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))));
});
