"use client"

import * as React from "react"
import { DndContext, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { ArrowRight, CalendarClock, Clapperboard, Eye, Hourglass, Plus } from "lucide-react"
import { diasParado, ETAPAS_PRODUCAO, prazoDoConteudo, proximaEtapa } from "@/features/conteudo/logica"
import { STATUS_CONTEUDO, type StatusConteudo } from "@/lib/rotulos"
import { cn, dataRelativa, isoDia, numero, plural } from "@/lib/utils"
import { ETAPA, etapaDe, ICONE_FORMATO, IconeFormatoOutro, type Conteudo } from "./ui"

function Cartao({
  item,
  linha,
  hoje,
  aoAbrir,
  aoAvancar,
}: {
  item: Conteudo
  linha?: string
  hoje: string
  aoAbrir: () => void
  aoAvancar: () => void
}) {
  // Só o arrastar com o mouse ou com o dedo parado um instante (no celular, deslizar continua rolando a tela)
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id })
  const etapa = etapaDe(item.status)
  const Formato = item.format ? (ICONE_FORMATO[item.format] ?? IconeFormatoOutro) : null
  const prazo = prazoDoConteudo(item, hoje)
  const parado = diasParado(item.status, isoDia(new Date(item.updated_at)), hoje)
  const proxima = proximaEtapa(item.status, item.format)
  const rotuloProxima = proxima === "publicado" ? "Publiquei" : proxima ? STATUS_CONTEUDO[proxima] : ""
  return (
    <div
      ref={setNodeRef}
      style={{ ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}), "--cor": etapa.cor } as React.CSSProperties}
      {...listeners}
      onClick={aoAbrir}
      className={cn(
        "relative cursor-pointer touch-manipulation select-none overflow-hidden rounded-xl border border-[var(--b-borda)] bg-surface p-3 pl-3.5 text-sm transition-[border-color,box-shadow] [-webkit-touch-callout:none] hover:border-[var(--b-borda-2)]",
        isDragging && "relative z-10 border-[var(--cor)] shadow-overlay",
      )}
    >
      <span aria-hidden className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-[var(--cor)]" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          aoAbrir()
        }}
        className="block w-full rounded-sm text-left font-medium leading-snug"
      >
        {item.title}
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-ink-3">
        {item.format && Formato ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--b-borda)] bg-ink/[0.04] px-2 py-0.5 text-ink-2">
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
        {parado ? (
          <span className="inline-flex items-center gap-1 text-ink-2" title="Sem mudanças há uma semana ou mais">
            <Hourglass className="size-3 shrink-0 text-[var(--b-ambar)]" aria-hidden /> parado há {parado} dias
          </span>
        ) : null}
      </div>
      {proxima ? (
        <div className="mt-2.5 flex justify-end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              aoAvancar()
            }}
            aria-label={proxima === "publicado" ? `Marcar ${item.title} como publicado` : `Avançar ${item.title} para ${rotuloProxima}`}
            className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-[var(--b-borda)] px-2.5 text-xs font-medium text-ink-2 transition-colors hover:border-[var(--cor)] hover:text-ink toque:min-h-10"
          >
            {rotuloProxima} <ArrowRight className="size-3.5 text-[var(--cor)]" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function Coluna({ status, children, total, aoCriar, extra }: { status: StatusConteudo; children: React.ReactNode; total: number; aoCriar: () => void; extra?: React.ReactNode }) {
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
          <span className="tabular rounded-full border border-[var(--b-borda)] bg-ink/[0.04] px-1.5 text-[11px] font-medium text-ink-2">{total}</span>
        </h3>
        <button type="button" aria-label={`Novo em ${STATUS_CONTEUDO[status]}`} onClick={aoCriar} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-ink/[0.06] hover:text-ink toque:size-10">
          <Plus className="size-4" />
        </button>
      </div>
      {extra}
      <div className="grid gap-2">{children}</div>
      {total === 0 ? <p className="m-1 rounded-xl border border-dashed border-[var(--b-borda)] px-2 py-6 text-center text-xs text-ink-3">Arraste um cartão para cá ou use o botão de avançar.</p> : null}
    </section>
  )
}

