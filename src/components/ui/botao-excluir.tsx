"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Botao } from "./button"

/**
 * Exclusão em dois toques: o primeiro arma, o segundo exclui.
 * Evita apagar por engano sem abrir outra janela por cima da que já está aberta.
 * Desarma sozinho depois de alguns segundos ou quando o foco sai do botão.
 */
export function useDoisToques(aoConfirmar: () => void) {
  const [armado, setArmado] = React.useState(false)

  React.useEffect(() => {
    if (!armado) return
    const t = window.setTimeout(() => setArmado(false), 4000)
    return () => window.clearTimeout(t)
  }, [armado])

  return {
    armado,
    desarmar: () => setArmado(false),
    tocar: () => {
      if (armado) {
        setArmado(false)
        aoConfirmar()
      } else setArmado(true)
    },
  }
}

/** Botão "Excluir" do rodapé das janelas de edição. */
export function BotaoExcluir({ aoExcluir, className }: { aoExcluir: () => void; className?: string }) {
  const { armado, tocar, desarmar } = useDoisToques(aoExcluir)
  return (
    <Botao
      variante={armado ? "perigo" : "fantasma"}
      className={cn("mr-auto", !armado && "text-danger hover:text-danger", className)}
      onClick={tocar}
      onBlur={desarmar}
    >
      <span aria-live="polite">{armado ? "Confirmar exclusão" : "Excluir"}</span>
    </Botao>
  )
}
