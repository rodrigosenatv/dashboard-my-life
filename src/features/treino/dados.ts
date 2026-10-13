"use client"

import * as React from "react"
import { useLista } from "@/lib/data"
import type { Json } from "@/lib/supabase/database.types"
import { isoDia, lerData, normalizar, somarDias } from "@/lib/utils"
import { esquema, type Colecao, type ItemColecao } from "@/features/colecoes/visao-colecao"
import { indexar, useHabitos, useRegistros } from "@/features/habitos/dados"

/* ------------------------------------------------------------------ */
/* Coleções da página de Treino                                        */
/* ------------------------------------------------------------------ */

/** Nome do banco sem o "Database:" que o Notion põe na frente. */
export const semPrefixo = (nome: string) => normalizar(nome.replace(/^database:?\s*/i, ""))

const NOMES = {
  exercicios: ["Exercícios", "Exercicios", "Lista de Exercícios"],
  grupos: ["Grupos Musculares", "Grupos musculares"],
  avaliacao: ["Avaliação Corporal", "Avaliacao Corporal", "Avaliações"],
}

/** As coleções da página de Treino: as que vieram do Notion ou as criadas aqui. */
export function useColecoesTreino() {
  const { data: colecoes = [], isLoading } = useLista("collections", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  return React.useMemo(() => {
    const achar = (nomes: string[]) => {
      const alvo = nomes.map(normalizar)
      const candidatas = colecoes.filter((c) => alvo.includes(semPrefixo(c.name)))
      // Se houver duas com o mesmo nome, vale a que morava na página de treinos
      return candidatas.find((c) => normalizar(c.description ?? "").includes("treino")) ?? candidatas[0]
    }
    return { exercicios: achar(NOMES.exercicios), grupos: achar(NOMES.grupos), avaliacao: achar(NOMES.avaliacao), carregando: isLoading }
  }, [colecoes, isLoading])
}

/** Itens de uma coleção (mesma consulta das listas genéricas, então o cache é dividido). */
export function useItensDe(colecao: Colecao | undefined) {
  return useLista("collection_items", {
    filtro: (q) => q.eq("collection_id", colecao?.id ?? ""),
    ordem: [{ coluna: "position" }, { coluna: "title" }],
    chave: ["de", colecao?.id],
    enabled: Boolean(colecao),
  })
}

export const valores = (i: ItemColecao) => (i.props ?? {}) as Record<string, Json>

/** Nome real de uma propriedade (no Notion ela pode vir com acento, maiúscula ou unidade). */
function acharPropriedade(c: Colecao | undefined, itens: ItemColecao[], teste: (nome: string) => boolean): string | undefined {
  const nomes = new Set<string>(esquema(c).map((p) => p.name))
  for (const i of itens) for (const k of Object.keys(valores(i))) nomes.add(k)
  return [...nomes].find((n) => teste(normalizar(n)))
}

export function lista(v: Json | undefined): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  if (typeof v === "string" && v.trim()) return v.split(",").map((s) => s.trim()).filter(Boolean)
  return []
}

export function numeroDe(v: Json | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim().replace(",", "."))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Lê "71,5" ou "71.5" digitado num campo; vazio vira null. */
export function lerNumeroDigitado(t: string): number | null {
  const limpo = t.trim().replace(",", ".")
  if (!limpo) return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

/* ------------------------------------------------------------------ */
/* Exercícios e fichas                                                 */
/* ------------------------------------------------------------------ */

export type CamposExercicio = { series: string; reps: string; nota: string; fichas: string; grupos: string }

export function camposExercicio(c: Colecao | undefined, itens: ItemColecao[]): CamposExercicio {
  return {
    series: acharPropriedade(c, itens, (n) => n.startsWith("serie")) ?? "Séries",
    reps: acharPropriedade(c, itens, (n) => n.startsWith("repeti")) ?? "Repetições",
    nota: acharPropriedade(c, itens, (n) => n.startsWith("anota") || n.startsWith("observa")) ?? "Anotação",
    fichas: acharPropriedade(c, itens, (n) => ["treino", "treinos", "ficha", "fichas"].includes(n)) ?? "Treino",
    grupos: acharPropriedade(c, itens, (n) => n.startsWith("grupo")) ?? "Grupos Musculares",
  }
}

export type Exercicio = {
  item: ItemColecao
  nome: string
  series: number | null
  reps: number | null
  nota: string
  fichas: string[]
  grupos: string[]
}

export function lerExercicio(item: ItemColecao, campos: CamposExercicio): Exercicio {
  const v = valores(item)
  const nota = v[campos.nota]
  return {
    item,
    nome: item.title || "Sem nome",
    series: numeroDe(v[campos.series]),
    reps: numeroDe(v[campos.reps]),
    nota: typeof nota === "string" ? nota.trim() : nota == null ? "" : String(nota),
    fichas: lista(v[campos.fichas]),
    grupos: lista(v[campos.grupos]),
  }
}

export type Ficha = { valor: string; letra: string; foco: string }

/** "Treino A - (empurra)" vira letra "A" e foco "Empurra". */
export function lerFicha(valor: string): Ficha {
  const m = valor.match(/^\s*treino\s+([a-z0-9]{1,3})\b\s*[-–—:]?\s*\(?\s*([^)]*?)\s*\)?\s*$/i)
  if (!m) return { valor, letra: valor.trim(), foco: "" }
  const foco = m[2].trim()
  return { valor, letra: m[1].toUpperCase(), foco: foco ? foco[0].toUpperCase() + foco.slice(1) : "" }
}

export function listarFichas(exercicios: Exercicio[]): Ficha[] {
  const vistas = new Set<string>()
  for (const e of exercicios) for (const f of e.fichas) vistas.add(f)
  return [...vistas].map(lerFicha).sort((a, b) => a.letra.localeCompare(b.letra, "pt-BR", { numeric: true }))
}

