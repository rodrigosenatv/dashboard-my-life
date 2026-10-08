"use client"

import { useLista } from "@/lib/data"

export type Mensagem = { role: "user" | "assistant"; content: string }

/** As conversas ficam como páginas (seção "assistente"), legíveis também fora do chat. */
export const SECAO_CONVERSAS = "assistente"
const VOCE = "#### 🧑 Você"
const CLAUDE = "#### ✨ Claude"

export function conversaParaTexto(mensagens: Mensagem[]): string {
  return mensagens
    .filter((m) => m.content.trim())
    .map((m) => `${m.role === "user" ? VOCE : CLAUDE}\n\n${m.content.trim()}`)
    .join("\n\n")
}

export function textoParaConversa(texto: string): Mensagem[] {
  const saida: Mensagem[] = []
  let atual: Mensagem | null = null
  for (const linha of texto.split("\n")) {
    if (linha.trim() === VOCE || linha.trim() === CLAUDE) {
      if (atual) saida.push({ ...atual, content: atual.content.trim() })
      atual = { role: linha.trim() === VOCE ? "user" : "assistant", content: "" }
    } else if (atual) atual.content += `${linha}\n`
  }
  if (atual) saida.push({ ...atual, content: atual.content.trim() })
  return saida
}

export function tituloDaConversa(mensagens: Mensagem[]): string {
  const primeira = mensagens.find((m) => m.role === "user")?.content ?? "Conversa"
  const linha = primeira.split("\n").find((l) => l.trim()) ?? "Conversa"
  return linha.length > 70 ? `${linha.slice(0, 67).trim()}…` : linha
}

export function useConversas() {
  return useLista("pages", {
    colunas: "id,title,updated_at,favorite",
    filtro: (q) => q.eq("section", SECAO_CONVERSAS),
    ordem: [{ coluna: "updated_at", asc: false }],
    chave: ["conversas"],
  })
}
