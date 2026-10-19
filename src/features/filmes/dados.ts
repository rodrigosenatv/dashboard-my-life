"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { acharColecao, useGravarItens, type DefinicaoColecao } from "@/features/colecoes/gravacao"
import type { Colecao } from "@/features/colecoes/visao-colecao"
import { useConfiguracoes, useSalvarConfiguracoes } from "@/features/configuracoes/dados"
import { useItensDe } from "@/features/treino/dados"
import { useLista } from "@/lib/data"
import type { Json } from "@/lib/supabase/database.types"
import { CATEGORIAS_FILMES, estrelas, lerTitulo, type InfoTmdb } from "./logica"
import { buscarNoTmdb, detalhesNoTmdb } from "./tmdb"

/* ------------------------------------------------------------------ */
/* Coleção                                                             */
/* ------------------------------------------------------------------ */

/** A coleção de Filmes & Séries: o app cria com estas colunas na primeira gravação. */
export const DEFINICAO_FILMES: DefinicaoColecao = {
  nomes: ["Filmes e Séries", "Filmes & Séries", "Filmes e series"],
  nome: "Filmes e Séries",
  descricao: "Filmes & Séries",
  schema: [
    { name: "Filme/Série", type: "select", options: ["Filme", "Série"] },
    { name: "Assistido", type: "checkbox" },
    { name: "Avaliação", type: "select", options: [1, 2, 3, 4, 5].map((n) => estrelas(n)) },
    { name: "Categoria", type: "select", options: [...CATEGORIAS_FILMES] },
    { name: "Data", type: "date" },
    { name: "Temporada", type: "number" },
    { name: "Episódio", type: "number" },
    { name: "Plataforma", type: "text" },
  ],
  colunas: [
    { name: "Filme/Série", type: "select" },
    { name: "Assistido", type: "checkbox" },
    { name: "Avaliação", type: "select" },
    { name: "Categoria", type: "select" },
    { name: "Data", type: "date" },
    { name: "Temporada", type: "number" },
    { name: "Episódio", type: "number" },
    { name: "Plataforma", type: "text" },
  ],
}

// Fora do componente: a gravação espera objetos estáveis
const DEFINICOES_GRAVACAO = { filmes: DEFINICAO_FILMES }

function useColecoesFilmes() {
  const { data: colecoes = [], isLoading } = useLista("collections", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  const colecao = React.useMemo(() => acharColecao(colecoes, DEFINICAO_FILMES.nomes), [colecoes])
  return { colecao, carregando: isLoading }
}

/** A coleção de Filmes & Séries; undefined enquanto não existe (a primeira gravação a cria). */
export function useColecaoFilmes(): Colecao | undefined {
  return useColecoesFilmes().colecao
}

/** Os títulos da coleção, já lidos, com o estado de carregamento e de erro. */
export function useDadosFilmes() {
  const { colecao, carregando: carregandoColecoes } = useColecoesFilmes()
  const consulta = useItensDe(colecao)
  const titulos = React.useMemo(
    () => (consulta.data ?? []).filter((i) => i.collection_id === colecao?.id).map((i) => lerTitulo(i)),
    [consulta.data, colecao?.id],
  )
  return {
    colecao,
    titulos,
    carregando: carregandoColecoes || (Boolean(colecao) && consulta.isLoading),
    erro: consulta.error,
  }
}

/** Criar, mudar e excluir títulos (a tela muda na hora; o banco recebe em fila). Use o tipo "filmes". */
export function useGravarFilmes() {
  const colecao = useColecaoFilmes()
  const colecoes = React.useMemo(() => ({ filmes: colecao }), [colecao])
  return useGravarItens(DEFINICOES_GRAVACAO, colecoes)
}

/* ------------------------------------------------------------------ */
/* Chave do TMDB (preferências da conta)                               */
/* ------------------------------------------------------------------ */

/** As preferências de filmes da conta (um objeto; o resto é ignorado). */
function prefsFilmes(prefs: Json | null | undefined): Record<string, Json> {
  const bruto = ((prefs ?? {}) as Record<string, Json>).filmes
  return bruto && typeof bruto === "object" && !Array.isArray(bruto) ? (bruto as Record<string, Json>) : {}
}

/** A chave do TMDB da conta: vale em todos os aparelhos. Remover = salvar null. */
export function useChaveTmdb() {
  const { data } = useConfiguracoes()
  const salvar = useSalvarConfiguracoes()
  const filmes = prefsFilmes(data?.prefs)
  const chave = typeof filmes.tmdb === "string" && filmes.tmdb.trim() ? filmes.tmdb.trim() : null
  return {
    chave,
    // Manda o objeto "filmes" inteiro: o salvar só junta o primeiro nível das preferências.
    // Devolve se deu certo (o erro já foi avisado por quem salva)
    salvar: (nova: string | null): Promise<boolean> =>
      salvar.mutateAsync({ prefs: { filmes: { ...filmes, tmdb: nova } } }).then(
        () => true,
        () => false,
      ),
    salvando: salvar.isPending,
  }
}

/* ------------------------------------------------------------------ */
/* Consultas ao TMDB                                                   */
/* ------------------------------------------------------------------ */

const UM_DIA = 24 * 60 * 60 * 1000
const UMA_HORA = 60 * 60 * 1000

/** Sinopse, trailer, onde assistir e temporadas de um título (guardado por um dia). */
export function useDetalhesTmdb(chave: string | null, info: InfoTmdb | null | undefined) {
  return useQuery({
    queryKey: ["tmdb", info?.tipo, info?.id],
    enabled: Boolean(chave && info),
    queryFn: async ({ signal }) => {
      if (!chave || !info) throw new Error("Sem chave ou título.")
      return detalhesNoTmdb(chave, info.tipo, info.id, signal)
    },
    staleTime: UM_DIA,
    gcTime: UM_DIA,
    retry: 0,
  })
}

/** A busca do TMDB enquanto a pessoa digita: só busca depois de 300 ms sem digitar. */
export function useBuscaTmdb(chave: string | null, termo: string) {
  const [esperado, setEsperado] = React.useState(termo.trim())
  React.useEffect(() => {
    const pausa = window.setTimeout(() => setEsperado(termo.trim()), 300)
    return () => window.clearTimeout(pausa)
  }, [termo])
  return useQuery({
    queryKey: ["tmdb-busca", esperado],
    enabled: Boolean(chave) && esperado.length >= 2,
    queryFn: async ({ signal }) => {
      if (!chave) throw new Error("Sem chave.")
      return buscarNoTmdb(chave, esperado, signal)
    },
    staleTime: UMA_HORA,
    retry: 0,
  })
}

export * from "./logica"
