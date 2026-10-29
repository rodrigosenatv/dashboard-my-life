import { NextResponse, type NextRequest } from "next/server"
import { supabaseServidor } from "@/lib/supabase/server"
import { rankingGratuito } from "@/lib/ia/openrouter"

/**
 * Ordem atual dos modelos gratuitos do OpenRouter (do mais avançado ao mais simples),
 * para a tela de Configurações. A lista é pública; não usa nem recebe chave.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ erro: "Origem não autorizada." }, { status: 403 })
  const supabase = await supabaseServidor()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return NextResponse.json({ erro: "Entre no app." }, { status: 401 })
  const ranking = await rankingGratuito()
  if (!ranking.length) return NextResponse.json({ erro: "Não foi possível consultar o OpenRouter agora." }, { status: 502 })
  return NextResponse.json({ modelos: ranking.slice(0, 15) }, { headers: { "Cache-Control": "private, max-age=300" } })
}
