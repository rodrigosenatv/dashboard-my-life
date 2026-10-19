/*
 * Filmes & Séries: a lógica sem tela. Cada título é um item da coleção "Filmes e Séries". O cartaz, a
 * sinopse e o "onde assistir" vêm do TMDB e ficam no próprio item (props._tmdb), para a tela abrir sem
 * esperar a rede. Nada aqui fala com o banco, com o React ou com a internet.
 */
import type { ItemColecao } from "@/features/colecoes/visao-colecao"
import { lerDiaFlex, texto, valorPorNome } from "@/features/pessoal/logica"
import type { Json } from "@/lib/supabase/database.types"
import { normalizar, numeroFlexivel } from "@/lib/utils"

export const CATEGORIAS_FILMES = ["Ação", "Clássicos", "Comédia", "Drama", "Suspense", "Terror", "Romance", "Ficção Científica", "Documentário"] as const
export const PLATAFORMAS = ["Netflix", "Prime Video", "Disney+", "Max", "Globoplay", "Apple TV+"] as const
export const ROTA_FILMES = "/vida/filmes-series"

/** O que o TMDB disse sobre o título, guardado no item: cartaz e sinopse sem perguntar de novo. */
export type InfoTmdb = { id: number; tipo: "movie" | "tv"; poster: string | null; fundo: string | null; ano: string | null; sinopse: string; eps?: number[] }

export type Titulo = {
  item: ItemColecao
  id: string
  nome: string // sem a plataforma do fim
  tipo: "filme" | "serie"
  assistido: boolean
  nota: number | null // 1 a 5
  categoria: string | null
  data: string | null // AAAA-MM-DD
  temporada: number | null
  episodio: number | null
  plataforma: string | null
  tmdb: InfoTmdb | null
  /** A busca de cartazes já procurou e não achou (props._tmdb === false): fica para escolher à mão. */
  naoAchado: boolean
  anotacoes: string // item.content ?? ""
}

const textoOuNulo = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null)

/* ------------------------------------------------------------------ */
/* Plataforma no nome                                                  */
/* ------------------------------------------------------------------ */

/** Nomes de plataforma aceitos no fim do título (já normalizados) e como aparecem na tela. Map, para "constructor" não achar nada. */
const PLATAFORMAS_CONHECIDAS = new Map<string, string>([
  ["netflix", "Netflix"],
  ["prime video", "Prime Video"],
  ["amazon prime video", "Prime Video"],
  ["amazon prime", "Prime Video"],
  ["prime", "Prime Video"],
  ["amazon", "Prime Video"],
  ["disney+", "Disney+"],
  ["disney plus", "Disney+"],
  ["disney", "Disney+"],
  ["max", "Max"],
  ["hbo max", "Max"],
  ["hbo", "Max"],
  ["globoplay", "Globoplay"],
  ["apple tv+", "Apple TV+"],
  ["apple tv", "Apple TV+"],
  ["apple", "Apple TV+"],
  ["star+", "Star+"],
  ["paramount+", "Paramount+"],
  ["paramount", "Paramount+"],
  ["youtube", "YouTube"],
  ["crunchyroll", "Crunchyroll"],
  ["mubi", "MUBI"],
  ["telecine", "Telecine"],
  ["cinema", "Cinema"],
])

function plataformaConhecida(t: string): string | null {
  return PLATAFORMAS_CONHECIDAS.get(normalizar(t)) ?? null
}

/**
 * A plataforma no fim do nome ("Narvik - Netflix", "Ted Lasso | Apple TV+", "The Office (Prime Video)").
 * Só separa quando o fim é uma plataforma conhecida: "Spider-Man: Homecoming" fica como está.
 */
export function separarPlataforma(titulo: string): { nome: string; plataforma: string | null } {
  const limpo = titulo.trim()
  // Depois do último " - ", " – ", " — " ou " | " (com espaços)
  const porSeparador = /^(.*\S)\s+[-–—|]\s+(\S.*)$/.exec(limpo)
  if (porSeparador) {
    const plataforma = plataformaConhecida(porSeparador[2])
    if (plataforma) return { nome: porSeparador[1].trim(), plataforma }
  }
  // Ou entre parênteses no fim
  const porParenteses = /^(.*\S)\s*\(([^()]+)\)$/.exec(limpo)
  if (porParenteses) {
    const plataforma = plataformaConhecida(porParenteses[2])
    if (plataforma) return { nome: porParenteses[1].trim(), plataforma }
  }
  return { nome: limpo, plataforma: null }
}

