import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import {
  addDays,
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isValid,
  parseISO,
  startOfDay,
} from "date-fns"
import { ptBR } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ------------------------------------------------------------------ */
/* Datas — sempre no fuso do navegador                                 */
/* ------------------------------------------------------------------ */

/** Data local no formato AAAA-MM-DD. */
export function isoDia(d: Date = new Date()): string {
  return format(d, "yyyy-MM-dd")
}

/** Converte AAAA-MM-DD (ou ISO completo) em Date local; null se inválido. */
export function lerData(valor: string | null | undefined): Date | null {
  if (!valor) return null
  const d = parseISO(valor)
  return isValid(d) ? d : null
}

export function formatar(valor: string | Date | null | undefined, padrao = "d 'de' MMM"): string {
  if (!valor) return ""
  const d = typeof valor === "string" ? lerData(valor) : valor
  if (!d) return ""
  return format(d, padrao, { locale: ptBR })
}

/** "hoje", "amanhã", "ontem", "seg, 12 out" … */
export function dataRelativa(valor: string | null | undefined): string {
  const d = lerData(valor)
  if (!d) return ""
  const dias = differenceInCalendarDays(d, startOfDay(new Date()))
  if (dias === 0) return "hoje"
  if (dias === 1) return "amanhã"
  if (dias === -1) return "ontem"
  if (dias > 1 && dias < 7) return format(d, "EEEE", { locale: ptBR })
  const mesmoAno = d.getFullYear() === new Date().getFullYear()
  return format(d, mesmoAno ? "EEE, d MMM" : "d MMM yyyy", { locale: ptBR })
}

export function diasAte(valor: string | null | undefined): number | null {
  const d = lerData(valor)
  if (!d) return null
  return differenceInCalendarDays(d, startOfDay(new Date()))
}

export function haQuanto(valor: string | null | undefined): string {
  const d = lerData(valor)
  if (!d) return ""
  return formatDistanceToNowStrict(d, { locale: ptBR, addSuffix: true })
}

export function somarDias(iso: string, n: number): string {
  const d = lerData(iso) ?? new Date()
  return isoDia(addDays(d, n))
}

/* ------------------------------------------------------------------ */
/* Texto e números                                                     */
/* ------------------------------------------------------------------ */

export function normalizar(t: string | null | undefined): string {
  return (t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

export function contem(texto: string | null | undefined, busca: string): boolean {
  if (!busca.trim()) return true
  return normalizar(texto).includes(normalizar(busca))
}

export function porcentagem(feito: number | null | undefined, total: number | null | undefined): number {
  if (!total || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round(((feito ?? 0) / total) * 100)))
}

export function numero(n: number | null | undefined, casas = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–"
  return n.toLocaleString("pt-BR", { maximumFractionDigits: casas })
}

export function plural(n: number, singular: string, pluralForma?: string): string {
  return `${n} ${n === 1 ? singular : (pluralForma ?? `${singular}s`)}`
}

export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] ?? ""
}

export function saudacao(d: Date = new Date()): string {
  const h = d.getHours()
  if (h < 5) return "Boa noite"
  if (h < 12) return "Bom dia"
  if (h < 18) return "Boa tarde"
  return "Boa noite"
}

/** Gera uma posição entre duas posições (ordenação por arrastar). */
export function posicaoEntre(antes: number | null | undefined, depois: number | null | undefined): number {
  if (antes == null && depois == null) return 1000
  if (antes == null) return (depois as number) - 1000
  if (depois == null) return antes + 1000
  return (antes + depois) / 2
}

export function urlValida(u: string | null | undefined): string | null {
  if (!u) return null
  const t = u.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  if (/^[\w-]+(\.[\w-]+)+/.test(t)) return `https://${t}`
  return null
}

export function dominio(u: string | null | undefined): string {
  const url = urlValida(u)
  if (!url) return ""
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}