const DURACAO = /^\d+([.,]\d+)?\s*(s|seg|segundos?|m|min|minutos?|h)$/i

/** "4 × 10", "4 × 60s" ou o que houver. */
export function prescricao(e: Exercicio): string {
  const duracao = DURACAO.test(e.nota) ? e.nota.replace(/\s+/g, "") : ""
  if (e.series && e.reps) return `${e.series} × ${e.reps}`
  if (e.series && duracao) return `${e.series} × ${duracao}`
  if (duracao) return duracao
  if (e.series) return `${e.series} séries`
  if (e.reps) return `${e.reps} rep.`
  return "–"
}

/** A anotação só aparece abaixo do nome quando não virou parte da prescrição. */
export const notaVisivel = (e: Exercicio) => (DURACAO.test(e.nota) && !(e.series && e.reps) ? "" : e.nota)

/** O valor mais comum (para sugerir séries e repetições de um exercício novo). */
export function maisComum(nums: (number | null)[]): number | null {
  const conta = new Map<number, number>()
  for (const n of nums) if (n !== null) conta.set(n, (conta.get(n) ?? 0) + 1)
  let melhor: number | null = null
  let vezes = 0
  for (const [n, c] of conta) if (c > vezes) [melhor, vezes] = [n, c]
  return melhor
}

/* ------------------------------------------------------------------ */
/* Avaliação corporal                                                  */
/* ------------------------------------------------------------------ */

export type CamposAvaliacao = { data: string; peso: string; gordura: string; imc?: string; foto: string }

export function camposAvaliacao(c: Colecao | undefined, itens: ItemColecao[]): CamposAvaliacao {
  const tipoData = esquema(c).find((p) => p.type === "date")?.name
  return {
    data: tipoData ?? acharPropriedade(c, itens, (n) => n === "data" || n.startsWith("data ")) ?? "Data",
    peso: acharPropriedade(c, itens, (n) => n.startsWith("peso")) ?? "Peso (Kg)",
    gordura: acharPropriedade(c, itens, (n) => n.startsWith("pgc") || (n.includes("gordura") && n.includes("%"))) ?? "PGC (%)",
    imc: acharPropriedade(c, itens, (n) => n.startsWith("imc")),
    foto: acharPropriedade(c, itens, (n) => n.startsWith("foto")) ?? "Foto Principal",
  }
}

export type Avaliacao = {
  item: ItemColecao
  data: string | null
  peso: number | null
  gordura: number | null
  imc: number | null
  /** Caminho da foto no armazenamento do app. */
  foto: string | null
  /** A foto ficou como um caminho do Notion que não abriu na importação. */
  fotoPerdida: boolean
}

export const PREFIXO_ARQUIVO = "arquivo://"

export function caminhoDoArquivo(v: Json | undefined): string | null {
  if (typeof v !== "string" || !v.startsWith(PREFIXO_ARQUIVO)) return null
  try {
    return decodeURIComponent(v.slice(PREFIXO_ARQUIVO.length))
  } catch {
    return null
  }
}

export function lerAvaliacao(item: ItemColecao, campos: CamposAvaliacao): Avaliacao {
  const v = valores(item)
  const data = v[campos.data]
  const foto = caminhoDoArquivo(v[campos.foto]) ?? item.cover_path
  const bruto = v[campos.foto]
  return {
    item,
    data: typeof data === "string" && lerData(data) ? data.slice(0, 10) : null,
    peso: numeroDe(v[campos.peso]),
    gordura: numeroDe(v[campos.gordura]),
    imc: campos.imc ? numeroDe(v[campos.imc]) : null,
    foto,
    fotoPerdida: !foto && typeof bruto === "string" && /\.(jpe?g|png|webp|gif|heic)$/i.test(bruto.trim()),
  }
}

/** Mais antiga primeiro; as sem data ficam no fim, na ordem da lista. */
export function ordenarAvaliacoes(lista: Avaliacao[]): Avaliacao[] {
  return [...lista].sort((a, b) => {
    if (a.data && b.data) return a.data.localeCompare(b.data)
    if (a.data) return -1
    if (b.data) return 1
    return a.item.position - b.item.position
  })
}

/** Próximo número para "Avaliação Nº 5". */
export function proximoNumero(lista: Avaliacao[]): number {
  const nums = lista.map((a) => Number(a.item.title.match(/n[ºo°.]?\s*(\d+)/i)?.[1] ?? 0))
  return Math.max(lista.length, ...nums) + 1
}

/** "71 kg", "71,5 kg". */
export const kg = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`

/* ------------------------------------------------------------------ */
/* Hábito Treino                                                       */
/* ------------------------------------------------------------------ */

const NOMES_HABITO = ["treino", "treinar", "academia", "musculacao", "malhar", "treino academia"]

/** O hábito que marca os dias de treino, com os dias já marcados. */
export function useHabitoTreino() {
  const { data: habitos = [], isLoading } = useHabitos()
  // Mesma janela da tela de Hábitos, para as duas dividirem a consulta
  const { data: registros = [], isLoading: carregandoDias } = useRegistros(somarDias(isoDia(), -400))
  const habito = React.useMemo(() => {
    const doTreino = habitos.filter((h) => NOMES_HABITO.includes(normalizar(h.name).replace(/\s+/g, " ")))
    return doTreino.find((h) => h.active) ?? doTreino[0]
  }, [habitos])
  const dias = React.useMemo(() => (habito ? indexar(registros).get(habito.id) : undefined), [registros, habito])
  return { habito, dias, carregando: isLoading || carregandoDias }
}
