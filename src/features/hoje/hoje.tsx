"use client"

import Link from "next/link"
import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Check, CornerDownLeft, Flame } from "lucide-react"
import { Etiqueta, Progresso, Secao, Vazio } from "@/components/ui/basicos"
import { novoId, useCriar, useLista } from "@/lib/data"
import { cn, dataRelativa, isoDia, porcentagem, saudacao, somarDias } from "@/lib/utils"
import { agruparPorRitual, indexar, sequencia, useAlternarHabito, useHabitos, useRegistros, useRituais, valeNoDia } from "@/features/habitos/dados"
import { ItemTarefa } from "@/features/tarefas/item-tarefa"
import { DialogoTarefa } from "@/features/tarefas/dialogo-tarefa"
import { useNomeExibicao } from "@/features/configuracoes/dados"
import type { Tables } from "@/lib/supabase/database.types"
import { abrirNovo } from "@/components/shell/novo"
import { Capa, MenuAtalhos } from "./painel"

/* ------------------------------------------------------------------ */
/* Cabeçalho do dia                                                    */
/* ------------------------------------------------------------------ */

function CabecalhoDia() {
  const agora = new Date()
  const nome = useNomeExibicao()
  const criar = useCriar("captures")
  const [texto, setTexto] = React.useState("")

  const capturar = (e: React.FormEvent) => {
    e.preventDefault()
    const t = texto.trim()
    if (!t) return
    const ehLink = /^https?:\/\//i.test(t)
    // Sem tipo: a captura cai na Caixa de Entrada do Segundo Cérebro para ser organizada depois
    criar.mutate({ id: novoId(), title: t, url: ehLink ? t : null, kind: null })
    setTexto("")
  }

  const diaSemana = format(agora, "EEEE", { locale: ptBR })

  return (
    <header className="mb-8 grid gap-6 border-b border-line pb-6 md:grid-cols-[1fr_minmax(0,22rem)] md:items-end">
      <div className="flex items-end gap-5">
        <p className="font-display text-5xl font-bold tabular tracking-tighter" aria-hidden>
          {format(agora, "dd")}
        </p>
        <div className="pb-1.5">
          <h1 className="font-display text-2xl font-semibold first-letter:uppercase">{diaSemana}</h1>
          <p className="text-ink-2">{format(agora, "MMMM 'de' yyyy", { locale: ptBR })}</p>
          <p className="mt-2 text-ink">
            {saudacao(agora)}
            {nome ? `, ${nome}` : ""}.
          </p>
        </div>
      </div>
      <form onSubmit={capturar} className="relative">
        <label htmlFor="captura-rapida" className="mb-1.5 block text-sm text-ink-3">
          Captura rápida
        </label>
        <input
          id="captura-rapida"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Uma ideia, um link, um lembrete…"
          className="h-11 w-full rounded-lg border border-line-strong bg-surface pl-3.5 pr-10 text-base placeholder:text-ink-3 focus-visible:border-pen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen/25"
        />
        <CornerDownLeft aria-hidden className="pointer-events-none absolute bottom-3.5 right-3 size-4 text-ink-3" />
      </form>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Hábitos do dia                                                      */
/* ------------------------------------------------------------------ */

function HabitosHoje() {
  const hoje = isoDia()
  const { data: habitos = [], isLoading } = useHabitos()
  const { data: registros = [] } = useRegistros(somarDias(hoje, -400))
  const alternar = useAlternarHabito()
  const { ritualDe } = useRituais()

  const indice = React.useMemo(() => indexar(registros), [registros])
  const doDia = habitos.filter((h) => h.active && valeNoDia(h, hoje))
  const feitos = doDia.filter((h) => indice.get(h.id)?.has(hoje)).length
  const grupos = agruparPorRitual(doDia, ritualDe)
  const pct = porcentagem(feitos, doDia.length)

  return (
    <Secao
      titulo="Rituais de hoje"
      className="mb-10"
      acao={
        <Link href="/rotina/habitos" className="text-sm text-ink-2 hover:text-ink toque:-my-3 toque:py-3">
          Ver hábitos
        </Link>
      }
    >
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-surface-2" />
      ) : doDia.length === 0 ? (
        <Vazio
          titulo="Nenhum hábito para hoje."
          descricao="Cadastre os hábitos que quer acompanhar e marque-os aqui todos os dias."
          acao={
            <Link href="/rotina/habitos" className="text-sm font-medium text-pen hover:underline">
              Cadastrar hábitos
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <Progresso valor={pct} cor="rotina" rotulo="Progresso dos rituais de hoje" className="h-2" />
            <span className="tabular shrink-0 text-sm font-medium">{pct}%</span>
            <span className="tabular shrink-0 text-sm text-ink-3">
              {feitos} de {doDia.length}
            </span>
          </div>
          <div className={cn("grid gap-x-8 gap-y-5", grupos.length > 1 && "md:grid-cols-2")}>
            {grupos.map((g) => (
              <div key={g.valor}>
                <p className="mb-2 text-sm font-semibold">
                  {g.emoji ? <span aria-hidden className="mr-1.5">{g.emoji}</span> : null}
                  {g.titulo}
                </p>
                <ul className="grid gap-0.5">
                  {g.habitos.map((h) => {
                    const registro = indice.get(h.id)?.get(hoje)
                    const feito = Boolean(registro)
                    const seq = sequencia(h, indice.get(h.id), hoje)
                    return (
                      <li key={h.id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={feito}
                          onClick={() => alternar.mutate({ habito: h.id, dia: hoje, registro })}
                          className="flex w-full items-center gap-3 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-surface-2 toque:py-3"
                        >
                          <span
                            className={cn(
                              "grid size-5 shrink-0 place-items-center rounded-[5px] border transition-colors",
                              feito ? "border-rotina bg-rotina text-white" : "border-line-strong",
                            )}
                          >
                            {feito ? <Check className="size-3.5" strokeWidth={3} /> : null}
                          </span>
                          <span className={cn("flex-1", feito && "text-ink-3 line-through decoration-ink-3/50")}>{h.name}</span>
                          {seq >= 2 ? (
                            <span className="inline-flex items-center gap-0.5 text-xs text-ink-3" title={`${seq} dias seguidos`}>
                              <Flame className="size-3.5 text-estudos" />
                              {seq}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </Secao>
  )
}

/* ------------------------------------------------------------------ */
/* Tarefas do dia                                                      */
/* ------------------------------------------------------------------ */

type Tarefa = Tables<"tasks">

export function TarefasHoje() {
  const hoje = isoDia()
  const { data: tarefas = [], isLoading } = useLista("tasks", { ordem: [{ coluna: "position" }] })
  const { data: projetos = [] } = useLista("projects", { colunas: "id,name,parent_id,archived,done", ordem: [{ coluna: "name" }] })
  const criar = useCriar("tasks")
  const [nova, setNova] = React.useState("")
  const [aberta, setAberta] = React.useState<Tarefa | null>(null)

  const nomes = React.useMemo(() => new Map(projetos.map((p) => [p.id, p.name])), [projetos])

  const doDia = tarefas
    .filter((t) => t.status !== "done" && t.due_date && t.due_date <= hoje)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : a.due_date! > b.due_date! ? 1 : (a.due_time ?? "99").localeCompare(b.due_time ?? "99")))
  const concluidasHoje = tarefas.filter((t) => t.status === "done" && t.done_at && isoDia(new Date(t.done_at)) === hoje)
  const semData = tarefas.filter((t) => t.status === "doing" && !t.due_date)

  const adicionar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nova.trim()) return
    criar.mutate({ id: novoId(), title: nova.trim(), due_date: hoje, position: Date.now() })
    setNova("")
  }

  return (
    <Secao
      titulo="Para hoje"
      descricao={doDia.length ? undefined : undefined}
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
  const limite = somarDias(hoje, 8)
  const { data: eventos = [], isLoading } = useLista("events", { ordem: [{ coluna: "starts_at" }] })

  const proximos = eventos.filter((e) => {
    const dia = isoDia(new Date(e.starts_at))
    const fim = e.ends_at ? isoDia(new Date(e.ends_at)) : dia
    return fim >= hoje && dia < limite
  })

  const porDia = new Map<string, typeof proximos>()
  for (const e of proximos) {
    const dia = isoDia(new Date(e.starts_at)) < hoje ? hoje : isoDia(new Date(e.starts_at))
    porDia.set(dia, [...(porDia.get(dia) ?? []), e])
  }

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
/* Resumos: metas, leitura, projetos                                   */
/* ------------------------------------------------------------------ */

function MetasAno() {
  const ano = new Date().getFullYear()
  const { data: metas = [] } = useLista("goals", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  const doAno = metas.filter((m) => !m.done && (m.year === ano || m.year === null)).slice(0, 5)
  return (
    <Secao titulo={`Metas de ${ano}`} acao={<Link href="/rotina/metas" className="text-sm text-ink-2 hover:text-ink toque:-my-3 toque:py-3">Ver metas</Link>}>
      {doAno.length === 0 ? (
        <p className="text-sm text-ink-2">Nenhuma meta para este ano.</p>
      ) : (
        <ul className="grid gap-3.5">
          {doAno.map((m) => {
            const p = porcentagem(Number(m.progress), Number(m.target))
            return (
              <li key={m.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{m.name}</span>
                  <span className="tabular shrink-0 text-ink-3">{m.target ? `${p}%` : ""}</span>
                </div>
                <Progresso valor={p} cor="rotina" rotulo={`Progresso de ${m.name}`} />
              </li>
            )
          })}
        </ul>
      )}
    </Secao>
  )
}

function LendoAgora() {
  const { data: livros = [] } = useLista("books", { ordem: [{ coluna: "updated_at", asc: false }] })
  const lendo = livros.filter((l) => l.status === "lendo").slice(0, 3)
  return (
    <Secao titulo="Lendo agora" acao={<Link href="/estudos/leitura" className="text-sm text-ink-2 hover:text-ink toque:-my-3 toque:py-3">Estante</Link>}>
      {lendo.length === 0 ? (
        <p className="text-sm text-ink-2">Nenhum livro em leitura.</p>
      ) : (
        <ul className="grid gap-3.5">
          {lendo.map((l) => {
            const p = porcentagem(l.pages_read, l.pages_total)
            return (
              <li key={l.id}>
                <Link href={`/estudos/leitura/${l.id}`} className="block text-sm hover:underline">
                  <span className="font-medium">{l.title}</span>
                  {l.author ? <span className="text-ink-3"> de {l.author}</span> : null}
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <Progresso valor={p} cor="estudos" rotulo={`Leitura de ${l.title}`} />
                  <span className="tabular shrink-0 text-xs text-ink-3">{l.pages_total ? `${p}%` : `${l.pages_read} p.`}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Secao>
  )
}

function ProjetosAndamento() {
  const { data: projetos = [] } = useLista("projects", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  const { data: capturas = [] } = useLista("captures", { colunas: "id,area_id,archived,kind" })
  const { data: vinculos = [] } = useLista("capture_projects", { colunas: "capture_id,project_id" })

  const filhos = new Map<string, { total: number; feitos: number }>()
  for (const p of projetos) {
    if (!p.parent_id) continue
    const f = filhos.get(p.parent_id) ?? { total: 0, feitos: 0 }
    f.total++
    if (p.done) f.feitos++
    filhos.set(p.parent_id, f)
  }
  const ativos = projetos.filter((p) => !p.parent_id && !p.archived && !p.done).slice(0, 5)

  const comProjeto = new Set(vinculos.map((v) => v.capture_id))
  const caixa = capturas.filter((c) => !c.archived && !c.area_id && !c.kind && !comProjeto.has(c.id)).length

  return (
    <Secao titulo="Projetos em andamento" acao={<Link href="/projetos" className="text-sm text-ink-2 hover:text-ink toque:-my-3 toque:py-3">Projetos</Link>}>
      {ativos.length === 0 ? (
        <p className="text-sm text-ink-2">Nenhum projeto ativo.</p>
      ) : (
        <ul className="grid gap-3.5">
          {ativos.map((p) => {
            const f = filhos.get(p.id)
            const pct = f ? porcentagem(f.feitos, f.total) : 0
            return (
              <li key={p.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <Link href={`/projetos/${p.id}`} className="truncate hover:underline">
                    {p.name}
                  </Link>
                  <span className="tabular shrink-0 text-xs text-ink-3">{f ? `${f.feitos}/${f.total}` : ""}</span>
                </div>
                <Progresso valor={pct} cor="projetos" rotulo={`Progresso de ${p.name}`} />
              </li>
            )
          })}
        </ul>
      )}
      {caixa > 0 ? (
        <Link href="/projetos/entrada" className="mt-5 flex items-center gap-2 text-sm text-ink-2 hover:text-ink">
          <Etiqueta cor="projetos">{caixa}</Etiqueta>
          {caixa === 1 ? "captura esperando organização" : "capturas esperando organização"}
        </Link>
      ) : null}
    </Secao>
  )
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export function Hoje() {
  return (
    <div>
      <Capa />
      <CabecalhoDia />
      <HabitosHoje />
      <div className="mb-12 grid gap-10 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <TarefasHoje />
        <AgendaProxima />
      </div>
      {/* O dia vem antes: os atalhos repetem o menu e ficam depois do que é para fazer hoje */}
      <MenuAtalhos />
      <div className="grid gap-10 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-3">
        <MetasAno />
        <LendoAgora />
        <ProjetosAndamento />
      </div>
    </div>
  )
}
