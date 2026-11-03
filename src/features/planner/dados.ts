"use client"

import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { toast } from "sonner"
import { useConfiguracoes, useSalvarConfiguracoes } from "@/features/configuracoes/dados"
import { camposAoPublicar, META_SEMANAL_PADRAO, proximaEtapa, roteiroReaproveitado } from "@/features/conteudo/logica"
import { buscarRegistro, chaveRegistro, novoId, useAtualizar, useCriar } from "@/lib/data"
import { STATUS_CONTEUDO, type StatusConteudo } from "@/lib/rotulos"
import type { Json, TablesUpdate } from "@/lib/supabase/database.types"
import { DICA_AO_PUBLICAR, type Conteudo } from "./ui"

/* ------------------------------------------------------------------ */
/* A meta da semana (settings.prefs.planner.metaSemanal)               */
/* ------------------------------------------------------------------ */

type PrefsPlanner = { metaSemanal?: number }

export const OPCOES_META = [1, 2, 3, 4, 5, 6, 7, 10, 14] as const

export function useMetaSemanal() {
  const { data } = useConfiguracoes()
  const salvar = useSalvarConfiguracoes()
  // A tela muda na hora; a gravação segue em segundo plano
  const [escolhida, setEscolhida] = React.useState<number | null>(null)
  const planner = (((data?.prefs ?? {}) as Record<string, Json>).planner ?? {}) as PrefsPlanner
  const gravada = Math.round(Number(planner.metaSemanal)) || META_SEMANAL_PADRAO
  const meta = Math.max(1, Math.min(21, escolhida ?? gravada))
  const mudar = (n: number) => {
    setEscolhida(n)
    salvar.mutate({ prefs: { planner: { ...planner, metaSemanal: n } as unknown as Json } })
  }
  return { meta, mudar }
}

/* ------------------------------------------------------------------ */
/* Mover na esteira, sempre com "Desfazer"                             */
/* ------------------------------------------------------------------ */

type Campos = Pick<TablesUpdate<"content_items">, "status" | "publish_date">

/** Muda a etapa (ou a data) de um conteúdo e avisa, com "Desfazer" para voltar ao que era. */
export function useMoverConteudo() {
  const atualizar = useAtualizar("content_items")
  return React.useCallback(
    (item: Conteudo, campos: Campos, aviso: string, descricao?: string) => {
      const antes: Campos = {}
      for (const k of Object.keys(campos) as (keyof Campos)[]) (antes as Record<string, unknown>)[k] = item[k]
      atualizar.mutate({ id: item.id, ...campos })
      toast(aviso, {
        description: descricao,
        action: { label: "Desfazer", onClick: () => atualizar.mutate({ id: item.id, ...antes }) },
      })
    },
    // `mutate` é estável entre renderizações
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [atualizar.mutate],
  )
}

/** Avançar uma etapa (ou ir direto para uma) e marcar como publicado, com a data certa. */
export function useEsteira(hoje: string) {
  const mover = useMoverConteudo()
  const publicar = React.useCallback(
    (item: Conteudo) => mover(item, camposAoPublicar(item, hoje), "Marcado como publicado", DICA_AO_PUBLICAR),
    [mover, hoje],
  )
  const levar = React.useCallback(
    (item: Conteudo, destino: StatusConteudo) => {
      if (destino === item.status) return
      if (destino === "publicado") return publicar(item)
      mover(item, { status: destino }, `Foi para ${STATUS_CONTEUDO[destino]}`, item.title)
    },
    [mover, publicar],
  )
  const avancar = React.useCallback(
    (item: Conteudo) => {
      const proxima = proximaEtapa(item.status, item.format)
      if (proxima) levar(item, proxima)
    },
    [levar],
  )
  return { avancar, levar, publicar, mover }
}

/* ------------------------------------------------------------------ */
/* Nova versão em outro formato                                        */
/* ------------------------------------------------------------------ */

/**
 * Cria uma nova versão de um conteúdo em outro formato, em Idealizando: mesmo assunto, linha editorial e
 * plataformas, o post original como referência e, no roteiro, o que adaptar e o material do original.
 * Devolve o id da nova versão (ou null, se não deu para buscar o roteiro).
 */
export function useReaproveitar() {
  const qc = useQueryClient()
  const criar = useCriar("content_items")
  return async (item: Conteudo, formato: string, roteiro?: string | null): Promise<string | null> => {
    let script = roteiro
    if (script === undefined) {
      try {
        const completo = await qc.fetchQuery({ queryKey: chaveRegistro("content_items", item.id), queryFn: ({ signal }) => buscarRegistro("content_items", item.id, signal) })
        script = completo?.script ?? null
      } catch {
        toast.error("Não foi possível criar a nova versão.", { description: "Verifique sua conexão e tente novamente." })
        return null
      }
    }
    const id = novoId()
    criar.mutate({
      id,
      title: item.title,
      status: "idealizando",
      format: formato,
      editorial_line_id: item.editorial_line_id,
      platforms: item.platforms,
      reference_url: item.published_url ?? item.reference_url,
      script: roteiroReaproveitado({ title: item.title, format: item.format, publish_date: item.status === "publicado" ? item.publish_date : null, script }, formato),
      position: Date.now(),
    })
    return id
  }
}
