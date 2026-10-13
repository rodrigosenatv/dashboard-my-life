"use client"

import * as React from "react"
import { supabase } from "@/lib/supabase/client"
import type { Json } from "@/lib/supabase/database.types"
import { formatar, isoDia, normalizar } from "@/lib/utils"
import type { Colecao, ItemColecao } from "@/features/colecoes/visao-colecao"
import { NOMES_HISTORICO, ehHabitoDeTreino, kg, lerFicha, numeroDe, semPrefixo, useItensDe, valores, type Exercicio, type Ficha } from "./dados"

/*
 * O treino em andamento fica no aparelho (localStorage): sobrevive a recarregar a página,
 * a fechar o app e à falta de internet na academia. Só ao terminar ele vai para o app,
 * como um item da coleção "Histórico de treinos", com as séries dentro.
 */

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export type Marca = { peso: number | null; reps: number | null }
export type SerieFeita = Marca & { exercicio: string; nome: string; em: string }

export type ExercicioPlano = {
  id: string
  nome: string
  series: number | null
  reps: number | null
  nota: string
  /** Copiados ao começar, para o modo treino funcionar sem internet. */
  ultima?: { data: string; series: Marca[] }
  recorde?: Marca & { data: string }
  /** Link do vídeo da execução (YouTube). */
  video?: string
}

export type SessaoAtiva = {
  versao: 1
  id: string
  ficha: string
  inicio: string
  exercicios: ExercicioPlano[]
  series: SerieFeita[]
  atual: number
  /** Quando o descanso em curso termina (milissegundos). */
  descansoAte?: number
  fim?: string
  dificuldade?: string
  /** Terminou, mas ainda não foi para o app (sem internet, por exemplo). */
  pendente?: boolean
}

/** "40 kg × 10", "12 rep." (sem carga) ou "40 kg". */
export function marcaTexto(m: Marca): string {
  if (m.peso !== null && m.reps !== null) return `${kg(m.peso)} × ${m.reps}`
  if (m.peso !== null) return kg(m.peso)
  if (m.reps !== null) return `${m.reps} rep.`
  return "–"
}

/** A série mais pesada (na dúvida, a primeira). */
export const maisPesada = (series: Marca[]): Marca | undefined =>
  series.reduce<Marca | undefined>((m, x) => (!m || (x.peso ?? -1) > (m.peso ?? -1) ? x : m), undefined)

export type SessaoSalva = {
  item: ItemColecao
  data: string
  inicio: string
  ficha: string
  duracao: number | null
  dificuldade: string
  series: SerieFeita[]
  volume: number
}

/* ------------------------------------------------------------------ */
/* Treino em andamento, guardado no aparelho                           */
/* ------------------------------------------------------------------ */

const CHAVE = "treino:sessao"
let memoria: SessaoAtiva | null | undefined
const ouvintes = new Set<() => void>()

function carregar(): SessaoAtiva | null {
  try {
    const bruto = localStorage.getItem(CHAVE)
    const v = bruto ? (JSON.parse(bruto) as SessaoAtiva) : null
    return v && v.versao === 1 && Array.isArray(v.exercicios) && Array.isArray(v.series) ? v : null
  } catch {
    return null
  }
}

export function lerSessao(): SessaoAtiva | null {
  if (memoria === undefined) memoria = carregar()
  return memoria
}

export function gravarSessao(s: SessaoAtiva | null) {
  memoria = s
  try {
    if (s) localStorage.setItem(CHAVE, JSON.stringify(s))
    else localStorage.removeItem(CHAVE)
  } catch {
    /* sem armazenamento: o treino fica só na memória desta aba */
  }
  ouvintes.forEach((f) => f())
}

export function mudarSessao(f: (s: SessaoAtiva) => SessaoAtiva) {
  const atual = lerSessao()
  if (atual) gravarSessao(f(atual))
}

function assinar(aviso: () => void) {
  ouvintes.add(aviso)
  const deOutraAba = (e: StorageEvent) => {
    if (e.key !== CHAVE) return
    memoria = undefined
    aviso()
  }
  window.addEventListener("storage", deOutraAba)
  return () => {
    ouvintes.delete(aviso)
    window.removeEventListener("storage", deOutraAba)
  }
}

export function useSessaoAtiva() {
  return React.useSyncExternalStore(assinar, lerSessao, () => null)
}

/* ------------------------------------------------------------------ */
/* Histórico: o que já foi feito                                       */
/* ------------------------------------------------------------------ */

export const ESQUEMA_HISTORICO = [
  { name: "Data", type: "date" },
  { name: "Ficha", type: "select" },
  { name: "Duração (min)", type: "number" },
  { name: "Séries", type: "number" },
  { name: "Volume (kg)", type: "number" },
  { name: "Dificuldade", type: "select" },
]

