// Pocket Vet · PWA
// Router por hash: #/inicio, #/guias, #/guias/<id>, #/libreta, #/perfil

import * as libreta from './libreta.js';
import * as perfil from './perfil.js';
import * as sonidos from './sonidos.js';
import * as notif from './notificaciones.js';

const GUIAS_URL = 'data/guias.json';

// Texto propio con **negrita**; se escapa antes de dar formato
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const fecha = iso => iso.split('-').reverse().join('-');

let guiasCache;
function cargarGuias() {
  if (!guiasCache) guiasCache = fetch(GUIAS_URL).then(r => r.json()).catch(() => []);
  return guiasCache;
}

const sello = g => g.verificada
  ? '<span class="seal">✓ Verificada</span>'
  : '<span class="seal draft">En revisión</span>';

const screens = {
  inicio: {
    titulo: () => 'Pocket Vet',
    render: () => {
      const p = perfil.leer();
      if (!p) return perfil.form(true); // primer uso: onboarding
      return `${perfil.tarjeta(p)}
      <div class="tiles">
        <a class="tile" href="#/guias"><span class="e">📖</span>Guías</a>
        <a class="tile" href="#/libreta"><span class="e">🗒️</span>Libreta</a>
        <a class="tile" href="#/guias/alimentacion-${p.especie}"><span class="e">🥕</span>¿Puede comer?</a>
        <a class="tile" href="#/libreta"><span class="e">⏰</span>Recordatorios</a>
      </div>
      ${proximasHtml()}`;
    },
  },
  guias: {
    titulo: () => 'Guías',
    render: async () => `<h2>Guías de cuidado</h2>
      <div class="buscador">
        <input type="search" data-buscar placeholder="Buscar: vacuna, chocolate, baño…" value="${esc(busqueda)}" autocomplete="off" aria-label="Buscar guías">
      </div>
      <div data-resultados>${await listaGuias()}</div>`,
  },
  guia: {
    titulo: async id => ((await cargarGuias()).find(g => g.id === id) || {}).titulo || 'Guía',
    render: async id => {
      const g = (await cargarGuias()).find(x => x.id === id);
      if (!g) return `<h2>Guía no encontrada</h2><p><a href="#/guias">Volver a las guías</a></p>`;
      return renderGuia(g);
    },
  },
  libreta: {
    titulo: () => 'Libreta',
    render: id => libreta.render(id),
  },
  perfil: {
    titulo: () => 'Perfil',
    render: () => `<h2>Perfil de la mascota</h2>${perfil.form(!perfil.leer())}${perfil.leer() ? ajustesHtml() : ''}`,
  },
};

// Ajustes en Perfil: sonidos y recordatorios en la barra del teléfono
function ajustesHtml() {
  const p = notif.permiso();
  const estado = {
    granted: '✅ Activados. Te avisaremos 3 días antes de cada próxima fecha de la libreta.',
    denied: '🚫 Bloqueados. Actívalos en los ajustes del navegador o del teléfono para Pocket Vet.',
    default: 'Recibe un aviso en la barra del teléfono antes de cada vacuna o desparasitación.',
    unsupported: 'Este navegador no permite notificaciones.',
  }[p];
  return `<div class="card ajustes">
    <h3>Ajustes</h3>
    <label class="switch"><span>🔊 Sonidos de la app</span>
      <input type="checkbox" data-sonido ${sonidos.silenciado() ? '' : 'checked'}></label>
    <div class="ajuste-notif">
      <b>🔔 Recordatorios en el celular</b>
      <p>${estado}</p>
      <div class="acciones">
        ${p === 'default' ? '<button class="btn" type="button" data-notif-activar>Activar recordatorios</button>' : ''}
        ${p === 'granted' ? '<button class="btn sec" type="button" data-notif-probar>Probar notificación</button>' : ''}
      </div>
    </div>
  </div>`;
}

