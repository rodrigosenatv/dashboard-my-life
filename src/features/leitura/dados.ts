"use client"

import * as React from "react"
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useLista, useAtualizar } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import { BUCKET_ARQUIVOS } from "@/lib/supabase/env"
import type { Json, Tables, TablesUpdate } from "@/lib/supabase/database.types"
import { acharColecao, chaveLista, garantirColecao, type DefinicaoColecao } from "@/features/colecoes/gravacao"
import type { ItemColecao } from "@/features/colecoes/visao-colecao"
import { useConfiguracoes, useSalvarConfiguracoes } from "@/features/configuracoes/dados"
import { useItensDe } from "@/features/treino/dados"
import { detalhesGoogle } from "./catalogo"
import { diaIso, googleIdDaCapa, lerDiaLeitura, registroDoDia, type DiaLeitura } from "./logica"

export type Livro = Tables<"books">

// Colunas das listas de livros: tudo menos `notes` e `summary`, que são textos longos
// e só aparecem na tela do livro (que busca o registro inteiro).
export const COLUNAS_LIVRO_LISTA =
  "id,notion_id,title,author,category,status,pages_total,pages_read,rating,started_at,finished_at,read_years,favorite,cover_path,created_at,updated_at"

/** Todos os livros (sem os textos longos), por título. */
export function useLivros() {
  return useLista("books", { colunas: COLUNAS_LIVRO_LISTA, ordem: [{ coluna: "title" }] })
}

/* ------------------------------------------------------------------ */
/* Diário de leitura (coleção que o app cria)                          */
/* ------------------------------------------------------------------ */

/** Um item por livro e por dia: a página em que o dia começou, a última e quantas foram lidas. */
export const DEF_DIARIO: DefinicaoColecao = {
  nomes: ["Diário de leitura"],
  nome: "Diário de leitura",
  descricao: "Leitura",
  schema: [
    { name: "Data", type: "date" },
    { name: "Páginas", type: "number" },
    { name: "Até a página", type: "number" },
  ],
  colunas: [
    { name: "Data", type: "date" },
    { name: "Páginas", type: "number" },
    { name: "Até a página", type: "number" },
  ],
}

