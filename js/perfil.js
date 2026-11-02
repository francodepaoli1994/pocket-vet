// Perfil de la mascota (mecánica M1): nombre, especie y etapa, guardados en el teléfono.
// { nombre, especie: 'perro' | 'gato', etapa: 'joven' | 'adulto' | 'senior' }

import { play } from './sonidos.js';
import { t } from './i18n.js';

const CLAVE = 'pv_perfil';

export const ESPECIES = {
  perro: { icono: '🐶', joven: 'cachorro' },
  gato: { icono: '🐱', joven: 'gatito' },
};

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function leer() {
  try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; }
}

export const especieNombre = p => t('especie.' + p.especie);
export const etapaNombre = p => t('etapa.' + (p.etapa === 'joven' ? ESPECIES[p.especie].joven : p.etapa));

// Tarjeta de la mascota para Inicio
export function tarjeta(p) {
  return `<a class="card pet" href="#/perfil">
    <div class="avatar">${ESPECIES[p.especie].icono}</div>
    <div><h3>${esc(p.nombre)}</h3><p>${especieNombre(p)} · ${etapaNombre(p)}</p></div>
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
      ? `<h3>${t('perfil.bienvenida')}</h3><p>${t('perfil.bienvenidaTexto')}</p>`
      : `<h3>${t('perfil.datos')}</h3>`}
    <fieldset><legend>${t('perfil.qEspecie')}</legend>
      <div class="opts">${opcion('especie', 'perro', '🐶', t('especie.perro'))}${opcion('especie', 'gato', '🐱', t('especie.gato'))}</div>
    </fieldset>
    <label>${t('perfil.qNombre')}<input name="nombre" value="${esc(p.nombre)}" placeholder="${esc(t('perfil.phNombre'))}" maxlength="30" required autocomplete="off"></label>
    <fieldset><legend>${t('perfil.qEdad')}</legend>
      <div class="opts tres">${opcion('etapa', 'joven', '', t('edad.joven'))}${opcion('etapa', 'adulto', '', t('edad.adulto'))}${opcion('etapa', 'senior', '', t('edad.senior'))}</div>
    </fieldset>
    <div class="acciones"><button class="btn" type="submit">${bienvenida ? t('perfil.empezar') : t('perfil.guardar')}</button></div>
    <small data-perfil-msg></small>
  </form>
  ${bienvenida ? '' : `<div class="card">
    <h3>${t('apk.titulo')}</h3>
    <p>${t('apk.texto')}</p>
    <div class="acciones"><a class="btn sec" href="descargas/pocket-vet.apk" download>${t('apk.boton')}</a></div>
  </div>`}`;
}

export function conectar(onCambio) {
  document.addEventListener('submit', async e => {
    const f = e.target.closest('[data-perfil]');
    if (!f) return;
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const nuevo = !leer();
    localStorage.setItem(CLAVE, JSON.stringify({ nombre: d.nombre.trim(), especie: d.especie, etapa: d.etapa }));
    play(nuevo ? 'bienvenida' : 'guardar');
    if (nuevo) { location.hash = '#/inicio'; await onCambio(); return; }
    await onCambio();
    const msg = document.querySelector('[data-perfil-msg]');
    if (msg) msg.textContent = t('perfil.guardado');
  });
}
