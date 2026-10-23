// Service worker do My Life.
// As telas e os dados vêm sempre da rede, atualizados. As exceções existem para ler sem internet:
// - os arquivos estáticos do app (/_next/static, com nome que muda a cada versão) ficam guardados;
// - a tela do leitor (/ler/...) e a do modo treino (/treinar) ficam guardadas depois de abertas
//   e só são usadas quando a rede falha (o treino em andamento fica no próprio aparelho).
// Os livros ficam no armazenamento do próprio aparelho (IndexedDB), não aqui.
// Fora isso, a única função é mostrar a página "Você está offline" quando uma navegação falha.

const CACHE = "my-life-offline-v2"
const ESTATICOS = "my-life-estaticos-v1"
const LEITOR = "my-life-leitor-v1"
const OFFLINE = "/offline.html"
const ICONE = "/icons/icon-192.png"
const MAX_ESTATICOS = 400

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE, ICONE]))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  const manter = [CACHE, ESTATICOS, LEITOR]
  event.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => !manter.includes(c)).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

/** Mantém o cache de estáticos com um tamanho limitado (os mais antigos saem primeiro). */
async function aparar(cache) {
  const chaves = await cache.keys()
  for (let i = 0; i < chaves.length - MAX_ESTATICOS; i++) await cache.delete(chaves[i])
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Telas do leitor e do modo treino: o documento e os dados da rota (pedido RSC que o Next
  // faz ao abrir). Rede primeiro; sem rede, a última versão guardada.
  const rsc = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")
  const telaSemRede = url.pathname.startsWith("/ler/") || url.pathname === "/treinar"
  if (telaSemRede && (request.mode === "navigate" || rsc)) {
    const chave = url.pathname + (rsc ? "?rsc" : "")
    const preCarga = request.headers.get("Next-Router-Prefetch") === "1"
    event.respondWith(
      fetch(request)
        .then((resposta) => {
          if (resposta.ok && !resposta.redirected && !preCarga) {
            const copia = resposta.clone()
            event.waitUntil(caches.open(LEITOR).then((c) => c.put(chave, copia)))
          }
          return resposta
        })
        .catch(async () => {
          const guardada = await caches.match(chave, { cacheName: LEITOR, ignoreVary: true })
          if (guardada) return guardada
          return request.mode === "navigate" ? caches.match(OFFLINE) : Response.error()
        }),
    )
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)))
    return
  }

  // Arquivos com nome único por versão: guardados na primeira vez, nunca mudam
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(ESTATICOS).then(async (cache) => {
        const guardado = await cache.match(request)
        if (guardado) return guardado
        const resposta = await fetch(request)
        if (resposta.ok) {
          event.waitUntil(cache.put(request, resposta.clone()).then(() => aparar(cache)))
        }
        return resposta
      }),
    )
    return
  }

  // O ícone da página offline também precisa aparecer sem rede
  if (url.pathname === ICONE) {
    event.respondWith(fetch(request).catch(() => caches.match(ICONE)))
  }
})

/** O cache de telas autenticadas nunca deve sobreviver à troca de conta. */
self.addEventListener("message", (event) => {
  if (event.data?.type === "LIMPAR_CACHE_PESSOAL") {
    event.waitUntil(caches.delete(LEITOR))
  }
})
