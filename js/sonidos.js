// Sonidos de interfaz. Kenney Interface Sounds (CC0) salvo "inicio", que es original (campanita sintetizada).
// Se pueden silenciar desde Perfil.
//   inicio: abrir la app · tap: navegar · seleccionar: elegir una opción · interruptor: encender/apagar
//   guardar: algo guardado · bienvenida: onboarding listo · alerta: "Ve al veterinario"
//   borrar: borrar un registro · error: falta un dato o algo falló · vacio: búsqueda sin resultados
//   idioma: cambiar de idioma con las banderitas

const ARCHIVOS = {
  inicio: 'sonidos/inicio.mp3', tap: 'sonidos/tap.mp3', seleccionar: 'sonidos/seleccionar.mp3',
  interruptor: 'sonidos/interruptor.mp3', guardar: 'sonidos/guardar.mp3', bienvenida: 'sonidos/bienvenida.mp3',
  alerta: 'sonidos/alerta.mp3', borrar: 'sonidos/borrar.mp3', error: 'sonidos/error.mp3', vacio: 'sonidos/vacio.mp3',
  idioma: 'sonidos/idioma.mp3',
};
const VOLUMEN = { inicio: 0.5, tap: 0.35, seleccionar: 0.4, interruptor: 0.45, guardar: 0.6, bienvenida: 0.6, alerta: 0.55, borrar: 0.5, error: 0.45, vacio: 0.4, idioma: 0.5 };
const CLAVE = 'pv_silencio';

let ctx;
const buffers = {};

export const silenciado = () => { try { return localStorage.getItem(CLAVE) === '1'; } catch { return false; } };
export function silenciar(si) { try { localStorage.setItem(CLAVE, si ? '1' : '0'); } catch { /* sin almacenamiento */ } }

// Web Audio da sonidos sin retraso; el navegador solo lo permite después de un toque del usuario
function iniciar() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  for (const [k, url] of Object.entries(ARCHIVOS)) {
    fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => { buffers[k] = buf; }).catch(() => {});
  }
}
document.addEventListener('pointerdown', iniciar, { once: true, capture: true });

export function play(nombre) {
  if (silenciado() || !ARCHIVOS[nombre]) return Promise.resolve();
  if (ctx && buffers[nombre]) {
    if (ctx.state === 'suspended') ctx.resume();
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    gain.gain.value = VOLUMEN[nombre];
    src.buffer = buffers[nombre];
    src.connect(gain).connect(ctx.destination);
    src.start();
    return Promise.resolve();
  }
  const a = new Audio(ARCHIVOS[nombre]);
  a.volume = VOLUMEN[nombre];
  return a.play();
}

// Sonido de inicio, una vez por apertura. Si el teléfono bloquea el audio hasta el primer toque,
// suena con ese toque, pero solo en los primeros segundos (después ya no tendría sentido).
const VENTANA_INICIO = 8000;
function sonarInicio() {
  try { if (sessionStorage.getItem('pv_inicio_sonado')) return; sessionStorage.setItem('pv_inicio_sonado', '1'); } catch { /* sin almacenamiento */ }
  const abierto = Date.now();
  play('inicio').catch(() => {
    document.addEventListener('pointerdown', () => {
      if (Date.now() - abierto < VENTANA_INICIO) play('inicio').catch(() => {});
    }, { once: true, capture: true });
  });
}
sonarInicio();

// Toques en navegación, accesos, listas, pestañas y botones secundarios
document.addEventListener('click', e => {
  if (e.target.closest('.tabbar a, .tile, a.pet, .list a.row, .tabs-nav button, .back, .chip, .filtro button, .reg-acc a, a.btn.sec')) play('tap');
}, { capture: true });

// Elegir especie o edad en el perfil
document.addEventListener('change', e => {
  if (e.target.matches('.opt input[type="radio"]')) play('seleccionar');
});

// Formularios con datos faltantes (el navegador marca el campo y no envía)
let ultimoError = 0;
document.addEventListener('invalid', () => {
  if (Date.now() - ultimoError > 500) { ultimoError = Date.now(); play('error'); }
}, true);
