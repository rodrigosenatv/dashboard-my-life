"use client"

import * as React from "react"
import { acharColecao, useGarantirColecao, useGravarItens, type DefinicaoColecao } from "@/features/colecoes/gravacao"
import type { ItemColecao } from "@/features/colecoes/visao-colecao"
import { useItensDe } from "@/features/treino/dados"
import { useLista } from "@/lib/data"
import { CONSERVACOES, lerOutfit, lerPeca, ordenarOutfits, TIPOS_PECA } from "./logica"

/* ------------------------------------------------------------------ */
/* Coleções                                                            */
/* ------------------------------------------------------------------ */

/**
 * As duas coleções do Guarda Roupa: o app cria com estes nomes e colunas na primeira gravação. Cor, Lugar,
 * Hora e Clima levam várias opções separadas por vírgula, mas ficam como "select" (o tipo que o import dá),
 * para a tela não trocar o tipo de uma coluna que já veio do Notion.
 */
export const DEFINICOES: Record<"pecas" | "outfits", DefinicaoColecao> = {
  pecas: {
    nomes: ["Guarda Roupa", "Guarda-Roupa", "Guarda Roupas"],
    nome: "Guarda Roupa",
    descricao: "Guarda Roupa",
    schema: [
      { name: "Tipo", type: "select", options: [...TIPOS_PECA] },
      { name: "Cor", type: "select" },
      { name: "Marca", type: "select" },
      { name: "Tamanho", type: "select" },
      { name: "Conservação", type: "select", options: [...CONSERVACOES] },
      { name: "Comprado", type: "checkbox" },
      { name: "Valor", type: "number" },
      { name: "Site", type: "url" },
      { name: "Foto/Imagem", type: "text" },
    ],
    colunas: [
      { name: "Tipo", type: "select" },
      { name: "Cor", type: "select" },
      { name: "Marca", type: "select" },
      { name: "Tamanho", type: "select" },
      { name: "Conservação", type: "select" },
      { name: "Comprado", type: "checkbox" },
      { name: "Valor", type: "number" },
      { name: "Site", type: "url" },
      { name: "Foto/Imagem", type: "text" },
    ],
  },
  outfits: {
    nomes: ["Outfit", "Outfits"],
    nome: "Outfits",
    descricao: "Guarda Roupa",
    schema: [
      { name: "Peças", type: "multi_select" },
      { name: "Utilizado", type: "date" },
      { name: "Lugar", type: "select" },
      { name: "Hora", type: "select" },
      { name: "Clima", type: "select" },
    ],
    colunas: [
      { name: "Peças", type: "multi_select" },
      { name: "Utilizado", type: "date" },
      { name: "Lugar", type: "select" },
      { name: "Hora", type: "select" },
      { name: "Clima", type: "select" },
    ],
  },
}

/** As duas coleções, já achadas entre as do banco. Cada uma fica undefined enquanto não existe. */
export function useColecoesGuardaRoupa() {
  const { data: colecoes = [], isLoading } = useLista("collections", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  return React.useMemo(
    () => ({
      pecas: acharColecao(colecoes, DEFINICOES.pecas.nomes),
      outfits: acharColecao(colecoes, DEFINICOES.outfits.nomes),
      carregando: isLoading,
    }),
    [colecoes, isLoading],
  )
}

const doColecao = (lista: ItemColecao[] | undefined, colecaoId: string | undefined) =>
  colecaoId ? (lista ?? []).filter((i) => i.collection_id === colecaoId) : []

/** As peças e os desejos (todos juntos), os outfits já ordenados e o estado de carregamento. */
export function useDadosGuardaRoupa() {
  const colecoes = useColecoesGuardaRoupa()
  const qPecas = useItensDe(colecoes.pecas)
  const qOutfits = useItensDe(colecoes.outfits)
  const pecas = React.useMemo(() => doColecao(qPecas.data, colecoes.pecas?.id).map(lerPeca), [qPecas.data, colecoes.pecas?.id])
  // Um outfit precisa de todas as peças (as compradas e os desejos) para achar as dele
  const outfits = React.useMemo(
    () => ordenarOutfits(doColecao(qOutfits.data, colecoes.outfits?.id).map((i) => lerOutfit(i, pecas))),
    [qOutfits.data, colecoes.outfits?.id, pecas],
  )
  const carregando =
    colecoes.carregando || (Boolean(colecoes.pecas) && qPecas.isLoading) || (Boolean(colecoes.outfits) && qOutfits.isLoading)
  return { colecoes, pecas, outfits, carregando, erro: qPecas.error ?? qOutfits.error }
}

/** Criar, mudar e excluir peças, desejos e outfits (a tela muda na hora; o banco recebe em fila). Tipos: "pecas" e "outfits". */
export function useGravarGuardaRoupa() {
  const colecoes = useColecoesGuardaRoupa()
  return useGravarItens(DEFINICOES, colecoes)
}

/** Garante a coleção de peças antes de enviar a foto de uma peça nova. */
export function useGarantirColecaoPecas() {
  const { pecas } = useColecoesGuardaRoupa()
  return useGarantirColecao(DEFINICOES.pecas, pecas)
}

export * from "./logica"
