import { NextResponse, type NextRequest } from "next/server"
import { supabaseServidor } from "@/lib/supabase/server"
import { mesmaOrigem } from "@/lib/seguranca/origem"
import { explicarErro } from "@/lib/ia/servidor"
import { rankingGemini } from "@/lib/ia/gemini"
import { rankingGratuito } from "@/lib/ia/openrouter"

/**
 * Ordem em que o modo automático vai tentar os modelos, para a tela de Configurações.
 * OpenRouter: lista pública, sem chave. Gemini: a lista do Google exige a chave da
 * pessoa, que vem do navegador e é usada só neste pedido.
 */
export async function POST(request: NextRequest) {
  if (!mesmaOrigem(request.headers.get("origin"), request.url) || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ erro: "Origem não autorizada." }, { status: 403 })
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return NextResponse.json({ erro: "Envie JSON." }, { status: 415 })
  const supabase = await supabaseServidor()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return NextResponse.json({ erro: "Entre no app." }, { status: 401 })

  let provedor = ""
  let chave = ""
  try {
    const corpo = await request.json()
    provedor = String(corpo.provedor ?? "")
    chave = typeof corpo.chave === "string" && corpo.chave.trim().length < 400 ? corpo.chave.trim() : ""
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 })
  }

  try {
    const lista =
      provedor === "openrouter" ? await rankingGratuito()
      : provedor === "gemini" && chave ? await rankingGemini(chave)
      : null
    if (!lista) return NextResponse.json({ erro: "Salve a chave antes de ver a ordem." }, { status: 400 })
    if (!lista.length) return NextResponse.json({ erro: "Não foi possível consultar a lista de modelos agora." }, { status: 502 })
    return NextResponse.json({ modelos: lista.slice(0, 15).map(({ id, nome, contexto }) => ({ id, nome, contexto })) }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ erro: explicarErro(e, provedor === "gemini" ? "Gemini" : "OpenRouter") }, { status: 502 })
  }
}
