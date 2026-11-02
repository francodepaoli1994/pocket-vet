// Notificaciones locales de recordatorios (sin servidor).
// Avisan en la barra del teléfono cuando una próxima fecha de la libreta está a 3 días o menos:
// al abrir la app y, si el teléfono lo permite (Chrome Android con la app instalada),
// también en segundo plano con Periodic Background Sync desde el service worker.

import * as libreta from './libreta.js';
import { t } from './i18n.js';

const DIAS_AVISO = 3;
const CLAVE_AVISADOS = 'pv_avisados'; // { idRegistro: 'AAAA-MM-DD' } para no repetir el aviso el mismo día
const CACHE_DATOS = 'pv-datos';      // el service worker no puede leer localStorage: le dejamos los datos aquí
export const URL_DATOS = 'datos/recordatorios.json';

export const soportado = () => 'Notification' in window && 'serviceWorker' in navigator;
export const permiso = () => (soportado() ? Notification.permission : 'unsupported');

const hoy = () => new Date().toISOString().slice(0, 10);
const dias = iso => Math.round((new Date(iso + 'T12:00:00') - new Date(hoy() + 'T12:00:00')) / 86400000);

export function texto(r, nombreMascota) {
  const tp = libreta.tipo(r.tipo);
  const d = dias(r.proxima);
  const cuando = d === 0 ? t('notif.hoy') : d === 1 ? t('notif.manana') : t('notif.enDias', { n: d });
  return {
    titulo: `${tp.icono} ${r.titulo || tp.nombre} ${cuando}`,
    cuerpo: `${nombreMascota ? nombreMascota + ': ' : ''}${t('notif.cuerpo', { tipo: tp.nombre, fecha: r.proxima.split('-').reverse().join('-') })}`,
  };
}

function pendientes() {
  return libreta.leer().filter(r => r.proxima && dias(r.proxima) >= 0 && dias(r.proxima) <= DIAS_AVISO);
}

// Copia los recordatorios para que el service worker pueda avisar con la app cerrada
export async function sincronizar(nombreMascota) {
  if (!('caches' in window)) return;
  // El texto ("mañana", "en 2 días") lo arma el service worker el día que avisa
  const datos = libreta.leer().filter(r => r.proxima).map(r => {
    const tp = libreta.tipo(r.tipo);
    return { id: r.id, icono: tp.icono, tipoNombre: tp.nombre, titulo: r.titulo, proxima: r.proxima };
  });
  // Textos en el idioma actual para que el service worker arme el aviso
  const textos = { hoy: t('notif.hoy'), manana: t('notif.manana'), enDias: t('notif.enDias'), cuerpo: t('notif.cuerpo') };
  const c = await caches.open(CACHE_DATOS);
  await c.put(URL_DATOS, new Response(JSON.stringify({ mascota: nombreMascota || '', textos, recordatorios: datos }), { headers: { 'Content-Type': 'application/json' } }));
}

// Muestra en la barra del teléfono los recordatorios cercanos que aún no se avisaron hoy
export async function avisar(nombreMascota) {
  if (permiso() !== 'granted') return 0;
  const reg = await navigator.serviceWorker.ready;
  let avisados = {};
  try { avisados = JSON.parse(localStorage.getItem(CLAVE_AVISADOS)) || {}; } catch { /* vacío */ }
  let n = 0;
  for (const r of pendientes()) {
    if (avisados[r.id] === hoy()) continue;
    const { titulo, cuerpo } = texto(r, nombreMascota);
    await reg.showNotification(titulo, { body: cuerpo, icon: 'icons/icon-192.png', badge: 'icons/favicon-96.png', tag: 'pv-' + r.id, data: { url: './#/libreta' } });
    avisados[r.id] = hoy();
    n++;
  }
  try { localStorage.setItem(CLAVE_AVISADOS, JSON.stringify(avisados)); } catch { /* sin almacenamiento */ }
  return n;
}

// Pide permiso (debe llamarse desde un toque del usuario) y registra la revisión en segundo plano
export async function activar(nombreMascota) {
  if (!soportado()) return 'unsupported';
  const p = await Notification.requestPermission();
  if (p !== 'granted') return p;
  const reg = await navigator.serviceWorker.ready;
  if ('periodicSync' in reg) {
    try { await reg.periodicSync.register('pv-recordatorios', { minInterval: 12 * 60 * 60 * 1000 }); } catch { /* requiere app instalada */ }
  }
  await sincronizar(nombreMascota);
  return p;
}

export async function probar() {
  if (permiso() !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('🐾 Pocket Vet', { body: t('notif.pruebaCuerpo'), icon: 'icons/icon-192.png', badge: 'icons/favicon-96.png', tag: 'pv-prueba', data: { url: './#/libreta' } });
  return true;
}
