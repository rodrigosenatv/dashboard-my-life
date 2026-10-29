import "server-only"

import { createHash } from "node:crypto"
import { ErroIA, eventosSSE } from "./comum"
import { decidirAposFalha, escolherTentativas, filaDeModelos, ordenarGratuitos, usaAutomatico, type ModeloGratuito, type ModeloOR } from "./openrouter-logica"

type Mensagem = { role: "user" | "assistant"; content: string }

const BASE = "https://openrouter.ai/api/v1"
const VALIDADE_DA_LISTA = 30 * 60_000

/* ---------- Lista de modelos gratuitos (pública, guardada por 30 min) ---------- */

let lista: { quando: number; ranking: ModeloGratuito[] } | null = null
let buscando: Promise<ModeloGratuito[]> | null = null

async function buscarRanking(): Promise<ModeloGratuito[]> {
  const r = await fetch(`${BASE}/models`, { signal: AbortSignal.timeout(8000), cache: "no-store" })
  if (!r.ok) throw new Error(`lista de modelos: erro ${r.status}`)
  const corpo = (await r.json()) as { data?: ModeloOR[] }
  const ranking = ordenarGratuitos(Array.isArray(corpo.data) ? corpo.data : [])
  if (!ranking.length) throw new Error("lista de modelos vazia")
  lista = { quando: Date.now(), ranking }
  return ranking
}

/** Gratuitos do mais avançado ao mais simples. Se a busca falhar, usa a última lista conhecida. */
export async function rankingGratuito(): Promise<ModeloGratuito[]> {
  if (lista && Date.now() - lista.quando < VALIDADE_DA_LISTA) return lista.ranking
  buscando ??= buscarRanking().finally(() => (buscando = null))
  try {
    return await buscando
  } catch {
    return lista?.ranking ?? []
  }
}

/* ---------- Pausas: modelo que falhou fica de fora por um tempo ---------- */

// Por chave (a cota é de cada conta). Guarda só um resumo da chave, nunca a chave.
const pausas = new Map<string, number>()
const dono = (chave: string) => createHash("sha256").update(chave).digest("hex").slice(0, 16)

function pausar(conta: string, modelo: string, ms: number) {
  if (ms <= 0) return
  if (pausas.size > 2000) for (const [k, ate] of pausas) if (ate <= Date.now()) pausas.delete(k)
  pausas.set(`${conta}|${modelo}`, Date.now() + ms)
}

function esperaSugerida(r: Response): number | undefined {
  const v = r.headers.get("retry-after")
  if (!v) return undefined
  const s = Number(v)
  if (Number.isFinite(s)) return s * 1000
  const data = Date.parse(v)
  return Number.isFinite(data) ? data - Date.now() : undefined
}

async function erroDaResposta(r: Response): Promise<ErroIA & { esperaMs?: number }> {
  let msg = ""
  try {
    const corpo = await r.json()
    msg = corpo?.error?.message ?? corpo?.message ?? ""
    const bruto = corpo?.error?.metadata?.raw
    if (typeof bruto === "string") msg += ` ${bruto}`
  } catch {}
  return Object.assign(new ErroIA(msg.trim() || `erro ${r.status}`, r.status), { esperaMs: esperaSugerida(r) })
}

/**
 * Responde com o melhor modelo disponível da fila. Quando um modelo falha antes
 * de mandar o primeiro texto (limite, fora do ar, deixou de ser gratuito), passa
 * para o próximo sem a pessoa perceber. Depois que o texto começou, não troca.
 */
export async function* responderOpenRouter(
  chave: string,
  modelo: string,
  sistema: string,
  mensagens: Mensagem[],
  maxTokens: number,
  sinal?: AbortSignal,
  aoEscolher?: (modelo: string) => void,
): AsyncGenerator<string> {
  const conta = dono(chave)
  const ranking = usaAutomatico(modelo) ? (await rankingGratuito()).map((m) => m.id) : []
  const tentativas = escolherTentativas(filaDeModelos(modelo, ranking), (id) => pausas.get(`${conta}|${id}`) ?? 0, Date.now())
  let ultimo: ErroIA | null = null

  for (const id of tentativas) {
    if (sinal?.aborted) return
    let emitiu = false
    try {
      const r = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${chave}`,
          "HTTP-Referer": "https://dashboard-my-life.vercel.app",
          "X-Title": "My Life",
        },
        body: JSON.stringify({
          model: id,
          stream: true,
          // Modelos que "pensam" antes de responder precisam de folga, mesmo no teste
          max_tokens: Math.max(maxTokens, 512),
          messages: [{ role: "system", content: sistema }, ...mensagens],
        }),
        signal: sinal,
      })
      if (!r.ok || !r.body) throw await erroDaResposta(r)
      for await (const ev of eventosSSE(r)) {
        const e = ev as { error?: { code?: number; message?: string }; choices?: { delta?: { content?: string } }[] }
        if (e.error) throw new ErroIA(e.error.message ?? "erro no meio da resposta", typeof e.error.code === "number" ? e.error.code : undefined)
        const texto = e.choices?.[0]?.delta?.content
        if (!texto) continue
        if (!emitiu) {
          emitiu = true
          aoEscolher?.(id)
        }
        yield texto
      }
      if (emitiu) return
      throw new ErroIA("o modelo não devolveu texto", 204)
    } catch (e) {
      if (sinal?.aborted) return
      const erro = e instanceof ErroIA ? e : new ErroIA(e instanceof Error ? e.message : String(e))
      if (emitiu) throw erro
      const decisao = decidirAposFalha(erro.status, erro.message, (erro as { esperaMs?: number }).esperaMs)
      if (decisao.acao === "parar") throw Object.assign(erro, { codigo: decisao.codigo })
      pausar(conta, id, decisao.pausaMs)
      ultimo = erro
    }
  }
  throw new ErroIA(ultimo?.message ?? "nenhum modelo gratuito disponível", ultimo?.status ?? 503, "todos-falharam")
}
