"use client"

import Link from "next/link"
import * as React from "react"
import { Botao } from "@/components/ui/button"

/** Erro inesperado em uma tela: o menu continua no lugar e a pessoa pode tentar de novo. */
export default function ErroDaTela({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  React.useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div role="alert" className="max-w-md rounded-lg border border-danger/30 bg-danger-soft px-5 py-5">
      <h1 className="font-display text-xl font-semibold text-ink">Algo deu errado nesta tela</h1>
      <p className="mt-1.5 text-sm text-ink-2">Seus dados estão salvos. Tente de novo; se continuar, volte para a página inicial.</p>
      {error.message ? <p className="mt-2 break-words text-xs text-ink-3">{error.message}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Botao variante="primario" onClick={() => retry()}>
          Tentar de novo
        </Botao>
        <Link href="/" className="px-2 text-sm font-medium text-ink-2 hover:text-ink">
          Ir para Hoje
        </Link>
      </div>
    </div>
  )
}
