// Service worker: guarda la app en caché para que abra sin conexión.
// Sube la versión cada vez que cambien los archivos de la app.
const CACHE = 'pocket-vet-v4';
const ARCHIVOS = [
  './',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/libreta.js',
  'js/perfil.js',
  'data/guias.json',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];
const ESPERA_RED = 3500; // ms antes de usar la copia guardada si la red está lenta

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const guardar = (req, res) => {
  // Las fuentes de Google llegan como respuestas "opacas": también se guardan
  if (res.ok || res.type === 'opaque') {
    const copia = res.clone();
    caches.open(CACHE).then(c => c.put(req, copia));
  }
  return res;
};

const desdeCache = req => caches.match(req, { ignoreSearch: true })
  .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined))
  .then(hit => hit || Response.error());

// Archivos propios: primero la red (para ver siempre la última versión); si no hay
// conexión o tarda demasiado, la copia guardada. Archivos externos (fuentes): primero la caché.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const propio = new URL(req.url).origin === location.origin;

  if (propio) {
    e.respondWith(new Promise(resolve => {
      let listo = false;
      const usarCache = () => { if (!listo) { listo = true; resolve(desdeCache(req)); } };
      const timer = setTimeout(usarCache, ESPERA_RED);
      fetch(req).then(res => {
        clearTimeout(timer);
        guardar(req, res);
        if (!listo) { listo = true; resolve(res); }
      }).catch(() => { clearTimeout(timer); usarCache(); });
    }));
  } else {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => guardar(req, res))));
  }
});
