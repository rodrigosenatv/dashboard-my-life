"use client"

import * as React from "react"
import { useLista } from "@/lib/data"

export const SECOES_BIBLIOTECA = ["biblioteca", "planner"]

export type Prompt = { chave: string; paginaId: string; pagina: string; modulo: string; titulo: string; texto: string }

/** Tira os blocos de código (os prompts) do markdown, com o título mais próximo acima de cada um. */
export function extrairPrompts(conteudo: string): { titulo: string; texto: string }[] {
  const saida: { titulo: string; texto: string }[] = []
  let titulo = ""
  let bloco: string[] | null = null
  let cerca = ""
  for (const linha of conteudo.split("\n")) {
    const crua = linha.trim()
    if (bloco) {
      if (crua.startsWith(cerca)) {
        const texto = bloco.join("\n").trim()
        if (texto.length >= 30) saida.push({ titulo, texto })
        bloco = null
      } else bloco.push(linha)
      continue
    }
    const abre = /^(`{3,}|~{3,})/.exec(crua)
    if (abre) {
      cerca = abre[1]
      bloco = []
      continue
    }
    const cab = /^#{1,6}\s+(.+)$/.exec(crua) ?? /^<summary>(.+)<\/summary>$/.exec(crua) ?? /^\*\*(.+)\*\*:?$/.exec(crua)
    if (cab) titulo = cab[1].replace(/<[^>]+>/g, "").replace(/\*\*/g, "").trim()
  }
  return saida
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
    // Módulo = página de primeiro nível da biblioteca acima desta.
    const raiz = (id: string) => {
      let atual = porId.get(id)
      for (let i = 0; atual?.parent_id && porId.has(atual.parent_id) && i < 20; i++) atual = porId.get(atual.parent_id)
      return atual?.title ?? ""
    }
    const lista: Prompt[] = []
    for (const p of paginas) {
      if (!p.content?.includes("```") && !p.content?.includes("~~~")) continue
      extrairPrompts(p.content).forEach((x, i) => lista.push({ chave: `${p.id}-${i}`, paginaId: p.id, pagina: p.title || "Sem título", modulo: raiz(p.id), ...x }))
    }
    return lista
  }, [paginas])
  return { prompts, isLoading: ativo && isLoading }
}

/** Campos a preencher num prompt: [TÓPICO], [PÚBLICO-ALVO], {número}… */
export function camposDoPrompt(texto: string): string[] {
  const achados = [...texto.matchAll(/\[([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 _\-/]{1,40})\](?!\()|\{([a-zà-ÿ][a-zà-ÿ0-9 _\-/]{1,40})\}/g)].map((m) => m[0])
  return [...new Set(achados)]
}

export function preencherPrompt(texto: string, valores: Record<string, string>): string {
  let saida = texto
  for (const [campo, valor] of Object.entries(valores)) if (valor.trim()) saida = saida.split(campo).join(valor.trim())
  return saida
}
