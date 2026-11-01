// Service worker: guarda la app en caché para que abra sin conexión.
// Sube la versión cada vez que cambien los archivos de la app.
const CACHE = 'pocket-vet-v1';
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

// Primero la caché; si no está, la red (y se guarda para la próxima vez)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === location.origin) {
      const copia = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
    }
    return res;
  }).catch(() => caches.match('index.html'))));
});
