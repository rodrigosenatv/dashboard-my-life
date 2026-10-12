// Remonta parágrafos, títulos, listas, tabelas e figuras a partir das linhas de todas as páginas.
import type { Bloco, Caixa, Inline, ItemSumario, Linha, Marca, PaginaBruta, Trecho } from "./tipos"
import { ehMarca } from "./tipos"
import type { Objeto } from "./objetos"
import {
  comecaComNome,
  comecaItem,
  comecaNota,
  comecaTravessao,
  continuaNome,
  juntarLinhas,
  moda,
  pareceCampo,
  pareceTituloPorPadrao,
  percentil,
  terminaFrase,
  terminaPontuacao,
} from "./texto"

/**
 * O que o próprio livro ensina sobre as palavras: as que aparecem inteiras, os pares que andam juntos
 * e as que ele escreve com maiúscula no meio da frase.
 */
export type Vocabulario = { palavras: Set<string>; pares: Set<string>; nomes: Set<string> }

export type Medidas = {
  /** Tamanho da letra do corpo do texto. */
  corpo: number
  /** Distância comum entre linhas do corpo. */
  passo: number
  margem: Map<number, number>
  direita: Map<number, number>
  /** Figuras de cada página, para o texto que as contorna. */
  figuras: Map<number, Caixa[]>
}

type Paragrafo = Extract<Bloco, { tipo: "paragrafo" }>

const ehCorpo = (l: Linha, corpo: number) => Math.abs(l.tamanho - corpo) <= Math.max(1, corpo * 0.1)

export function medir(paginas: PaginaBruta[], objetos: Objeto[] = []): Medidas {
  const todas = paginas.flatMap((p) => p.linhas)
  const corpo = moda(todas.map((l) => [l.tamanho, l.texto.length] as [number, number])) || 11
  const deltas: [number, number][] = []
  for (const p of paginas)
    for (let i = 1; i < p.linhas.length; i++) {
      const a = p.linhas[i - 1]
      const b = p.linhas[i]
      if (!ehCorpo(a, corpo) || !ehCorpo(b, corpo)) continue
      const d = b.y - a.y
      if (d > corpo * 0.8 && d < corpo * 3.5) deltas.push([d, 1])
    }
  const passo = deltas.length ? moda(deltas) : corpo * 1.25

  // Margens por página; páginas com pouco texto usam a das páginas de mesma paridade
  const margem = new Map<number, number>()
  const direita = new Map<number, number>()
  const porParidade: Record<0 | 1, { esq: [number, number][]; dir: number[] }> = { 0: { esq: [], dir: [] }, 1: { esq: [], dir: [] } }
  const locais = new Map<number, { esq: [number, number][]; dir: number[] }>()
  for (const p of paginas) {
    const esq: [number, number][] = []
    const dir: number[] = []
    for (const l of p.linhas) {
      if (!ehCorpo(l, corpo) || l.texto.length < 20) continue
      esq.push([l.x0, 1])
      if (!terminaPontuacao(l.texto)) dir.push(l.x1)
    }
    locais.set(p.numero, { esq, dir })
    const par = (p.numero % 2) as 0 | 1
    porParidade[par].esq.push(...esq)
    porParidade[par].dir.push(...dir)
  }
  const geral = { esq: [...porParidade[0].esq, ...porParidade[1].esq], dir: [...porParidade[0].dir, ...porParidade[1].dir] }
  for (const p of paginas) {
    const local = locais.get(p.numero)!
    const par = porParidade[(p.numero % 2) as 0 | 1]
    const esq = local.esq.length >= 4 ? local.esq : par.esq.length >= 4 ? par.esq : geral.esq
    const dir = local.dir.length >= 4 ? local.dir : par.dir.length >= 4 ? par.dir : geral.dir
    const m = esq.length ? moda(esq, 1) : 0
    margem.set(p.numero, m)
    direita.set(p.numero, dir.length ? percentil(dir, 0.5) : p.largura - m)
  }
  const figuras = new Map<number, Caixa[]>()
  for (const o of objetos) if (o.tipo === "imagem") figuras.set(o.pagina, [...(figuras.get(o.pagina) ?? []), o.caixa])
  return { corpo, passo, margem, direita, figuras }
}

