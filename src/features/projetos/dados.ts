"use client"

import * as React from "react"
import { useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"

export type Projeto = Tables<"projects">
export type AreaPara = Tables<"areas">

// Tudo menos `description`: as anotações de cada projeto são texto longo e só a tela do
// próprio projeto as mostra (ela busca o registro inteiro). Sem elas a lista fica ~10x menor.
const COLUNAS_PROJETO = "id,notion_id,name,icon,parent_id,area_id,deadline,publish_date,done,done_at,archived,position,created_at,updated_at"

/** Todos os projetos e etapas, na ordem definida pela pessoa. Uma única consulta, compartilhada por todas as telas. */
export function useProjetos() {
  return useLista("projects", { colunas: COLUNAS_PROJETO, ordem: [{ coluna: "position" }, { coluna: "name" }] })
}

/** Os mesmos projetos em ordem alfabética, para listas de escolha. Reaproveita a consulta de `useProjetos`. */
export function useProjetosPorNome() {
  const consulta = useProjetos()
  const data = React.useMemo(() => (consulta.data ? [...consulta.data].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) : undefined), [consulta.data])
  return { ...consulta, data }
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
