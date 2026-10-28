"use client"

import { BrainCircuit, CalendarClock, Clapperboard, Lightbulb, Link2, NotebookPen, Pencil, Quote, Sparkle, Sparkles, Workflow, type LucideIcon } from "lucide-react"
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react"
import { cn, dataRelativa, diasAte, plural } from "@/lib/utils"
import { estadoPrazo } from "./logica"

/** Cada tipo de captura com o seu ícone e a sua luz; sem tipo (na caixa de entrada) é uma faísca. */
export const TIPOS_CAPTURA_UI: Record<string, { icone: LucideIcon; cor: string }> = {
  Anotação: { icone: NotebookPen, cor: "var(--b-luz)" },
  Ideia: { icone: Lightbulb, cor: "var(--b-ambar)" },
  Citação: { icone: Quote, cor: "var(--b-rosa)" },
  Metodologia: { icone: Workflow, cor: "var(--b-menta)" },
  Vídeo: { icone: Clapperboard, cor: "var(--b-coral)" },
  Link: { icone: Link2, cor: "var(--b-luz-2)" },
}
const SEM_TIPO = { icone: Sparkle, cor: "var(--b-luz)" }

export function tipoCaptura(tipo: string | null | undefined) {
  return (tipo && TIPOS_CAPTURA_UI[tipo]) || SEM_TIPO
}

/** O ícone do tipo da captura, aceso na cor do tipo. */
export function IconeCaptura({ tipo, className }: { tipo: string | null | undefined; className?: string }) {
  const t = tipoCaptura(tipo)
  const Icone = t.icone
  return (
    <span aria-hidden className={cn("icone-aceso size-9", className)} style={{ "--cor": t.cor } as CSSProperties}>
      <Icone className="size-4" />
    </span>
  )
}

export { textoEtapas } from "./logica"

/** As cores do anel: as de destaque da tela (o padrão do Segundo Cérebro: petróleo, violeta e rosa). */
const CORES_ANEL: [string, string, string] = ["var(--b-luz-2)", "var(--b-luz)", "var(--b-rosa)"]

