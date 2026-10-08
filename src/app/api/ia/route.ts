import { NextResponse, type NextRequest } from "next/server"
import { supabaseServidor } from "@/lib/supabase/server"
import { infoProvedor, type Provedor } from "@/lib/ia/info"
import { chaveDaVercel, explicarErro, responder, type Chave, type Mensagem } from "@/lib/ia/servidor"

const SISTEMA =
  "Você é o assistente pessoal do app My Life. Responda em português do Brasil, de forma clara e prática. " +
  "Quando receber um prompt da biblioteca do usuário, execute-o como pedido."

/** Se há uma chave do Claude configurada na Vercel (sem revelar a chave). */
export async function GET() {
  return NextResponse.json({ vercel: Boolean(process.env.ANTHROPIC_API_KEY) })
}

/**
 * Conversa com a IA escolhida. A chave vem do navegador (guardada só nele) e é
 * usada apenas neste pedido: nada é gravado nem registrado no servidor.
 */
export async function POST(request: NextRequest) {
  const supabase = await supabaseServidor()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return NextResponse.json({ erro: "Entre no app para usar o assistente." }, { status: 401 })

  let mensagens: Mensagem[] = []
  let provedor: Provedor = "anthropic"
  let credencial: Chave | null = null
  let teste = false
  try {
    const corpo = await request.json()
    teste = corpo.teste === true
    mensagens = teste
      ? [{ role: "user", content: "Responda apenas com a palavra: ok" }]
      : (corpo.mensagens ?? [])
          .filter((m: Mensagem) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
          .slice(-30)
    const info = infoProvedor(String(corpo.provedor ?? "anthropic"))
    if (!info) return NextResponse.json({ erro: "IA desconhecida." }, { status: 400 })
    provedor = info.id
    const chave = typeof corpo.chave === "string" ? corpo.chave.trim() : ""
    if (chave && chave.length < 400) credencial = { chave, modelo: (typeof corpo.modelo === "string" && corpo.modelo.trim()) || info.modeloPadrao }
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 })
  }
  if (!credencial && provedor === "anthropic") credencial = chaveDaVercel()
  const nome = infoProvedor(provedor)!.nome
  if (!credencial) return NextResponse.json({ erro: `Adicione a chave do ${nome} em Configurações.` }, { status: 400 })
  if (!mensagens.length || mensagens[mensagens.length - 1].role !== "user") return NextResponse.json({ erro: "Envie uma mensagem." }, { status: 400 })

  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const sistema = `${SISTEMA} Hoje é ${hoje}.`

  if (teste) {
    try {
      let texto = ""
      for await (const pedaco of responder(provedor, credencial, sistema, mensagens, 30)) texto += pedaco
      return NextResponse.json({ ok: true, resposta: texto.trim().slice(0, 60) })
    } catch (e) {
      return NextResponse.json({ erro: explicarErro(e, nome) }, { status: 200 })
    }
  }

  const codificador = new TextEncoder()
  const fluxo = new ReadableStream<Uint8Array>({
    async start(controle) {
      try {
        for await (const pedaco of responder(provedor, credencial!, sistema, mensagens)) controle.enqueue(codificador.encode(pedaco))
      } catch (e) {
        controle.enqueue(codificador.encode(`\n\n[Não foi possível concluir a resposta: ${explicarErro(e, nome)}]`))
      } finally {
        controle.close()
      }
    },
  })
  return new Response(fluxo, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } })
}
