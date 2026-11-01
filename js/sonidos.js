// Sonidos de interfaz (Kenney Interface Sounds, CC0). Se pueden silenciar desde Perfil.
// tap: navegar · guardar: registro guardado · bienvenida: onboarding listo · alerta: "Ve al veterinario" · borrar

const ARCHIVOS = { tap: 'sonidos/tap.mp3', guardar: 'sonidos/guardar.mp3', bienvenida: 'sonidos/bienvenida.mp3', alerta: 'sonidos/alerta.mp3', borrar: 'sonidos/borrar.mp3' };
const VOLUMEN = { tap: 0.35, guardar: 0.6, bienvenida: 0.6, alerta: 0.55, borrar: 0.5 };
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
  if (silenciado() || !ARCHIVOS[nombre]) return;
  if (ctx && buffers[nombre]) {
    if (ctx.state === 'suspended') ctx.resume();
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    gain.gain.value = VOLUMEN[nombre];
    src.buffer = buffers[nombre];
    src.connect(gain).connect(ctx.destination);
    src.start();
  } else {
    const a = new Audio(ARCHIVOS[nombre]);
    a.volume = VOLUMEN[nombre];
    a.play().catch(() => {});
  }
}

// Toques en navegación, accesos de Inicio, listas y pestañas
document.addEventListener('click', e => {
  if (e.target.closest('.tabbar a, .tile, .list a.row, .tabs-nav button, .back, .chip')) play('tap');
}, { capture: true });
