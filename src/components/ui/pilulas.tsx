"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Escolha de uma opção em pílulas (tipo do item, categoria do gasto, hobby, meta da semana). */
export function EscolhaPilulas<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
  icones,
}: {
  opcoes: { id: T; rotulo: string }[]
  valor: T
  aoMudar: (v: T) => void
  rotulo: string
  icones?: Partial<Record<string, LucideIcon>>
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const ativo = o.id === valor
        const Icone: LucideIcon | undefined = icones?.[o.id]
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => aoMudar(o.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors toque:min-h-11",
              ativo ? "border-pen bg-pen/15 text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
            )}
          >
            {Icone ? <Icone className="size-3.5" aria-hidden /> : null}
            {o.rotulo}
          </button>
        )
      })}
    </div>
  )
}