document.addEventListener('change', e => {
  if (e.target.matches('[data-sonido]')) {
    // Al apagar suena antes de silenciar; al encender, después
    if (!e.target.checked) sonidos.play('interruptor');
    sonidos.silenciar(!e.target.checked);
    if (e.target.checked) sonidos.play('interruptor');
  }
});
document.addEventListener('click', async e => {
  const p = perfil.leer();
  if (e.target.closest('[data-notif-activar]')) {
    const r = await notif.activar(p && p.nombre);
    sonidos.play(r === 'granted' ? 'guardar' : 'error');
    if (r === 'granted') { await notif.probar(); await notif.avisar(p && p.nombre); }
    navegar();
  }
  if (e.target.closest('[data-notif-probar]')) notif.probar();
});

// Suena una vez cuando la alerta "Ve al veterinario" aparece en pantalla
function vigilarAlerta() {
  const alerta = document.querySelector('.alerta');
  if (!alerta || !('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver(entradas => {
    if (entradas.some(x => x.isIntersecting)) { sonidos.play('alerta'); obs.disconnect(); }
  }, { threshold: 0.6 });
  obs.observe(alerta);
  window.addEventListener('hashchange', () => obs.disconnect(), { once: true });
}

// Buscador: ignora tildes y mayúsculas; busca en título, etiquetas, resumen y subtítulos
let busqueda = '';
let verTodas = false;
const normal = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const textoGuia = g => normal([g.titulo, g.especie, ...g.etiquetas, ...g.resumen,
  ...g.bloques.filter(b => b.h).map(b => b.h),
  ...g.bloques.filter(b => b.ul).flatMap(b => b.ul),
  ...g.bloques.filter(b => b.tabla2).flatMap(b => [...b.tabla2.ok, ...b.tabla2.no].map(([nombre]) => nombre)), // alimentos y acciones
].join(' '));
const SUGERENCIAS = ['vacuna', 'chocolate', 'parásitos', 'baño', 'urgencia', 'lirio'];

async function listaGuias() {
  const p = perfil.leer();
  const guias = await cargarGuias();
  const especie = p && !verTodas ? perfil.ESPECIES[p.especie].nombre : null;
  const palabras = normal(busqueda).split(/\s+/).filter(Boolean);
  const visibles = guias
    .filter(g => !especie || normal(g.especie).includes(normal(especie)))
    .filter(g => palabras.every(w => textoGuia(g).includes(w)));

  const filtro = p ? `<p class="filtro">${verTodas
    ? `Mostrando todas las guías · <button type="button" data-filtro>Solo ${perfil.ESPECIES[p.especie].nombre.toLowerCase()}</button>`
    : `Guías para ${perfil.ESPECIES[p.especie].nombre.toLowerCase()} · <button type="button" data-filtro>Ver todas</button>`}</p>` : '';

  if (!visibles.length) {
    const enOtras = especie && guias.some(g => palabras.every(w => textoGuia(g).includes(w)));
    return `${filtro}<div class="card vacio-busqueda"><p>No encontramos guías para «${esc(busqueda)}»${especie ? ` en las guías de ${especie.toLowerCase()}` : ''}.</p>
      ${enOtras ? `<p><button type="button" class="chip" data-filtro>Ver resultados en todas las guías</button></p>` : ''}
      <p>Prueba con: ${SUGERENCIAS.map(s => `<button type="button" class="chip" data-sugerencia="${s}">${s}</button>`).join(' ')}</p></div>`;
  }
  return `${filtro}<div class="card"><ul class="list">${visibles.map(g => `
    <li><a class="row" href="#/guias/${g.id}" aria-label="${esc(g.titulo)}, ${g.verificada ? 'verificada' : 'en revisión'}">
      <span class="dot">${g.icono}</span>
      <div><b>${esc(g.titulo)}</b><small>${esc(g.especie)}</small></div>
      ${sello(g)}<span class="chev" aria-hidden="true">›</span>
    </a></li>`).join('')}</ul></div>`;
}

