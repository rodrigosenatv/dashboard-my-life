// O que o Notion exporta junto com o conteúdo, mas não é conteúdo.
//
// 1. Metadados de visões: onde uma página do Notion mostrava uma visão de um banco
//    (lista filtrada, quadro), a exportação deixa a configuração da visão no meio do texto:
//
//        filters:
//        uhjR
//        sort:
//        CVKx: ascending
//
// 2. A moldura do modelo "Segundo Cérebro": toda captura, projeto e área nasce de um modelo
//    com o menu das páginas PARA no topo, títulos fixos ("Anotações:", "Projeto:", "Área:"…),
//    uma frase de instrução em itálico e as visões dos itens relacionados. No app essas
//    relações já existem como dados (projeto e área da captura, etapas do projeto), então
//    do texto só interessa o que a pessoa escreveu.
//
// As duas funções só removem linhas inteiras que batem com esses padrões; nada é reescrito,
// e o que está dentro de um bloco de código (```) nunca é tocado.

const CERCA = /^\s*(```|~~~)/
const METADADOS = /^(filters|sort):\s*$/
const VISAO_SEM_LINK = /^Sem título\s*$/

const MENU_CABECA = /^-\s*\[Segundo Cérebro\]\(\/paginas\/[0-9a-f-]{36}\)\s*$/
const MENU_ITEM = /^\s+\[\d\d - [^\]]+\]\(\/paginas\/[0-9a-f-]{36}\)\s*$/
const ICONE_MODELO = /^(>\s*)?<img\s[^>]*Ellipse_1\.png[^>]*>\s*$/
const TITULO_MODELO = /^(>\s*)?#{1,6}\s*(Anotações|Projeto|Área|Sub-tarefas|Capturas vinculadas|Capturas):\s*$/
const INSTRUCAO =
  /^\*(Utilize o espaço (abaixo para aprofundar|para fazer anotações importantes)|Caso essa \**anotação\** esteja vinculad|Aqui estão as (sub-?tarefas|capturas) que estão vinculadas|Essas são as capturas que estão vinculadas)[^\n]*\*\s*$/
const VISAO = /^\[Sem título\]\(\/[^)\s]*\)\s*$/

const vazia = (linha: string | undefined) => linha === undefined || !linha.trim()

function limpar(md: string, comMoldura: boolean): string {
  const linhas = md.split("\n")
  const saida: string[] = []
  let removeu = false
  let acabouDeRemover = false
  let dentroDeCodigo = false
  // A última linha com texto do original foi removida por ser do modelo? (decide o destino das visões logo abaixo)
  let anteriorEraModelo = false

  const proximaComTexto = (de: number) => {
    for (let j = de; j < linhas.length; j++) if (!vazia(linhas[j])) return linhas[j]
    return undefined
  }
  const remover = () => {
    removeu = true
    acabouDeRemover = true
  }
  const manter = (linha: string) => {
    if (vazia(linha)) {
      // Junto de um trecho removido não sobra mais de uma linha em branco
      if (acabouDeRemover && (saida.length === 0 || vazia(saida[saida.length - 1]))) return
    } else {
      acabouDeRemover = false
      anteriorEraModelo = false
    }
    saida.push(linha)
  }

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]

    if (CERCA.test(linha)) {
      dentroDeCodigo = !dentroDeCodigo
      manter(linha)
      continue
    }
    if (dentroDeCodigo) {
      saida.push(linha)
      continue
    }

    if (METADADOS.test(linha)) {
      // O nome da visão, quando veio sem link, é a linha de texto logo acima
      let k = saida.length - 1
      while (k >= 0 && vazia(saida[k])) k--
      if (k >= 0 && VISAO_SEM_LINK.test(saida[k])) saida.length = k
      // A configuração ocupa as linhas seguintes, até a primeira em branco
      while (i + 1 < linhas.length && !vazia(linhas[i + 1])) i++
      remover()
      anteriorEraModelo = true
      continue
    }

    if (comMoldura) {
      if (MENU_CABECA.test(linha)) {
        while (i + 1 < linhas.length && (vazia(linhas[i + 1]) || MENU_ITEM.test(linhas[i + 1]))) i++
        remover()
        anteriorEraModelo = true
        continue
      }
      if (ICONE_MODELO.test(linha) || TITULO_MODELO.test(linha) || INSTRUCAO.test(linha)) {
        remover()
        anteriorEraModelo = true
        continue
      }
      if (VISAO.test(linha)) {
        const seguinte = proximaComTexto(i + 1)
        if (anteriorEraModelo || (seguinte !== undefined && METADADOS.test(seguinte))) {
          remover()
          anteriorEraModelo = true
          continue
        }
      }
    }

    manter(linha)
  }

  return removeu ? saida.join("\n").trim() : md
}

/** Tira a configuração de visões ("filters:", "sort:") que o Notion deixa no meio do texto. Serve para qualquer texto importado. */
export function tirarMetadadosDeVisao(md: string): string {
  return limpar(md, false)
}

/** Tira a moldura do modelo "Segundo Cérebro" (e os metadados de visões). Para o texto de capturas, projetos e áreas. */
export function tirarMolduraNotion(md: string): string {
  return limpar(md, true)
}
