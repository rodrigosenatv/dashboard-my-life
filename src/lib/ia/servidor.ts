import "server-only"

import Anthropic from "@anthropic-ai/sdk"
import type { Provedor } from "./info"

export type Mensagem = { role: "user" | "assistant"; content: string }
export type Chave = { chave: string; modelo: string }

export class ErroIA extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message)
  }
}

/** Chave do Claude configurada na Vercel, usada quando o navegador não manda nenhuma. */
export function chaveDaVercel(): Chave | null {
  return process.env.ANTHROPIC_API_KEY ? { chave: process.env.ANTHROPIC_API_KEY, modelo: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5" } : null
}

/** Lê um fluxo SSE e devolve o JSON de cada linha "data:". */
async function* eventosSSE(resposta: Response): AsyncGenerator<unknown> {
  const leitor = resposta.body!.getReader()
  const dec = new TextDecoder()
  let resto = ""
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    resto += dec.decode(value, { stream: true })
    const linhas = resto.split("\n")
    resto = linhas.pop() ?? ""
    for (const l of linhas) {
      const t = l.trim()
      if (!t.startsWith("data:")) continue
      const dado = t.slice(5).trim()
      if (!dado || dado === "[DONE]") continue
      try {
        yield JSON.parse(dado)
      } catch {}
    }
  }
}

async function falhaHttp(r: Response): Promise<never> {
  let detalhe = ""
  try {
    const corpo = await r.json()
    detalhe = corpo?.error?.message ?? corpo?.message ?? ""
  } catch {}
  throw new ErroIA(detalhe || `erro ${r.status}`, r.status)
}

/** Resposta em pedaços de texto, do provedor escolhido. */
export async function* responder(provedor: Provedor, { chave, modelo }: Chave, sistema: string, mensagens: Mensagem[], maxTokens = 4096): AsyncGenerator<string> {
  if (provedor === "anthropic") {
    const cliente = new Anthropic({ apiKey: chave })
    try {
      const stream = cliente.messages.stream({ model: modelo, max_tokens: maxTokens, system: sistema, messages: mensagens })
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text
      }
    } catch (e) {
      throw new ErroIA(e instanceof Error ? e.message : String(e), (e as { status?: number }).status)
    }
    return
  }

  if (provedor === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
      body: JSON.stringify({ model: modelo, stream: true, max_completion_tokens: maxTokens, messages: [{ role: "system", content: sistema }, ...mensagens] }),
    })
    if (!r.ok || !r.body) await falhaHttp(r)
    for await (const ev of eventosSSE(r)) {
      const texto = (ev as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content
      if (texto) yield texto
    }
    return
  }

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sistema }] },
      contents: mensagens.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  })
  if (!r.ok || !r.body) await falhaHttp(r)
  for await (const ev of eventosSSE(r)) {
    const partes = (ev as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]?.content?.parts ?? []
    const texto = partes.map((p) => p.text ?? "").join("")
    if (texto) yield texto
  }
}

/** Mensagem curta e em português para os erros mais comuns. */
export function explicarErro(e: unknown, nome: string): string {
  const status = (e as { status?: number }).status
  if (status === 401 || status === 403) return `a chave do ${nome} não foi aceita. Confira em Configurações se ela foi colada inteira.`
  if (status === 404) return `o modelo escolhido para o ${nome} não existe ou não está liberado para a sua chave. Ajuste o modelo em Configurações.`
  if (status === 429) return `limite de uso do ${nome} atingido ou muitos pedidos seguidos. Confira o saldo da conta ou tente de novo em instantes.`
  if (status === 529 || status === 503 || status === 500) return `o ${nome} está sobrecarregado agora. Tente de novo em instantes.`
  return e instanceof Error ? e.message : "erro desconhecido"
}