/* ------------------------------------------------------------------ */
/* Ler um item                                                         */
/* ------------------------------------------------------------------ */

const VERDADEIRO = ["yes", "sim", "true", "__yes__", "x", "✓"]

/** Caixa marcada: true, ou um texto que quer dizer "sim" (o Notion grava "Yes" ou "__yes__"). */
function lerAssistido(v: Json | undefined): boolean {
  if (typeof v === "boolean") return v
  return typeof v === "string" && VERDADEIRO.includes(normalizar(v))
}

/**
 * A nota de 1 a 5, de qualquer jeito que tenha sido gravada: número, estrelas ("⭐⭐⭐⭐") ou texto com um
 * número ("4/5"). Fora de 1 a 5, ou vazia, não há nota.
 */
export function lerNota(v: Json | undefined): number | null {
  if (typeof v === "number") return v >= 1 && v <= 5 ? Math.round(v) : null
  if (typeof v !== "string") return null
  const contaEstrelas = (v.match(/[⭐★]/g) ?? []).length
  const n = contaEstrelas || Number(/[1-5]/.exec(v)?.[0] ?? NaN)
  return n >= 1 && n <= 5 ? n : null
}

/** Temporada ou episódio gravado: arredondado, e só a partir de 1. */
function lerPosicao(v: Json | undefined): number | null {
  const n = numeroFlexivel(v)
  if (n === null) return null
  const r = Math.round(n)
  return r >= 1 ? r : null
}

/** Filme ou série pelo texto de "Filme/Série"; sem ele (ou com outro texto), série é o que tem temporada ou episódio. */
function lerTipo(v: Json | undefined, temporada: number | null, episodio: number | null): "filme" | "serie" {
  const t = normalizar(texto(v))
  if (t.startsWith("serie")) return "serie"
  if (t.startsWith("filme")) return "filme"
  return temporada !== null || episodio !== null ? "serie" : "filme"
}

/** Os dados do TMDB gravados no item, só se estiverem no formato certo (senão o título fica sem cartaz). */
function lerInfoTmdb(v: Json | undefined): InfoTmdb | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null
  const o = v as Record<string, Json | undefined>
  const { id, tipo } = o
  if (typeof id !== "number" || (tipo !== "movie" && tipo !== "tv")) return null
  const info: InfoTmdb = {
    id,
    tipo,
    poster: textoOuNulo(o.poster),
    fundo: textoOuNulo(o.fundo),
    ano: textoOuNulo(o.ano),
    sinopse: typeof o.sinopse === "string" ? o.sinopse : "",
  }
  // Episódios por temporada. Temporada anunciada pode ter 0 episódios (fica, para não desalinhar as
  // temporadas); um valor que não é número inteiro invalida a lista inteira
  const eps: Json[] = Array.isArray(o.eps) ? o.eps : []
  const numeros = eps.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0)
  if (numeros.some((n) => n > 0) && numeros.length === eps.length) info.eps = numeros
  return info
}

/** Um item da coleção como título: nome sem a plataforma, tipo, assistido, nota, progresso e o TMDB guardado. */
export function lerTitulo(item: ItemColecao): Titulo {
  const props = (item.props ?? {}) as Record<string, Json>
  const { nome, plataforma: plataformaDoNome } = separarPlataforma(item.title)
  const temporada = lerPosicao(valorPorNome(props, ["Temporada"]))
  const episodio = lerPosicao(valorPorNome(props, ["Episódio"]))
  const categoria = valorPorNome(props, ["Categoria"])
  return {
    item,
    id: item.id,
    nome: nome || "Sem nome",
    tipo: lerTipo(valorPorNome(props, ["Filme/Série"]), temporada, episodio),
    assistido: lerAssistido(valorPorNome(props, ["Assistido"])),
    nota: lerNota(valorPorNome(props, ["Avaliação"])),
    // Se a coluna vier como lista, vale o primeiro item
    categoria: texto(Array.isArray(categoria) ? categoria[0] : categoria) || null,
    data: lerDiaFlex(valorPorNome(props, ["Data"])),
    temporada,
    episodio,
    plataforma: texto(valorPorNome(props, ["Plataforma"])) || plataformaDoNome,
    tmdb: lerInfoTmdb(props._tmdb),
    naoAchado: props._tmdb === false,
    anotacoes: item.content ?? "",
  }
}

