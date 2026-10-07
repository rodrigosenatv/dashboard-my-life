"use client"

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "./supabase/client"
import type {
  TableName,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./supabase/database.types"

/* eslint-disable @typescript-eslint/no-explicit-any */

const PAGINA = 1000

type Resposta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/** Busca todas as linhas, página por página (o Supabase devolve no máximo 1000 por vez). */
export async function buscarTodos<T>(montar: (de: number, ate: number) => Resposta<T>): Promise<T[]> {
  const todos: T[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await montar(de, de + PAGINA - 1)
    if (error) throw new Error(error.message)
    const lote = data ?? []
    todos.push(...lote)
    if (lote.length < PAGINA) break
  }
  return todos
}

export type Ordem = { coluna: string; asc?: boolean }

export type OpcoesLista = {
  colunas?: string
  ordem?: Ordem[]
  filtro?: (q: any) => any
  chave?: unknown[]
  enabled?: boolean
}

// Coluna usada para desempatar a ordem (paginação estável).
const DESEMPATE: Partial<Record<TableName, string>> = {
  capture_projects: "capture_id",
  settings: "user_id",
}

/** Lista completa de uma tabela, com cache compartilhado pela chave [tabela, ...chave]. */
export function useLista<T extends TableName>(tabela: T, opcoes: OpcoesLista = {}) {
  const { colunas = "*", ordem = [], filtro, chave = [], enabled } = opcoes
  return useQuery({
    queryKey: [tabela, ...chave],
    enabled,
    queryFn: () =>
      buscarTodos<Tables<T>>((de, ate) => {
        let q: any = (supabase().from(tabela) as any).select(colunas)
        if (filtro) q = filtro(q)
        for (const o of ordem) q = q.order(o.coluna, { ascending: o.asc ?? true, nullsFirst: false })
        q = q.order(DESEMPATE[tabela] ?? "id", { ascending: true })
        return q.range(de, ate)
      }),
  })
}

/** Uma linha pelo id. */
export function useRegistro<T extends TableName>(
  tabela: T,
  id: string | null | undefined,
  extra?: Partial<UseQueryOptions<Tables<T> | null>>,
) {
  return useQuery({
    queryKey: [tabela, "um", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await (supabase().from(tabela) as any).select("*").eq("id", id).maybeSingle()
      if (error) throw new Error(error.message)
      return (data ?? null) as Tables<T> | null
    },
    ...extra,
  })
}

/* ------------------------------------------------------------------ */
/* Cache otimista                                                      */
/* ------------------------------------------------------------------ */

type Snapshot = [readonly unknown[], unknown][]

function capturar(qc: QueryClient, tabela: string): Snapshot {
  return qc.getQueriesData({ queryKey: [tabela] }) as Snapshot
}

function restaurar(qc: QueryClient, snap: Snapshot) {
  for (const [chave, dados] of snap) qc.setQueryData(chave, dados)
}

function aplicarNasListas(qc: QueryClient, tabela: string, fn: (lista: any[]) => any[]) {
  for (const [chave, dados] of qc.getQueriesData({ queryKey: [tabela] })) {
    if (Array.isArray(dados)) qc.setQueryData(chave, fn(dados))
  }
}

function aplicarNosRegistros(qc: QueryClient, tabela: string, id: string, fn: (r: any) => any) {
  const chave = [tabela, "um", id]
  const atual = qc.getQueryData(chave)
  if (atual) qc.setQueryData(chave, fn(atual))
}

function falha(acao: string, erro: unknown) {
  const msg = erro instanceof Error ? erro.message : String(erro)
  toast.error(`Não foi possível ${acao}.`, { description: msg })
}

/* ------------------------------------------------------------------ */
/* Mutações                                                            */
/* ------------------------------------------------------------------ */

export function novoId(): string {
  return crypto.randomUUID()
}

/** Cria uma linha. O id é gerado no navegador para a tela atualizar na hora. */
export function useCriar<T extends TableName>(tabela: T, opcoes: { invalidar?: string[] } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (linha: TablesInsert<T>) => {
      const { data, error } = await (supabase().from(tabela) as any).insert(linha).select().single()
      if (error) throw new Error(error.message)
      return data as Tables<T>
    },
    onMutate: async (linha) => {
      await qc.cancelQueries({ queryKey: [tabela] })
      const snap = capturar(qc, tabela)
      const agora = new Date().toISOString()
      const otimista = { created_at: agora, updated_at: agora, ...linha }
      aplicarNasListas(qc, tabela, (lista) => [...lista, otimista])
      return { snap }
    },
    onError: (erro, _v, ctx) => {
      if (ctx?.snap) restaurar(qc, ctx.snap)
      falha("salvar", erro)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [tabela] })
      for (const t of opcoes.invalidar ?? []) qc.invalidateQueries({ queryKey: [t] })
    },
  })
}

export type Patch<T extends TableName> = TablesUpdate<T> & { id: string }

/** Atualiza campos de uma linha pelo id. */
export function useAtualizar<T extends TableName>(tabela: T, opcoes: { invalidar?: string[]; silencioso?: boolean } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...campos }: Patch<T>) => {
      const { data, error } = await (supabase().from(tabela) as any).update(campos).eq("id", id).select().single()
      if (error) throw new Error(error.message)
      return data as Tables<T>
    },
    onMutate: async ({ id, ...campos }) => {
      await qc.cancelQueries({ queryKey: [tabela] })
      const snap = capturar(qc, tabela)
      aplicarNasListas(qc, tabela, (lista) => lista.map((r) => (r?.id === id ? { ...r, ...campos } : r)))
      aplicarNosRegistros(qc, tabela, id, (r) => ({ ...r, ...campos }))
      return { snap }
    },
    onError: (erro, _v, ctx) => {
      if (ctx?.snap) restaurar(qc, ctx.snap)
      falha("atualizar", erro)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [tabela] })
      for (const t of opcoes.invalidar ?? []) qc.invalidateQueries({ queryKey: [t] })
    },
  })
}

/** Exclui uma linha pelo id. */
export function useExcluir<T extends TableName>(tabela: T, opcoes: { invalidar?: string[] } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase().from(tabela) as any).delete().eq("id", id)
      if (error) throw new Error(error.message)
      return id
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: [tabela] })
      const snap = capturar(qc, tabela)
      aplicarNasListas(qc, tabela, (lista) => lista.filter((r) => r?.id !== id))
      return { snap }
    },
    onError: (erro, _v, ctx) => {
      if (ctx?.snap) restaurar(qc, ctx.snap)
      falha("excluir", erro)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [tabela] })
      for (const t of opcoes.invalidar ?? []) qc.invalidateQueries({ queryKey: [t] })
    },
  })
}

/** Agrupa as três operações de uma tabela. */
export function useCrud<T extends TableName>(tabela: T, opcoes: { invalidar?: string[] } = {}) {
  return {
    criar: useCriar(tabela, opcoes),
    atualizar: useAtualizar(tabela, opcoes),
    excluir: useExcluir(tabela, opcoes),
  }
}
