"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import * as React from "react"

/**
 * Abre o item indicado por `?abrir=<id>` (links da busca e da página Hoje).
 * Abre uma única vez e tira o parâmetro do endereço: sem isso, cada atualização
 * da lista (salvar, voltar para a aba) reabria a janela que a pessoa acabou de fechar.
 */
export function useAbrirDoEndereco<T extends { id: string }>(itens: T[], abrir: (item: T) => void) {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const id = params.get("abrir")
  const tratado = React.useRef<string | null>(null)
  const aoAbrir = React.useRef(abrir)
  React.useEffect(() => {
    aoAbrir.current = abrir
  })

  React.useEffect(() => {
    if (!id) {
      tratado.current = null
      return
    }
    if (tratado.current === id) return
    const item = itens.find((x) => x.id === id)
    if (!item) return
    tratado.current = id
    aoAbrir.current(item)
    const resto = new URLSearchParams(params)
    resto.delete("abrir")
    const consulta = resto.toString()
    router.replace(consulta ? `${pathname}?${consulta}` : pathname, { scroll: false })
  }, [id, itens, params, pathname, router])
}
