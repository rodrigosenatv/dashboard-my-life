import type { LucideIcon } from "lucide-react"
import { BrainCircuit } from "lucide-react"
import type { ReactNode } from "react"

export function CabecalhoCerebro({
  titulo,
  descricao,
  icone: Icon,
  acoes,
}: {
  titulo: string
  descricao: string
  icone: LucideIcon
  acoes?: ReactNode
}) {
  return (
    <header className="relative mb-6 overflow-hidden rounded-2xl border border-projetos/15 bg-gradient-to-br from-projetos-soft via-surface to-surface p-4 shadow-[0_8px_32px_-28px_rgba(30,21,69,0.4)] sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-16 size-48 rounded-full border border-projetos/10 sm:size-64" />
      <div className="relative">
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-projetos/15 bg-surface/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-projetos">
          <BrainCircuit className="size-3.5" aria-hidden />
          Segundo Cérebro
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 break-words font-display text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-3xl">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-projetos/10 text-projetos">
                <Icon className="size-5" />
              </span>
              {titulo}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-base">{descricao}</p>
          </div>
          {acoes ? <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto [&>button]:min-h-11 [&>button]:flex-1 sm:[&>button]:flex-none">{acoes}</div> : null}
        </div>
      </div>
    </header>
  )
}
