"use client"

import * as React from "react"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuRotulo, MenuSeparador } from "@/components/ui/menu"
import { FORMATOS_CONTEUDO } from "@/lib/rotulos"
import { ICONE_FORMATO, IconeFormatoOutro } from "./ui"

/**
 * O menu "Nova versão": leva o assunto de um conteúdo para outro formato (de Reels para Carrossel, por
 * exemplo). O gatilho vem de quem usa.
 */
export function MenuNovaVersao({ formatoAtual, aoEscolher, children }: { formatoAtual: string | null; aoEscolher: (formato: string) => void; children: React.ReactElement }) {
  const opcoes = FORMATOS_CONTEUDO.filter((f) => f !== formatoAtual)
  return (
    <Menu>
      <MenuGatilho asChild>{children}</MenuGatilho>
      <MenuConteudo className="w-64">
        <MenuRotulo>Nova versão em outro formato</MenuRotulo>
        {opcoes.map((f) => {
          const Icone = ICONE_FORMATO[f] ?? IconeFormatoOutro
          return (
            <MenuItem key={f} onSelect={() => aoEscolher(f)}>
              <Icone /> {f}
            </MenuItem>
          )
        })}
        <MenuSeparador />
        <p className="px-2.5 pb-1.5 pt-1 text-xs text-ink-3">O mesmo assunto com a cara do formato novo. Entra em Idealizando, com o que adaptar e o roteiro do original.</p>
      </MenuConteudo>
    </Menu>
  )
}
