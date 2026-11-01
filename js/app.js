// Pocket Vet · PWA
// Router por hash: #/inicio, #/guias, #/guias/<id>, #/libreta, #/perfil

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
    render: () => `
      <div class="card pet">
        <div class="avatar">🐶</div>
        <div><h3>Tu mascota</h3><p>Crea su perfil para ver guías a su medida.</p></div>
      </div>
      <div class="tiles">
        <a class="tile" href="#/guias"><span class="e">📖</span>Guías</a>
        <a class="tile" href="#/libreta"><span class="e">🗒️</span>Libreta</a>
        <a class="tile" href="#/guias/alimentacion-perro"><span class="e">🥕</span>¿Puede comer?</a>
        <a class="tile" href="#/perfil"><span class="e">⏰</span>Recordatorios</a>
      </div>
      <div class="card"><h3>Próximos recordatorios</h3><p>Aún no tienes recordatorios.</p></div>`,
  },
  guias: {
    titulo: () => 'Guías',
    render: async () => {
      const guias = await cargarGuias();
      const items = guias.map(g => `
        <li><a class="row" href="#/guias/${g.id}">
          <span class="dot">${g.icono}</span>
          <div><b>${esc(g.titulo)}</b><small>${esc(g.especie)}</small></div>
          ${sello(g)}<span class="chev" aria-hidden="true">›</span>
        </a></li>`).join('');
      return `<h2>Guías de cuidado</h2><div class="card"><ul class="list">${items}</ul></div>`;
    },
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
    render: () => `<h2>Libreta veterinaria</h2>
      <div class="card"><p>Aquí vas a registrar vacunas, desparasitaciones y notas. Disponible en el Sprint 3.</p></div>`,
  },
  perfil: {
    titulo: () => 'Perfil',
    render: () => `<h2>Perfil de la mascota</h2>
      <div class="card"><p>Especie, nombre y edad de tu mascota. Disponible en el Sprint 2.</p></div>`,
  },
};

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
  const [ruta, param] = (location.hash.replace('#/', '') || 'inicio').split('/');
  const id = ruta === 'guias' && param ? 'guia' : ruta;
  const screen = screens[id] || screens.inicio;
  const main = document.getElementById('screen');
  document.getElementById('screen-title').textContent = await screen.titulo(param);
  main.innerHTML = await screen.render(param);
  window.scrollTo(0, 0);
  const tab = ruta in screens ? ruta : 'inicio';
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
}

function estadoConexion() {
  document.getElementById('offline-badge').hidden = navigator.onLine;
}

window.addEventListener('hashchange', navegar);
window.addEventListener('online', estadoConexion);
window.addEventListener('offline', estadoConexion);
navegar();
estadoConexion();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
