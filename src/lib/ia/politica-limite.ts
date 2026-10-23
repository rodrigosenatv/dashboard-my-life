/** Os limites são aplicados no PostgreSQL, não na memória da instância serverless. */
export const LIMITES_IA_COMPARTILHADA = {
  porUsuarioHora: 8,
  globalDia: 60,
  simultaneasPorUsuario: 1,
  simultaneasGlobais: 4,
  minutosDaReserva: 8,
} as const

export type DecisaoReserva =
  | { permitido: true }
  | { permitido: false; motivo: "usuario_hora" | "global_dia" | "concorrencia"; retryAfter: number }

/** Falha fechada para respostas incompletas/inesperadas do banco. */
export function interpretarDecisaoReserva(dado: unknown): DecisaoReserva | null {
  if (!dado || typeof dado !== "object" || Array.isArray(dado)) return null
  const r = dado as Record<string, unknown>
  if (r.permitido === true) return { permitido: true }
  if (r.permitido !== false) return null
  if (r.motivo !== "usuario_hora" && r.motivo !== "global_dia" && r.motivo !== "concorrencia") return null
  if (typeof r.retryAfter !== "number" || !Number.isFinite(r.retryAfter) || r.retryAfter < 1 || r.retryAfter > 86_400) return null
  return { permitido: false, motivo: r.motivo, retryAfter: Math.ceil(r.retryAfter) }
}