/* ------------------------------------------------------------------ */
/* Estrelas, progresso e rótulos                                       */
/* ------------------------------------------------------------------ */

/** As estrelas de uma nota, para mostrar como texto ("⭐⭐⭐"). */
export const estrelas = (n: number) => "⭐".repeat(Math.max(0, Math.min(5, Math.round(n))))

/**
 * O próximo episódio para o "+1 episódio". Sem a lista de episódios por temporada, anda um episódio na
 * mesma temporada. Com ela: passa para a próxima temporada e, no último episódio da última, `fim` é true.
 */
export function proximoEpisodio(t: Pick<Titulo, "temporada" | "episodio" | "tmdb">): { temporada: number; episodio: number; fim: boolean } {
  const temporada = t.temporada ?? 1
  const episodio = (t.episodio ?? 0) + 1
  // Sem os episódios desta temporada (lista curta ou desatualizada), só anda um episódio
  const total = t.tmdb?.eps?.[temporada - 1]
  if (!total) return { temporada, episodio, fim: false }
  if (episodio <= total) return { temporada, episodio, fim: false }
  // Próxima temporada só se já tem episódio (temporada anunciada fica com 0)
  if (t.tmdb?.eps?.[temporada]) return { temporada: temporada + 1, episodio: 1, fim: false }
  return { temporada, episodio: t.episodio ?? total, fim: true }
}

/** "T3 · E12", "T3" ou "E12" (o que houver); vazio se não há nem temporada nem episódio. */
export function textoProgresso(t: Pick<Titulo, "temporada" | "episodio">): string {
  return [t.temporada ? `T${t.temporada}` : null, t.episodio ? `E${t.episodio}` : null].filter(Boolean).join(" · ")
}

/** O rótulo do cartão para leitor de tela: "Narvik, filme, assistido, 4 de 5 estrelas, Netflix". */
export function rotuloDoTitulo(t: Titulo): string {
  const partes = [t.nome, t.tipo === "serie" ? "série" : "filme"]
  if (t.assistido) partes.push("assistido")
  if (t.nota !== null) partes.push(`${t.nota} de 5 estrelas`)
  if (!t.assistido && t.tipo === "serie" && t.temporada && t.episodio) partes.push(`temporada ${t.temporada}, episódio ${t.episodio}`)
  if (t.plataforma) partes.push(t.plataforma)
  return partes.join(", ")
}

/** Um degradê fixo por nome, para a capa gerada: o mesmo nome sempre dá a mesma cor. */
export function gradienteDoTitulo(nome: string): string {
  // Hash rolante (×31) módulo 360: o módulo a cada passo dá o mesmo resultado e mantém os números pequenos
  let h = 0
  for (const letra of normalizar(nome)) h = (h * 31 + letra.charCodeAt(0)) % 360
  const h2 = (h + 40) % 360
  return `linear-gradient(135deg, hsl(${h} 55% 32%), hsl(${h2} 60% 18%))`
}

/** Link para o item, com o botão "voltar" levando de volta para Filmes & Séries. */
export function linkDoItem(id: string, editar = false): string {
  return `/colecoes/item/${encodeURIComponent(id)}?${editar ? "editar=1&" : ""}voltar=${encodeURIComponent(ROTA_FILMES)}`
}

/* ------------------------------------------------------------------ */
/* Fileiras, destaque e busca na lista                                 */
/* ------------------------------------------------------------------ */

