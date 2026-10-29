import "server-only"

import { ErroIA, eventosSSE, pausadoAte, pausar, resumoDaChave } from "./comum"
import { decidirAposFalhaGemini, lerEspera, ordenarGemini, type ModeloGemini, type ModeloGoogle } from "./gemini-logica"
import { MAXIMO_DE_TENTATIVAS, escolherTentativas, filaDeModelos, usaAutomatico } from "./openrouter-logica"

type Mensagem = { role: "user" | "assistant"; content: string }

const BASE = "https://generativelanguage.googleapis.com/v1beta"
const VALIDADE_DA_LISTA = 30 * 60_000

/* ---------- Modelos liberados para a chave (a lista do Google exige chave) ---------- */

const listas = new Map<string, { quando: number; ranking: ModeloGemini[] }>()

async function buscarRanking(chave: string): Promise<ModeloGemini[]> {
  const todos: ModeloGoogle[] = []
  let pagina = ""
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`${BASE}/models?pageSize=1000${pagina ? `&pageToken=${encodeURIComponent(pagina)}` : ""}`, {
      headers: { "x-goog-api-key": chave },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    })
    if (!r.ok) throw await erroGemini(r)
    const corpo = (await r.json()) as { models?: ModeloGoogle[]; nextPageToken?: string }
    todos.push(...(corpo.models ?? []))
    if (!corpo.nextPageToken) break
    pagina = corpo.nextPageToken
  }
  return ordenarGemini(todos)
}

/** Modelos de conversa do Gemini, do melhor ao mais simples. Se a busca falhar, usa a última lista desta chave. */
export async function rankingGemini(chave: string): Promise<ModeloGemini[]> {
  const conta = resumoDaChave(chave)
  const guardada = listas.get(conta)
  if (guardada && Date.now() - guardada.quando < VALIDADE_DA_LISTA) return guardada.ranking
  try {
    const ranking = await buscarRanking(chave)
    if (ranking.length) {
      if (listas.size > 500) listas.clear()
      listas.set(conta, { quando: Date.now(), ranking })
    }
    return ranking.length ? ranking : (guardada?.ranking ?? [])
  } catch (e) {
    if (guardada) return guardada.ranking
    throw e
  }
}

/* ---------- Erros do Google: mensagem, cotas estouradas e tempo de espera ---------- */

type ErroComDetalhes = ErroIA & { cotas?: string[]; esperaMs?: number }

async function erroGemini(r: Response): Promise<ErroComDetalhes> {
  let msg = ""
  const cotas: string[] = []
  let esperaMs: number | undefined
  try {
    const corpo = await r.json()
    msg = corpo?.error?.message ?? ""
    for (const d of corpo?.error?.details ?? []) {
      for (const v of d?.violations ?? []) if (typeof v?.quotaId === "string") cotas.push(v.quotaId)
      if (typeof d?.retryDelay === "string") esperaMs = lerEspera(d.retryDelay)
    }
  } catch {}
  return Object.assign(new ErroIA(msg || `erro ${r.status}`, r.status), { cotas, esperaMs })
}

/**
 * Responde com o melhor modelo disponível. Quando um modelo falha antes do primeiro
 * texto (limite do minuto ou do dia, fora do nível gratuito, fora do ar), passa para
 * o próximo. Depois que o texto começou, não troca.
 */
export async function* responderGemini(
  chave: string,
  modelo: string,
  sistema: string,
  mensagens: Mensagem[],
  maxTokens: number,
  sinal?: AbortSignal,
  aoEscolher?: (modelo: string) => void,
): AsyncGenerator<string> {
  const conta = resumoDaChave(chave)
  let ranking: string[] = []
  if (usaAutomatico(modelo)) {
    try {
      ranking = (await rankingGemini(chave)).map((m) => m.id)
    } catch (e) {
      // Sem a lista (ex.: chave inválida), o erro já diz o que fazer
      if (e instanceof ErroIA && (e.status === 400 || e.status === 401 || e.status === 403)) throw Object.assign(e, { codigo: "chave-invalida" })
    }
    // Lista indisponível: um modelo conhecido evita ficar sem resposta
    if (!ranking.length) ranking = ["gemini-2.5-flash"]
  }
  const tentativas = escolherTentativas(filaDeModelos(modelo, ranking, null), (id) => pausadoAte(conta, id), Date.now(), MAXIMO_DE_TENTATIVAS)
  let ultimo: ErroIA | null = null
  let soLimites = true

  for (const id of tentativas) {
    if (sinal?.aborted) return
    let emitiu = false
    try {
      const r = await fetch(`${BASE}/models/${encodeURIComponent(id)}:streamGenerateContent?alt=sse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sistema }] },
          contents: mensagens.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          // Modelos que "pensam" antes de responder precisam de folga, mesmo no teste
          generationConfig: { maxOutputTokens: Math.max(maxTokens, 512) },
        }),
        signal: sinal,
      })
      if (!r.ok || !r.body) throw await erroGemini(r)
      let bloqueio = ""
      for await (const ev of eventosSSE(r)) {
        const e = ev as {
          error?: { code?: number; message?: string }
          promptFeedback?: { blockReason?: string }
          candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[]
        }
        if (e.error) throw new ErroIA(e.error.message ?? "erro no meio da resposta", typeof e.error.code === "number" ? e.error.code : undefined)
        if (e.promptFeedback?.blockReason) bloqueio = e.promptFeedback.blockReason
        const c = e.candidates?.[0]
        if (c?.finishReason && /SAFETY|PROHIBITED|BLOCKLIST|SPII|RECITATION/.test(c.finishReason)) bloqueio = c.finishReason
        const texto = (c?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("")
        if (!texto) continue
        if (!emitiu) {
          emitiu = true
          aoEscolher?.(id)
        }
        yield texto
      }
      if (emitiu) return
      // Bloqueio por segurança vale para o pedido, não para o modelo: trocar não adianta
      if (bloqueio) throw new ErroIA(`resposta bloqueada (${bloqueio})`, 400, "bloqueado")
      throw new ErroIA("o modelo não devolveu texto", 204)
    } catch (e) {
      if (sinal?.aborted) return
      const erro = (e instanceof ErroIA ? e : new ErroIA(e instanceof Error ? e.message : String(e))) as ErroComDetalhes
      if (emitiu || erro.codigo === "bloqueado") throw erro
      const decisao = decidirAposFalhaGemini({ status: erro.status, mensagem: erro.message, cotas: erro.cotas, esperaMs: erro.esperaMs })
      if (decisao.acao === "parar") throw Object.assign(erro, { codigo: decisao.codigo })
      if (!decisao.limite) soLimites = false
      pausar(conta, id, decisao.pausaMs)
      ultimo = erro
    }
  }
  throw new ErroIA(ultimo?.message ?? "nenhum modelo disponível", ultimo?.status ?? 503, soLimites && ultimo ? "limites-esgotados" : "todos-falharam")
}
