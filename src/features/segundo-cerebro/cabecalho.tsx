"use client"

import { BrainCircuit } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { TemaDasJanelas } from "@/components/ui/tema-janelas"
import { CabecalhoHud } from "@/components/ui/cabecalho-hud"
import { cn } from "@/lib/utils"

export { ACAO_ACESA, ChipsHud, type ItemHud } from "@/components/ui/cabecalho-hud"

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

const MARCA = { icone: BrainCircuit, rotulo: "Segundo Cérebro" }

/**
 * O cabeçalho das telas do Segundo Cérebro: o rótulo de HUD (com o papel da tela no método PARA), o
 * título com o ícone aceso, a ação principal, a descrição e o resumo em números.
 */
export function CabecalhoCerebro(props: Omit<ComponentProps<typeof CabecalhoHud>, "marca">) {
  return <CabecalhoHud marca={MARCA} {...props} />
}
