"use client"

import * as React from "react"
import { Check, GlassWater } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Secao } from "@/components/ui/basicos"
import { cn, isoDia } from "@/lib/utils"
import { diaVazio, litros, situacaoAgua, type ConfigAlimentacao, type Dia } from "./dados"

/** O relógio de minuto em minuto, para a situação dos marcos andar sozinha. */
function useMinuto() {
  const [agora, setAgora] = React.useState(() => new Date())
  React.useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 60_000)
    const aoVoltar = () => setAgora(new Date())
    document.addEventListener("visibilitychange", aoVoltar)
    return () => {
      window.clearInterval(t)
      document.removeEventListener("visibilitychange", aoVoltar)
    }
  }, [])
  return agora
}

/** Água do dia: copos de 250 ou 500 ml, a meta e os marcos do plano (1 L até 10h…). */
export function AguaDoDia({ dias, dia, config, aoMudar }: { dias: Map<string, Dia>; dia: string; config: ConfigAlimentacao; aoMudar: (dia: string, mudar: (d: Dia) => Dia) => void }) {
  const agora = useMinuto()
  const total = (dias.get(dia) ?? diaVazio(dia)).agua
  const meta = config.aguaMeta
  const ehHoje = dia === isoDia(agora)
  const situacao = ehHoje ? situacaoAgua(total, config, agora) : total >= meta ? { tipo: "meta" as const, texto: "Meta batida" } : { tipo: "falta" as const, texto: `Ficaram faltando ${litros(meta - total)}` }
  const somar = (ml: number) => {
    aoMudar(dia, (d) => ({ ...d, agua: Math.max(0, d.agua + ml) }))
    navigator.vibrate?.(10)
  }
  const pct = Math.min(100, (total / meta) * 100)

  return (
    <Secao titulo="Água">
      <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p>
            <span className="text-2xl font-semibold">{litros(total)}</span>
            <span className="text-sm text-ink-2"> de {litros(meta)}</span>
          </p>
          <GlassWater className="size-5 text-ink-3" aria-hidden />
        </div>

        <div className="relative mt-3 pb-5">
          <div role="progressbar" aria-label="Água do dia" aria-valuemin={0} aria-valuemax={meta} aria-valuenow={total} aria-valuetext={`${litros(total)} de ${litros(meta)}`} className="h-3 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-pen transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          {config.marcos
            .filter((m) => m.ml < meta)
            .map((m) => {
              const pos = (m.ml / meta) * 100
              return (
                <div key={m.hora} aria-hidden className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${pos}%` }}>
                  <span className={cn("h-3 w-0.5", total >= m.ml ? "bg-pen-ink/60" : "bg-ink-3/50")} />
                  <span className="mt-0.5 text-[11px] leading-4 text-ink-3 tabular">{m.hora}h</span>
                </div>
              )
            })}
        </div>

        <p className={cn("flex items-center gap-1.5 text-sm", situacao.tipo === "atrasado" ? "font-medium text-warning" : situacao.tipo === "meta" ? "font-medium text-ink" : "text-ink-2")} aria-live="polite">
          {situacao.tipo === "meta" ? <Check className="size-4 text-pen" /> : null}
          {situacao.texto}
        </p>

        <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
          <Botao variante="secundario" className="h-11" onClick={() => somar(250)}>
            + 250 ml
          </Botao>
          <Botao variante="secundario" className="h-11" onClick={() => somar(500)}>
            + 500 ml
          </Botao>
          <Botao variante="fantasma" className="h-11" disabled={total <= 0} aria-label="Tirar 250 ml" onClick={() => somar(-250)}>
            − 250
          </Botao>
        </div>
      </div>
    </Secao>
  )
}
