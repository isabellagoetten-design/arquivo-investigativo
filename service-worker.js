const CACHE_NAME = "arquivo-investigativo-v39";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./inicio.html",
  "./conhecimento.html",
  "./investigacao.html",
  "./biblioteca.html",
  "./laboratorio.html",
  "./atlas.html",
  "./maquina-do-tempo.html",
  "./meu-arquivo.html",
  "./mural.html",
  "./css/mural.css",
  "./js/mural.js",
  "./explorar.html",
  "./css/explorar.css",
  "./js/explorar.js",
  "./css/meu-arquivo.css",
  "./js/meu-arquivo.js",
  "./css/tempo.css",
  "./js/tempo.js",
  "./css/atlas.css",
  "./js/atlas.js",
  "./css/laboratorio.css",
  "./js/laboratorio.js",
  "./css/biblioteca.css",
  "./js/biblioteca.js",
  "./css/investigacao.css",
  "./js/investigacao.js",
  "./css/inicio.css",
  "./js/inicio.js",
  "./css/main.css",
  "./css/conhecimento.css",
  "./js/conhecimento.js",
  "./css/navigation.css",
  "./js/navigation.js",
  "./entrada-mobile.png",
  "./js/main.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    for (const file of FILES_TO_CACHE) {
      try {
        const response = await fetch(file, { cache: "reload" });

        if (response.ok) {
          await cache.put(file, response);
          console.log("Salvo no cache:", file);
        } else {
          console.warn("Arquivo não encontrado:", file, response.status);
        }
      } catch (error) {
        console.warn("Falha ao salvar:", file, error);
      }
    }

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter((key) =>
          key.startsWith("arquivo-investigativo-") &&
          key !== CACHE_NAME
        )
        .map((key) => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);

      if (response.ok &&
          new URL(event.request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }

      return response;
    } catch (error) {
      const cached = await caches.match(event.request);

      if (cached) return cached;

      if (event.request.mode === "navigate") {
        const home = await caches.match(
  new URL("./index.html", self.registration.scope).href
);

if (home) return home;
      }

      return new Response(
        "Você está offline e este conteúdo não está salvo.",
        {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        }
      );
    }
  })());
});
