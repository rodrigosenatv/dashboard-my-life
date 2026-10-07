"use client"

import { useSyncExternalStore } from "react"

const nada = () => () => {}

/**
 * As páginas do app dependem da sessão, do fuso e da data do aparelho.
 * Por isso o conteúdo só aparece no navegador; no servidor fica o esqueleto.
 */
export function SoNoNavegador({ children, esqueleto }: { children: React.ReactNode; esqueleto: React.ReactNode }) {
  const noNavegador = useSyncExternalStore(
    nada,
    () => true,
    () => false,
  )
  return <>{noNavegador ? children : esqueleto}</>
}