/**
 * O quadro de produção: uma coluna por etapa da esteira. Cada cartão avança com um toque (com
 * "Desfazer"), e também dá para arrastar: com o mouse, ou segurando o dedo um instante no celular.
 */
export function Quadro({
  itens,
  nomesLinha,
  hoje,
  aoAbrir,
  aoCriar,
  aoLevar,
  aoAvancar,
  aoGravarEmSequencia,
}: {
  itens: Conteudo[]
  nomesLinha: Map<string, string>
  hoje: string
  aoAbrir: (c: Conteudo) => void
  aoCriar: (status: StatusConteudo) => void
  aoLevar: (c: Conteudo, destino: StatusConteudo) => void
  aoAvancar: (c: Conteudo) => void
  aoGravarEmSequencia: () => void
}) {
  const [todosPublicados, setTodosPublicados] = React.useState(false)
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )
  // Soltar um cartão também dispara o clique nele: logo depois de arrastar, o clique não abre a janela
  const acabouDeSoltar = React.useRef(false)
  const marcarSoltura = () => {
    acabouDeSoltar.current = true
    window.setTimeout(() => {
      acabouDeSoltar.current = false
    }, 300)
  }
  const abrir = (c: Conteudo) => {
    if (!acabouDeSoltar.current) aoAbrir(c)
  }
  const soltar = (e: DragEndEvent) => {
    marcarSoltura()
    const destino = e.over?.id as StatusConteudo | undefined
    const item = itens.find((i) => i.id === e.active.id)
    if (item && destino && item.status !== destino) aoLevar(item, destino)
  }

  return (
    <DndContext
      sensors={sensores}
      onDragEnd={soltar}
      onDragCancel={marcarSoltura}
    >
      {/* As colunas cabem lado a lado no computador; em telas menores, o quadro desliza para o lado */}
      <div className="-mx-4 grid snap-x snap-mandatory scroll-px-4 auto-cols-[82%] grid-flow-col items-start gap-3 overflow-x-auto px-4 pb-4 pt-1 scrollbar-thin sm:mx-0 sm:items-stretch sm:auto-cols-[minmax(12rem,1fr)] sm:snap-none sm:scroll-px-0 sm:px-0">
        {ETAPAS_PRODUCAO.map((s) => {
          const lista = itens.filter((i) => i.status === s).sort((a, b) => (a.publish_date ?? "9").localeCompare(b.publish_date ?? "9"))
          // Publicados: os mais recentes primeiro, poucos de cada vez (a coluna não estica o quadro inteiro)
          const mostrar = s === "publicado" ? lista.slice().reverse().slice(0, todosPublicados ? 60 : 6) : lista
          return (
            <Coluna
              key={s}
              status={s}
              total={lista.length}
              aoCriar={() => aoCriar(s)}
              extra={
                s === "gravando" && lista.length ? (
                  <button
                    type="button"
                    onClick={aoGravarEmSequencia}
                    className="mb-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--b-borda-2)] px-3 text-sm font-medium text-ink-2 transition-colors hover:border-[var(--cor)] hover:text-ink"
                  >
                    <Clapperboard className="size-4 text-[var(--cor)]" aria-hidden />
                    Gravar em sequência
                  </button>
                ) : null
              }
            >
              {mostrar.map((i) => (
                <Cartao key={i.id} item={i} hoje={hoje} linha={nomesLinha.get(i.editorial_line_id ?? "")} aoAbrir={() => abrir(i)} aoAvancar={() => aoAvancar(i)} />
              ))}
              {s === "publicado" && lista.length > 6 ? (
                <button
                  type="button"
                  onClick={() => setTodosPublicados((v) => !v)}
                  aria-expanded={todosPublicados}
                  className="min-h-10 rounded-xl px-2 text-sm font-medium text-ink-2 transition-colors hover:bg-ink/[0.04] hover:text-ink"
                >
                  {todosPublicados ? "Mostrar só os recentes" : `Mostrar os ${lista.length} publicados`}
                </button>
              ) : null}
            </Coluna>
          )
        })}
      </div>
    </DndContext>
  )
}
