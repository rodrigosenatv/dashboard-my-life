"use client"

import * as React from "react"
import { useGravarItens, type DefinicaoColecao } from "@/features/colecoes/gravacao"
import type { ItemColecao } from "@/features/colecoes/visao-colecao"
import { useItensDe } from "@/features/treino/dados"
import { hubPorSlug } from "@/features/vida/hubs"
import { usePaginaDoHub } from "@/features/vida/pagina-hub"
import { useLista, useRegistro } from "@/lib/data"
import { urlValida } from "@/lib/utils"
import {
  acharDoPessoal,
  CATEGORIAS_WIKI,
  colecoesExtras,
  frasesDaPagina,
  lerAniversario,
  lerContato,
  lerEntradaDiario,
  lerPaginaWiki,
  ordenarContatos,
  ordenarDiario,
  TAG_DIARIO,
  TAG_ESPECIAL,
} from "./logica"

/* ------------------------------------------------------------------ */
/* Coleções                                                            */
/* ------------------------------------------------------------------ */

export type TipoColecao = "diario" | "aniversarios" | "contatos" | "wiki"

/** As quatro coleções de Pessoal: o app cria com estes nomes e colunas na primeira gravação. */
export const DEFINICOES: Record<TipoColecao, DefinicaoColecao> = {
  diario: {
    nomes: ["Diário"],
    nome: "Diário",
    descricao: "Pessoal",
    schema: [
      { name: "Data", type: "date" },
      { name: "Tags", type: "select", options: [TAG_DIARIO, TAG_ESPECIAL] },
    ],
    colunas: [
      { name: "Data", type: "date" },
      { name: "Tags", type: "select" },
    ],
  },
  aniversarios: {
    nomes: ["Aniversários", "Aniversarios"],
    nome: "Aniversários",
    descricao: "Pessoal",
    schema: [
      { name: "Data de nascimento", type: "date" },
      { name: "Celular", type: "text" },
    ],
    colunas: [
      { name: "Data de nascimento", type: "date" },
      { name: "Celular", type: "text" },
    ],
  },
  contatos: {
    nomes: ["Contatos"],
    nome: "Contatos",
    descricao: "Pessoal",
    schema: [
      { name: "Celular", type: "text" },
      { name: "E-mail", type: "text" },
      { name: "Endereço", type: "text" },
      { name: "Categoria", type: "select" },
    ],
    colunas: [
      { name: "Celular", type: "text" },
      { name: "E-mail", type: "text" },
      { name: "Endereço", type: "text" },
      { name: "Categoria", type: "select" },
    ],
  },
  wiki: {
    nomes: ["Wiki Pessoal"],
    nome: "Wiki Pessoal",
    descricao: "Pessoal",
    schema: [{ name: "Tags", type: "select", options: [...CATEGORIAS_WIKI] }],
    colunas: [{ name: "Tags", type: "select" }],
  },
}

/** As coleções de Pessoal que já existem (e as outras que moram nessa página). Memoizado: vai para a gravação. */
export function useColecoesPessoal() {
  const { data: colecoes = [], isLoading } = useLista("collections", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  return React.useMemo(() => {
    const diario = acharDoPessoal(colecoes, DEFINICOES.diario.nomes)
    const aniversarios = acharDoPessoal(colecoes, DEFINICOES.aniversarios.nomes)
    const contatos = acharDoPessoal(colecoes, DEFINICOES.contatos.nomes)
    const wiki = acharDoPessoal(colecoes, DEFINICOES.wiki.nomes)
    return {
      diario,
      aniversarios,
      contatos,
      wiki,
      extras: colecoesExtras(colecoes, [diario?.id, aniversarios?.id, contatos?.id, wiki?.id]),
      carregando: isLoading,
    }
  }, [colecoes, isLoading])
}

/** Os itens das quatro coleções, já lidos. */
export function useDadosPessoal() {
  const colecoes = useColecoesPessoal()
  const qDiario = useItensDe(colecoes.diario)
  const qAniversarios = useItensDe(colecoes.aniversarios)
  const qContatos = useItensDe(colecoes.contatos)
  const qWiki = useItensDe(colecoes.wiki)
  // A lista em cache pode trazer, por um instante, itens de outra coleção: filtra pela coleção
  const doTipo = (lista: ItemColecao[] | undefined, id: string | undefined) => (id ? (lista ?? []).filter((i) => i.collection_id === id) : [])
  const diario = React.useMemo(() => ordenarDiario(doTipo(qDiario.data, colecoes.diario?.id).map(lerEntradaDiario)), [qDiario.data, colecoes.diario?.id])
  const aniversarios = React.useMemo(() => doTipo(qAniversarios.data, colecoes.aniversarios?.id).map(lerAniversario), [qAniversarios.data, colecoes.aniversarios?.id])
  const contatos = React.useMemo(() => ordenarContatos(doTipo(qContatos.data, colecoes.contatos?.id).map(lerContato)), [qContatos.data, colecoes.contatos?.id])
  const wiki = React.useMemo(() => doTipo(qWiki.data, colecoes.wiki?.id).map(lerPaginaWiki), [qWiki.data, colecoes.wiki?.id])
  const carregando =
    colecoes.carregando ||
    (Boolean(colecoes.diario) && qDiario.isLoading) ||
    (Boolean(colecoes.aniversarios) && qAniversarios.isLoading) ||
    (Boolean(colecoes.contatos) && qContatos.isLoading) ||
    (Boolean(colecoes.wiki) && qWiki.isLoading)
  return {
    colecoes,
    diario,
    aniversarios,
    contatos,
    wiki,
    carregando,
    erro: qDiario.error ?? qAniversarios.error ?? qContatos.error ?? qWiki.error,
  }
}

/** Criar, mudar e excluir itens de Pessoal (a tela muda na hora; o banco recebe em fila). */
export function useGravarPessoal() {
  const colecoes = useColecoesPessoal()
  const existentes = React.useMemo(
    () => ({ diario: colecoes.diario, aniversarios: colecoes.aniversarios, contatos: colecoes.contatos, wiki: colecoes.wiki }),
    [colecoes.diario, colecoes.aniversarios, colecoes.contatos, colecoes.wiki],
  )
  return useGravarItens(DEFINICOES, existentes)
}

/* ------------------------------------------------------------------ */
/* Sites e página                                                      */
/* ------------------------------------------------------------------ */

/** Os sites favoritos (links da coleção "favoritos" que têm endereço). */
export function useFavoritos() {
  const { data: links = [] } = useLista("bookmarks", {
    filtro: (q) => q.eq("collection", "favoritos"),
    ordem: [{ coluna: "position" }],
    chave: ["favoritos-pessoal"],
  })
  return React.useMemo(() => links.filter((l) => urlValida(l.url)), [links])
}

/** A página "Pessoal" do Notion: o texto (de onde saem as frases do dia) e as subpáginas. */
export function usePaginaPessoal() {
  const { pagina, paginas, isLoading } = usePaginaDoHub(hubPorSlug("pessoal"))
  const { data: registro, isLoading: lendoTexto } = useRegistro("pages", pagina?.id)
  const texto = registro?.content ?? null
  const frases = React.useMemo(() => frasesDaPagina(texto), [texto])
  return { pagina, paginas, texto, frases, carregando: isLoading || lendoTexto }
}

export * from "./logica"
