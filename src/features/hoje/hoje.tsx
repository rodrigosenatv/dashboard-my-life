"use client"

import Link from "next/link"
import * as React from "react"
import { useProjetosPorNome } from "@/features/projetos/dados"
import { format } from "date-fns"
import { Secao } from "@/components/ui/basicos"
import { novoId, useCriar, useLista } from "@/lib/data"
import { cn, dataRelativa, isoDia } from "@/lib/utils"
import { ItemTarefa } from "@/features/tarefas/item-tarefa"
import { DialogoTarefa } from "@/features/tarefas/dialogo-tarefa"
import type { Tables } from "@/lib/supabase/database.types"
import { abrirNovo } from "@/components/shell/novo"
import { agendaPorDia, posicaoNoFim, tarefasDoDia } from "./logica"
import { PonteDoDia } from "./ponte"

// A página Hoje é a ponte de comando do dia (./ponte). As tarefas e a agenda daqui, no visual de sempre,
// aparecem também nas telas de Vida pessoal sem tela própria (src/features/vida/pagina-hub.tsx).

/* ------------------------------------------------------------------ */
/* Tarefas do dia                                                      */
/* ------------------------------------------------------------------ */

type Tarefa = Tables<"tasks">

export function TarefasHoje() {
  const hoje = isoDia()
  const { data: tarefas = [], isLoading } = useLista("tasks", { ordem: [{ coluna: "position" }] })
  const { data: projetos = [] } = useProjetosPorNome()
  const criar = useCriar("tasks")
  const [nova, setNova] = React.useState("")
  const [aberta, setAberta] = React.useState<Tarefa | null>(null)

  const nomes = React.useMemo(() => new Map(projetos.map((p) => [p.id, p.name])), [projetos])

  const { pendentes: doDia, concluidasHoje, semData } = tarefasDoDia(tarefas, hoje)

  const adicionar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nova.trim()) return
    criar.mutate({ id: novoId(), title: nova.trim(), due_date: hoje, position: posicaoNoFim() })
    setNova("")
  }

  return (
    <Secao
      titulo="Para hoje"
      acao={
        <Link href="/rotina/tarefas" className="text-sm text-ink-2 hover:text-ink toque:-my-3 toque:py-3">
          Todas as tarefas
        </Link>
      }
    >
      {isLoading ? (
        <div className="grid gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      ) : (
        <>
          {doDia.length === 0 && semData.length === 0 ? (
            <p className="py-2 text-ink-2">
              {concluidasHoje.length ? "Tudo feito por hoje. Bom trabalho." : "Nada pendente para hoje."}
            </p>
          ) : (
            <ul className="grid">
              {[...doDia, ...semData].map((t) => (
                <ItemTarefa key={t.id} tarefa={t} projeto={t.project_id ? nomes.get(t.project_id) : null} aoAbrir={setAberta} />
              ))}
            </ul>
          )}
          <form onSubmit={adicionar} className="mt-2 flex items-center gap-3 rounded-md px-2 -mx-2">
            <span aria-hidden className="size-5 shrink-0 rounded-full border-[1.5px] border-dashed border-line-strong" />
            <input
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              placeholder="Adicionar tarefa para hoje"
              aria-label="Adicionar tarefa para hoje"
              className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3 toque:h-11 toque:text-[16px]"
            />
          </form>
          {concluidasHoje.length ? (
            <p className="mt-3 text-sm text-ink-3">
              {concluidasHoje.length === 1 ? "1 tarefa concluída hoje" : `${concluidasHoje.length} tarefas concluídas hoje`}
            </p>
          ) : null}
        </>
      )}
      <DialogoTarefa aberta={Boolean(aberta)} aoMudar={(v) => !v && setAberta(null)} tarefa={aberta} />
    </Secao>
  )
}

/* ------------------------------------------------------------------ */
/* Agenda                                                              */
/* ------------------------------------------------------------------ */

const corCategoria: Record<string, string> = {
  Reunião: "bg-projetos",
  Aniversário: "bg-conteudo",
  Viagem: "bg-estudos",
}

export function AgendaProxima() {
  const hoje = isoDia()
  const { data: eventos = [], isLoading } = useLista("events", { ordem: [{ coluna: "starts_at" }] })
  const porDia = new Map(agendaPorDia(eventos, hoje))

  return (
    <Secao
      titulo="Agenda"
      acao={
        <button type="button" onClick={() => abrirNovo("evento")} className="text-sm text-ink-2 hover:text-ink toque:-my-3 toque:py-3">
          Agendar
        </button>
      }
    >
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-md bg-surface-2" />
      ) : porDia.size === 0 ? (
        <p className="py-2 text-ink-2">Nenhum compromisso nos próximos 7 dias.</p>
      ) : (
        <ol className="grid gap-4">
          {[...porDia.entries()].map(([dia, lista]) => (
            <li key={dia}>
              <p className="mb-1.5 text-sm font-medium first-letter:uppercase">{dataRelativa(dia)}</p>
              <ul className="grid gap-1.5 border-l border-line pl-3">
                {lista.map((e) => (
                  <li key={e.id} className="flex items-baseline gap-2.5 text-sm">
                    <span className={cn("size-1.5 shrink-0 -translate-y-0.5 rounded-full", corCategoria[e.category ?? ""] ?? "bg-pen")} />
                    <span className="tabular w-11 shrink-0 text-ink-3">{e.all_day ? "dia" : format(new Date(e.starts_at), "HH:mm")}</span>
                    <Link href={`/rotina/agenda?abrir=${e.id}`} className="min-w-0 truncate hover:underline">
                      {e.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Secao>
  )
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export function Hoje() {
  return <PonteDoDia />
}
