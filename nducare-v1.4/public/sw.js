const VERSION = 'nducare-v3';
const SHELL = ['/', '/index.html', '/css/app.css', '/js/app.js', '/js/core.js', '/js/layout.js', '/js/pages/public.js', '/js/pages/patient.js', '/js/pages/doctor.js', '/js/pages/call.js', '/js/pages/map.js', '/vendor/leaflet/leaflet.js', '/vendor/leaflet/leaflet.css', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // API: network first, fall back to cache (so care plans & facilities remain readable offline)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) {
    if (url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/api/route')) return;
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION + '-api').then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
    return;
  }
  // map tiles: cache-first with cap
  if (url.hostname.endsWith('tile.openstreetmap.org')) { e.respondWith(caches.open(VERSION + '-tiles').then(async c => { const hit = await c.match(e.request); if (hit) return hit; const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => new Response('', { status: 504 }))); return; }
  // navigation: serve app shell
  if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).catch(() => caches.match('/index.html'))); return; }
  // static: stale-while-revalidate
  if (url.origin === location.origin) e.respondWith(caches.match(e.request).then(hit => { const net = fetch(e.request).then(r => { if (r.ok) caches.open(VERSION).then(c => c.put(e.request, r.clone())); return r; }).catch(() => hit); return hit || net; }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = e.notification.data?.url || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => { for (const c of list) { if ('focus' in c) { c.focus(); c.postMessage({ url }); return; } } return clients.openWindow(url); }));
});

self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'NduCare', body: e.data?.text() || '' }; }
  const urgent = d.tag === 'ring';
  e.waitUntil((async () => {
    // if a window is already open & focused, let the in-app banner handle it
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (!urgent && list.some(c => c.focused)) return;
    return self.registration.showNotification(d.title || 'NduCare', { body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/badge.png', tag: d.tag || 'nducare', renotify: urgent, requireInteraction: urgent, vibrate: urgent ? [300, 150, 300, 150, 300] : [100], data: { url: d.url || '/' }, actions: urgent ? [{ action: 'join', title: 'Join call' }] : [] });
  })());
});
