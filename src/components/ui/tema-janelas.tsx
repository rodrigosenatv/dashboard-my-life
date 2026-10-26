"use client"

import * as React from "react"

const TemaCtx = React.createContext<string | undefined>(undefined)

/**
 * Janelas e menus abrem fora da página (num portal), longe da classe de tema dela. Dentro deste
 * trecho, eles recebem a classe do tema da tela (ex.: "tema-cerebro") e saem com as mesmas cores.
 */
export function TemaDasJanelas({ classe, children }: { classe: string; children: React.ReactNode }) {
  return <TemaCtx.Provider value={classe}>{children}</TemaCtx.Provider>
}

/** A classe de tema das janelas e menus abertos aqui (ou nada, fora de uma tela com tema). */
export function useTemaDasJanelas() {
  return React.useContext(TemaCtx)
}
