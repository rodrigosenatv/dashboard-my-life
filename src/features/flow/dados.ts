"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { novoId, useAtualizar, useCriar, useLista, useRegistro } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import { hubPorSlug } from "@/features/vida/hubs"
import { usePaginaDoHub } from "@/features/vida/pagina-hub"
import { removerVideo } from "@/features/videos/logica"
import { inserirNaPlaylist, juntarFerramentas } from "./logica"

export * from "./logica"

/* As listas são as mesmas das telas de Hoje e de Rotina: o cache é um só, então uma gravação aparece nas duas. */

export function useTarefas() {
  return useLista("tasks", { ordem: [{ coluna: "position" }] })
}

export function useEventos() {
  return useLista("events", { ordem: [{ coluna: "starts_at" }] })
}

/** As ferramentas sem repetição. A tela otimista pode pôr links de outro grupo na lista, então filtra de novo. */
export function useFerramentas() {
  const { data: links, isLoading, error } = useLista("bookmarks", {
    filtro: (q) => q.eq("collection", "ferramentas"),
    ordem: [{ coluna: "position" }],
    chave: ["ferramentas-flow"],
  })
  const ferramentas = React.useMemo(
    () => juntarFerramentas((links ?? []).filter((l) => l.collection === "ferramentas")),
    [links],
  )
  return { ferramentas, carregando: isLoading, erro: error }
}

/** A página Flow e o texto dela (anotações e playlist saem daí). */
export function usePaginaFlow() {
  const { pagina, isLoading: carregandoPaginas } = usePaginaDoHub(hubPorSlug("flow"))
  const { data: registro, isLoading: carregandoTexto } = useRegistro("pages", pagina?.id)
  return {
    pagina,
    conteudo: pagina ? (registro?.content ?? null) : null,
    carregando: carregandoPaginas || (Boolean(pagina) && carregandoTexto),
  }
}

/** O título e o canal de um vídeo, pela nossa rota (que pede ao YouTube). Sem resposta boa: null. */
export async function buscarTituloYoutube(id: string): Promise<{ titulo: string; canal: string | null } | null> {
  try {
    const resposta = await fetch(`/api/youtube-titulo?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(6000) })
    if (!resposta.ok) return null
    const dados = (await resposta.json()) as { titulo?: unknown; canal?: unknown }
    if (typeof dados.titulo !== "string") return null
    return { titulo: dados.titulo, canal: typeof dados.canal === "string" ? dados.canal : null }
  } catch {
    return null
  }
}

/** O título de um vídeo, guardado no cache: o título de um vídeo quase nunca muda. */
export function useTituloYoutube(id: string, ativo: boolean) {
  return useQuery({
    queryKey: ["youtube-titulo", id],
    enabled: ativo,
    staleTime: Infinity,
    gcTime: 86400000,
    retry: false,
    queryFn: async () => {
      const info = await buscarTituloYoutube(id)
      // Sem título a consulta falha de propósito: não guarda "nada" no cache
      if (!info) throw new Error("sem título")
      return info
    },
  })
}

/** O texto da página como está no banco agora (para não gravar por cima de algo mudado em outro aparelho). */
async function textoNoBanco(id: string): Promise<string> {
  const { data, error } = await supabase().from("pages").select("content").eq("id", id).single()
  if (error) throw new Error(error.message)
  return data?.content ?? ""
}

/** Pôr e tirar músicas da playlist no texto da página Flow (com o texto de antes, para desfazer). */
export function useGravarPlaylist() {
  const atualizar = useAtualizar("pages")
  const criar = useCriar("pages")

  /** Põe a linha na playlist. Sem página Flow, cria uma já com a música. */
  const adicionar = async (paginaId: string | null, linha: string): Promise<{ paginaId: string; antes: string }> => {
    if (!paginaId) {
      const id = novoId()
      await criar.mutateAsync({ id, title: "Flow", section: "geral", content: linha })
      return { paginaId: id, antes: "" }
    }
    const antes = await textoNoBanco(paginaId)
    await atualizar.mutateAsync({ id: paginaId, content: inserirNaPlaylist(antes, linha) })
    return { paginaId, antes }
  }

  /** Tira a música (pela chave do vídeo). Devolve o texto de antes; null quando o vídeo não está sozinho numa linha. */
  const remover = async (paginaId: string, chave: string): Promise<string | null> => {
    const antes = await textoNoBanco(paginaId)
    const depois = removerVideo(antes, chave)
    if (depois === null) return null
    await atualizar.mutateAsync({ id: paginaId, content: depois })
    return antes
  }

  /** Desfaz: volta o texto que a página tinha antes. */
  const voltar = (paginaId: string, texto: string) => {
    atualizar.mutate({ id: paginaId, content: texto })
  }

  return { adicionar, remover, voltar }
}
