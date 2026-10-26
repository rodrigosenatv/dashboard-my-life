"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import dynamic from "next/dynamic"
import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { BookOpen, CalendarDays, Check, CornerDownLeft, Flame, FolderKanban, Inbox, LayoutGrid, ListTodo, Plus, Sun, Target, type LucideIcon } from "lucide-react"
import { TemaDasJanelas } from "@/components/ui/tema-janelas"
import { novoId, useCriar, useLista } from "@/lib/data"
import { cn, dataRelativa, isoDia, plural, porcentagem, saudacao, somarDias } from "@/lib/utils"
import type { Tables } from "@/lib/supabase/database.types"
import { agruparPorRitual, indexar, sequencia, useAlternarHabito, useHabitos, useRegistros, useRituais, valeNoDia } from "@/features/habitos/dados"
import { ItemTarefa } from "@/features/tarefas/item-tarefa"
import { DialogoTarefa } from "@/features/tarefas/dialogo-tarefa"
import { useConfiguracoes, useNomeExibicao } from "@/features/configuracoes/dados"
import { useUrlArquivo } from "@/lib/arquivos"
import { COLUNAS_LIVRO_LISTA } from "@/features/leitura/dados"
import { CapaLivro } from "@/features/leitura/capa"
import { progresso, useProjetos, useProjetosPorNome } from "@/features/projetos/dados"
import { AnelProgresso, ChipPrazo, textoEtapas } from "@/features/segundo-cerebro/ui"
import { FRASE_PADRAO } from "@/lib/marca"
import { MenuAtalhos } from "./painel"
import { agendaPorDia, capturasNaCaixa, eventosComHora, faixaDoDia, posicaoNaFaixa, posicaoNoFim, situacaoDaAgenda, tarefasDoDia, textoEspera } from "./logica"

type Tarefa = Tables<"tasks">
type Evento = Tables<"events">

// A janela de compromisso só é baixada quando vai abrir (o ponteiro sobre "Agendar" ou um compromisso já antecipa)
const carregarDialogoEvento = () => import("@/features/agenda/dialogo-evento").then((m) => m.DialogoEvento)
const DialogoEvento = dynamic(carregarDialogoEvento, { ssr: false })

const VERDES: [string, string, string] = ["#1fae7e", "#3ccb92", "#7cf5c4"]

/** A cor de cada tipo de compromisso, na agenda e na linha do dia. */
function corDoEvento(categoria: string | null): string {
  if (categoria === "Reunião") return "var(--b-violeta)"
  if (categoria === "Aniversário") return "var(--b-rosa)"
  if (categoria === "Viagem") return "var(--b-ambar)"
  return "var(--b-luz)"
}

/** A hora de agora, atualizada a cada meio minuto (o relógio da capa e o "agora" da linha do dia). */
function useAgora(): Date {
  const [agora, setAgora] = React.useState(() => new Date())
  React.useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  return agora
}

/** O título de um painel: rótulo de HUD com o ícone aceso na cor da área e uma ação à direita. */
function CabecalhoPainel({ id, icone: Icone, titulo, cor = "var(--b-luz)", extra, acao }: { id: string; icone: LucideIcon; titulo: string; cor?: string; extra?: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="mb-4 flex min-h-8 items-center justify-between gap-3">
      <h2 id={id} className="rotulo-hud flex min-w-0 items-center gap-2">
        <Icone className="size-3.5 shrink-0" style={{ color: cor }} aria-hidden />
        <span className="truncate">{titulo}</span>
        {extra}
      </h2>
      {acao}
    </div>
  )
}

const LINK_PAINEL = "inline-flex min-h-9 shrink-0 items-center rounded-full px-2.5 text-sm text-ink-2 transition-colors hover:bg-white/[0.06] hover:text-ink toque:min-h-11"

/* ------------------------------------------------------------------ */
/* A capa do dia                                                       */
/* ------------------------------------------------------------------ */

type Chip = { href: string; n: number | string; rotulo: string; cor?: string }

