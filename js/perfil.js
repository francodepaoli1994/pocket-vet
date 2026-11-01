// Perfil de la mascota (mecánica M1): nombre, especie y etapa, guardados en el teléfono.
// { nombre, especie: 'perro' | 'gato', etapa: 'joven' | 'adulto' | 'senior' }

const CLAVE = 'pv_perfil';

export const ESPECIES = {
  perro: { nombre: 'Perro', icono: '🐶', joven: 'Cachorro' },
  gato: { nombre: 'Gato', icono: '🐱', joven: 'Gatito' },
};
const ETAPAS = { joven: null, adulto: 'Adulto', senior: 'Senior' };

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function leer() {
  try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; }
}

export const etapaNombre = p => p.etapa === 'joven' ? ESPECIES[p.especie].joven : ETAPAS[p.etapa];

// Tarjeta de la mascota para Inicio
export function tarjeta(p) {
  const e = ESPECIES[p.especie];
  return `<a class="card pet" href="#/perfil">
    <div class="avatar">${e.icono}</div>
    <div><h3>${esc(p.nombre)}</h3><p>${e.nombre} · ${etapaNombre(p)}</p></div>
  </a>`;
}

// Formulario de perfil; en el primer uso se muestra como bienvenida (onboarding)
export function form(bienvenida = false) {
  const p = leer() || { nombre: '', especie: '', etapa: '' };
  const opcion = (name, valor, icono, texto) => `
    <label class="opt"><input type="radio" name="${name}" value="${valor}" ${p[name] === valor ? 'checked' : ''} required>
      <span>${icono ? `<i>${icono}</i>` : ''}${texto}</span></label>`;
  return `<form class="card form-perfil" data-perfil>
    ${bienvenida
      ? `<h3>¡Bienvenido a Pocket Vet! 🐾</h3><p>Cuéntanos de tu mascota para mostrarte las guías que le sirven. Toma menos de un minuto.</p>`
      : `<h3>Datos de tu mascota</h3>`}
    <fieldset><legend>¿Qué mascota tienes?</legend>
      <div class="opts">${opcion('especie', 'perro', '🐶', 'Perro')}${opcion('especie', 'gato', '🐱', 'Gato')}</div>
    </fieldset>
    <label>¿Cómo se llama?<input name="nombre" value="${esc(p.nombre)}" placeholder="Ej.: Luna" maxlength="30" required autocomplete="off"></label>
    <fieldset><legend>¿Qué edad tiene?</legend>
      <div class="opts tres">${opcion('etapa', 'joven', '', 'Menos de 1 año')}${opcion('etapa', 'adulto', '', '1 a 7 años')}${opcion('etapa', 'senior', '', 'Más de 7 años')}</div>
    </fieldset>
    <div class="acciones"><button class="btn" type="submit">${bienvenida ? 'Empezar' : 'Guardar'}</button></div>
    <small data-perfil-msg></small>
  </form>`;
}

export function conectar(onCambio) {
  document.addEventListener('submit', async e => {
    const f = e.target.closest('[data-perfil]');
    if (!f) return;
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const nuevo = !leer();
    localStorage.setItem(CLAVE, JSON.stringify({ nombre: d.nombre.trim(), especie: d.especie, etapa: d.etapa }));
    if (nuevo) { location.hash = '#/inicio'; await onCambio(); return; }
    await onCambio();
    const msg = document.querySelector('[data-perfil-msg]');
    if (msg) msg.textContent = 'Perfil guardado.';
  });
}
