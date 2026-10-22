// Service worker da PWA do SeeFast.
// Cache-first para o shell estatico, network-first para navegacoes.
// A API (/api/) nunca e cacheada: os dados tem de ser frescos.

const CACHE = "seefast-v1";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/seefast-mobile-icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((chave) => chave !== CACHE).map((chave) => caches.delete(chave)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const pedido = event.request;
  if (pedido.method !== "GET") return;

  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // nunca cachear dados da API

  if (pedido.mode === "navigate") {
    // Rede primeiro; sem rede, o shell em cache.
    event.respondWith(
      fetch(pedido).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Cache primeiro (os assets tem hash no nome), com actualizacao em segundo plano.
  event.respondWith(
    caches.match(pedido).then((emCache) => {
      if (emCache) return emCache;
      return fetch(pedido).then((resposta) => {
        const copia = resposta.clone();
        caches.open(CACHE).then((cache) => cache.put(pedido, copia));
        return resposta;
      });
    })
  );
});
