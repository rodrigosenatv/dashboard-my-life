"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import * as React from "react"
import { useAbrirDoEndereco } from "@/lib/abrir-do-endereco"
import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import {
  ArrowRight,
  CalendarClock,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clapperboard,
  Compass,
  ExternalLink,
  Eye,
  FileText,
  Flame,
  GalleryHorizontal,
  Heart,
  Image as IconeImagem,
  Lightbulb,
  Link2,
  PenLine,
  Plus,
  Radio,
  Scissors,
  Search,
  Tags,
  TrendingUp,
  Type,
  Video,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Carregando, Segmentos } from "@/components/ui/basicos"
import { ACAO_ACESA } from "@/components/ui/cabecalho-hud"
import { VazioCerebro } from "@/features/segundo-cerebro/ui"
import { CabecalhoEstudio, LINK_PAINEL, MolduraEstudio, TituloPainel } from "@/features/conteudo/moldura"
import { desempenho, engajamento, prazoDoConteudo, resumoDoPlanner, ETAPAS_PRODUCAO } from "@/features/conteudo/logica"
import { novoId, useAtualizar, useCriar, useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { STATUS_CONTEUDO, type StatusConteudo } from "@/lib/rotulos"
import { cn, contem, dataRelativa, isoDia, numero, normalizar, plural, urlValida } from "@/lib/utils"
import { useArvorePaginas } from "@/features/paginas/dados"
import { DialogoConteudo } from "./dialogo-conteudo"

type Conteudo = Tables<"content_items">
type Visao = "ideias" | "quadro" | "calendario" | "desempenho"

/** Páginas do Planner que no Notion ficam em "Ferramentas". */
const FERRAMENTAS = ["viral canva", "como editar", "gpt prompts", "prompts"]
const ehFerramenta = (titulo: string) => FERRAMENTAS.some((f) => normalizar(titulo).includes(f))

/** Cada etapa com a sua luz e o seu ícone; "gravando" tem o ponto vermelho de gravação. */
const ETAPA: Record<StatusConteudo, { cor: string; icone: LucideIcon; rec?: boolean }> = {
  ideia: { cor: "var(--b-ambar)", icone: Lightbulb },
  idealizando: { cor: "var(--b-violeta)", icone: PenLine },
  gravando: { cor: "#ff4d6d", icone: Video, rec: true },
  editando: { cor: "var(--b-coral)", icone: Scissors },
  finalizado: { cor: "var(--b-luz-2)", icone: CheckCheck },
  publicado: { cor: "var(--b-verde)", icone: Radio },
}
const etapaDe = (status: string) => ETAPA[status as StatusConteudo] ?? ETAPA.idealizando

const FORMATO: Record<string, LucideIcon> = {
  Carrossel: GalleryHorizontal,
  "Reels/Shorts": Clapperboard,
  Vídeo: Video,
  Imagem: IconeImagem,
  Stories: CircleDashed,
  Texto: Type,
}

const CAMPO =
  "h-11 rounded-full border border-[var(--b-borda)] bg-black/25 px-4 text-sm placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none"

/* ------------------------------------------------------------------ */
/* Banco de ideias                                                     */
/* ------------------------------------------------------------------ */

function BancoIdeias({ ideias, linhas, aoAbrir }: { ideias: Conteudo[]; linhas: Tables<"editorial_lines">[]; aoAbrir: (c: Conteudo) => void }) {
  const criar = useCriar("content_items")
  const atualizar = useAtualizar("content_items")
  const [texto, setTexto] = React.useState("")
  const [linha, setLinha] = React.useState("")
  const [busca, setBusca] = React.useState("")
  const nomes = new Map(linhas.map((l) => [l.id, l.name]))
  const visiveis = ideias.filter((i) => !busca || contem(i.title, busca)).sort((a, b) => b.created_at.localeCompare(a.created_at))

  const adicionar = (e: React.FormEvent) => {
    e.preventDefault()
    const t = texto.trim()
    if (!t) return
    criar.mutate({ id: novoId(), title: t, status: "ideia", editorial_line_id: linha || null, position: Date.now() })
    setTexto("")
  }

  return (
    <section aria-label="Banco de ideias">
      <form onSubmit={adicionar} className="console-ia mb-5 flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-lg leading-none text-[var(--b-luz)]">
            ›
          </span>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Anote uma ideia de conteúdo e aperte Enter"
            aria-label="Nova ideia"
            className="h-11 w-full bg-transparent pl-9 pr-3 text-base placeholder:text-ink-3 focus-visible:outline-none sm:text-sm"
          />
        </div>
        <div className="flex gap-2">
          {linhas.length ? (
            <select value={linha} onChange={(e) => setLinha(e.target.value)} aria-label="Linha editorial da ideia" className={cn(CAMPO, "min-w-0 flex-1 sm:w-48 sm:flex-none")}>
              <option value="">Sem linha editorial</option>
              {linhas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          ) : null}
          <Botao type="submit" variante="primario" tamanho="lg" className={cn("shrink-0 rounded-full px-5", ACAO_ACESA)} disabled={!texto.trim()}>
            <Plus /> Guardar ideia
          </Botao>
        </div>
      </form>
      {ideias.length > 8 ? (
        <div className="relative mb-3 max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar ideias" aria-label="Filtrar ideias" className={cn(CAMPO, "w-full pl-10")} />
        </div>
      ) : null}
      {visiveis.length === 0 ? (
        <VazioCerebro icone={Lightbulb} titulo={busca ? "Nenhuma ideia com esse texto." : "O banco está vazio."} descricao={busca ? "Experimente outra palavra." : "Toda ideia que surgir cabe aqui, mesmo pela metade."} />
      ) : (
        <ul className="grid gap-2">
          {visiveis.map((i) => (
            <li key={i.id} className="vidro-vivo flex items-center gap-3 px-3 py-2.5 sm:px-4">
              <span className="icone-aceso size-9" style={{ "--cor": "var(--b-ambar)" } as React.CSSProperties} aria-hidden>
                <Lightbulb className="size-4" />
              </span>
              <button type="button" onClick={() => aoAbrir(i)} className="min-w-0 flex-1 py-1 text-left">
                <span className="line-clamp-2 text-sm font-medium hover:text-[var(--b-luz)]">{i.title}</span>
                <span className="block text-xs text-ink-3">
                  {[nomes.get(i.editorial_line_id ?? ""), i.format, dataRelativa(i.created_at.slice(0, 10))].filter(Boolean).join(" · ")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => atualizar.mutate({ id: i.id, status: "idealizando" })}
                title="Levar para Idealizando no quadro"
                className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-[var(--b-luz)]/40 bg-[var(--b-luz)]/[0.08] px-3 text-xs font-semibold transition-colors hover:border-[var(--b-luz)] hover:bg-[var(--b-luz)]/[0.16] toque:min-h-11"
              >
                Produzir <ArrowRight className="size-3.5 text-[var(--b-luz)]" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Quadro de produção                                                  */
/* ------------------------------------------------------------------ */

function Cartao({ item, linha, hoje, aoAbrir }: { item: Conteudo; linha?: string; hoje: string; aoAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id })
  const etapa = etapaDe(item.status)
  const Formato = item.format ? (FORMATO[item.format] ?? FileText) : null
  const prazo = prazoDoConteudo(item, hoje)
  return (
    <div
      ref={setNodeRef}
      style={{ ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}), "--cor": etapa.cor } as React.CSSProperties}
      {...attributes}
      {...listeners}
      onClick={aoAbrir}
      className={cn(
        "relative cursor-pointer touch-none overflow-hidden rounded-xl border border-[var(--b-borda)] bg-[rgb(22_10_30/0.78)] p-3 pl-3.5 text-sm transition-[border-color,box-shadow] hover:border-[var(--b-borda-2)] hover:shadow-[0_14px_30px_-20px_var(--cor)]",
        isDragging && "relative z-10 border-[var(--cor)] shadow-overlay",
      )}
    >
      <span aria-hidden className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-[var(--cor)] shadow-[0_0_8px_var(--cor)]" />
      <p className="font-medium leading-snug">{item.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-ink-3">
        {item.format && Formato ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--b-borda)] bg-white/[0.04] px-2 py-0.5 text-ink-2">
            <Formato className="size-3" aria-hidden />
            {item.format}
          </span>
        ) : null}
        {linha ? <span className="truncate">{linha}</span> : null}
        {item.status === "publicado" && item.views ? (
          <span className="inline-flex items-center gap-1" title={`${numero(item.views)} visualizações`}>
            <Eye className="size-3" aria-hidden /> {numero(item.views)}
          </span>
        ) : item.publish_date ? (
          <span className={cn("inline-flex items-center gap-1", prazo === "atrasado" && "font-medium text-danger", prazo === "hoje" && "font-medium text-[var(--b-luz)]")}>
            <CalendarClock className="size-3" aria-hidden />
            {prazo === "atrasado" ? `atrasado, ${dataRelativa(item.publish_date)}` : <span className="first-letter:uppercase">{dataRelativa(item.publish_date)}</span>}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function Coluna({ status, children, total, aoCriar }: { status: StatusConteudo; children: React.ReactNode; total: number; aoCriar: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const etapa = ETAPA[status]
  const Icone = etapa.icone
  return (
    <section
      ref={setNodeRef}
      aria-label={`${STATUS_CONTEUDO[status]}: ${plural(total, "conteúdo")}`}
      data-sobre={isOver ? "" : undefined}
      className="coluna-etapa flex min-h-44 snap-start flex-col p-2.5"
      style={{ "--cor": etapa.cor } as React.CSSProperties}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2 pl-1.5 pt-1">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          {etapa.rec ? <span className="ponto-rec" aria-hidden /> : <Icone className="size-4 shrink-0" style={{ color: etapa.cor }} aria-hidden />}
          <span className="truncate">{STATUS_CONTEUDO[status]}</span>
          <span className="tabular rounded-full border border-[var(--b-borda)] bg-white/[0.04] px-1.5 text-[11px] font-medium text-ink-2">{total}</span>
        </h3>
        <button type="button" aria-label={`Novo em ${STATUS_CONTEUDO[status]}`} onClick={aoCriar} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-white/[0.06] hover:text-ink toque:size-10">
          <Plus className="size-4" />
        </button>
      </div>
      <div className="grid gap-2">{children}</div>
      {total === 0 ? <p className="m-1 rounded-xl border border-dashed border-[var(--b-borda)] px-2 py-6 text-center text-xs text-ink-3">Arraste um cartão para cá</p> : null}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Calendário                                                          */
/* ------------------------------------------------------------------ */

function Calendario({ itens, aoAbrir, aoCriar }: { itens: Conteudo[]; aoAbrir: (c: Conteudo) => void; aoCriar: (dia: string) => void }) {
  const [mes, setMes] = React.useState(() => startOfMonth(new Date()))
  const hoje = isoDia()
  const dias: Date[] = []
  for (let d = startOfWeek(startOfMonth(mes)); d <= endOfWeek(endOfMonth(mes)); d = addDays(d, 1)) dias.push(d)
  const doMes = itens.filter((i) => i.publish_date?.startsWith(format(mes, "yyyy-MM"))).sort((a, b) => (a.publish_date ?? "").localeCompare(b.publish_date ?? ""))
  return (
    <section aria-label="Calendário de publicação" className="vidro p-3 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-semibold first-letter:uppercase">{format(mes, "MMMM 'de' yyyy", { locale: ptBR })}</h2>
        <div className="flex gap-1">
          <button type="button" aria-label="Mês anterior" onClick={() => setMes((m) => addMonths(m, -1))} className="grid size-10 place-items-center rounded-full border border-[var(--b-borda)] text-ink-2 hover:border-[var(--b-borda-2)] hover:text-ink">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Próximo mês" onClick={() => setMes((m) => addMonths(m, 1))} className="grid size-10 place-items-center rounded-full border border-[var(--b-borda)] text-ink-2 hover:border-[var(--b-borda-2)] hover:text-ink">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => (
          <div key={d} className="rotulo-hud pb-1 text-center text-[10px]">
            {d}
          </div>
        ))}
        {dias.map((d) => {
          const iso = isoDia(d)
          const doDia = itens.filter((i) => i.publish_date === iso)
          const fora = d.getMonth() !== mes.getMonth()
          return (
            <div
              key={iso}
              onClick={() => aoCriar(iso)}
              className={cn(
                "min-h-14 cursor-pointer rounded-lg border border-white/[0.05] bg-white/[0.02] p-1 transition-colors hover:border-[var(--b-borda-2)] hover:bg-white/[0.05] sm:min-h-28 sm:p-1.5",
                fora && "opacity-40",
                iso === hoje && "border-[var(--b-luz)]/50 bg-[var(--b-luz)]/[0.06]",
              )}
            >
              <span className={cn("tabular inline-grid size-6 place-items-center rounded-full text-xs", iso === hoje && "bg-pen font-semibold text-pen-ink shadow-[0_0_12px_-2px_var(--b-luz)]")}>{d.getDate()}</span>
              {/* No celular, só os pontos (a lista do mês fica embaixo); no computador, os títulos */}
              <div className="mt-0.5 flex flex-wrap gap-1 sm:hidden" aria-hidden>
                {doDia.slice(0, 4).map((c) => (
                  <span key={c.id} className="size-1.5 rounded-full" style={{ background: etapaDe(c.status).cor, boxShadow: `0 0 6px ${etapaDe(c.status).cor}` }} />
                ))}
              </div>
              <div className="hidden gap-0.5 sm:grid">
                {doDia.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      aoAbrir(c)
                    }}
                    style={{ "--cor": etapaDe(c.status).cor } as React.CSSProperties}
                    className="truncate rounded-md bg-[color-mix(in_oklab,var(--cor)_16%,transparent)] px-1.5 text-left text-[11px] font-medium leading-5 text-[var(--cor)] hover:bg-[color-mix(in_oklab,var(--cor)_26%,transparent)]"
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {doMes.length ? (
        <ol className="mt-4 grid gap-1 border-t border-[var(--b-borda)] pt-3 sm:hidden" aria-label="Conteúdos do mês">
          {doMes.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => aoAbrir(c)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-1.5 text-left text-sm hover:bg-white/[0.05]">
                <span className="tabular w-12 shrink-0 text-xs text-ink-3">{format(new Date(`${c.publish_date}T12:00`), "dd/MM")}</span>
                <span className="size-2 shrink-0 rounded-full" style={{ background: etapaDe(c.status).cor }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                <span className="shrink-0 text-xs text-ink-3">{STATUS_CONTEUDO[c.status as StatusConteudo] ?? c.status}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Desempenho                                                          */
/* ------------------------------------------------------------------ */

function Desempenho({ itens, aoAbrir }: { itens: Conteudo[]; aoAbrir: (c: Conteudo) => void }) {
  const d = desempenho(itens)
  if (!d.lista.length)
    return <VazioCerebro icone={TrendingUp} titulo="Nada para medir ainda." descricao="Registre visualizações e curtidas nos conteúdos publicados para ver o desempenho aqui." />
  const indicadores = [
    { rotulo: "Visualizações", valor: numero(d.visualizacoes), icone: Eye, cor: "var(--b-luz)" },
    { rotulo: "Curtidas", valor: numero(d.curtidas), icone: Heart, cor: "var(--b-rosa)" },
    { rotulo: "Engajamento médio", valor: d.mediaEngajamento === null ? "–" : `${numero(d.mediaEngajamento, 1)}%`, icone: TrendingUp, cor: "var(--b-verde)" },
    { rotulo: "Mais visto", valor: d.melhor ? numero(d.melhor.views) : "–", detalhe: d.melhor?.title, icone: Flame, cor: "var(--b-ambar)" },
  ]
  return (
    <div className="grid gap-5">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo do desempenho">
        {indicadores.map((x) => (
          <li key={x.rotulo} className="vidro min-w-0 p-4">
            <p className="rotulo-hud flex items-center gap-1.5">
              <x.icone className="size-3.5 shrink-0" style={{ color: x.cor }} aria-hidden /> <span className="truncate">{x.rotulo}</span>
            </p>
            <p className="tabular mt-2 font-display text-2xl font-semibold sm:text-3xl" style={{ textShadow: `0 0 18px color-mix(in oklab, ${x.cor} 45%, transparent)` }}>
              {x.valor}
            </p>
            {x.detalhe ? <p className="mt-0.5 truncate text-xs text-ink-3">{x.detalhe}</p> : null}
          </li>
        ))}
      </ul>
      <section aria-labelledby="titulo-ranking" className="vidro p-3 sm:p-5">
        <TituloPainel id="titulo-ranking" icone={TrendingUp} titulo="Os mais vistos" />
        <div aria-hidden className="hidden grid-cols-[2rem_minmax(0,1fr)_13rem_5rem_6rem_6rem] gap-3 px-2 pb-2 text-xs text-ink-3 lg:grid">
          <span />
          <span>Conteúdo</span>
          <span>Visualizações</span>
          <span className="text-right">Curtidas</span>
          <span className="text-right">Comentários</span>
          <span className="text-right">Engajamento</span>
        </div>
        <ol className="grid gap-1">
          {d.lista.map((p, i) => {
            const eng = engajamento(p)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => aoAbrir(p)}
                  className="grid w-full grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 rounded-xl px-2 py-2.5 text-left text-sm transition-colors hover:bg-white/[0.04] lg:grid-cols-[2rem_minmax(0,1fr)_13rem_5rem_6rem_6rem]"
                >
                  <span className={cn("tabular row-span-3 self-start pt-0.5 text-center font-display text-lg font-semibold lg:row-span-1 lg:self-center lg:pt-0", i === 0 ? "text-[var(--b-ambar)]" : "text-ink-3")}>{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.title}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {[p.format, p.publish_date ? format(new Date(`${p.publish_date}T12:00`), "d MMM yyyy", { locale: ptBR }) : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="col-start-2 flex items-center gap-2 lg:col-start-auto" title={`${numero(p.views)} visualizações`}>
                    <span className="barra-luz flex-1" aria-hidden>
                      <span style={{ width: `${Math.max(2, ((p.views ?? 0) / d.maximo) * 100)}%` }} />
                    </span>
                    <span className="tabular w-14 shrink-0 text-right text-xs">
                      {numero(p.views)}
                      <span className="sr-only"> visualizações</span>
                    </span>
                  </span>
                  <span className="col-start-2 flex flex-wrap gap-x-3 gap-y-0.5 whitespace-nowrap text-xs text-ink-3 lg:contents">
                    <span className="tabular lg:text-right lg:text-sm lg:text-ink">
                      {numero(p.likes)}
                      <span className="lg:sr-only"> curtidas</span>
                    </span>
                    <span className="tabular lg:text-right lg:text-sm lg:text-ink">
                      {numero(p.comments)}
                      <span className="lg:sr-only"> comentários</span>
                    </span>
                    <span className="tabular lg:text-right lg:text-sm lg:text-ink">
                      {eng === null ? "–" : `${numero(eng, 1)}%`}
                      <span className="lg:sr-only"> de engajamento</span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Guias, linhas editoriais e links                                    */
/* ------------------------------------------------------------------ */

function ListaGuias({ paginas, icone: Icone }: { paginas: { id: string; title: string; icon: string | null }[]; icone: LucideIcon }) {
  return (
    <ul className="grid gap-0.5">
      {paginas.map((p) => (
        <li key={p.id}>
          <Link href={`/paginas/${p.id}`} className="flex min-h-10 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors hover:bg-white/[0.05] hover:text-[var(--b-luz)]">
            {p.icon && !p.icon.startsWith("/") && p.icon.length <= 4 ? <span className="w-4 text-center">{p.icon}</span> : <Icone className="size-4 shrink-0 text-ink-3" />}
            <span className="truncate">{p.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

// Tudo menos `script`: o roteiro é texto longo e só a janela de edição o usa (ela busca o registro inteiro)
const COLUNAS_CONTEUDO_LISTA =
  "id,notion_id,title,status,format,editorial_line_id,platforms,publish_date,media_url,reference_url,published_url,views,likes,comments,shares,idea_type,position,created_at,updated_at"

export function PaginaPlanner() {
  const [visao, setVisao] = React.useState<Visao>("quadro")
  const { data: itens = [], isLoading } = useLista("content_items", { colunas: COLUNAS_CONTEUDO_LISTA, ordem: [{ coluna: "position" }] })
  const { data: linhas = [] } = useLista("editorial_lines", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  const { data: paginas = [] } = useArvorePaginas()
  const atualizar = useAtualizar("content_items")
  const criarLinha = useCriar("editorial_lines")
  const [aberto, setAberto] = React.useState<Conteudo | null>(null)
  const [novo, setNovo] = React.useState<{ status?: string; dia?: string } | null>(null)
  const [linhaNova, setLinhaNova] = React.useState("")
  const [filtroLinha, setFiltroLinha] = React.useState("")
  const hoje = isoDia()

  useAbrirDoEndereco(itens, setAberto)

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }))
  const nomesLinha = new Map(linhas.map((l) => [l.id, l.name]))
  const filtrados = itens.filter((i) => !filtroLinha || i.editorial_line_id === filtroLinha)
  const guias = paginas.filter((p) => p.section === "planner" && !p.parent_id)
  const estrategia = guias.filter((p) => !ehFerramenta(p.title))
  const ferramentas = guias.filter((p) => ehFerramenta(p.title))
  const { data: links = [] } = useLista("bookmarks", { filtro: (q) => q.eq("collection", "links"), ordem: [{ coluna: "position" }], chave: ["links-planner"] })
  const ideias = filtrados.filter((i) => i.status === "ideia")
  const r = resumoDoPlanner(filtrados, hoje)

  const soltar = (e: DragEndEvent) => {
    const destino = e.over?.id as StatusConteudo | undefined
    const item = itens.find((i) => i.id === e.active.id)
    if (item && destino && item.status !== destino) atualizar.mutate({ id: item.id, status: destino })
  }

  return (
    <MolduraEstudio>
      <CabecalhoEstudio
        icone={Clapperboard}
        papel="Da ideia à publicação"
        titulo="Planner de conteúdo"
        descricao="Da ideia à publicação. Arraste os cartões entre as etapas, ou abra um cartão para mudar a etapa."
        descricaoNoCelular={!itens.length}
        acoes={
          <Botao variante="primario" tamanho="lg" onClick={() => setNovo({})} className={cn("rounded-full px-5", ACAO_ACESA)}>
            <Plus /> Novo conteúdo
          </Botao>
        }
        hud={
          isLoading || !itens.length
            ? []
            : [
                { n: r.ideias, rotulo: r.ideias === 1 ? "ideia no banco" : "ideias no banco", cor: "var(--b-ambar)" },
                { n: r.producao, rotulo: "em produção", cor: "var(--b-luz)" },
                ...(r.prontos ? [{ n: r.prontos, rotulo: r.prontos === 1 ? "pronto para publicar" : "prontos para publicar", cor: "var(--b-luz-2)" }] : []),
                ...(r.semana ? [{ n: r.semana, rotulo: "nos próximos 7 dias", cor: "var(--b-violeta)" }] : []),
                ...(r.atrasados ? [{ n: r.atrasados, rotulo: r.atrasados === 1 ? "atrasado" : "atrasados", cor: "var(--danger)" }] : []),
                ...(r.publicadosMes ? [{ n: r.publicadosMes, rotulo: r.publicadosMes === 1 ? "publicado no mês" : "publicados no mês", cor: "var(--b-verde)" }] : []),
              ]
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Segmentos
          rotulo="Visualização"
          className="max-w-full rounded-full border border-[var(--b-borda)] bg-black/30 p-1 [&>button]:rounded-full [&>button]:px-3 sm:[&>button]:px-4"
          valor={visao}
          aoMudar={setVisao}
          opcoes={[
            { valor: "ideias", rotulo: "Ideias", contagem: ideias.length },
            { valor: "quadro", rotulo: "Quadro" },
            { valor: "calendario", rotulo: "Calendário" },
            { valor: "desempenho", rotulo: "Desempenho" },
          ]}
        />
        {linhas.length ? (
          <select value={filtroLinha} onChange={(e) => setFiltroLinha(e.target.value)} aria-label="Linha editorial" className={cn(CAMPO, "max-w-full")}>
            <option value="">Todas as linhas editoriais</option>
            {linhas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {isLoading ? (
        <Carregando />
      ) : visao === "ideias" ? (
        <BancoIdeias ideias={ideias} linhas={linhas} aoAbrir={setAberto} />
      ) : visao === "quadro" ? (
        <DndContext sensors={sensores} onDragEnd={soltar}>
          {/* As colunas cabem lado a lado no computador; em telas menores, o quadro desliza para o lado */}
          <div className="-mx-4 grid snap-x snap-mandatory scroll-px-4 auto-cols-[82%] grid-flow-col items-start gap-3 overflow-x-auto px-4 pb-4 pt-1 scrollbar-thin sm:mx-0 sm:items-stretch sm:auto-cols-[minmax(12rem,1fr)] sm:snap-none sm:scroll-px-0 sm:px-0">
            {ETAPAS_PRODUCAO.map((s) => {
              const lista = filtrados.filter((i) => i.status === s).sort((a, b) => (a.publish_date ?? "9").localeCompare(b.publish_date ?? "9"))
              const mostrar = s === "publicado" ? lista.slice(-12).reverse() : lista
              return (
                <Coluna key={s} status={s} total={lista.length} aoCriar={() => setNovo({ status: s })}>
                  {mostrar.map((i) => (
                    <Cartao key={i.id} item={i} hoje={hoje} linha={nomesLinha.get(i.editorial_line_id ?? "")} aoAbrir={() => setAberto(i)} />
                  ))}
                </Coluna>
              )
            })}
          </div>
        </DndContext>
      ) : visao === "calendario" ? (
        <Calendario itens={filtrados} aoAbrir={setAberto} aoCriar={(dia) => setNovo({ dia, status: "idealizando" })} />
      ) : (
        <Desempenho itens={filtrados} aoAbrir={setAberto} />
      )}

      <div className="mt-10 grid items-start gap-4 lg:grid-cols-3">
        <div className="grid content-start gap-4">
          {estrategia.length ? (
            <section aria-labelledby="titulo-estrategia" className="vidro p-4 sm:p-5">
              <TituloPainel id="titulo-estrategia" icone={Compass} titulo="Estratégia" cor="var(--b-violeta)" />
              <ListaGuias paginas={estrategia} icone={FileText} />
            </section>
          ) : null}
          {ferramentas.length ? (
            <section aria-labelledby="titulo-ferramentas" className="vidro p-4 sm:p-5">
              <TituloPainel id="titulo-ferramentas" icone={Wrench} titulo="Ferramentas" cor="var(--b-luz-2)" />
              <ListaGuias paginas={ferramentas} icone={Wrench} />
            </section>
          ) : null}
        </div>
        <section aria-labelledby="titulo-linhas" className="vidro p-4 sm:p-5">
          <TituloPainel id="titulo-linhas" icone={Tags} titulo="Linhas editoriais" />
          <ul className="mb-4 flex flex-wrap gap-2">
            {linhas.map((l) => {
              const ativa = filtroLinha === l.id
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setFiltroLinha((f) => (f === l.id ? "" : l.id))}
                    aria-pressed={ativa}
                    className={cn(
                      "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors toque:min-h-10",
                      ativa ? "border-[var(--b-luz)] bg-[var(--b-luz)]/[0.16] shadow-[0_0_18px_-8px_var(--b-luz)]" : "border-[var(--b-borda)] bg-white/[0.03] text-ink-2 hover:border-[var(--b-borda-2)] hover:text-ink",
                    )}
                  >
                    {l.name} <span className="tabular text-xs text-[var(--b-luz)]">{itens.filter((i) => i.editorial_line_id === l.id).length}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (linhaNova.trim()) {
                criarLinha.mutate({ id: novoId(), name: linhaNova.trim(), position: linhas.length + 1 })
                setLinhaNova("")
              }
            }}
            className="flex gap-2"
          >
            <input value={linhaNova} onChange={(e) => setLinhaNova(e.target.value)} placeholder="Nova linha editorial" aria-label="Nova linha editorial" className={cn(CAMPO, "min-w-0 flex-1")} />
            <Botao type="submit" tamanho="lg" className="rounded-full" disabled={!linhaNova.trim()}>
              Adicionar
            </Botao>
          </form>
        </section>
        <section aria-labelledby="titulo-links" className="vidro p-4 sm:p-5">
          <TituloPainel
            id="titulo-links"
            icone={Link2}
            titulo="Links externos"
            cor="var(--b-luz-2)"
            acao={
              <Link href="/links" className={LINK_PAINEL}>
                Links úteis
              </Link>
            }
          />
          {links.length ? (
            <ul className="grid gap-0.5">
              {links.map((l) => (
                <li key={l.id}>
                  <a href={urlValida(l.url) ?? "#"} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors hover:bg-white/[0.05] hover:text-[var(--b-luz)]">
                    <ExternalLink className="size-4 shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1 truncate">{l.title}</span>
                    {l.kind ? <span className="shrink-0 text-xs text-ink-3">{l.kind}</span> : null}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">
              Nenhum link ainda. Adicione em{" "}
              <Link href="/links" className="text-[var(--b-luz)] hover:underline">
                Links úteis
              </Link>
              , na coleção Links.
            </p>
          )}
        </section>
      </div>

      <DialogoConteudo
        aberta={Boolean(novo) || Boolean(aberto)}
        aoMudar={(v) => {
          if (!v) {
            setNovo(null)
            setAberto(null)
          }
        }}
        item={aberto}
        statusInicial={novo?.status}
        dataInicial={novo?.dia}
      />
    </MolduraEstudio>
  )
}
