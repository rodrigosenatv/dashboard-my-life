import { NextResponse, type NextRequest } from "next/server"
import { supabaseServidor } from "@/lib/supabase/server"

/** Recebe o link de confirmação de e-mail e abre a sessão. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const destino = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await supabaseServidor()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(destino.startsWith("/") ? destino : "/", origin))
    }
  }

  return NextResponse.redirect(new URL("/login?erro=link", origin))
}
