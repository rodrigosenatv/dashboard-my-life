import { NextResponse, type NextRequest } from "next/server"
import { supabaseServidor } from "@/lib/supabase/server"
import { lerOembed } from "@/lib/youtube"

/** Título e canal de um vídeo do YouTube (oEmbed), para a playlist do Flow. Só para quem entrou no app. */
export async function GET(request: NextRequest) {
  const supabase = await supabaseServidor()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return NextResponse.json({ erro: "Entre no app." }, { status: 401 })

  const id = request.nextUrl.searchParams.get("id") ?? ""
  if (!/^[\w-]{11}$/.test(id)) return NextResponse.json({ erro: "Vídeo inválido." }, { status: 400 })

  try {
    const resposta = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) },
    )
    // Vídeo apagado, privado ou sem permissão de incorporar: guardar o título não faz sentido, então não tenta de novo logo
    if (resposta.status === 401 || resposta.status === 403 || resposta.status === 404) {
      return NextResponse.json({ erro: "Vídeo indisponível." }, { status: 404, headers: { "cache-control": "private, max-age=86400" } })
    }
    if (!resposta.ok) return NextResponse.json({ erro: "O YouTube não respondeu." }, { status: 502 })
    const info = lerOembed(await resposta.json())
    if (!info) return NextResponse.json({ erro: "O YouTube não respondeu." }, { status: 502 })
    return NextResponse.json({ titulo: info.titulo, canal: info.canal }, { headers: { "cache-control": "private, max-age=604800" } })
  } catch {
    return NextResponse.json({ erro: "O YouTube não respondeu." }, { status: 502 })
  }
}
