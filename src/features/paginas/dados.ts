"use client"

import { useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"

export type PaginaResumo = Pick<Tables<"pages">, "id" | "title" | "parent_id" | "section" | "icon" | "position" | "favorite" | "updated_at">

/** Árvore de páginas sem o conteúdo (leve). */
export function useArvorePaginas() {
  return useLista("pages", {
    colunas: "id,title,parent_id,section,icon,position,favorite,updated_at",
    ordem: [{ coluna: "position" }, { coluna: "title" }],
    chave: ["arvore"],
  }) as { data: PaginaResumo[] | undefined; isLoading: boolean; error: unknown }
}

export const SECOES: Record<string, string> = {
  biblioteca: "Biblioteca",
  planner: "Planner de conteúdo",
  concursos: "Concursos",
  notas: "Notas",
  recursos: "Recursos",
  wiki: "Wiki pessoal",
  arquivo: "Arquivo",
  geral: "Outras páginas",
}

export function filhosDe(paginas: PaginaResumo[], id: string | null) {
  return paginas.filter((p) => p.parent_id === id).sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
}

export function ancestrais(paginas: PaginaResumo[], id: string): PaginaResumo[] {
  const mapa = new Map(paginas.map((p) => [p.id, p]))
  const lista: PaginaResumo[] = []
  let atual = mapa.get(id)?.parent_id
  for (let i = 0; atual && i < 20; i++) {
    const p = mapa.get(atual)
    if (!p) break
    lista.unshift(p)
    atual = p.parent_id
  }
  return lista
}

export function contarDescendentes(paginas: PaginaResumo[], id: string): number {
  const filhos = paginas.filter((p) => p.parent_id === id)
  return filhos.reduce((n, f) => n + 1 + contarDescendentes(paginas, f.id), 0)
}
