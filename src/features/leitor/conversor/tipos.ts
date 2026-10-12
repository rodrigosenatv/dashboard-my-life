// Tipos do conversor de PDF para livro fluido (EPUB).
// As coordenadas são as da página "em pé": origem no canto superior esquerdo, y crescendo para baixo,
// em pontos (1/72 de polegada), como no viewport do pdf.js em escala 1.

export type Caixa = { x0: number; y0: number; x1: number; y1: number }

/** Um pedaço de texto com o mesmo estilo dentro de uma linha. */
export type Trecho = { texto: string; negrito: boolean; italico: boolean; sobrescrito?: boolean }

export type Linha = {
  pagina: number
  /** Posição na ordem em que o PDF desenha o texto da página. */
  ordem: number
  x0: number
  x1: number
  /** Linha de base do texto. */
  y: number
  tamanho: number
  negrito: boolean
  italico: boolean
  trechos: Trecho[]
  texto: string
  /** Os pedaços de texto como o PDF os posicionou (usados para separar as células de tabelas). */
  pedacos: { x0: number; x1: number; texto: string; espaco: boolean }[]
  /** Linhas logo acima foram retiradas (cabeçalho no meio do texto): o espaço antes desta não indica parágrafo. */
  semVao?: boolean
  /** Título de parte (repetido no PDF antes de cada capítulo); fica só a primeira vez, como título acima dos capítulos. */
  parte?: boolean
}

export type PaginaBruta = {
  numero: number
  largura: number
  altura: number
  linhas: Linha[]
  imagens: Caixa[]
  /** Traços finos (bordas de tabela, sublinhados, molduras). */
  regras: Caixa[]
}

/** Marca de página dentro do texto: diz em que página do PDF o trecho seguinte começa. */
export type Marca = { pagina: number }

export type Inline = Trecho | Marca

export const ehMarca = (i: Inline): i is Marca => "pagina" in i

export type Bloco =
  | {
      tipo: "paragrafo"
      inlines: Inline[]
      tamanho: number
      negrito: boolean
      centralizado?: boolean
      recuado?: boolean
      nota?: boolean
      item?: boolean
      parte?: boolean
      pagina: number
      linhas: number
    }
  | { tipo: "titulo"; nivel: 1 | 2 | 3; inlines: Inline[]; pagina: number; parte?: boolean }
  | { tipo: "imagem"; id: string; largura: number; altura: number; pagina: number; marcas: Marca[]; descricao: string }
  | { tipo: "tabela"; linhas: string[][]; pagina: number; marcas: Marca[] }
  | { tipo: "marcas"; marcas: Marca[]; pagina: number }

export type ItemSumario = { titulo: string; nivel: number; pagina: number; y: number }

export type ImagemExtraida = { id: string; dados: Uint8Array; tipo: "image/jpeg" | "image/png"; largura: number; altura: number }

/** Desenha uma região da página como imagem. No navegador usa canvas; nos testes pode faltar. */
export type RenderizarRegiao = (pagina: number, caixa: Caixa, larguraAlvo: number) => Promise<ImagemExtraida | null>

export type Progresso = { etapa: "lendo" | "montando" | "imagens" | "empacotando"; atual: number; total: number }

export type ResumoConversao = {
  paginas: number
  paginasSemTexto: number
  capitulos: number
  imagens: number
  tabelas: number
  palavras: number
  /** O PDF parece digitalizado (páginas sem texto): o leitor fluido não terá o conteúdo dessas páginas. */
  digitalizado: boolean
  /** Linhas tiradas por serem cabeçalho, rodapé, número de página ou sumário. */
  removidas: number
}

export type LivroConvertido = {
  epub: Uint8Array
  titulo: string
  autor: string
  resumo: ResumoConversao
  capa: ImagemExtraida | null
  /** Títulos encontrados, na ordem, para conferir antes de salvar. */
  sumario: { titulo: string; nivel: number; parte?: boolean }[]
}
