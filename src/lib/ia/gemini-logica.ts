/**
 * Lógica pura do Gemini (sem rede): quais modelos servem para conversar, em que
 * ordem tentar (do melhor para o mais simples) e o que fazer quando um falha.
 * Os limites do Gemini são por modelo: quando um esgota, outro ainda pode responder.
 */

/** Formato (parcial) de cada item de GET /v1beta/models */
export type ModeloGoogle = {
  name: string
  baseModelId?: string
  displayName?: string
  inputTokenLimit?: number
  supportedGenerationMethods?: string[]
}

export type ModeloGemini = { id: string; nome: string; contexto: number; versao: number; nivel: number; canal: number }

// Modelos que não são de conversa em texto (voz, imagem, vídeo, embeddings, robótica…)
const FORA = /(tts|image|imagen|embedding|aqa|live|audio|robotics|computer-use|veo|lyria|omni|learnlm|-latest$)/

/** "gemini-3.1-flash-lite-preview" → versão 3.1, nível 1 (lite), canal 1 (prévia). */
export function lerModeloGemini(id: string): Omit<ModeloGemini, "id" | "nome" | "contexto"> | null {
  const m = /^gemini-(\d+(?:\.\d+)?)-(.+)$/.exec(id)
  if (!m || FORA.test(id)) return null
  const resto = m[2]
  const nivel = /ultra/.test(resto) ? 4 : /pro/.test(resto) ? 3 : /flash-lite|lite/.test(resto) ? 1 : /flash/.test(resto) ? 2 : 0
  const canal = /exp/.test(resto) ? 0 : /preview/.test(resto) ? 1 : 2
  return { versao: Number(m[1]), nivel, canal }
}

/**
 * Do melhor para o mais simples: geração mais nova primeiro; dentro dela, Pro > Flash > Flash-Lite;
 * versão estável antes da prévia. Variantes repetidas (datas, "-001") ficam só uma vez.
 */
export function ordenarGemini(lista: ModeloGoogle[]): ModeloGemini[] {
  const porFamilia = new Map<string, ModeloGemini>()
  for (const m of lista) {
    if (!(m.supportedGenerationMethods ?? []).includes("generateContent")) continue
    const id = (m.baseModelId || m.name).replace(/^models\//, "")
    const info = lerModeloGemini(id)
    if (!info) continue
    const familia = `${info.versao}|${info.nivel}|${info.canal}`
    const atual = porFamilia.get(familia)
    // O nome mais curto é o apelido principal (sem data no fim)
    if (!atual || id.length < atual.id.length) porFamilia.set(familia, { id, nome: m.displayName || id, contexto: m.inputTokenLimit ?? 0, ...info })
  }
  return [...porFamilia.values()].sort((a, b) => b.versao - a.versao || b.nivel - a.nivel || b.canal - a.canal || a.id.localeCompare(b.id))
}

/** Lê "39s" / "1.5s" do RetryInfo. */
export function lerEspera(texto: string | undefined): number | undefined {
  const m = /^(\d+(?:\.\d+)?)s$/.exec(texto ?? "")
  return m ? Math.round(Number(m[1]) * 1000) : undefined
}

/** Milissegundos até a próxima meia-noite no horário do Pacífico, quando a cota diária volta. */
export function ateMeiaNoitePacifico(agora = Date.now()): number {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(agora))
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? 0) % 24
  const passados = (v("hour") * 3600 + v("minute") * 60 + v("second")) * 1000
  return Math.max(60 * 60_000, 24 * 3600_000 - passados)
}

export type FalhaGemini = { status?: number; mensagem: string; cotas?: string[]; esperaMs?: number }
export type DecisaoGemini = { acao: "trocar" | "parar"; pausaMs: number; codigo?: "chave-invalida" | "regiao" | "bloqueado"; limite?: boolean }

const MINUTO = 60_000

/** Depois de uma falha antes do primeiro texto: tentar o próximo modelo ou desistir. */
export function decidirAposFalhaGemini({ status, mensagem, cotas = [], esperaMs }: FalhaGemini, agora = Date.now()): DecisaoGemini {
  const msg = mensagem.toLowerCase()
  if (/api key not valid|api_key_invalid|api key expired/.test(msg) || status === 401) return { acao: "parar", pausaMs: 0, codigo: "chave-invalida" }
  if (/location is not supported|not available in your country/.test(msg)) return { acao: "parar", pausaMs: 0, codigo: "regiao" }
  if (status === 403) return { acao: "parar", pausaMs: 0, codigo: "chave-invalida" }
  if (status === 429) {
    // "limit: 0": este modelo não faz parte do nível gratuito desta chave
    if (/limit: 0\b/.test(msg)) return { acao: "trocar", pausaMs: 12 * 60 * MINUTO, limite: true }
    if (cotas.some((c) => /perday/i.test(c))) return { acao: "trocar", pausaMs: ateMeiaNoitePacifico(agora), limite: true }
    return { acao: "trocar", pausaMs: esperaMs && esperaMs > 0 ? Math.min(esperaMs, 60 * MINUTO) : MINUTO, limite: true }
  }
  if (status === 404 || /not found|is not supported for generatecontent|deprecated/.test(msg)) return { acao: "trocar", pausaMs: 12 * 60 * MINUTO }
  if (status === undefined || status === 408 || status >= 500) return { acao: "trocar", pausaMs: 2 * MINUTO }
  return { acao: "trocar", pausaMs: 0 }
}
