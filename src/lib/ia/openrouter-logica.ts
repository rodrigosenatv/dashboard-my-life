/**
 * Lógica pura do OpenRouter (sem rede): quais modelos são gratuitos, em que ordem
 * tentar e o que fazer quando um deles falha. Fica separada para poder ser testada.
 */

/** Formato (parcial) de cada item de GET https://openrouter.ai/api/v1/models */
export type ModeloOR = {
  id: string
  name?: string
  created?: number
  context_length?: number
  pricing?: { prompt?: string; completion?: string; request?: string }
  architecture?: { input_modalities?: string[]; output_modalities?: string[]; modality?: string }
  supported_parameters?: string[]
  expiration_date?: string | null
}

export type ModeloGratuito = { id: string; nome: string; contexto: number; pontos: number }

/** Valor do campo "Modelo" que liga a escolha automática. */
export const MODELO_AUTOMATICO = "auto"
/** Roteador do próprio OpenRouter que pega qualquer gratuito disponível: última tentativa. */
export const ROTEADOR_GRATUITO = "openrouter/free"
/** Cada tentativa gasta um pedido da cota diária gratuita, então o número é limitado. */
export const MAXIMO_DE_TENTATIVAS = 5

const numero = (v?: string) => (v === undefined || v === "" ? NaN : Number(v))

export function ehGratuito(m: ModeloOR): boolean {
  const p = m.pricing
  if (!p || numero(p.prompt) !== 0 || numero(p.completion) !== 0) return false
  return p.request === undefined || numero(p.request) === 0
}

function geraTexto(m: ModeloOR): boolean {
  const a = m.architecture
  const saida = a?.output_modalities ?? (a?.modality ? [a.modality.split("->").pop() ?? ""] : ["text"])
  const entrada = a?.input_modalities ?? ["text"]
  return saida.some((s) => s.includes("text")) && entrada.includes("text")
}

/** Maior número de parâmetros (em bilhões) citado no nome: "70b" → 70, "8x22b" → 176. */
export function bilhoesDeParametros(texto: string): number {
  let maior = 0
  for (const [, a, b] of texto.toLowerCase().matchAll(/(\d+(?:\.\d+)?)(?:x(\d+(?:\.\d+)?))?b\b/g)) {
    const v = b ? Number(a) * Number(b) : Number(a)
    if (Number.isFinite(v) && v > maior) maior = v
  }
  return maior
}

/**
 * "Mais avançado" estimado com o que a lista pública oferece:
 * 1. preço da versão paga do mesmo modelo (modelo caro costuma ser modelo forte);
 *    sem versão paga, o tamanho do modelo vira uma estimativa de preço;
 * 2. bônus por raciocínio, ferramentas, contexto longo e lançamento recente.
 */
export function pontuar(m: ModeloOR, precoPagoPorToken: number | undefined, agora: number): number {
  const tamanho = bilhoesDeParametros(`${m.id} ${m.name ?? ""}`)
  const porMilhao = precoPagoPorToken && precoPagoPorToken > 0 ? precoPagoPorToken * 1e6 : tamanho > 0 ? tamanho / 100 : 0.3
  let pontos = Math.log10(1 + porMilhao) * 10
  const parametros = m.supported_parameters ?? []
  if (parametros.includes("reasoning")) pontos += 1.5
  if (parametros.includes("tools")) pontos += 0.5
  const contexto = m.context_length ?? 0
  if (contexto > 8192) pontos += Math.min(2, Math.log2(contexto / 8192) * 0.5)
  if (m.created) {
    const meses = (agora / 1000 - m.created) / (30 * 86400)
    pontos += Math.max(0, Math.min(2, 2 - meses / 12))
  }
  return Math.round(pontos * 100) / 100
}

