import { emPe, legendaDoLink, lerMidia, type Midia } from "@/lib/videos"

/**
 * Plugin do leitor de markdown (rehype): um link de vídeo sozinho no parágrafo (ou no item
 * de lista) vira um player. Os players seguidos ficam juntos numa grade (`div.videos`), onde
 * os vídeos em pé aparecem lado a lado. Link de vídeo no meio de um texto continua link.
 *
 * Cada player sai como <figure data-midia="…">, desenhado pelo componente do leitor.
 */

type No = {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: No[]
  value?: string
}

type Achado = { endereco: string; legenda: string | null; midia: Midia }

const ehEspaco = (n: No) => n.type === "text" && !String(n.value ?? "").trim()
const ehElemento = (n: No, tag: string) => n.type === "element" && n.tagName === tag

function textoDe(n: No): string {
  if (n.type === "text") return String(n.value ?? "")
  return (n.children ?? []).map(textoDe).join("")
}

function midiaDoLink(n: No): Achado | null {
  if (ehElemento(n, "a")) {
    const endereco = String(n.properties?.href ?? "")
    const midia = lerMidia(endereco)
    return midia ? { endereco, legenda: legendaDoLink(textoDe(n), endereco), midia } : null
  }
  // Vídeo que veio como imagem (![…](video.mp4))
  if (ehElemento(n, "img")) {
    const endereco = String(n.properties?.src ?? "")
    const midia = lerMidia(endereco)
    return midia?.fonte === "arquivo" ? { endereco, legenda: legendaDoLink(String(n.properties?.alt ?? ""), endereco), midia } : null
  }
  return null
}

/** Os links de mídia de um trecho que só tem esses links (e espaços ou quebras de linha). */
function soMidias(filhos: No[]): Achado[] | null {
  const achados: Achado[] = []
  for (const f of filhos) {
    if (ehEspaco(f) || ehElemento(f, "br")) continue
    const a = midiaDoLink(f)
    if (!a) return null
    achados.push(a)
  }
  return achados.length ? achados : null
}

/** Item de lista que só tem links de mídia, numa lista "junta" (li > a) ou "solta" (li > p > a). */
function midiasDoItem(li: No): Achado[] | null {
  const filhos = (li.children ?? []).filter((f) => !ehEspaco(f))
  if (!filhos.length) return null
  if (filhos.every((f) => ehElemento(f, "p"))) {
    const todos: Achado[] = []
    for (const p of filhos) {
      const a = soMidias(p.children ?? [])
      if (!a) return null
      todos.push(...a)
    }
    return todos
  }
  return soMidias(li.children ?? [])
}

function figura(a: Achado): No {
  const properties: Record<string, unknown> = { dataMidia: a.endereco, dataFormato: emPe(a.midia) ? "em-pe" : "deitado" }
  if (a.legenda) properties.dataLegenda = a.legenda
  return { type: "element", tagName: "figure", properties, children: [] }
}

const ehFigura = (n: No) => ehElemento(n, "figure") && typeof n.properties?.dataMidia === "string"

function grade(filhos: No[]): No {
  return { type: "element", tagName: "div", properties: { className: ["videos"] }, children: filhos }
}

/** Junta as figuras seguidas (com só espaço entre elas) numa grade. */
function agrupar(filhos: No[]): No[] {
  const saida: No[] = []
  let atual: No | null = null
  let espacos: No[] = []
  for (const f of filhos) {
    if (ehFigura(f)) {
      if (!atual) {
        atual = grade([])
        saida.push(atual)
      }
      atual.children!.push(f)
      espacos = []
      continue
    }
    if (atual && ehEspaco(f)) {
      espacos.push(f)
      continue
    }
    saida.push(...espacos)
    espacos = []
    atual = null
    saida.push(f)
  }
  saida.push(...espacos)
  return saida
}

function percorrer(pai: No) {
  if (!pai.children) return
  const novos: No[] = []
  for (const f of pai.children) {
    if (f.type !== "element") {
      novos.push(f)
      continue
    }
    if (f.tagName === "p") {
      const achados = soMidias(f.children ?? [])
      if (achados) {
        novos.push(...achados.map(figura))
        continue
      }
    } else if (f.tagName === "ul") {
      // Lista de marcadores só com vídeos: vira a grade inteira (numerada continua lista)
      const itens = (f.children ?? []).filter((c) => ehElemento(c, "li"))
      const midias = itens.map(midiasDoItem)
      if (itens.length && midias.every(Boolean)) {
        for (const m of midias) novos.push(...m!.map(figura))
        continue
      }
    } else if (f.tagName === "li") {
      const achados = midiasDoItem(f)
      if (achados) {
        f.children = [grade(achados.map(figura))]
        const classes = f.properties?.className
        f.properties = { ...f.properties, className: [...(Array.isArray(classes) ? classes : []), "li-midia"] }
        novos.push(f)
        continue
      }
    }
    percorrer(f)
    novos.push(f)
  }
  pai.children = agrupar(novos)
}

export function marcarMidias() {
  return (arvore: unknown) => {
    percorrer(arvore as No)
  }
}
