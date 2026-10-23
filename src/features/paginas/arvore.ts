import type { PaginaResumo } from "./dados"

export type IndiceArvore = {
  filhos: Map<string, PaginaResumo[]>
  descendentes: Map<string, number>
  posOrdem: PaginaResumo[]
}

/** Indexa uma vez; a travessia iterativa também aceita árvores muito profundas. */
export function indexarArvore(paginas: PaginaResumo[]): IndiceArvore {
  const filhos = new Map<string, PaginaResumo[]>()
  for (const pagina of paginas) {
    if (pagina.parent_id !== null) {
      const grupo = filhos.get(pagina.parent_id)
      if (grupo) grupo.push(pagina)
      else filhos.set(pagina.parent_id, [pagina])
    }
  }
  for (const grupo of filhos.values()) {
    grupo.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
  }
  const estados = new Map<string, number>()
  const descendentes = new Map<string, number>()
  const posOrdem: PaginaResumo[] = []
  for (const pagina of paginas) {
    if (estados.has(pagina.id)) continue
    const pilha = [{ pagina, proximo: 0 }]
    estados.set(pagina.id, 1)
    while (pilha.length) {
      const atual = pilha[pilha.length - 1]
      const grupo = filhos.get(atual.pagina.id) ?? []
      if (atual.proximo < grupo.length) {
        const filho = grupo[atual.proximo]
        if (estados.get(filho.id) === 1) {
          // Dados inválidos não devem causar recursão infinita na interface.
          grupo.splice(atual.proximo, 1)
          continue
        }
        atual.proximo++
        if (!estados.has(filho.id)) {
          estados.set(filho.id, 1)
          pilha.push({ pagina: filho, proximo: 0 })
        }
      } else {
        descendentes.set(atual.pagina.id, grupo.reduce((total, filho) => total + 1 + (descendentes.get(filho.id) ?? 0), 0))
        posOrdem.push(atual.pagina)
        estados.set(atual.pagina.id, 2)
        pilha.pop()
      }
    }
  }
  return { filhos, descendentes, posOrdem }
}

/** Cada título é consultado uma vez; propaga os resultados aos ancestrais. */
export function filtrarArvore(indice: IndiceArvore, corresponde: (pagina: PaginaResumo) => boolean): Set<string> {
  const visiveis = new Set<string>()
  for (const pagina of indice.posOrdem) {
    if (corresponde(pagina) || indice.filhos.get(pagina.id)?.some((filho) => visiveis.has(filho.id))) {
      visiveis.add(pagina.id)
    }
  }
  return visiveis
}
