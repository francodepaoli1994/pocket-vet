# Pocket Vet

Guía veterinaria de bolsillo y base de datos de la mascota. PWA instalable en Android e iOS que funciona sin conexión.

Proyecto DVJ-014 · Santo Tomás. MVP en 4 semanas (26-10-2026 al 22-11-2026).

## Estructura

```
index.html             Shell de la app y barra de navegación
css/styles.css         Design system pastel
js/app.js              Router por hash y pantallas
data/guias.json        Índice de las 6 guías verificadas
sw.js                  Service worker (caché sin conexión)
manifest.webmanifest   Datos de instalación de la PWA
icons/                 Íconos de la app
netlify.toml           Configuración de Netlify
```

## Probar en local

Sirve la carpeta con cualquier servidor estático, por ejemplo:

```
npx serve .
```

El service worker solo funciona en `localhost` o con HTTPS.

## Deploy

Cada push a `main` se publica automáticamente en Netlify.

## Equipo

- Matías Ossorio · Game Design Lead
- Nicole González · Technical & MVP Lead
- Franco De Paoli · Technical & MVP Lead y Project Manager (actividades virtuales)
- Nicolás Vergara · Project Manager (actividades presenciales)
- Carol Somorrostro · Financial & Resource Lead
