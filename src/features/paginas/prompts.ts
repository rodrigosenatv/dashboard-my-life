"use client"

import * as React from "react"
import { useLista } from "@/lib/data"
import { camposDoPrompt, extrairPrompts, modulosDoCurso, preencherPrompt } from "@/features/conteudo/logica"

export { camposDoPrompt, extrairPrompts, preencherPrompt }

export const SECOES_BIBLIOTECA = ["biblioteca", "planner"]

export type Prompt = {
  chave: string
  paginaId: string
  pagina: string
  /** A página de primeiro nível (o curso ou a coleção de onde o prompt vem). */
  curso: string
  /** O módulo do curso onde a página está (como no Notion) ou, sem módulos, a página de primeiro nível. */
  modulo: string
  titulo: string
  texto: string
}

/** Todos os prompts das páginas da Biblioteca e do Planner. */
export function usePromptsBiblioteca(ativo = true) {
  const { data: paginas = [], isLoading } = useLista("pages", {
    colunas: "id,title,content,parent_id,section",
    filtro: (q) => q.in("section", SECOES_BIBLIOTECA),
    chave: ["prompts-biblioteca"],
    enabled: ativo,
  })
  const prompts = React.useMemo(() => {
    const porId = new Map(paginas.map((p) => [p.id, p]))
    const raizDe = (id: string) => {
      let atual = porId.get(id)
      for (let i = 0; atual?.parent_id && porId.has(atual.parent_id) && i < 20; i++) atual = porId.get(atual.parent_id)
      return atual
    }
    // O módulo de cada aula, lido do texto da página do curso (os callouts do Notion)
    const moduloDaPagina = new Map<string, string>()
    for (const p of paginas) {
      if (p.parent_id && porId.has(p.parent_id)) continue
      for (const m of modulosDoCurso(p.content ?? "").modulos) for (const id of m.ids) moduloDaPagina.set(id, m.titulo)
    }
    const moduloDe = (id: string) => {
      let atual = porId.get(id)
      for (let i = 0; atual && i < 20; i++) {
        const m = moduloDaPagina.get(atual.id)
        if (m) return m
        atual = atual.parent_id ? porId.get(atual.parent_id) : undefined
      }
      return null
    }
    const lista: Prompt[] = []
    for (const p of paginas) {
      if (!p.content?.includes("```") && !p.content?.includes("~~~")) continue
      const curso = raizDe(p.id)?.title ?? ""
      const modulo = moduloDe(p.id) ?? curso
      extrairPrompts(p.content).forEach((x, i) => lista.push({ chave: `${p.id}-${i}`, paginaId: p.id, pagina: p.title || "Sem título", curso, modulo, ...x }))
    }
    return lista
  }, [paginas])
  return { prompts, isLoading: ativo && isLoading }
}
