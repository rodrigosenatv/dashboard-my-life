"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import type { Json } from "@/lib/supabase/database.types"
import { useSessao } from "@/components/provedores"

export type Preferencias = {
  ordemHabitos?: string[]
  [chave: string]: Json | undefined
}

export function useConfiguracoes() {
  const { usuario } = useSessao()
  return useQuery({
    queryKey: ["settings", usuario?.id],
    enabled: Boolean(usuario?.id),
    queryFn: async () => {
      const { data, error } = await supabase().from("settings").select("*").maybeSingle()
      if (error) throw new Error(error.message)
      return data
    },
  })
}

export function useSalvarConfiguracoes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (campos: { display_name?: string | null; prefs?: Preferencias }) => {
      const { data, error } = await supabase()
        .from("settings")
        .upsert(campos as never, { onConflict: "user_id" })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  })
}

/** Nome para a saudação: o que a pessoa escolheu ou a parte antes do @. */
export function useNomeExibicao(): string {
  const { usuario } = useSessao()
  const { data } = useConfiguracoes()
  if (data?.display_name) return data.display_name
  const base = (usuario?.email ?? "").split("@")[0].split(/[._-]/)[0]
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : ""
}
