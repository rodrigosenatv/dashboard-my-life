import { embedYoutube, lerYoutube, linkYoutube, type VideoYoutube } from "@/lib/youtube"

/** Vídeo de um site que deixa tocar dentro do app: o player fica num iframe do próprio site. */
export type VideoDeSite =
  | { fonte: "youtube"; youtube: VideoYoutube }
  | { fonte: "instagram"; codigo: string; tipo: "p" | "reel" | "tv" }
  | { fonte: "tiktok"; id: string; link: string }

/** Arquivo de vídeo ou de áudio: guardado no app (arquivo://…) ou um link direto (https://…/aula.mp4). */
export type ArquivoDeMidia = { fonte: "arquivo"; endereco: string; guardado: boolean; tipo: "video" | "audio" }

export type Midia = VideoDeSite | ArquivoDeMidia

export const NOME_DA_FONTE: Record<VideoDeSite["fonte"], string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
}

/** O mesmo prefixo de `PREFIXO_ARQUIVO` (lib/arquivos), repetido aqui para esta parte não depender do Supabase. */
const PREFIXO_ARQUIVO = "arquivo://"
const EXTENSOES_VIDEO = ["mp4", "m4v", "mov", "webm", "ogv"]
const EXTENSOES_AUDIO = ["mp3", "m4a", "aac", "wav", "ogg", "oga", "opus"]

function tipoDoArquivo(caminho: string): ArquivoDeMidia["tipo"] | null {
  const ext = caminho.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? ""
  if (EXTENSOES_VIDEO.includes(ext)) return "video"
  if (EXTENSOES_AUDIO.includes(ext)) return "audio"
  return null
}

/**
 * Reels e posts: instagram.com/reel/…, /reels/…, /p/…, /tv/…, também com o nome da conta
 * antes (instagram.com/conta/reel/…) e com o ?igsh= / ?utm_source= do compartilhar.
 */
function lerInstagram(u: URL): VideoDeSite | null {
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "")
  if (host !== "instagram.com" && host !== "instagr.am") return null
  const partes = u.pathname.split("/").filter(Boolean)
  for (let i = 0; i < Math.min(partes.length - 1, 2); i++) {
    const tipo = partes[i].toLowerCase()
    if (tipo !== "p" && tipo !== "reel" && tipo !== "reels" && tipo !== "tv") continue
    const codigo = partes[i + 1]
    // O código tem 11 letras na maioria dos posts; "audio" (de /reels/audio/…) não é um vídeo
    if (!/^[\w-]{8,48}$/.test(codigo)) return null
    return { fonte: "instagram", codigo, tipo: tipo === "reels" ? "reel" : tipo }
  }
  return null
}

/** tiktok.com/@conta/video/123…, /embed/v2/123…, /player/v1/123…, m.tiktok.com/v/123….html. Links curtos (vm.tiktok.com) não dá para abrir aqui. */
function lerTiktok(u: URL): VideoDeSite | null {
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "")
  if (host !== "tiktok.com") return null
  const m = u.pathname.match(/^\/(?:@[^/]+\/(?:video|photo)|embed(?:\/v2)?|player\/v1|v)\/(\d{10,25})(?:\.html)?(?:\/|$)/)
  return m ? { fonte: "tiktok", id: m[1], link: u.href } : null
}

/** Entende um endereço de vídeo ou áudio que dá para tocar dentro do app. Qualquer outro link volta `null`. */
export function lerMidia(endereco: string | null | undefined): Midia | null {
  const t = (endereco ?? "").trim()
  if (!t || /\s/.test(t)) return null
  if (t.startsWith(PREFIXO_ARQUIVO)) {
    let caminho: string
    try {
      caminho = decodeURIComponent(t.slice(PREFIXO_ARQUIVO.length))
    } catch {
      return null
    }
    const tipo = tipoDoArquivo(caminho)
    return tipo ? { fonte: "arquivo", endereco: t, guardado: true, tipo } : null
  }
  if (!/^https?:\/\//i.test(t)) return null
  let u: URL
  try {
    u = new URL(t)
  } catch {
    return null
  }
  const youtube = lerYoutube(t)
  if (youtube) return { fonte: "youtube", youtube }
  const site = lerInstagram(u) ?? lerTiktok(u)
  if (site) return site
  const tipo = tipoDoArquivo(u.pathname)
  return tipo ? { fonte: "arquivo", endereco: u.href, guardado: false, tipo } : null
}

/** Só os vídeos de sites (YouTube, Instagram, TikTok). */
export function lerVideoDeSite(endereco: string | null | undefined): VideoDeSite | null {
  const m = lerMidia(endereco)
  return m && m.fonte !== "arquivo" ? m : null
}

/** Vídeos em pé (Shorts, reels, TikTok) ficam lado a lado; os deitados ocupam a largura toda. */
export function emPe(m: Midia): boolean {
  if (m.fonte === "youtube") return m.youtube.vertical
  return m.fonte === "instagram" || m.fonte === "tiktok"
}

/** Endereço do player embutido, montado só com o código do vídeo (nada do link original vai para o iframe). */
export function enderecoDoPlayer(v: VideoDeSite): string {
  switch (v.fonte) {
    case "youtube":
      return embedYoutube(v.youtube, { autoplay: true })
    case "instagram":
      // Os mesmos parâmetros do embed oficial; o "ci" no fim faz o Instagram avisar a altura do post
      return `https://www.instagram.com/${v.tipo}/${v.codigo}/embed/?cr=1&v=14#${encodeURIComponent(JSON.stringify({ ci: 0, os: 0 }))}`
    case "tiktok":
      return `https://www.tiktok.com/player/v1/${v.id}?rel=0`
  }
}

/** Link para abrir o vídeo no site (sem o ?igsh= / ?si= de rastreio quando dá para limpar). */
export function linkDoVideo(v: VideoDeSite): string {
  switch (v.fonte) {
    case "youtube":
      return linkYoutube(v.youtube)
    case "instagram":
      return `https://www.instagram.com/${v.tipo}/${v.codigo}/`
    case "tiktok":
      return v.link
  }
}

/**
 * Altura que o embed do Instagram manda para a página ({"type":"MEASURE","details":{"height":…}}),
 * em texto JSON ou já como objeto. Qualquer outra mensagem volta `null`.
 */
export function alturaDoInstagram(dados: unknown): number | null {
  let d: unknown = dados
  if (typeof d === "string") {
    try {
      d = JSON.parse(d)
    } catch {
      return null
    }
  }
  if (!d || typeof d !== "object") return null
  const msg = d as { type?: unknown; details?: { height?: unknown } }
  if (msg.type !== "MEASURE") return null
  const h = Number(msg.details?.height)
  return Number.isFinite(h) && h >= 120 && h <= 5000 ? Math.ceil(h) : null
}

/** Quantos links de vídeo (YouTube, Instagram, TikTok) aparecem num texto. */
export function contarVideos(texto: string | null | undefined): number {
  let n = 0
  for (const m of (texto ?? "").matchAll(/https?:\/\/[^\s<>()[\]"'`]+/gi)) if (lerVideoDeSite(m[0])) n++
  return n
}