// Actualiza solo los resultados, así el teclado no se cierra mientras escribes
let timerVacio;
async function refrescarResultados(escribiendo = false) {
  const cont = document.querySelector('[data-resultados]');
  if (!cont) return;
  cont.innerHTML = await listaGuias();
  // Si lo que escribe no encuentra nada, avisa con un sonido cuando deja de escribir
  clearTimeout(timerVacio);
  if (escribiendo && busqueda.trim() && cont.querySelector('.vacio-busqueda')) timerVacio = setTimeout(() => sonidos.play('vacio'), 700);
}
document.addEventListener('input', e => {
  if (!e.target.matches('[data-buscar]')) return;
  busqueda = e.target.value;
  refrescarResultados(true);
});
document.addEventListener('click', e => {
  if (e.target.closest('[data-filtro]')) { verTodas = !verTodas; refrescarResultados(); }
  const sug = e.target.closest('[data-sugerencia]');
  if (sug) {
    busqueda = sug.dataset.sugerencia;
    const input = document.querySelector('[data-buscar]');
    if (input) input.value = busqueda;
    refrescarResultados();
  }
});

function proximasHtml() {
  const prox = libreta.proximas(2);
  if (!prox.length) return `<div class="card"><h3>Próximos recordatorios</h3><p>Aún no tienes recordatorios. Agrega una próxima fecha en la <a href="#/libreta">libreta</a>.</p></div>`;
  return `<div class="card"><h3>Próximos recordatorios</h3><ul class="list">${prox.map(r => {
    const t = libreta.TIPOS[r.tipo] || libreta.TIPOS.nota;
    return `<li><a class="row" href="#/libreta"><span class="dot">${t.icono}</span>
      <div><b>${esc(r.titulo) || t.nombre}</b><small>${t.nombre} · ${fecha(r.proxima)}</small></div></a></li>`;
  }).join('')}</ul></div>`;
}

function renderGuia(g) {
  const r = g.revision;
  const cabecera = `
    <a class="back" href="#/guias">‹ Guías</a>
    <div class="g-head">
      <span class="g-ico">${g.icono}</span>
      <div><h2>${esc(g.titulo)}</h2><small>${esc(g.especie)} · ${esc(g.etapa)}</small></div>
    </div>
    ${r
      ? `<div class="verified">✓ <b>Verificado por veterinario</b><span>${esc(r.revisora)}, ${esc(r.titulo)} · Revisión del ${fecha(r.fecha)}</span></div>`
      : `<div class="verified draft">⏳ <b>En revisión veterinaria</b><span>Esta guía aún no tiene el sello de verificado.</span></div>`}
    <div class="card resumen"><h3>En 30 segundos</h3><ul>${g.resumen.map(t => `<li>${fmt(t)}</li>`).join('')}</ul></div>`;

  const cuerpo = g.bloques.map(bloque).join('');

  const fuentes = `
    <h3 class="g-h">Fuentes</h3>
    <ol class="fuentes">${g.fuentes.map(f => `<li>${esc(f.texto)}. <a href="${esc(f.url)}" target="_blank" rel="noopener">Ver fuente</a></li>`).join('')}</ol>
    <p class="aviso">Esta guía entrega información general de cuidado y no reemplaza la consulta con un médico veterinario.</p>`;

  return cabecera + cuerpo + fuentes;
}