function CapaDoDia({ agora, eventos, chips }: { agora: Date; eventos: Evento[]; chips: Chip[] }) {
  const nome = useNomeExibicao()
  const { data: cfg } = useConfiguracoes()
  const prefs = (cfg?.prefs ?? {}) as { frase?: string; capa?: string }
  const frase = prefs.frase?.trim() || FRASE_PADRAO
  const { data: urlCapa } = useUrlArquivo(prefs.capa || null)
  const criar = useCriar("captures", { aviso: "Guardado na Caixa de Entrada" })
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

  return (
    // A capa é um contêiner: a frase só vai para o lado da data quando a própria capa tem largura para os dois
    <header className="capa-hoje @container p-5 sm:p-7">
      {urlCapa ? (
        <>
          {/* A imagem escolhida em Configurações vira o fundo; o véu escuro garante a leitura mesmo sobre uma foto clara */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urlCapa} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-70" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[#03141a] via-[#03141a]/85 via-60% to-[#03141a]/45" />
        </>
      ) : null}

      <p className="rotulo-hud flex items-center gap-2">
        <Sun className="size-3.5 text-[var(--b-ambar)]" aria-hidden />
        Hoje
        <span aria-hidden>·</span>
        <span className="tabular tracking-[0.12em] text-[var(--b-luz)]" aria-label={`Agora são ${format(agora, "HH:mm")}`}>
          {format(agora, "HH:mm")}
        </span>
      </p>

      <div className="mt-3 grid gap-x-10 gap-y-4 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] @3xl:items-end">
        <div className="flex items-end gap-4 sm:gap-5">
          <span className="numero-dia text-[4.5rem] sm:text-[5.75rem]" aria-hidden>
            {format(agora, "dd")}
          </span>
          <div className="min-w-0 pb-1">
            <h1 className="font-display text-2xl font-semibold leading-tight first-letter:uppercase sm:text-[1.75rem]">{format(agora, "EEEE", { locale: ptBR })}</h1>
            <p className="text-ink-2">{format(agora, "MMMM 'de' yyyy", { locale: ptBR })}</p>
            <p className="mt-1.5">
              {saudacao(agora)}
              {nome ? `, ${nome}` : ""}.
            </p>
          </div>
        </div>
        {/* A frase da capa, escrita à mão */}
        <p className="frase-luz font-assinatura text-balance text-[2rem] leading-[1.1] @lg:text-[2.25rem] @3xl:pb-1 @3xl:text-right @3xl:text-[2.4rem]">{frase}</p>
      </div>

      <LinhaDoDia agora={agora} eventos={eventos} className="mt-6" />

      <form onSubmit={capturar} className="relative mt-5">
        <label htmlFor="captura-rapida" className="sr-only">
          Captura rápida
        </label>
        <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg leading-none text-[var(--b-luz)]">
          ›
        </span>
        <input
          id="captura-rapida"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Capturar ideia, link ou lembrete…"
          className="h-12 w-full rounded-2xl border border-[var(--b-borda-2)] bg-black/30 pl-9 pr-11 text-base text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] focus-visible:border-[var(--b-luz)] focus-visible:shadow-[0_0_0_3px_rgb(99_227_255/0.15),0_0_24px_-6px_rgb(99_227_255/0.6)] focus-visible:outline-none"
        />
        <CornerDownLeft aria-hidden className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
      </form>

      {chips.length ? (
        // No celular as pílulas ficam numa linha que rola para o lado; no computador, quebram linha
        <ul aria-label="Resumo do dia" className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {chips.map((c) => (
            <li key={c.rotulo} className="shrink-0">
              <Link href={c.href} className="inline-flex min-h-9 items-baseline gap-1.5 rounded-full border border-[var(--b-borda)] bg-white/[0.04] px-3 py-1 text-sm text-ink-2 transition-colors hover:border-[var(--b-borda-2)] hover:text-ink toque:min-h-10">
                <span className="tabular font-display text-base font-semibold" style={c.cor ? { color: c.cor } : undefined}>
                  {c.n}
                </span>
                {c.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  )
}

/** A linha do dia: das 6h à meia-noite, com o que já passou em luz, o agora pulsando e os compromissos marcados. */
function LinhaDoDia({ agora, eventos, className }: { agora: Date; eventos: Evento[]; className?: string }) {
  const hoje = isoDia(agora)
  const doDia = eventosComHora(eventos, hoje)
  const faixa = faixaDoDia(agora, doDia.map((e) => new Date(e.starts_at)))
  const pAgora = posicaoNaFaixa(agora, faixa)
  const sit = situacaoDaAgenda(doDia, agora)
  const marcas: number[] = []
  for (let h = faixa.inicio; h <= faixa.fim; h += 3) marcas.push(h)
  const hora = (iso: string | Date) => format(new Date(iso), "HH:mm")

  const situacao =
    sit.tipo === "agora" ? (
      <>
        <span className="font-medium text-[var(--b-luz)]">Agora:</span> {sit.evento.title} <span className="text-ink-3">· até {hora(sit.ate)}</span>
      </>
    ) : sit.tipo === "proximo" ? (
      <>
        <span className="font-medium text-[var(--b-luz)]">Próximo:</span> <span className="tabular">{hora(sit.evento.starts_at)}</span> {sit.evento.title}{" "}
        <span className="text-ink-3">· {textoEspera(sit.minutos)}</span>
      </>
    ) : sit.tipo === "fim" ? (
      <span className="text-ink-2">A agenda de hoje já passou. Resto do dia livre.</span>
    ) : (
      <span className="text-ink-2">Dia livre na agenda.</span>
    )

  return (
    <div className={className}>
      <div className="relative h-6" role="img" aria-label={`Linha do dia: agora são ${hora(agora)}.${doDia.length ? ` Compromissos: ${doDia.map((e) => `${hora(e.starts_at)} ${e.title}`).join("; ")}.` : ""}`}>
        <span className="linha-dia-trilho" />
        <span className="linha-dia-feito" style={{ width: `${pAgora}%` }} />
        {doDia.map((e) => (
          <span
            key={e.id}
            className="linha-dia-marco"
            data-passou={new Date(e.ends_at ?? e.starts_at) < agora ? "" : undefined}
            style={{ left: `${posicaoNaFaixa(new Date(e.starts_at), faixa)}%`, "--cor": corDoEvento(e.category) } as React.CSSProperties}
            title={`${hora(e.starts_at)} ${e.title}`}
          />
        ))}
        <span className="absolute top-1/2" style={{ left: `${pAgora}%` }} aria-hidden>
          <span className="absolute -left-2 -top-2 size-4 animate-ping rounded-full bg-[var(--b-luz)] opacity-40 motion-reduce:hidden" />
          <span className="absolute -left-1.5 -top-1.5 size-3 rounded-full bg-white shadow-[0_0_10px_3px_rgb(99_227_255/0.75)]" />
        </span>
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-ink-3" aria-hidden>
        {marcas.map((h, i) => (
          <span
            key={h}
            className={cn("tabular absolute", i === 0 ? "translate-x-0" : i === marcas.length - 1 ? "-translate-x-full" : "-translate-x-1/2")}
            style={{ left: `${((h - faixa.inicio) / (faixa.fim - faixa.inicio)) * 100}%` }}
          >
            {h}h
          </span>
        ))}
      </div>
      <p className="mt-2 flex min-w-0 items-center gap-2 text-sm">
        <CalendarDays className="size-4 shrink-0 text-ink-3" aria-hidden />
        <span className="min-w-0 truncate">{situacao}</span>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Rituais                                                             */
/* ------------------------------------------------------------------ */

function PainelRituais({ hoje }: { hoje: string }) {
  const { data: habitos = [], isLoading } = useHabitos()
  const { data: registros = [] } = useRegistros(somarDias(hoje, -400))
  const alternar = useAlternarHabito()
  const { ritualDe } = useRituais()
  const indice = React.useMemo(() => indexar(registros), [registros])
  const doDia = habitos.filter((h) => h.active && valeNoDia(h, hoje))
  const feitos = doDia.filter((h) => indice.get(h.id)?.has(hoje)).length
  const grupos = agruparPorRitual(doDia, ritualDe)
  const pct = porcentagem(feitos, doDia.length)
  const completo = doDia.length > 0 && feitos === doDia.length

  return (
    <section id="rituais" aria-labelledby="titulo-rituais" className="vidro scroll-mt-20 p-4 sm:p-6">
      <CabecalhoPainel
        id="titulo-rituais"
        icone={Sun}
        titulo="Rituais de hoje"
        cor="var(--b-verde)"
        acao={
          <Link href="/rotina/habitos" className={LINK_PAINEL}>
            Ver hábitos
          </Link>
        }
      />
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" />
      ) : doDia.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--b-borda-2)] px-4 py-6 text-sm">
          <p className="font-medium">Nenhum hábito para hoje.</p>
          <p className="mt-1 text-ink-2">Cadastre os hábitos que quer acompanhar e marque-os aqui todos os dias.</p>
          <Link href="/rotina/habitos" className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--b-borda-2)] px-3.5 text-sm font-medium hover:border-[var(--b-verde)]">
            <Plus className="size-4" aria-hidden /> Cadastrar hábitos
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)] md:items-start md:gap-8">
          <div className="flex items-center gap-4 md:flex-col md:gap-3 md:pt-1 md:text-center">
            <AnelProgresso pct={pct} tamanho={104} legenda="feito" cores={VERDES} />
            <p className="text-sm text-ink-2">
              {completo ? (
                <span className="inline-flex items-center gap-1 font-medium text-[var(--b-menta)]">
                  <Check className="size-4" aria-hidden /> Tudo feito hoje
                </span>
              ) : (
                <>
                  <span className="tabular font-semibold text-ink">{feitos}</span> de <span className="tabular">{doDia.length}</span> feitos
                </>
              )}
            </p>
          </div>
          <div className={cn("grid gap-x-8 gap-y-5", grupos.length > 1 && "lg:grid-cols-2")}>
            {grupos.map((g) => {
              const feitosGrupo = g.habitos.filter((h) => indice.get(h.id)?.has(hoje)).length
              return (
                <div key={g.valor}>
                  <p className="rotulo-hud mb-1.5 flex items-center gap-2">
                    {g.emoji ? <span aria-hidden className="text-sm tracking-normal">{g.emoji}</span> : null}
                    {g.titulo}
                    <span className="tabular ml-auto text-ink-3">
                      {feitosGrupo}/{g.habitos.length}
                    </span>
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
                            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors hover:bg-white/[0.05] toque:py-3"
                          >
                            <span className="caixa-ritual" data-feito={feito ? "" : undefined}>
                              {feito ? <Check className="size-3.5 animate-marcar" strokeWidth={3} /> : null}
                            </span>
                            <span className={cn("min-w-0 flex-1", feito && "text-ink-3 line-through decoration-ink-3/50")}>{h.name}</span>
                            {seq >= 2 ? (
                              <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-ink-2" title={`${seq} dias seguidos`}>
                                <Flame className="size-3.5 text-[var(--b-ambar)] drop-shadow-[0_0_4px_rgb(245_197_74/0.6)]" aria-hidden />
                                <span className="tabular">{seq}</span>
                              </span>
                            ) : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Tarefas e agenda                                                    */
/* ------------------------------------------------------------------ */

function PainelTarefas({ hoje, tarefas, carregando }: { hoje: string; tarefas: Tarefa[]; carregando: boolean }) {
  const { data: projetos = [] } = useProjetosPorNome()
  const criar = useCriar("tasks")
  const [nova, setNova] = React.useState("")
  const [aberta, setAberta] = React.useState<Tarefa | null>(null)
  const nomes = React.useMemo(() => new Map(projetos.map((p) => [p.id, p.name])), [projetos])
  const { pendentes, atrasadas, semData, concluidasHoje } = tarefasDoDia(tarefas, hoje)
  const lista = [...pendentes, ...semData]

  const adicionar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nova.trim()) return
    criar.mutate({ id: novoId(), title: nova.trim(), due_date: hoje, position: posicaoNoFim() })
    setNova("")
  }

  return (
    <section id="tarefas" aria-labelledby="titulo-tarefas" className="vidro min-w-0 scroll-mt-20 p-4 sm:p-5">
      <CabecalhoPainel
        id="titulo-tarefas"
        icone={ListTodo}
        titulo="Para hoje"
        cor="var(--b-verde)"
        extra={
          lista.length ? (
            <span className="tabular rounded-full border border-[var(--b-borda)] bg-white/[0.04] px-2 py-0.5 text-[11px] tracking-normal text-ink-2">{lista.length}</span>
          ) : null
        }
        acao={
          <Link href="/rotina/tarefas" className={LINK_PAINEL}>
            Todas as tarefas
          </Link>
        }
      />
      {carregando ? (
        <div className="grid gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      ) : (
        <>
          {atrasadas ? <p className="-mt-2 mb-2 text-xs font-medium text-danger">{plural(atrasadas, "tarefa atrasada", "tarefas atrasadas")}</p> : null}
          {lista.length === 0 ? (
            <p className="py-1 text-ink-2">{concluidasHoje.length ? "Tudo feito por hoje. Bom trabalho." : "Nada pendente para hoje."}</p>
          ) : (
            <ul className="grid">
              {lista.map((t) => (
                <ItemTarefa key={t.id} tarefa={t} projeto={t.project_id ? nomes.get(t.project_id) : null} aoAbrir={setAberta} />
              ))}
            </ul>
          )}
          <form onSubmit={adicionar} className="mt-3 flex min-h-11 items-center gap-3 rounded-full border border-dashed border-[var(--b-borda-2)] bg-black/15 px-3.5 focus-within:border-[var(--b-luz)]">
            <Plus className="size-4 shrink-0 text-[var(--b-luz)]" aria-hidden />
            <input
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              placeholder="Adicionar tarefa para hoje"
              aria-label="Adicionar tarefa para hoje"
              className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3 sm:text-sm"
            />
          </form>
          {concluidasHoje.length ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink-3">
              <Check className="size-4 text-[var(--b-verde)]" aria-hidden />
              {plural(concluidasHoje.length, "tarefa concluída", "tarefas concluídas")} hoje
            </p>
          ) : null}
        </>
      )}
      <DialogoTarefa aberta={Boolean(aberta)} aoMudar={(v) => !v && setAberta(null)} tarefa={aberta} />
    </section>
  )
}

function PainelAgenda({ hoje, agora, eventos, carregando }: { hoje: string; agora: Date; eventos: Evento[]; carregando: boolean }) {
  const dias = agendaPorDia(eventos, hoje)
  // Agendar e abrir um compromisso acontecem aqui mesmo, numa janela com o tema da ponte (sem sair do dia)
  const [janela, setJanela] = React.useState<{ evento: Evento | null } | null>(null)
  return (
    <section id="agenda" aria-labelledby="titulo-agenda" className="vidro min-w-0 scroll-mt-20 p-4 sm:p-5">
      <CabecalhoPainel
        id="titulo-agenda"
        icone={CalendarDays}
        titulo="Agenda"
        acao={
          <button type="button" onClick={() => setJanela({ evento: null })} onPointerEnter={() => void carregarDialogoEvento().catch(() => {})} className={cn(LINK_PAINEL, "gap-1")}>
            <Plus className="size-4" aria-hidden /> Agendar
          </button>
        }
      />
      {carregando ? (
        <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
      ) : dias.length === 0 ? (
        <p className="py-1 text-ink-2">Nenhum compromisso nos próximos 7 dias.</p>
      ) : (
        <ol className="grid gap-4">
          {dias.map(([dia, lista]) => (
            <li key={dia}>
              <p className="rotulo-hud mb-1.5">{dataRelativa(dia)}</p>
              <ul className="grid border-l border-[var(--b-borda-2)] pl-1.5">
                {lista.map((e) => {
                  const fim = e.ends_at ? new Date(e.ends_at) : new Date(new Date(e.starts_at).getTime() + 60 * 60 * 1000)
                  const passou = !e.all_day && fim < agora
                  return (
                    <li key={e.id} className={cn(passou && "opacity-45")}>
                      <button
                        type="button"
                        onClick={() => setJanela({ evento: e })}
                        onPointerEnter={() => void carregarDialogoEvento().catch(() => {})}
                        className="group flex min-h-8 w-full min-w-0 items-center gap-2.5 rounded-lg px-1.5 text-left text-sm transition-colors hover:bg-white/[0.05] toque:min-h-10"
                      >
                        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: corDoEvento(e.category), boxShadow: `0 0 8px ${corDoEvento(e.category)}` }} />
                        <span className="tabular w-11 shrink-0 text-ink-3">{e.all_day ? "dia" : format(new Date(e.starts_at), "HH:mm")}</span>
                        <span className="min-w-0 truncate transition-colors group-hover:text-[var(--b-luz)]">{e.title}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {janela ? <DialogoEvento aberta aoMudar={(v) => !v && setJanela(null)} evento={janela.evento} /> : null}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Resumos: metas, leitura, projetos                                   */
/* ------------------------------------------------------------------ */

function PainelMetas() {
  const ano = new Date().getFullYear()
  const { data: metas = [] } = useLista("goals", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  const doAno = metas.filter((m) => !m.done && (m.year === ano || m.year === null)).slice(0, 5)
  return (
    <section aria-labelledby="titulo-metas" className="vidro min-w-0 p-4 sm:p-5">
      <CabecalhoPainel
        id="titulo-metas"
        icone={Target}
        titulo={`Metas de ${ano}`}
        cor="var(--b-verde)"
        acao={
          <Link href="/rotina/metas" className={LINK_PAINEL}>
            Ver metas
          </Link>
        }
      />
      {doAno.length === 0 ? (
        <p className="text-sm text-ink-2">Nenhuma meta para este ano.</p>
      ) : (
        <ul className="grid gap-4">
          {doAno.map((m) => {
            const p = porcentagem(Number(m.progress), Number(m.target))
            const unidade = m.unit && m.unit !== "R$" ? ` ${m.unit}` : ""
            const valor = (n: number) => (m.unit === "R$" ? `R$ ${n.toLocaleString("pt-BR")}` : n.toLocaleString("pt-BR"))
            return (
              <li key={m.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{m.name}</span>
                  <span className="tabular shrink-0 text-xs text-ink-3">{m.target ? `${p}%` : ""}</span>
                </div>
                <div className="barra-luz" data-cor="rotina" role="progressbar" aria-label={`Progresso de ${m.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p}>
                  <span style={{ width: `${p}%` }} />
                </div>
                {m.target ? (
                  <p className="tabular mt-1 text-xs text-ink-3">
                    {valor(Number(m.progress))} de {valor(Number(m.target))}
                    {unidade}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function PainelLeitura() {
  const { data: livros = [] } = useLista("books", { colunas: COLUNAS_LIVRO_LISTA, ordem: [{ coluna: "updated_at", asc: false }] })
  const lendo = livros.filter((l) => l.status === "lendo").slice(0, 3)
  return (
    <section aria-labelledby="titulo-leitura" className="vidro min-w-0 p-4 sm:p-5">
      <CabecalhoPainel
        id="titulo-leitura"
        icone={BookOpen}
        titulo="Lendo agora"
        cor="var(--b-ambar)"
        acao={
          <Link href="/estudos/leitura" className={LINK_PAINEL}>
            Estante
          </Link>
        }
      />
      {lendo.length === 0 ? (
        <p className="text-sm text-ink-2">Nenhum livro em leitura.</p>
      ) : (
        <ul className="grid gap-3.5">
          {lendo.map((l) => {
            const p = porcentagem(l.pages_read, l.pages_total)
            return (
              <li key={l.id}>
                <Link href={`/estudos/leitura/${l.id}`} className="group flex items-center gap-3">
                  <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded-[3px_6px_6px_3px] shadow-[0_6px_14px_-6px_rgb(0_0_0/0.8)]">
                    <CapaLivro livro={l} className="size-full" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium transition-colors group-hover:text-[var(--b-ambar)]">{l.title}</span>
                    {l.author ? <span className="block truncate text-xs text-ink-3">{l.author}</span> : null}
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="barra-luz flex-1" data-cor="estudos" role="progressbar" aria-label={`Leitura de ${l.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p}>
                        <span style={{ width: `${p}%` }} />
                      </span>
                      <span className="tabular shrink-0 text-xs text-ink-3">{l.pages_total ? `${p}%` : `${l.pages_read} p.`}</span>
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function PainelProjetos({ caixa }: { caixa: number }) {
  const { data: projetos = [] } = useProjetos()
  const ativos = projetos.filter((p) => !p.parent_id && !p.archived && !p.done).slice(0, 5)
  return (
    <section aria-labelledby="titulo-projetos" className="vidro min-w-0 p-4 sm:p-5">
      <CabecalhoPainel
        id="titulo-projetos"
        icone={FolderKanban}
        titulo="Projetos em andamento"
        cor="var(--b-violeta)"
        acao={
          <Link href="/projetos" className={LINK_PAINEL}>
            Projetos
          </Link>
        }
      />
      {ativos.length === 0 ? (
        <p className="text-sm text-ink-2">Nenhum projeto ativo.</p>
      ) : (
        <ul className="grid gap-3">
          {ativos.map((p) => {
            const pr = progresso(p.id, projetos)
            const pct = porcentagem(pr.feitos, pr.total)
            return (
              <li key={p.id}>
                <Link href={`/projetos/${p.id}`} className="group flex items-center gap-3">
                  <AnelProgresso pct={pct} tamanho={40} espessura={3} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium transition-colors group-hover:text-[var(--b-violeta)]">{p.name}</span>
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                      {textoEtapas(pr.feitos, pr.total)}
                      <ChipPrazo prazo={p.deadline} className="-ml-1 py-0" />
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {caixa > 0 ? (
        <Link href="/projetos/entrada" className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--b-borda)] bg-white/[0.03] px-3 py-2.5 text-sm text-ink-2 transition-colors hover:border-[var(--b-violeta)] hover:text-ink">
          <Inbox className="size-4 shrink-0 text-[var(--b-violeta)]" aria-hidden />
          <span className="tabular font-semibold text-ink">{caixa}</span>
          {caixa === 1 ? "captura esperando organização" : "capturas esperando organização"}
        </Link>
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* A página                                                            */
/* ------------------------------------------------------------------ */

/**
 * Hoje: a ponte de comando do dia. A capa (data, frase, linha do dia, captura rápida e o resumo do dia),
 * os rituais, as tarefas e a agenda, os atalhos e os resumos de metas, leitura e projetos.
 */
export function PonteDoDia() {
  const agora = useAgora()
  const hoje = isoDia(agora)
  const { data: tarefas = [], isLoading: carregandoTarefas } = useLista("tasks", { ordem: [{ coluna: "position" }] })
  const { data: eventos = [], isLoading: carregandoEventos } = useLista("events", { ordem: [{ coluna: "starts_at" }] })
  const { data: habitos = [] } = useHabitos()
  const { data: registros = [] } = useRegistros(somarDias(hoje, -400))
  const { data: capturas = [] } = useLista("captures", { colunas: "id,area_id,archived,kind" })
  const { data: vinculos = [] } = useLista("capture_projects", { colunas: "capture_id,project_id" })

  const doDia = habitos.filter((h) => h.active && valeNoDia(h, hoje))
  const feitos = doDia.filter((h) => registros.some((r) => r.habit_id === h.id && r.day === hoje)).length
  const { pendentes, atrasadas, semData } = tarefasDoDia(tarefas, hoje)
  const compromissos = agendaPorDia(eventos, hoje).find(([d]) => d === hoje)?.[1].length ?? 0
  const caixa = capturasNaCaixa(capturas, new Set(vinculos.map((v) => v.capture_id)))
  const paraHoje = pendentes.length + semData.length

  const chips: Chip[] = [
    ...(doDia.length ? [{ href: "#rituais", n: `${feitos}/${doDia.length}`, rotulo: "rituais", cor: "var(--b-verde)" }] : []),
    { href: "#tarefas", n: paraHoje, rotulo: paraHoje === 1 ? "tarefa para hoje" : "tarefas para hoje", cor: "var(--b-luz)" },
    ...(atrasadas ? [{ href: "#tarefas", n: atrasadas, rotulo: atrasadas === 1 ? "atrasada" : "atrasadas", cor: "var(--b-rosa)" }] : []),
    ...(compromissos ? [{ href: "#agenda", n: compromissos, rotulo: compromissos === 1 ? "compromisso hoje" : "compromissos hoje", cor: "var(--b-ambar)" }] : []),
    ...(caixa ? [{ href: "/projetos/entrada", n: caixa, rotulo: "na caixa de entrada", cor: "var(--b-violeta)" }] : []),
  ]

  return (
    <TemaDasJanelas classe="tema-hoje">
      <div className="tema-hoje ponte -mx-4 -mb-28 -mt-5 min-h-[calc(100dvh-7rem)] px-4 pb-32 pt-5 sm:mx-0 sm:mb-0 sm:mt-0 sm:min-h-0 sm:rounded-[1.75rem] sm:px-6 sm:pb-10 sm:pt-6 lg:px-8">
        <CapaDoDia agora={agora} eventos={eventos} chips={carregandoTarefas ? [] : chips} />

        <div className="mt-6 grid gap-5">
          <PainelRituais hoje={hoje} />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
            <PainelTarefas hoje={hoje} tarefas={tarefas} carregando={carregandoTarefas} />
            <PainelAgenda hoje={hoje} agora={agora} eventos={eventos} carregando={carregandoEventos} />
          </div>

          {/* O dia vem antes: os atalhos repetem o menu e ficam depois do que é para fazer hoje */}
          <section aria-labelledby="titulo-atalhos" className="pt-2">
            <CabecalhoPainel id="titulo-atalhos" icone={LayoutGrid} titulo="Atalhos" />
            <MenuAtalhos />
          </section>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <PainelMetas />
            <PainelLeitura />
            <div className="sm:col-span-2 xl:col-span-1">
              <PainelProjetos caixa={caixa} />
            </div>
          </div>
        </div>
      </div>
    </TemaDasJanelas>
  )
}