/** O anel de luz com um progresso (em %), em degradê de três cores. */
export function AnelProgresso({
  pct,
  tamanho = 112,
  espessura = 6,
  legenda,
  cores = CORES_ANEL,
}: {
  pct: number
  tamanho?: number
  espessura?: number
  legenda?: string
  cores?: [string, string, string]
}) {
  const raio = (tamanho - espessura * 2) / 2
  const volta = 2 * Math.PI * raio
  const fracao = Math.max(0, Math.min(1, pct / 100))
  // Um id por anel, só com letras e números (o do React traz sinais que atrapalham o url(#…))
  const id = `anel${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: tamanho, height: tamanho }} role="img" aria-label={`Progresso: ${pct}%`}>
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} className="absolute inset-0 -rotate-90 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={cores[0]} />
            <stop offset="55%" stopColor={cores[1]} />
            <stop offset="100%" stopColor={cores[2]} />
          </linearGradient>
        </defs>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={raio} fill="none" stroke="var(--surface-3)" strokeWidth={espessura} />
        {fracao > 0 ? (
          <circle
            cx={tamanho / 2}
            cy={tamanho / 2}
            r={raio}
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth={espessura}
            strokeLinecap="round"
            strokeDasharray={volta}
            strokeDashoffset={volta * (1 - fracao)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        ) : null}
      </svg>
      <span className="relative text-center leading-none" aria-hidden>
        <span className="tabular block font-display font-semibold text-ink" style={{ fontSize: tamanho >= 100 ? "1.9rem" : tamanho >= 64 ? "1.15rem" : "0.8rem" }}>
          {pct}
          <span className="text-[0.55em] text-ink-2">%</span>
        </span>
        {legenda && tamanho >= 100 ? <span className="rotulo-hud mt-1 block text-[10px]">{legenda}</span> : null}
      </span>
    </span>
  )
}

/** O prazo de um projeto: atrasado em rosa, perto (até 7 dias) em âmbar. */
export function ChipPrazo({ prazo, feito, className }: { prazo: string | null; feito?: boolean; className?: string }) {
  if (!prazo) return null
  const dias = diasAte(prazo)
  const estado = estadoPrazo(dias, feito)
  const atrasado = estado === "atrasado"
  const perto = estado === "perto"
  const texto = atrasado ? `atrasado ${plural(-dias!, "dia")}` : dataRelativa(prazo)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        atrasado ? "bg-danger-soft text-danger" : perto ? "bg-estudos-soft text-estudos" : "text-ink-3",
        className,
      )}
      title={`Prazo: ${prazo.split("-").reverse().join("/")}`}
    >
      <CalendarClock className="size-3.5 shrink-0" aria-hidden />
      {texto}
    </span>
  )
}

/** O estado vazio, num painel de vidro com o ícone aceso (com `comemorar`, a caixa zerada em verde-menta). */
export function VazioCerebro({
  titulo,
  descricao,
  acao,
  comemorar,
  icone,
  className,
}: {
  titulo: string
  descricao?: string
  acao?: ReactNode
  comemorar?: boolean
  icone?: LucideIcon
  className?: string
}) {
  const Icone = icone ?? (comemorar ? Sparkles : BrainCircuit)
  return (
    <div className={cn("vidro relative overflow-hidden px-5 py-10 text-center sm:px-8 sm:py-12", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full hidden"
        style={{ background: comemorar ? "rgb(124 245 196 / 0.18)" : "rgb(182 156 255 / 0.2)" }}
      />
      <span aria-hidden className="icone-aceso relative mx-auto size-14 rounded-2xl" style={{ "--cor": comemorar ? "var(--b-menta)" : "var(--b-luz)" } as CSSProperties}>
        <Icone className="size-6" />
      </span>
      <p className="relative mt-4 font-display text-xl font-semibold">{titulo}</p>
      {descricao ? <p className="relative mx-auto mt-1.5 max-w-md text-sm text-ink-2">{descricao}</p> : null}
      {acao ? <div className="relative mt-5 flex justify-center">{acao}</div> : null}
    </div>
  )
}

/**
 * Um título que quebra linha no celular (um campo de texto cortaria o nome comprido) e vira campo
 * ao tocar nele ou no lápis: Enter ou sair do campo salva, Esc desiste.
 */
export function TituloEditavel({ valor, aoSalvar, rotulo, className }: { valor: string; aoSalvar: (v: string) => void; rotulo: string; className?: string }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(valor)
  useEffect(() => setTexto(valor), [valor])
  const salvar = () => {
    const novo = texto.trim()
    if (novo && novo !== valor.trim()) aoSalvar(novo)
    else setTexto(valor)
    setEditando(false)
  }
  if (editando)
    return (
      <input
        autoFocus
        aria-label={rotulo}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            salvar()
          }
          if (e.key === "Escape") {
            setTexto(valor)
            setEditando(false)
          }
        }}
        className={cn("-mx-2 w-[calc(100%+1rem)] rounded-xl border border-[var(--b-luz)] bg-surface px-2 py-1 focus-visible:outline-none", className)}
      />
    )
  return (
    <div className="group/titulo flex items-start gap-1">
      <h1 className={cn("min-w-0 cursor-text break-words", className)} onClick={() => setEditando(true)}>
        {valor || "Sem título"}
      </h1>
      <button
        type="button"
        onClick={() => setEditando(true)}
        aria-label={rotulo}
        className="mt-1.5 grid size-9 shrink-0 place-items-center rounded-full text-ink-3 transition-opacity hover:bg-ink/[0.06] hover:text-ink focus-visible:opacity-100 sm:opacity-0 sm:group-hover/titulo:opacity-100 toque:opacity-100"
      >
        <Pencil className="size-4" />
      </button>
    </div>
  )
}
