"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

/**
 * Link de menu: só pré-carrega a rota quando a pessoa demonstra intenção (mouse em cima, foco ou toque).
 * O padrão do Next pré-carrega todo link visível, e um menu com ~30 destinos disparava dezenas de pedidos
 * (e baixava o código de várias telas) em toda abertura do app.
 */
export function LinkIntencao({ href, onPointerEnter, onFocus, onTouchStart, ...resto }: React.ComponentProps<typeof Link>) {
  const router = useRouter()
  const feito = React.useRef(false)
  const adiantar = () => {
    if (feito.current || typeof href !== "string") return
    feito.current = true
    router.prefetch(href)
  }
  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={(e) => {
        adiantar()
        onPointerEnter?.(e)
      }}
      onFocus={(e) => {
        adiantar()
        onFocus?.(e)
      }}
      onTouchStart={(e) => {
        adiantar()
        onTouchStart?.(e)
      }}
      {...resto}
    />
  )
}
