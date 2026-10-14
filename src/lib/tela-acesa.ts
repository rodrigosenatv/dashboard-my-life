"use client"

import * as React from "react"

/**
 * Mantém a tela acesa enquanto `ativo` (treino, receita aberta…). O sistema solta a trava
 * quando o app vai para segundo plano; ao voltar, ela é pedida de novo.
 */
export function useTelaAcesa(ativo = true) {
  React.useEffect(() => {
    if (!ativo || !("wakeLock" in navigator)) return
    let trava: WakeLockSentinel | null = null
    let vivo = true
    const pedir = async () => {
      if (trava || document.visibilityState !== "visible") return
      try {
        trava = await navigator.wakeLock.request("screen")
        trava.addEventListener("release", () => {
          trava = null
        })
        if (!vivo) void trava.release().catch(() => {})
      } catch {
        // sem permissão ou sem suporte: a tela apaga como de costume
      }
    }
    void pedir()
    const aoVoltar = () => void pedir()
    document.addEventListener("visibilitychange", aoVoltar)
    return () => {
      vivo = false
      document.removeEventListener("visibilitychange", aoVoltar)
      void trava?.release().catch(() => {})
    }
  }, [ativo])
}