/** Gratuitos que geram texto, do mais avançado para o mais simples. */
export function ordenarGratuitos(lista: ModeloOR[], agora = Date.now()): ModeloGratuito[] {
  const pagos = new Map<string, number>()
  for (const m of lista) if (!ehGratuito(m)) pagos.set(m.id, numero(m.pricing?.completion))
  const criado = new Map(lista.map((m) => [m.id, m.created ?? 0]))
  return lista
    .filter((m) => ehGratuito(m) && geraTexto(m) && !m.id.startsWith("openrouter/"))
    .filter((m) => !m.expiration_date || !(Date.parse(m.expiration_date) <= agora))
    .map((m) => ({
      id: m.id,
      nome: m.name ?? m.id,
      contexto: m.context_length ?? 0,
      pontos: pontuar(m, pagos.get(m.id.replace(/:free$/, "")), agora),
    }))
    .sort((a, b) => b.pontos - a.pontos || (criado.get(b.id) ?? 0) - (criado.get(a.id) ?? 0) || a.id.localeCompare(b.id))
}

/** Lê o campo "Modelo": vazio ou "auto" = automático; ou uma lista em ordem, separada por vírgulas. */
export function lerPreferencia(modelo: string | undefined): string[] {
  const itens = (modelo ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
  return itens.length ? itens : [MODELO_AUTOMATICO]
}

export const usaAutomatico = (modelo: string | undefined) => lerPreferencia(modelo).some((m) => m.toLowerCase() === MODELO_AUTOMATICO)

/**
 * Ordem de tentativa: a lista da pessoa, com "auto" expandido no ranking atual.
 * No OpenRouter, o roteador gratuito fecha a fila; outros provedores passam `null`.
 */
export function filaDeModelos(modelo: string | undefined, ranking: string[], fechamento: string | null = ROTEADOR_GRATUITO): string[] {
  const fila: string[] = []
  for (const item of lerPreferencia(modelo)) {
    if (item.toLowerCase() === MODELO_AUTOMATICO) fila.push(...ranking, ...(fechamento ? [fechamento] : []))
    else fila.push(item)
  }
  return [...new Set(fila)]
}

/** Separa os modelos em pausa; se todos estiverem, tenta os que voltam primeiro. */
export function escolherTentativas(fila: string[], pausadoAte: (id: string) => number, agora: number, limite = MAXIMO_DE_TENTATIVAS): string[] {
  const livres = fila.filter((id) => pausadoAte(id) <= agora)
  const ordem = livres.length ? livres : [...fila].sort((a, b) => pausadoAte(a) - pausadoAte(b))
  return ordem.slice(0, limite)
}

export type Decisao = { acao: "trocar" | "parar"; pausaMs: number; codigo?: "limite-diario" | "politica-dados" | "conta" }

const MINUTO = 60_000

/** Depois de uma falha antes do primeiro texto: tentar o próximo modelo ou desistir. */
export function decidirAposFalha(status: number | undefined, mensagem: string, retryAfterMs?: number): Decisao {
  const msg = mensagem.toLowerCase()
  // Cota diária de gratuitos vale para a conta inteira: trocar de modelo não adianta
  if (status === 429 && /per[- ]day|free-models-per-day|daily/.test(msg)) return { acao: "parar", pausaMs: 0, codigo: "limite-diario" }
  // Configuração de privacidade da conta bloqueia os gratuitos: vale para todos
  if (/data policy|privacy|training/.test(msg) && (status === 404 || status === 400 || status === 403)) return { acao: "parar", pausaMs: 0, codigo: "politica-dados" }
  if (status === 401 || status === 402) return { acao: "parar", pausaMs: 0, codigo: "conta" }
  if (status === 429) return { acao: "trocar", pausaMs: retryAfterMs && retryAfterMs > 0 ? Math.min(retryAfterMs, 60 * MINUTO) : MINUTO }
  // Modelo saiu do ar ou deixou de ser gratuito
  if (status === 404 || /not a valid model|no endpoints|not found|deprecated|no longer/.test(msg)) return { acao: "trocar", pausaMs: 30 * MINUTO }
  if (status === undefined || status === 408 || status >= 500) return { acao: "trocar", pausaMs: 2 * MINUTO }
  return { acao: "trocar", pausaMs: 0 }
}
