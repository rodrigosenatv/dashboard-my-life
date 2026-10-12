// Tabelas (pelas bordas desenhadas) e figuras (pelas imagens) de cada página.
import type { Caixa, Linha, PaginaBruta } from "./tipos"

export type Objeto =
  { tipo: "tabela"; pagina: number; caixa: Caixa; linhas: string[][] } | { tipo: "imagem"; pagina: number; caixa: Caixa; id: string; paginaInteira: boolean }

const TOL = 2.5

function encostam(a: Caixa, b: Caixa, tol = TOL): boolean {
  return a.x0 - tol <= b.x1 && b.x0 - tol <= a.x1 && a.y0 - tol <= b.y1 && b.y0 - tol <= a.y1
}

function unir(a: Caixa, b: Caixa): Caixa {
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }
}

function area(c: Caixa): number {
  return Math.max(0, c.x1 - c.x0) * Math.max(0, c.y1 - c.y0)
}

/** Agrupa caixas que se tocam (union-find simples). */
function agrupar(caixas: Caixa[], tol = TOL): Caixa[][] {
  const pai = caixas.map((_, i) => i)
  const raiz = (i: number): number => (pai[i] === i ? i : (pai[i] = raiz(pai[i])))
  for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) if (encostam(caixas[i], caixas[j], tol)) pai[raiz(i)] = raiz(j)
  const grupos = new Map<number, Caixa[]>()
  caixas.forEach((c, i) => {
    const r = raiz(i)
    const g = grupos.get(r)
    if (g) g.push(c)
    else grupos.set(r, [c])
  })
  return [...grupos.values()]
}

/** Valores distintos (com tolerância), em ordem. */
function distintos(valores: number[], tol = TOL): number[] {
  const v = [...valores].sort((a, b) => a - b)
  const r: number[] = []
  for (const x of v) if (!r.length || x - r[r.length - 1] > tol) r.push(x)
  return r
}

const centro = (l: Linha) => ({ x: (l.x0 + l.x1) / 2, y: l.y - l.tamanho * 0.3 })

function dentro(p: { x: number; y: number }, c: Caixa, folga = 1): boolean {
  return p.x >= c.x0 - folga && p.x <= c.x1 + folga && p.y >= c.y0 - folga && p.y <= c.y1 + folga
}

/** Tabelas com bordas: linhas horizontais e verticais que formam uma grade. Tira o texto delas do fluxo. */
export function extrairTabelas(p: PaginaBruta): Objeto[] {
  const regras = p.regras.filter((r) => {
    const w = r.x1 - r.x0
    const h = r.y1 - r.y0
    // moldura da página não conta
    return !(w > p.largura * 0.85 || h > p.altura * 0.85)
  })
  if (regras.length < 4) return []
  const tabelas: Objeto[] = []
  for (const grupo of agrupar(regras)) {
    const horizontais = grupo.filter((r) => r.x1 - r.x0 > r.y1 - r.y0)
    const verticais = grupo.filter((r) => r.y1 - r.y0 >= r.x1 - r.x0)
    if (horizontais.length < 2 || verticais.length < 2) continue
    const caixa = grupo.reduce(unir)
    if (area(caixa) > p.largura * p.altura * 0.7) continue
    const ys = distintos(horizontais.map((r) => (r.y0 + r.y1) / 2))
    const xs = distintos(verticais.map((r) => (r.x0 + r.x1) / 2))
    if (ys.length < 2 || xs.length < 2 || (ys.length - 1) * (xs.length - 1) < 2) continue

    // Cada pedaço de texto vai para a célula onde está o seu meio
    type Pedaco = { y: number; x0: number; texto: string; espaco: boolean }
    const celulas: Pedaco[][][] = Array.from({ length: ys.length - 1 }, () => Array.from({ length: xs.length - 1 }, () => []))
    const usadas = new Set<Linha>()
    for (const l of p.linhas) {
      const c = centro(l)
      if (!dentro(c, caixa)) continue
      const linha = ys.findIndex((y, i) => i < ys.length - 1 && c.y >= y - 1 && c.y <= ys[i + 1] + 1)
      if (linha < 0) continue
      for (const pd of l.pedacos) {
        const meio = (pd.x0 + pd.x1) / 2
        const coluna = xs.findIndex((x, i) => i < xs.length - 1 && meio >= x - TOL && meio <= xs[i + 1] + TOL)
        if (coluna >= 0) celulas[linha][coluna].push({ y: l.y, x0: pd.x0, texto: pd.texto, espaco: pd.espaco })
      }
      usadas.add(l)
    }
    const juntar = (cel: Pedaco[]) => {
      let s = ""
      let y: number | null = null
      for (const pd of cel) {
        const novaLinha = y !== null && Math.abs(pd.y - y) > 1
        s += (s && (pd.espaco || novaLinha) ? " " : "") + pd.texto
        y = pd.y
      }
      return s.replace(/\s+/g, " ").trim()
    }
    const textos = celulas.map((linha) => linha.map(juntar)).filter((linha) => linha.some((t) => t))
    if (!textos.length) continue
    p.linhas = p.linhas.filter((l) => !usadas.has(l))
    tabelas.push({ tipo: "tabela", pagina: p.numero, caixa, linhas: textos })
  }
  return tabelas
}

/**
 * Figuras: imagens com tamanho de ilustração. Fundo de página inteira (com texto por cima) é ignorado;
 * o texto que fica por cima de uma figura (rótulos) sai do fluxo.
 */
export function extrairFiguras(p: PaginaBruta, gerarId: () => string): Objeto[] {
  const areaPagina = p.largura * p.altura
  const candidatas = p.imagens
    .map((c) => ({ x0: Math.max(0, c.x0), y0: Math.max(0, c.y0), x1: Math.min(p.largura, c.x1), y1: Math.min(p.altura, c.y1) }))
    .filter((c) => c.x1 - c.x0 >= 36 && c.y1 - c.y0 >= 24)
  if (!candidatas.length) return []
  const figuras: Objeto[] = []
  for (const grupo of agrupar(candidatas, 4)) {
    const caixa = grupo.reduce(unir)
    const fracao = area(caixa) / areaPagina
    const porCima = p.linhas.filter((l) => dentro(centro(l), caixa))
    // Rótulo: texto curto inteiro dentro da imagem. Texto corrido por cima indica que a imagem é fundo ou enfeite.
    const rotulo = (l: Linha) => l.x0 >= caixa.x0 - 2 && l.x1 <= caixa.x1 + 2 && l.texto.length <= 40
    const corrido = porCima.filter((l) => !rotulo(l))
    if (corrido.length >= 2 || corrido.some((l) => l.texto.length > 60)) continue
    const paginaInteira = fracao > 0.6 && p.linhas.length <= 3
    const rotulos = new Set(porCima.filter(rotulo))
    p.linhas = p.linhas.filter((l) => !rotulos.has(l))
    figuras.push({ tipo: "imagem", pagina: p.numero, caixa, id: gerarId(), paginaInteira })
  }
  return figuras
}
