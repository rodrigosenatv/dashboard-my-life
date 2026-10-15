/*
 * Hobbies: a lógica sem tela. Cada hobby é um item da coleção "Meus hobbies" (nome, meta por
 * semana, objetivo, foto e as páginas de estudo em `_paginas`); cada prática é um item de
 * "Prática dos hobbies", ligado ao hobby pelo id em `_hobby`.
 */
import { addDays, differenceInCalendarDays, startOfWeek } from "date-fns"
import type { ItemColecao } from "@/features/colecoes/visao-colecao"
import type { Json } from "@/lib/supabase/database.types"
import { formatar, isoDia, lerData, normalizar, numeroFlexivel, plural } from "@/lib/utils"

const valores = (i: Pick<ItemColecao, "props">) => (i.props ?? {}) as Record<string, Json>
const texto = (v: Json | undefined) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "")

/* ------------------------------------------------------------------ */
/* Hobby                                                               */
/* ------------------------------------------------------------------ */

/** No máximo um dia por dia da semana. */
export const META_MAXIMA = 7

export type Hobby = {
  item: ItemColecao
  id: string
  nome: string
  /** Dias por semana que a pessoa quer praticar (0 = sem meta). */
  meta: number
  objetivo: string
  /** Foto enviada, no storage. */
  capa: string | null
  /** Foto por endereço (a que veio do Notion). */
  capaUrl: string | null
  /** Ids das páginas de estudo, na ordem. */
  paginas: string[]
}

/** Ids guardados numa lista (sem repetir, sem vazios). */
export function lerIds(v: Json | undefined): string[] {
  if (!Array.isArray(v)) return []
  const ids: string[] = []
  for (const x of v) if (typeof x === "string" && x && !ids.includes(x)) ids.push(x)
  return ids
}

export function lerHobby(item: ItemColecao): Hobby {
  const v = valores(item)
  const meta = Math.round(numeroFlexivel(v["Meta por semana"]) ?? 0)
  const foto = texto(v.Foto)
  return {
    item,
    id: item.id,
    nome: item.title.trim() || "Hobby sem nome",
    meta: Math.max(0, Math.min(META_MAXIMA, meta)),
    objetivo: texto(v.Objetivo),
    capa: item.cover_path ?? null,
    capaUrl: /^https?:\/\//i.test(foto) ? foto : null,
    paginas: lerIds(v._paginas),
  }
}

export const ordenarHobbies = (hobbies: Hobby[]) => [...hobbies].sort((a, b) => (a.item.position ?? 0) - (b.item.position ?? 0) || a.nome.localeCompare(b.nome))

/* ------------------------------------------------------------------ */
/* Prática                                                             */
/* ------------------------------------------------------------------ */

export type Sessao = {
  item: ItemColecao
  id: string
  /** Id do hobby; null quando o item não está ligado a nenhum. */
  hobby: string | null
  /** AAAA-MM-DD. */
  data: string
  minutos: number | null
  anotacoes: string
  /** O recado "para a próxima vez". */
  proximo: string
}

const dia = (v: Json | undefined) => {
  const t = texto(v)
  return /^\d{4}-\d{2}-\d{2}/.test(t) && lerData(t.slice(0, 10)) ? t.slice(0, 10) : null
}

export function lerSessao(item: ItemColecao): Sessao {
  const v = valores(item)
  const minutos = numeroFlexivel(v.Minutos)
  return {
    item,
    id: item.id,
    hobby: texto(v._hobby) || null,
    data: dia(v.Data) ?? (item.created_at ?? isoDia()).slice(0, 10),
    minutos: minutos !== null && minutos > 0 ? Math.round(minutos) : null,
    anotacoes: texto(v["Anotações"]),
    proximo: texto(v["Próximo passo"]),
  }
}

/** Da mais recente para a mais antiga (no mesmo dia, a última registrada primeiro). */
export const ordenarSessoes = (sessoes: Sessao[]) => [...sessoes].sort((a, b) => b.data.localeCompare(a.data) || (b.item.position ?? 0) - (a.item.position ?? 0))

/* ------------------------------------------------------------------ */
/* Semana e resumos                                                    */
/* ------------------------------------------------------------------ */

