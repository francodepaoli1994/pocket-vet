// Service worker: guarda la app en caché para que abra sin conexión.
// Sube la versión cada vez que cambien los archivos de la app.
const CACHE = 'pocket-vet-v2';
const ARCHIVOS = [
  './',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'data/guias.json',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Archivos propios: primero la red (para ver siempre la última versión) y, sin conexión, la caché.
// Archivos externos (fuentes de Google): primero la caché.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const propio = new URL(e.request.url).origin === location.origin;
  const guardar = res => {
    if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
    return res;
  };
  if (propio) {
    e.respondWith(fetch(e.request).then(guardar)
      .catch(() => caches.match(e.request).then(hit => hit || caches.match('index.html'))));
  } else {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(guardar)));
  }
});
