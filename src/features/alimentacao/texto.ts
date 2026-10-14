import { numeroFlexivel } from "@/lib/utils"

/*
 * Funções puras da Alimentação (sem React nem banco): ler o plano escrito em texto, os
 * ingredientes das receitas, a situação da água e o id fixo de cada dia do diário.
 */

/* ------------------------------------------------------------------ */
/* Texto                                                               */
/* ------------------------------------------------------------------ */

/** Tira a marcação do markdown (negrito, itálico, escapes do Notion) e sobra o texto. */
export const limparMarkdown = (t: string) =>
  t
    .replace(/\\([~*_`#|\\])/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()

export const capitalizar = (t: string) => (t ? t[0].toLocaleUpperCase("pt-BR") + t.slice(1) : t)

/** Itens de lista ("- ", "* ", "1. ") de um texto em markdown. */
export function itensDoTexto(md: string | null | undefined): string[] {
  return (md ?? "")
    .split("\n")
    .map((l) => l.match(/^\s*(?:[-*•+]|\d+[.)])\s+(.*)$/)?.[1] ?? "")
    .map(limparMarkdown)
    .filter(Boolean)
}

export const itensParaTexto = (itens: string[]) =>
  itens
    .map((i) => i.trim())
    .filter(Boolean)
    .map((i) => `- ${i}`)
    .join("\n")

export type Metas = { kcal?: number; proteina?: number; carboidrato?: number; gordura?: number }
export type Marco = { hora: number; ml: number }

export type RefeicaoLida = { nome: string; quando: string; objetivo: string; nota: string; itens: string[] }
export type PlanoLido = { refeicoes: RefeicaoLida[]; metas: Metas; agua: { meta: number; marcos: Marco[] } | null }

const numeroBr = (t: string) => numeroFlexivel(t.replace(/\s/g, ""))

/** Número digitado num campo: "2700", "2.700", "3,5". Vazio ou texto vira null. */
export const lerNumeroDigitadoBr = (t: string) => numeroBr(t)

/**
 * Lê um plano alimentar escrito em texto: cada refeição é um título numerado
 * ("#### 1. Pré-treino (ao acordar)"), com "Objetivo: …" e a lista de itens. Um item que
 * termina em ":" e tem subitens (o shake, por exemplo) vira a nota da refeição.
 * Também acha as metas ("~2.700 kcal, ~155g de proteína…") e a da água ("Meta: 3,5 a 4L").
 */
export function lerPlanoDoTexto(md: string): PlanoLido {
  const refeicoes: RefeicaoLida[] = []
  let atual: RefeicaoLida | null = null
  let grupo: number | null = null
  for (const linha of md.replace(/\r/g, "").split("\n")) {
    const titulo = linha.match(/^\s*#{1,6}\s+(.*)$/)
    if (titulo) {
      const t = limparMarkdown(titulo[1])
      const m = t.match(/^(\d+)[.)-]?\s+(.+)$/)
      grupo = null
      if (!m) {
        atual = null
        continue
      }
      const partes = m[2].match(/^(.*?)\s*\(([^)]*)\)\s*$/)
      atual = { nome: (partes?.[1] ?? m[2]).trim(), quando: (partes?.[2] ?? "").trim(), objetivo: "", nota: "", itens: [] }
      refeicoes.push(atual)
      continue
    }
    if (!atual) continue
    const objetivo = limparMarkdown(linha).match(/^objetivo:\s*(.+)$/i)
    if (objetivo) {
      atual.objetivo = capitalizar(objetivo[1])
      continue
    }
    const b = linha.match(/^(\s*)[-*•+]\s+(.*)$/)
    if (!b) continue
    const nivel = b[1].replace(/\t/g, "    ").length
    const t = limparMarkdown(b[2])
    if (!t) continue
    if (grupo !== null && nivel <= grupo) grupo = null
    if (grupo === null && t.endsWith(":")) {
      grupo = nivel
      atual.nota = [atual.nota, t.slice(0, -1).trim()].filter(Boolean).join(" · ")
      continue
    }
    atual.itens.push(t)
  }

  const plano = limparMarkdown(md)
  const achar = (re: RegExp) => {
    const m = plano.match(re)
    return m ? (numeroBr(m[1]) ?? undefined) : undefined
  }
  const metas: Metas = {
    kcal: achar(/(\d[\d.,]*)\s*kcal/i),
    proteina: achar(/(\d[\d.,]*)\s*g\s*de\s*prote/i),
    carboidrato: achar(/(\d[\d.,]*)\s*g\s*de\s*carbo/i),
    gordura: achar(/(\d[\d.,]*)\s*g\s*de\s*gordura/i),
  }

  let agua: PlanoLido["agua"] = null
  const meta = plano.match(/meta:\s*(\d[\d.,]*)\s*(?:a\s*\d[\d.,]*\s*)?l\b/i)
  if (meta) {
    const litros = numeroBr(meta[1]) ?? 0
    const marcos: Marco[] = []
    let soma = 0
    for (const m of plano.matchAll(/(\d+(?:[.,]\d+)?)\s*litros?\s*até\s*(?:as\s*|às\s*)?(\d{1,2})\s*h/gi)) {
      soma += (numeroBr(m[1]) ?? 0) * 1000
      marcos.push({ hora: Number(m[2]), ml: Math.round(soma) })
    }
    if (litros > 0) agua = { meta: Math.round(litros * 1000), marcos: marcos.filter((x) => x.ml < litros * 1000) }
  }
  return { refeicoes, metas, agua }
}

export type ConfigAlimentacao = {
  aguaMeta: number
  marcos: Marco[]
  metas: Metas
  /** Página com as dicas do plano (o texto original). */
  dicas?: string
}

/** "1 L", "1,5 L", "750 ml". */
export const litros = (ml: number) => (ml >= 1000 || ml === 0 ? `${(ml / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L` : `${ml} ml`)

export type SituacaoAgua = { tipo: "meta" | "em-dia" | "falta" | "atrasado"; texto: string }

/** Onde a pessoa está em relação aos marcos do dia (só faz sentido para hoje). */
export function situacaoAgua(total: number, config: ConfigAlimentacao, agora = new Date()): SituacaoAgua {
  if (total >= config.aguaMeta) return { tipo: "meta", texto: "Meta do dia batida" }
  const hora = agora.getHours() + agora.getMinutes() / 60
  const marcos = [...config.marcos.filter((m) => m.ml < config.aguaMeta), { hora: 22, ml: config.aguaMeta }].sort((a, b) => a.hora - b.hora)
  const passados = marcos.filter((m) => m.hora <= hora)
  const devido = passados.at(-1)
  if (devido && devido.ml >= config.aguaMeta) return { tipo: "falta", texto: `Faltam ${litros(config.aguaMeta - total)} para a meta do dia` }
  if (devido && total < devido.ml) return { tipo: "atrasado", texto: `Faltam ${litros(devido.ml - total)} para o marco das ${devido.hora}h (${litros(devido.ml)})` }
  const proximo = marcos.find((m) => m.hora > hora && m.ml > total)
  if (!proximo) return { tipo: "falta", texto: `Faltam ${litros(config.aguaMeta - total)} para a meta do dia` }
  const ate = proximo.ml >= config.aguaMeta ? "até dormir" : `até ${proximo.hora}h`
  return { tipo: "em-dia", texto: `Em dia. Próximo marco: ${litros(proximo.ml)} ${ate}` }
}

/** Hash de 128 bits (cyrb128) para montar um id fixo por dia. */
function cyrb128(str: string): number[] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

/**
 * O registro de um dia tem sempre o mesmo id: marcar no celular e no computador (ou tocar
 * duas vezes rápido) grava no mesmo item, sem criar um dia repetido.
 */
export function idDoDia(colecaoId: string, data: string): string {
  const h = cyrb128(`diario-alimentar|${colecaoId}|${data}`)
    .map((n) => n.toString(16).padStart(8, "0"))
    .join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/* ------------------------------------------------------------------ */
/* Receitas                                                            */
/* ------------------------------------------------------------------ */

/** Linha que abre uma parte da receita: título, negrito no começo ou texto terminando em ":". */
const ehCabecalho = (l: string) => /^\s*(#{1,6}\s|[-*+]\s+\*\*|\*\*)/.test(l) || /:\s*\**\s*$/.test(l)
const FIM_INGREDIENTES = /(modo de preparo|preparo|benef[ií]cios|dicas?\b|como fazer|rendimento|observa)/i

/** Os ingredientes listados depois de "Ingredientes", até o preparo. */
export function ingredientesDaReceita(md: string | null | undefined): string[] {
  const saida: string[] = []
  let dentro = false
  for (const l of (md ?? "").split("\n")) {
    const limpo = limparMarkdown(l)
    if (ehCabecalho(l) && /ingredientes/i.test(limpo)) {
      dentro = true
      continue
    }
    if (dentro && ehCabecalho(l) && FIM_INGREDIENTES.test(limpo)) break
    if (!dentro) continue
    const m = l.match(/^\s*(?:[-*+•]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/)
    if (m && limparMarkdown(m[1])) saida.push(limparMarkdown(m[1]))
  }
  return saida
}

const UNIDADE =
  "(?:g|kg|mg|ml|l|litros?|x[ií]caras?(?:\\s+de\\s+ch[áa])?|colher(?:es)?(?:\\s+de\\s+(?:sopa|ch[áa]|sobremesa))?(?:\\s+(?:cheias?|rasas?))?|copos?|latas?|dentes?|unidades?|fatias?|pitadas?|punhados?|conchas?|scoops?|pacotes?|potes?|ramos?|folhas?|pedaços?)"
// Depois da unidade vem espaço ou pontuação (o \\b do JavaScript não entende "chá", com acento)
const QUANTIDADE = new RegExp(`^\\s*(?:[\\d½¼¾⅓⅔]+(?:[.,/]\\d+)?\\s*)+(?:${UNIDADE}(?=[\\s.,;:)]|$)\\.?\\s*)?(?:de\\s+)?`, "i")

/** "1 ½ xícara de leite (ou leite vegetal)" vira "leite". */
export function nomeDoIngrediente(t: string): string {
  const nome = t.replace(/\([^)]*\)/g, " ").replace(QUANTIDADE, "").replace(/\s+/g, " ").replace(/[.;,]\s*$/, "").trim()
  return nome ? nome[0].toLocaleLowerCase("pt-BR") + nome.slice(1) : t
}

/** O texto da receita com os ingredientes viradas caixinhas, para ir marcando ao cozinhar. */
export function receitaParaCozinhar(md: string): string {
  let dentro = false
  return md
    .split("\n")
    .map((l) => {
      const limpo = limparMarkdown(l)
      if (ehCabecalho(l) && /ingredientes/i.test(limpo)) {
        dentro = true
        return l
      }
      if (dentro && ehCabecalho(l) && FIM_INGREDIENTES.test(limpo)) dentro = false
      if (!dentro) return l
      const m = l.match(/^(\s*)(?:[-*+•]|\d+[.)])\s+(?!\[[ xX]\])(.*)$/)
      return m ? `${m[1]}- [ ] ${m[2]}` : l
    })
    .join("\n")
}

export const MODELO_RECEITA = "**Ingredientes:**\n- \n\n**Modo de preparo:**\n1. "
