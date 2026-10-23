"use client"

import * as React from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase/client"
import { BUCKET_ARQUIVOS } from "@/lib/supabase/env"
import type { Json } from "@/lib/supabase/database.types"
import { normalizar } from "@/lib/utils"
import { esquema, type Colecao, type ItemColecao, type Propriedade } from "./visao-colecao"

/*
 * Gravação de itens de coleções para as telas próprias (Hobbies e as próximas). A tela muda na
 * hora; o banco recebe na ordem dos toques, em fila. Se a coleção ainda não existe, ela é criada
 * na primeira gravação, com o nome e as colunas da definição.
 */

/** Como uma tela acha, cria e ajusta a coleção que usa. */
export type DefinicaoColecao = {
  /** Nomes aceitos (sem o "Database" do Notion), do preferido ao menos usado. */
  nomes: string[]
  /** Nome, descrição e colunas da coleção que o app cria quando ela não existe. */
  nome: string
  descricao: string
  schema: Propriedade[]
  /** Colunas que a tela grava: as que faltam entram, e o tipo que o Notion errou é corrigido. */
  colunas: Propriedade[]
}

const semPrefixo = (nome: string) => normalizar(nome.replace(/^database:?\s*/i, ""))

export function acharColecao(colecoes: Colecao[], nomes: string[]): Colecao | undefined {
  // Na ordem dos nomes: o preferido vale mais que um parecido
  for (const nome of nomes.map(normalizar)) {
    const achada = colecoes.find((c) => semPrefixo(c.name) === nome)
    if (achada) return achada
  }
  return undefined
}

/** A mesma chave que `useItensDe` monta, para a lista aparecer na hora. */
export const chaveItens = (colecaoId: string) => ["collection_items", "de", colecaoId, { colunas: "*", ordem: [{ coluna: "position" }, { coluna: "title" }] }]
export const chaveLista = (colecaoId: string) => ["collection_items", "de", colecaoId]

let fila: Promise<unknown> = Promise.resolve()
let pendentes = 0
const tocadas = new Set<string>()

/** Põe uma gravação na fila. Só recarrega quando a fila esvazia: no meio dela, o banco ainda não tem tudo. */
export function enfileirar(qc: QueryClient, colecaoId: string | null, tarefa: () => Promise<void>, erro = "Não foi possível salvar.") {
  pendentes++
  if (colecaoId) tocadas.add(colecaoId)
  fila = fila
    .then(tarefa)
    .catch((e) => {
      toast.error(erro, { description: e instanceof Error ? e.message : undefined })
    })
    .finally(() => {
      pendentes--
      if (pendentes === 0) {
        for (const id of tocadas) void qc.invalidateQueries({ queryKey: chaveLista(id) })
        tocadas.clear()
      }
    })
}

function lerDoCache(qc: QueryClient, colecaoId: string, id: string): ItemColecao | undefined {
  for (const [, lista] of qc.getQueriesData<ItemColecao[]>({ queryKey: chaveLista(colecaoId) })) {
    const achado = lista?.find((i) => i.id === id)
    if (achado) return achado
  }
  return undefined
}

function mexerNoCache(qc: QueryClient, colecaoId: string, mudar: (lista: ItemColecao[]) => ItemColecao[]) {
  qc.setQueriesData<ItemColecao[]>({ queryKey: chaveLista(colecaoId) }, (lista) => (lista ? mudar(lista) : lista))
}

const criando = new Map<string, Promise<Colecao>>()

