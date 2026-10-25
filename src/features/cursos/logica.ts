/*
 * As regras dos cursos, sem React (testadas em tests/cursos.test.cjs): ler as anotações do curso (módulos,
 * aulas e as ações para praticar), mexer nelas sem estragar o resto do texto, a plataforma do link, a capa
 * gerada e os resumos da tela.
 *
 * As anotações são o texto da página do curso (como veio do Notion ou escrito no app). O modelo do Notion
 * do usuário tem "Links", "Materiais & Arquivos", "Modelagem (Passo a Passo)" com caixas de seleção e
 * "Conteúdo", com um título por módulo e um subtítulo por aula ("## #F02 01 - Mentalidade do foda-se").
 * Nada disso é obrigatório: sem títulos, as linhas só em negrito fazem as vezes de aula, e qualquer caixa
 * "- [ ]" do texto conta como ação para praticar.
 */

import type { Tables } from "@/lib/supabase/database.types"

export type Curso = Tables<"courses">
export type StatusCurso = "em_andamento" | "nao_comecou" | "pausado" | "concluido"

export const STATUS: Record<StatusCurso, { rotulo: string; fileira: string }> = {
  em_andamento: { rotulo: "Em andamento", fileira: "Estudando agora" },
  pausado: { rotulo: "Pausado", fileira: "Pausados" },
  nao_comecou: { rotulo: "Não começou", fileira: "Na fila" },
  concluido: { rotulo: "Concluído", fileira: "Concluídos" },
}
export const ORDEM_STATUS: StatusCurso[] = ["em_andamento", "pausado", "nao_comecou", "concluido"]

export function statusDo(c: Pick<Curso, "status">): StatusCurso {
  return (c.status in STATUS ? c.status : "nao_comecou") as StatusCurso
}

/* ------------------------------------------------------------------ */
/* Texto                                                               */
/* ------------------------------------------------------------------ */

