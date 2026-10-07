import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigurado } from "@/lib/supabase/env"

const ROTAS_PUBLICAS = ["/login", "/auth", "/configurar"]

/**
 * Renova a sessão do Supabase a cada navegação e manda para o login
 * quem ainda não entrou. A segurança dos dados fica no banco (RLS);
 * aqui é só um atalho de navegação.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const publica = ROTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  if (!supabaseConfigurado) {
    if (publica) return NextResponse.next()
    const url = request.nextUrl.clone()
    url.pathname = "/configurar"
    return NextResponse.redirect(url)
  }

  let resposta = NextResponse.next({ request })
  let gravouCookies = false

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        gravouCookies = true
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        resposta = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          resposta.cookies.set(name, value, options)
        }
        for (const [chave, valor] of Object.entries(headers ?? {})) {
          resposta.headers.set(chave, valor)
        }
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const logado = Boolean(data?.claims)

  if (!logado && !publica) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = pathname === "/" ? "" : `?voltar=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }

  if (logado && pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return NextResponse.redirect(url)
  }

  if (gravouCookies) resposta.headers.set("Cache-Control", "private, no-store")
  return resposta
}

export const config = {
  matcher: [
    // Tudo, menos arquivos estáticos, imagens, ícones e a rota de IA (que valida a sessão sozinha).
    "/((?!_next/static|_next/image|api/|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
}
