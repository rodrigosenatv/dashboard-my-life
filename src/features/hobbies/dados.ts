"use client"

import * as React from "react"
import { useLista, useRegistro } from "@/lib/data"
import { acharColecao, useGarantirColecao, useGravarItens, type DefinicaoColecao } from "@/features/colecoes/gravacao"
import type { ItemColecao } from "@/features/colecoes/visao-colecao"
import type { PaginaResumo } from "@/features/paginas/dados"
import { useItensDe } from "@/features/treino/dados"
import { hubPorSlug } from "@/features/vida/hubs"
import { usePaginaDoHub } from "@/features/vida/pagina-hub"
import { detectarGrupos, emBranco, lerHobby, lerSessao, ordenarHobbies, ordenarSessoes, tituloPadrao } from "./logica"

export * from "./logica"

/* ------------------------------------------------------------------ */
/* Coleções                                                            */
/* ------------------------------------------------------------------ */

export type TipoColecao = "hobbies" | "pratica"

/** As duas coleções de Hobbies: o app cria com estes nomes e colunas na primeira gravação. */
export const DEFINICOES: Record<TipoColecao, DefinicaoColecao> = {
  hobbies: {
    nomes: ["Meus hobbies"],
    nome: "Meus hobbies",
    descricao: "Hobbies",
    schema: [
      { name: "Meta por semana", type: "number" },
      { name: "Objetivo", type: "text" },
      { name: "Foto", type: "text" },
    ],
    colunas: [
      { name: "Meta por semana", type: "number" },
      { name: "Objetivo", type: "text" },
    ],
  },
  pratica: {
    nomes: ["Prática dos hobbies"],
    nome: "Prática dos hobbies",
    descricao: "Hobbies",
    schema: [
      { name: "Data", type: "date" },
      { name: "Minutos", type: "number" },
      { name: "Anotações", type: "text" },
      { name: "Próximo passo", type: "text" },
    ],
    colunas: [
      { name: "Data", type: "date" },
      { name: "Minutos", type: "number" },
      { name: "Anotações", type: "text" },
      { name: "Próximo passo", type: "text" },
    ],
  },
}

export function useColecoesHobbies() {
  const { data: colecoes = [], isLoading } = useLista("collections", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  return React.useMemo(
    () => ({
      hobbies: acharColecao(colecoes, DEFINICOES.hobbies.nomes),
      pratica: acharColecao(colecoes, DEFINICOES.pratica.nomes),
      carregando: isLoading,
    }),
    [colecoes, isLoading],
  )
}

/** Os hobbies e as práticas, já lidos. */
export function useDadosHobbies() {
  const colecoes = useColecoesHobbies()
  const qHobbies = useItensDe(colecoes.hobbies)
  const qPratica = useItensDe(colecoes.pratica)
  const doTipo = (lista: ItemColecao[] | undefined, id: string | undefined) => (id ? (lista ?? []).filter((i) => i.collection_id === id) : [])
  const hobbies = React.useMemo(() => ordenarHobbies(doTipo(qHobbies.data, colecoes.hobbies?.id).map(lerHobby)), [qHobbies.data, colecoes.hobbies?.id])
  const sessoes = React.useMemo(() => ordenarSessoes(doTipo(qPratica.data, colecoes.pratica?.id).map(lerSessao)), [qPratica.data, colecoes.pratica?.id])
  const carregando = colecoes.carregando || (Boolean(colecoes.hobbies) && qHobbies.isLoading) || (Boolean(colecoes.pratica) && qPratica.isLoading)
  return { colecoes, hobbies, sessoes, carregando, erro: qHobbies.error ?? qPratica.error }
}

/** Criar, mudar e excluir hobbies e práticas (a tela muda na hora; o banco recebe em fila). */
export function useGravarHobbies() {
  const colecoes = useColecoesHobbies()
  return useGravarItens(DEFINICOES, colecoes)
}

/** Garante a coleção de hobbies antes de enviar a foto de um hobby novo. */
export function useGarantirColecaoHobbies() {
  const { hobbies } = useColecoesHobbies()
  return useGarantirColecao(DEFINICOES.hobbies, hobbies)
}

/* ------------------------------------------------------------------ */
/* Páginas de estudo                                                   */
/* ------------------------------------------------------------------ */

/** A página "Hobbies" do Notion e todas as páginas do app (as de cada hobby saem daí, pelo id). */
export function usePaginasDosHobbies() {
  const { pagina, paginas, isLoading } = usePaginaDoHub(hubPorSlug("hobbies"))
  const porId = React.useMemo(() => new Map(paginas.map((p) => [p.id, p])), [paginas])
  return { pagina, paginas, porId, carregando: isLoading }
}

/** Quais destas páginas estão em branco (só confere as que ainda têm o título "Nova Página"). */
export function usePaginasEmBranco(paginas: PaginaResumo[]) {
  const candidatas = React.useMemo(() => paginas.filter((p) => tituloPadrao(p.title)).map((p) => p.id).sort(), [paginas])
  const { data } = useLista("pages", {
    colunas: "id,content",
    filtro: (q) => q.in("id", candidatas),
    chave: ["hobbies-em-branco", candidatas.join(",")],
    enabled: candidatas.length > 0,
  })
  return React.useMemo(() => new Set((candidatas.length ? (data ?? []) : []).filter((p) => emBranco(p.content)).map((p) => p.id)), [data, candidatas])
}

/** Os blocos da página "Hobbies" do Notion (nome, foto e páginas), para montar os hobbies de uma vez. */
export function useGruposDoNotion(paginaId: string | undefined, paginas: PaginaResumo[], ativo: boolean) {
  const lendo = ativo && Boolean(paginaId)
  const { data: pagina, isLoading } = useRegistro("pages", paginaId, { enabled: lendo })
  const grupos = React.useMemo(() => (lendo && pagina ? detectarGrupos(pagina.content ?? "", new Set(paginas.map((p) => p.id))) : []), [lendo, pagina, paginas])
  return { grupos, carregando: lendo && isLoading }
}
