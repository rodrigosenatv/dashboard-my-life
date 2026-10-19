import { chaveDoVideo, legendaDoLink, lerMidia, type Midia } from "@/lib/videos"

/*
 * Os vídeos ficam no texto das páginas (como vieram do Notion): um link por linha, às vezes
 * com um nome ([Jab cruzado](https://…)). Aqui ficam as regras para achar esses links, montar
 * o feed e pôr ou tirar um vídeo do texto sem mexer no resto.
 */

/** Um vídeo achado no texto de uma página. */
export type VideoNoTexto = {
  chave: string
  endereco: string
  midia: Midia
  legenda: string | null
  /** A parte da página em que ele está (o título acima: "# Bíceps" ou "**Bíceps**"). */
  parte: string | null
  /** O link está sozinho na linha: dá para tirar sem mexer no resto do texto. */
  sozinho: boolean
}

const CERCA = /^\s{0,3}(`{3,}|~{3,})/
// [rótulo](endereço "título") e ![alt](endereço); o rótulo pode ter colchetes escapados
const LINK = /(!?)\[((?:\\.|[^\\\]])*)\]\(\s*<?([^\s)>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g
const SOLTO = /<?(https?:\/\/[^\s<>()[\]"'`]+)>?/g
// Citação e marcador de lista; a caixa de tarefa ("[ ]") fica: um vídeo numa tarefa não está sozinho
const MARCADORES = /^\s*(?:>\s*)*(?:(?:[-*+]|\d{1,3}[.)])\s+)?/

/**
 * Título de uma parte da página: "# Bíceps", "## Ombro" ou uma linha só em negrito
 * ("**Bíceps**", que é como os blocos recolhíveis do Notion chegam). "###" para baixo fica de
 * fora: são detalhes dentro de uma parte.
 */
