/*
 * Leitura: a lógica sem tela. Prateleiras, meta do ano, diário de leitura (dias seguidos, ritmo e
 * previsão de término), capas (as que vêm da busca e as geradas) e a leitura dos resultados do
 * Google Books e da Open Library.
 *
 * Sem importações de código de propósito (só tipos): assim os testes rodam direto no Node.
 */

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

/** O que a lógica usa de um livro (a linha da tabela `books` tem isto e mais). */
export type LivroBase = {
  id: string
  title: string
  author: string | null
  category: string | null
  status: string
  pages_total: number | null
  pages_read: number
  rating: number | null
  started_at: string | null
  finished_at: string | null
  read_years: number[]
  favorite: boolean
  cover_path: string | null
  created_at: string
  updated_at: string
}

type Valor = string | number | boolean | null | Valor[] | { [k: string]: Valor | undefined }

/* ------------------------------------------------------------------ */
/* Datas (AAAA-MM-DD no fuso do aparelho)                              */
/* ------------------------------------------------------------------ */

const dois = (n: number) => String(n).padStart(2, "0")

export function diaIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

function dataDoDia(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Dias de `de` até `ate` (positivo quando `ate` vem depois). */
export function diasEntre(de: string, ate: string): number {
  const a = dataDoDia(de)
  const b = dataDoDia(ate)
  if (!a || !b) return 0
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

export function somarDias(iso: string, n: number): string {
  const d = dataDoDia(iso) ?? new Date()
  d.setDate(d.getDate() + n)
  return diaIso(d)
}

/** Os sete dias da semana de `hoje`, de segunda a domingo. */
export function semanaDe(hoje: string): string[] {
  const d = dataDoDia(hoje) ?? new Date()
  const desdeSegunda = (d.getDay() + 6) % 7
  const segunda = somarDias(diaIso(d), -desdeSegunda)
  return Array.from({ length: 7 }, (_, i) => somarDias(segunda, i))
}

/* ------------------------------------------------------------------ */
/* Texto                                                               */
/* ------------------------------------------------------------------ */

export function normalizar(t: string | null | undefined): string {
  return (t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

export const plural = (n: number, um: string, varios?: string) => `${n} ${n === 1 ? um : (varios ?? `${um}s`)}`

/* ------------------------------------------------------------------ */
/* Ano de leitura e prateleiras                                        */
/* ------------------------------------------------------------------ */

/** O ano em que o livro foi lido por último: o do término ou o maior dos anos marcados. */
export function anoDeLeitura(l: Pick<LivroBase, "finished_at" | "read_years">): number | null {
  const doTermino = l.finished_at ? Number(l.finished_at.slice(0, 4)) : NaN
  if (Number.isFinite(doTermino) && doTermino > 1900) return doTermino
  const anos = (l.read_years ?? []).filter((a) => Number.isFinite(a) && a > 1900)
  return anos.length ? Math.max(...anos) : null
}

/** Lido naquele ano (conta também as releituras marcadas no ano). */
export function lidoNoAno(l: Pick<LivroBase, "status" | "finished_at" | "read_years">, ano: number): boolean {
  if (l.status !== "finalizado") return false
  return (l.read_years ?? []).includes(ano) || (l.finished_at?.startsWith(String(ano)) ?? false)
}

const porData = (campo: "updated_at" | "created_at") => (a: LivroBase, b: LivroBase) => (b[campo] ?? "").localeCompare(a[campo] ?? "")
const porTitulo = (a: LivroBase, b: LivroBase) => a.title.localeCompare(b.title, "pt-BR")

export function lendoAgora<L extends LivroBase>(livros: L[]): L[] {
  return livros.filter((l) => l.status === "lendo").sort(porData("updated_at"))
}

export function queroLer<L extends LivroBase>(livros: L[]): L[] {
  return livros.filter((l) => l.status === "desejo").sort(porData("created_at"))
}

export function pausados<L extends LivroBase>(livros: L[]): L[] {
  return livros.filter((l) => l.status === "pausado").sort(porData("updated_at"))
}

/** Os lidos, do término mais recente para o mais antigo (sem data no fim, por título). */
export function lidos<L extends LivroBase>(livros: L[]): L[] {
  return livros
    .filter((l) => l.status === "finalizado")
    .sort((a, b) => (anoDeLeitura(b) ?? 0) - (anoDeLeitura(a) ?? 0) || (b.finished_at ?? "").localeCompare(a.finished_at ?? "") || porTitulo(a, b))
}

export function lidosNoAno<L extends LivroBase>(livros: L[], ano: number): L[] {
  return lidos(livros).filter((l) => lidoNoAno(l, ano))
}

export function favoritos<L extends LivroBase>(livros: L[]): L[] {
  return livros.filter((l) => l.favorite).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || porTitulo(a, b))
}

export type IdPrateleira = "desejos" | "pausados" | "lidos-ano" | "favoritos" | "lidos"

export type Prateleira<L> = { id: IdPrateleira; titulo: string; descricao: string; livros: L[] }

/** As prateleiras da biblioteca, só as que têm livros. */
export function prateleiras<L extends LivroBase>(livros: L[], ano: number): Prateleira<L>[] {
  const doAno = lidosNoAno(livros, ano)
  const antes = lidos(livros).filter((l) => !lidoNoAno(l, ano))
  const lista: Prateleira<L>[] = [
    { id: "desejos", titulo: "Quero ler", descricao: "A fila dos próximos", livros: queroLer(livros) },
    { id: "pausados", titulo: "Pausados", descricao: "Esperando a sua volta", livros: pausados(livros) },
    { id: "lidos-ano", titulo: `Lidos em ${ano}`, descricao: "As leituras deste ano", livros: doAno },
    { id: "favoritos", titulo: "Favoritos", descricao: "Os que marcaram", livros: favoritos(livros) },
    { id: "lidos", titulo: doAno.length ? "Lidos antes" : "Lidos", descricao: "O arquivo da sua história", livros: antes },
  ]
  return lista.filter((p) => p.livros.length > 0)
}

/* ------------------------------------------------------------------ */
/* Acervo: filtros da lista completa                                   */
/* ------------------------------------------------------------------ */

export type FiltroAcervo = "todos" | "lendo" | "desejos" | "lidos" | "pausados" | "favoritos"
export type OrdemAcervo = "recentes" | "titulo" | "autor" | "nota"

export function filtrarAcervo<L extends LivroBase>(
  livros: L[],
  { filtro = "todos", busca = "", categoria = "", ano = null, ordem = "recentes" }: { filtro?: FiltroAcervo; busca?: string; categoria?: string; ano?: number | null; ordem?: OrdemAcervo },
): L[] {
  const termo = normalizar(busca)
  const lista = livros.filter((l) => {
    if (filtro === "lendo" && l.status !== "lendo") return false
    if (filtro === "desejos" && l.status !== "desejo") return false
    if (filtro === "lidos" && l.status !== "finalizado") return false
    if (filtro === "pausados" && l.status !== "pausado") return false
    if (filtro === "favoritos" && !l.favorite) return false
    if (categoria && normalizar(l.category) !== normalizar(categoria)) return false
    if (ano && !lidoNoAno(l, ano)) return false
    if (termo && !normalizar(`${l.title} ${l.author ?? ""} ${l.category ?? ""}`).includes(termo)) return false
    return true
  })
  const comparar: Record<OrdemAcervo, (a: L, b: L) => number> = {
    recentes: (a, b) => (b.finished_at ?? b.updated_at ?? "").localeCompare(a.finished_at ?? a.updated_at ?? "") || porTitulo(a, b),
    titulo: porTitulo,
    autor: (a, b) => (a.author ?? "~").localeCompare(b.author ?? "~", "pt-BR") || porTitulo(a, b),
    nota: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || porTitulo(a, b),
  }
  return lista.sort(comparar[ordem])
}

/** As categorias em uso, da mais comum para a menos comum (para filtros e sugestões). */
export function categorias(livros: Pick<LivroBase, "category">[]): string[] {
  const contagem = new Map<string, { nome: string; n: number }>()
  for (const l of livros) {
    const nome = l.category?.trim()
    if (!nome) continue
    const chave = normalizar(nome)
    const atual = contagem.get(chave)
    if (atual) atual.n++
    else contagem.set(chave, { nome, n: 1 })
  }
  return [...contagem.values()].sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, "pt-BR")).map((c) => c.nome)
}

/** Anos com livros lidos, do mais recente para o mais antigo. */
export function anosDeLeitura(livros: Pick<LivroBase, "status" | "finished_at" | "read_years">[]): number[] {
  const anos = new Set<number>()
  for (const l of livros) {
    if (l.status !== "finalizado") continue
    for (const a of l.read_years ?? []) if (a > 1900) anos.add(a)
    const t = l.finished_at ? Number(l.finished_at.slice(0, 4)) : NaN
    if (t > 1900) anos.add(t)
  }
  return [...anos].sort((a, b) => b - a)
}

/* ------------------------------------------------------------------ */
/* Progresso                                                           */
/* ------------------------------------------------------------------ */

export function fracaoLida(l: Pick<LivroBase, "pages_read" | "pages_total" | "status">): number {
  if (l.status === "finalizado") return 1
  if (!l.pages_total || l.pages_total <= 0) return 0
  return Math.max(0, Math.min(1, (l.pages_read ?? 0) / l.pages_total))
}

export function paginasRestantes(l: Pick<LivroBase, "pages_read" | "pages_total">): number | null {
  if (!l.pages_total) return null
  return Math.max(0, l.pages_total - (l.pages_read ?? 0))
}

/** "Página 104 de 291", "Página 12" ou "Ainda não começou". */
export function textoPagina(l: Pick<LivroBase, "pages_read" | "pages_total">): string {
  if (!l.pages_read) return l.pages_total ? `${l.pages_total} páginas` : "Ainda não começou"
  return l.pages_total ? `Página ${l.pages_read} de ${l.pages_total}` : `Página ${l.pages_read}`
}

/** Um número de página válido: inteiro entre 0 e o total (ou um teto generoso sem total). */
export function paginaValida(n: number, total: number | null): number {
  const teto = total && total > 0 ? total : 100_000
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(teto, Math.round(n)))
}

