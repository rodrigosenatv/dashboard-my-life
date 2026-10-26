"use client"

import { AudioWaveform, type LucideIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { TemaDasJanelas } from "@/components/ui/tema-janelas"
import { CabecalhoHud } from "@/components/ui/cabecalho-hud"
import { cn } from "@/lib/utils"

/**
 * A moldura de Conteúdo e IA: o tema do estúdio (cores e fundo no bloco "Conteúdo e IA: o estúdio" do
 * globals.css). As janelas e menus abertos daqui saem com as mesmas cores.
 */
export function MolduraEstudio({ children, detalhe, className }: { children: ReactNode; detalhe?: boolean; className?: string }) {
  return (
    <TemaDasJanelas classe="tema-estudio">
      <div
        className={cn(
          "tema-estudio estudio -mx-4 -mb-28 -mt-5 min-h-[calc(100dvh-7rem)] px-4 pb-32 sm:mx-0 sm:mb-0 sm:mt-0 sm:min-h-0 sm:rounded-[1.75rem] sm:px-6 sm:pb-10 lg:px-8",
          detalhe ? "pt-5 sm:pt-6" : "pt-6 sm:pt-8",
          className,
        )}
      >
        {children}
      </div>
    </TemaDasJanelas>
  )
}

const MARCA = { icone: AudioWaveform, rotulo: "Conteúdo e IA" }

/** O cabeçalho das telas de Conteúdo e IA (Biblioteca, Planner, Assistente). */
export function CabecalhoEstudio(props: Omit<ComponentProps<typeof CabecalhoHud>, "marca">) {
  return <CabecalhoHud marca={MARCA} {...props} />
}

/** O título de um painel: rótulo de HUD com o ícone aceso numa cor e uma ação à direita. */
export function TituloPainel({
  id,
  icone: Icone,
  titulo,
  cor = "var(--b-luz)",
  extra,
  acao,
  className,
}: {
  id?: string
  icone: LucideIcon
  titulo: string
  cor?: string
  extra?: ReactNode
  acao?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-3 flex min-h-8 items-center justify-between gap-3", className)}>
      <h2 id={id} className="rotulo-hud flex min-w-0 items-center gap-2">
        <Icone className="size-3.5 shrink-0" style={{ color: cor }} aria-hidden />
        <span className="truncate">{titulo}</span>
        {extra}
      </h2>
      {acao}
    </div>
  )
}

/** Link discreto no canto de um painel ("Ver tudo"). */
export const LINK_PAINEL =
  "inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-sm text-ink-2 transition-colors hover:bg-white/[0.06] hover:text-ink toque:min-h-11"
