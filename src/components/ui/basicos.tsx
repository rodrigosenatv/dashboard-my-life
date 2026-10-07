import * as React from "react"
import { cn } from "@/lib/utils"
import type { Area } from "@/lib/areas"

/* ------------------------------------------------------------------ */
/* Etiqueta (tags, status)                                             */
/* ------------------------------------------------------------------ */

const corEtiqueta: Record<string, string> = {
  neutra: "bg-surface-2 text-ink-2",
  rotina: "bg-rotina-soft text-rotina",
  projetos: "bg-projetos-soft text-projetos",
  estudos: "bg-estudos-soft text-estudos",
  conteudo: "bg-conteudo-soft text-conteudo",
  caneta: "bg-pen-soft text-pen",
  perigo: "bg-danger-soft text-danger",
}

export function Etiqueta({
  children,
  cor = "neutra",
  className,
  title,
}: {
  children: React.ReactNode
  cor?: keyof typeof corEtiqueta | Area
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-xs font-medium",
        corEtiqueta[cor] ?? corEtiqueta.neutra,
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Barra de progresso                                                  */
/* ------------------------------------------------------------------ */

const corBarra: Record<string, string> = {
  rotina: "bg-rotina",
  projetos: "bg-projetos",
  estudos: "bg-estudos",
  conteudo: "bg-conteudo",
  caneta: "bg-pen",
}

export function Progresso({
  valor,
  cor = "caneta",
  className,
  rotulo,
}: {
  valor: number
  cor?: keyof typeof corBarra
  className?: string
  rotulo: string
}) {
  const v = Math.max(0, Math.min(100, Math.round(valor)))
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-300", corBarra[cor])} style={{ width: `${v}%` }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cabeçalho de página                                                 */
/* ------------------------------------------------------------------ */

export function Cabecalho({
  titulo,
  descricao,
  acoes,
  area,
  className,
}: {
  titulo: string
  descricao?: React.ReactNode
  acoes?: React.ReactNode
  area?: Area
  className?: string
}) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 font-display text-3xl font-semibold">
          {area ? <MarcaArea area={area} /> : null}
          {titulo}
        </h1>
        {descricao ? <p className="mt-1.5 max-w-2xl text-ink-2">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
    </header>
  )
}

const corMarca: Record<Area, string> = {
  rotina: "bg-rotina",
  projetos: "bg-projetos",
  estudos: "bg-estudos",
  conteudo: "bg-conteudo",
  geral: "bg-ink-3",
}

/** Traço de marca-texto que identifica a área. */
export function MarcaArea({ area, className }: { area: Area; className?: string }) {
  return <span aria-hidden className={cn("inline-block h-6 w-1.5 shrink-0 rounded-full", corMarca[area], className)} />
}

/* ------------------------------------------------------------------ */
/* Seção com título                                                    */
/* ------------------------------------------------------------------ */

export function Secao({
  titulo,
  acao,
  children,
  className,
  descricao,
}: {
  titulo: string
  acao?: React.ReactNode
  children: React.ReactNode
  className?: string
  descricao?: string
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{titulo}</h2>
          {descricao ? <p className="text-sm text-ink-3">{descricao}</p> : null}
        </div>
        {acao}
      </div>
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Estado vazio                                                        */
/* ------------------------------------------------------------------ */

export function Vazio({
  titulo,
  descricao,
  acao,
  className,
  icone,
}: {
  titulo: string
  descricao?: string
  acao?: React.ReactNode
  className?: string
  icone?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border border-dashed border-line-strong px-5 py-6 text-sm",
        className,
      )}
    >
      {icone ? <div className="text-ink-3 [&_svg]:size-5">{icone}</div> : null}
      <p className="font-medium text-ink">{titulo}</p>
      {descricao ? <p className="max-w-md text-ink-2">{descricao}</p> : null}
      {acao ? <div className="mt-1">{acao}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Carregando                                                          */
/* ------------------------------------------------------------------ */

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} />
}

export function Carregando({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="grid gap-2" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }).map((_, i) => (
        <Esqueleto key={i} className="h-10" />
      ))}
    </div>
  )
}

export function ErroCarregar({ erro, aoTentar }: { erro: unknown; aoTentar?: () => void }) {
  const msg = erro instanceof Error ? erro.message : "Erro desconhecido"
  return (
    <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      <p className="font-medium">Não foi possível carregar os dados.</p>
      <p className="mt-0.5 opacity-80">{msg}</p>
      {aoTentar ? (
        <button type="button" onClick={aoTentar} className="mt-2 font-medium underline underline-offset-2">
          Tentar de novo
        </button>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Seletor segmentado (abas simples)                                   */
/* ------------------------------------------------------------------ */

export function Segmentos<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
  className,
}: {
  opcoes: { valor: T; rotulo: string; contagem?: number }[]
  valor: T
  aoMudar: (v: T) => void
  rotulo: string
  className?: string
}) {
  return (
    <div role="tablist" aria-label={rotulo} className={cn("inline-flex rounded-lg bg-surface-2 p-0.5", className)}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor
        return (
          <button
            key={o.valor}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => aoMudar(o.valor)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              ativo ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.rotulo}
            {o.contagem !== undefined ? <span className="tabular text-xs text-ink-3">{o.contagem}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Caixa de seleção redonda (tarefas, etapas)                          */
/* ------------------------------------------------------------------ */

export function Marcador({
  marcado,
  aoMudar,
  rotulo,
  area = "caneta",
  tamanho = "md",
}: {
  marcado: boolean
  aoMudar: (v: boolean) => void
  rotulo: string
  area?: Area | "caneta"
  tamanho?: "sm" | "md"
}) {
  const cores: Record<string, string> = {
    caneta: "border-pen bg-pen",
    rotina: "border-rotina bg-rotina",
    projetos: "border-projetos bg-projetos",
    estudos: "border-estudos bg-estudos",
    conteudo: "border-conteudo bg-conteudo",
    geral: "border-ink-2 bg-ink-2",
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcado}
      aria-label={rotulo}
      onClick={(e) => {
        e.stopPropagation()
        aoMudar(!marcado)
      }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-[1.5px] transition-colors",
        tamanho === "sm" ? "size-4" : "size-5",
        marcado ? cores[area] : "border-line-strong hover:border-ink-3",
      )}
    >
      {marcado ? (
        <svg viewBox="0 0 12 12" className={cn("text-white", tamanho === "sm" ? "size-2.5" : "size-3")} aria-hidden>
          <path d="M2.5 6.2 5 8.5 9.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  )
}
