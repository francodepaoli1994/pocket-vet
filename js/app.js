// Pocket Vet · PWA
// Router por hash: #/inicio, #/guias, #/guias/<id>, #/libreta, #/perfil

import * as libreta from './libreta.js';
import * as perfil from './perfil.js';
import * as sonidos from './sonidos.js';
import * as notif from './notificaciones.js';
import { t, idioma, cambiar as cambiarIdioma, IDIOMAS } from './i18n.js';

// Las guías en español son las verificadas; las demás son traducciones (data/guias.<idioma>.json)
const guiasUrl = () => (idioma() === 'es' ? 'data/guias.json' : `data/guias.${idioma()}.json`);

// Texto propio con **negrita**; se escapa antes de dar formato
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const fecha = iso => iso.split('-').reverse().join('-');

const guiasCache = {};
function cargarGuias() {
  const url = guiasUrl();
  if (!guiasCache[url]) {
    guiasCache[url] = fetch(url).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .catch(() => fetch('data/guias.json').then(r => r.json())).catch(() => []);
  }
  return guiasCache[url];
}

const sello = g => g.verificada
  ? `<span class="seal">${t('sello.ok')}</span>`
  : `<span class="seal draft">${t('sello.draft')}</span>`;

const screens = {
  inicio: {
    titulo: () => 'Pocket Vet',
    render: () => {
      const p = perfil.leer();
      if (!p) return perfil.form(true); // primer uso: onboarding
      return `${perfil.tarjeta(p)}
      <div class="tiles">
        <a class="tile" href="#/guias"><span class="e">📖</span>${t('nav.guias')}</a>
        <a class="tile" href="#/libreta"><span class="e">🗒️</span>${t('nav.libreta')}</a>
        <a class="tile" href="#/guias/alimentacion-${p.especie}"><span class="e">🥕</span>${t('tile.comer')}</a>
        <a class="tile" href="#/libreta"><span class="e">⏰</span>${t('tile.recordatorios')}</a>
      </div>
      ${proximasHtml()}`;
    },
  },
  guias: {
    titulo: () => t('nav.guias'),
    render: async () => `<h2>${t('guias.titulo')}</h2>
      <div class="buscador">
        <input type="search" data-buscar placeholder="${esc(t('guias.buscar'))}" value="${esc(busqueda)}" autocomplete="off" aria-label="${esc(t('guias.buscarAria'))}">
      </div>
      <div data-resultados>${await listaGuias()}</div>`,
  },
  guia: {
    titulo: async id => ((await cargarGuias()).find(g => g.id === id) || {}).titulo || t('guia'),
    render: async id => {
      const g = (await cargarGuias()).find(x => x.id === id);
      if (!g) return `<h2>${t('guia.noEncontrada')}</h2><p><a href="#/guias">${t('guia.volver')}</a></p>`;
      return renderGuia(g);
    },
  },
  libreta: {
    titulo: () => t('nav.libreta'),
    render: id => libreta.render(id),
  },
  perfil: {
    titulo: () => t('nav.perfil'),
    render: () => `<h2>${t('perfil.titulo')}</h2>${perfil.form(!perfil.leer())}${perfil.leer() ? ajustesHtml() : ''}`,
  },
};

// Selector de idioma: banderas en la barra superior y en Ajustes
const banderas = (clase = '') => `<div class="idiomas ${clase}" role="radiogroup" aria-label="${esc(t('idioma'))}">${Object.entries(IDIOMAS).map(([k, i]) => `
  <button type="button" role="radio" aria-checked="${k === idioma()}" class="idioma ${k === idioma() ? 'on' : ''}" data-idioma="${k}" title="${i.nombre}">
    <img src="${i.bandera}" alt="" width="24" height="16"><span>${i.nombre}</span></button>`).join('')}</div>`;

// Ajustes en Perfil: idioma, sonidos y recordatorios en la barra del teléfono
function ajustesHtml() {
  const p = notif.permiso();
  return `<div class="card ajustes">
    <h3>${t('ajustes')}</h3>
    <div><b class="ajuste-label">🌐 ${t('idioma')}</b>${banderas('lista')}</div>
    <label class="switch"><span>${t('ajustes.sonidos')}</span>
      <input type="checkbox" data-sonido ${sonidos.silenciado() ? '' : 'checked'}></label>
    <div class="ajuste-notif">
      <b>${t('notif.titulo')}</b>
      <p>${t('notif.' + p)}</p>
      <div class="acciones">
        ${p === 'default' ? `<button class="btn" type="button" data-notif-activar>${t('notif.activar')}</button>` : ''}
        ${p === 'granted' ? `<button class="btn sec" type="button" data-notif-probar>${t('notif.probar')}</button>` : ''}
      </div>
    </div>
  </div>`;
}