/** Sem acento e em minúsculas (para buscar e comparar). */
export function semAcento(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/** Uma linha curta sem a marcação de markdown (negrito, código, links) e sem emoji nas pontas. */
export function textoLimpo(t: string): string {
  return t
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/\*([^*\s][^*]*)\*/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^[\s\p{Extended_Pictographic}️‍>]+/gu, "")
    .replace(/[\s\p{Extended_Pictographic}️‍:]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

const chave = (t: string) => semAcento(textoLimpo(t))

/** As seções do modelo de curso (não são aulas e terminam a aula de antes). */
const SECOES = /^(links?|materia(l|is)|arquivos|modelagem|passo a passo|conteudos?|aulas|modulos|para praticar|pratica)\b/
const PRATICA = /modelagem|passo a passo|para praticar|^pratica\b|plano de acao/
const CONTEUDO = /^(conteudos?|aulas|modulos)\b/

const TITULO = /^(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/
const ROTULO = /^[ \t]*(?:>[ \t]*)?(?:\*\*|__)(.+?)(?:\*\*|__)[ \t]*:?[ \t]*$/
const TAREFA = /^([ \t]*)([-*+])[ \t]+\[([ xX])\][ \t]+(.*)$/
const CERCA = /^[ \t]*(```|~~~)/

type Linha =
  | { tipo: "titulo"; nivel: number; texto: string }
  | { tipo: "rotulo"; texto: string }
  | { tipo: "tarefa"; feito: boolean; texto: string }
  | { tipo: "outra" }

/** As linhas do texto (o mesmo corte usado em todas as funções que mexem nele). */
export function dividir(texto: string | null | undefined): string[] {
  return (texto ?? "").replace(/\r\n?/g, "\n").split("\n")
}

function classificar(linhas: string[]): Linha[] {
  let emCodigo = false
  return linhas.map((l) => {
    if (CERCA.test(l)) {
      emCodigo = !emCodigo
      return { tipo: "outra" }
    }
    if (emCodigo) return { tipo: "outra" }
    const t = TITULO.exec(l)
    if (t && t[2].trim()) return { tipo: "titulo", nivel: t[1].length, texto: t[2].trim() }
    const tarefa = TAREFA.exec(l)
    if (tarefa) return { tipo: "tarefa", feito: tarefa[3] !== " ", texto: tarefa[4].trim() }
    const r = ROTULO.exec(l)
    if (r && r[1].trim()) return { tipo: "rotulo", texto: r[1].trim() }
    return { tipo: "outra" }
  })
}

/* ------------------------------------------------------------------ */
/* O mapa do curso: módulos, aulas e ações                             */
/* ------------------------------------------------------------------ */

/** Nível das aulas escritas como linha em negrito (sem título de markdown). */
export const NIVEL_NEGRITO = 7

export type Aula = {
  /** Linha do título da aula. */
  linha: number
  /** Linha logo depois da aula (exclusiva). */
  fim: number
  nivel: number
  /** O título como está no texto (sem os #). */
  titulo: string
  modulo: string | null
  /** O texto da aula, sem o título. */
  corpo: string
}
export type Modulo = { linha: number; fim: number; nivel: number; titulo: string; aulas: number }
export type Pratica = { linha: number; feito: boolean; texto: string }
export type MapaCurso = {
  aulas: Aula[]
  modulos: Modulo[]
  praticas: Pratica[]
  /** Nível dos títulos das aulas (7 = linhas em negrito); null sem aulas. */
  nivelAula: number | null
  nivelModulo: number | null
  /** Primeira linha do conteúdo (depois do rótulo "Conteúdo"; 0 sem ele). */
  inicioConteudo: number
  /** O rótulo "Modelagem (Passo a Passo)" (ou "Para praticar") e onde o bloco termina. */
  blocoPratica: { linha: number; fim: number } | null
}

/** O título parece de aula: numerado ("01 - ", "Aula 3", "#F02 01 - ") ou começa com "Aula". */
export function pareceAula(titulo: string): boolean {
  return partesDoTitulo(titulo).numero !== null || /^aula\b/.test(chave(titulo))
}

export function analisarCurso(texto: string | null | undefined): MapaCurso {
  const linhas = dividir(texto)
  const info = classificar(linhas)
  const secao = (l: Linha) => (l.tipo === "titulo" || l.tipo === "rotulo") && SECOES.test(chave(l.texto))

  let inicioConteudo = 0
  for (let i = 0; i < info.length; i++) {
    const l = info[i]
    if ((l.tipo === "titulo" || l.tipo === "rotulo") && CONTEUDO.test(chave(l.texto))) {
      inicioConteudo = i + 1
      break
    }
  }

  // Os títulos do conteúdo são módulos e aulas; sem nenhum, as linhas só em negrito
  type Candidato = { i: number; nivel: number; texto: string }
  const candidatos: Candidato[] = []
  for (let i = inicioConteudo; i < info.length; i++) {
    const l = info[i]
    if (l.tipo === "titulo" && !secao(l)) candidatos.push({ i, nivel: l.nivel, texto: l.texto })
  }
  if (!candidatos.length) {
    for (let i = inicioConteudo; i < info.length; i++) {
      const l = info[i]
      if (l.tipo === "rotulo" && !secao(l)) candidatos.push({ i, nivel: NIVEL_NEGRITO, texto: l.texto })
    }
  }

  const niveis = [...new Set(candidatos.map((c) => c.nivel))].sort((a, b) => a - b)
  let nivelModulo: number | null = null
  let nivelAula: number | null = niveis[0] ?? null
  if (niveis.length >= 2) {
    const [a, b] = niveis
    const altos = candidatos.filter((c) => c.nivel === a)
    const baixos = candidatos.filter((c) => c.nivel === b)
    const numerados = (lista: Candidato[]) => lista.filter((c) => pareceAula(c.texto)).length / lista.length
    // Os títulos de cima são módulos quando há bem mais títulos embaixo e não são eles as aulas numeradas
    const saoModulos = baixos.length >= altos.length * 1.5 && !(numerados(altos) > 0.6 && numerados(baixos) < 0.4)
    if (saoModulos) {
      nivelModulo = a
      nivelAula = b
    }
  }

  // Onde cada aula termina: no próximo título do mesmo nível ou acima, numa seção do modelo ou no fim
  const corte = (i: number, nivel: number) => {
    for (let j = i + 1; j < info.length; j++) {
      const l = info[j]
      if (secao(l)) return j
      if (l.tipo === "titulo" && l.nivel <= nivel) return j
      if (nivel === NIVEL_NEGRITO && l.tipo === "rotulo") return j
    }
    return info.length
  }

  const modulos: Modulo[] = []
  const aulas: Aula[] = []
  let moduloAtual: string | null = null
  for (const c of candidatos) {
    if (nivelModulo !== null && c.nivel === nivelModulo) {
      moduloAtual = c.texto
      modulos.push({ linha: c.i, fim: corte(c.i, c.nivel), nivel: c.nivel, titulo: c.texto, aulas: 0 })
      continue
    }
    if (c.nivel !== nivelAula) continue
    const fim = corte(c.i, c.nivel)
    const dono = modulos.length && modulos[modulos.length - 1].fim > c.i ? moduloAtual : null
    if (dono) modulos[modulos.length - 1].aulas++
    aulas.push({ linha: c.i, fim, nivel: c.nivel, titulo: c.texto, modulo: dono, corpo: linhas.slice(c.i + 1, fim).join("\n").trim() })
  }

  const praticas: Pratica[] = []
  info.forEach((l, i) => {
    if (l.tipo === "tarefa" && l.texto) praticas.push({ linha: i, feito: l.feito, texto: l.texto })
  })

  let blocoPratica: MapaCurso["blocoPratica"] = null
  for (let i = 0; i < info.length; i++) {
    const l = info[i]
    if ((l.tipo === "titulo" || l.tipo === "rotulo") && PRATICA.test(chave(l.texto))) {
      let fim = info.length
      for (let j = i + 1; j < info.length; j++) {
        const o = info[j]
        if (o.tipo === "titulo" || o.tipo === "rotulo") {
          fim = j
          break
        }
      }
      blocoPratica = { linha: i, fim }
      break
    }
  }

  return { aulas, modulos, praticas, nivelAula, nivelModulo, inicioConteudo, blocoPratica }
}

const mapas = new Map<string, MapaCurso>()
/** O mapa das anotações, guardado (a tela pede o mesmo texto muitas vezes). */
export function mapaDe(texto: string | null | undefined): MapaCurso {
  const k = texto ?? ""
  let m = mapas.get(k)
  if (!m) {
    m = analisarCurso(k)
    mapas.set(k, m)
    if (mapas.size > 300) {
      const velho = mapas.keys().next().value
      if (velho !== undefined) mapas.delete(velho)
    }
  }
  return m
}

/** A última aula anotada: onde a pessoa parou. */
export function ondeParei(mapa: MapaCurso): Aula | null {
  return mapa.aulas.length ? mapa.aulas[mapa.aulas.length - 1] : null
}

/** "#F02 01 - Mentalidade do foda-se" → marcador "#F02", número "01" e o nome. */
export function partesDoTitulo(titulo: string): { tag: string | null; numero: string | null; nome: string } {
  let t = textoLimpo(titulo)
  let tag: string | null = null
  const mt = /^(#[\p{L}\d_-]+)\s+(.+)$/u.exec(t)
  if (mt) {
    tag = mt[1]
    t = mt[2]
  }
  let numero: string | null = null
  const mn = /^(?:aula\s*)?(\d{1,3})\s*[-–—.:)]\s*(.+)$/i.exec(t)
  if (mn) {
    numero = mn[1]
    t = mn[2]
  } else {
    const so = /^aula\s*(\d{1,3})$/i.exec(t)
    if (so) numero = so[1]
  }
  return { tag, numero, nome: t.trim() || textoLimpo(titulo) || titulo.trim() }
}

/** O título sugerido para a próxima aula, seguindo a numeração da última ("#F09 08 - "). */
export function proximoTitulo(mapa: MapaCurso): string {
  const ultima = ondeParei(mapa)
  if (!ultima) return ""
  const limpo = textoLimpo(ultima.titulo)
  const p = partesDoTitulo(ultima.titulo)
  if (p.numero === null) return ""
  const n = String(Number(p.numero) + 1).padStart(p.numero.length, "0")
  let tag = ""
  const mt = p.tag ? /^#([\p{L}_-]*)(\d+)$/u.exec(p.tag) : null
  if (mt) tag = `#${mt[1]}${String(Number(mt[2]) + 1).padStart(mt[2].length, "0")} `
  const comAula = /^(#\S+\s+)?aula\s*\d/i.test(limpo)
  return `${tag}${comAula ? "Aula " : ""}${n} - `
}

/* ------------------------------------------------------------------ */
/* Mexer nas anotações                                                 */
/* ------------------------------------------------------------------ */

const umaLinha = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim()

/** Põe um bloco de linhas em `pos`, com uma linha em branco antes e depois (sem acumular brancos). */
function inserirBloco(linhas: string[], pos: number, bloco: string[]): string[] {
  let a = Math.min(pos, linhas.length)
  while (a > 0 && !linhas[a - 1].trim()) a--
  let b = Math.min(pos, linhas.length)
  while (b < linhas.length && !linhas[b].trim()) b++
  const antes = linhas.slice(0, a)
  const depois = linhas.slice(b)
  return [...antes, ...(antes.length ? [""] : []), ...bloco, ...(depois.length ? [""] : []), ...depois]
}

function juntar(linhas: string[]): string {
  return linhas.join("\n").replace(/^\n+/, "").replace(/\n+$/, "") + "\n"
}

/** Marca ou desmarca a ação da linha `linha` (o texto volta igual se a linha não for mais uma ação). */
export function marcarPratica(texto: string, linha: number, feito: boolean): string {
  const linhas = dividir(texto)
  const m = TAREFA.exec(linhas[linha] ?? "")
  if (!m) return texto
  linhas[linha] = `${m[1]}${m[2]} [${feito ? "x" : " "}] ${m[4]}`
  return linhas.join("\n")
}

/** Tira a ação da linha `linha`. */
export function removerPratica(texto: string, linha: number): string {
  const linhas = dividir(texto)
  if (!TAREFA.test(linhas[linha] ?? "")) return texto
  linhas.splice(linha, 1)
  return linhas.join("\n")
}

/**
 * Acrescenta ações para praticar: no fim do bloco "Modelagem (Passo a Passo)" (ou "Para praticar"); sem
 * ele, cria "### Para praticar" no começo do texto (antes das aulas).
 */
export function adicionarPraticas(texto: string, itens: string[]): string {
  const novos = itens.map(umaLinha).filter(Boolean).map((t) => `- [ ] ${t}`)
  if (!novos.length) return texto
  const linhas = dividir(texto)
  const mapa = analisarCurso(texto)
  const bloco = mapa.blocoPratica
  if (bloco) {
    const doBloco = mapa.praticas.filter((p) => p.linha > bloco.linha && p.linha < bloco.fim)
    if (doBloco.length) {
      const pos = doBloco[doBloco.length - 1].linha + 1
      linhas.splice(pos, 0, ...novos)
      return linhas.join("\n")
    }
    return juntar(inserirBloco(linhas, bloco.linha + 1, novos))
  }
  if (!texto.trim()) return juntar(["### Para praticar", "", ...novos])
  return juntar(inserirBloco(linhas, 0, ["### Para praticar", "", ...novos]))
}

export type DadosAula = { titulo: string; corpo?: string | null }

function cabecalhoDaAula(titulo: string, nivel: number): string {
  return nivel >= NIVEL_NEGRITO ? `**${titulo}**` : `${"#".repeat(nivel)} ${titulo}`
}

function blocoDaAula(titulo: string, nivel: number, corpo: string | null | undefined): string[] {
  const texto = (corpo ?? "").replace(/\r\n?/g, "\n").trim()
  return [cabecalhoDaAula(titulo, nivel), ...(texto ? ["", ...texto.split("\n")] : [])]
}

/**
 * Anota uma aula nova: no fim do módulo escolhido, num módulo novo ou depois da última aula. Segue o
 * nível dos títulos que o texto já usa (## por padrão).
 */
export function adicionarAula(texto: string, nova: DadosAula & { modulo?: string | null; novoModulo?: string | null }): string {
  const titulo = umaLinha(nova.titulo)
  if (!titulo) return texto
  const linhas = dividir(texto)
  const mapa = analisarCurso(texto)
  const nivelAula = mapa.nivelAula ?? (mapa.nivelModulo !== null ? mapa.nivelModulo + 1 : 2)
  const aula = blocoDaAula(titulo, nivelAula, nova.corpo)
  const novoModulo = umaLinha(nova.novoModulo)

  const fimDasAulas = () => {
    const fins = [...mapa.aulas.map((a) => a.fim), ...mapa.modulos.map((m) => m.fim)]
    return fins.length ? Math.max(...fins) : linhas.length
  }

  if (novoModulo && nivelAula > 1 && nivelAula < NIVEL_NEGRITO) {
    const nivelModulo = mapa.nivelModulo ?? nivelAula - 1
    return juntar(inserirBloco(linhas, fimDasAulas(), [`${"#".repeat(nivelModulo)} ${novoModulo}`, "", ...aula]))
  }
  const modulo = nova.modulo ? mapa.modulos.find((m) => m.titulo === nova.modulo) : null
  if (modulo) return juntar(inserirBloco(linhas, modulo.fim, aula))
  if (mapa.aulas.length) return juntar(inserirBloco(linhas, mapa.aulas[mapa.aulas.length - 1].fim, aula))
  return juntar(inserirBloco(linhas, linhas.length, aula))
}

/** A aula no texto de agora: na mesma linha com o mesmo título ou, se o texto mudou, pelo título. */
export function localizarAula(mapa: MapaCurso, aula: Pick<Aula, "linha" | "titulo">): Aula | null {
  return mapa.aulas.find((a) => a.linha === aula.linha && a.titulo === aula.titulo) ?? mapa.aulas.find((a) => a.titulo === aula.titulo) ?? null
}

/** Troca o título e o texto de uma aula (o nível do título continua o mesmo). */
export function editarAula(texto: string, aula: Pick<Aula, "linha" | "titulo">, dados: DadosAula): string {
  const titulo = umaLinha(dados.titulo)
  const atual = localizarAula(analisarCurso(texto), aula)
  if (!atual || !titulo) return texto
  const linhas = dividir(texto)
  const sem = [...linhas.slice(0, atual.linha), ...linhas.slice(atual.fim)]
  return juntar(inserirBloco(sem, atual.linha, blocoDaAula(titulo, atual.nivel, dados.corpo)))
}

/** Tira uma aula (o título e o texto dela). */
export function removerAula(texto: string, aula: Pick<Aula, "linha" | "titulo">): string {
  const atual = localizarAula(analisarCurso(texto), aula)
  if (!atual) return texto
  const linhas = dividir(texto)
  const antes = linhas.slice(0, atual.linha)
  const depois = linhas.slice(atual.fim)
  while (antes.length && !antes[antes.length - 1].trim()) antes.pop()
  while (depois.length && !depois[0].trim()) depois.shift()
  return juntar([...antes, ...(antes.length && depois.length ? [""] : []), ...depois])
}

/* ------------------------------------------------------------------ */
/* Link, plataforma e capa                                             */
/* ------------------------------------------------------------------ */

/** O endereço do curso: o primeiro link do campo ("Link:https://…" vira o link; "www.x.com" ganha https). */
export function linkDoCurso(u: string | null | undefined): string | null {
  const t = (u ?? "").trim()
  if (!t) return null
  const m = /https?:\/\/[^\s<>"'()]+/i.exec(t)
  if (m) return m[0]
  if (/^(www\.)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(t)) return `https://${t}`
  return null
}

/** `em`: o lugar com a preposição certa ("no Telegram", "na Hotmart"); null quando não se sabe o nome. */
export type Plataforma = { id: string; nome: string; em: string | null; acao: string }

const PLATAFORMAS: { id: string; nome: string; artigo: "no" | "na"; hosts: RegExp }[] = [
  { id: "telegram", nome: "Telegram", artigo: "no", hosts: /(^|\.)(t\.me|telegram\.me|telegram\.org)$/ },
  { id: "hotmart", nome: "Hotmart", artigo: "na", hosts: /(^|\.)hotmart\.com$/ },
  { id: "kiwify", nome: "Kiwify", artigo: "na", hosts: /(^|\.)kiwify\.com(\.br)?$/ },
  { id: "eduzz", nome: "Eduzz", artigo: "na", hosts: /(^|\.)(eduzz\.com|nutror\.com)$/ },
  { id: "youtube", nome: "YouTube", artigo: "no", hosts: /(^|\.)(youtube\.com|youtu\.be)$/ },
  { id: "drive", nome: "Google Drive", artigo: "no", hosts: /^(drive|docs)\.google\.com$/ },
  { id: "terabox", nome: "TeraBox", artigo: "no", hosts: /(^|\.)(terabox|1024terabox|teraboxapp)\.com$/ },
  { id: "udemy", nome: "Udemy", artigo: "na", hosts: /(^|\.)udemy\.com$/ },
  { id: "alura", nome: "Alura", artigo: "na", hosts: /(^|\.)alura\.com\.br$/ },
  { id: "coursera", nome: "Coursera", artigo: "no", hosts: /(^|\.)coursera\.org$/ },
  { id: "domestika", nome: "Domestika", artigo: "na", hosts: /(^|\.)domestika\.org$/ },
  { id: "notion", nome: "Notion", artigo: "no", hosts: /(^|\.)(notion\.so|notion\.site)$/ },
]

/** Onde o curso fica, pelo link (Telegram, Hotmart, Google Drive…). */
export function plataformaDoLink(u: string | null | undefined): Plataforma | null {
  const link = linkDoCurso(u)
  if (!link) return null
  let host = ""
  try {
    host = new URL(link).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
  const p = PLATAFORMAS.find((x) => x.hosts.test(host))
  if (p) return { id: p.id, nome: p.nome, em: `${p.artigo} ${p.nome}`, acao: `Abrir ${p.artigo} ${p.nome}` }
  // Link curto (bit.ly, abre.ai) não diz onde o curso fica
  if (/^(bit\.ly|abre\.ai|encurtador\.com\.br|tinyurl\.com|cutt\.ly)$/.test(host)) return { id: "link", nome: "Link", em: null, acao: "Abrir o curso" }
  return { id: "site", nome: host, em: null, acao: "Abrir o curso" }
}

function hash(t: string): number {
  let h = 2166136261
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Os tons da capa gerada: a família de cor vem da categoria (cursos da mesma área combinam). */
export function tonsDoCurso(c: Pick<Curso, "name" | "categories">): { h1: number; h2: number } {
  const base = c.categories[0] ? semAcento(c.categories[0]) : semAcento(c.name)
  // Do azul ao magenta, a faixa de cor do holograma
  const h1 = 200 + (hash(base) % 120)
  const h2 = 180 + (hash(semAcento(c.name)) % 160)
  return { h1, h2 }
}

const MIUDAS = new Set(["a", "o", "as", "os", "ao", "aos", "de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos", "um", "uma", "para", "pra", "por", "pela", "pelo", "com", "sem", "sua", "seu", "que", "como", "mais", "the", "of"])

/** As iniciais da capa gerada ("Venda Todo Santo Dia" → "VT"; "A ordem" → "O"). */
export function iniciais(nome: string): string {
  const palavras = textoLimpo(nome)
    .split(/[\s\-–—:,.|/()]+/)
    .filter((p) => /^\p{L}/u.test(p) && !MIUDAS.has(semAcento(p)))
  const letras = palavras
    .slice(0, 2)
    .map((p) => [...p].find((ch) => /[\p{L}\d]/u.test(ch)) ?? "")
    .join("")
  return (letras || [...nome.trim()][0] || "?").toUpperCase()
}

/* ------------------------------------------------------------------ */
/* A tela                                                              */
/* ------------------------------------------------------------------ */

/** Progresso para mostrar: o informado ou 100 nos concluídos; null quando não se sabe. */
export function progressoDo(c: Pick<Curso, "progress" | "status">): number | null {
  if (typeof c.progress === "number" && Number.isFinite(c.progress)) return Math.max(0, Math.min(100, Math.round(c.progress)))
  return statusDo(c) === "concluido" ? 100 : null
}

/** Os campos que mudam com a situação (concluir marca 100%). */
export function camposDoStatus(c: Pick<Curso, "progress">, status: StatusCurso): { status: StatusCurso; progress?: number | null } {
  if (status === "concluido") return { status, progress: 100 }
  return { status }
}

const maisRecente = (a: Pick<Curso, "updated_at">, b: Pick<Curso, "updated_at">) => b.updated_at.localeCompare(a.updated_at)

/** Os cursos de cada situação, na ordem da tela (os mexidos por último primeiro; a fila pelos mais novos). */
export function porStatus<C extends Pick<Curso, "status" | "updated_at" | "created_at">>(cursos: C[]): Record<StatusCurso, C[]> {
  const grupos: Record<StatusCurso, C[]> = { em_andamento: [], pausado: [], nao_comecou: [], concluido: [] }
  for (const c of cursos) grupos[statusDo(c)].push(c)
  grupos.em_andamento.sort(maisRecente)
  grupos.pausado.sort(maisRecente)
  grupos.concluido.sort(maisRecente)
  grupos.nao_comecou.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return grupos
}

/** Busca por nome, categoria ou anotação (todas as palavras, sem acento). */
export function buscarCursos<C extends Pick<Curso, "name" | "categories" | "notes">>(cursos: C[], busca: string): C[] {
  const termos = semAcento(busca).split(/\s+/).filter(Boolean)
  if (!termos.length) return cursos
  return cursos.filter((c) => {
    const alvo = semAcento([c.name, ...c.categories, c.notes ?? ""].join(" "))
    return termos.every((t) => alvo.includes(t))
  })
}

/** As categorias, das que têm mais cursos para as que têm menos. */
export function categoriasDos(cursos: Pick<Curso, "categories">[]): { nome: string; total: number }[] {
  const contagem = new Map<string, number>()
  for (const c of cursos) for (const k of new Set(c.categories.map((x) => x.trim()).filter(Boolean))) contagem.set(k, (contagem.get(k) ?? 0) + 1)
  return [...contagem.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"))
}

/** As competências: categorias dos cursos concluídos (e quantos estão em andamento nelas). */
export function competencias(cursos: Pick<Curso, "categories" | "status">[]): { nome: string; concluidos: number; estudando: number }[] {
  const mapa = new Map<string, { concluidos: number; estudando: number }>()
  for (const c of cursos) {
    const s = statusDo(c)
    if (s !== "concluido" && s !== "em_andamento") continue
    for (const k of new Set(c.categories.map((x) => x.trim()).filter(Boolean))) {
      const v = mapa.get(k) ?? { concluidos: 0, estudando: 0 }
      if (s === "concluido") v.concluidos++
      else v.estudando++
      mapa.set(k, v)
    }
  }
  return [...mapa.entries()]
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.concluidos - a.concluidos || b.estudando - a.estudando || a.nome.localeCompare(b.nome, "pt-BR"))
}

/** As ações por fazer dos cursos em andamento (os mexidos por último primeiro). */
export function praticasPendentes<C extends Pick<Curso, "status" | "updated_at" | "notes">>(cursos: C[]): { curso: C; pratica: Pratica }[] {
  return cursos
    .filter((c) => statusDo(c) === "em_andamento")
    .sort(maisRecente)
    .flatMap((curso) =>
      mapaDe(curso.notes)
        .praticas.filter((p) => !p.feito)
        .map((pratica) => ({ curso, pratica })),
    )
}

export function plural(n: number, um: string, varios?: string): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? um : (varios ?? `${um}s`)}`
}
