// As anotações importadas do Notion trazem a moldura do modelo "Segundo Cérebro":
// um menu de páginas no topo, os títulos "Anotações / Projeto / Área" com uma frase
// de instrução e, no fim, os links das coleções filtradas. Nada disso é conteúdo.

const LINK_PAGINA = /^\s*-?\s*\[[^\]]*\]\(\/paginas\/[^)]+\)\s*$/
const TITULO_MODELO = /^(> )?#{1,3} (Anotações|Projeto|Área):\s*$/
const INSTRUCAO = /^\*(Utilize o espaço abaixo|Caso essa)[^\n]*\*\s*$/
const LINK_COLECAO = /^\[[^\]]*\]\(\/colecoes\/[^)]+\)\s*$/

/** Tira a moldura do modelo do Notion e devolve só o que a pessoa escreveu. */
export function semModeloNotion(md: string): string {
  const linhas = md.split("\n")
  let inicio = 0
  while (inicio < linhas.length && (!linhas[inicio].trim() || LINK_PAGINA.test(linhas[inicio]))) inicio++

  const saida: string[] = []
  for (let i = inicio; i < linhas.length; i++) {
    const l = linhas[i]
    if (TITULO_MODELO.test(l) || INSTRUCAO.test(l) || LINK_COLECAO.test(l)) continue
    if (/^filters:\s*$/.test(l)) {
      i++ // a linha seguinte é o nome do filtro
      continue
    }
    saida.push(l)
  }
  return saida.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

/** Texto corrido para a prévia de duas linhas: sem imagens, endereços nem marcação. */
export function previaTexto(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^```.*$/gm, "")
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}
