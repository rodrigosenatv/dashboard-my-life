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

export type CamposConfiguracoes = {
  display_name?: string | null
  /**
   * Só o que mudou: é juntado ao que está gravado, para uma tela não apagar a preferência de outra. Como função,
   * recebe as preferências lidas do banco na hora (para mudar uma parte de uma preferência sem apagar o resto).
   */
  prefs?: Preferencias | ((gravadas: Preferencias) => Preferencias)
}

/** Grava as configurações (sem aviso nem atualização das telas: veja `useSalvarConfiguracoes`). */
export async function gravarConfiguracoes(campos: CamposConfiguracoes) {
  const sb = supabase()
  const { prefs, ...resto } = campos
  let envio: Record<string, unknown> = resto
  if (prefs) {
    const { data: atual, error } = await sb.from("settings").select("prefs").maybeSingle()
    if (error) throw new Error(error.message)
    const gravadas = (atual?.prefs ?? {}) as Preferencias
    envio = { ...resto, prefs: { ...gravadas, ...(typeof prefs === "function" ? prefs(gravadas) : prefs) } }
  }
  const { data, error } = await sb
    .from("settings")
    .upsert(envio as never, { onConflict: "user_id" })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export function useSalvarConfiguracoes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: gravarConfiguracoes,
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
