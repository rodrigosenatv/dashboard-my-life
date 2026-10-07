"use client"

import { useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"

export type Projeto = Tables<"projects">
export type AreaPara = Tables<"areas">

export function useProjetos() {
  return useLista("projects", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
}

export function useAreas() {
  return useLista("areas", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
}

/** Progresso de um projeto: etapas concluídas sobre o total (contando subetapas). */
export function progresso(id: string, todos: Projeto[]): { feitos: number; total: number } {
  const filhos = todos.filter((p) => p.parent_id === id)
  let feitos = 0
  let total = 0
  for (const f of filhos) {
    const netos = todos.filter((p) => p.parent_id === f.id)
    if (netos.length && !f.done) {
      const sub = progresso(f.id, todos)
      feitos += sub.feitos / Math.max(1, sub.total)
      total += 1
    } else {
      total += 1
      if (f.done) feitos += 1
    }
  }
  return { feitos: Math.round(feitos * 10) / 10, total }
}
