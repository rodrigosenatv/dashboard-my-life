import "server-only"

import Anthropic from "@anthropic-ai/sdk"
import type { Provedor } from "./info"
import { ErroIA, eventosSSE, falhaHttp } from "./comum"
import { responderOpenRouter } from "./openrouter"

export { ErroIA }

export type Mensagem = { role: "user" | "assistant"; content: string }
export type Chave = { chave: string; modelo: string }

/**
 * Resposta em pedaços de texto, do provedor escolhido.
 * `sinal` interrompe o pedido ao provedor quando a pessoa cancela ou sai da tela.
 */
export async function* responder(
  provedor: Provedor,
  { chave, modelo }: Chave,
  sistema: string,
  mensagens: Mensagem[],
  maxTokens = 4096,
  sinal?: AbortSignal,
  /** Avisa qual modelo de fato respondeu (no OpenRouter ele pode mudar a cada pedido). */
  aoEscolher?: (modelo: string) => void,
): AsyncGenerator<string> {
  if (provedor === "openrouter") {
    yield* responderOpenRouter(chave, modelo, sistema, mensagens, maxTokens, sinal, aoEscolher)
    return
  }
  aoEscolher?.(modelo)
  if (provedor === "anthropic") {
    const cliente = new Anthropic({ apiKey: chave })
    try {
      const stream = cliente.messages.stream({ model: modelo, max_tokens: maxTokens, system: sistema, messages: mensagens }, { signal: sinal })
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
      signal: sinal,
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
    signal: sinal,
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
  const { status, codigo } = e as { status?: number; codigo?: string }
  if (codigo === "limite-diario") return `o limite diário de pedidos gratuitos do ${nome} acabou. Ele volta amanhã; quem já comprou ao menos 10 dólares em créditos lá tem um limite diário bem maior.`
  if (codigo === "politica-dados") return `a sua conta do ${nome} está bloqueando os modelos gratuitos. Em openrouter.ai/settings/privacy, permita os provedores de modelos gratuitos e tente de novo.`
  if (codigo === "conta" && status === 402) return `a conta do ${nome} está com saldo negativo, e isso bloqueia até os modelos gratuitos. Coloque saldo acima de zero para voltar a usar.`
  if (codigo === "todos-falharam") return `nenhum modelo gratuito do ${nome} respondeu agora (limite por minuto ou modelos fora do ar). Tente de novo em um minuto.`
  if (status === 401 || status === 403) return `a chave do ${nome} não foi aceita. Confira em Configurações se ela foi colada inteira.`
  if (status === 404) return `o modelo escolhido para o ${nome} não existe ou não está liberado para a sua chave. Ajuste o modelo em Configurações.`
  if (status === 429) return `limite de uso do ${nome} atingido ou muitos pedidos seguidos. Confira o saldo da conta ou tente de novo em instantes.`
  if (status === 529 || status === 503 || status === 500) return `o ${nome} está sobrecarregado agora. Tente de novo em instantes.`
  return `não foi possível concluir a solicitação ao ${nome}. Tente novamente em instantes.`
}