export function tituloDaParte(linha: string): string | null {
  const t = linha.match(/^\s{0,3}#{1,2}\s+(.+?)\s*#*\s*$/)?.[1] ?? linha.match(/^\s{0,3}(\*\*|__)(\S(?:.*?\S)?)\1\s*:?\s*$/)?.[2]
  if (!t || /\]\(|https?:\/\//i.test(t)) return null
  const limpo = t
    .replace(/\*\*|__|`/g, "")
    .replace(/\s*\{toggle="?true"?\}\s*$/i, "")
    .trim()
  return limpo || null
}

function linhas(texto: string | null | undefined): string[] {
  return (texto ?? "").replace(/\r\n?/g, "\n").split("\n")
}

type Achado = { endereco: string; rotulo: string }

/** Os links de uma linha (fora de `código`) e o que sobra dela sem eles. */
function linksDaLinha(linha: string): { achados: Achado[]; resto: string } {
  const semCodigo = linha.replace(/`[^`]*`/g, (c) => " ".repeat(c.length))
  const achados: Achado[] = []
  let resto = semCodigo.replace(LINK, (_todo, _img: string, rotulo: string, endereco: string) => {
    achados.push({ endereco, rotulo: rotulo.replace(/\\(.)/g, "$1") })
    return " "
  })
  resto = resto.replace(SOLTO, (_todo, endereco: string) => {
    // Pontuação no fim ("veja https://youtu.be/x.") não faz parte do link
    const limpo = endereco.replace(/[.,;:!?]+$/, "")
    achados.push({ endereco: limpo, rotulo: limpo })
    return " "
  })
  return { achados, resto }
}

/** Os vídeos de um texto, na ordem em que aparecem (áudios ficam de fora). */
export function extrairVideos(texto: string | null | undefined): VideoNoTexto[] {
  const saida: VideoNoTexto[] = []
  let parte: string | null = null
  let cerca: string | null = null
  for (const linha of linhas(texto)) {
    const abre = linha.match(CERCA)?.[1]
    if (cerca) {
      if (abre && abre[0] === cerca[0] && abre.length >= cerca.length) cerca = null
      continue
    }
    if (abre) {
      cerca = abre
      continue
    }
    const titulo = tituloDaParte(linha)
    if (titulo) {
      parte = titulo
      continue
    }
    const { achados, resto } = linksDaLinha(linha)
    const videos = achados.flatMap((a) => {
      const midia = lerMidia(a.endereco)
      if (!midia || (midia.fonte === "arquivo" && midia.tipo === "audio")) return []
      return [{ a, midia }]
    })
    const sozinho = achados.length === 1 && videos.length === 1 && !resto.replace(MARCADORES, "").trim()
    for (const { a, midia } of videos) {
      saida.push({ chave: chaveDoVideo(midia), endereco: a.endereco, midia, legenda: legendaDoLink(a.rotulo, a.endereco), parte, sozinho })
    }
  }
  return saida
}

export type Parte = { titulo: string; linha: number }

/** As partes da página (títulos # e ## e linhas só em negrito), na ordem, sem repetir nomes. */
export function partesDoTexto(texto: string | null | undefined): Parte[] {
  const saida: Parte[] = []
  let cerca: string | null = null
  linhas(texto).forEach((linha, i) => {
    const abre = linha.match(CERCA)?.[1]
    if (cerca) {
      if (abre && abre[0] === cerca[0] && abre.length >= cerca.length) cerca = null
      return
    }
    if (abre) {
      cerca = abre
      return
    }
    const titulo = tituloDaParte(linha)
    if (titulo && !saida.some((p) => p.titulo === titulo)) saida.push({ titulo, linha: i })
  })
  return saida
}

/** A linha que vai para o texto: o link sozinho, ou [nome](link) quando a pessoa deu um nome. */
export function linhaDoVideo(endereco: string, nome?: string | null): string {
  const n = (nome ?? "").replace(/\s+/g, " ").trim()
  return n ? `[${n.replace(/([\\[\]])/g, "\\$1")}](${endereco})` : endereco
}

/**
 * Põe a linha de um vídeo no texto: no fim da parte escolhida (antes do próximo título) ou no
 * fim da página. Sempre com uma linha em branco antes e depois, para virar um parágrafo só dele.
 */
export function inserirVideo(texto: string | null | undefined, novaLinha: string, parte?: string | null): string {
  const ls = linhas(texto)
  let fim = ls.length
  const partes = parte ? partesDoTexto(texto) : []
  const i = partes.findIndex((p) => p.titulo === parte)
  if (i >= 0) fim = partes[i + 1]?.linha ?? ls.length
  // Depois da última linha com conteúdo da parte (ou da página)
  let ate = fim - 1
  const comeco = i >= 0 ? partes[i].linha : -1
  while (ate > comeco && !ls[ate]?.trim()) ate--
  const antes = ls.slice(0, ate + 1)
  const depois = ls.slice(ate + 1)
  while (depois.length && !depois[0].trim()) depois.shift()
  const blocos: string[] = []
  if (antes.some((l) => l.trim())) blocos.push(antes.join("\n"), "")
  blocos.push(novaLinha)
  if (depois.length) blocos.push("", depois.join("\n"))
  return blocos.join("\n")
}

/**
 * Tira do texto a primeira linha que só tem este vídeo. Volta `null` quando o vídeo não está
 * sozinho numa linha (aí é melhor a pessoa editar a página).
 */
export function removerVideo(texto: string | null | undefined, chave: string): string | null {
  const ls = linhas(texto)
  let cerca: string | null = null
  for (let i = 0; i < ls.length; i++) {
    const abre = ls[i].match(CERCA)?.[1]
    if (cerca) {
      if (abre && abre[0] === cerca[0] && abre.length >= cerca.length) cerca = null
      continue
    }
    if (abre) {
      cerca = abre
      continue
    }
    const [v] = extrairVideos(ls[i])
    if (!v || !v.sozinho || v.chave !== chave || extrairVideos(ls[i]).length !== 1) continue
    const saida = [...ls.slice(0, i), ...ls.slice(i + 1)]
    // Não deixa duas linhas em branco onde o vídeo estava
    if (i > 0 && i < saida.length && !saida[i - 1].trim() && !saida[i].trim()) saida.splice(i, 1)
    while (saida.length && !saida[0].trim()) saida.shift()
    return saida.join("\n")
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Feed                                                                */
/* ------------------------------------------------------------------ */

/** Uma página de onde saem vídeos, com o grupo dela no feed (a própria página ou o hobby). */
export type FontePagina = { id: string; titulo: string; grupo: string; grupoTitulo: string; conteudo: string | null | undefined }

export type ItemFeed = VideoNoTexto & { paginaId: string; paginaTitulo: string; grupo: string; grupoTitulo: string }

/** Os vídeos das páginas, na ordem delas. Um vídeo que aparece duas vezes entra uma vez só. */
export function montarFeed(fontes: FontePagina[]): ItemFeed[] {
  const vistos = new Set<string>()
  const itens: ItemFeed[] = []
  for (const f of fontes) {
    for (const v of extrairVideos(f.conteudo)) {
      if (vistos.has(v.chave)) continue
      vistos.add(v.chave)
      itens.push({ ...v, paginaId: f.id, paginaTitulo: f.titulo, grupo: f.grupo, grupoTitulo: f.grupoTitulo })
    }
  }
  return itens
}

type NoDaArvore = { id: string; title: string; parent_id: string | null; position: number }

/** As páginas e todas as subpáginas delas, na ordem de leitura (cada página antes das filhas). */
export function comSubpaginas<T extends NoDaArvore>(raizes: T[], arvore: T[]): { pagina: T; nivel: number; raiz: T }[] {
  const filhos = new Map<string, T[]>()
  for (const p of arvore) {
    if (!p.parent_id) continue
    filhos.set(p.parent_id, [...(filhos.get(p.parent_id) ?? []), p])
  }
  for (const l of filhos.values()) l.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
  const saida: { pagina: T; nivel: number; raiz: T }[] = []
  const vistas = new Set<string>()
  const visitar = (p: T, nivel: number, raiz: T) => {
    if (vistas.has(p.id) || nivel > 12) return
    vistas.add(p.id)
    saida.push({ pagina: p, nivel, raiz })
    for (const f of filhos.get(p.id) ?? []) visitar(f, nivel + 1, raiz)
  }
  for (const r of raizes) visitar(r, 0, r)
  return saida
}
