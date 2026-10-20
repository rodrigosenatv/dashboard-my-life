import { embedYoutube, lerYoutube, linkYoutube, type VideoYoutube } from "@/lib/youtube"

/** Vídeo de um site que deixa tocar dentro do app: o player fica num iframe do próprio site. */
export type VideoDeSite =
  | { fonte: "youtube"; youtube: VideoYoutube }
  | { fonte: "instagram"; codigo: string; tipo: "p" | "reel" | "tv" }
  | { fonte: "tiktok"; id: string; link: string }
  /** `pagina`: o nome da página ou do perfil nos links facebook.com/<página>/videos/<id>. */
  | { fonte: "facebook"; id: string; tipo: "reel" | "video"; pagina: string | null }

/** Arquivo de vídeo ou de áudio: guardado no app (arquivo://…) ou um link direto (https://…/aula.mp4). */
export type ArquivoDeMidia = { fonte: "arquivo"; endereco: string; guardado: boolean; tipo: "video" | "audio" }

export type Midia = VideoDeSite | ArquivoDeMidia

export const NOME_DA_FONTE: Record<VideoDeSite["fonte"], string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
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

/**
 * tiktok.com/@conta/video/123…, /embed/v2/123…, /player/v1/123…, m.tiktok.com/v/123….html.
 * Links curtos (vm.tiktok.com) precisam ser abertos antes (ver `lib/link-curto`).
 */
function lerTiktok(u: URL): VideoDeSite | null {
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "")
  if (host !== "tiktok.com") return null
  const m = u.pathname.match(/^\/(?:@[^/]+\/(?:video|photo)|embed(?:\/v2)?|player\/v1|v)\/(\d{10,25})(?:\.html)?(?:\/|$)/)
  if (!m) return null
  // Com a conta no endereço dá para guardar o link limpo (sem o ?_r= / ?_t= do compartilhar)
  const link = u.pathname.startsWith("/@") ? `https://www.tiktok.com${u.pathname.replace(/\/+$/, "")}` : u.href
  return { fonte: "tiktok", id: m[1], link }
}

/**
 * Reels e vídeos do Facebook: facebook.com/reel/123…, /<página>/videos/123… (também com um nome
 * no meio: /videos/<nome>/123…), /watch/?v=123…, /video.php?v=123… e o próprio player embutido
 * (plugins/video.php?href=…), com www., m. ou web. e com o ?mibextid= / ?rdid= do compartilhar.
 * Os links de compartilhar (facebook.com/share/r/…, /share/v/… e fb.watch/…) precisam ser
 * abertos antes (ver `lib/link-curto`).
 */
function lerFacebook(u: URL, dentroDoPlayer = false): VideoDeSite | null {
  const host = u.hostname.toLowerCase().replace(/^(?:www|m|web|mbasic|touch|[a-z]{2}-[a-z]{2})\./, "")
  if (host !== "facebook.com") return null
  const caminho = u.pathname.replace(/\/+$/, "")
  const reel = caminho.match(/^\/reel\/(\d{5,25})$/i)
  if (reel) return { fonte: "facebook", id: reel[1], tipo: "reel", pagina: null }
  const daPagina = caminho.match(/^\/([\w.-]{1,80})\/videos\/(?:[^/]+\/)?(\d{5,25})$/i)
  if (daPagina) return { fonte: "facebook", id: daPagina[2], tipo: "video", pagina: daPagina[1] }
  if (/^\/(?:watch(?:\/live)?|video\.php|video\/video\.php)$/i.test(caminho)) {
    const id = u.searchParams.get("v") ?? u.searchParams.get("video_id") ?? ""
    return /^\d{5,25}$/.test(id) ? { fonte: "facebook", id, tipo: "video", pagina: null } : null
  }
  // O endereço de um player embutido (o código "Incorporar" do Facebook): vale o vídeo de dentro
  if (!dentroDoPlayer && /^\/(?:v[\d.]+\/)?plugins\/video\.php$/i.test(caminho)) {
    try {
      return lerFacebook(new URL(u.searchParams.get("href") ?? ""), true)
    } catch {
      return null
    }
  }
  return null
}

/** O mesmo vídeo escrito de jeitos diferentes (com ou sem ?igsh=, youtu.be ou youtube.com) tem a mesma chave. */
export function chaveDoVideo(m: Midia): string {
  switch (m.fonte) {
    case "youtube":
      return `youtube:${m.youtube.id}`
    case "instagram":
      return `instagram:${m.codigo}`
    case "tiktok":
      return `tiktok:${m.id}`
    case "facebook":
      // O mesmo vídeo como reel (/reel/…) ou como vídeo (/watch/?v=…) tem o mesmo número
      return `facebook:${m.id}`
    case "arquivo":
      return `arquivo:${m.endereco}`
  }
}

