// Service worker de Zona Final: guarda el juego para que abra sin conexión.
// Cuando cambies index.html, sube el número de versión para que los teléfonos descarguen la nueva.
const VERSION = 'zf-v7';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Páginas (incluye enlaces de invitación ?sala=XXXX): primero red, si no hay, la copia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Archivos propios y la librería PeerJS: primero la copia guardada, y se actualiza en segundo plano.
  const sameOrigin = url.origin === self.location.origin;
  const isPeer = /peerjs@1\.5\.4/.test(url.href);
  if (!sameOrigin && !isPeer) return; // el resto (servidor de PeerJS, etc.) va directo a la red

  e.respondWith(
    caches.match(req, { ignoreSearch: sameOrigin }).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
