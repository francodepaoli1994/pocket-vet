// Service worker: guarda la app en caché para que abra sin conexión.
// Sube la versión cada vez que cambien los archivos de la app.
const CACHE = 'pocket-vet-v8';
const CACHE_DATOS = 'pv-datos'; // recordatorios que deja la app para avisar en segundo plano (no se borra al actualizar)
const ARCHIVOS = [
  './',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/libreta.js',
  'js/perfil.js',
  'js/sonidos.js',
  'js/notificaciones.js',
  'data/guias.json',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-96.png',
  'sonidos/tap.mp3',
  'sonidos/guardar.mp3',
  'sonidos/bienvenida.mp3',
  'sonidos/alerta.mp3',
  'sonidos/borrar.mp3',
];
const ESPERA_RED = 3500; // ms antes de usar la copia guardada si la red está lenta

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== CACHE_DATOS).map(k => caches.delete(k))))
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

// Recordatorios en segundo plano (Chrome Android con la app instalada): revisa las próximas
// fechas de la libreta y avisa en la barra del teléfono las que están a 3 días o menos.
async function avisarRecordatorios() {
  const c = await caches.open(CACHE_DATOS);
  const res = await c.match('datos/recordatorios.json');
  if (!res) return;
  const { mascota = '', recordatorios = [] } = await res.json();
  const hoy = new Date().toISOString().slice(0, 10);
  const avisadosRes = await c.match('datos/avisados.json');
  const avisados = avisadosRes ? await avisadosRes.json() : {};
  for (const r of recordatorios) {
    const d = Math.round((new Date(r.proxima + 'T12:00:00') - new Date(hoy + 'T12:00:00')) / 86400000);
    if (d < 0 || d > 3 || avisados[r.id] === hoy) continue;
    const cuando = d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`;
    await self.registration.showNotification(`${r.icono} ${r.titulo || r.tipoNombre} ${cuando}`, {
      body: `${mascota ? mascota + ': ' : ''}${r.tipoNombre} el ${r.proxima.split('-').reverse().join('-')}. Revisa la libreta de Pocket Vet.`,
      icon: 'icons/icon-192.png', badge: 'icons/favicon-96.png', tag: 'pv-' + r.id, data: { url: './#/libreta' },
    });
    avisados[r.id] = hoy;
  }
  await c.put('datos/avisados.json', new Response(JSON.stringify(avisados), { headers: { 'Content-Type': 'application/json' } }));
}

self.addEventListener('periodicsync', e => {
  if (e.tag === 'pv-recordatorios') e.waitUntil(avisarRecordatorios());
});

// Al tocar la notificación: abre la app en la libreta (o la trae al frente si ya está abierta)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    const abierta = lista.find(c => c.url.startsWith(self.registration.scope));
    if (abierta) { abierta.navigate(url); return abierta.focus(); }
    return self.clients.openWindow(url);
  }));
});
