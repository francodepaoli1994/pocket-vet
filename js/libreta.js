// Libreta veterinaria: registros guardados en el teléfono (localStorage), sin internet.
// Cada registro: { id, tipo, fecha, titulo, detalle, proxima }

import { play } from './sonidos.js';
import { t } from './i18n.js';

const CLAVE = 'pv_libreta';

const ICONOS = { vacuna: '💉', desparasitacion: '🪱', consulta: '🩺', peso: '⚖️', nota: '📝' };

// Tipo de registro con su nombre en el idioma actual
export const tipo = k => { const c = ICONOS[k] ? k : 'nota'; return { icono: ICONOS[c], nombre: t('tipo.' + c) }; };

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fecha = iso => iso ? iso.split('-').reverse().join('-') : '';
const hoy = () => new Date().toISOString().slice(0, 10);

export function leer() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || []; } catch { return []; }
}

function guardar(registros) {
  localStorage.setItem(CLAVE, JSON.stringify(registros));
}

// Próximas fechas (vacunas, desparasitaciones, controles) desde hoy, ordenadas
export function proximas(n = 2) {
  const h = hoy();
  return leer().filter(r => r.proxima && r.proxima >= h)
    .sort((a, b) => a.proxima.localeCompare(b.proxima)).slice(0, n);
}

export function render(editarId) {
  const registros = leer().sort((a, b) => b.fecha.localeCompare(a.fecha));
  const editando = registros.find(r => r.id === editarId);
  const r = editando || { tipo: 'vacuna', fecha: hoy(), titulo: '', detalle: '', proxima: '' };
  const opciones = Object.keys(ICONOS).map(k => `<option value="${k}" ${k === r.tipo ? 'selected' : ''}>${tipo(k).icono} ${tipo(k).nombre}</option>`).join('');

  const lista = registros.length
    ? `<ul class="list">${registros.map(x => `
        <li class="reg">
          <span class="dot">${tipo(x.tipo).icono}</span>
          <div class="reg-txt">
            <b>${esc(x.titulo) || tipo(x.tipo).nombre}</b>
            <small>${tipo(x.tipo).nombre} · ${fecha(x.fecha)}${x.proxima ? ` · ${t('libreta.proximaCorta', { fecha: fecha(x.proxima) })}` : ''}</small>
            ${x.detalle ? `<p>${esc(x.detalle)}</p>` : ''}
          </div>
          <div class="reg-acc">
            <a href="#/libreta/${x.id}" aria-label="${t('libreta.editarAria')}">✏️</a>
            <button type="button" data-borrar="${x.id}" aria-label="${t('libreta.borrarAria')}">🗑️</button>
          </div>
        </li>`).join('')}</ul>`
    : `<p class="vacio">${t('libreta.vacio')}</p>`;

  return `<h2>${t('libreta.titulo')}</h2>
    <form class="card form-libreta" data-libreta data-id="${editando ? editando.id : ''}">
      <h3>${editando ? t('libreta.editar') : t('libreta.nuevo')}</h3>
      <label>${t('libreta.tipo')}<select name="tipo">${opciones}</select></label>
      <label>${t('libreta.fecha')}<input type="date" name="fecha" value="${esc(r.fecha)}" required></label>
      <label>${t('libreta.tituloCampo')}<input name="titulo" value="${esc(r.titulo)}" placeholder="${esc(t('libreta.phTitulo'))}" maxlength="80"></label>
      <label>${t('libreta.detalle')}<textarea name="detalle" rows="2" placeholder="${esc(t('libreta.phDetalle'))}" maxlength="500">${esc(r.detalle)}</textarea></label>
      <label>${t('libreta.proxima')}<input type="date" name="proxima" value="${esc(r.proxima)}"></label>
      <div class="acciones">
        <button class="btn" type="submit">${editando ? t('libreta.guardarCambios') : t('libreta.agregar')}</button>
        ${editando ? `<a class="btn sec" href="#/libreta">${t('libreta.cancelar')}</a>` : ''}
      </div>
    </form>
    <div class="card">${lista}</div>
    <div class="card respaldo">
      <h3>${t('respaldo.titulo')}</h3>
      <p>${t('respaldo.texto')}</p>
      <div class="acciones">
        <button class="btn sec" type="button" data-exportar>${t('respaldo.exportar')}</button>
        <label class="btn sec">${t('respaldo.importar')}<input type="file" accept="application/json,.json" data-importar hidden></label>
      </div>
      <small data-respaldo-msg></small>
    </div>`;
}

// Eventos de la libreta (delegados); onCambio vuelve a dibujar la pantalla
export function conectar(onCambio) {
  document.addEventListener('submit', e => {
    const form = e.target.closest('[data-libreta]');
    if (!form) return;
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const registros = leer();
    const id = form.dataset.id;
    const datos = { tipo: d.tipo, fecha: d.fecha, titulo: d.titulo.trim(), detalle: d.detalle.trim(), proxima: d.proxima };
    if (id) Object.assign(registros.find(r => r.id === id) || {}, datos);
    else registros.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...datos });
    guardar(registros);
    play('guardar');
    if (id) location.hash = '#/libreta'; else onCambio();
  });

  document.addEventListener('click', e => {
    const borrar = e.target.closest('[data-borrar]');
    if (borrar) {
      if (!confirm(t('libreta.confirmarBorrar'))) return;
      guardar(leer().filter(r => r.id !== borrar.dataset.borrar));
      play('borrar');
      onCambio();
    }
    if (e.target.closest('[data-exportar]')) { exportar(); play('guardar'); }
  });

  document.addEventListener('change', async e => {
    const input = e.target.closest('[data-importar]');
    if (!input || !input.files[0]) return;
    const msg = document.querySelector('[data-respaldo-msg]');
    try {
      const datos = JSON.parse(await input.files[0].text());
      const nuevos = (Array.isArray(datos) ? datos : datos.registros || [])
        .filter(r => r && r.id && r.fecha && r.tipo);
      const actuales = leer();
      const ids = new Set(actuales.map(r => r.id));
      const agregados = nuevos.filter(r => !ids.has(r.id));
      guardar(actuales.concat(agregados));
      play('guardar');
      await onCambio(); // espera a que se redibuje la pantalla antes de mostrar el mensaje
      document.querySelector('[data-respaldo-msg]').textContent = agregados.length === 1 ? t('respaldo.uno') : t('respaldo.varios', { n: agregados.length });
    } catch {
      play('error');
      if (msg) msg.textContent = t('respaldo.error');
    }
  });
}

function exportar() {
  const blob = new Blob([JSON.stringify({ app: 'Pocket Vet', version: 1, exportado: new Date().toISOString(), registros: leer() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pocket-vet-libreta-${hoy()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
