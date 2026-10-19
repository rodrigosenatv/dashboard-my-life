import { NextResponse, type NextRequest } from "next/server"
import { supabaseServidor } from "@/lib/supabase/server"
import { abrirLinkCurto, ehLinkCurto } from "@/lib/link-curto"

/** Abre um link curto do TikTok (vm.tiktok.com/…) e devolve o endereço do vídeo. Só para quem entrou no app. */
export async function GET(request: NextRequest) {
  const supabase = await supabaseServidor()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return NextResponse.json({ erro: "Entre no app para adicionar vídeos." }, { status: 401 })

  const endereco = request.nextUrl.searchParams.get("url") ?? ""
  if (!ehLinkCurto(endereco)) return NextResponse.json({ erro: "Esse link não é um link curto do TikTok." }, { status: 400 })
  try {
    const url = await abrirLinkCurto(endereco)
    if (!url) return NextResponse.json({ erro: "Esse link não leva a um vídeo do TikTok." }, { status: 422 })
    return NextResponse.json({ url }, { headers: { "cache-control": "private, max-age=3600" } })
  } catch {
    return NextResponse.json({ erro: "O TikTok não respondeu. Tente de novo em instantes." }, { status: 502 })
  }
}
