"use client"

import { Brain, Cog, FlaskConical, Lightbulb, Repeat2, Rocket, Wrench, type LucideIcon } from "lucide-react"
import { cn, formatar } from "@/lib/utils"
import { RESULTADOS, type ResultadoExp } from "./logica"

const ICONES_TIPO: Record<string, LucideIcon> = {
  Hábito: Repeat2,
  Técnica: Brain,
  Ferramenta: Wrench,
  Processo: Cog,
  Metodologia: FlaskConical,
  Ideia: Lightbulb,
  "Projeto curto": Rocket,
}

export function iconeDoTipo(tipo: string | null | undefined): LucideIcon {
  return (tipo && ICONES_TIPO[tipo]) || FlaskConical
}

export function IconeTipo({ tipo, className }: { tipo: string | null | undefined; className?: string }) {
  const Icone = (tipo && ICONES_TIPO[tipo]) || FlaskConical
  return <Icone className={className} aria-hidden />
}

/** O anel de luz com o dia do teste ("Dia 5 de 7"); sem prazo, o anel fica cheio e mostra os dias. */
export function AnelDias({ dia, total, tamanho = 112, bolhas = false }: { dia: number; total: number | null; tamanho?: number; bolhas?: boolean }) {
  const raio = (tamanho - 12) / 2
  const volta = 2 * Math.PI * raio
  const fracao = total ? Math.min(1, dia / total) : 1
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} className="anel-lab absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={raio} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke="var(--b-luz)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={volta}
          strokeDashoffset={volta * (1 - fracao)}
        />
      </svg>
      {bolhas ? (
        <span aria-hidden className="pointer-events-none absolute inset-[22%] overflow-hidden rounded-full">
          <span className="bolha left-[30%]" style={{ animationDelay: "0s" }} />
          <span className="bolha left-[55%] size-1" style={{ animationDelay: "1.1s" }} />
          <span className="bolha left-[42%] size-1.5" style={{ animationDelay: "2.2s" }} />
        </span>
      ) : null}
      <span className="relative text-center leading-none">
        <span className="rotulo-hud block text-[10px]">Dia</span>
        <span className="tabular mt-1 block font-display text-3xl font-semibold text-[var(--b-luz)]" style={{ fontSize: tamanho < 90 ? "1.4rem" : undefined }}>
          {dia}
        </span>
        {total ? <span className="tabular mt-1 block text-xs text-ink-3">de {total}</span> : null}
      </span>
    </span>
  )
}

/** A faixa de sensor: um traço por dia do teste, aceso nos dias com registro no diário. */
export function FaixaDias({ dias, registrados, hoje, className }: { dias: string[]; registrados: Set<string>; hoje: string; className?: string }) {
  if (!dias.length) return null
  const feitos = dias.filter((d) => d <= hoje && registrados.has(d)).length
  const ate = dias.filter((d) => d <= hoje).length
  return (
    <div className={className}>
      <div className="faixa-sensor" role="img" aria-label={`${feitos} de ${ate} dias com registro no diário`}>
        {dias.map((d) => (
          <span key={d} title={formatar(d, "EEE, d 'de' MMM")} data-registro={registrados.has(d) ? "" : undefined} data-hoje={d === hoje ? "" : undefined} data-futuro={d > hoje ? "" : undefined} />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-ink-3">
        {feitos} de {ate} {ate === 1 ? "dia registrado" : "dias registrados"}
      </p>
    </div>
  )
}

const COR_RESULTADO: Record<ResultadoExp, string> = {
  funcionou: "border-[var(--b-luz)]/50 bg-[var(--b-luz)]/12 text-[var(--b-luz)]",
  parcial: "border-[var(--b-ambar)]/50 bg-[var(--b-ambar)]/12 text-[var(--b-ambar)]",
  nao_funcionou: "border-[var(--b-rosa)]/50 bg-[var(--b-rosa)]/12 text-[var(--b-rosa)]",
  indefinido: "border-[var(--b-borda-2)] bg-ink/[0.04] text-ink-2",
}

/** O selo do resultado (Funcionou, Parcial, Não funcionou). */
export function SeloResultado({ resultado, className }: { resultado: ResultadoExp; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", COR_RESULTADO[resultado], className)}>{RESULTADOS[resultado]}</span>
}
