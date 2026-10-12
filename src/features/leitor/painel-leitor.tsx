"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Painel do leitor, com as cores do tema de leitura.
 * No celular sobe de baixo (o polegar alcança); no computador fica à direita.
 */
export function PainelLeitor({
  titulo,
  aoFechar,
  children,
  rodape,
}: {
  titulo: string
  aoFechar: () => void
  children: React.ReactNode
  rodape?: React.ReactNode
}) {
  const ref = React.useRef<HTMLElement>(null)
  React.useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return (
    <>
      <div className="absolute inset-0 z-20 bg-black/30 animate-[fade-in_120ms_ease-out]" onClick={aoFechar} aria-hidden />
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 flex max-h-[80dvh] flex-col rounded-t-2xl border-t bg-[var(--l-painel)] text-[var(--l-texto)] shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.35)] outline-none animate-subir",
          "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[24rem] sm:rounded-none sm:border-l sm:border-t-0 sm:pt-[env(safe-area-inset-top)]",
        )}
        style={{ borderColor: "var(--l-borda)" }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--l-borda)] sm:hidden" aria-hidden />
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-2 sm:pt-4">
          <h2 className="font-display text-base font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="-mr-2 grid size-11 place-items-center rounded-full hover:bg-[var(--l-realce)]"
          >
            <X className="size-5" />
          </button>
        </div>
        <div data-rolagem className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] scrollbar-thin">
          {children}
        </div>
        {rodape}
      </section>
    </>
  )
}

/** Escolha entre poucas opções, em botões lado a lado. */
export function Opcoes<T extends string | number>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
}: {
  rotulo: string
  opcoes: { valor: T; rotulo: string; estilo?: React.CSSProperties }[]
  valor: T
  aoMudar: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-[var(--l-realce)] p-1">
      {opcoes.map((o) => {
        const ativo = o.valor === valor
        return (
          <button
            key={String(o.valor)}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => aoMudar(o.valor)}
            style={o.estilo}
            className={cn(
              "min-h-11 truncate rounded-lg px-2 text-sm transition-colors",
              ativo ? "bg-[var(--l-fundo)] font-semibold shadow-[0_1px_3px_rgb(0_0_0/0.15)]" : "text-[var(--l-suave)] hover:text-[var(--l-texto)]",
            )}
          >
            {o.rotulo}
          </button>
        )
      })}
    </div>
  )
}

export function Grupo({ rotulo, children, className }: { rotulo: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-2 py-3", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--l-suave)]">{rotulo}</p>
      {children}
    </div>
  )
}

export function Alternar({ rotulo, descricao, valor, aoMudar }: { rotulo: string; descricao?: string; valor: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      onClick={() => aoMudar(!valor)}
      className="flex min-h-12 w-full items-center justify-between gap-4 py-2 text-left"
    >
      <span className="grid">
        <span className="text-sm font-medium">{rotulo}</span>
        {descricao ? <span className="text-xs text-[var(--l-suave)]">{descricao}</span> : null}
      </span>
      <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", valor ? "bg-[var(--l-link)]" : "bg-[var(--l-borda)]")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]", valor ? "left-[1.125rem]" : "left-0.5")} />
      </span>
    </button>
  )
}
