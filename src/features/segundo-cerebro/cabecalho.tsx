"use client"

import Link from "next/link"
import { ArrowLeft, BrainCircuit, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { TemaDasJanelas } from "@/components/ui/tema-janelas"
import { cn } from "@/lib/utils"

/**
 * A moldura do Segundo Cérebro: o tema da rede neural (cores e fundo no bloco "Segundo Cérebro" do
 * globals.css). As janelas e menus abertos daqui saem com as mesmas cores.
 */
export function MolduraCerebro({ children, detalhe }: { children: ReactNode; detalhe?: boolean }) {
  return (
    <TemaDasJanelas classe="tema-cerebro">
      <div
        className={cn(
          "tema-cerebro cerebro -mx-4 -mb-28 -mt-5 min-h-[calc(100dvh-7rem)] px-4 pb-32 sm:mx-0 sm:mb-0 sm:mt-0 sm:min-h-0 sm:rounded-[1.75rem] sm:px-6 sm:pb-10 lg:px-8",
          detalhe ? "pt-5 sm:pt-6" : "pt-6 sm:pt-8",
        )}
      >
        {children}
      </div>
    </TemaDasJanelas>
  )
}

export type ItemHud = { n: number | string; rotulo: string; cor?: string }

/** Os números do resumo, em pílulas de vidro. */
export function ChipsHud({ itens, className }: { itens: ItemHud[]; className?: string }) {
  if (!itens.length) return null
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Resumo">
      {itens.map((h) => (
        <li key={h.rotulo} className="inline-flex min-h-9 items-baseline gap-1.5 rounded-full border border-[var(--b-borda)] bg-white/[0.03] px-3 py-1 text-sm text-ink-2 backdrop-blur">
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
 * O cabeçalho das telas do Segundo Cérebro: o rótulo de HUD (com o papel da tela no método PARA), o
 * título com o ícone aceso, a ação principal, a descrição e o resumo em números.
 */
export function CabecalhoCerebro({
  titulo,
  descricao,
  icone: Icone,
  acoes,
  papel,
  hud,
  voltar,
  descricaoNoCelular = true,
  children,
}: {
  titulo: ReactNode
  descricao?: ReactNode
  icone: LucideIcon
  acoes?: ReactNode
  /** O que a tela é no método PARA (ex.: "Objetivos com prazo"). */
  papel?: string
  hud?: ItemHud[]
  voltar?: { href: string; rotulo: string }
  /** Com a tela já cheia, a descrição só aparece em telas maiores (no celular ela empurra o conteúdo). */
  descricaoNoCelular?: boolean
  children?: ReactNode
}) {
  return (
    <header className="mb-7 sm:mb-8">
      {voltar ? (
        <Link href={voltar.href} className="-ml-2 mb-2 inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full px-2 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4 shrink-0" aria-hidden /> <span className="truncate">{voltar.rotulo}</span>
        </Link>
      ) : null}
      <p className="rotulo-hud flex items-center gap-2">
        <BrainCircuit className="size-3.5 shrink-0 text-[var(--b-luz)]" aria-hidden />
        {/* No celular as abas já dizem que é o Segundo Cérebro: fica só o papel da tela */}
        <span className="truncate">{papel ? <><span className="hidden sm:inline">Segundo Cérebro · </span>{papel}</> : "Segundo Cérebro"}</span>
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
