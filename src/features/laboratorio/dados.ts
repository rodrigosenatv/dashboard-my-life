"use client"

import * as React from "react"
import { toast } from "sonner"
import { novoId, useAtualizar, useCriar, useLista, useRegistro } from "@/lib/data"
import { diaIso, duracaoDe, protocolo, protocoloInicial, somarDias, STATUS_EXP, statusDo, type Experimento, type StatusExp } from "./logica"

export type { Experimento, Insight } from "./logica"

export function useExperimentos() {
  return useLista("experiments", { ordem: [{ coluna: "created_at", asc: false }] })
}

export function useExperimento(id: string) {
  return useRegistro("experiments", id)
}

/** Os registros do Laboratório: o diário dos experimentos e as descobertas. */
export function useInsightsDoLab() {
  return useLista("insights", {
    filtro: (q) => q.eq("source", "laboratorio"),
    chave: ["laboratorio"],
    ordem: [{ coluna: "created_at", asc: false }],
  })
}

/** Tipo do registro de cada dia no diário de um experimento. */
export const OBSERVACAO = "observação"

/** Registra uma observação no diário do experimento (o dia de hoje, por padrão). */
export function useRegistrarDia() {
  const { mutate } = useCriar("insights")
  return React.useCallback(
    (exp: Pick<Experimento, "id">, texto: string, dia = diaIso()) => {
      const t = texto.trim()
      if (!t) return false
      mutate({ id: novoId(), text: t, source: "laboratorio", experiment_id: exp.id, kind: OBSERVACAO, noted_on: dia })
      return true
    },
    [mutate],
  )
}

/**
 * As mudanças de situação do experimento, com aviso e "Desfazer": começar (hoje, com a duração
 * escolhida ou a de antes), pausar, retomar, abandonar e estender o prazo.
 */
export function useAcoesDoExperimento() {
  const { mutate } = useAtualizar("experiments")
  const criar = useCriar("experiments")

  const aplicar = React.useCallback(
    (e: Experimento, campos: Partial<Pick<Experimento, "status" | "starts_on" | "ends_on" | "result">>, texto: string) => {
      const antes = { status: e.status, starts_on: e.starts_on, ends_on: e.ends_on, result: e.result }
      mutate({ id: e.id, ...campos })
      toast.success(texto, { action: { label: "Desfazer", onClick: () => mutate({ id: e.id, ...antes }) } })
    },
    [mutate],
  )

  return {
    comecar(e: Experimento, dias?: number | null) {
      const hoje = diaIso()
      const duracao = dias ?? duracaoDe(e) ?? 7
      aplicar(e, { status: "em_teste", starts_on: hoje, ends_on: duracao ? somarDias(hoje, duracao - 1) : null }, `“${e.name}” começou hoje. Registre cada dia no diário.`)
    },
    mudar(e: Experimento, status: StatusExp) {
      const textos: Partial<Record<StatusExp, string>> = {
        pausado: "Experimento pausado.",
        em_teste: "Experimento retomado.",
        abandonado: "Experimento deixado de lado.",
        a_iniciar: "Experimento de volta para as ideias.",
      }
      aplicar(e, { status }, textos[status] ?? `Agora em ${STATUS_EXP[status].toLowerCase()}.`)
    },
    estender(e: Experimento, dias = 7) {
      const base = e.ends_on && e.ends_on > diaIso() ? e.ends_on : diaIso()
      aplicar(e, { ends_on: somarDias(base, dias), status: statusDo(e) === "pausado" ? "em_teste" : e.status }, `Mais ${dias} dias de teste.`)
    },
    /** Uma nova rodada do mesmo experimento (fica nas ideias para testar). */
    novaRodada(e: Experimento, aoCriar?: (id: string) => void) {
      const id = novoId()
      const p = protocolo(e.notes)
      const rodada = /\((\d+)ª rodada\)$/.exec(e.name)
      const nome = rodada ? e.name.replace(/\(\d+ª rodada\)$/, `(${Number(rodada[1]) + 1}ª rodada)`) : `${e.name} (2ª rodada)`
      criar.mutate(
        {
          id,
          name: nome,
          kind: e.kind,
          status: "a_iniciar",
          result: "indefinido",
          hypothesis: e.hypothesis,
          notes: protocoloInicial({ objetivo: p.objetivo, procedimento: p.procedimento }),
        },
        { onSuccess: () => aoCriar?.(id) },
      )
      toast.success("Nova rodada nas ideias para testar.")
    },
  }
}
