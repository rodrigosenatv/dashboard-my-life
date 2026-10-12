// Regras de texto usadas para remontar parágrafos a partir das linhas do PDF.

/** Assinatura de uma linha para achar repetições (cabeçalhos, rodapés): sem acento, sem número, minúscula. */
export function assinatura(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\d+/g, "#")
    .replace(/[\s.·•_\-–—]+/g, " ")
    .trim()
}

const ROMANO = /^(?=[ivxlcdm]+$)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i

/** Linha que é só um número de página: "12", "- 12 -", "xii", "Página 12", "12 de 64". */
export function ehNumeroDePagina(texto: string): boolean {
  const t = texto.trim()
  if (!t || t.length > 18) return false
  if (/^[-–—|\s]*\d{1,4}[-–—|\s]*$/.test(t)) return true
  if (/^(p[áa]g(ina)?\.?\s*)?\d{1,4}(\s*(de|\/)\s*\d{1,4})?$/i.test(t)) return true
  return ROMANO.test(t) && t.length <= 6
}

/** Fim de frase: ponto, exclamação, interrogação ou reticências, com aspas ou parênteses depois. */
export function terminaFrase(texto: string): boolean {
  return /[.!?…](?:["'”’»)\]]*)\s*$/.test(texto)
}

export function terminaPontuacao(texto: string): boolean {
  return /[.!?…:;](?:["'”’»)\]]*)\s*$/.test(texto)
}

/** Caracteres de símbolos (Wingdings, Symbol) que o Word usa como marcadores de lista. */
const MARCADOR_PRIVADO = /^[-]/

const MARCADOR = /^\s*(?:[•●○◦▪▫■□◆◇►▸‣⁃∙·*✓✔➢➤→❖➔]|[-]|-(?=\s))\s*/
const ENUMERACAO = /^\s*(?:\(?\d{1,3}[.)](?!\d)|\(?[a-zA-Z][)]|[a-h][.](?=\s)|\(\s*[a-z\d]{1,3}\s*\)|[IVXLC]{1,6}\s*[-–—.)](?=\s))\s+/

/** A linha começa um item de lista (marcador ou numeração). */
export function comecaItem(texto: string): boolean {
  return MARCADOR.test(texto) || ENUMERACAO.test(texto)
}

/** Fala de diálogo: a linha começa com travessão. */
export function comecaTravessao(texto: string): boolean {
  return /^\s*[–—]\s*\S/.test(texto)
}

/** Troca os marcadores em fontes de símbolos por um marcador comum. */
export function normalizarMarcador(texto: string): string {
  return texto.replace(MARCADOR_PRIVADO, "•").replace(/[-]/g, "")
}

export function comecaMinuscula(texto: string): boolean {
  return /^[\s"“'‘(«]*[a-zà-öø-ÿ]/.test(texto)
}

/** Pronomes que o português escreve com hífen depois do verbo ("fazê-lo", "dá-lhe"). */
const CLITICOS_FORTES = new Set(["lo", "la", "los", "las", "lhe", "lhes"])
const CLITICOS_FRACOS = new Set(["se", "me", "te", "nos", "vos"])

/** Endereço da internet partido ("www.site.co" + "m.br"): o resto também tem ponto ou barra. */
const URL_NO_FIM = /(?:https?:\/\/|www\.)[^\s]*[A-Za-z0-9/-]$/i
const RESTO_DE_URL = /^(?!www\.|https?:)[A-Za-z0-9-]*[./][A-Za-z0-9]/i

export function continuaUrl(fim: string, inicio: string): boolean {
  return URL_NO_FIM.test(fim.trimEnd()) && RESTO_DE_URL.test(inicio.trimStart())
}

/**
 * Junta o fim de uma linha ao começo da seguinte.
 * Decide se o hífen do fim da linha é só quebra de sílaba ("conceitua-ção") ou parte da palavra
 * ("pré-determinados", "fazê-lo"), consultando as palavras que aparecem inteiras no próprio livro.
 */
export function juntarLinhas(anterior: string, proxima: string, palavras: Set<string>): { texto: string; separador: string } {
  const fim = anterior.replace(/\s+$/, "")
  const inicio = proxima.replace(/^\s+/, "")
  if (fim.endsWith("­")) return { texto: fim.slice(0, -1), separador: "" }
  if (continuaUrl(fim, inicio)) return { texto: fim, separador: "" }
  const hifen = /([A-Za-zÀ-ÖØ-öø-ÿ]+)-$/.exec(fim)
  if (hifen && !/\s-$/.test(fim)) {
    const parte = hifen[1]
    const resto = /^[A-Za-zÀ-ÖØ-öø-ÿ]+/.exec(inicio)?.[0] ?? ""
    if (!resto || /^[A-ZÀ-ÖØ-Þ\d]/.test(resto)) return { texto: fim, separador: "" }
    const comHifen = `${parte}-${resto}`.toLowerCase()
    const semHifen = `${parte}${resto}`.toLowerCase()
    const manter =
      palavras.has(comHifen) ||
      (!palavras.has(semHifen) &&
        (CLITICOS_FORTES.has(resto.toLowerCase()) || (CLITICOS_FRACOS.has(resto.toLowerCase()) && /([áéêíóôú]|ou|ei|[aeo]m|[aei]r)$/i.test(parte))))
    return manter ? { texto: fim, separador: "" } : { texto: fim.slice(0, -1), separador: "" }
  }
  return { texto: fim, separador: " " }
}

/** Palavras do texto (minúsculas), inclusive as com hífen, para decidir as junções. */
export function coletarPalavras(textos: Iterable<string>): Set<string> {
  const palavras = new Set<string>()
  const re = /[A-Za-zÀ-ÖØ-öø-ÿ]+(?:-[A-Za-zÀ-ÖØ-öø-ÿ]+)*/g
  for (const texto of textos) {
    // a última palavra da linha pode estar partida; não entra
    const corpo = texto.replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+-\s*$/, "")
    for (const m of corpo.matchAll(re)) palavras.add(m[0].toLowerCase())
  }
  return palavras
}

/**
 * Pares de palavras vizinhas na mesma linha em que a segunda começa com maiúscula ("Ressonância Harmônica",
 * "Nova York", "Guerra Mundial"). Servem para não separar um nome partido entre duas linhas.
 */
export function coletarPares(textos: Iterable<string>): Set<string> {
  const pares = new Set<string>()
  const re = /([A-Za-zÀ-ÖØ-öø-ÿ]+) (?=([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ]*))/g
  for (const texto of textos) for (const m of texto.matchAll(re)) pares.add(`${m[1]} ${m[2]}`.toLowerCase())
  return pares
}

/** A última palavra de uma linha e a primeira da seguinte formam um par que o livro usa junto. */
export function continuaNome(anterior: string, proxima: string, pares: Set<string>): boolean {
  const ultima = /([A-Za-zÀ-ÖØ-öø-ÿ]+)\s*$/.exec(anterior)?.[1]
  const primeira = /^[\s"“'‘(«]*([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ]*)/.exec(proxima)?.[1]
  return Boolean(ultima && primeira && pares.has(`${ultima} ${primeira}`.toLowerCase()))
}

/** Marca (um "não caractere" do Unicode, que nunca aparece em texto) em volta de letras que estavam espaçadas. */
export const MARCA_ESPACADO = "﷐"
const RE_MARCADO = /﷐([^﷐]*)﷐/g

/**
 * Texto com espaço entre as letras ("e s p e c t a d o r", efeito de espaçamento de caracteres no PDF)
 * volta a ser uma palavra. Vale para o pedaço inteiro assim ou para sequências de 4 letras ou mais.
 * Às vezes o PDF perde também os espaços entre as palavras ("r e a l i z a d o s o s e v e n t o s");
 * o resultado fica marcado para `separarPalavrasColadas` dividir depois, com o vocabulário do livro.
 */
export function juntarLetrasEspacadas(t: string): string {
  const colar = (m: string) => MARCA_ESPACADO + m.replace(/ /g, "") + MARCA_ESPACADO
  const r = /^\p{L}(?: \p{L}){2,}$/u.test(t.trim())
    ? t.replace(/\p{L}(?: \p{L})+/u, colar)
    : t.replace(/(?<![\p{L}\p{N}])\p{L}(?: \p{L}){3,}(?![\p{L}\p{N}])/gu, colar)
  // Pontuação que ficou solta depois das letras ("antes , durante")
  return r.replace(/﷐ ([,.;:!?)])/g, `${MARCA_ESPACADO}$1`)
}

/** Quantas vezes cada palavra aparece (minúscula), sem contar os trechos marcados como espaçados. */
export function contarPalavras(textos: Iterable<string>): Map<string, number> {
  const freq = new Map<string, number>()
  for (const texto of textos)
    for (const m of texto.replace(RE_MARCADO, " ").matchAll(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g)) {
      const w = m[0].toLowerCase()
      freq.set(w, (freq.get(w) ?? 0) + 1)
    }
  return freq
}

/**
 * Divide uma sequência de palavras coladas usando as palavras que o livro usa em outros lugares,
 * com o menor número de palavras possível. Só aceita a divisão em 3 palavras ou mais.
 */
export function segmentar(token: string, freq: Map<string, number>): string | null {
  const t = token.toLowerCase()
  const n = t.length
  if (n < 12 || freq.has(t)) return null
  const melhor = new Array<number>(n + 1).fill(Infinity)
  const de = new Array<number>(n + 1).fill(-1)
  melhor[0] = 0
  for (let i = 1; i <= n; i++)
    for (let j = Math.max(0, i - 24); j < i; j++) {
      if (melhor[j] === Infinity) continue
      const w = t.slice(j, i)
      // Plural de uma palavra que o livro usa também vale ("realizados" com "realizado" no texto)
      const conhecida = freq.has(w) || (w.length >= 4 && w.endsWith("s") && freq.has(w.slice(0, -1)))
      if (!conhecida || (w.length === 1 && !/^[aeoàé]$/.test(w))) continue
      if (melhor[j] + 1 < melhor[i]) {
        melhor[i] = melhor[j] + 1
        de[i] = j
      }
    }
  if (melhor[n] === Infinity || melhor[n] < 3) return null
  const partes: string[] = []
  for (let i = n; i > 0; i = de[i]) partes.unshift(token.slice(de[i], i))
  return partes.join(" ")
}

/** Troca os trechos marcados pelas palavras separadas (quando dá) e tira as marcas. */
export function separarPalavrasColadas(texto: string, freq: Map<string, number>): string {
  if (!texto.includes(MARCA_ESPACADO)) return texto
  return texto.replace(RE_MARCADO, (_, w: string) => segmentar(w, freq) ?? w).replaceAll(MARCA_ESPACADO, "")
}

/**
 * Palavras que o livro escreve com maiúscula no meio da frase ("a Centelha Divina", "o Vácuo"), mais vezes
 * do que no começo de frase. Começar a linha com uma delas não indica frase nova.
 */
export function coletarNomes(textos: Iterable<string>): Set<string> {
  const meio = new Map<string, number>()
  const inicio = new Map<string, number>()
  const conta = (mapa: Map<string, number>, w: string) => mapa.set(w, (mapa.get(w) ?? 0) + 1)
  for (const texto of textos) {
    for (const m of texto.matchAll(/(?<=[a-zà-öø-ÿ,] )([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]{2,})(?![A-Za-zÀ-ÖØ-öø-ÿ])/g)) conta(meio, m[1].toLowerCase())
    for (const m of texto.matchAll(/[.!?…]["”»)]*\s+([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]{2,})(?![A-Za-zÀ-ÖØ-öø-ÿ])/g)) conta(inicio, m[1].toLowerCase())
  }
  const nomes = new Set<string>()
  for (const [w, n] of meio) if (n >= 2 && n >= 2 * (inicio.get(w) ?? 0)) nomes.add(w)
  return nomes
}

/** A linha começa com uma palavra que o livro usa com maiúscula no meio da frase. */
export function comecaComNome(texto: string, nomes: Set<string>): boolean {
  const w = /^[\s"“'‘(«]*([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]{2,})(?![A-Za-zÀ-ÖØ-öø-ÿ])/.exec(texto)?.[1]
  return Boolean(w && nomes.has(w.toLowerCase()))
}

/** Começo de nota de rodapé: número ou símbolo de chamada seguido do texto ("1 Antonio Jorge…", "* Ver…"). */
export function comecaNota(texto: string): boolean {
  return /^\s*(?:\d{1,3}|[*†‡§¹²³⁴⁵⁶⁷⁸⁹⁰]+)\s*[A-Za-zÀ-ÖØ-öø-ÿ"“(]/.test(texto)
}

/** Linha no formato "Rótulo: valor" ("Diretor: Cel PM Fulano", "Edição e Revisão: Fulana"). */
export function pareceCampo(texto: string): boolean {
  return /^[A-ZÀ-Ý][A-Za-zÀ-ÖØ-öø-ÿ–\- ]{1,32}:\s+\S/.test(texto)
}

/** Texto que parece título de sumário: "Capítulo 3", "2ª Aula", "PARTE II", "1.2 Introdução". */
export function pareceTituloPorPadrao(texto: string): boolean {
  const t = texto.trim()
  return (
    /^(cap[íi]tulo|parte|livro|unidade|m[óo]dulo|aula|li[çc][ãa]o|se[çc][ãa]o|ep[íi]logo|pr[óo]logo|introdu[çc][ãa]o|conclus[ãa]o|pref[áa]cio|ap[êe]ndice|anexo)\b/i.test(
      t,
    ) || /^\d{1,3}\s*[ªºao°]?\.?\s+(aula|parte|li[çc][ãa]o|cap[íi]tulo|unidade|m[óo]dulo)\b/i.test(t)
  )
}

/** Remove caracteres que não podem existir em XML. */
export function limparXml(texto: string): string {
  return texto.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F﷐￾￿]/g, "").replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
}

export function escaparXml(texto: string): string {
  return limparXml(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** Moda de uma lista de números arredondados a meio ponto, ponderada. */
export function moda(valores: Iterable<[valor: number, peso: number]>, passo = 0.5): number {
  const cont = new Map<number, number>()
  for (const [v, p] of valores) {
    const k = Math.round(v / passo) * passo
    cont.set(k, (cont.get(k) ?? 0) + p)
  }
  let melhor = 0
  let maior = -1
  for (const [k, p] of cont) if (p > maior) [melhor, maior] = [k, p]
  return melhor
}

export function percentil(valores: number[], p: number): number {
  if (!valores.length) return 0
  const v = [...valores].sort((a, b) => a - b)
  return v[Math.min(v.length - 1, Math.max(0, Math.round((v.length - 1) * p)))]
}
