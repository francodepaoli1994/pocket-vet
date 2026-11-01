// Pocket Vet · estructura base de la PWA (Sprint 1)
// Router por hash con 4 pantallas. Las funciones reales llegan en los sprints 2 y 3.

const GUIAS_URL = 'data/guias.json';

const screens = {
  inicio: {
    titulo: 'Pocket Vet',
    render: () => `
      <div class="card pet">
        <div class="avatar">🐶</div>
        <div><h3>Tu mascota</h3><p>Crea su perfil para ver guías a su medida.</p></div>
      </div>
      <div class="tiles">
        <a class="tile" href="#/guias"><span class="e">📖</span>Guías</a>
        <a class="tile" href="#/libreta"><span class="e">🗒️</span>Libreta</a>
        <a class="tile" href="#/guias"><span class="e">🥕</span>¿Puede comer?</a>
        <a class="tile" href="#/perfil"><span class="e">⏰</span>Recordatorios</a>
      </div>
      <div class="card"><h3>Próximos recordatorios</h3><p>Aún no tienes recordatorios.</p></div>`,
  },
  guias: {
    titulo: 'Guías',
    render: async () => {
      const guias = await cargarGuias();
      const items = guias.map(g => `
        <li><span class="dot">${g.icono}</span>
          <div><b>${g.titulo}</b><small>${g.especie}</small></div>
          <span class="seal ${g.verificada ? '' : 'draft'}">${g.verificada ? '✓ Verificada' : 'En revisión'}</span>
        </li>`).join('');
      return `<h2>Guías de cuidado</h2><div class="card"><ul class="list">${items}</ul></div>`;
    },
  },
  libreta: {
    titulo: 'Libreta',
    render: () => `<h2>Libreta veterinaria</h2>
      <div class="card"><p>Aquí vas a registrar vacunas, desparasitaciones y notas. Disponible en el Sprint 3.</p></div>`,
  },
  perfil: {
    titulo: 'Perfil',
    render: () => `<h2>Perfil de la mascota</h2>
      <div class="card"><p>Especie, nombre y edad de tu mascota. Disponible en el Sprint 2.</p></div>`,
  },
};

let guiasCache;
async function cargarGuias() {
  if (!guiasCache) guiasCache = fetch(GUIAS_URL).then(r => r.json()).catch(() => []);
  return guiasCache;
}

async function navegar() {
  const id = (location.hash.replace('#/', '') || 'inicio').split('/')[0];
  const screen = screens[id] || screens.inicio;
  document.getElementById('screen-title').textContent = screen.titulo;
  document.getElementById('screen').innerHTML = await screen.render();
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === id));
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
