import { differenceInCalendarDays } from "date-fns"

/** O mínimo de um projeto (ou etapa) para as contas do Segundo Cérebro. */
type No = { id: string; parent_id: string | null; done: boolean; position: number }

/** Progresso de um projeto: etapas concluídas sobre o total (uma etapa com subetapas conta pela fração feita). */
export function progresso(id: string, todos: No[]): { feitos: number; total: number } {
  const filhos = todos.filter((p) => p.parent_id === id)
  let feitos = 0
  let total = 0
  for (const f of filhos) {
    const netos = todos.filter((p) => p.parent_id === f.id)
    if (netos.length && !f.done) {
      const sub = progresso(f.id, todos)
      feitos += sub.feitos / Math.max(1, sub.total)
      total += 1
    } else {
      total += 1
      if (f.done) feitos += 1
    }
  }
  return { feitos: Math.round(feitos * 10) / 10, total }
}

/** "1,3 de 5 etapas": a fração (de etapas com subetapas) sai com vírgula. */
export function textoEtapas(feitos: number, total: number): string {
  if (!total) return "Sem etapas"
  const f = Number.isInteger(feitos) ? String(feitos) : feitos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
  return `${f} de ${total.toLocaleString("pt-BR")} ${total === 1 ? "etapa" : "etapas"}`
}

/** A próxima etapa a fazer: a primeira, na ordem, ainda aberta. */
export function proximaEtapa<T extends No>(id: string, todos: T[]): T | null {
  return todos.filter((e) => e.parent_id === id && !e.done).sort((a, b) => a.position - b.position)[0] ?? null
}

export type EstadoPrazo = "atrasado" | "perto" | "longe"

/** Como está o prazo, pelos dias que faltam: atrasado, perto (até 7 dias) ou longe; sem prazo ou já feito, nada. */
export function estadoPrazo(dias: number | null, feito?: boolean): EstadoPrazo | null {
  if (dias === null || feito) return null
  if (dias < 0) return "atrasado"
  return dias <= 7 ? "perto" : "longe"
}

/** Há quantos dias espera a captura mais antiga (as datas vêm da mais nova para a mais antiga). */
export function diasNaFila(datas: string[], hoje: Date): number {
  const antiga = datas.at(-1)
  if (!antiga) return 0
  const d = new Date(antiga)
  return Number.isNaN(d.getTime()) ? 0 : Math.max(0, differenceInCalendarDays(hoje, d))
}
