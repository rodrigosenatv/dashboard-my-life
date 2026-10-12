"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { useLista } from "@/lib/data"
import { lerPosicaoLocal, listarLivrosLocais, type PosicaoLocal } from "./armazenamento"
import { ENTIDADE_LIVRO, type ArquivoNuvem } from "./nuvem"

/** Ids dos livros que têm arquivo guardado neste aparelho. */
export function useLivrosNoAparelho() {
  return useQuery({
    queryKey: ["leitor", "aparelho"],
    queryFn: () => listarLivrosLocais().catch(() => [] as string[]),
    staleTime: Infinity,
  })
}

/** Arquivos de livros guardados na nuvem (tabela `files`). */
export function useLivrosNaNuvem() {
  return useLista("files", { filtro: (q) => q.eq("entity_type", ENTIDADE_LIVRO), chave: [ENTIDADE_LIVRO] })
}

export type DisponibilidadeLivro = { noAparelho: boolean; naNuvem: ArquivoNuvem | null; temArquivo: boolean }

/** Onde está o arquivo de cada livro, para mostrar o botão "Ler" nas listas. */
export function useDisponibilidade(): (livroId: string) => DisponibilidadeLivro {
  const { data: locais = [] } = useLivrosNoAparelho()
  const { data: nuvem = [] } = useLivrosNaNuvem()
  return React.useCallback(
    (livroId: string) => {
      const noAparelho = locais.includes(livroId)
      const naNuvem = nuvem.find((f) => f.entity_id === livroId) ?? null
      return { noAparelho, naNuvem, temArquivo: noAparelho || Boolean(naNuvem) }
    },
    [locais, nuvem],
  )
}

export function usePosicaoLocal(livroId: string | undefined) {
  return useQuery<PosicaoLocal | null>({
    queryKey: ["leitor", "posicao", livroId],
    enabled: Boolean(livroId),
    queryFn: async () => (await lerPosicaoLocal(livroId!).catch(() => undefined)) ?? null,
    staleTime: 0,
  })
}

/** Depois de guardar ou apagar um arquivo, as listas que mostram "Ler" precisam se atualizar. */
export function useAtualizarDisponibilidade() {
  const qc = useQueryClient()
  return React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["leitor"] })
    void qc.invalidateQueries({ queryKey: ["files"] })
  }, [qc])
}
