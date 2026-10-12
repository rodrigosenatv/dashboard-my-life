// Conversão de PDF em livro fluido (EPUB), feita inteira no aparelho.
//
// 1. Lê cada página com o pdf.js (texto com posição, fonte e tamanho; imagens; traços).
// 2. Tira o que é do papel: cabeçalhos, rodapés, números de página, sumário com pontilhado.
// 3. Separa tabelas (pela grade desenhada) e figuras (pelas imagens).
// 4. Remonta os parágrafos, junta palavras partidas no fim da linha e acha os títulos.
// 5. Gera o EPUB com sumário e marcas das páginas originais (para mostrar "pág. 12 do PDF").
import type { PDFDocumentProxy } from "pdfjs-dist"
import { extrairPagina, type ApiPdf } from "./extrair"
import { limpar } from "./limpar"
import { extrairFiguras, extrairTabelas, type Objeto } from "./objetos"
import { marcarTitulos, medir, montarBlocos, textoDoBloco } from "./blocos"
import { gerarEpub } from "./epub"
import { coletarNomes, coletarPalavras, coletarPares, contarPalavras, separarPalavrasColadas } from "./texto"
import type { Caixa, ImagemExtraida, ItemSumario, LivroConvertido, PaginaBruta, Progresso, RenderizarRegiao } from "./tipos"

export type { LivroConvertido, Progresso, RenderizarRegiao, ImagemExtraida, Caixa }
export type { ApiPdf }

export class PdfSemTexto extends Error {
  constructor() {
    super("Este PDF é feito de imagens das páginas (digitalizado), sem texto para reorganizar.")
    this.name = "PdfSemTexto"
  }
}

export type OpcoesConversao = {
  pdf: PDFDocumentProxy
  api: ApiPdf
  titulo?: string
  autor?: string
  origem?: string
  identificador?: string
  renderizar?: RenderizarRegiao
  aoProgresso?: (p: Progresso) => void
  sinal?: AbortSignal
}

type ItemOutline = { title: string; dest: string | unknown[] | null; items?: ItemOutline[] }

async function lerSumario(pdf: PDFDocumentProxy, paginas: PaginaBruta[]): Promise<ItemSumario[]> {
  const raiz = (await pdf.getOutline().catch(() => null)) as ItemOutline[] | null
  if (!raiz?.length) return []
  const itens: ItemSumario[] = []
  const visitar = async (lista: ItemOutline[], nivel: number) => {
    for (const item of lista) {
      if (itens.length > 3000) return
      try {
        let dest = item.dest
        if (typeof dest === "string") dest = (await pdf.getDestination(dest)) as unknown[] | null
        if (Array.isArray(dest) && dest[0] != null) {
          const ref = dest[0]
          const indice =
            typeof ref === "number" ? ref : typeof ref === "object" ? await pdf.getPageIndex(ref as Parameters<PDFDocumentProxy["getPageIndex"]>[0]) : -1
          const pagina = paginas[indice]
          if (pagina) {
            const tipo = (dest[1] as { name?: string } | undefined)?.name
            const topo = tipo === "XYZ" && typeof dest[3] === "number" ? pagina.altura - (dest[3] as number) : 0
            itens.push({ titulo: item.title ?? "", nivel, pagina: indice + 1, y: topo })
          }
        }
      } catch {
        // destino quebrado: ignora o item
      }
      if (item.items?.length) await visitar(item.items, nivel + 1)
    }
  }
  await visitar(raiz, 0)
  return itens
}

/** Português, inglês ou espanhol, pelas palavras mais comuns. */
function detectarIdioma(amostra: string): string {
  const t = ` ${amostra.toLowerCase()} `
  const conta = (palavras: string[]) => palavras.reduce((n, p) => n + (t.split(` ${p} `).length - 1), 0)
  const pt = conta(["não", "que", "uma", "para", "com", "são", "também", "você", "isso", "mais"])
  const en = conta(["the", "and", "of", "to", "is", "that", "with", "for", "this", "you"])
  const es = conta(["el", "los", "las", "una", "por", "con", "pero", "también", "usted", "más"])
  if (en > pt * 1.5 && en > es) return "en"
  if (es > pt * 1.5 && es > en) return "es"
  return "pt-BR"
}

const area = (c: Caixa) => Math.max(0, c.x1 - c.x0) * Math.max(0, c.y1 - c.y0)