/** A coleção que existe ou uma nova (uma só, mesmo com toques seguidos). */
export function garantirColecao(qc: QueryClient, def: DefinicaoColecao, existente?: Colecao): Promise<Colecao> {
  if (existente) return Promise.resolve(existente)
  let pronta = criando.get(def.nome)
  if (!pronta) {
    pronta = (async () => {
      const sb = supabase()
      const { data, error } = await sb.from("collections").select("*")
      if (error) throw new Error(error.message)
      const achada = acharColecao((data ?? []) as Colecao[], def.nomes)
      if (achada) return achada
      const nova = { id: crypto.randomUUID(), name: def.nome, section: "outros", description: def.descricao, schema: def.schema as unknown as Json }
      const { data: criada, error: erro } = await sb.from("collections").insert(nova).select().single()
      if (erro) throw new Error(erro.message)
      qc.setQueryData(chaveItens(criada.id), [])
      await qc.invalidateQueries({ queryKey: ["collections"] })
      return criada as Colecao
    })()
    criando.set(def.nome, pronta)
    pronta.catch(() => criando.delete(def.nome))
  }
  return pronta
}

/** Tipos que o import do Notion deduz de colunas vazias ou com exemplo, e que podem virar número ou data. */
const TROCAVEIS = ["text", "select", "rich_text"]
const ajustadas = new Set<string>()

/** Na primeira gravação da sessão, deixa a coleção com as colunas que a tela usa. */
function ajustarColunas(qc: QueryClient, def: DefinicaoColecao, colecao: Colecao) {
  if (ajustadas.has(colecao.id)) return
  ajustadas.add(colecao.id)
  let mudou = false
  const novo: Propriedade[] = esquema(colecao).map((p) => {
    const alvo = def.colunas.find((c) => normalizar(c.name) === normalizar(p.name))
    if (alvo && alvo.type !== p.type && TROCAVEIS.includes(p.type) && alvo.type !== "select") {
      mudou = true
      return { ...p, type: alvo.type }
    }
    return p
  })
  for (const c of def.colunas) {
    if (!novo.some((p) => normalizar(p.name) === normalizar(c.name))) {
      novo.push(c)
      mudou = true
    }
  }
  if (!mudou) return
  enfileirar(qc, null, async () => {
    const { error } = await supabase().from("collections").update({ schema: novo as unknown as Json }).eq("id", colecao.id)
    if (error) throw new Error(error.message)
    void qc.invalidateQueries({ queryKey: ["collections"] })
  })
}

export type CamposItem = Partial<Pick<ItemColecao, "title" | "content" | "cover_path">> & { props?: Record<string, Json> }

/**
 * Criar, mudar e excluir itens das coleções de uma tela. `colecoes` traz as que já existem; as que
 * faltam são criadas na primeira gravação.
 */
