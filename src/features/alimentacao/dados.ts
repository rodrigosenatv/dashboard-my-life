"use client"

import * as React from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useLista } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import type { Json } from "@/lib/supabase/database.types"
import { formatar, normalizar, numeroFlexivel } from "@/lib/utils"
import type { Colecao, ItemColecao } from "@/features/colecoes/visao-colecao"
import { useConfiguracoes, useSalvarConfiguracoes } from "@/features/configuracoes/dados"
import { semPrefixo, valores } from "@/features/treino/dados"
import { idDoDia, itensDoTexto, itensParaTexto, type ConfigAlimentacao, type RefeicaoLida } from "./texto"

export * from "./texto"

const texto = (v: Json | undefined) => (typeof v === "string" ? v.trim() : "")

/*
 * Alimentação: o plano (refeições com itens), o diário (o que foi marcado em cada dia e a
 * água) e as metas. O plano e o diário são coleções, como o Histórico de treinos; as metas
 * ficam nas preferências da pessoa.
 */

/* ------------------------------------------------------------------ */
/* Coleções                                                            */
/* ------------------------------------------------------------------ */

export const NOME_PLANO = "Plano alimentar"
export const NOME_DIARIO = "Diário alimentar"

const NOMES = {
  plano: [NOME_PLANO],
  diario: [NOME_DIARIO, "Diario alimentar"],
  receitas: ["Receitas"],
  alimentos: ["Alimentos"],
  antigo: ["Refeições", "Refeicoes"],
}

function acharColecao(colecoes: Colecao[], nomes: string[]) {
  const alvo = nomes.map(normalizar)
  const candidatas = colecoes.filter((c) => alvo.includes(semPrefixo(c.name)))
  // Se houver duas com o mesmo nome, vale a que morava na página de alimentação
  return candidatas.find((c) => normalizar(c.description ?? "").includes("aliment")) ?? candidatas[0]
}

