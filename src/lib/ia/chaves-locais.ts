"use client"

import * as React from "react"
import { PROVEDORES, infoProvedor, type Provedor } from "./info"

/**
 * As chaves de IA ficam só neste navegador (localStorage), nunca no banco.
 * Vão junto em cada pedido ao assistente, pela conexão segura do próprio app.
 */
const CHAVE = "dml-ia"
const EVENTO = "dml-ia-mudou"

export type ConfigLocal = { padrao?: Provedor; provedores: Partial<Record<Provedor, { chave: string; modelo?: string }>> }

function ler(): ConfigLocal {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "{}")
    return { padrao: v.padrao, provedores: v.provedores ?? {} }
  } catch {
    return { provedores: {} }
  }
}

let cache: { texto: string | null; valor: ConfigLocal } = { texto: null, valor: { provedores: {} } }
function instantaneo(): ConfigLocal {
  let texto: string | null = null
  try {
    texto = localStorage.getItem(CHAVE)
  } catch {}
  if (texto !== cache.texto) cache = { texto, valor: ler() }
  return cache.valor
}
const vazio: ConfigLocal = { provedores: {} }

export function salvarConfigIA(nova: ConfigLocal) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(nova))
  } catch {}
  window.dispatchEvent(new Event(EVENTO))
}

export function useConfigIA(): ConfigLocal {
  return React.useSyncExternalStore(
    (avisar) => {
      window.addEventListener(EVENTO, avisar)
      window.addEventListener("storage", avisar)
      return () => {
        window.removeEventListener(EVENTO, avisar)
        window.removeEventListener("storage", avisar)
      }
    },
    instantaneo,
    () => vazio,
  )
}

/** Provedores com chave neste navegador, o padrão primeiro. */
export function provedoresAtivos(cfg: ConfigLocal): Provedor[] {
  const ativos = PROVEDORES.map((p) => p.id).filter((id) => cfg.provedores[id]?.chave)
  return cfg.padrao && ativos.includes(cfg.padrao) ? [cfg.padrao, ...ativos.filter((a) => a !== cfg.padrao)] : ativos
}

export function credencial(cfg: ConfigLocal, id: Provedor) {
  const p = cfg.provedores[id]
  if (!p?.chave) return null
  return { provedor: id, chave: p.chave, modelo: p.modelo?.trim() || infoProvedor(id)!.modeloPadrao }
}
