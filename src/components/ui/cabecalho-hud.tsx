"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import { ArrowLeft, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// O cabeçalho das telas futuristas (Segundo Cérebro, Conteúdo e IA): usa as cores --b-* do tema da tela.

export type ItemHud = { n: number | string; rotulo: string; cor?: string }

/** Os números do resumo, em pílulas de vidro. */
export function ChipsHud({ itens, className }: { itens: ItemHud[]; className?: string }) {
  if (!itens.length) return null
  return (
    // No celular as pílulas ficam numa linha que desliza para o lado; a partir do tablet, quebram linha
    <ul className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0", className)} aria-label="Resumo">
      {itens.map((h) => (
        <li key={h.rotulo} className="inline-flex min-h-9 shrink-0 items-baseline gap-1.5 whitespace-nowrap rounded-full border border-[var(--b-borda)] bg-white/[0.03] px-3 py-1 text-sm text-ink-2">
          <span className="tabular font-display text-base font-semibold" style={h.cor ? { color: h.cor } : undefined}>
            {h.n}
          </span>
          {h.rotulo}
        </li>
      ))}
    </ul>
  )
}

/**
 * O rótulo de HUD (a área e o papel da tela), o título com o ícone aceso, a ação principal, a descrição e o
 * resumo em números.
 */
export function CabecalhoHud({
  marca,
  titulo,
  descricao,
  icone: Icone,
  acoes,
  papel,
  hud,
  voltar,
  descricaoNoCelular = true,
  className,
  children,
}: {
  /** A área, no rótulo de HUD (ex.: Segundo Cérebro), com o ícone dela. */
  marca: { icone: LucideIcon; rotulo: string }
  titulo: ReactNode
  descricao?: ReactNode
  icone: LucideIcon
  acoes?: ReactNode
  /** O que a tela é dentro da área (ex.: "Objetivos com prazo"). */
  papel?: string
  hud?: ItemHud[]
  voltar?: { href: string; rotulo: string }
  /** Com a tela já cheia, a descrição só aparece em telas maiores (no celular ela empurra o conteúdo). */
  descricaoNoCelular?: boolean
  className?: string
  children?: ReactNode
}) {
  const Marca = marca.icone
  return (
    <header className={cn("mb-7 sm:mb-8", className)}>
      {voltar ? (
        <Link href={voltar.href} className="-ml-2 mb-2 inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full px-2 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4 shrink-0" aria-hidden /> <span className="truncate">{voltar.rotulo}</span>
        </Link>
      ) : null}
      <p className="rotulo-hud flex items-center gap-2">
        <Marca className="size-3.5 shrink-0 text-[var(--b-luz)]" aria-hidden />
        {/* No celular as abas já dizem qual é a área: fica só o papel da tela */}
        <span className="truncate">
          {papel ? (
            <>
              <span className="hidden sm:inline">{marca.rotulo} · </span>
              {papel}
            </>
          ) : (
            marca.rotulo
          )}
        </span>
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="flex min-w-0 items-center gap-3 font-display text-[2.1rem] font-semibold leading-[1.05] tracking-tight sm:text-[3rem]">
          <span className="icone-aceso hidden size-12 sm:grid" aria-hidden>
            <Icone className="size-6" />
          </span>
          <span className="min-w-0 break-words">{titulo}</span>
        </h1>
        {acoes ? <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div> : null}
      </div>
      {descricao ? <div className={cn("mt-2 max-w-2xl text-ink-2", !descricaoNoCelular && "hidden sm:block")}>{descricao}</div> : null}
      {hud?.length ? <ChipsHud itens={hud} className="mt-4" /> : null}
      {children}
    </header>
  )
}

/** O botão da ação principal da tela, aceso. */
export const ACAO_ACESA = "shadow-[0_0_24px_-6px_var(--b-luz)]"
