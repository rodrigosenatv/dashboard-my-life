"use client"

import { CalendarPlus, Clapperboard, Inbox, ListTodo, Plus } from "lucide-react"
import * as React from "react"
import { Botao } from "@/components/ui/button"
import { Menu, MenuConteudo, MenuGatilho, MenuItem } from "@/components/ui/menu"
import { DialogoTarefa } from "@/features/tarefas/dialogo-tarefa"
import { DialogoCaptura } from "@/features/capturas/dialogo-captura"
import { DialogoEvento } from "@/features/agenda/dialogo-evento"
import { DialogoConteudo } from "@/features/planner/dialogo-conteudo"
import { cn } from "@/lib/utils"

type TipoNovo = "tarefa" | "captura" | "evento" | "conteudo"
const EVENTO = "dml:novo"

export function abrirNovo(tipo: TipoNovo) {
  window.dispatchEvent(new CustomEvent<TipoNovo>(EVENTO, { detail: tipo }))
}

const OPCOES: { tipo: TipoNovo; rotulo: string; icone: typeof Plus; atalho: string }[] = [
  { tipo: "tarefa", rotulo: "Tarefa", icone: ListTodo, atalho: "T" },
  { tipo: "captura", rotulo: "Captura", icone: Inbox, atalho: "C" },
  { tipo: "evento", rotulo: "Compromisso", icone: CalendarPlus, atalho: "A" },
  { tipo: "conteudo", rotulo: "Ideia de conteúdo", icone: Clapperboard, atalho: "I" },
]

export function BotaoNovo({ compacto, className }: { compacto?: boolean; className?: string }) {
  return (
    <Menu>
      <MenuGatilho asChild>
        {compacto ? (
          <Botao variante="primario" tamanho="icone" aria-label="Criar" className={cn("rounded-full", className)}>
            <Plus />
          </Botao>
        ) : (
          <Botao variante="primario" aria-label="Novo" title="Novo" className={cn("w-full justify-start recolhido:justify-center recolhido:px-0", className)}>
            <Plus />
            <span className="recolhido:hidden">Novo</span>
          </Botao>
        )}
      </MenuGatilho>
      <MenuConteudo align={compacto ? "end" : "start"} className="w-56">
        {OPCOES.map((o) => (
          <MenuItem key={o.tipo} onSelect={() => abrirNovo(o.tipo)}>
            <o.icone />
            <span className="flex-1">{o.rotulo}</span>
          </MenuItem>
        ))}
      </MenuConteudo>
    </Menu>
  )
}

/** Monta as janelas de criação rápida uma vez, para todo o app. */
export function NovoGlobal() {
  const [aberto, setAberto] = React.useState<TipoNovo | null>(null)

  React.useEffect(() => {
    const abrir = (e: Event) => setAberto((e as CustomEvent<TipoNovo>).detail)
    window.addEventListener(EVENTO, abrir)
    return () => window.removeEventListener(EVENTO, abrir)
  }, [])

  const fechar = (v: boolean) => !v && setAberto(null)

  return (
    <>
      {aberto === "tarefa" ? <DialogoTarefa aberta aoMudar={fechar} /> : null}
      {aberto === "captura" ? <DialogoCaptura aberta aoMudar={fechar} /> : null}
      {aberto === "evento" ? <DialogoEvento aberta aoMudar={fechar} /> : null}
      {aberto === "conteudo" ? <DialogoConteudo aberta aoMudar={fechar} /> : null}
    </>
  )
}