export function useGravarItens<T extends string>(definicoes: Record<T, DefinicaoColecao>, colecoes: Partial<Record<T, Colecao | undefined>>) {
  const qc = useQueryClient()

  return React.useMemo(() => {
    const criar = async (tipo: T, dados: CamposItem & { title: string; id?: string; position?: number }): Promise<string> => {
      let colecao: Colecao
      try {
        colecao = await garantirColecao(qc, definicoes[tipo], colecoes[tipo])
      } catch (e) {
        toast.error("Não foi possível criar a coleção.", { description: e instanceof Error ? e.message : undefined })
        throw e
      }
      ajustarColunas(qc, definicoes[tipo], colecao)
      const id = dados.id ?? crypto.randomUUID()
      const agora = new Date().toISOString()
      const linha = {
        id,
        collection_id: colecao.id,
        title: dados.title,
        props: (dados.props ?? {}) as Json,
        content: dados.content ?? null,
        cover_path: dados.cover_path ?? null,
        position: dados.position ?? Date.now(),
      }
      await qc.cancelQueries({ queryKey: chaveLista(colecao.id) })
      const otimista = { user_id: "", notion_id: null, created_at: agora, updated_at: agora, ...linha } as ItemColecao
      mexerNoCache(qc, colecao.id, (lista) => [...lista, otimista])
      if (!qc.getQueryData(chaveItens(colecao.id))) qc.setQueryData(chaveItens(colecao.id), [otimista])
      enfileirar(qc, colecao.id, async () => {
        const { error } = await supabase().from("collection_items").insert(linha)
        if (error) throw new Error(error.message)
      })
      return id
    }

    const mudar = async (item: ItemColecao, mudanca: (atual: ItemColecao) => CamposItem, tipo?: T) => {
      const colecaoId = item.collection_id
      // Uma recarga em andamento traria o estado de antes deste toque
      await qc.cancelQueries({ queryKey: chaveLista(colecaoId) })
      const atual = lerDoCache(qc, colecaoId, item.id) ?? item
      const campos = mudanca(atual)
      const novo = { ...atual, ...campos, updated_at: new Date().toISOString() } as ItemColecao
      mexerNoCache(qc, colecaoId, (lista) => lista.map((i) => (i.id === item.id ? novo : i)))
      if (qc.getQueryData(["collection_items", "um", item.id])) qc.setQueryData(["collection_items", "um", item.id], novo)
      const colecao = tipo ? colecoes[tipo] : undefined
      if (tipo && colecao) ajustarColunas(qc, definicoes[tipo], colecao)
      enfileirar(qc, colecaoId, async () => {
        const { error } = await supabase().from("collection_items").update(campos).eq("id", item.id)
        if (error) throw new Error(error.message)
      })
    }

    /** Muda as propriedades a partir das mais recentes (não perde um toque anterior ainda na fila). */
    const mudarProps = (item: ItemColecao, mudanca: (props: Record<string, Json>) => void, tipo?: T) =>
      mudar(
        item,
        (atual) => {
          const props = { ...((atual.props ?? {}) as Record<string, Json>) }
          mudanca(props)
          return { props }
        },
        tipo,
      )

    const excluir = async (itens: ItemColecao[]) => {
      const porColecao = new Map<string, string[]>()
      for (const i of itens) porColecao.set(i.collection_id, [...(porColecao.get(i.collection_id) ?? []), i.id])
      for (const [colecaoId, ids] of porColecao) {
        await qc.cancelQueries({ queryKey: chaveLista(colecaoId) })
        mexerNoCache(qc, colecaoId, (lista) => lista.filter((i) => !ids.includes(i.id)))
        enfileirar(
          qc,
          colecaoId,
          async () => {
            const { error } = await supabase().from("collection_items").delete().in("id", ids)
            if (error) throw new Error(error.message)
          },
          "Não foi possível excluir.",
        )
      }
    }

    return { criar, mudar, mudarProps, excluir }
  }, [qc, definicoes, colecoes])
}

/** Garante a coleção antes de enviar a foto de um item novo. */
export function useGarantirColecao(def: DefinicaoColecao, existente: Colecao | undefined) {
  const qc = useQueryClient()
  return React.useCallback(() => garantirColecao(qc, def, existente), [qc, def, existente])
}

/* ------------------------------------------------------------------ */
/* Foto de capa                                                        */
/* ------------------------------------------------------------------ */

export const TAMANHO_MAXIMO_FOTO = 20 * 1024 * 1024

/** Envia a foto de um item e devolve o caminho no storage. */
export async function enviarFotoDeItem(arquivo: File, usuarioId: string, colecaoId: string, itemId: string): Promise<string> {
  const { otimizarImagem } = await import("@/lib/otimizar-imagem")
  const pronta = await otimizarImagem(arquivo, { dimensaoMaxima: 1600 })
  const tipo = pronta.type || arquivo.type
  const ext = tipo === "image/jpeg" ? "jpg" : (pronta.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"
  const caminho = `${usuarioId}/colecoes/${colecaoId}/${itemId}-${Date.now()}.${ext}`
  const { error } = await supabase().storage.from(BUCKET_ARQUIVOS).upload(caminho, pronta, { contentType: tipo })
  if (error) throw new Error(error.message)
  // O registro do arquivo é só um índice: se falhar, a foto continua valendo
  await supabase().from("files").insert({ path: caminho, name: arquivo.name, mime: tipo, size: pronta.size, entity_type: "colecao_item", entity_id: itemId })
  return caminho
}