let tabsId = 0;
function bloque(b) {
  if (b.h) return `<h3 class="g-h">${esc(b.h)}</h3>`;
  if (b.p) return `<p class="g-p">${fmt(b.p)}</p>`;
  if (b.ul) return `<ul class="g-ul">${b.ul.map(t => `<li>${fmt(t)}</li>`).join('')}</ul>`;
  if (b.num) return `<ol class="g-ol">${b.num.map(t => `<li>${fmt(t)}</li>`).join('')}</ol>`;
  if (b.tip) return `<div class="tip"><b>Consejo:</b> ${fmt(b.tip)}</div>`;
  if (b.table) {
    const t = b.table;
    return `<div class="tbl"><table>
      <thead><tr>${t.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${t.rows.map(row => `<tr>${row.map((c, i) => i ? `<td>${fmt(c)}</td>` : `<th scope="row">${fmt(c)}</th>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  }
  if (b.tabla2) {
    // Dos pestañas: "Puede comer" / "Nunca darle" (o "Qué hacer" / "Qué NO hacer")
    const t = b.tabla2, id = `tabs${++tabsId}`;
    const lista = (filas, cls) => `<ul class="pares ${cls}">${filas.map(([a, d]) => `<li><b>${fmt(a)}</b><span>${fmt(d)}</span></li>`).join('')}</ul>`;
    return `<div class="tabs" id="${id}">
      <div class="tabs-nav" role="tablist">
        <button role="tab" class="ok on" aria-selected="true" data-panel="0">✓ ${esc(t.okTitulo)}</button>
        <button role="tab" class="no" aria-selected="false" data-panel="1">✕ ${esc(t.noTitulo)}</button>
      </div>
      <div class="tabs-panel" data-panel="0">${lista(t.ok, 'ok')}</div>
      <div class="tabs-panel" data-panel="1" hidden>${lista(t.no, 'no')}</div>
    </div>`;
  }
  if (b.alerta) {
    const a = b.alerta;
    return `<div class="alerta" role="note"><h3>⚠️ ${esc(a.titulo)}</h3>
      <ul>${a.items.map(t => `<li>${fmt(t)}</li>`).join('')}</ul>
      ${a.nota ? `<p><b>Importante:</b> ${fmt(a.nota)}</p>` : ''}</div>`;
  }
  if (b.contactos) {
    const c = leerContactos();
    const campo = (k, label, ph) => `<label>${label}<input name="${k}" value="${esc(c[k] || '')}" placeholder="${ph}" autocomplete="off"></label>`;
    return `<h3 class="g-h">Mis contactos de emergencia</h3>
      <form class="card contactos" data-contactos>
        ${campo('vet', 'Mi veterinario', 'Nombre y teléfono')}
        ${campo('urgencia', 'Urgencia veterinaria 24 h', 'Clínica y teléfono')}
        ${campo('otro', 'Otro contacto', 'Nombre y teléfono')}
        <small>Se guarda solo en este teléfono.</small>
      </form>`;
  }
  return '';
}

function leerContactos() {
  try { return JSON.parse(localStorage.getItem('pv_contactos')) || {}; } catch { return {}; }
}

// Pestañas y formulario de contactos (delegación de eventos)
document.addEventListener('click', e => {
  const btn = e.target.closest('.tabs-nav button');
  if (!btn) return;
  const tabs = btn.closest('.tabs');
  tabs.querySelectorAll('.tabs-nav button').forEach(b => {
    const on = b === btn; b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
  });
  tabs.querySelectorAll('.tabs-panel').forEach(p => { p.hidden = p.dataset.panel !== btn.dataset.panel; });
});
document.addEventListener('input', e => {
  const form = e.target.closest('[data-contactos]');
  if (!form) return;
  const datos = Object.fromEntries(new FormData(form));
  try { localStorage.setItem('pv_contactos', JSON.stringify(datos)); } catch { /* sin almacenamiento */ }
});

async function navegar() {
  let [ruta, param] = (location.hash.replace('#/', '') || 'inicio').split('/');
  const id = ruta === 'guias' && param ? 'guia' : ruta;
  if (id === 'libreta' && param) param = decodeURIComponent(param);
  const screen = screens[id] || screens.inicio;
  const main = document.getElementById('screen');
  document.getElementById('screen-title').textContent = await screen.titulo(param);
  main.innerHTML = await screen.render(param);
  window.scrollTo(0, 0);
  const tab = ruta in screens ? ruta : 'inicio';
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  if (id === 'guia') vigilarAlerta();
  // Mantiene al día los recordatorios para el aviso en segundo plano y avisa los cercanos
  const p = perfil.leer();
  notif.sincronizar(p && p.nombre).then(() => notif.avisar(p && p.nombre)).catch(() => {});
}

function estadoConexion() {
  document.getElementById('offline-badge').hidden = navigator.onLine;
}

libreta.conectar(navegar);
perfil.conectar(navegar);
window.addEventListener('hashchange', navegar);
window.addEventListener('online', estadoConexion);
window.addEventListener('offline', estadoConexion);
navegar();
estadoConexion();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
