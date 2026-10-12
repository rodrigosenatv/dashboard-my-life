// Leitura de uma página do PDF com o pdf.js: linhas de texto, imagens e traços finos.
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"
import type { Caixa, Linha, PaginaBruta, Trecho } from "./tipos"
import { continuaUrl, juntarLetrasEspacadas, normalizarMarcador } from "./texto"

/** O que o conversor usa do módulo do pdf.js (assim funciona com a versão do navegador e a do Node). */
export type ApiPdf = {
  OPS: Record<string, number>
  Util: { transform(m1: number[], m2: number[]): number[] }
}

type Matriz = [number, number, number, number, number, number]
type Estilo = { negrito: boolean; italico: boolean }

type Item = {
  texto: string
  x: number
  y: number
  largura: number
  tamanho: number
  negrito: boolean
  italico: boolean
  espacoAntes: boolean
}

type LinhaEmMontagem = {
  itens: Item[]
  base: number
  tamanho: number
  x1: number
}

function multiplicar(m: number[], n: number[]): Matriz {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

function aplicar(m: number[], x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

function caixaTransformada(m: number[], x0: number, y0: number, x1: number, y1: number): Caixa {
  const pontos = [aplicar(m, x0, y0), aplicar(m, x1, y0), aplicar(m, x0, y1), aplicar(m, x1, y1)]
  const xs = pontos.map((p) => p[0])
  const ys = pontos.map((p) => p[1])
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

function estiloDaFonte(page: PDFPageProxy, nome: string, cache: Map<string, Estilo>): Estilo {
  const pronto = cache.get(nome)
  if (pronto) return pronto
  let estilo: Estilo = { negrito: false, italico: false }
  try {
    const f = page.commonObjs.get(nome) as { name?: string; bold?: boolean; black?: boolean; italic?: boolean } | null
    const n = (f?.name ?? "").replace(/^[A-Z]{6}\+/, "")
    estilo = {
      negrito: Boolean(f?.bold || f?.black) || /bold|black|heavy|semibold|demi|negrito|[-,_]bd\b/i.test(n),
      italico: Boolean(f?.italic) || /italic|oblique|[-,_]it\b|boldit\b|[-,_]i$/i.test(n),
    }
  } catch {
    // fonte ainda não carregada: segue como texto comum
  }
  cache.set(nome, estilo)
  return estilo
}

function fecharLinha(l: LinhaEmMontagem, pagina: number, ordem: number): Linha | null {
  // Tamanho dominante, ponderado pelo número de letras
  const peso = new Map<number, number>()
  let letras = 0
  let negrito = 0
  let italico = 0
  for (const it of l.itens) {
    const n = it.texto.replace(/\s/g, "").length
    letras += n
    peso.set(Math.round(it.tamanho * 2) / 2, (peso.get(Math.round(it.tamanho * 2) / 2) ?? 0) + n)
    if (it.negrito) negrito += n
    if (it.italico) italico += n
  }
  if (!letras) return null
  let tamanho = l.tamanho
  let maior = -1
  for (const [t, p] of peso) if (p > maior) [tamanho, maior] = [t, p]

  const trechos: Trecho[] = []
  const pedacos: Linha["pedacos"] = []
  let x1 = -Infinity
  let anterior: Item | null = null
  for (const it of l.itens) {
    const sobrescrito = it.tamanho < tamanho * 0.82 && it.y < l.base - tamanho * 0.12
    let texto = it.texto
    let espaco = false
    if (anterior) {
      const lacuna = it.x - (anterior.x + anterior.largura)
      // Endereço da internet partido em dois pedaços ("www.site.co" "m.br") volta a ficar junto
      const precisaEspaco = (it.espacoAntes || lacuna > Math.min(it.tamanho, anterior.tamanho) * 0.16) && !continuaUrl(anterior.texto, texto)
      if (precisaEspaco && !/\s$/.test(anterior.texto) && !/^\s/.test(texto)) {
        texto = " " + texto
        espaco = true
      }
    }
    pedacos.push({ x0: it.x, x1: it.x + it.largura, texto: it.texto, espaco })
    const ultimo = trechos.at(-1)
    if (ultimo && ultimo.negrito === it.negrito && ultimo.italico === it.italico && Boolean(ultimo.sobrescrito) === sobrescrito) {
      ultimo.texto += texto
    } else {
      trechos.push({ texto, negrito: it.negrito, italico: it.italico, ...(sobrescrito ? { sobrescrito } : {}) })
    }
    x1 = Math.max(x1, it.x + it.largura)
    anterior = it
  }
  for (const t of trechos) t.texto = t.texto.replace(/\s+/g, " ")
  trechos[0].texto = normalizarMarcador(trechos[0].texto.replace(/^\s+/, ""))
  const fim = trechos.at(-1)!
  fim.texto = fim.texto.replace(/\s+$/, "")
  const limpos = trechos.filter((t) => t.texto.length > 0)
  if (!limpos.length) return null
  return {
    pagina,
    ordem,
    x0: l.itens[0].x,
    x1,
    y: l.base,
    tamanho,
    // Linha "em negrito" só quando ela inteira está em negrito (uma palavra destacada não conta)
    negrito: negrito / letras >= 0.95,
    italico: italico / letras >= 0.95,
    trechos: limpos,
    texto: limpos.map((t) => t.texto).join(""),
    pedacos,
  }
}

/** Marcador ou numeração sozinhos ("•", "I -", "a)") costumam ter um espaço grande até o texto do item. */
const SO_MARCADOR = /^(?:[•●○◦▪■□◆◇►▸‣⁃∙·*✓✔➢➤→❖➔\uF000-\uF0FF-]|\(?\d{1,3}[.)]|\(?[a-zA-Z][.)]|[IVXLC]{1,6}\s*[-–—.)]|§\s*\d+º?)$/

/** Lê uma página: agrupa os pedaços de texto em linhas, na ordem em que o PDF os desenha. */
export async function extrairPagina(pdf: PDFDocumentProxy, numero: number, api: ApiPdf): Promise<PaginaBruta> {
  const page = await pdf.getPage(numero)
  const vp = page.getViewport({ scale: 1 })
  const vpt = vp.transform as number[]
  // A lista de operações carrega as fontes (para saber o que é negrito) e mostra imagens e traços.
  const ops = await page.getOperatorList()
  const conteudo = await page.getTextContent()

  const O = api.OPS
  const imagens: Caixa[] = []
  const regras: Caixa[] = []
  let ctm: number[] = [1, 0, 0, 1, 0, 0]
  const pilha: number[][] = []
  const paraTela = (c: Caixa): Caixa => caixaTransformada(vpt, c.x0, c.y0, c.x1, c.y1)
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    const args = ops.argsArray[i] as unknown[]
    if (fn === O.save) pilha.push(ctm)
    else if (fn === O.restore) ctm = pilha.pop() ?? ctm
    else if (fn === O.transform) ctm = multiplicar(ctm, args as number[])
    else if (fn === O.paintFormXObjectBegin) {
      pilha.push(ctm)
      const m = args?.[0] as number[] | null
      if (m && m.length === 6) ctm = multiplicar(ctm, m)
    } else if (fn === O.paintFormXObjectEnd) ctm = pilha.pop() ?? ctm
    else if (fn === O.paintImageXObject || fn === O.paintInlineImageXObject || fn === O.paintImageMaskXObject || fn === O.paintImageXObjectRepeat) {
      const c = paraTela(caixaTransformada(ctm, 0, 0, 1, 1))
      if (c.x1 - c.x0 >= 12 || c.y1 - c.y0 >= 12) imagens.push(c)
    } else if (fn === O.constructPath) {
      const [pintura, , mm] = args as [number, unknown, ArrayLike<number> | null]
      if (pintura === O.endPath || !mm || mm.length < 4) continue
      const c = paraTela(caixaTransformada(ctm, mm[0], mm[1], mm[2], mm[3]))
      const w = c.x1 - c.x0
      const h = c.y1 - c.y0
      if (Math.min(w, h) <= 2.5 && Math.max(w, h) >= 4) regras.push(c)
    }
  }

  const fontes = new Map<string, Estilo>()
  const itens: Item[] = []
  let espacoPendente = false
  for (const bruto of conteudo.items) {
    if (!("str" in bruto)) continue
    const texto = juntarLetrasEspacadas(bruto.str)
    if (!texto) continue
    if (!texto.trim()) {
      espacoPendente = true
      continue
    }
    const m = api.Util.transform(vpt, bruto.transform as number[])
    const tamanho = Math.hypot(m[2], m[3])
    // Só texto na horizontal; texto girado costuma ser marca d'água ou legenda de figura
    if (tamanho < 2 || m[0] <= 0 || Math.abs(m[1]) > 0.2 * Math.abs(m[0]) || Math.abs(m[2]) > 0.2 * Math.abs(m[3])) {
      espacoPendente = false
      continue
    }
    const x = m[4]
    const y = m[5]
    if (x > vp.width + 5 || y < -5 || y > vp.height + 5) continue
    const estilo = estiloDaFonte(page, bruto.fontName, fontes)
    itens.push({ texto, x, y, largura: Math.max(0, bruto.width), tamanho, negrito: estilo.negrito, italico: estilo.italico, espacoAntes: espacoPendente })
    espacoPendente = false
  }

  const linhas: Linha[] = []
  let atual: LinhaEmMontagem | null = null
  const fechar = () => {
    if (!atual) return
    const l = fecharLinha(atual, numero, linhas.length)
    if (l) linhas.push(l)
    atual = null
  }
  for (const it of itens) {
    if (atual) {
      const a: LinhaEmMontagem = atual
      const maior = Math.max(it.tamanho, a.tamanho)
      const mesmaBase = Math.abs(it.y - a.base) <= 0.5 * maior
      const lacuna = it.x - a.x1
      const limite = a.itens.length === 1 && SO_MARCADOR.test(a.itens[0].texto.trim()) ? 10 : 2.2
      if (mesmaBase && lacuna > -0.6 * maior && lacuna < limite * maior) {
        const ultimo = a.itens.at(-1)!
        // Texto desenhado duas vezes (negrito "falso" ou sombra): ignora a cópia
        if (ultimo.texto === it.texto && Math.abs(ultimo.x - it.x) < 1.5 && Math.abs(ultimo.y - it.y) < 1.5) continue
        a.itens.push(it)
        a.x1 = Math.max(a.x1, it.x + it.largura)
        continue
      }
      fechar()
    }
    atual = { itens: [it], base: it.y, tamanho: it.tamanho, x1: it.x + it.largura }
  }
  fechar()
  ordenarSeEmbaralhado(linhas)

  page.cleanup()
  return { numero, largura: vp.width, altura: vp.height, linhas, imagens, regras }
}

/**
 * Quase todo PDF desenha o texto na ordem de leitura, e essa ordem é preservada (inclusive em colunas).
 * Alguns geradores desenham fora de ordem; quando a linha seguinte volta para cima vezes demais,
 * a página é reordenada de cima para baixo.
 */
function ordenarSeEmbaralhado(linhas: Linha[]) {
  if (linhas.length < 8) return
  let voltas = 0
  for (let i = 1; i < linhas.length; i++) {
    const a = linhas[i - 1]
    const b = linhas[i]
    const mesmaColuna = b.x0 < a.x1 && a.x0 < b.x1
    if (mesmaColuna && b.y < a.y - a.tamanho * 1.5) voltas++
  }
  if (voltas < linhas.length * 0.3) return
  linhas.sort((a, b) => (Math.abs(a.y - b.y) <= Math.min(a.tamanho, b.tamanho) * 0.4 ? a.x0 - b.x0 : a.y - b.y))
  linhas.forEach((l, i) => (l.ordem = i))
}
