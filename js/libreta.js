// Libreta veterinaria: registros guardados en el teléfono (localStorage), sin internet.
// Cada registro: { id, tipo, fecha, titulo, detalle, proxima }

const CLAVE = 'pv_libreta';

export const TIPOS = {
  vacuna: { nombre: 'Vacuna', icono: '💉' },
  desparasitacion: { nombre: 'Desparasitación', icono: '🪱' },
  consulta: { nombre: 'Consulta', icono: '🩺' },
  peso: { nombre: 'Peso', icono: '⚖️' },
  nota: { nombre: 'Nota', icono: '📝' },
};

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
  const opciones = Object.entries(TIPOS).map(([k, t]) => `<option value="${k}" ${k === r.tipo ? 'selected' : ''}>${t.icono} ${t.nombre}</option>`).join('');

  const lista = registros.length
    ? `<ul class="list">${registros.map(x => `
        <li class="reg">
          <span class="dot">${(TIPOS[x.tipo] || TIPOS.nota).icono}</span>
          <div class="reg-txt">
            <b>${esc(x.titulo) || (TIPOS[x.tipo] || TIPOS.nota).nombre}</b>
            <small>${(TIPOS[x.tipo] || TIPOS.nota).nombre} · ${fecha(x.fecha)}${x.proxima ? ` · Próxima: ${fecha(x.proxima)}` : ''}</small>
            ${x.detalle ? `<p>${esc(x.detalle)}</p>` : ''}
          </div>
          <div class="reg-acc">
            <a href="#/libreta/${x.id}" aria-label="Editar">✏️</a>
            <button type="button" data-borrar="${x.id}" aria-label="Borrar">🗑️</button>
          </div>
        </li>`).join('')}</ul>`
    : `<p class="vacio">Aún no hay registros. Agrega la primera vacuna, desparasitación o nota de tu mascota.</p>`;

  return `<h2>Libreta veterinaria</h2>
    <form class="card form-libreta" data-libreta data-id="${editando ? editando.id : ''}">
      <h3>${editando ? 'Editar registro' : 'Nuevo registro'}</h3>
      <label>Tipo<select name="tipo">${opciones}</select></label>
      <label>Fecha<input type="date" name="fecha" value="${esc(r.fecha)}" required></label>
      <label>Título<input name="titulo" value="${esc(r.titulo)}" placeholder="Ej.: Séxtuple, Antirrábica, 12,4 kg" maxlength="80"></label>
      <label>Detalle<textarea name="detalle" rows="2" placeholder="Veterinario, lote, dosis, observaciones" maxlength="500">${esc(r.detalle)}</textarea></label>
      <label>Próxima fecha (opcional)<input type="date" name="proxima" value="${esc(r.proxima)}"></label>
      <div class="acciones">
        <button class="btn" type="submit">${editando ? 'Guardar cambios' : 'Agregar a la libreta'}</button>
        ${editando ? '<a class="btn sec" href="#/libreta">Cancelar</a>' : ''}
      </div>
    </form>
    <div class="card">${lista}</div>
    <div class="card respaldo">
      <h3>Respaldo</h3>
      <p>Tus registros se guardan solo en este teléfono. Descarga un respaldo para no perderlos o pasarlos a otro equipo.</p>
      <div class="acciones">
        <button class="btn sec" type="button" data-exportar>⬇️ Exportar</button>
        <label class="btn sec">⬆️ Importar<input type="file" accept="application/json,.json" data-importar hidden></label>
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
    if (id) location.hash = '#/libreta'; else onCambio();
  });

  document.addEventListener('click', e => {
    const borrar = e.target.closest('[data-borrar]');
    if (borrar) {
      if (!confirm('¿Borrar este registro de la libreta?')) return;
      guardar(leer().filter(r => r.id !== borrar.dataset.borrar));
      onCambio();
    }
    if (e.target.closest('[data-exportar]')) exportar();
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
      await onCambio(); // espera a que se redibuje la pantalla antes de mostrar el mensaje
      document.querySelector('[data-respaldo-msg]').textContent = agregados.length === 1 ? 'Se importó 1 registro.' : `Se importaron ${agregados.length} registros.`;
    } catch {
      if (msg) msg.textContent = 'El archivo no es un respaldo válido de Pocket Vet.';
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