// Textos fijos del index.html (barra inferior, aviso sin conexión, botón de idioma)
function textosFijos() {
  const nav = document.querySelector('.tabbar');
  nav.setAttribute('aria-label', t('nav.aria'));
  nav.querySelectorAll('a[data-tab] .txt').forEach(s => { s.textContent = t('nav.' + s.parentElement.dataset.tab); });
  document.getElementById('offline-badge').textContent = t('offline');
  const btn = document.querySelector('[data-menu-idioma]');
  btn.querySelector('img').src = IDIOMAS[idioma()].bandera;
  btn.setAttribute('aria-label', `${t('idioma.cambiar')}: ${IDIOMAS[idioma()].nombre}`);
  document.querySelector('[data-menu-lista]').innerHTML = banderas('menu');
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
  const menuBtn = e.target.closest('[data-menu-idioma]');
  const menu = document.querySelector('[data-menu-lista]');
  if (menuBtn) { menu.hidden = !menu.hidden; menuBtn.setAttribute('aria-expanded', !menu.hidden); return; }
  if (!e.target.closest('[data-menu-lista]')) menu.hidden = true;

  const bandera = e.target.closest('[data-idioma]');
  if (bandera) {
    menu.hidden = true;
    if (bandera.dataset.idioma === idioma()) return;
    cambiarIdioma(bandera.dataset.idioma);
    sonidos.play('idioma');
    busqueda = '';
    textosFijos();
    await navegar();
    return;
  }

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

// Buscador: ignora tildes y mayúsculas; busca en título, etiquetas, resumen, subtítulos, listas y alimentos
let busqueda = '';
let verTodas = false;
const normal = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const textoGuia = g => normal([g.titulo, g.especie, ...g.etiquetas, ...g.resumen,
  ...g.bloques.filter(b => b.h).map(b => b.h),
  ...g.bloques.filter(b => b.ul).flatMap(b => b.ul),
  ...g.bloques.filter(b => b.tabla2).flatMap(b => [...b.tabla2.ok, ...b.tabla2.no].map(([nombre]) => nombre)),
].join(' '));

async function listaGuias() {
  const p = perfil.leer();
  const guias = await cargarGuias();
  const filtrar = p && !verTodas;
  const plural = p ? t('especie.' + p.especie + 's') : '';
  const palabras = normal(busqueda).split(/\s+/).filter(Boolean);
  const coincide = g => palabras.every(w => textoGuia(g).includes(w));
  const visibles = guias.filter(g => !filtrar || g.especies.includes(p.especie)).filter(coincide);

  const filtro = p ? `<p class="filtro">${verTodas
    ? `${t('filtro.todas')} · <button type="button" data-filtro>${t('filtro.solo', { especie: plural })}</button>`
    : `${t('filtro.para', { especie: plural })} · <button type="button" data-filtro>${t('filtro.verTodas')}</button>`}</p>` : '';

  if (!visibles.length) {
    const enOtras = filtrar && guias.some(coincide);
    return `${filtro}<div class="card vacio-busqueda"><p>${t('vacio.msg', { q: esc(busqueda) })}${filtrar ? t('vacio.especie', { especie: plural }) : ''}.</p>
      ${enOtras ? `<p><button type="button" class="chip" data-filtro>${t('vacio.otras')}</button></p>` : ''}
      <p>${t('vacio.prueba')} ${t('sugerencias').map(s => `<button type="button" class="chip" data-sugerencia="${esc(s)}">${esc(s)}</button>`).join(' ')}</p></div>`;
  }
  return `${filtro}<div class="card"><ul class="list">${visibles.map(g => `
    <li><a class="row" href="#/guias/${g.id}" aria-label="${esc(g.titulo)}, ${g.verificada ? t('aria.ok') : t('aria.draft')}">
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
  if (!prox.length) return `<div class="card"><h3>${t('prox.titulo')}</h3><p>${t('prox.vacio', { libreta: `<a href="#/libreta">${t('prox.libreta')}</a>` })}</p></div>`;
  return `<div class="card"><h3>${t('prox.titulo')}</h3><ul class="list">${prox.map(r => {
    const tipo = libreta.tipo(r.tipo);
    return `<li><a class="row" href="#/libreta"><span class="dot">${tipo.icono}</span>
      <div><b>${esc(r.titulo) || tipo.nombre}</b><small>${tipo.nombre} · ${fecha(r.proxima)}</small></div></a></li>`;
  }).join('')}</ul></div>`;
}

function renderGuia(g) {
  const r = g.revision;
  const traduccion = idioma() !== 'es';
  const datos = r && { revisora: esc(r.revisora), titulo: esc(r.titulo), fecha: fecha(r.fecha) };
  const cabecera = `
    <a class="back" href="#/guias">${t('guia.back')}</a>
    <div class="g-head">
      <span class="g-ico">${g.icono}</span>
      <div><h2>${esc(g.titulo)}</h2><small>${esc(g.especie)} · ${esc(g.etapa)}</small></div>
    </div>
    ${r
      ? (traduccion
        ? `<div class="verified traduccion">🌐 <b>${t('verif.traduccion')}</b><span>${t('verif.traduccionDetalle', datos)}</span></div>`
        : `<div class="verified">✓ <b>${t('verif.titulo')}</b><span>${t('verif.detalle', datos)}</span></div>`)
      : `<div class="verified draft">⏳ <b>${t('draft.titulo')}</b><span>${t('draft.detalle')}</span></div>`}
    <div class="card resumen"><h3>${t('resumen')}</h3><ul>${g.resumen.map(x => `<li>${fmt(x)}</li>`).join('')}</ul></div>`;

  const cuerpo = g.bloques.map(bloque).join('');

  const fuentes = `
    <h3 class="g-h">${t('fuentes')}</h3>
    <ol class="fuentes">${g.fuentes.map(f => `<li>${esc(f.texto)}. <a href="${esc(f.url)}" target="_blank" rel="noopener">${t('verFuente')}</a></li>`).join('')}</ol>
    <p class="aviso">${t('aviso')}</p>`;

  return cabecera + cuerpo + fuentes;
}

let tabsId = 0;
function bloque(b) {
  if (b.h) return `<h3 class="g-h">${esc(b.h)}</h3>`;
  if (b.p) return `<p class="g-p">${fmt(b.p)}</p>`;
  if (b.ul) return `<ul class="g-ul">${b.ul.map(x => `<li>${fmt(x)}</li>`).join('')}</ul>`;
  if (b.num) return `<ol class="g-ol">${b.num.map(x => `<li>${fmt(x)}</li>`).join('')}</ol>`;
  if (b.tip) return `<div class="tip"><b>${t('consejo')}</b> ${fmt(b.tip)}</div>`;
  if (b.table) {
    const tb = b.table;
    return `<div class="tbl"><table>
      <thead><tr>${tb.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${tb.rows.map(row => `<tr>${row.map((c, i) => i ? `<td>${fmt(c)}</td>` : `<th scope="row">${fmt(c)}</th>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  }
  if (b.tabla2) {
    // Dos pestañas: "Puede comer" / "Nunca darle" (o "Qué hacer" / "Qué NO hacer")
    const tb = b.tabla2, id = `tabs${++tabsId}`;
    const lista = (filas, cls) => `<ul class="pares ${cls}">${filas.map(([a, d]) => `<li><b>${fmt(a)}</b><span>${fmt(d)}</span></li>`).join('')}</ul>`;
    return `<div class="tabs" id="${id}">
      <div class="tabs-nav" role="tablist">
        <button role="tab" class="ok on" aria-selected="true" data-panel="0">✓ ${esc(tb.okTitulo)}</button>
        <button role="tab" class="no" aria-selected="false" data-panel="1">✕ ${esc(tb.noTitulo)}</button>
      </div>
      <div class="tabs-panel" data-panel="0">${lista(tb.ok, 'ok')}</div>
      <div class="tabs-panel" data-panel="1" hidden>${lista(tb.no, 'no')}</div>
    </div>`;
  }
  if (b.alerta) {
    const a = b.alerta;
    return `<div class="alerta" role="note"><h3>⚠️ ${esc(a.titulo)}</h3>
      <ul>${a.items.map(x => `<li>${fmt(x)}</li>`).join('')}</ul>
      ${a.nota ? `<p><b>${t('importante')}</b> ${fmt(a.nota)}</p>` : ''}</div>`;
  }
  if (b.contactos) {
    const c = leerContactos();
    const campo = (k, label, ph) => `<label>${label}<input name="${k}" value="${esc(c[k] || '')}" placeholder="${esc(ph)}" autocomplete="off"></label>`;
    return `<h3 class="g-h">${t('contactos.titulo')}</h3>
      <form class="card contactos" data-contactos>
        ${campo('vet', t('contactos.vet'), t('contactos.phNombre'))}
        ${campo('urgencia', t('contactos.urgencia'), t('contactos.phClinica'))}
        ${campo('otro', t('contactos.otro'), t('contactos.phNombre'))}
        <small>${t('contactos.nota')}</small>
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
textosFijos();
navegar();
estadoConexion();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
