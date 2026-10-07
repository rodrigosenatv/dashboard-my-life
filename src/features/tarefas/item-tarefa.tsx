"use client"

import { Clock, FolderKanban } from "lucide-react"
import { Marcador } from "@/components/ui/basicos"
import { useAtualizar } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { PRIORIDADE } from "@/lib/rotulos"
import { cn, dataRelativa, diasAte } from "@/lib/utils"

type Tarefa = Tables<"tasks">

const corPrioridade: Record<string, string> = {
  urgente: "text-danger",
  necessario: "text-rotina",
  bom_fazer: "text-ink-3",
}

export function useConcluir() {
  const atualizar = useAtualizar("tasks")
  return (t: Tarefa, feito: boolean) =>
    atualizar.mutate({
      id: t.id,
      status: feito ? "done" : "todo",
      done_at: feito ? new Date().toISOString() : null,
    })
}

export function ItemTarefa({
  tarefa,
  projeto,
  aoAbrir,
  compacto,
}: {
  tarefa: Tarefa
  projeto?: string | null
  aoAbrir?: (t: Tarefa) => void
  compacto?: boolean
}) {
  const concluir = useConcluir()
  const feito = tarefa.status === "done"
  const dias = diasAte(tarefa.due_date)
  const atrasada = !feito && dias !== null && dias < 0

  return (
    <li
      className={cn(
        "group flex items-start gap-3 rounded-md px-2 py-2 -mx-2 hover:bg-surface-2/70",
        aoAbrir && "cursor-pointer",
      )}
      onClick={() => aoAbrir?.(tarefa)}
    >
      <div className="pt-0.5">
        <Marcador marcado={feito} aoMudar={(v) => concluir(tarefa, v)} rotulo={`Concluir ${tarefa.title}`} area="rotina" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("leading-snug", feito && "text-ink-3 line-through decoration-ink-3/60")}>{tarefa.title}</p>
        {!compacto || tarefa.due_date || tarefa.priority || projeto ? (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-3">
            {tarefa.due_date ? (
              <span className={cn("inline-flex items-center gap-1", atrasada && "font-medium text-danger")}>
                <Clock className="size-3" />
                {atrasada ? `atrasada, ${dataRelativa(tarefa.due_date)}` : dataRelativa(tarefa.due_date)}
                {tarefa.due_time ? ` às ${tarefa.due_time.slice(0, 5)}` : ""}
              </span>
            ) : null}
            {tarefa.priority ? (
              <span className={cn("font-medium", corPrioridade[tarefa.priority])}>
                {PRIORIDADE[tarefa.priority as keyof typeof PRIORIDADE]}
              </span>
            ) : null}
            {projeto ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <FolderKanban className="size-3 shrink-0" />
                <span className="truncate">{projeto}</span>
              </span>
            ) : null}
            {tarefa.kind === "rotina" ? <span>rotina</span> : null}
          </p>
        ) : null}
      </div>
    </li>
  )
}
