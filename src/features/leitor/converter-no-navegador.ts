"use client"

// Liga o conversor ao pdf.js do navegador. O pdf.js lê o PDF num worker (outra linha de execução),
// então a tela continua respondendo; figuras e capa são desenhadas num canvas e viram JPEG.
import type { PDFDocumentProxy } from "pdfjs-dist"
import type { ImagemExtraida, LivroConvertido, Progresso, RenderizarRegiao } from "./conversor"

/** Sobe quando o conversor mudar de um jeito que valha converter de novo os livros antigos. */
export const VERSAO_CONVERSOR = 1

const BASE = "/pdfjs/"

/** Limite de pixels por imagem: telas de celular não ganham nada acima disso e a memória agradece. */
const MAX_PIXELS = 2_400_000

function criarRenderizador(pdf: PDFDocumentProxy): RenderizarRegiao {
  return async (numero, caixa, larguraAlvo) => {
    const page = await pdf.getPage(numero)
    const largura = Math.max(1, caixa.x1 - caixa.x0)
    const altura = Math.max(1, caixa.y1 - caixa.y0)
    let escala = Math.min(4, larguraAlvo / largura)
    if (largura * altura * escala * escala > MAX_PIXELS) escala = Math.sqrt(MAX_PIXELS / (largura * altura))
    const w = Math.max(1, Math.round(largura * escala))
    const h = Math.max(1, Math.round(altura * escala))
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, w, h)
    const viewport = page.getViewport({ scale: escala, offsetX: -caixa.x0 * escala, offsetY: -caixa.y0 * escala })
    try {
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85))
      if (!blob) return null
      const imagem: ImagemExtraida = { id: "", dados: new Uint8Array(await blob.arrayBuffer()), tipo: "image/jpeg", largura: w, altura: h }
      return imagem
    } finally {
      page.cleanup()
      // O Safari do iPhone segura a memória do canvas até ele ser zerado
      canvas.width = 0
      canvas.height = 0
    }
  }
}

export type ResultadoConversao = LivroConvertido & { versao: number }

export async function converterPdfNoNavegador(
  arquivo: File,
  opcoes: { titulo?: string; autor?: string; identificador?: string; aoProgresso?: (p: Progresso) => void; sinal?: AbortSignal },
): Promise<ResultadoConversao> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  pdfjs.GlobalWorkerOptions.workerSrc = `${BASE}pdf.worker.min.mjs`
  const dados = new Uint8Array(await arquivo.arrayBuffer())
  const tarefa = pdfjs.getDocument({
    data: dados,
    fontExtraProperties: true,
    cMapUrl: `${BASE}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${BASE}standard_fonts/`,
    wasmUrl: `${BASE}wasm/`,
    iccUrl: `${BASE}iccs/`,
  })
  const pdf = await tarefa.promise
  try {
    const { converterPdf } = await import("./conversor")
    const r = await converterPdf({
      pdf,
      api: pdfjs,
      titulo: opcoes.titulo,
      autor: opcoes.autor,
      identificador: opcoes.identificador,
      origem: arquivo.name,
      renderizar: criarRenderizador(pdf),
      aoProgresso: opcoes.aoProgresso,
      sinal: opcoes.sinal,
    })
    return { ...r, versao: VERSAO_CONVERSOR }
  } finally {
    await tarefa.destroy()
  }
}