/** O texto de um link vale como legenda quando não é só o endereço ou o nome do arquivo. */
export function legendaDoLink(rotulo: string, endereco: string): string | null {
  const r = rotulo.replace(/\s+/g, " ").trim()
  if (!r || r === endereco) return null
  if (/^(https?:\/\/|www\.)/i.test(r)) return null
  if (/\.(mp4|m4v|mov|webm|ogv|mp3|m4a|aac|wav|ogg|oga|opus)$/i.test(r)) return null
  return r
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
  const site = lerInstagram(u) ?? lerTiktok(u) ?? lerFacebook(u)
  if (site) return site
  const tipo = tipoDoArquivo(u.pathname)
  return tipo ? { fonte: "arquivo", endereco: u.href, guardado: false, tipo } : null
}

/** Só os vídeos de sites (YouTube, Instagram, TikTok, Facebook). */
export function lerVideoDeSite(endereco: string | null | undefined): VideoDeSite | null {
  const m = lerMidia(endereco)
  return m && m.fonte !== "arquivo" ? m : null
}

/** Vídeos em pé (Shorts, reels, TikTok) ficam lado a lado; os deitados ocupam a largura toda. */
export function emPe(m: Midia): boolean {
  if (m.fonte === "youtube") return m.youtube.vertical
  if (m.fonte === "facebook") return m.tipo === "reel"
  return m.fonte === "instagram" || m.fonte === "tiktok"
}

/** O endereço do vídeo no Facebook que vai para o player deles, nos formatos que o player aceita. */
function hrefFacebook(v: Extract<VideoDeSite, { fonte: "facebook" }>): string {
  if (v.tipo === "reel") return `https://www.facebook.com/reel/${v.id}/`
  if (v.pagina) return `https://www.facebook.com/${v.pagina}/videos/${v.id}/`
  return `https://www.facebook.com/video.php?v=${v.id}`
}

/**
 * Endereço do player embutido, montado só com o código do vídeo (nada do link original vai para o iframe).
 * No feed, o vídeo começa sozinho e repete (o Instagram e o Facebook não deixam: lá a pessoa toca para
 * começar).
 */
export function enderecoDoPlayer(v: VideoDeSite, opcoes: { feed?: boolean } = {}): string {
  switch (v.fonte) {
    case "youtube":
      return embedYoutube(v.youtube, { autoplay: true, repetir: opcoes.feed })
    case "instagram":
      // Os mesmos parâmetros do embed oficial; o "ci" no fim faz o Instagram avisar a altura do post
      return `https://www.instagram.com/${v.tipo}/${v.codigo}/embed/?cr=1&v=14#${encodeURIComponent(JSON.stringify({ ci: 0, os: 0 }))}`
    case "tiktok":
      return `https://www.tiktok.com/player/v1/${v.id}?rel=0${opcoes.feed ? "&autoplay=1&loop=1" : ""}`
    case "facebook": {
      // Os parâmetros do código "Incorporar" do Facebook, só com o vídeo (sem o texto do post). O player
      // ocupa a largura do iframe e tira a altura da proporção entre width e height: um tico mais baixa
      // que 9:16 (ou 16:9), para nunca passar da caixa (1px a mais faria o dedo rolar dentro do iframe).
      // O autoplay deles fica de fora: no teste, ele só tirava o som, sem começar o vídeo.
      const p = new URLSearchParams({
        href: hrefFacebook(v),
        show_text: "false",
        width: v.tipo === "reel" ? "360" : "640",
        height: v.tipo === "reel" ? "638" : "358",
        t: "0",
        locale: "pt_BR",
      })
      return `https://www.facebook.com/plugins/video.php?${p}`
    }
  }
}

/** Link para abrir o vídeo no site (sem o ?igsh= / ?si= / ?mibextid= de rastreio quando dá para limpar). */
export function linkDoVideo(v: VideoDeSite): string {
  switch (v.fonte) {
    case "youtube":
      return linkYoutube(v.youtube)
    case "instagram":
      return `https://www.instagram.com/${v.tipo}/${v.codigo}/`
    case "tiktok":
      return v.link
    case "facebook":
      if (v.tipo === "reel") return `https://www.facebook.com/reel/${v.id}`
      return v.pagina ? `https://www.facebook.com/${v.pagina}/videos/${v.id}/` : `https://www.facebook.com/watch/?v=${v.id}`
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

/** Quantos links de vídeo (YouTube, Instagram, TikTok, Facebook) aparecem num texto. */
export function contarVideos(texto: string | null | undefined): number {
  let n = 0
  for (const m of (texto ?? "").matchAll(/https?:\/\/[^\s<>()[\]"'`]+/gi)) if (lerVideoDeSite(m[0])) n++
  return n
}
