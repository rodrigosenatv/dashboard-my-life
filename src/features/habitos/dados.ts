"use client"

import { useQueryClient, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { addDays, getDay } from "date-fns"
import { novoId, useLista } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/database.types"
import { isoDia, lerData } from "@/lib/utils"

export type Habito = Tables<"habits">
export type RegistroHabito = Pick<Tables<"habit_logs">, "id" | "habit_id" | "day">

export function useHabitos() {
  return useLista("habits", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
}

/** Registros de hábitos a partir de uma data (AAAA-MM-DD). */
export function useRegistros(desde: string) {
  return useLista("habit_logs", {
    colunas: "id,habit_id,day",
    filtro: (q) => q.gte("day", desde),
    ordem: [{ coluna: "day" }],
    chave: ["desde", desde],
  }) as { data: RegistroHabito[] | undefined; isLoading: boolean; error: unknown; refetch: () => void }
}

/** Marca ou desmarca um hábito em um dia. */
export function useAlternarHabito() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ habito, dia, registro }: { habito: string; dia: string; registro?: RegistroHabito }) => {
      if (registro) {
        const { error } = await supabase().from("habit_logs").delete().eq("habit_id", habito).eq("day", dia)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase()
          .from("habit_logs")
          .upsert({ id: novoId(), habit_id: habito, day: dia }, { onConflict: "habit_id,day", ignoreDuplicates: true })
        if (error) throw new Error(error.message)
      }
    },
    onMutate: async ({ habito, dia, registro }) => {
      await qc.cancelQueries({ queryKey: ["habit_logs"] })
      const snap = qc.getQueriesData({ queryKey: ["habit_logs"] })
      for (const [chave, dados] of snap) {
        if (!Array.isArray(dados)) continue
        const lista = dados as RegistroHabito[]
        qc.setQueryData(
          chave,
          registro
            ? lista.filter((r) => r.id !== registro.id)
            : [...lista, { id: `tmp-${habito}-${dia}`, habit_id: habito, day: dia }],
        )
      }
      return { snap }
    },
    onError: (erro, _v, ctx) => {
      for (const [chave, dados] of ctx?.snap ?? []) qc.setQueryData(chave, dados)
      toast.error("Não foi possível marcar o hábito.", { description: erro instanceof Error ? erro.message : "" })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["habit_logs"] }),
  })
}

/* ------------------------------------------------------------------ */
/* Cálculos                                                            */
/* ------------------------------------------------------------------ */

export function valeNoDia(h: Pick<Habito, "weekdays">, dia: string): boolean {
  const d = lerData(dia)
  if (!d) return true
  const dias = h.weekdays?.length ? h.weekdays : [0, 1, 2, 3, 4, 5, 6]
  return dias.includes(getDay(d))
}

/** Índice: hábito → conjunto de dias marcados. */
export function indexar(registros: RegistroHabito[]): Map<string, Map<string, RegistroHabito>> {
  const mapa = new Map<string, Map<string, RegistroHabito>>()
  for (const r of registros) {
    if (!mapa.has(r.habit_id)) mapa.set(r.habit_id, new Map())
    mapa.get(r.habit_id)!.set(r.day, r)
  }
  return mapa
}

/**
 * Sequência atual: dias seguidos cumpridos até hoje.
 * Se hoje ainda não foi marcado, conta a partir de ontem (o dia não acabou).
 */
export function sequencia(h: Habito, dias: Map<string, RegistroHabito> | undefined, hoje = isoDia()): number {
  if (!dias || dias.size === 0) return 0
  let d = lerData(hoje)!
  if (!dias.has(hoje)) d = addDays(d, -1)
  let total = 0
  for (let i = 0; i < 1000; i++) {
    const iso = isoDia(d)
    if (valeNoDia(h, iso)) {
      if (dias.has(iso)) total++
      else break
    }
    d = addDays(d, -1)
  }
  return total
}

/** Maior sequência registrada. */
export function melhorSequencia(h: Habito, dias: Map<string, RegistroHabito> | undefined): number {
  if (!dias || dias.size === 0) return 0
  const ordenados = [...dias.keys()].sort()
  let melhor = 0
  let atual = 0
  let anterior: string | null = null
  for (const dia of ordenados) {
    if (anterior) {
      // pula dias em que o hábito não vale
      let esperado = lerData(anterior)!
      do {
        esperado = addDays(esperado, 1)
      } while (!valeNoDia(h, isoDia(esperado)) && isoDia(esperado) < dia)
      atual = isoDia(esperado) === dia ? atual + 1 : 1
    } else {
      atual = 1
    }
    melhor = Math.max(melhor, atual)
    anterior = dia
  }
  return melhor
}

/** Percentual de cumprimento em um período. */
export function taxa(h: Habito, dias: Map<string, RegistroHabito> | undefined, inicio: string, fim: string): number {
  let validos = 0
  let feitos = 0
  let d = lerData(inicio)!
  const ultimo = lerData(fim)!
  while (d <= ultimo) {
    const iso = isoDia(d)
    if (valeNoDia(h, iso)) {
      validos++
      if (dias?.has(iso)) feitos++
    }
    d = addDays(d, 1)
  }
  return validos ? Math.round((feitos / validos) * 100) : 0
}