/** Os sete dias da semana de `hoje`, de segunda a domingo. */
export function diasDaSemana(hoje = isoDia()): string[] {
  const inicio = startOfWeek(lerData(hoje) ?? new Date(), { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => isoDia(addDays(inicio, i)))
}

const somaMinutos = (sessoes: Sessao[]) => sessoes.reduce((n, s) => n + (s.minutos ?? 0), 0)

export type ResumoHobby = {
  /** Dias diferentes desta semana com prática, em ordem. */
  diasNaSemana: string[]
  minutosNaSemana: number
  sessoesNoMes: number
  minutosNoMes: number
  total: number
  ultima: Sessao | null
  /** Dias desde a última prática (0 = hoje); null se nunca praticou. */
  diasSemPraticar: number | null
  feitoHoje: boolean
}

/** Resumo das práticas de um hobby (passe só as dele). */
export function resumirHobby(sessoes: Sessao[], hoje = isoDia()): ResumoHobby {
  const semana = diasDaSemana(hoje)
  const naSemana = sessoes.filter((s) => s.data >= semana[0] && s.data <= semana[6])
  const noMes = sessoes.filter((s) => s.data.slice(0, 7) === hoje.slice(0, 7))
  const ordenadas = ordenarSessoes(sessoes)
  const ultima = ordenadas.find((s) => s.data <= hoje) ?? ordenadas[0] ?? null
  return {
    diasNaSemana: [...new Set(naSemana.map((s) => s.data))].sort(),
    minutosNaSemana: somaMinutos(naSemana),
    sessoesNoMes: noMes.length,
    minutosNoMes: somaMinutos(noMes),
    total: sessoes.length,
    ultima,
    diasSemPraticar: ultima ? Math.max(0, differenceInCalendarDays(lerData(hoje)!, lerData(ultima.data)!)) : null,
    feitoHoje: sessoes.some((s) => s.data === hoje),
  }
}

/** A semana de todos os hobbies juntos: dias com alguma prática, quantas práticas e quanto tempo. */
export function resumirSemana(sessoes: Sessao[], hoje = isoDia()) {
  const semana = diasDaSemana(hoje)
  const naSemana = sessoes.filter((s) => s.data >= semana[0] && s.data <= semana[6])
  return { dias: new Set(naSemana.map((s) => s.data)), sessoes: naSemana.length, minutos: somaMinutos(naSemana) }
}

/* ------------------------------------------------------------------ */
/* Textos                                                              */
/* ------------------------------------------------------------------ */

/** 45 → "45 min"; 60 → "1h"; 75 → "1h15". */
export function textoMinutos(m: number | null | undefined): string {
  if (!m || m <= 0) return ""
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const resto = m % 60
  return resto ? `${h}h${String(resto).padStart(2, "0")}` : `${h}h`
}

/** "hoje", "ontem", "há 3 dias", "há 2 semanas", "há 3 meses". */
export function textoDesde(dias: number): string {
  if (dias <= 0) return "hoje"
  if (dias === 1) return "ontem"
  if (dias < 7) return `há ${dias} dias`
  if (dias < 14) return "há 1 semana"
  if (dias < 60) return `há ${plural(Math.floor(dias / 7), "semana")}`
  return `há ${plural(Math.floor(dias / 30), "mês", "meses")}`
}

/** "2 de 3 dias" com meta; "2 dias" sem meta (e "Nenhuma prática ainda" sem meta e sem dias). */
export function textoSemana(meta: number, dias: number): string {
  if (meta > 0) return `${dias} de ${plural(meta, "dia")}`
  return dias > 0 ? plural(dias, "dia") : "Nenhuma prática ainda"
}

/** Depois de registrar uma prática, o recado do toast: o que falta (ou já foi) da meta da semana. */
export function textoProgresso(meta: number, dias: number): string {
  if (meta > 0 && dias >= meta) return "Meta da semana batida"
  return `${textoSemana(meta, dias)} nesta semana`
}

/** "qua, 14 out" (ou "hoje" e "ontem"). */
export function diaCurto(data: string, hoje = isoDia()): string {
  if (data === hoje) return "hoje"
  if (data === isoDia(addDays(lerData(hoje) ?? new Date(), -1))) return "ontem"
  return formatar(data, lerData(data)?.getFullYear() === lerData(hoje)?.getFullYear() ? "EEEEEE, d 'de' MMM" : "d 'de' MMM yyyy")
}

/** "outubro de 2026". */
export const mesPorExtenso = (data: string) => formatar(data, "MMMM 'de' yyyy")

/* ------------------------------------------------------------------ */
/* Páginas de estudo                                                   */
/* ------------------------------------------------------------------ */

const TITULOS_PADRAO = ["nova pagina", "new page", "untitled", "sem titulo", "pagina sem titulo"]

/** O título que o Notion dá a uma página que ninguém nomeou. */
export const tituloPadrao = (titulo: string) => !titulo.trim() || TITULOS_PADRAO.includes(normalizar(titulo))

/** Página sem nada escrito (só espaços, marcas de markdown ou linhas). */
export const emBranco = (conteudo: string | null | undefined) => !(conteudo ?? "").replace(/[\s\-*#>_|`~]/g, "")

export type GrupoDetectado = { nome: string; foto: string | null; paginas: string[] }

const LINK_PAGINA = /\[[^\]]*\]\(\/paginas\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi
const IMAGEM_EXTERNA = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i

/**
 * Os hobbies da página "Hobbies" do Notion: cada bloco tinha o nome em negrito (ou como título),
 * uma foto e as páginas dele. Lê o texto importado e devolve esses blocos, na ordem.
 * `existentes` descarta ids de páginas que não estão mais no app.
 */
export function detectarGrupos(markdown: string, existentes?: ReadonlySet<string>): GrupoDetectado[] {
  const grupos: GrupoDetectado[] = []
  const vistos = new Set<string>()
  let atual: GrupoDetectado | null = null
  for (const bruta of markdown.split("\n")) {
    // Sem a marca de citação (o callout do Notion) nem o marcador de lista
    const linha = bruta
      .replace(/^\s*(?:>\s*)+/, "")
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
      .trim()
    if (!linha) continue

    const ids = [...linha.matchAll(LINK_PAGINA)].map((m) => m[1].toLowerCase())
    if (ids.length) {
      if (atual) {
        for (const id of ids) {
          if (vistos.has(id) || (existentes && !existentes.has(id))) continue
          vistos.add(id)
          atual.paginas.push(id)
        }
      }
      continue
    }

    const semHtml = linha.replace(/<[^>]*>/g, "").trim()
    const titulo = semHtml.match(/^(?:\*\*|__)\s*([^*_]+?)\s*(?:\*\*|__)$/) ?? semHtml.match(/^#{1,6}\s+(.+?)\s*#*$/)
    if (titulo) {
      const nome = titulo[1].replace(/[:：]\s*$/, "").trim()
      if (nome) {
        atual = { nome, foto: null, paginas: [] }
        grupos.push(atual)
      }
      continue
    }

    const imagem = linha.match(IMAGEM_EXTERNA)
    if (imagem && atual && !atual.foto && !/\/icons\//i.test(imagem[1])) atual.foto = imagem[1]
  }
  return grupos.filter((g) => g.paginas.length > 0)
}