export async function converterPdf(o: OpcoesConversao): Promise<LivroConvertido> {
  const { pdf } = o
  const total = pdf.numPages
  const paginas: PaginaBruta[] = []
  for (let i = 1; i <= total; i++) {
    o.sinal?.throwIfAborted()
    paginas.push(await extrairPagina(pdf, i, o.api))
    o.aoProgresso?.({ etapa: "lendo", atual: i, total })
  }

  const semTexto = paginas.filter((p) => p.linhas.length === 0).length
  if (semTexto > total * 0.5) throw new PdfSemTexto()

  o.aoProgresso?.({ etapa: "montando", atual: 0, total: 1 })
  const sumario = await lerSumario(pdf, paginas)
  const meta = (await pdf.getMetadata().catch(() => null)) as { info?: { Title?: string; Author?: string } } | null

  // Capa: a primeira página, quando tem imagens ocupando boa parte dela e pouco texto
  let capa: ImagemExtraida | null = null
  const p1 = paginas[0]
  if (o.renderizar && p1 && p1.imagens.length) {
    const juntas = p1.imagens.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }))
    const ocupa = area(juntas) / (p1.largura * p1.altura)
    if ((ocupa >= 0.2 && p1.linhas.length <= 15) || p1.linhas.length === 0) {
      capa = await o.renderizar(1, { x0: 0, y0: 0, x1: p1.largura, y1: p1.altura }, 900).catch(() => null)
      if (capa) {
        p1.linhas = []
        p1.imagens = []
        p1.regras = []
      }
    }
  }

  const limpeza = limpar(paginas)

  let seq = 0
  const objetos: Objeto[] = []
  for (const p of paginas) {
    if (p.regras.length <= 1500) objetos.push(...extrairTabelas(p))
    objetos.push(...extrairFiguras(p, () => `figura-${++seq}`))
  }

  const medidas = medir(paginas, objetos)
  const textos = paginas.flatMap((p) => p.linhas.map((l) => l.texto))
  const blocos = montarBlocos(paginas, objetos, medidas, { palavras: coletarPalavras(textos), pares: coletarPares(textos), nomes: coletarNomes(textos) })
  marcarTitulos(blocos, sumario, medidas, total)

  // Palavras que o PDF deixou coladas (letras espaçadas sem espaço entre as palavras) são separadas
  // com as palavras que o próprio livro usa
  const frequencias = contarPalavras(textos)
  for (const b of blocos) {
    if (b.tipo === "paragrafo" || b.tipo === "titulo") for (const i of b.inlines) if ("texto" in i) i.texto = separarPalavrasColadas(i.texto, frequencias)
    if (b.tipo === "tabela") b.linhas = b.linhas.map((linha) => linha.map((c) => separarPalavrasColadas(c, frequencias)))
  }

  const primeiroTitulo = blocos.find((b) => b.tipo === "titulo")
  const titulo = (
    o.titulo ||
    meta?.info?.Title ||
    (primeiroTitulo ? textoDoBloco(primeiroTitulo).slice(0, 120) : "") ||
    o.origem?.replace(/\.pdf$/i, "") ||
    "Livro"
  ).trim()
  const autor = (o.autor || meta?.info?.Author || "").trim()

  const imagens = new Map<string, ImagemExtraida>()
  const figuras = objetos.filter((x) => x.tipo === "imagem")
  if (o.renderizar) {
    for (const [k, f] of figuras.entries()) {
      o.sinal?.throwIfAborted()
      // Largura proporcional ao tamanho na página, com resolução boa para tela de celular
      const larguraAlvo = Math.round(Math.min(1400, Math.max(480, ((f.caixa.x1 - f.caixa.x0) / (paginas[f.pagina - 1]?.largura || 600)) * 1400)))
      const img = await o.renderizar(f.pagina, f.caixa, larguraAlvo).catch(() => null)
      if (img) imagens.set(f.id, { ...img, id: f.id })
      o.aoProgresso?.({ etapa: "imagens", atual: k + 1, total: figuras.length })
    }
  }

  o.aoProgresso?.({ etapa: "empacotando", atual: 0, total: 1 })
  const amostra = paginas
    .slice(0, 30)
    .flatMap((p) => p.linhas.map((l) => l.texto))
    .join(" ")
    .slice(0, 20_000)
  const {
    epub,
    capitulos,
    sumario: titulos,
  } = gerarEpub({
    blocos,
    titulo,
    autor,
    idioma: detectarIdioma(amostra),
    identificador: o.identificador ?? `urn:uuid:${crypto.randomUUID()}`,
    imagens,
    capa,
    origem: o.origem,
  })

  const palavrasTotal = blocos.reduce((n, b) => {
    if (b.tipo !== "paragrafo" && b.tipo !== "titulo") return n
    return n + b.inlines.reduce((m, i) => m + ("texto" in i ? i.texto.split(/\s+/).filter(Boolean).length : 0), 0)
  }, 0)

  return {
    epub,
    titulo,
    autor,
    capa,
    sumario: titulos,
    resumo: {
      paginas: total,
      paginasSemTexto: semTexto,
      capitulos,
      imagens: imagens.size,
      tabelas: objetos.filter((x) => x.tipo === "tabela").length,
      palavras: palavrasTotal,
      digitalizado: semTexto > 0 && semTexto > total * 0.2,
      removidas: limpeza.cabecalhos + limpeza.numeros + limpeza.sumario + limpeza.partes,
    },
  }
}
