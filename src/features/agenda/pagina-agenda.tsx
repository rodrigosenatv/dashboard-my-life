"use client"

import * as React from "react"
import { useAbrirDoEndereco } from "@/lib/abrir-do-endereco"
import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Secao, Segmentos } from "@/components/ui/basicos"
import { useAtualizar, useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { cn, dataRelativa, isoDia } from "@/lib/utils"
import { DialogoEvento } from "./dialogo-evento"

type Evento = Tables<"events">
type Visao = "mes" | "semana" | "lista" | "historico"

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
  const hoje = isoDia()
  const [mes, setMes] = React.useState(() => startOfMonth(new Date()))
  const [visao, setVisao] = React.useState<Visao>("mes")
  const [semana, setSemana] = React.useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))
  const atualizar = useAtualizar("events")
  const [aberto, setAberto] = React.useState<Evento | null>(null)
  const [novoDia, setNovoDia] = React.useState<string | null>(null)
  const { data: eventos = [], isLoading } = useLista("events", { ordem: [{ coluna: "starts_at" }] })
  const { data: tarefas = [] } = useLista("tasks", { ordem: [{ coluna: "position" }] })

  useAbrirDoEndereco(eventos, setAberto)

  const porDia = React.useMemo(() => {
    const mapa = new Map<string, Evento[]>()
    for (const e of eventos) if (!e.done) for (const d of diasDoEvento(e)) mapa.set(d, [...(mapa.get(d) ?? []), e])
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

  const proximos = eventos.filter((e) => !e.done && isoDia(new Date(e.ends_at ?? e.starts_at)) >= hoje).slice(0, 15)
  const pendentes = eventos.filter((e) => !e.done)
  const historico = eventos.filter((e) => e.done).sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  const diasSemana = Array.from({ length: 7 }, (_, i) => addDays(semana, i))
  const tarefasDoDia = (iso: string) => tarefas.filter((t) => t.due_date === iso && t.status !== "done")

  const linhaEvento = (e: Evento) => (
    <li key={e.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={e.done}
        aria-label={e.done ? `Reabrir ${e.title}` : `Marcar ${e.title} como feito`}
        onClick={() => atualizar.mutate({ id: e.id, done: !e.done })}
        className={cn("grid size-5 shrink-0 place-items-center rounded-[5px] border", e.done ? "border-rotina bg-rotina text-white" : "border-line-strong hover:border-rotina")}
      >
        {e.done ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </button>
      <button type="button" onClick={() => setAberto(e)} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className={cn("size-2 shrink-0 rounded-full", corCategoria[e.category ?? ""] ?? "bg-pen")} />
          <span className="truncate">{e.title}</span>
        </span>
        <span className="ml-4 block text-xs text-ink-3">
          {format(new Date(e.starts_at), "EEE, d 'de' MMM 'de' yyyy", { locale: ptBR })}
          {e.all_day ? "" : `, ${format(new Date(e.starts_at), "HH:mm")}`}
          {e.category ? `, ${e.category}` : ""}
          {e.location ? `, ${e.location}` : ""}
        </span>
        {e.description ? <span className="ml-4 block truncate text-xs text-ink-2">{e.description}</span> : null}
      </button>
    </li>
  )

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

      <Segmentos
        rotulo="Visualização da agenda"
        className="mb-6"
        valor={visao}
        aoMudar={setVisao}
        opcoes={[
          { valor: "mes", rotulo: "Mês" },
          { valor: "semana", rotulo: "Semana" },
          { valor: "lista", rotulo: "Lista", contagem: pendentes.length },
          { valor: "historico", rotulo: "Histórico", contagem: historico.length },
        ]}
      />

      {isLoading ? (
        <Carregando />
      ) : visao === "semana" ? (
        <section aria-label="Semana">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">
              {format(diasSemana[0], "d 'de' MMM", { locale: ptBR })} a {format(diasSemana[6], "d 'de' MMM", { locale: ptBR })}
            </h2>
            <div className="flex items-center gap-1">
              <Botao variante="fantasma" tamanho="icone-sm" aria-label="Semana anterior" onClick={() => setSemana((d) => addDays(d, -7))}>
                <ChevronLeft />
              </Botao>
              <Botao variante="fantasma" tamanho="sm" onClick={() => setSemana(startOfWeek(new Date(), { weekStartsOn: 0 }))}>
                Hoje
              </Botao>
              <Botao variante="fantasma" tamanho="icone-sm" aria-label="Próxima semana" onClick={() => setSemana((d) => addDays(d, 7))}>
                <ChevronRight />
              </Botao>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-7">
            {diasSemana.map((d) => {
              const iso = isoDia(d)
              const lista = porDia.get(iso) ?? []
              const ts = tarefasDoDia(iso)
              return (
                <div key={iso} className={cn("min-h-40 rounded-lg border bg-surface p-2", iso === hoje ? "border-pen" : "border-line")}>
                  <button type="button" onClick={() => setNovoDia(iso)} className="mb-2 flex w-full items-baseline justify-between text-left">
                    <span className="text-xs text-ink-3 first-letter:uppercase">{format(d, "EEE", { locale: ptBR })}</span>
                    <span className={cn("tabular text-lg font-semibold", iso === hoje && "text-pen")}>{d.getDate()}</span>
                  </button>
                  <div className="grid gap-1">
                    {lista.map((e) => (
                      <button key={e.id} type="button" onClick={() => setAberto(e)} className="rounded-md bg-surface-2 px-2 py-1 text-left text-xs hover:bg-surface-3">
                        <span className="flex items-center gap-1.5 font-medium">
                          <span className={cn("size-1.5 shrink-0 rounded-full", corCategoria[e.category ?? ""] ?? "bg-pen")} />
                          <span className="truncate">{e.title}</span>
                        </span>
                        {e.all_day ? null : <span className="tabular text-ink-3">{format(new Date(e.starts_at), "HH:mm")}</span>}
                      </button>
                    ))}
                    {ts.map((t) => (
                      <p key={t.id} className="truncate px-2 text-xs text-ink-2" title={t.title}>
                        ○ {t.title}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : visao === "lista" ? (
        pendentes.length === 0 ? <p className="text-sm text-ink-2">Nenhum compromisso pendente.</p> : <ul className="max-w-3xl">{pendentes.map(linhaEvento)}</ul>
      ) : visao === "historico" ? (
        historico.length === 0 ? <p className="text-sm text-ink-2">Nenhum compromisso concluído ainda.</p> : <ul className="max-w-3xl">{historico.map(linhaEvento)}</ul>
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