export const DIFICULDADES = ["Fácil", "Médio", "Difícil"]

function lerSeries(v: Json | undefined): SerieFeita[] {
  if (!Array.isArray(v)) return []
  const saida: SerieFeita[] = []
  for (const x of v) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue
    const s = x as Record<string, Json>
    saida.push({ exercicio: String(s.exercicio ?? ""), nome: String(s.nome ?? ""), peso: numeroDe(s.peso), reps: numeroDe(s.reps), em: String(s.em ?? "") })
  }
  return saida
}

export function lerSessaoSalva(item: ItemColecao): SessaoSalva {
  const v = valores(item)
  const series = lerSeries(v._series)
  const data = typeof v.Data === "string" && v.Data ? v.Data.slice(0, 10) : item.created_at.slice(0, 10)
  return {
    item,
    data,
    inicio: typeof v._inicio === "string" ? v._inicio : item.created_at,
    ficha: typeof v.Ficha === "string" ? v.Ficha : "",
    duracao: numeroDe(v["Duração (min)"]),
    dificuldade: typeof v.Dificuldade === "string" ? v.Dificuldade : "",
    series,
    volume: series.reduce((t, s) => t + (s.peso ?? 0) * (s.reps ?? 0), 0),
  }
}

/** Mais antigo primeiro. */
export function ordenarSessoes(lista: SessaoSalva[]): SessaoSalva[] {
  return [...lista].sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio))
}

export type HistoricoExercicio = { ultima?: { data: string; series: Marca[] }; recorde?: Marca & { data: string } }

const chaveNome = (nome: string) => `nome:${normalizar(nome)}`

/** Para cada exercício (pelo id e pelo nome): a última vez que foi feito e o maior peso. */
export function indexarHistorico(sessoes: SessaoSalva[]): Map<string, HistoricoExercicio> {
  const indice = new Map<string, HistoricoExercicio>()
  for (const s of sessoes) {
    const porExercicio = new Map<string, SerieFeita[]>()
    for (const serie of s.series) {
      const k = serie.exercicio || chaveNome(serie.nome)
      porExercicio.set(k, [...(porExercicio.get(k) ?? []), serie])
    }
    for (const lista of porExercicio.values()) {
      const chaves = [lista[0].exercicio, lista[0].nome ? chaveNome(lista[0].nome) : ""].filter(Boolean)
      for (const k of chaves) {
        const h: HistoricoExercicio = { ...indice.get(k) }
        h.ultima = { data: s.data, series: lista.map(({ peso, reps }) => ({ peso, reps })) }
        for (const x of lista) {
          if (x.peso === null) continue
          const r = h.recorde
          if (!r || r.peso === null || x.peso > r.peso || (x.peso === r.peso && (x.reps ?? 0) > (r.reps ?? 0))) h.recorde = { peso: x.peso, reps: x.reps, data: s.data }
        }
        indice.set(k, h)
      }
    }
  }
  return indice
}

export function historicoDe(indice: Map<string, HistoricoExercicio>, id: string, nome: string): HistoricoExercicio | undefined {
  return indice.get(id) ?? indice.get(chaveNome(nome))
}

/** Os treinos registrados, do mais antigo ao mais novo, e o índice por exercício. */
export function useHistoricoTreino(colecao: Colecao | undefined) {
  const { data: itens = [], isLoading } = useItensDe(colecao)
  const sessoes = React.useMemo(() => ordenarSessoes(itens.map(lerSessaoSalva)), [itens])
  const indice = React.useMemo(() => indexarHistorico(sessoes), [sessoes])
  return { sessoes, indice, carregando: Boolean(colecao) && isLoading }
}

/** A ficha que vem depois da última feita (A, B, C, D e volta para A). */
export function proximaFicha(fichas: Ficha[], sessoes: SessaoSalva[]): Ficha | undefined {
  if (!fichas.length) return undefined
  const ultima = sessoes.at(-1)
  const i = ultima ? fichas.findIndex((f) => f.valor === ultima.ficha) : -1
  return fichas[(i + 1) % fichas.length]
}

/** "Treino A · Empurra" */
export function rotuloDaFicha(valor: string): string {
  const f = lerFicha(valor)
  const nome = f.letra.length <= 3 ? `Treino ${f.letra}` : f.letra
  return f.foco ? `${nome} · ${f.foco}` : nome
}

/* ------------------------------------------------------------------ */
/* Começar, resumir e salvar                                           */
/* ------------------------------------------------------------------ */

