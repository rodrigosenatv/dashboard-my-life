// As contas da página Hoje (testadas em tests/hoje.test.cjs): tarefas do dia, agenda e a linha do dia.

/** AAAA-MM-DD no fuso do aparelho. */
export function diaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

type TarefaMin = { status: string; due_date: string | null; due_time: string | null; done_at: string | null }

/**
 * As tarefas do dia: as pendentes que vencem hoje ou já venceram (as atrasadas primeiro, depois pela
 * hora), as em andamento sem data e as concluídas hoje.
 */
export function tarefasDoDia<T extends TarefaMin>(tarefas: T[], hoje: string) {
  const pendentes = tarefas
    .filter((t) => t.status !== "done" && t.due_date && t.due_date <= hoje)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : a.due_date! > b.due_date! ? 1 : (a.due_time ?? "99").localeCompare(b.due_time ?? "99")))
  return {
    pendentes,
    atrasadas: pendentes.filter((t) => t.due_date! < hoje).length,
    semData: tarefas.filter((t) => t.status === "doing" && !t.due_date),
    concluidasHoje: tarefas.filter((t) => t.status === "done" && t.done_at && diaLocal(new Date(t.done_at)) === hoje),
  }
}

type EventoMin = { starts_at: string; ends_at: string | null; all_day: boolean }

function somar(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number)
  return diaLocal(new Date(a, m - 1, d + n))
}

/** Os compromissos dos próximos dias (hoje e mais 7), agrupados por dia; o que começou antes e segue hoje entra em hoje. */
export function agendaPorDia<T extends EventoMin>(eventos: T[], hoje: string, dias = 8): [string, T[]][] {
  const limite = somar(hoje, dias)
  const porDia = new Map<string, T[]>()
  for (const e of eventos) {
    const inicio = diaLocal(new Date(e.starts_at))
    const fim = e.ends_at ? diaLocal(new Date(e.ends_at)) : inicio
    if (fim < hoje || inicio >= limite) continue
    const dia = inicio < hoje ? hoje : inicio
    porDia.set(dia, [...(porDia.get(dia) ?? []), e])
  }
  return [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b))
}

/** Os compromissos com hora marcada de hoje, na ordem. */
export function eventosComHora<T extends EventoMin>(eventos: T[], hoje: string): T[] {
  return eventos
    .filter((e) => !e.all_day && diaLocal(new Date(e.starts_at)) === hoje)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
}

const horas = (d: Date) => d.getHours() + d.getMinutes() / 60

/** A faixa de horas da linha do dia: das 6h (ou antes, se for preciso) até a meia-noite, começando numa hora múltipla de 3. */
export function faixaDoDia(agora: Date, inicios: Date[]): { inicio: number; fim: number } {
  const menor = Math.min(6, Math.floor(horas(agora)), ...inicios.map((d) => Math.floor(horas(d))))
  return { inicio: Math.max(0, Math.floor(menor / 3) * 3), fim: 24 }
}

/** Onde uma hora cai na faixa, de 0 a 100. */
export function posicaoNaFaixa(d: Date, faixa: { inicio: number; fim: number }): number {
  const p = ((horas(d) - faixa.inicio) / (faixa.fim - faixa.inicio)) * 100
  return Math.max(0, Math.min(100, Math.round(p * 10) / 10))
}

export type SituacaoAgenda<T> =
  | { tipo: "agora"; evento: T; ate: Date }
  | { tipo: "proximo"; evento: T; minutos: number }
  | { tipo: "fim" }
  | { tipo: "livre" }

/** O que está acontecendo agora (sem fim marcado, conta 1 hora) ou o próximo compromisso do dia. */
export function situacaoDaAgenda<T extends EventoMin>(doDia: T[], agora: Date): SituacaoAgenda<T> {
  if (!doDia.length) return { tipo: "livre" }
  for (const e of doDia) {
    const ini = new Date(e.starts_at)
    const fim = e.ends_at ? new Date(e.ends_at) : new Date(ini.getTime() + 60 * 60 * 1000)
    if (ini <= agora && agora < fim) return { tipo: "agora", evento: e, ate: fim }
  }
  const proximo = doDia.find((e) => new Date(e.starts_at) > agora)
  if (!proximo) return { tipo: "fim" }
  return { tipo: "proximo", evento: proximo, minutos: Math.ceil((new Date(proximo.starts_at).getTime() - agora.getTime()) / 60000) }
}

/** "em 25 min", "em 1 h", "em 2 h 15". */
export function textoEspera(minutos: number): string {
  if (minutos < 60) return `em ${Math.max(1, minutos)} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m ? `em ${h} h ${String(m).padStart(2, "0")}` : `em ${h} h`
}

/** Quantas capturas esperam na Caixa de Entrada: sem tipo, sem área, sem projeto e fora do arquivo. */
export function capturasNaCaixa(capturas: { id: string; archived: boolean; area_id: string | null; kind: string | null }[], ligadas: Set<string>): number {
  return capturas.filter((c) => !c.archived && !c.area_id && !c.kind && !ligadas.has(c.id)).length
}

/** A posição de uma tarefa nova: o instante de agora, que cresce sempre, põe a tarefa no fim da lista. */
export function posicaoNoFim(): number {
  return Date.now()
}