export type Filtro = "tudo" | "filmes" | "series"
export type Fileira = { id: string; titulo: string; itens: Titulo[] }
export type Destaque = { titulo: Titulo; motivo: "continuar" | "lista" | "assistido" }

const noFiltro = (t: Titulo, filtro: Filtro) => filtro === "tudo" || (filtro === "filmes" ? t.tipo === "filme" : t.tipo === "serie")

/** Milissegundos de uma marca de tempo (0 se não der para ler). */
const ms = (s: string) => {
  const n = Date.parse(s)
  return Number.isNaN(n) ? 0 : n
}

/** Da data mais recente para a mais antiga; sem data, por último. */
function maisRecenteComData(a: Titulo, b: Titulo): number {
  if (a.data && b.data) return a.data < b.data ? 1 : a.data > b.data ? -1 : 0
  if (a.data) return -1
  if (b.data) return 1
  return 0
}

/** As fileiras da tela, nesta ordem, sem as vazias. O filtro vale antes de tudo. */
export function fileiras(titulos: Titulo[], filtro: Filtro): Fileira[] {
  const lista = titulos.filter((t) => noFiltro(t, filtro))

  const continuar = lista
    .filter((t) => t.tipo === "serie" && !t.assistido && (t.temporada !== null || t.episodio !== null))
    .sort((a, b) => ms(b.item.updated_at) - ms(a.item.updated_at))
  const emContinuar = new Set(continuar.map((t) => t.id))

  const naLista = lista
    .filter((t) => !t.assistido && !emContinuar.has(t.id))
    .sort((a, b) => b.item.position - a.item.position || ms(b.item.created_at) - ms(a.item.created_at))

  // Todos os assistidos (a fileira mostra só 20, mas os favoritos saem de todos)
  const todosAssistidos = lista
    .filter((t) => t.assistido)
    .sort((a, b) => maisRecenteComData(a, b) || ms(b.item.updated_at) - ms(a.item.updated_at))
  const favoritos = todosAssistidos
    .filter((t) => (t.nota ?? 0) >= 4)
    .sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0) || maisRecenteComData(a, b))

  // Uma fileira por categoria com 2 títulos ou mais, a que tem mais títulos primeiro
  const porCategoria = new Map<string, { nome: string; itens: Titulo[] }>()
  for (const t of lista) {
    if (!t.categoria) continue
    const chave = normalizar(t.categoria)
    const grupo = porCategoria.get(chave) ?? { nome: t.categoria, itens: [] }
    grupo.itens.push(t)
    porCategoria.set(chave, grupo)
  }
  const categorias = [...porCategoria.values()]
    .filter((g) => g.itens.length >= 2)
    .sort((a, b) => b.itens.length - a.itens.length || a.nome.localeCompare(b.nome, "pt-BR"))

  const todas: Fileira[] = [
    { id: "continuar", titulo: "Continuar assistindo", itens: continuar },
    { id: "lista", titulo: "Minha lista", itens: naLista },
    { id: "assistidos", titulo: "Assistidos recentemente", itens: todosAssistidos.slice(0, 20) },
    { id: "favoritos", titulo: "Os que você mais gostou", itens: favoritos },
    ...categorias.map((g) => ({
      id: `cat:${normalizar(g.nome).replace(/\s+/g, "-")}`,
      titulo: g.nome,
      itens: g.itens.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    })),
  ]
  return todas.filter((f) => f.itens.length > 0)
}

/** O título em destaque: o 1º de "continuar", senão o 1º da lista, senão o 1º dos assistidos. */
export function destaque(titulos: Titulo[], filtro: Filtro): Destaque | null {
  const todas = fileiras(titulos, filtro)
  const primeiro = (id: string) => todas.find((f) => f.id === id)?.itens[0]
  const continuar = primeiro("continuar")
  if (continuar) return { titulo: continuar, motivo: "continuar" }
  const naLista = primeiro("lista")
  if (naLista) return { titulo: naLista, motivo: "lista" }
  const assistido = primeiro("assistidos")
  if (assistido) return { titulo: assistido, motivo: "assistido" }
  return null
}

