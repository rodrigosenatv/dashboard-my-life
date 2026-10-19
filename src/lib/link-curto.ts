import { lerVideoDeSite, linkDoVideo } from "@/lib/videos"

/*
 * O "Copiar link" do aplicativo do TikTok dá um link curto (vm.tiktok.com/ZM…) que só vira o
 * endereço do vídeo depois de aberto. O navegador não consegue seguir esse redirecionamento por
 * conta própria (o TikTok bloqueia), então o servidor do app abre o link e devolve o endereço.
 */

const HOSTS_CURTOS = ["vm.tiktok.com", "vt.tiktok.com"]
const HOSTS_TIKTOK = ["tiktok.com", "www.tiktok.com", "m.tiktok.com"]

/** Link curto de compartilhar que precisa ser aberto: vm.tiktok.com/…, vt.tiktok.com/…, tiktok.com/t/…. */
export function ehLinkCurto(endereco: string | null | undefined): boolean {
  let u: URL
  try {
    u = new URL((endereco ?? "").trim())
  } catch {
    return false
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false
  if (u.username || u.password || u.port) return false
  const host = u.hostname.toLowerCase()
  if (HOSTS_CURTOS.includes(host)) return /^\/[\w-]{4,40}\/?$/.test(u.pathname)
  if (HOSTS_TIKTOK.includes(host)) return /^\/t\/[\w-]{4,40}\/?$/.test(u.pathname)
  return false
}

type Buscar = (url: string, init: RequestInit) => Promise<Response>

const NAVEGADOR =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"

/**
 * Segue os redirecionamentos do link curto (no máximo 4, sempre dentro do TikTok) e devolve o
 * link limpo do vídeo, ou `null` quando ele não leva a um vídeo.
 */
export async function abrirLinkCurto(endereco: string, buscar: Buscar = fetch): Promise<string | null> {
  if (!ehLinkCurto(endereco)) return null
  let atual = new URL(endereco.trim())
  atual.protocol = "https:"
  for (let passo = 0; passo < 4; passo++) {
    const resposta = await buscar(atual.href, {
      redirect: "manual",
      headers: { "user-agent": NAVEGADOR, accept: "text/html" },
      signal: AbortSignal.timeout(6000),
    })
    const destino = resposta.headers.get("location")
    if (resposta.status < 300 || resposta.status >= 400 || !destino) return null
    const proximo = new URL(destino, atual)
    const video = lerVideoDeSite(proximo.href)
    if (video?.fonte === "tiktok") return linkDoVideo(video)
    const host = proximo.hostname.toLowerCase()
    if (proximo.protocol !== "https:" || !(HOSTS_TIKTOK.includes(host) || HOSTS_CURTOS.includes(host))) return null
    atual = proximo
  }
  return null
}
