import Anthropic from "@anthropic-ai/sdk"
import { NextResponse, type NextRequest } from "next/server"
import { supabaseServidor } from "@/lib/supabase/server"

const MODELO = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5"

type Mensagem = { role: "user" | "assistant"; content: string }

const SISTEMA =
  "Você é o assistente pessoal do app My Life. Responda em português do Brasil, de forma clara e prática. " +
  "Quando receber um prompt da biblioteca do usuário, execute-o como pedido."

/** Disponibilidade do assistente (sem revelar a chave). */
export async function GET() {
  return NextResponse.json({ disponivel: Boolean(process.env.ANTHROPIC_API_KEY), modelo: MODELO })
}

/** Conversa com o Claude. Só para quem está logado. */
export async function POST(request: NextRequest) {
  const supabase = await supabaseServidor()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return NextResponse.json({ erro: "Entre no app para usar o assistente." }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ erro: "O assistente ainda não foi ligado. Adicione ANTHROPIC_API_KEY nas variáveis da Vercel." }, { status: 503 })
  }

  let mensagens: Mensagem[] = []
  try {
    const corpo = await request.json()
    mensagens = (corpo.mensagens ?? [])
      .filter((m: Mensagem) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-30)
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 })
  }
  if (!mensagens.length || mensagens[mensagens.length - 1].role !== "user") {
    return NextResponse.json({ erro: "Envie uma mensagem." }, { status: 400 })
  }

  const cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const codificador = new TextEncoder()

  const fluxo = new ReadableStream<Uint8Array>({
    async start(controle) {
      try {
        const stream = cliente.messages.stream({
          model: MODELO,
          max_tokens: 4096,
          system: SISTEMA,
          messages: mensagens,
        })
        for await (const evento of stream) {
          if (evento.type === "content_block_delta" && evento.delta.type === "text_delta") {
            controle.enqueue(codificador.encode(evento.delta.text))
          }
        }
      } catch (erro) {
        const msg = erro instanceof Error ? erro.message : "erro desconhecido"
        controle.enqueue(codificador.encode(`\n\n[Não foi possível concluir a resposta: ${msg}]`))
      } finally {
        controle.close()
      }
    },
  })

  return new Response(fluxo, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } })
}
