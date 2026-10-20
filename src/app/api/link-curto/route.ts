import { NextResponse, type NextRequest } from "next/server"
import { supabaseServidor } from "@/lib/supabase/server"
import { abrirLinkCurto, siteDoLinkCurto } from "@/lib/link-curto"
import { NOME_DA_FONTE } from "@/lib/videos"

/**
 * Abre um link de compartilhar do TikTok (vm.tiktok.com/…) ou do Facebook (facebook.com/share/r/…,
 * fb.watch/…) e devolve o endereço do vídeo. Só para quem entrou no app.
 */
export async function GET(request: NextRequest) {
  const supabase = await supabaseServidor()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return NextResponse.json({ erro: "Entre no app para adicionar vídeos." }, { status: 401 })

  const endereco = request.nextUrl.searchParams.get("url") ?? ""
  const site = siteDoLinkCurto(endereco)
  if (!site) return NextResponse.json({ erro: "Esse link não é um link de compartilhar do TikTok ou do Facebook." }, { status: 400 })
  try {
    const url = await abrirLinkCurto(endereco)
    if (!url) {
      const erro =
        site === "facebook"
          ? "Não deu para abrir esse link do Facebook. Abra o vídeo no navegador e copie o endereço da barra (facebook.com/reel/…)."
          : "Esse link não leva a um vídeo do TikTok."
      return NextResponse.json({ erro }, { status: 422 })
    }
    return NextResponse.json({ url }, { headers: { "cache-control": "private, max-age=3600" } })
  } catch {
    return NextResponse.json({ erro: `O ${NOME_DA_FONTE[site]} não respondeu. Tente de novo em instantes.` }, { status: 502 })
  }
}