/** Os títulos cujo nome ou plataforma contém a busca (sem acento e sem maiúscula). */
export function buscarNaLista(titulos: Titulo[], busca: string): Titulo[] {
  const termo = normalizar(busca)
  if (!termo) return titulos
  return titulos.filter((t) => normalizar(t.nome).includes(termo) || normalizar(t.plataforma).includes(termo))
}

/* ------------------------------------------------------------------ */
/* TMDB: leitura das respostas e escolhas (puro)                       */
/* ------------------------------------------------------------------ */

export type Provedor = { nome: string; logo: string | null }

export type ResultadoBusca = {
  id: number
  tipo: "movie" | "tv"
  nome: string
  original: string
  ano: string | null
  poster: string | null
  fundo: string | null
  sinopse: string
  generos: number[]
}

export type Detalhes = {
  generos: string[]
  duracao: number | null
  temporadas: number | null
  eps: number[]
  trailer: string | null
  ondeAssistir: { link: string | null; assinatura: Provedor[]; aluguel: Provedor[]; compra: Provedor[] }
}

type Campos = Record<string, unknown>
const comoObjeto = (v: unknown): Campos => (v && typeof v === "object" && !Array.isArray(v) ? (v as Campos) : {})
const comoLista = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const comoTexto = (v: unknown): string => (typeof v === "string" ? v : "")
const comoNumero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** O endereço de uma imagem do TMDB no tamanho pedido (o caminho vem da resposta, como "/abc.jpg"). */
export const imagemTmdb = (caminho: string | null | undefined, tamanho: string): string | null => (caminho ? `https://image.tmdb.org/t/p/${tamanho}${caminho}` : null)

/** O ano de uma data do TMDB ("2022-05-01" vira "2022"). */
const anoDe = (data: string): string | null => (/^\d{4}/.test(data) ? data.slice(0, 4) : null)

/** Os filmes e séries da busca (pessoas saem); filme e série leem nomes de campos diferentes. */
export function lerResultadosBusca(json: unknown): ResultadoBusca[] {
  const resultados: ResultadoBusca[] = []
  for (const bruto of comoLista(comoObjeto(json).results)) {
    const r = comoObjeto(bruto)
    if (r.media_type !== "movie" && r.media_type !== "tv") continue
    const id = comoNumero(r.id)
    if (id === null) continue
    const filme = r.media_type === "movie"
    resultados.push({
      id,
      tipo: filme ? "movie" : "tv",
      nome: comoTexto(filme ? r.title : r.name),
      original: comoTexto(filme ? r.original_title : r.original_name),
      ano: anoDe(comoTexto(filme ? r.release_date : r.first_air_date)),
      poster: textoOuNulo(r.poster_path),
      fundo: textoOuNulo(r.backdrop_path),
      sinopse: comoTexto(r.overview),
      generos: comoLista(r.genre_ids).filter((g): g is number => typeof g === "number"),
    })
  }
  return resultados
}

/** O trailer: o vídeo do YouTube de maior pontuação (Trailer, depois Teaser; em português, depois inglês; oficial). */
export function escolherTrailer(videos: unknown): string | null {
  const pesoDoTipo = (tipo: string) => (tipo === "Trailer" ? 4 : tipo === "Teaser" ? 2 : 0)
  let melhor: { chave: string; pontos: number } | null = null
  for (const bruto of comoLista(videos)) {
    const v = comoObjeto(bruto)
    const chave = comoTexto(v.key)
    if (normalizar(comoTexto(v.site)) !== "youtube" || !chave) continue
    const lingua = comoTexto(v.iso_639_1)
    const pontos = pesoDoTipo(comoTexto(v.type)) + (lingua === "pt" ? 2 : lingua === "en" ? 1 : 0) + (v.official === true ? 0.5 : 0)
    // Só troca com mais pontos: num empate, vale o primeiro
    if (!melhor || pontos > melhor.pontos) melhor = { chave, pontos }
  }
  return melhor?.chave ?? null
}

