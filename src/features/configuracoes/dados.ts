"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
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
    /** `prefs` recebe só o que mudou: é juntado ao que está gravado, para uma tela não apagar a preferência de outra. */
    mutationFn: async (campos: { display_name?: string | null; prefs?: Preferencias }) => {
      const sb = supabase()
      let envio = campos
      if (campos.prefs) {
        const { data: atual, error } = await sb.from("settings").select("prefs").maybeSingle()
        if (error) throw new Error(error.message)
        envio = { ...campos, prefs: { ...((atual?.prefs ?? {}) as Preferencias), ...campos.prefs } }
      }
      const { data, error } = await sb
        .from("settings")
        .upsert(envio as never, { onConflict: "user_id" })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
    onError: (erro) => toast.error("Não foi possível salvar.", { description: erro instanceof Error ? erro.message : undefined }),
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
