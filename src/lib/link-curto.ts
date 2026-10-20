import { lerVideoDeSite, linkDoVideo } from "@/lib/videos"

/*
 * O "Copiar link" dos aplicativos dá um link de compartilhar que só vira o endereço do vídeo depois
 * de aberto: no TikTok, vm.tiktok.com/ZM…; no Facebook, facebook.com/share/r/… (reels),
 * facebook.com/share/v/… (vídeos) e fb.watch/…. O navegador não consegue seguir esse
 * redirecionamento por conta própria (os sites bloqueiam), então o servidor do app abre o link e
 * devolve o endereço do vídeo.
 */

export type SiteDoLinkCurto = "tiktok" | "facebook"

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
const COMPUTADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"

const CODIGO = /^\/[\w-]{4,40}\/?$/

const SITES: Record<SiteDoLinkCurto, { hosts: string[]; navegador: string; ehCurto: (host: string, caminho: string) => boolean }> = {
  tiktok: {
    // O redirecionamento só pode passar por estes endereços
    hosts: ["vm.tiktok.com", "vt.tiktok.com", "tiktok.com", "www.tiktok.com", "m.tiktok.com"],
    navegador: IPHONE,
    ehCurto: (host, caminho) => (host === "vm.tiktok.com" || host === "vt.tiktok.com" ? CODIGO.test(caminho) : /^\/t\/[\w-]{4,40}\/?$/.test(caminho)),
  },
  facebook: {
    hosts: ["fb.watch", "facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"],
    navegador: COMPUTADOR,
    ehCurto: (host, caminho) => (host === "fb.watch" ? CODIGO.test(caminho) : /^\/share\/[rv]\/[\w-]{4,40}\/?$/.test(caminho)),
  },
}

/**
 * De que site é o link de compartilhar que precisa ser aberto: vm.tiktok.com/…, vt.tiktok.com/…,
 * tiktok.com/t/…, facebook.com/share/r/…, facebook.com/share/v/… ou fb.watch/…. Outro link: `null`.
 */
export function siteDoLinkCurto(endereco: string | null | undefined): SiteDoLinkCurto | null {
  let u: URL
  try {
    u = new URL((endereco ?? "").trim())
  } catch {
    return null
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null
  if (u.username || u.password || u.port) return null
  const host = u.hostname.toLowerCase()
  for (const site of ["tiktok", "facebook"] as const) {
    if (SITES[site].hosts.includes(host) && SITES[site].ehCurto(host, u.pathname)) return site
  }
  return null
}

export function ehLinkCurto(endereco: string | null | undefined): boolean {
  return siteDoLinkCurto(endereco) !== null
}

/** Se o texto tem algum link de compartilhar (ele não toca no texto até virar o endereço do vídeo). */
export function temLinkCurto(texto: string | null | undefined): boolean {
  for (const m of (texto ?? "").matchAll(/https?:\/\/[^\s<>()[\]"'`]+/gi)) {
    if (ehLinkCurto(m[0].replace(/[.,;:!?]+$/, ""))) return true
  }
  return false
}

/**
 * O link limpo do vídeo do site num endereço de destino. Quando o Facebook pede login antes, o
 * endereço do vídeo pode vir no ?next= da página de login.
 */
function videoNoDestino(destino: URL, site: SiteDoLinkCurto): string | null {
  const achar = (endereco: string | null) => {
    const video = lerVideoDeSite(endereco)
    return video?.fonte === site ? linkDoVideo(video) : null
  }
  return achar(destino.href) ?? (site === "facebook" ? achar(destino.searchParams.get("next")) : null)
}

type Buscar = (url: string, init: RequestInit) => Promise<Response>

/**
 * Segue os redirecionamentos do link de compartilhar (no máximo 4, sempre dentro do mesmo site) e
 * devolve o link limpo do vídeo, ou `null` quando ele não leva a um vídeo.
 */
export async function abrirLinkCurto(endereco: string, buscar: Buscar = fetch): Promise<string | null> {
  const site = siteDoLinkCurto(endereco)
  if (!site) return null
  const { hosts, navegador } = SITES[site]
  let atual = new URL(endereco.trim())
  atual.protocol = "https:"
  for (let passo = 0; passo < 4; passo++) {
    const resposta = await buscar(atual.href, {
      redirect: "manual",
      headers: { "user-agent": navegador, accept: "text/html" },
      signal: AbortSignal.timeout(6000),
    })
    const destino = resposta.headers.get("location")
    if (resposta.status < 300 || resposta.status >= 400 || !destino) return null
    const proximo = new URL(destino, atual)
    const video = videoNoDestino(proximo, site)
    if (video) return video
    if (proximo.protocol !== "https:" || !hosts.includes(proximo.hostname.toLowerCase())) return null
    atual = proximo
  }
  return null
}
