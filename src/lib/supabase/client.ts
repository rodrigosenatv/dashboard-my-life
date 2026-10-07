"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import { SUPABASE_KEY, SUPABASE_URL } from "./env"

export type Supa = SupabaseClient<Database>

let cliente: Supa | null = null

/** Cliente do Supabase para o navegador (uma única instância por aba). */
export function supabase(): Supa {
  if (!cliente) {
    cliente = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY)
  }
  return cliente
}