export function useColecoesAlimentacao() {
  const { data: colecoes = [], isLoading } = useLista("collections", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  return React.useMemo(
    () => ({
      plano: acharColecao(colecoes, NOMES.plano),
      diario: acharColecao(colecoes, NOMES.diario),
      receitas: acharColecao(colecoes, NOMES.receitas),
      alimentos: acharColecao(colecoes, NOMES.alimentos),
      antigo: acharColecao(colecoes, NOMES.antigo),
      carregando: isLoading,
    }),
    [colecoes, isLoading],
  )
}

/** A mesma chave que `useItensDe` monta, para atualizar a lista na hora (sem esperar a rede). */
export const chaveItens = (colecaoId: string) => ["collection_items", "de", colecaoId, { colunas: "*", ordem: [{ coluna: "position" }, { coluna: "title" }] }]

/* ------------------------------------------------------------------ */
/* Plano                                                               */
/* ------------------------------------------------------------------ */

export type Refeicao = {
  item: ItemColecao
  nome: string
  /** Quando comer: "Ao acordar", "12:00", "Logo após treinar"… */
  quando: string
  objetivo: string
  /** Observação da refeição (ex.: "Shake prático, leve na garrafa térmica"). */
  nota: string
  itens: string[]
}

export function lerRefeicao(item: ItemColecao): Refeicao {
  const v = valores(item)
  return { item, nome: item.title.trim() || "Refeição", quando: texto(v.Quando), objetivo: texto(v.Objetivo), nota: texto(v.Nota), itens: itensDoTexto(item.content) }
}

export const ESQUEMA_PLANO = [
  { name: "Quando", type: "text" },
  { name: "Objetivo", type: "text" },
  { name: "Nota", type: "text" },
]

/* ------------------------------------------------------------------ */
/* Metas e água (preferências)                                         */
/* ------------------------------------------------------------------ */

const PADRAO: ConfigAlimentacao = {
  aguaMeta: 3000,
  marcos: [
    { hora: 10, ml: 1000 },
    { hora: 14, ml: 2000 },
  ],
  metas: {},
}

export function useConfigAlimentacao() {
  const { data, isLoading } = useConfiguracoes()
  const salvarPrefs = useSalvarConfiguracoes()
  const bruto = ((data?.prefs ?? {}) as Record<string, Json>).alimentacao as Partial<ConfigAlimentacao> | undefined
  const config: ConfigAlimentacao = {
    aguaMeta: typeof bruto?.aguaMeta === "number" && bruto.aguaMeta > 0 ? bruto.aguaMeta : PADRAO.aguaMeta,
    marcos: Array.isArray(bruto?.marcos) ? bruto.marcos : PADRAO.marcos,
    metas: bruto?.metas && typeof bruto.metas === "object" ? bruto.metas : PADRAO.metas,
    dicas: typeof bruto?.dicas === "string" ? bruto.dicas : undefined,
  }
  const salvar = (mudancas: Partial<ConfigAlimentacao>) => salvarPrefs.mutate({ prefs: { alimentacao: { ...config, ...mudancas } as unknown as Json } })
  return { config, salvar, carregando: isLoading, existe: Boolean(bruto) }
}

/* ------------------------------------------------------------------ */
/* Diário: um item por dia                                             */
/* ------------------------------------------------------------------ */

export type Dia = {
  data: string
  /** Refeições do plano marcadas (ids). */
  feitas: string[]
  /** Refeições em que comeu outra coisa: id → anotação. */
  diferente: Record<string, string>
  agua: number
}

export const diaVazio = (data: string): Dia => ({ data, feitas: [], diferente: {}, agua: 0 })

export function lerDia(item: ItemColecao): Dia {
  const v = valores(item)
  const diferente = v._diferente && typeof v._diferente === "object" && !Array.isArray(v._diferente) ? (v._diferente as Record<string, Json>) : {}
  return {
    data: typeof v.Data === "string" ? v.Data.slice(0, 10) : item.created_at.slice(0, 10),
    feitas: Array.isArray(v._feitas) ? v._feitas.map(String) : [],
    diferente: Object.fromEntries(Object.entries(diferente).map(([k, x]) => [k, typeof x === "string" ? x : ""])),
    agua: numeroFlexivel(v["Água (ml)"]) ?? 0,
  }
}

/** Os dias registrados, pela data. */
export function indexarDias(itens: ItemColecao[]): Map<string, Dia> {
  const mapa = new Map<string, Dia>()
  for (const i of itens) {
    const d = lerDia(i)
    const antes = mapa.get(d.data)
    // Dois registros no mesmo dia (dois aparelhos sem internet, por exemplo): junta os dois
    mapa.set(
      d.data,
      antes ? { data: d.data, feitas: [...new Set([...antes.feitas, ...d.feitas])], diferente: { ...antes.diferente, ...d.diferente }, agua: Math.max(antes.agua, d.agua) } : d,
    )
  }
  return mapa
}

let criandoDiario: Promise<string> | null = null

/** A coleção do diário: a que existe ou uma nova (uma só, mesmo com toques seguidos). */
export function garantirDiario(qc: QueryClient, existente?: Colecao): Promise<string> {
  if (existente) return Promise.resolve(existente.id)
  criandoDiario ??= (async () => {
    const sb = supabase()
    const { data, error } = await sb.from("collections").select("id, name")
    if (error) throw new Error(error.message)
    const achada = (data ?? []).find((c) => NOMES.diario.map(normalizar).includes(semPrefixo(c.name)))
    if (achada) return achada.id
    const id = crypto.randomUUID()
    const { error: erro } = await sb.from("collections").insert({
      id,
      name: NOME_DIARIO,
      section: "outros",
      description: "Alimentação",
      schema: [
        { name: "Data", type: "date" },
        { name: "Refeições", type: "number" },
        { name: "Água (ml)", type: "number" },
      ] as unknown as Json,
    })
    if (erro) throw new Error(erro.message)
    qc.setQueryData(chaveItens(id), [])
    await qc.invalidateQueries({ queryKey: ["collections"] })
    return id
  })()
  criandoDiario.catch(() => {
    criandoDiario = null
  })
  return criandoDiario
}

let fila: Promise<unknown> = Promise.resolve()
const pendentes = new Map<string, number>()

function lerDoCache(qc: QueryClient, colecaoId: string, id: string): ItemColecao | undefined {
  for (const [, lista] of qc.getQueriesData<ItemColecao[]>({ queryKey: ["collection_items", "de", colecaoId] })) {
    const achado = lista?.find((i) => i.id === id)
    if (achado) return achado
  }
  return undefined
}

/**
 * Muda o registro de um dia. A tela muda na hora; as gravações vão em fila, na ordem dos
 * toques, e a lista só é recarregada quando a fila esvazia (sem piscar).
 */
export function useMudarDia(diario: Colecao | undefined, refeicoes: string[]) {
  const qc = useQueryClient()
  return React.useCallback(
    async (data: string, mudar: (d: Dia) => Dia) => {
      let colecaoId: string
      try {
        colecaoId = await garantirDiario(qc, diario)
      } catch (e) {
        toast.error("Não foi possível criar o diário.", { description: e instanceof Error ? e.message : undefined })
        return
      }
      const id = idDoDia(colecaoId, data)
      const antes = lerDoCache(qc, colecaoId, id)
      const novo = mudar(antes ? lerDia(antes) : diaVazio(data))
      const props: Record<string, Json> = {
        ...(antes ? valores(antes) : {}),
        Data: data,
        Refeições: novo.feitas.filter((f) => refeicoes.includes(f)).length,
        "Água (ml)": novo.agua,
        _feitas: novo.feitas,
        _diferente: novo.diferente,
      }
      const agora = new Date().toISOString()
      const linha = { id, collection_id: colecaoId, title: formatar(data, "d 'de' MMM yyyy"), position: Date.parse(`${data}T12:00`), props }
      const otimista = { ...(antes ?? { user_id: "", notion_id: null, content: null, cover_path: null, created_at: agora }), ...linha, updated_at: agora } as ItemColecao
      qc.setQueriesData<ItemColecao[]>({ queryKey: ["collection_items", "de", colecaoId] }, (lista) =>
        lista ? (lista.some((i) => i.id === id) ? lista.map((i) => (i.id === id ? otimista : i)) : [...lista, otimista]) : lista,
      )
      if (!qc.getQueryData(chaveItens(colecaoId))) qc.setQueryData(chaveItens(colecaoId), [otimista])

      pendentes.set(colecaoId, (pendentes.get(colecaoId) ?? 0) + 1)
      fila = fila
        .then(async () => {
          const { error } = await supabase().from("collection_items").upsert(linha, { onConflict: "id" })
          if (error) throw new Error(error.message)
        })
        .catch((e) => {
          toast.error("Não foi possível salvar a marcação.", { description: e instanceof Error ? e.message : undefined })
        })
        .finally(() => {
          const n = (pendentes.get(colecaoId) ?? 1) - 1
          pendentes.set(colecaoId, n)
          if (n === 0) void qc.invalidateQueries({ queryKey: ["collection_items", "de", colecaoId] })
        })
    },
    [qc, diario, refeicoes],
  )
}


/* ------------------------------------------------------------------ */
/* Montar o plano                                                      */
/* ------------------------------------------------------------------ */

export function propsDaRefeicao(r: { quando: string; objetivo: string; nota: string }): Record<string, Json> {
  const p: Record<string, Json> = {}
  if (r.quando.trim()) p.Quando = r.quando.trim()
  if (r.objetivo.trim()) p.Objetivo = r.objetivo.trim()
  if (r.nota.trim()) p.Nota = r.nota.trim()
  return p
}

/**
 * Grava as refeições num plano: na coleção que já existe ou numa nova. Cria também o
 * diário, para o primeiro toque em "feita" ser imediato.
 */
export async function montarPlano(qc: QueryClient, refeicoes: RefeicaoLida[], existente?: Colecao): Promise<string> {
  const sb = supabase()
  let id = existente?.id
  if (!id) {
    id = crypto.randomUUID()
    const { error } = await sb.from("collections").insert({ id, name: NOME_PLANO, section: "outros", description: "Alimentação", schema: ESQUEMA_PLANO as unknown as Json })
    if (error) throw new Error(error.message)
  }
  if (refeicoes.length) {
    const linhas = refeicoes.map((r, i) => ({ id: crypto.randomUUID(), collection_id: id, title: r.nome, position: i + 1, props: propsDaRefeicao(r), content: itensParaTexto(r.itens) || null }))
    const { error } = await sb.from("collection_items").insert(linhas)
    if (error) throw new Error(error.message)
  }
  await garantirDiario(qc).catch(() => undefined)
  await Promise.all([qc.invalidateQueries({ queryKey: ["collections"] }), qc.invalidateQueries({ queryKey: ["collection_items"] })])
  return id
}