/* ------------------------------------------------------------------ */
/* Meta do ano                                                         */
/* ------------------------------------------------------------------ */

function fracaoDoAno(hoje: string): number {
  const d = dataDoDia(hoje) ?? new Date()
  const inicio = new Date(d.getFullYear(), 0, 1).getTime()
  const fim = new Date(d.getFullYear() + 1, 0, 1).getTime()
  // Conta o dia de hoje inteiro: no dia 31/12 o ano está completo
  return Math.min(1, (d.getTime() - inicio + 86_400_000) / (fim - inicio))
}

export type RitmoMeta = {
  /** Livros que já deveriam estar lidos hoje para bater a meta. */
  esperado: number
  /** Lidos menos o esperado, arredondado. */
  diferenca: number
  tom: "feita" | "a-frente" | "no-ritmo" | "atras"
  texto: string
  /** "1 livro a cada 16 dias" até o fim do ano; null com a meta feita. */
  cadencia: string | null
}

export function ritmoDaMeta(meta: number, feitos: number, hoje: string): RitmoMeta {
  const esperado = meta * fracaoDoAno(hoje)
  if (feitos >= meta) return { esperado, diferenca: feitos - meta, tom: "feita", texto: "Meta cumprida", cadencia: null }
  const diferenca = Math.round(feitos - esperado)
  const fimDoAno = `${hoje.slice(0, 4)}-12-31`
  const diasRestantes = Math.max(1, diasEntre(hoje, fimDoAno) + 1)
  const faltam = meta - feitos
  const cada = Math.max(1, Math.floor(diasRestantes / faltam))
  const cadencia = cada <= 1 ? `${plural(Math.ceil(faltam / diasRestantes), "livro")} por dia` : `1 livro a cada ${cada} dias`
  if (diferenca >= 1) return { esperado, diferenca, tom: "a-frente", texto: `${plural(diferenca, "livro")} à frente do ritmo`, cadencia }
  if (diferenca <= -1) return { esperado, diferenca, tom: "atras", texto: `${plural(-diferenca, "livro")} atrás do ritmo`, cadencia }
  return { esperado, diferenca: 0, tom: "no-ritmo", texto: "No ritmo da meta", cadencia }
}

