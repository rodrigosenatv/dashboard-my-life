/** Um vídeo do YouTube: o id, o segundo em que começa e se é um Short (em pé). */
export type VideoYoutube = { id: string; inicio: number; vertical: boolean }

/** "90", "90s", "1m30s", "1h2m3s" em segundos. */
function lerTempo(t: string | null): number {
  if (!t) return 0
  if (/^\d+$/.test(t)) return Number(t)
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0
}

/**
 * Entende os links que o YouTube gera: youtube.com/watch?v=…, youtu.be/…, /shorts/…,
 * /embed/…, /live/…, com ou sem "www."/"m.", com tempo (?t=1m30s) e com o ?si= do compartilhar.
 */
export function lerYoutube(url: string | null | undefined): VideoYoutube | null {
  const t = (url ?? "").trim()
  if (!t) return null
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, "")
  let id = ""
  let vertical = false
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? ""
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v") ?? ""
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/)
      if (m) {
        id = m[2]
        vertical = m[1] === "shorts"
      }
    }
  }
  if (!/^[\w-]{11}$/.test(id)) return null
  return { id, inicio: lerTempo(u.searchParams.get("t") ?? u.searchParams.get("start")), vertical }
}

/** O link limpo para guardar (sem o ?si= de rastreio). */
export function linkYoutube(v: VideoYoutube): string {
  if (v.vertical) return `https://youtube.com/shorts/${v.id}`
  return `https://www.youtube.com/watch?v=${v.id}${v.inicio ? `&t=${v.inicio}s` : ""}`
}

/** Endereço do player embutido (sem cookies até dar play). `repetir` volta ao começo no fim (como no feed). */
export function embedYoutube(v: VideoYoutube, opcoes: { autoplay?: boolean; repetir?: boolean } = {}): string {
  const p = new URLSearchParams({ playsinline: "1", rel: "0" })
  if (v.inicio) p.set("start", String(v.inicio))
  if (opcoes.autoplay) p.set("autoplay", "1")
  if (opcoes.repetir) {
    // O YouTube só repete um vídeo sozinho quando ele é a própria "playlist"
    p.set("loop", "1")
    p.set("playlist", v.id)
  }
  return `https://www.youtube-nocookie.com/embed/${v.id}?${p}`
}

export const miniaturaYoutube = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

/**
 * Título e canal do vídeo, da resposta do oEmbed do YouTube. Espaços juntados e limite de tamanho (o título
 * vai na playlist, então não pode crescer sem fim). Sem título válido: null.
 */
export function lerOembed(dados: unknown): { titulo: string; canal: string | null } | null {
  if (!dados || typeof dados !== "object") return null
  const o = dados as { title?: unknown; author_name?: unknown }
  const limpar = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null
    const t = v.replace(/\s+/g, " ").trim().slice(0, max).trim()
    return t || null
  }
  const titulo = limpar(o.title, 200)
  if (!titulo) return null
  return { titulo, canal: limpar(o.author_name, 100) }
}
