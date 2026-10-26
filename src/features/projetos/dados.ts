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

/** Progresso de um projeto (a conta fica na lógica do Segundo Cérebro, testada em tests/segundo-cerebro.test.cjs). */
export { progresso } from "@/features/segundo-cerebro/logica"