export function useColecaoDiario() {
  const { data: colecoes = [], isLoading } = useLista("collections", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  return { colecao: React.useMemo(() => acharColecao(colecoes, DEF_DIARIO.nomes), [colecoes]), carregando: isLoading }
}

/** Os dias de leitura (de todos os livros), do mais recente para o mais antigo. */
export function useDiarioLeitura() {
  const { colecao, carregando } = useColecaoDiario()
  const q = useItensDe(colecao)
  const dias = React.useMemo(
    () =>
      (q.data ?? [])
        .filter((i) => i.collection_id === colecao?.id)
        .map(lerDiaLeitura)
        .filter((d): d is DiaLeitura => d !== null)
        .sort((a, b) => b.dia.localeCompare(a.dia)),
    [q.data, colecao?.id],
  )
  return { colecao, dias, carregando: carregando || (Boolean(colecao) && q.isLoading) }
}

// Um registro por vez: o leitor e a tela podem mudar a página ao mesmo tempo
let filaDiario: Promise<unknown> = Promise.resolve()

/**
 * Anota no diário que a página do livro foi de `antes` para `depois` hoje. Cria a coleção na primeira
 * vez. Falhas não atrapalham a leitura (o progresso do livro já foi salvo).
 */
export function registrarLeitura(qc: QueryClient, livro: Pick<Livro, "id" | "title">, antes: number, depois: number, dia = diaIso()): Promise<void> {
  if (depois === antes) return Promise.resolve()
  const tarefa = filaDiario.then(async () => {
    try {
      const colecao = await garantirColecao(qc, DEF_DIARIO)
      const sb = supabase()
      const { data: achados, error } = await sb
        .from("collection_items")
        .select("id, title, props")
        .eq("collection_id", colecao.id)
        .eq("props->>_livro", livro.id)
        .eq("props->>Data", dia)
        .limit(1)
      if (error) throw new Error(error.message)
      const existente = achados?.[0]
      const atual = existente ? lerDiaLeitura(existente) : null
      const novo = registroDoDia(atual, antes, depois)
      if (!novo) return
      const props = {
        ...((existente?.props ?? {}) as Record<string, Json>),
        Data: dia,
        "Páginas": novo.paginas,
        "Até a página": novo.ate,
        _inicio: novo.inicio,
        _livro: livro.id,
      }
      const { error: erro } = existente
        ? await sb.from("collection_items").update({ props, title: livro.title }).eq("id", existente.id)
        : await sb.from("collection_items").insert({ id: crypto.randomUUID(), collection_id: colecao.id, title: livro.title, props, position: Date.now() })
      if (erro) throw new Error(erro.message)
      void qc.invalidateQueries({ queryKey: chaveLista(colecao.id) })
    } catch (e) {
      console.warn("Diário de leitura:", e)
    }
  })
  filaDiario = tarefa
  return tarefa
}

/* ------------------------------------------------------------------ */
/* Progresso                                                           */
/* ------------------------------------------------------------------ */

export type MudancaProgresso = {
  pagina: number
  /** Total de páginas, quando a pessoa informou ou corrigiu na mesma hora. */
  total?: number | null
  terminou?: boolean
}

export type ResultadoProgresso = { terminou: boolean; paginas: number; desfazer: () => void }

/**
 * Muda a página do livro (e a situação, se terminou ou começou agora) e anota no diário. A tela
 * muda na hora; o diário é gravado em seguida. Devolve como desfazer.
 */
export function useAtualizarProgresso() {
  const qc = useQueryClient()
  const atualizar = useAtualizar("books")
  return React.useCallback(
    (livro: Livro, { pagina, total, terminou }: MudancaProgresso): ResultadoProgresso => {
      const hoje = diaIso()
      const ano = new Date().getFullYear()
      const totalNovo = total !== undefined ? total : livro.pages_total
      const fim = Boolean(terminou) || (totalNovo ? pagina >= totalNovo : false)
      const final = fim && totalNovo ? totalNovo : pagina
      const antesPagina = livro.pages_read ?? 0
      const campos: TablesUpdate<"books"> = { pages_read: final }
      if (total !== undefined && total !== livro.pages_total) campos.pages_total = total
      if (fim) {
        campos.status = "finalizado"
        campos.finished_at = hoje
        campos.read_years = [...new Set([...(livro.read_years ?? []), ano])].sort((a, b) => a - b)
      } else if (livro.status === "desejo" || (livro.status === "pausado" && final !== antesPagina)) {
        campos.status = "lendo"
      }
      if (!livro.started_at && final > 0) campos.started_at = hoje
      atualizar.mutate({ id: livro.id, ...campos })
      void registrarLeitura(qc, livro, antesPagina, final, hoje)
      const anterior: TablesUpdate<"books"> = {}
      for (const chave of Object.keys(campos) as (keyof TablesUpdate<"books">)[]) {
        ;(anterior as Record<string, unknown>)[chave] = (livro as Record<string, unknown>)[chave] ?? null
      }
      return {
        terminou: fim,
        paginas: final - antesPagina,
        desfazer: () => {
          atualizar.mutate({ id: livro.id, ...anterior })
          void registrarLeitura(qc, livro, final, antesPagina, hoje)
        },
      }
    },
    [qc, atualizar],
  )
}

/** Muda a situação do livro (começar, pausar, retomar, voltar para a fila), com as datas certas. */
export function camposDaSituacao(livro: Livro, status: string): TablesUpdate<"books"> {
  const hoje = diaIso()
  const campos: TablesUpdate<"books"> = { status }
  if (status === "lendo" && !livro.started_at) campos.started_at = hoje
  if (status === "finalizado") {
    campos.finished_at = livro.finished_at ?? hoje
    campos.read_years = [...new Set([...(livro.read_years ?? []), new Date().getFullYear()])].sort((a, b) => a - b)
    if (livro.pages_total) campos.pages_read = livro.pages_total
  }
  return campos
}

/* ------------------------------------------------------------------ */
/* Meta do ano (settings.prefs.leitura.metas)                          */
/* ------------------------------------------------------------------ */

type PrefsLeitura = { metas?: Record<string, number> }

function prefsLeitura(prefs: Json | null | undefined): PrefsLeitura {
  const bruto = ((prefs ?? {}) as Record<string, Json>).leitura
  return bruto && typeof bruto === "object" && !Array.isArray(bruto) ? (bruto as unknown as PrefsLeitura) : {}
}

export function useMetaLeitura(ano: number) {
  const { data } = useConfiguracoes()
  const salvar = useSalvarConfiguracoes()
  const leitura = prefsLeitura(data?.prefs)
  const meta = Number(leitura.metas?.[String(ano)]) || 0
  const definir = React.useCallback(
    (n: number) => {
      const metas = { ...(leitura.metas ?? {}), [String(ano)]: Math.max(0, Math.min(999, Math.round(n))) }
      salvar.mutate({ prefs: { leitura: { ...leitura, metas } as unknown as Json } })
    },
    [salvar, leitura, ano],
  )
  return { meta, definir, salvando: salvar.isPending }
}

/* ------------------------------------------------------------------ */
/* Capas                                                               */
/* ------------------------------------------------------------------ */

/** Tipo de entidade das fotos de capa enviadas (tabela `files`). */
export const ENTIDADE_CAPA = "livro_capa"

/** Envia a foto da capa (reduzida) e devolve o caminho no storage. */
export async function enviarCapaDoLivro(arquivo: File, livroId: string): Promise<string> {
  const { otimizarImagem } = await import("@/lib/otimizar-imagem")
  const sb = supabase()
  const { data: sessao } = await sb.auth.getSession()
  const usuario = sessao.session?.user.id
  if (!usuario) throw new Error("Sua sessão expirou. Entre de novo para enviar a foto.")
  const pronta = await otimizarImagem(arquivo, { dimensaoMaxima: 1200 })
  const tipo = pronta.type || arquivo.type
  const ext = tipo === "image/jpeg" ? "jpg" : tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "avif"
  const caminho = `${usuario}/livros/${livroId}/capa-${Date.now()}.${ext}`
  const { error } = await sb.storage.from(BUCKET_ARQUIVOS).upload(caminho, pronta, { contentType: tipo })
  if (error) throw new Error(error.message)
  // O registro é só um índice: se falhar, a capa continua valendo
  await sb.from("files").insert({ path: caminho, name: arquivo.name, mime: tipo, size: pronta.size, entity_type: ENTIDADE_CAPA, entity_id: livroId })
  return caminho
}

/** Apaga as fotos de capa enviadas para o livro (menos a que continua em uso). */
export async function apagarCapasEnviadas(livroId: string, manter?: string | null) {
  const sb = supabase()
  const { data } = await sb.from("files").select("id, path").eq("entity_type", ENTIDADE_CAPA).eq("entity_id", livroId)
  const sobrando = (data ?? []).filter((f) => f.path !== manter)
  if (!sobrando.length) return
  await sb.storage.from(BUCKET_ARQUIVOS).remove(sobrando.map((f) => f.path))
  await sb
    .from("files")
    .delete()
    .in(
      "id",
      sobrando.map((f) => f.id),
    )
}

/** Sinopse e detalhes do Google Books para um livro cuja capa veio de lá (guardados por um dia). */
export function useDetalhesDoLivro(coverPath: string | null | undefined) {
  const googleId = googleIdDaCapa(coverPath)
  return useQuery({
    queryKey: ["google-books", googleId],
    enabled: Boolean(googleId),
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
    meta: { silencioso: true },
    queryFn: ({ signal }) => detalhesGoogle(googleId!, signal),
  })
}

/** Aviso padrão quando uma gravação de capa falha. */
export function avisarFalhaCapa(e: unknown) {
  toast.error("Não foi possível trocar a capa.", { description: e instanceof Error ? e.message : undefined })
}

export type { DiaLeitura, ItemColecao }
