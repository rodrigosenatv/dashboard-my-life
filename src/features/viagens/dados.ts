"use client"

import * as React from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useLista } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import { BUCKET_ARQUIVOS } from "@/lib/supabase/env"
import type { Json } from "@/lib/supabase/database.types"
import { isoDia, normalizar } from "@/lib/utils"
import { esquema, type Colecao, type ItemColecao, type Propriedade } from "@/features/colecoes/visao-colecao"
import { useConfiguracoes, useSalvarConfiguracoes } from "@/features/configuracoes/dados"
import { semPrefixo, useItensDe } from "@/features/treino/dados"
import { MODELO_MALA, STATUS_SALVO, TIPOS_GASTO, TIPOS_PARADA, campoFeito, lerGasto, lerModelo, lerParada, lerViagem, type ModeloMala, type Viagem } from "./logica"

export * from "./logica"

/* ------------------------------------------------------------------ */
/* Coleções                                                            */
/* ------------------------------------------------------------------ */

export type TipoColecao = "viagens" | "roteiro" | "gastos"

/** Nomes possíveis de cada coleção (as do Notion e as que o app cria). */
const NOMES: Record<TipoColecao, string[]> = {
  viagens: ["Viagens"],
  roteiro: ["Itinerários Viagens", "Itinerarios Viagens", "Roteiro das viagens", "Itinerários"],
  gastos: ["Custos Viagens", "Gastos das viagens", "Custos"],
}

/** Para quem não tem as coleções do Notion: o app cria com estes nomes e campos. */
const NOVAS: Record<TipoColecao, { nome: string; schema: Propriedade[] }> = {
  viagens: {
    nome: "Viagens",
    schema: [
      { name: "Status", type: "select", options: ["Quero ir", "Planejada", "Realizada"] },
      { name: "Ida", type: "date" },
      { name: "Volta", type: "date" },
      { name: "Orçamento Total", type: "number" },
      { name: "Foto", type: "text" },
    ],
  },
  roteiro: {
    nome: "Roteiro das viagens",
    schema: [
      { name: "Data", type: "date" },
      { name: "Hora", type: "text" },
      { name: "Categoria", type: "select", options: TIPOS_PARADA.map((t) => t.rotulo) },
      { name: "Endereço", type: "text" },
      { name: "Observação", type: "text" },
      { name: "Feito", type: "checkbox" },
    ],
  },
  gastos: {
    nome: "Gastos das viagens",
    schema: [
      { name: "Tipo", type: "select", options: TIPOS_GASTO.map((t) => t.rotulo) },
      { name: "Previsto", type: "number" },
      { name: "Realizado", type: "number" },
      { name: "Data", type: "date" },
    ],
  },
}

/** Colunas que as telas gravam: as que faltam entram, e o tipo que o Notion errou é corrigido. */
const COLUNAS: Record<TipoColecao, Propriedade[]> = {
  viagens: [
    { name: "Status", type: "select" },
    { name: "Ida", type: "date" },
    { name: "Volta", type: "date" },
    { name: "Orçamento Total", type: "number" },
  ],
  roteiro: [
    { name: "Data", type: "date" },
    { name: "Hora", type: "text" },
    { name: "Categoria", type: "select" },
    { name: "Endereço", type: "text" },
    { name: "Observação", type: "text" },
  ],
  gastos: [
    { name: "Tipo", type: "select" },
    { name: "Previsto", type: "number" },
    { name: "Realizado", type: "number" },
    { name: "Data", type: "date" },
  ],
}

/** Tipos que o import do Notion deduz de colunas vazias ou com exemplo, e que podem virar número ou data. */
const TROCAVEIS = ["text", "select", "rich_text"]

function acharColecao(colecoes: Colecao[], tipo: TipoColecao) {
  const alvo = NOMES[tipo].map(normalizar)
  // Na ordem dos nomes: "Itinerários Viagens" vale mais que um "Itinerários" qualquer
  for (const nome of alvo) {
    const achada = colecoes.find((c) => semPrefixo(c.name) === nome)
    if (achada) return achada
  }
  return undefined
}

