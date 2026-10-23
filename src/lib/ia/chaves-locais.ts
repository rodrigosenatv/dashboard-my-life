"use client"

import * as React from "react"
import { useSessao } from "@/components/provedores"
import { PROVEDORES, infoProvedor, type Provedor } from "./info"

/**
 * Dados pessoais são isolados pela identidade e excluídos no logout.
 * A chave legada sem dono identificável ("dml-ia") não é migrada.
 */
const PREFIXO = "dml-ia:"
const EVENTO = "dml-ia-mudou"
export type ConfigLocal = { padrao?: Provedor; provedores: Partial<Record<Provedor, { chave: string; modelo?: string }>> }
const vazio: ConfigLocal = { provedores: {} }

function chave(usuarioId: string | null): string | null {
  return usuarioId && /^[a-f\d-]{36}$/i.test(usuarioId) ? PREFIXO + usuarioId : null
}

function ler(texto: string | null): ConfigLocal {
  if (!texto) return vazio
  try {
    const v = JSON.parse(texto)
    if (!v || typeof v !== "object" || !v.provedores || typeof v.provedores !== "object") return vazio
    return { padrao: v.padrao, provedores: v.provedores }
  } catch { return vazio }
}

let cache: { chave: string | null; texto: string | null; valor: ConfigLocal } = { chave: null, texto: null, valor: vazio }
function instantaneo(usuarioId: string | null): ConfigLocal {
  const k = chave(usuarioId)
  if (!k) return vazio
  let texto: string | null = null
  try { texto = localStorage.getItem(k) } catch {}
  if (k !== cache.chave || texto !== cache.texto) cache = { chave: k, texto, valor: ler(texto) }
  return cache.valor
}

/** O ID do proprietário deve ser explícito: nunca salvar em chave global. */
export function salvarConfigIA(nova: ConfigLocal, usuarioId: string | null) {
  const k = chave(usuarioId)
  if (!k) return
  try { localStorage.setItem(k, JSON.stringify(nova)) } catch {}
  window.dispatchEvent(new Event(EVENTO))
}

export function useConfigIA(): ConfigLocal {
  const { usuario } = useSessao()
  const id = usuario?.id ?? null
  const getSnapshot = React.useCallback(() => instantaneo(id), [id])
  return React.useSyncExternalStore(
    (avisar) => {
      window.addEventListener(EVENTO, avisar)
      window.addEventListener("storage", avisar)
      return () => {
        window.removeEventListener(EVENTO, avisar)
        window.removeEventListener("storage", avisar)
      }
    },
    getSnapshot,
    () => vazio,
  )
}

export function provedoresAtivos(cfg: ConfigLocal): Provedor[] {
  const ativos = PROVEDORES.map((p) => p.id).filter((id) => cfg.provedores[id]?.chave)
  return cfg.padrao && ativos.includes(cfg.padrao) ? [cfg.padrao, ...ativos.filter((a) => a !== cfg.padrao)] : ativos
}
export function credencial(cfg: ConfigLocal, id: Provedor) {
  const p = cfg.provedores[id]
  if (!p?.chave) return null
  return { provedor: id, chave: p.chave, modelo: p.modelo?.trim() || infoProvedor(id)!.modeloPadrao }
}