export function novaSessao(ficha: Ficha, exercicios: Exercicio[], indice: Map<string, HistoricoExercicio>): SessaoAtiva {
  return {
    versao: 1,
    id: crypto.randomUUID(),
    ficha: ficha.valor,
    inicio: new Date().toISOString(),
    atual: 0,
    series: [],
    exercicios: exercicios.map((e) => {
      const h = historicoDe(indice, e.item.id, e.nome)
      return {
        id: e.item.id,
        nome: e.nome,
        series: e.series,
        reps: e.reps,
        nota: e.nota,
        ...(h?.ultima ? { ultima: h.ultima } : {}),
        ...(h?.recorde ? { recorde: h.recorde } : {}),
        ...(e.video ? { video: e.video } : {}),
      }
    }),
  }
}

/** Séries feitas de um exercício neste treino, com a posição de cada uma na lista geral. */
export const seriesDe = (s: SessaoAtiva, exercicio: string) =>
  s.series.map((serie, i) => ({ ...serie, i })).filter((serie) => serie.exercicio === exercicio)

/** Peso que bate o recorde de antes do treino e o das séries anteriores deste treino. */
export function bateRecorde(ex: ExercicioPlano, anteriores: Marca[], peso: number | null): boolean {
  if (peso === null || ex.recorde?.peso == null) return false
  return peso > Math.max(ex.recorde.peso, ...anteriores.map((a) => a.peso ?? 0))
}

export function contar(s: SessaoAtiva) {
  const previstas = s.exercicios.reduce((t, e) => t + Math.max(e.series ?? 0, seriesDe(s, e.id).length), 0)
  const volume = s.series.reduce((t, x) => t + (x.peso ?? 0) * (x.reps ?? 0), 0)
  const exercicios = new Set(s.series.map((x) => x.exercicio)).size
  const recordes = s.exercicios.flatMap((e) => {
    const feitas = seriesDe(s, e.id)
    const melhor = feitas.reduce<SerieFeita | null>((m, x) => (x.peso !== null && (!m || x.peso > (m.peso ?? 0)) ? x : m), null)
    return melhor && bateRecorde(e, [], melhor.peso) ? [{ nome: e.nome, peso: melhor.peso, reps: melhor.reps }] : []
  })
  return { feitas: s.series.length, previstas: Math.max(previstas, s.series.length), volume, exercicios, recordes }
}

export const minutosEntre = (inicio: string, fim: string) => Math.max(1, Math.round((Date.parse(fim) - Date.parse(inicio)) / 60_000))

/**
 * Grava o treino terminado no app: cria a coleção do histórico na primeira vez, grava o
 * treino (pelo id, então tentar de novo não duplica) e marca o hábito Treino do dia.
 */
export async function salvarSessao(s: SessaoAtiva): Promise<void> {
  const sb = supabase()
  const fim = s.fim ?? new Date().toISOString()
  const dia = isoDia(new Date(s.inicio))

  const { data: colecoes, error: erroColecoes } = await sb.from("collections").select("id, name")
  if (erroColecoes) throw new Error(erroColecoes.message)
  const alvo = NOMES_HISTORICO.map(normalizar)
  let colecaoId = (colecoes ?? []).find((c) => alvo.includes(semPrefixo(c.name)))?.id
  if (!colecaoId) {
    colecaoId = crypto.randomUUID()
    const { error } = await sb
      .from("collections")
      .insert({ id: colecaoId, name: NOMES_HISTORICO[0], section: "outros", description: "Treino", schema: ESQUEMA_HISTORICO as unknown as Json })
    if (error) throw new Error(error.message)
  }

  const c = contar(s)
  const props: Record<string, Json> = {
    Data: dia,
    Ficha: s.ficha,
    "Duração (min)": minutosEntre(s.inicio, fim),
    Séries: c.feitas,
    "Volume (kg)": Math.round(c.volume),
    _inicio: s.inicio,
    _fim: fim,
    _series: s.series as unknown as Json,
  }
  if (s.dificuldade) props.Dificuldade = s.dificuldade
  const { error: erroItem } = await sb
    .from("collection_items")
    .upsert({ id: s.id, collection_id: colecaoId, title: `${rotuloDaFicha(s.ficha).split(" · ")[0]} · ${formatar(dia, "d 'de' MMM")}`, props, position: Date.parse(s.inicio) }, { onConflict: "id" })
  if (erroItem) throw new Error(erroItem.message)

  // O hábito Treino do dia fica marcado (se já estava, continua)
  const { data: habitos } = await sb.from("habits").select("id, name, active")
  const doTreino = (habitos ?? []).filter((h) => ehHabitoDeTreino(h.name))
  const habito = doTreino.find((h) => h.active) ?? doTreino[0]
  if (habito) await sb.from("habit_logs").upsert({ id: crypto.randomUUID(), habit_id: habito.id, day: dia }, { onConflict: "habit_id,day", ignoreDuplicates: true })
}
