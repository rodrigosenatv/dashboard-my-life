"use client"

// Tipos e cuidados de segurança em volta do foliate-js (o motor que pagina o livro).

export type ItemSumarioLivro = { label: string; href: string; id?: number; subitems?: ItemSumarioLivro[] }

export type Localizacao = {
  fraction: number
  section?: { current: number; total: number }
  location?: { current: number; next: number; total: number }
  time?: { section: number; total: number }
  tocItem?: ItemSumarioLivro | null
  pageItem?: { label: string; href: string } | null
  cfi: string
}

export type ResultadoBusca = { cfi: string; excerpt: { pre: string; match: string; post: string } }

type EventoDados = CustomEvent<{ data: unknown; type: string | Promise<string>; name: string }>
type EventoCarga = CustomEvent<{ type: string; isScript: boolean; allow: boolean | Promise<boolean> }>

export type LivroFoliate = {
  metadata?: { title?: unknown; author?: unknown; language?: string }
  toc?: ItemSumarioLivro[]
  pageList?: { label: string; href: string }[]
  sections: { size?: number; linear?: string }[]
  dir?: string
  transformTarget?: EventTarget
}

export type Paginador = HTMLElement & {
  setStyles?: (estilo: string | [string, string]) => void
  heads?: HTMLElement[]
  feet?: HTMLElement[]
  scrolled?: boolean
  /** Página de agora no capítulo e quantas ele tem (contando uma em branco em cada ponta). */
  page?: number
  pages?: number
  /** No começo ou no fim do livro. */
  atStart?: boolean
  atEnd?: boolean
}

export interface VisaoFoliate extends HTMLElement {
  book: LivroFoliate
  renderer: Paginador
  lastLocation?: Localizacao
  open(livro: File | Blob | string): Promise<void>
  close(): void
  init(o: { lastLocation?: string | null; showTextStart?: boolean }): Promise<void>
  goTo(alvo: string | number): Promise<unknown>
  goToFraction(fracao: number): Promise<void>
  goLeft(): Promise<void>
  goRight(): Promise<void>
  prev(distancia?: number): Promise<void>
  next(distancia?: number): Promise<void>
  getSectionFractions(): number[]
  search(o: {
    query: string
    matchCase?: boolean
    matchDiacritics?: boolean
    matchWholeWords?: boolean
    drawOptions?: { color?: string; width?: number; radius?: number }
  }): AsyncGenerator<{ progress?: number; label?: string; subitems?: ResultadoBusca[] } | ResultadoBusca | "done">
  clearSearch(): void
}

let carregado: Promise<unknown> | null = null

/** Carrega o motor só quando o leitor abre (fica fora do pacote das outras telas). */
export function carregarFoliate() {
  carregado ??= import("@/vendor/foliate-js/view.js")
  return carregado
}

/* ------------------------------------------------------------------ */
/* Segurança: livros podem trazer scripts                              */
/* ------------------------------------------------------------------ */

const CSP =
  "default-src 'none'; img-src blob: data:; media-src blob: data:; font-src blob: data: 'self'; style-src 'unsafe-inline' blob: data:; form-action 'none'"

const PROIBIDOS = "script, iframe, frame, frameset, object, embed, applet, base, portal, meta[http-equiv]"

/**
 * Limpa uma página do livro antes de exibir: tira scripts, atributos de evento e links "javascript:",
 * e acrescenta uma política (CSP) que bloqueia qualquer script que tenha sobrado.
 * O livro roda dentro do app e teria acesso à sessão se um script rodasse.
 */
export function limparPaginaDoLivro(texto: string, tipo: string): { texto: string; tipo: string } {
  let doc = new DOMParser().parseFromString(texto, tipo as DOMParserSupportedType)
  if (tipo === "application/xhtml+xml" && doc.querySelector("parsererror")) {
    doc = new DOMParser().parseFromString(texto, "text/html")
    tipo = "text/html"
  }
  for (const el of Array.from(doc.querySelectorAll(PROIBIDOS))) el.remove()
  for (const el of Array.from(doc.querySelectorAll("*"))) {
    for (const atributo of Array.from(el.attributes)) {
      const nome = atributo.name.toLowerCase()
      const valor = atributo.value.replace(/[\s\u0000-\u001f]/g, "").toLowerCase()
      if (
        nome.startsWith("on") ||
        ((nome.endsWith("href") || nome === "src" || nome === "action" || nome === "formaction") &&
          (valor.startsWith("javascript:") || valor.startsWith("vbscript:")))
      ) {
        el.removeAttributeNode(atributo)
      }
    }
  }
  const raiz = doc.documentElement
  if (tipo !== "image/svg+xml" && raiz) {
    let head: Element | null = doc.querySelector("head")
    if (!head) {
      head = doc.createElementNS(raiz.namespaceURI, "head")
      raiz.insertBefore(head, raiz.firstChild)
    }
    {
      const meta = doc.createElementNS(raiz.namespaceURI, "meta")
      meta.setAttribute("http-equiv", "Content-Security-Policy")
      meta.setAttribute("content", CSP)
      head.insertBefore(meta, head.firstChild)
    }
  }
  const saida = tipo === "text/html" ? "<!DOCTYPE html>\n" + doc.documentElement.outerHTML : new XMLSerializer().serializeToString(doc)
  return { texto: saida, tipo }
}

const TIPOS_PAGINA = ["application/xhtml+xml", "text/html", "image/svg+xml"]

/** Liga a limpeza ao carregamento das páginas do livro. Chamar logo depois de `open()`. */
export function protegerLivro(livro: LivroFoliate) {
  const alvo = livro.transformTarget
  if (!alvo) return
  alvo.addEventListener("load", (e) => {
    const d = (e as EventoCarga).detail
    if (d.isScript) d.allow = false
  })
  alvo.addEventListener("data", (e) => {
    const d = (e as EventoDados).detail
    const tipo = typeof d.type === "string" ? d.type : ""
    if (!TIPOS_PAGINA.includes(tipo)) return
    const limpo = Promise.resolve(d.data).then((x) => (typeof x === "string" ? limparPaginaDoLivro(x, tipo) : { texto: x, tipo }))
    // O foliate espera os dois (dados e tipo) antes de criar a página
    d.data = limpo.then((r) => r.texto)
    d.type = limpo.then((r) => r.tipo)
  })
}

export function textoDoMetadado(x: unknown): string {
  if (!x) return ""
  if (typeof x === "string") return x
  if (Array.isArray(x)) return x.map(textoDoMetadado).filter(Boolean).join(", ")
  if (typeof x === "object") {
    const o = x as { name?: unknown } & Record<string, unknown>
    if (o.name) return textoDoMetadado(o.name)
    const primeiro = Object.values(o)[0]
    return typeof primeiro === "string" ? primeiro : ""
  }
  return ""
}