/* ------------------------------------------------------------------ */
/* Diário de leitura                                                   */
/* ------------------------------------------------------------------ */

/** Um dia de leitura de um livro (um item da coleção "Diário de leitura"). */
export type DiaLeitura = {
  id: string
  /** Id do livro. */
  livro: string
  titulo: string
  /** AAAA-MM-DD. */
  dia: string
  /** Página em que o dia começou. */
  inicio: number
  /** Última página do dia. */
  ate: number
  /** Páginas lidas no dia. */
  paginas: number
}

const numero = (v: Valor | undefined): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v === "string" && /^-?\d+([.,]\d+)?$/.test(v.trim())) return Number(v.trim().replace(",", "."))
  return null
}

export function lerDiaLeitura(item: { id: string; title: string; props: unknown }): DiaLeitura | null {
  const v = (item.props && typeof item.props === "object" ? item.props : {}) as Record<string, Valor | undefined>
  const livro = typeof v._livro === "string" ? v._livro : ""
  const dia = typeof v.Data === "string" ? v.Data.slice(0, 10) : ""
  if (!livro || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null
  const ate = Math.max(0, numero(v["Até a página"]) ?? 0)
  const inicio = Math.max(0, Math.min(ate, numero(v._inicio) ?? ate))
  const paginas = Math.max(0, numero(v["Páginas"]) ?? ate - inicio)
  return { id: item.id, livro, titulo: item.title, dia, inicio, ate, paginas }
}

/**
 * O registro do dia depois de a página mudar de `antes` para `depois`. Sem registro no dia, só
 * cria quando a página avançou. Voltar a página corrige o dia (nunca fica negativo).
 */
export function registroDoDia(atual: Pick<DiaLeitura, "inicio" | "ate"> | null, antes: number, depois: number): { inicio: number; ate: number; paginas: number } | null {
  if (!atual) {
    if (!(depois > antes)) return null
    return { inicio: antes, ate: depois, paginas: depois - antes }
  }
  const inicio = Math.min(atual.inicio, depois)
  return { inicio, ate: depois, paginas: Math.max(0, depois - inicio) }
}

/** Dias (AAAA-MM-DD) com alguma página lida. */
export function diasComLeitura(dias: DiaLeitura[]): Set<string> {
  return new Set(dias.filter((d) => d.paginas > 0).map((d) => d.dia))
}

/**
 * Dias seguidos de leitura até hoje. Se hoje ainda não teve leitura, a sequência de ontem continua
 * valendo (o dia ainda não acabou).
 */
export function sequencia(dias: DiaLeitura[], hoje: string): number {
  const lidos = diasComLeitura(dias)
  let dia = lidos.has(hoje) ? hoje : somarDias(hoje, -1)
  let n = 0
  while (lidos.has(dia)) {
    n++
    dia = somarDias(dia, -1)
  }
  return n
}

export function paginasEntre(dias: DiaLeitura[], de: string, ate: string): number {
  return dias.reduce((n, d) => (d.dia >= de && d.dia <= ate ? n + d.paginas : n), 0)
}

export type ResumoSemana = { dias: string[]; lidos: Set<string>; paginas: number; hoje: number }

export function resumoSemana(dias: DiaLeitura[], hoje: string): ResumoSemana {
  const semana = semanaDe(hoje)
  const lidos = diasComLeitura(dias.filter((d) => d.dia >= semana[0] && d.dia <= semana[6]))
  return { dias: semana, lidos, paginas: paginasEntre(dias, semana[0], semana[6]), hoje: paginasEntre(dias, hoje, hoje) }
}

/**
 * Páginas por dia de um livro, nas últimas `janela` dias desde o primeiro dia de leitura dele na
 * janela (conta os dias sem leitura no meio: é o ritmo de verdade).
 */
export function ritmoDoLivro(dias: DiaLeitura[], livroId: string, hoje: string, janela = 14): number | null {
  const desde = somarDias(hoje, -(janela - 1))
  const doLivro = dias.filter((d) => d.livro === livroId && d.paginas > 0 && d.dia >= desde && d.dia <= hoje)
  if (!doLivro.length) return null
  const primeiro = doLivro.reduce((m, d) => (d.dia < m ? d.dia : m), hoje)
  const total = doLivro.reduce((n, d) => n + d.paginas, 0)
  return total / (diasEntre(primeiro, hoje) + 1)
}

/** Quando termina no ritmo atual: em quantos dias e em que dia. */
export function previsaoDeTermino(restantes: number | null, ritmo: number | null, hoje: string): { dias: number; dia: string } | null {
  if (!restantes || restantes <= 0 || !ritmo || ritmo <= 0) return null
  const dias = Math.ceil(restantes / ritmo)
  if (dias > 3650) return null
  return { dias, dia: somarDias(hoje, dias) }
}

/* ------------------------------------------------------------------ */
/* Capas                                                               */
/* ------------------------------------------------------------------ */

/** Sites de onde vêm as capas buscadas (só endereços https desses lugares são aceitos). */
const SITES_DE_CAPA = ["books.google.com", "books.googleusercontent.com", "googleusercontent.com", "covers.openlibrary.org", "archive.org"]

export function urlDeCapaSegura(u: string | null | undefined): string | null {
  if (!u) return null
  const limpo = u.trim().replace(/^http:\/\//i, "https://").replace(/&edge=curl/g, "")
  try {
    const url = new URL(limpo)
    if (url.protocol !== "https:") return null
    const host = url.hostname.toLowerCase()
    if (!SITES_DE_CAPA.some((s) => host === s || host.endsWith(`.${s}`))) return null
    return url.toString()
  } catch {
    return null
  }
}

export type Capa = { tipo: "url"; url: string } | { tipo: "arquivo"; caminho: string } | null

/** A capa guardada em `cover_path`: endereço de uma capa buscada ou foto enviada (caminho no storage). */
export function capaDoLivro(coverPath: string | null | undefined): Capa {
  const c = coverPath?.trim()
  if (!c) return null
  if (/^https?:\/\//i.test(c)) {
    const url = urlDeCapaSegura(c)
    return url ? { tipo: "url", url } : null
  }
  return { tipo: "arquivo", caminho: c }
}

/** O id do Google Books guardado no endereço da capa (para buscar a sinopse depois). */
export function googleIdDaCapa(coverPath: string | null | undefined): string | null {
  const capa = capaDoLivro(coverPath)
  if (capa?.tipo !== "url") return null
  try {
    const url = new URL(capa.url)
    if (!url.hostname.endsWith("google.com") && !url.hostname.endsWith("googleusercontent.com")) return null
    const id = url.searchParams.get("id")
    return id && /^[\w-]{6,}$/.test(id) ? id : null
  } catch {
    return null
  }
}

function hash(t: string): number {
  let h = 2166136261
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Matizes das capas geradas (ciano, petróleo, violeta, índigo, âmbar, rosa, verde-água). */
const MATIZES = [192, 176, 258, 228, 38, 338, 158]

/** As duas cores (matizes HSL) da capa gerada de um título: sempre as mesmas para o mesmo livro. */
export function tonsDaCapa(titulo: string): { a: number; b: number } {
  const h = hash(normalizar(titulo) || "livro")
  const a = MATIZES[h % MATIZES.length]
  const b = MATIZES[(h >>> 8) % MATIZES.length]
  return { a, b: b === a ? (a + 40) % 360 : b }
}

/** O número de catálogo do livro na biblioteca: três letras da categoria e três algarismos ("DES·417"). */
export function codigoDoLivro(l: Pick<LivroBase, "id" | "category">): string {
  const letras = normalizar(l.category)
    .replace(/[^a-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
  return `${letras.padEnd(3, "X").replace(/^XXX$/, "GER")}·${String(hash(l.id) % 1000).padStart(3, "0")}`
}

/** Espessura do livro em 3D (px), pelo número de páginas: um livro grosso parece grosso. */
export function espessura(paginas: number | null | undefined): number {
  const p = paginas && paginas > 0 ? paginas : 220
  return Math.round(Math.max(7, Math.min(26, 6 + p / 32)))
}

/* ------------------------------------------------------------------ */
/* Busca de livros (Google Books e Open Library)                       */
/* ------------------------------------------------------------------ */

export type ResultadoLivro = {
  /** "google:<id>" ou "ol:<chave>". */
  chave: string
  fonte: "google" | "openlibrary"
  /** Id do volume no Google Books (para a capa grande e a sinopse). */
  googleId: string | null
  titulo: string
  subtitulo: string | null
  autores: string[]
  paginas: number | null
  ano: string | null
  editora: string | null
  categorias: string[]
  idioma: string | null
  /** Capa pequena, para a lista de resultados. */
  capa: string | null
  /** Id da capa na Open Library (para a versão grande). */
  capaOpenLibrary: number | null
  isbn: string | null
}

const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [])

/** Um volume da resposta do Google Books, ou null quando não serve. */
export function lerVolumeGoogle(item: unknown): ResultadoLivro | null {
  if (!item || typeof item !== "object") return null
  const { id, volumeInfo } = item as { id?: unknown; volumeInfo?: Record<string, unknown> }
  if (typeof id !== "string" || !volumeInfo) return null
  const titulo = typeof volumeInfo.title === "string" ? volumeInfo.title.trim() : ""
  if (!titulo) return null
  const subtitulo = typeof volumeInfo.subtitle === "string" ? volumeInfo.subtitle.trim() : ""
  const imagens = (volumeInfo.imageLinks ?? {}) as Record<string, unknown>
  const capa = urlDeCapaSegura(typeof imagens.thumbnail === "string" ? imagens.thumbnail : typeof imagens.smallThumbnail === "string" ? imagens.smallThumbnail : null)
  const paginas = typeof volumeInfo.pageCount === "number" && volumeInfo.pageCount > 0 ? volumeInfo.pageCount : null
  const ids = Array.isArray(volumeInfo.industryIdentifiers) ? (volumeInfo.industryIdentifiers as { type?: string; identifier?: string }[]) : []
  const isbn = ids.find((i) => i.type === "ISBN_13")?.identifier ?? ids.find((i) => i.type === "ISBN_10")?.identifier ?? null
  const data = typeof volumeInfo.publishedDate === "string" ? volumeInfo.publishedDate : ""
  return {
    chave: `google:${id}`,
    fonte: "google",
    googleId: id,
    titulo,
    subtitulo: subtitulo || null,
    autores: lista(volumeInfo.authors),
    paginas,
    ano: /^\d{4}/.test(data) ? data.slice(0, 4) : null,
    editora: typeof volumeInfo.publisher === "string" ? volumeInfo.publisher : null,
    categorias: lista(volumeInfo.categories),
    idioma: typeof volumeInfo.language === "string" ? volumeInfo.language : null,
    capa,
    capaOpenLibrary: null,
    isbn,
  }
}

/** A maior capa que o Google oferece nos detalhes de um volume. */
export function capaGrandeGoogle(imagens: unknown): string | null {
  if (!imagens || typeof imagens !== "object") return null
  const i = imagens as Record<string, unknown>
  for (const chave of ["medium", "large", "small", "thumbnail", "smallThumbnail"]) {
    const url = typeof i[chave] === "string" ? urlDeCapaSegura(i[chave] as string) : null
    if (url) return url
  }
  return null
}

/** Um livro da busca da Open Library, ou null quando não serve. */
export function lerDocOpenLibrary(doc: unknown): ResultadoLivro | null {
  if (!doc || typeof doc !== "object") return null
  const d = doc as Record<string, unknown>
  const titulo = typeof d.title === "string" ? d.title.trim() : ""
  const chave = typeof d.key === "string" ? d.key : ""
  if (!titulo || !chave) return null
  const capaId = typeof d.cover_i === "number" && d.cover_i > 0 ? d.cover_i : null
  const paginas = typeof d.number_of_pages_median === "number" && d.number_of_pages_median > 0 ? Math.round(d.number_of_pages_median) : null
  const ano = typeof d.first_publish_year === "number" ? String(d.first_publish_year) : null
  return {
    chave: `ol:${chave}`,
    fonte: "openlibrary",
    googleId: null,
    titulo,
    subtitulo: null,
    autores: lista(d.author_name).slice(0, 3),
    paginas,
    ano,
    editora: lista(d.publisher)[0] ?? null,
    categorias: [],
    idioma: lista(d.language)[0] ?? null,
    capa: capaId ? `https://covers.openlibrary.org/b/id/${capaId}-M.jpg` : null,
    capaOpenLibrary: capaId,
    isbn: lista(d.isbn)[0] ?? null,
  }
}

/** A consulta para a busca: ISBN vira "isbn:…"; o resto vai como foi digitado. */
export function consultaDeBusca(termo: string): string {
  const t = termo.trim()
  const digitos = t.replace(/[-\s]/g, "")
  if (/^(97[89])?\d{9}[\dXx]$/.test(digitos)) return `isbn:${digitos.toUpperCase()}`
  return t
}

/** Tira resultados repetidos (mesmo título e autor), mantendo o primeiro (o mais relevante). */
export function semRepetidos(resultados: ResultadoLivro[]): ResultadoLivro[] {
  const vistos = new Set<string>()
  const saida: ResultadoLivro[] = []
  for (const r of resultados) {
    const chave = `${normalizarTitulo(r.titulo)}|${normalizar(r.autores[0])}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    saida.push(r)
  }
  return saida
}

/* ------------------------------------------------------------------ */
/* Semelhança de títulos (para achar a capa certa sozinho)             */
/* ------------------------------------------------------------------ */

const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "e", "o", "a", "os", "as", "um", "uma", "the", "of", "and", "em", "no", "na", "para", "com"])

export function normalizarTitulo(t: string | null | undefined): string {
  return normalizar(t)
    .replace(/\*/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function palavras(t: string | null | undefined): Set<string> {
  return new Set(
    normalizarTitulo(t)
      .split(" ")
      .filter((p) => p.length > 1 && !PALAVRAS_VAZIAS.has(p)),
  )
}

/**
 * Quanto dois títulos se parecem (0 a 1). Vale o maior entre a semelhança das palavras e o quanto o
 * título mais curto está contido no mais longo ("Antifrágil" e "Antifrágil: coisas que se
 * beneficiam com o caos").
 */
export function semelhanca(a: string | null | undefined, b: string | null | undefined): number {
  const pa = palavras(a)
  const pb = palavras(b)
  if (!pa.size || !pb.size) return normalizarTitulo(a) && normalizarTitulo(a) === normalizarTitulo(b) ? 1 : 0
  let comuns = 0
  for (const p of pa) if (pb.has(p)) comuns++
  const dice = (2 * comuns) / (pa.size + pb.size)
  const contido = comuns / Math.min(pa.size, pb.size)
  return Math.max(dice, contido * 0.92)
}

/**
 * O resultado que é mesmo aquele livro (título parecido e, quando o livro tem autor, autor parecido),
 * preferindo os que têm capa. Null quando nenhum convence.
 */
export function escolherResultado(livro: { title: string; author: string | null }, resultados: ResultadoLivro[], minimo = 0.62): ResultadoLivro | null {
  let melhor: { r: ResultadoLivro; nota: number } | null = null
  for (const r of resultados) {
    let nota = Math.max(semelhanca(livro.title, r.titulo), r.subtitulo ? semelhanca(livro.title, `${r.titulo}: ${r.subtitulo}`) : 0)
    if (livro.author?.trim() && r.autores.length) {
      const doAutor = Math.max(...r.autores.map((a) => semelhanca(livro.author, a)))
      nota = doAutor >= 0.5 ? nota + 0.05 : nota * 0.7
    }
    if (r.capa || r.capaOpenLibrary) nota += 0.04
    if (!melhor || nota > melhor.nota) melhor = { r, nota }
  }
  return melhor && melhor.nota >= minimo ? melhor.r : null
}

/** Texto simples a partir da sinopse em HTML do Google (sem tags, com os parágrafos). */
export function sinopseEmTexto(html: string | null | undefined): string {
  if (!html) return ""
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