export function useColecoesViagens() {
  const { data: colecoes = [], isLoading } = useLista("collections", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  return React.useMemo(
    () => ({
      viagens: acharColecao(colecoes, "viagens"),
      roteiro: acharColecao(colecoes, "roteiro"),
      gastos: acharColecao(colecoes, "gastos"),
      carregando: isLoading,
    }),
    [colecoes, isLoading],
  )
}

/** As viagens, o roteiro e os gastos, já lidos. */
export function useDadosViagens() {
  const colecoes = useColecoesViagens()
  const qViagens = useItensDe(colecoes.viagens)
  const qRoteiro = useItensDe(colecoes.roteiro)
  const qGastos = useItensDe(colecoes.gastos)
  const hoje = isoDia()
  const doTipo = (lista: ItemColecao[] | undefined, c: Colecao | undefined) => (c ? (lista ?? []).filter((i) => i.collection_id === c.id) : [])
  const viagens = React.useMemo(() => doTipo(qViagens.data, colecoes.viagens).map((i) => lerViagem(i, hoje)), [qViagens.data, colecoes.viagens, hoje])
  const feito = campoFeito(esquema(colecoes.roteiro))
  const paradas = React.useMemo(() => doTipo(qRoteiro.data, colecoes.roteiro).map((i) => lerParada(i, feito)), [qRoteiro.data, colecoes.roteiro, feito])
  const gastos = React.useMemo(() => doTipo(qGastos.data, colecoes.gastos).map(lerGasto), [qGastos.data, colecoes.gastos])
  const carregando =
    colecoes.carregando || (Boolean(colecoes.viagens) && qViagens.isLoading) || (Boolean(colecoes.roteiro) && qRoteiro.isLoading) || (Boolean(colecoes.gastos) && qGastos.isLoading)
  return { colecoes, viagens, paradas, gastos, campoFeito: feito, carregando, erro: qViagens.error ?? qRoteiro.error ?? qGastos.error }
}

/* ------------------------------------------------------------------ */
/* Gravações                                                           */
/* ------------------------------------------------------------------ */

/** A mesma chave que `useItensDe` monta, para a lista aparecer na hora. */
const chaveItens = (colecaoId: string) => ["collection_items", "de", colecaoId, { colunas: "*", ordem: [{ coluna: "position" }, { coluna: "title" }] }]
const chaveLista = (colecaoId: string) => ["collection_items", "de", colecaoId]

// As gravações vão numa fila, na ordem dos toques: marcar três itens da mala seguidos não perde
// nenhum, e um gasto criado e logo marcado como pago chega ao banco nessa ordem.
let fila: Promise<unknown> = Promise.resolve()
let pendentes = 0
const tocadas = new Set<string>()

function enfileirar(qc: QueryClient, colecaoId: string | null, tarefa: () => Promise<void>, erro = "Não foi possível salvar.") {
  pendentes++
  if (colecaoId) tocadas.add(colecaoId)
  fila = fila
    .then(tarefa)
    .catch((e) => {
      toast.error(erro, { description: e instanceof Error ? e.message : undefined })
    })
    .finally(() => {
      pendentes--
      // Só recarrega quando a fila esvazia: no meio dela, o banco ainda não tem tudo
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

const criando = new Map<TipoColecao, Promise<Colecao>>()

/** A coleção que existe ou uma nova (uma só, mesmo com toques seguidos). */
function garantirColecao(qc: QueryClient, tipo: TipoColecao, existente?: Colecao): Promise<Colecao> {
  if (existente) return Promise.resolve(existente)
  let pronta = criando.get(tipo)
  if (!pronta) {
    pronta = (async () => {
      const sb = supabase()
      const { data, error } = await sb.from("collections").select("*")
      if (error) throw new Error(error.message)
      const achada = acharColecao((data ?? []) as Colecao[], tipo)
      if (achada) return achada
      const nova = { id: crypto.randomUUID(), name: NOVAS[tipo].nome, section: "outros", description: "Viagens", schema: NOVAS[tipo].schema as unknown as Json }
      const { data: criada, error: erro } = await sb.from("collections").insert(nova).select().single()
      if (erro) throw new Error(erro.message)
      qc.setQueryData(chaveItens(criada.id), [])
      await qc.invalidateQueries({ queryKey: ["collections"] })
      return criada as Colecao
    })()
    criando.set(tipo, pronta)
    pronta.catch(() => criando.delete(tipo))
  }
  return pronta
}

const ajustadas = new Set<string>()

/** Na primeira gravação da sessão, deixa a coleção com as colunas que a tela usa. */
function ajustarColunas(qc: QueryClient, tipo: TipoColecao, colecao: Colecao) {
  if (ajustadas.has(colecao.id)) return
  ajustadas.add(colecao.id)
  let mudou = false
  const novo: Propriedade[] = esquema(colecao).map((p) => {
    const alvo = COLUNAS[tipo].find((c) => normalizar(c.name) === normalizar(p.name))
    if (alvo && alvo.type !== p.type && TROCAVEIS.includes(p.type) && alvo.type !== "select") {
      mudou = true
      return { ...p, type: alvo.type }
    }
    return p
  })
  for (const c of COLUNAS[tipo]) {
    if (!novo.some((p) => normalizar(p.name) === normalizar(c.name))) {
      novo.push(c)
      mudou = true
    }
  }
  if (tipo === "roteiro" && !novo.some((p) => p.type === "checkbox")) {
    novo.push({ name: "Feito", type: "checkbox" })
    mudou = true
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
 * Criar, mudar e excluir viagens, itens do roteiro e gastos. A tela muda na hora; o banco
 * recebe na ordem, em fila.
 */
export function useGravarViagens() {
  const qc = useQueryClient()
  const colecoes = useColecoesViagens()

  return React.useMemo(() => {
    const criar = async (tipo: TipoColecao, dados: CamposItem & { title: string; id?: string }): Promise<string> => {
      let colecao: Colecao
      try {
        colecao = await garantirColecao(qc, tipo, colecoes[tipo])
      } catch (e) {
        toast.error("Não foi possível criar a coleção.", { description: e instanceof Error ? e.message : undefined })
        throw e
      }
      ajustarColunas(qc, tipo, colecao)
      const id = dados.id ?? crypto.randomUUID()
      const agora = new Date().toISOString()
      const linha = {
        id,
        collection_id: colecao.id,
        title: dados.title,
        props: (dados.props ?? {}) as Json,
        content: dados.content ?? null,
        cover_path: dados.cover_path ?? null,
        position: Date.now(),
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

    const mudar = async (item: ItemColecao, mudanca: (atual: ItemColecao) => CamposItem, tipo?: TipoColecao) => {
      const colecaoId = item.collection_id
      // Uma recarga em andamento traria o estado de antes deste toque
      await qc.cancelQueries({ queryKey: chaveLista(colecaoId) })
      const atual = lerDoCache(qc, colecaoId, item.id) ?? item
      const campos = mudanca(atual)
      const novo = { ...atual, ...campos, updated_at: new Date().toISOString() } as ItemColecao
      mexerNoCache(qc, colecaoId, (lista) => lista.map((i) => (i.id === item.id ? novo : i)))
      if (qc.getQueryData(["collection_items", "um", item.id])) qc.setQueryData(["collection_items", "um", item.id], novo)
      if (tipo && colecoes[tipo]) ajustarColunas(qc, tipo, colecoes[tipo]!)
      enfileirar(qc, colecaoId, async () => {
        const { error } = await supabase().from("collection_items").update(campos).eq("id", item.id)
        if (error) throw new Error(error.message)
      })
    }

    /** Muda as propriedades a partir das mais recentes (não perde um toque anterior ainda na fila). */
    const mudarProps = (item: ItemColecao, mudanca: (props: Record<string, Json>) => void, tipo?: TipoColecao) =>
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
  }, [qc, colecoes])
}

/**
 * Mantém o Status gravado de acordo com as datas (uma viagem planejada vira realizada depois da
 * volta), para as tabelas mostrarem o certo. Uma vez por viagem e por sessão.
 */
const sincronizadas = new Set<string>()
export function useSincronizarStatus(viagens: Viagem[], mudarProps: ReturnType<typeof useGravarViagens>["mudarProps"]) {
  React.useEffect(() => {
    for (const v of viagens) {
      if (!v.ida || sincronizadas.has(v.id)) continue
      sincronizadas.add(v.id)
      const salvo = ((v.item.props ?? {}) as Record<string, Json>).Status
      if (salvo !== STATUS_SALVO[v.situacao]) void mudarProps(v.item, (p) => void (p.Status = STATUS_SALVO[v.situacao]))
    }
  }, [viagens, mudarProps])
}

/* ------------------------------------------------------------------ */
/* Foto de capa                                                        */
/* ------------------------------------------------------------------ */

export const TAMANHO_MAXIMO_FOTO = 20 * 1024 * 1024

/** Envia a foto da viagem e devolve o caminho no storage. */
export async function enviarFotoViagem(arquivo: File, usuarioId: string, colecaoId: string, viagemId: string): Promise<string> {
  const { otimizarImagem } = await import("@/lib/otimizar-imagem")
  const pronta = await otimizarImagem(arquivo, { dimensaoMaxima: 1600 })
  const tipo = pronta.type || arquivo.type
  const ext = tipo === "image/jpeg" ? "jpg" : (pronta.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"
  const caminho = `${usuarioId}/colecoes/${colecaoId}/${viagemId}-${Date.now()}.${ext}`
  const { error } = await supabase().storage.from(BUCKET_ARQUIVOS).upload(caminho, pronta, { contentType: tipo })
  if (error) throw new Error(error.message)
  // O registro do arquivo é só um índice: se falhar, a foto continua valendo
  await supabase().from("files").insert({ path: caminho, name: arquivo.name, mime: tipo, size: pronta.size, entity_type: "colecao_item", entity_id: viagemId })
  return caminho
}

/** Garante a coleção de viagens antes de enviar a foto de uma viagem nova. */
export function useGarantirColecaoViagens() {
  const qc = useQueryClient()
  const { viagens } = useColecoesViagens()
  return React.useCallback(() => garantirColecao(qc, "viagens", viagens), [qc, viagens])
}

/* ------------------------------------------------------------------ */
/* Modelo da mala (preferências)                                       */
/* ------------------------------------------------------------------ */

export function useModeloMala() {
  const { data } = useConfiguracoes()
  const salvar = useSalvarConfiguracoes()
  const bruto = ((data?.prefs ?? {}) as Record<string, Json>).viagens
  const prefs = bruto && typeof bruto === "object" && !Array.isArray(bruto) ? (bruto as Record<string, Json>) : {}
  const proprio = lerModelo(prefs.mala)
  const salvarModelo = (modelo: ModeloMala) => salvar.mutate({ prefs: { viagens: { ...prefs, mala: modelo as unknown as Json } } })
  return { modelo: proprio ?? MODELO_MALA, proprio: Boolean(proprio), salvarModelo, salvando: salvar.isPending }
}
