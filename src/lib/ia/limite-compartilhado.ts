import "server-only"

import { createClient } from "@supabase/supabase-js"
import { SUPABASE_URL } from "@/lib/supabase/env"
import { interpretarDecisaoReserva } from "./politica-limite"

export type ReservaIA =
  | { estado: "reservado"; id: string }
  | { estado: "limitado"; retryAfter: number; mensagem: string }
  | { estado: "indisponivel" }

/**
 * Apenas o servidor pode executar as RPCs da quota: nenhuma delas é concedida
 * à role authenticated. Nunca repassar essa credencial para o navegador.
 */
function bancoDeLimites() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !chave) return null
  return createClient(SUPABASE_URL, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function reservarUsoIACompartilhada(usuarioId: string): Promise<ReservaIA> {
  if (!usuarioId) return { estado: "indisponivel" }
  const banco = bancoDeLimites()
  if (!banco) return { estado: "indisponivel" }

  const id = crypto.randomUUID()
  try {
    const { data, error } = await banco.rpc("reservar_ia_compartilhada", {
      p_usuario: usuarioId,
      p_ticket: id,
    })
    if (error) return { estado: "indisponivel" }

    const resultado = interpretarDecisaoReserva(data)
    if (!resultado) return { estado: "indisponivel" }
    if (resultado.permitido) return { estado: "reservado", id }

    const mensagem = resultado.motivo === "usuario_hora"
      ? "Você atingiu o limite horário da IA compartilhada. Tente novamente depois."
      : resultado.motivo === "global_dia"
        ? "O limite diário da IA compartilhada foi atingido. Tente novamente amanhã."
        : "A IA compartilhada já está respondendo a outros pedidos. Tente novamente em instantes."
    return { estado: "limitado", retryAfter: resultado.retryAfter, mensagem }
  } catch {
    return { estado: "indisponivel" }
  }
}

/** Libera a vaga de concorrência, mas nunca devolve a quota já consumida. */
export async function liberarUsoIACompartilhada(usuarioId: string, ticket: string): Promise<void> {
  const banco = bancoDeLimites()
  if (!banco) return
  try {
    await banco.rpc("liberar_ia_compartilhada", { p_usuario: usuarioId, p_ticket: ticket })
  } catch {
    // A reserva também tem prazo no banco, caso a execução termine abruptamente.
  }
}
