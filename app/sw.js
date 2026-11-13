// Service worker: permite que la app funcione sin conexión.
//
// - Al instalarse guarda todos los archivos de la app y todos los instrumentos.
// - Los archivos pesados (librería de sonido e instrumentos) se leen primero de la copia
//   guardada: no cambian casi nunca y así abren al instante.
// - El resto (página, estilos, código) intenta primero internet, para que cuando se
//   actualice la app en GitHub se vea el cambio, y si no hay conexión usa la copia guardada.
//
// IMPORTANTE: cada vez que cambies archivos pesados (instrumentos o lib/), sube el número de CACHE.
// Si añades un archivo nuevo a la app, añádelo a la lista FILES.
// Los instrumentos nuevos se guardan solos: se leen de instrumentos/instrumentos.json.
const CACHE = "henar-lite-v3";
const FILES = [
  "./",
  "index.html",
  "style.css",
  "motor.js",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "lib/spessasynth.js",
  "lib/spessasynth_processor.min.js",
  "instrumentos/instrumentos.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(FILES); // imprescindibles: si falla uno, no se instala

      // Instrumentos: se guardan uno a uno. Si alguno falla, la app sigue funcionando
      // y lo volverá a pedir cuando haga falta.
      try {
        const lista = await (await cache.match("instrumentos/instrumentos.json")).json();
        await Promise.all(
          lista.instrumentos.map((i) => cache.add("instrumentos/" + i.archivo).catch(() => {}))
        );
      } catch (error) {
        // sin lista de instrumentos: no pasa nada
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function pedirYGuardar(peticion) {
  return fetch(peticion).then((respuesta) => {
    if (respuesta.status === 200) {
      const copia = respuesta.clone();
      caches.open(CACHE).then((c) => c.put(peticion, copia));
    }
    return respuesta;
  });
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  const esPesado = url.pathname.includes("/lib/") || url.pathname.endsWith(".sf3");
  if (esPesado) {
    e.respondWith(
      caches.match(e.request).then((copia) => copia || pedirYGuardar(e.request))
    );
  } else {
    e.respondWith(
      pedirYGuardar(e.request).catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
  }
});