/** Margens da linha; com uma figura ao lado, o texto contorna a figura e a margem passa a ser a borda dela. */
function limites(l: Linha, m: Medidas): { esquerda: number; direita: number } {
  let esquerda = m.margem.get(l.pagina) ?? 0
  let direita = m.direita.get(l.pagina) ?? l.x1
  for (const f of m.figuras.get(l.pagina) ?? []) {
    if (l.y < f.y0 - 2 || l.y - l.tamanho > f.y1 + 2) continue
    if (f.x0 > l.x1 - 2) direita = Math.min(direita, f.x0 - 6)
    else if (f.x1 < l.x0 + 2) esquerda = Math.max(esquerda, f.x1 + 6)
  }
  return { esquerda, direita }
}

function centralizada(l: Linha, m: Medidas): boolean {
  if (comecaItem(l.texto)) return false
  const { esquerda, direita } = limites(l, m)
  const esq = l.x0 - esquerda
  const dir = direita - l.x1
  const largura = direita - esquerda
  if (l.x1 - l.x0 > largura * 0.75) return false
  return esq > l.tamanho * 2 && dir > l.tamanho * 2 && Math.abs(esq - dir) < Math.max(l.tamanho * 1.5, largura * 0.05)
}

const COMECA_MAIUSCULA = /^[\s"“'‘(«]*[A-ZÀ-Ý0-9]/
/** Palavras que não terminam frase: linha curta acabando nelas continua na seguinte. */
const FIM_QUE_CONTINUA = new RegExp(
  "(?:[,;–—-]|(?:^|[^A-Za-zÀ-ÖØ-öø-ÿ])(?:" +
    [
      "de",
      "da",
      "do",
      "das",
      "dos",
      "e",
      "ou",
      "a",
      "o",
      "as",
      "os",
      "em",
      "no",
      "na",
      "nos",
      "nas",
      "num",
      "numa",
      "com",
      "sem",
      "por",
      "pelo",
      "pela",
      "pelos",
      "pelas",
      "para",
      "pra",
      "que",
      "um",
      "uma",
      "uns",
      "umas",
      "ao",
      "aos",
      "à",
      "às",
      "se",
      "sobre",
      "entre",
      "até",
      "contra",
      "como",
      "mas",
      "pois",
      "porque",
      "quando",
      "onde",
      "seu",
      "sua",
      "seus",
      "suas",
      "meu",
      "minha",
      "este",
      "esta",
      "esse",
      "essa",
      "isso",
      "isto",
      "aquele",
      "aquela",
      "nosso",
      "nossa",
      "cada",
      "muito",
      "muita",
      "mais",
      "menos",
      "tão",
      "não",
      "já",
      "também",
      "ainda",
      "lhe",
      "me",
      "te",
      "é",
      "são",
      "foi",
      "ser",
      "ter",
      "há",
      "the",
      "of",
      "and",
      "to",
      "in",
    ].join("|") +
    "))\\s*$",
  "i",
)

/** Fala com nome: "Hélio: – Boa noite". */
const FALANTE = /^[A-ZÀ-Ý][A-Za-zÀ-ÿ]{1,24}:\s*[–—-]/

/** Decide se a linha `l` começa um bloco novo depois da linha `p` (`f` é a primeira linha do bloco atual). */
function quebra(p: Linha, l: Linha, f: Linha, bloco: Paragrafo, m: Medidas, v: Vocabulario): boolean {
  const tl = l.texto
  const tp = p.texto
  if (Boolean(l.parte) !== Boolean(p.parte)) return true
  if (comecaItem(tl) || FALANTE.test(tl)) return true
  // Lista de "Rótulo: valor" (créditos, ficha técnica): cada linha é um item
  if (pareceCampo(tl) && pareceCampo(tp)) return true
  // Travessão no começo da linha: fala de diálogo, a não ser que a frase anterior não tenha terminado
  if (comecaTravessao(tl) && (terminaPontuacao(tp) || /["”»]\s*$/.test(tp))) return true
  if (Math.abs(l.tamanho - p.tamanho) > Math.max(1, m.corpo * 0.08)) return true

  const limP = limites(p, m)
  const margemP = limP.esquerda
  const margemL = limites(l, m).esquerda
  const larguraP = limP.direita - margemP
  const curtaP = p.x1 < margemP + larguraP * 0.85
  const fimPont = terminaPontuacao(tp)

  const cp = centralizada(p, m)
  const cl = centralizada(l, m)
  if (cp && cl && l.negrito === p.negrito && !fimPont && l.pagina === p.pagina && l.y - p.y <= m.passo * 1.5) return false
  if (cp || cl) return true
  if (l.negrito !== p.negrito && (curtaP || fimPont || COMECA_MAIUSCULA.test(tl))) return true

  if (l.pagina === p.pagina && l.y > p.y && !l.semVao) {
    const delta = l.y - p.y
    if (delta > m.passo * 1.4 + 0.5 && delta > p.tamanho * 1.15) return true
  }

  // Recuo de primeira linha
  const recuo = l.x0 - margemL
  if (recuo > l.tamanho * 0.8 && recuo < l.tamanho * 8) {
    const continuaItem = bloco.item && l.x0 > f.x0 + l.tamanho * 0.3
    const mesmoRecuo = Math.abs(p.x0 - l.x0) < l.tamanho * 0.5
    if (!continuaItem && !mesmoRecuo && l.x0 > p.x0) return true
  }

  if (curtaP && terminaFrase(tp)) return true
  if (curtaP && /:\s*$/.test(tp)) return true
  // Linha bem curta sem pontuação, seguida de maiúscula: título ou fim de parágrafo sem ponto.
  // Não vale quando as duas palavras formam um nome que o livro usa junto ("Mecânica" + "Quântica")
  // ou quando a linha começa com uma palavra que o livro escreve com maiúscula no meio da frase.
  const muitoCurtaP = p.x1 < margemP + larguraP * 0.6
  if (
    muitoCurtaP &&
    !fimPont &&
    COMECA_MAIUSCULA.test(tl) &&
    !FIM_QUE_CONTINUA.test(tp) &&
    !continuaNome(tp, tl, v.pares) &&
    !comecaComNome(tl, v.nomes)
  )
    return true
  return false
}

/**
 * Linha curta e sozinha entre duas frases ("Negócios", "Relacionamentos Afetivos"): é um subtítulo sem
 * destaque de fonte. Sem esta regra, ela grudaria no fim do parágrafo anterior.
 */
function tituloSolto(p: Linha, l: Linha, n: Linha | null, m: Medidas, v: Vocabulario): boolean {
  const t = l.texto.trim()
  if (!n || t.length < 3 || t.length > 60 || t.split(/\s+/).length > 7) return false
  if (comecaItem(t) || terminaPontuacao(t) || !/^[A-ZÀ-Ý]/.test(t) || /[,–—-]$/.test(t) || FIM_QUE_CONTINUA.test(t)) return false
  // Outra letra ou negrito já separam pelas outras regras (e título em destaque pode ocupar várias linhas)
  if (Math.abs(l.tamanho - p.tamanho) > 1 || l.negrito || p.negrito || l.tamanho > m.corpo * 1.1 + 0.5) return false
  const lim = limites(l, m)
  if (l.x1 > lim.esquerda + (lim.direita - lim.esquerda) * 0.6) return false
  // A linha anterior fecha uma frase (ou termina curta, sem pedir continuação)
  const limP = limites(p, m)
  const curtaP = p.x1 < limP.esquerda + (limP.direita - limP.esquerda) * 0.85
  const fechou =
    terminaFrase(p.texto) ||
    /:\s*$/.test(p.texto) ||
    /(?:https?:\/\/|www\.)\S+$/i.test(p.texto.trim()) ||
    (curtaP && !FIM_QUE_CONTINUA.test(p.texto) && !continuaNome(p.texto, t, v.pares))
  if (!fechou) return false
  // E a seguinte começa outra frase
  return (COMECA_MAIUSCULA.test(n.texto) || comecaTravessao(n.texto)) && !continuaNome(t, n.texto, v.pares)
}

function copiarTrechos(l: Linha): Trecho[] {
  return l.trechos.map((t) => ({ ...t }))
}

function ultimoTrecho(inlines: Inline[]): Trecho | null {
  for (let i = inlines.length - 1; i >= 0; i--) {
    const x = inlines[i]
    if (!ehMarca(x)) return x
  }
  return null
}

function acrescentar(bloco: Paragrafo, l: Linha, marcas: Marca[], palavras: Set<string>) {
  const fim = ultimoTrecho(bloco.inlines)
  const novos = copiarTrechos(l)
  if (fim) {
    const { texto, separador } = juntarLinhas(fim.texto, novos[0].texto, palavras)
    fim.texto = texto
    novos[0].texto = separador + novos[0].texto.replace(/^\s+/, "")
  }
  bloco.inlines.push(...marcas)
  for (const t of novos) {
    const anterior = bloco.inlines.at(-1)
    if (
      anterior &&
      !ehMarca(anterior) &&
      anterior.negrito === t.negrito &&
      anterior.italico === t.italico &&
      Boolean(anterior.sobrescrito) === Boolean(t.sobrescrito)
    ) {
      anterior.texto += t.texto
    } else bloco.inlines.push(t)
  }
}

function novoParagrafo(l: Linha, marcas: Marca[], m: Medidas): Paragrafo {
  const margem = m.margem.get(l.pagina) ?? 0
  return {
    tipo: "paragrafo",
    inlines: [...marcas, ...copiarTrechos(l)],
    tamanho: l.tamanho,
    negrito: l.negrito,
    centralizado: centralizada(l, m) || undefined,
    item: comecaItem(l.texto) || undefined,
    nota: l.tamanho < m.corpo - 1.5 || undefined,
    recuado: (!comecaItem(l.texto) && l.x0 - margem > l.tamanho * 8) || undefined,
    parte: l.parte || undefined,
    pagina: l.pagina,
    linhas: 1,
  }
}

/** Notas de rodapé: as últimas linhas da página, em letra menor, a partir de uma que começa com a chamada ("1 …"). */
function notasDoRodape(p: PaginaBruta, m: Medidas): Set<Linha> {
  let i = p.linhas.length
  while (i > 0) {
    const l = p.linhas[i - 1]
    if (l.tamanho >= m.corpo - 1.5 || l.y < p.altura * 0.55) break
    i--
  }
  while (i < p.linhas.length && !comecaNota(p.linhas[i].texto)) i++
  return new Set(p.linhas.slice(i))
}

type Evento = { linha: Linha } | { objeto: Objeto }

/** Junta linhas e objetos (tabelas e figuras) de uma página na ordem de leitura. */
function eventosDaPagina(p: PaginaBruta, objetos: Objeto[]): Evento[] {
  const eventos: Evento[] = []
  const fila = [...objetos].sort((a, b) => a.caixa.y0 - b.caixa.y0)
  for (const linha of p.linhas) {
    while (fila.length && fila[0].caixa.y0 < linha.y - linha.tamanho) eventos.push({ objeto: fila.shift()! })
    eventos.push({ linha })
  }
  for (const objeto of fila) eventos.push({ objeto })
  return eventos
}

function blocoDoObjeto(o: Objeto, marcas: Marca[]): Bloco {
  if (o.tipo === "tabela") return { tipo: "tabela", linhas: o.linhas, pagina: o.pagina, marcas }
  return { tipo: "imagem", id: o.id, largura: o.caixa.x1 - o.caixa.x0, altura: o.caixa.y1 - o.caixa.y0, pagina: o.pagina, marcas, descricao: "" }
}

type EventoDoLivro = { pagina: number } | { linha: Linha; nota?: boolean } | { objeto: Objeto }

export function montarBlocos(paginas: PaginaBruta[], objetos: Objeto[], m: Medidas, v: Vocabulario): Bloco[] {
  const blocos: Bloco[] = []
  let atual: Paragrafo | null = null
  let primeira: Linha | null = null
  let ultima: Linha | null = null
  let marcas: Marca[] = []
  // Figura ao lado de um parágrafo (texto contornando a imagem) entra depois do parágrafo, não no meio dele
  let adiados: Objeto[] = []
  // Nota de rodapé no meio de um parágrafo que continua na página seguinte também entra depois dele
  let notasAdiadas: Linha[] = []
  let depoisDeSolto = false

  const emitirNotas = () => {
    let nota: Paragrafo | null = null
    for (const l of notasAdiadas) {
      if (nota && !comecaNota(l.texto)) {
        acrescentar(nota, l, [], v.palavras)
        nota.linhas++
        continue
      }
      if (nota) blocos.push(nota)
      nota = { ...novoParagrafo(l, [], m), nota: true, centralizado: undefined, recuado: undefined }
    }
    if (nota) blocos.push(nota)
    notasAdiadas = []
  }

  const fechar = () => {
    if (atual) blocos.push(atual)
    for (const o of adiados) blocos.push(blocoDoObjeto(o, []))
    adiados = []
    if (notasAdiadas.length) emitirNotas()
    atual = null
    primeira = null
    ultima = null
  }

  const porPagina = new Map<number, Objeto[]>()
  for (const o of objetos) porPagina.set(o.pagina, [...(porPagina.get(o.pagina) ?? []), o])

  // O livro inteiro numa sequência só, para olhar a linha seguinte (mesmo que esteja na outra página)
  const eventos: EventoDoLivro[] = []
  for (const p of paginas) {
    eventos.push({ pagina: p.numero })
    const notas = notasDoRodape(p, m)
    for (const ev of eventosDaPagina(p, porPagina.get(p.numero) ?? [])) eventos.push("linha" in ev && notas.has(ev.linha) ? { ...ev, nota: true } : ev)
  }
  const linhaSeguinte = (i: number): Linha | null => {
    for (let j = i + 1; j < eventos.length; j++) {
      const e = eventos[j]
      if ("objeto" in e) return null
      if ("linha" in e && !e.nota) return e.linha
    }
    return null
  }

  eventos.forEach((ev, i) => {
    if ("pagina" in ev) {
      marcas.push({ pagina: ev.pagina })
      return
    }
    if ("objeto" in ev) {
      if (atual) adiados.push(ev.objeto)
      else {
        blocos.push(blocoDoObjeto(ev.objeto, marcas))
        marcas = []
      }
      return
    }
    const l = ev.linha
    const bloco = atual as Paragrafo | null
    if (ev.nota && bloco && ultima && !bloco.nota && !terminaPontuacao((ultima as Linha).texto)) {
      notasAdiadas.push(l)
      return
    }
    // Subtítulo solto ("Negócios"): começa um bloco próprio, e a linha depois dele também
    const solto = Boolean(bloco && ultima && tituloSolto(ultima, l, linhaSeguinte(i), m, v))
    if (bloco && ultima && primeira && !solto && !depoisDeSolto && !quebra(ultima, l, primeira, bloco, m, v)) {
      acrescentar(bloco, l, marcas, v.palavras)
      bloco.linhas++
      bloco.negrito = bloco.negrito && l.negrito
    } else {
      fechar()
      atual = novoParagrafo(l, marcas, m)
      primeira = l
    }
    depoisDeSolto = solto
    marcas = []
    ultima = l
  })
  fechar()
  if (marcas.length) blocos.push({ tipo: "marcas", marcas, pagina: marcas[0].pagina })
  return blocos
}

/* ------------------------------------------------------------------ */
/* Títulos                                                             */
/* ------------------------------------------------------------------ */

export function textoDoBloco(b: Bloco): string {
  if (b.tipo !== "paragrafo" && b.tipo !== "titulo") return ""
  return b.inlines.map((i) => (ehMarca(i) ? "" : i.texto)).join("")
}

function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function viraTitulo(b: Paragrafo, nivel: 1 | 2 | 3): Bloco {
  const inlines = b.inlines.map((i) => (ehMarca(i) ? i : { ...i, negrito: false }))
  return { tipo: "titulo", nivel, inlines, pagina: b.pagina }
}

/** Nível pelo sumário do PDF; se o sumário for plano, pela numeração ("1." capítulo, "1.1" seção). */
function niveisDoSumario(itens: ItemSumario[]): number[] {
  const plano = itens.every((i) => i.nivel === 0)
  if (!plano) return itens.map((i) => Math.min(3, i.nivel + 1))
  const numerado = (t: string) => /^\d+[.)]?\s/.test(t.trim())
  const numerados = itens.filter((i) => numerado(i.titulo)).length
  if (numerados < 2) return itens.map(() => 1)
  const primeiro = itens.findIndex((i) => numerado(i.titulo))
  return itens.map((i, k) => {
    const t = i.titulo.trim()
    if (/^\d+\.\d+/.test(t)) return 2
    if (numerado(t)) return 1
    // Apresentação, prefácio etc. antes do primeiro capítulo numerado ficam no nível de capítulo
    return k < primeiro ? 1 : 2
  })
}

/** Marca os títulos usando o sumário do PDF (marcadores) quando existe. Devolve quantos achou. */
function titulosDoSumario(blocos: Bloco[], itens: ItemSumario[]): number {
  if (!itens.length) return 0
  const niveis = niveisDoSumario(itens)
  const usados = new Set<number>()
  let achados = 0
  let inicio = 0
  itens.forEach((item, k) => {
    const alvo = normalizar(item.titulo)
    if (alvo.length < 2) return
    for (let i = inicio; i < blocos.length; i++) {
      const b = blocos[i]
      if (b.pagina > item.pagina + 1) break
      if (b.tipo !== "paragrafo" || b.pagina < item.pagina || usados.has(i) || b.linhas > 4) continue
      let texto = normalizar(textoDoBloco(b))
      let fim = i
      // Título quebrado em dois blocos
      if (alvo.startsWith(texto) && texto.length < alvo.length) {
        const prox = blocos[i + 1]
        if (prox?.tipo === "paragrafo") {
          const junto = normalizar(`${textoDoBloco(b)} ${textoDoBloco(prox)}`)
          if (junto === alvo || junto.startsWith(alvo)) {
            texto = junto
            fim = i + 1
          }
        }
      }
      // Espaço sobrando ou faltando no texto do PDF ("DOSJOGOS") não impede de reconhecer o título,
      // nem a numeração que o texto tem e o marcador não ("1.1 Introdução" × "Introdução")
      const compacto = (s: string) => s.replace(/ /g, "")
      const semNumero = texto.replace(/^(?:\d+ )+/, "")
      const igual =
        texto === alvo ||
        compacto(texto) === compacto(alvo) ||
        (semNumero !== texto && semNumero === alvo) ||
        (texto.startsWith(alvo) && texto.length - alvo.length < 12) ||
        (alvo.startsWith(texto) && texto.length >= Math.min(14, alvo.length))
      if (!igual) continue
      if (fim > i) {
        const prox = blocos[fim] as Paragrafo
        b.inlines.push({ texto: " ", negrito: false, italico: false }, ...prox.inlines)
        b.linhas += prox.linhas
        blocos.splice(fim, 1)
      }
      blocos[i] = viraTitulo(b, niveis[k] as 1 | 2 | 3)
      usados.add(i)
      achados++
      inicio = i + 1
      break
    }
  })
  return achados
}

/** Sem sumário no PDF: títulos pela aparência (letra maior, negrito sozinho na linha) ou pelo padrão ("Capítulo 2"). */
function titulosPorAparencia(blocos: Bloco[], m: Medidas, paginas: number) {
  type Candidato = { i: number; tamanho: number; negrito: boolean; padrao: boolean; maior: boolean; pagina: number }
  const limiteMaior = m.corpo * 1.15 + 0.5
  const candidatos: Candidato[] = []
  blocos.forEach((b, i) => {
    if (b.tipo !== "paragrafo" || b.item || b.nota || b.parte || b.linhas > 3) return
    const t = textoDoBloco(b).trim()
    if (t.length < 2 || t.length > 140 || /[.,;:]$/.test(t)) return
    const maior = b.tamanho >= limiteMaior
    const negrito = b.negrito && ((b.linhas === 1 && t.length <= 90) || (b.linhas === 2 && t.length <= 70))
    const padrao = pareceTituloPorPadrao(t) && t.length <= 100 && b.linhas <= 2
    if (maior || negrito || padrao) candidatos.push({ i, tamanho: Math.round(b.tamanho * 2) / 2, negrito: b.negrito, padrao, maior, pagina: b.pagina })
  })
  // Letra maior que aparece uma vez só no meio do livro é destaque, não nível de título
  // (na primeira página costuma ser o título do documento, e esse vale)
  const porTamanho = new Map<number, Candidato[]>()
  for (const c of candidatos) if (c.maior) porTamanho.set(c.tamanho, [...(porTamanho.get(c.tamanho) ?? []), c])
  const tamanhos = [...porTamanho]
    .filter(([, cs]) => cs.length >= 2 || cs[0].pagina <= 2 || candidatos.length < 3)
    .map(([t]) => t)
    .sort((a, b) => b - a)
  const temPadrao = candidatos.filter((c) => c.padrao).length >= 2
  // Com capítulos no padrão "1ª Aula", "Capítulo 2"..., o negrito antes do primeiro deles é da folha de rosto
  const primeiroPadrao = temPadrao ? candidatos.find((c) => c.padrao)!.i : -1
  // Negrito comum demais (ex.: livro com muitas frases destacadas) não indica título
  const soNegrito = candidatos.filter((c) => !tamanhos.includes(c.tamanho) && !c.padrao)
  const negritoConfiavel = soNegrito.length <= Math.max(6, paginas / 2)
  for (const c of candidatos) {
    const b = blocos[c.i] as Paragrafo
    let nivel: 1 | 2 | 3
    if (c.maior && tamanhos.includes(c.tamanho)) nivel = Math.min(3, tamanhos.indexOf(c.tamanho) + 1) as 1 | 2 | 3
    else if (c.padrao) nivel = Math.min(3, tamanhos.length + 1) as 1 | 2 | 3
    else if (c.negrito && negritoConfiavel && c.i > primeiroPadrao && (b.linhas === 1 || textoDoBloco(b).length <= 70))
      nivel = Math.min(3, tamanhos.length + (temPadrao ? 2 : 1)) as 1 | 2 | 3
    else continue
    blocos[c.i] = viraTitulo(b, nivel)
  }
}

/** Texto curto que se repete logo antes de vários títulos (ex.: nome da parte do livro antes de cada capítulo). */
function tirarRepetidosAntesDeTitulos(blocos: Bloco[]) {
  const contagem = new Map<string, number>()
  blocos.forEach((b, i) => {
    const prox = blocos[i + 1]
    if (b.tipo !== "paragrafo" || prox?.tipo !== "titulo") return
    const t = normalizar(textoDoBloco(b))
    if (t.length > 0 && t.length <= 160) contagem.set(t, (contagem.get(t) ?? 0) + 1)
  })
  for (let i = blocos.length - 2; i >= 0; i--) {
    const b = blocos[i]
    if (b.tipo !== "paragrafo" || blocos[i + 1].tipo !== "titulo") continue
    if ((contagem.get(normalizar(textoDoBloco(b))) ?? 0) < 3) continue
    const marcas = b.inlines.filter(ehMarca)
    const titulo = blocos[i + 1] as Extract<Bloco, { tipo: "titulo" }>
    titulo.inlines.unshift(...marcas)
    blocos.splice(i, 1)
  }
}

/** Seções numeradas em destaque ("2.1. TIPO DE ARMAMENTO…", "3.2 Conceitos") viram títulos no nível da numeração. */
function titulosNumerados(blocos: Bloco[], m: Medidas) {
  blocos.forEach((b, i) => {
    if (b.tipo !== "paragrafo" || b.item || b.nota || b.parte || b.linhas > 2) return
    const t = textoDoBloco(b).trim()
    const numero = /^(\d{1,2}(?:\.\d{1,2})+)\.?\s+[A-ZÀ-Ý]/.exec(t)
    if (!numero || t.length > 140) return
    if (!b.negrito && b.tamanho < m.corpo * 1.15 + 0.5) return
    blocos[i] = viraTitulo(b, Math.min(3, numero[1].split(".").length) as 1 | 2 | 3)
  })
}

const NUMERO_POR_EXTENSO =
  "um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|primeir[ao]|segund[ao]|terceir[ao]|quart[ao]|quint[ao]|sext[ao]|s[ée]tim[ao]|oitav[ao]|non[ao]|d[ée]cim[ao]|one|two|three|four|five|six|seven|eight|nine|ten"
/** Linha que é só o rótulo do capítulo, sem o nome: "Capítulo 1", "CHAPTER IV", "Parte Dois", "3ª Aula". */
const SO_ROTULO = new RegExp(
  `^(?:(?:cap[íi]tulo|chapter|parte|part|livro|book|unidade|m[óo]dulo|aula|li[çc][ãa]o)\\s+(?:\\d{1,3}|[ivxlcdm]{1,7}|${NUMERO_POR_EXTENSO})|\\d{1,3}\\s*[ªºao°]?\\s*(?:aula|parte|li[çc][ãa]o|cap[íi]tulo|unidade|m[óo]dulo))\\.?$`,
  "i",
)

/**
 * "Capítulo 1" numa linha e o nome do capítulo na seguinte viram um título só ("Capítulo 1 – O Começo"),
 * para o sumário não ficar com duas entradas por capítulo.
 */
function juntarRotulosDeCapitulo(blocos: Bloco[]) {
  for (let i = 0; i < blocos.length - 1; i++) {
    const a = blocos[i]
    const b = blocos[i + 1]
    // O rótulo pode ter virado título ou ficado como parágrafo (quando o sumário do PDF só tem os nomes)
    const rotuloOk = (a.tipo === "titulo" && !a.parte) || (a.tipo === "paragrafo" && a.linhas <= 2 && !a.parte && !a.item)
    if (!rotuloOk || b.tipo !== "titulo" || b.parte) continue
    const rotulo = textoDoBloco(a).replace(/\s+/g, " ").trim()
    const nome = textoDoBloco(b).replace(/\s+/g, " ").trim()
    if (!SO_ROTULO.test(rotulo) || SO_ROTULO.test(nome) || /^\d+(?:\.\d+)+/.test(nome) || !nome) continue
    const nivelRotulo = a.tipo === "titulo" ? a.nivel : b.nivel
    const inlinesRotulo = a.tipo === "titulo" || a.tipo === "paragrafo" ? a.inlines.map((x) => (ehMarca(x) ? x : { ...x, negrito: false })) : []
    blocos[i] = {
      ...b,
      nivel: Math.min(nivelRotulo, b.nivel) as 1 | 2 | 3,
      inlines: [...inlinesRotulo, { texto: " – ", negrito: false, italico: false }, ...b.inlines],
      pagina: a.pagina,
    }
    blocos.splice(i + 1, 1)
  }
}

/** Títulos de parte (achados na limpeza) ficam no topo, e os demais títulos descem um nível. */
function titulosDePartes(blocos: Bloco[]) {
  if (!blocos.some((b) => b.tipo === "paragrafo" && b.parte)) return
  blocos.forEach((b, i) => {
    if (b.tipo === "titulo") blocos[i] = { ...b, nivel: Math.min(3, b.nivel + 1) as 1 | 2 | 3 }
    else if (b.tipo === "paragrafo" && b.parte) blocos[i] = { ...viraTitulo(b, 1), parte: true } as Bloco
  })
}

export function marcarTitulos(blocos: Bloco[], sumario: ItemSumario[], m: Medidas, paginas: number) {
  const achados = titulosDoSumario(blocos, sumario)
  if (!(achados >= 2 && achados >= sumario.length * 0.5)) titulosPorAparencia(blocos, m, paginas)
  titulosNumerados(blocos, m)
  juntarRotulosDeCapitulo(blocos)
  tirarRepetidosAntesDeTitulos(blocos)
  titulosDePartes(blocos)
}