/** Onde assistir no Brasil: assinatura, aluguel e compra, do provedor mais destacado para o menos. */
function lerOndeAssistir(br: Campos): Detalhes["ondeAssistir"] {
  const lista = (v: unknown): Provedor[] =>
    comoLista(v)
      .map(comoObjeto)
      .sort((a, b) => (comoNumero(a.display_priority) ?? 999) - (comoNumero(b.display_priority) ?? 999))
      .map((p) => ({ nome: comoTexto(p.provider_name), logo: textoOuNulo(p.logo_path) }))
      .filter((p) => p.nome !== "")
  return { link: textoOuNulo(br.link), assinatura: lista(br.flatrate), aluguel: lista(br.rent), compra: lista(br.buy) }
}

/** Os detalhes de um filme ou de uma série (`tipo` é o do TMDB: "movie" ou "tv"). */
export function lerDetalhes(json: unknown, tipo: "movie" | "tv"): Detalhes {
  const d = comoObjeto(json)
  const filme = tipo === "movie"
  const seasons = comoLista(d.seasons)
    .map(comoObjeto)
    .filter((s) => (comoNumero(s.season_number) ?? 0) >= 1)
    .sort((a, b) => (comoNumero(a.season_number) ?? 0) - (comoNumero(b.season_number) ?? 0))
  const providers = comoObjeto(comoObjeto(d["watch/providers"]).results)
  return {
    generos: comoLista(d.genres).map((g) => comoTexto(comoObjeto(g).name)).filter(Boolean),
    duracao: filme ? comoNumero(d.runtime) || null : comoNumero(comoLista(d.episode_run_time)[0]),
    temporadas: filme ? null : comoNumero(d.number_of_seasons),
    eps: filme ? [] : seasons.map((s) => comoNumero(s.episode_count) ?? 0),
    trailer: escolherTrailer(comoObjeto(d.videos).results),
    ondeAssistir: lerOndeAssistir(comoObjeto(providers.BR)),
  }
}

const CATEGORIA_DO_GENERO = new Map<number, string>([
  [28, "Ação"],
  [12, "Ação"],
  [10759, "Ação"],
  [10752, "Ação"],
  [37, "Ação"],
  [35, "Comédia"],
  [18, "Drama"],
  [36, "Drama"],
  [10402, "Drama"],
  [10768, "Drama"],
  [80, "Suspense"],
  [53, "Suspense"],
  [9648, "Suspense"],
  [27, "Terror"],
  [10749, "Romance"],
  [878, "Ficção Científica"],
  [14, "Ficção Científica"],
  [10765, "Ficção Científica"],
  [99, "Documentário"],
])

/** A categoria que o título provavelmente tem: os antigos são "Clássicos"; senão, o 1º gênero que tiver categoria. */
export function categoriaSugerida(generoIds: number[], ano: string | null): string | null {
  if (ano && Number(ano) <= 1979) return "Clássicos"
  for (const g of generoIds) {
    const categoria = CATEGORIA_DO_GENERO.get(g)
    if (categoria) return categoria
  }
  return null
}

/**
 * O resultado que é o título pedido: do tipo certo e com o nome (ou o original) igual. Sem igual, serve um
 * cujo nome contenha o pedido, ou o contrário. Sem nenhum, o título fica sem cartaz até a pessoa escolher.
 */
export function melhorResultado(resultados: ResultadoBusca[], nome: string, tipo: "filme" | "serie"): ResultadoBusca | null {
  const alvo = normalizar(nome)
  if (!alvo) return null
  const doTipo = resultados.filter((r) => r.tipo === (tipo === "filme" ? "movie" : "tv"))
  const igual = doTipo.find((r) => normalizar(r.nome) === alvo || normalizar(r.original) === alvo)
  if (igual) return igual
  return (
    doTipo.find((r) => {
      const n = normalizar(r.nome)
      return n !== "" && (n.includes(alvo) || alvo.includes(n))
    }) ?? null
  )
}

/** O que guardar no título a partir de um resultado; `eps` só entra se vier com temporadas. */
export function infoDoResultado(r: ResultadoBusca, eps?: number[]): InfoTmdb {
  const info: InfoTmdb = { id: r.id, tipo: r.tipo, poster: r.poster, fundo: r.fundo, ano: r.ano, sinopse: r.sinopse }
  if (eps?.length) info.eps = eps
  return info
}
