"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Secao } from "@/components/ui/basicos"
import { useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { cn, dataRelativa, isoDia } from "@/lib/utils"
import { DialogoEvento } from "./dialogo-evento"

type Evento = Tables<"events">

const corCategoria: Record<string, string> = {
  Reunião: "bg-projetos",
  Aniversário: "bg-conteudo",
  Viagem: "bg-estudos",
  Estudo: "bg-estudos",
  Saúde: "bg-rotina",
}

function diasDoEvento(e: Evento): string[] {
  const ini = new Date(e.starts_at)
  const fim = e.ends_at ? new Date(e.ends_at) : ini
  const dias: string[] = []
  let d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate())
  for (let i = 0; i < 62 && d <= fim; i++) {
    dias.push(isoDia(d))
    d = addDays(d, 1)
  }
  return dias.length ? dias : [isoDia(ini)]
}

export function PaginaAgenda() {
  const params = useSearchParams()
  const hoje = isoDia()
  const [mes, setMes] = React.useState(() => startOfMonth(new Date()))
  const [aberto, setAberto] = React.useState<Evento | null>(null)
  const [novoDia, setNovoDia] = React.useState<string | null>(null)
  const { data: eventos = [], isLoading } = useLista("events", { ordem: [{ coluna: "starts_at" }] })
  const { data: tarefas = [] } = useLista("tasks", { ordem: [{ coluna: "position" }] })

  React.useEffect(() => {
    const id = params.get("abrir")
    if (id) {
      const e = eventos.find((x) => x.id === id)
      if (e) setAberto(e)
    }
  }, [params, eventos])

  const porDia = React.useMemo(() => {
    const mapa = new Map<string, Evento[]>()
    for (const e of eventos) for (const d of diasDoEvento(e)) mapa.set(d, [...(mapa.get(d) ?? []), e])
    return mapa
  }, [eventos])

  const tarefasPorDia = React.useMemo(() => {
    const mapa = new Map<string, number>()
    for (const t of tarefas) if (t.due_date && t.status !== "done") mapa.set(t.due_date, (mapa.get(t.due_date) ?? 0) + 1)
    return mapa
  }, [tarefas])

  const inicio = startOfWeek(startOfMonth(mes), { weekStartsOn: 0 })
  const fim = endOfWeek(endOfMonth(mes), { weekStartsOn: 0 })
  const dias: Date[] = []
  for (let d = inicio; d <= fim; d = addDays(d, 1)) dias.push(d)

  const proximos = eventos.filter((e) => isoDia(new Date(e.ends_at ?? e.starts_at)) >= hoje).slice(0, 15)

  return (
    <div>
      <Cabecalho
        area="rotina"
        titulo="Agenda"
        descricao="Compromissos, reuniões e datas importantes. Clique em um dia para agendar."
        acoes={
          <Botao variante="primario" onClick={() => setNovoDia(hoje)}>
            <Plus /> Novo compromisso
          </Botao>
        }
      />

      {isLoading ? (
        <Carregando />
      ) : (
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <section aria-label="Calendário do mês">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold first-letter:uppercase">{format(mes, "MMMM 'de' yyyy", { locale: ptBR })}</h2>
              <div className="flex items-center gap-1">
                <Botao variante="fantasma" tamanho="icone-sm" aria-label="Mês anterior" onClick={() => setMes((m) => addMonths(m, -1))}>
                  <ChevronLeft />
                </Botao>
                <Botao variante="fantasma" tamanho="sm" onClick={() => setMes(startOfMonth(new Date()))}>
                  Hoje
                </Botao>
                <Botao variante="fantasma" tamanho="icone-sm" aria-label="Próximo mês" onClick={() => setMes((m) => addMonths(m, 1))}>
                  <ChevronRight />
                </Botao>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-line bg-line">
              <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-ink-3">
                {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => (
                  <div key={d} className="bg-surface-2 py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px">
                {dias.map((d) => {
                  const iso = isoDia(d)
                  const doMes = d.getMonth() === mes.getMonth()
                  const lista = porDia.get(iso) ?? []
                  const nTarefas = tarefasPorDia.get(iso) ?? 0
                  return (
                    <div
                      key={iso}
                      role="button"
                      tabIndex={0}
                      onClick={() => setNovoDia(iso)}
                      onKeyDown={(e) => e.key === "Enter" && setNovoDia(iso)}
                      className={cn("min-h-16 cursor-pointer bg-surface p-1.5 text-left hover:bg-surface-2 sm:min-h-24", !doMes && "bg-surface/60 text-ink-3")}
                    >
                      <span
                        className={cn(
                          "tabular inline-grid size-6 place-items-center rounded-full text-xs",
                          iso === hoje ? "bg-pen font-semibold text-pen-ink" : "",
                        )}
                      >
                        {d.getDate()}
                      </span>
                      <div className="mt-0.5 grid gap-0.5">
                        {lista.slice(0, 3).map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              setAberto(e)
                            }}
                            className="flex min-w-0 items-center gap-1 rounded px-1 text-left text-[11px] leading-5 hover:bg-surface-3"
                          >
                            <span className={cn("size-1.5 shrink-0 rounded-full", corCategoria[e.category ?? ""] ?? "bg-pen")} />
                            <span className="hidden truncate sm:inline">{e.title}</span>
                          </button>
                        ))}
                        {lista.length > 3 ? <span className="px-1 text-[11px] text-ink-3">+{lista.length - 3}</span> : null}
                        {nTarefas ? (
                          <span className="hidden px-1 text-[11px] text-ink-3 sm:block">{nTarefas === 1 ? "1 tarefa" : `${nTarefas} tarefas`}</span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          <Secao titulo="Próximos">
            {proximos.length === 0 ? (
              <p className="text-sm text-ink-2">Nenhum compromisso marcado.</p>
            ) : (
              <ul className="grid gap-3">
                {proximos.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => setAberto(e)} className="w-full text-left">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className={cn("size-2 shrink-0 rounded-full", corCategoria[e.category ?? ""] ?? "bg-pen")} />
                        {e.title}
                      </span>
                      <span className="ml-4 block text-xs text-ink-3 first-letter:uppercase">
                        {dataRelativa(isoDia(new Date(e.starts_at)))}
                        {e.all_day ? "" : `, ${format(new Date(e.starts_at), "HH:mm")}`}
                        {e.location ? `, ${e.location}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>
      )}

      <DialogoEvento
        aberta={Boolean(aberto) || Boolean(novoDia)}
        aoMudar={(v) => {
          if (!v) {
            setAberto(null)
            setNovoDia(null)
          }
        }}
        evento={aberto}
        diaInicial={novoDia ?? undefined}
      />
    </div>
  )
}
