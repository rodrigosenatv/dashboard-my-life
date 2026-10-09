// Service worker do My Life.
// Não guarda dados nem telas do app: tudo continua vindo da rede, sempre atualizado.
// A única função é mostrar a página "Você está offline" quando uma navegação falha.

const CACHE = "my-life-offline-v1"
const OFFLINE = "/offline.html"
const ICONE = "/icons/icon-192.png"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE, ICONE]))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)))
    return
  }
  // O ícone da página offline também precisa aparecer sem rede
  if (new URL(request.url).pathname === ICONE) {
    event.respondWith(fetch(request).catch(() => caches.match(ICONE)))
  }
})
