// Conversão dos valores de texto exportados pelo Notion (CSV e propriedades).

const MESES_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

const dois = (n: number) => String(n).padStart(2, "0")

export type DataLida = { data: string; hora: string | null }

function hora24(h: number, m: number, ampm?: string): string {
  let hh = h
  if (ampm) {
    const p = ampm.toLowerCase()
    if (p === "pm" && hh < 12) hh += 12
    if (p === "am" && hh === 12) hh = 0
  }
  return `${dois(hh)}:${dois(m)}`
}

function valida(a: number, m: number, d: number) {
  return a > 1900 && a < 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31
}

/** Lê uma data em qualquer um dos formatos que o Notion usa. */
export function lerDataNotion(bruto: string | null | undefined): DataLida | null {
  if (!bruto) return null
  const v = bruto.trim().replace(/\s*\(.*?\)\s*$/, "").replace(/\s+/g, " ")
  if (!v) return null
  let r: RegExpMatchArray | null

  // 2026-07-05 ou 2026-07-05T14:30
  if ((r = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/))) {
    const [a, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])]
    if (valida(a, m, d)) return { data: `${a}-${dois(m)}-${dois(d)}`, hora: r[4] ? hora24(Number(r[4]), Number(r[5])) : null }
  }
  // 05/07/2026 14:30 (dia/mês/ano)
  if ((r = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})\s*(am|pm)?)?/i))) {
    let [d, m] = [Number(r[1]), Number(r[2])]
    const a = Number(r[3])
    if (m > 12 && d <= 12) [d, m] = [m, d]
    if (valida(a, m, d)) return { data: `${a}-${dois(m)}-${dois(d)}`, hora: r[4] ? hora24(Number(r[4]), Number(r[5]), r[6]) : null }
  }
  // July 5, 2026 2:30 PM
  if ((r = v.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})\s*(am|pm)?)?/i))) {
    const nome = r[1].toLowerCase()
    const m = MESES_EN.findIndex((x) => x.startsWith(nome.slice(0, 3))) + 1
    const [d, a] = [Number(r[2]), Number(r[3])]
    if (m && valida(a, m, d)) return { data: `${a}-${dois(m)}-${dois(d)}`, hora: r[4] ? hora24(Number(r[4]), Number(r[5]), r[6]) : null }
  }
  // 5 de julho de 2026 14:30
  if ((r = v.toLowerCase().match(/^(\d{1,2})\s+de\s+([a-zç]+)\.?\s+de\s+(\d{4})(?:,?\s+(?:às\s+)?(\d{1,2}):(\d{2}))?/))) {
    const m = MESES_PT.findIndex((x) => x.startsWith(r![2].slice(0, 3))) + 1 || MESES_CURTOS.indexOf(r[2].slice(0, 3)) + 1
    const [d, a] = [Number(r[1]), Number(r[3])]
    if (m && valida(a, m, d)) return { data: `${a}-${dois(m)}-${dois(d)}`, hora: r[4] ? hora24(Number(r[4]), Number(r[5])) : null }
  }
  return null
}

/** Datas com intervalo: "início → fim". */
export function lerIntervalo(bruto: string | null | undefined): { inicio: DataLida | null; fim: DataLida | null } {
  if (!bruto) return { inicio: null, fim: null }
  const [a, b] = bruto.split(/\s*→\s*/)
  return { inicio: lerDataNotion(a), fim: b ? lerDataNotion(b) : null }
}

export function lerBool(bruto: string | null | undefined): boolean {
  const v = (bruto ?? "").trim().toLowerCase()
  return v === "yes" || v === "sim" || v === "true" || v === "__yes__" || v === "✓" || v === "x"
}

export function ehBool(bruto: string | null | undefined): boolean {
  const v = (bruto ?? "").trim().toLowerCase()
  return ["yes", "no", "sim", "não", "nao", "true", "false", "__yes__", "__no__"].includes(v)
}

export function lerNumero(bruto: string | null | undefined): number | null {
  if (bruto === null || bruto === undefined) return null
  let v = String(bruto).trim().replace(/[R$\s%]/g, "")
  if (!v) return null
  if (v.includes(",") && v.includes(".")) v = v.lastIndexOf(",") > v.lastIndexOf(".") ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "")
  else if (v.includes(",")) v = v.replace(",", ".")
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function lerLista(bruto: string | null | undefined): string[] {
  if (!bruto) return []
  return bruto
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export type Relacao = { titulo: string; id: string | null; caminho: string | null }

/** Relações aparecem como "Título (caminho/Título%20<id>.md), Outro (…)" ou só os títulos. */
export function lerRelacao(bruto: string | null | undefined): Relacao[] {
  if (!bruto?.trim()) return []
  const saida: Relacao[] = []
  const re = /([^,]*?)\s*\(([^()]*?\.md)\)/g
  let m: RegExpExecArray | null
  let achou = false
  while ((m = re.exec(bruto))) {
    achou = true
    const caminho = decodeURIComponent(m[2])
    const id = caminho.match(/([0-9a-f]{32})\.md$/i)?.[1]?.toLowerCase() ?? null
    saida.push({ titulo: m[1].trim().replace(/^,\s*/, ""), id, caminho })
  }
  if (achou) return saida
  return lerLista(bruto).map((t) => ({ titulo: t, id: null, caminho: null }))
}

export function estrelas(bruto: string | null | undefined): number | null {
  if (!bruto) return null
  const n = [...bruto].filter((c) => c === "⭐" || c === "★").length
  if (n) return Math.min(5, n)
  const num = lerNumero(bruto)
  return num && num >= 1 && num <= 5 ? Math.round(num) : null
}

export function normalizarNome(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^database:\s*/, "")
    .replace(/^visualizacao de\s+/, "")
    .replace(/[^a-z0-9_ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Monta um timestamp no fuso local a partir de data e hora. */
export function paraTimestamp(d: DataLida): string {
  const [a, m, dia] = d.data.split("-").map(Number)
  const [h, min] = (d.hora ?? "00:00").split(":").map(Number)
  return new Date(a, m - 1, dia, h, min).toISOString()
}
