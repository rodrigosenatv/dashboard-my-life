import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "./database.types"
import { SUPABASE_KEY, SUPABASE_URL } from "./env"

/** Cliente do Supabase para rotas do servidor (lê a sessão dos cookies). */
export async function supabaseServidor() {
  const cookieStore = await cookies()

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Chamado a partir de um contexto somente leitura: o proxy renova a sessão.
        }
      },
    },
  })
}
