"use client"

import Link from "next/link"
import * as React from "react"
import { addDays, format, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Check } from "lucide-react"
import { Esqueleto } from "@/components/ui/basicos"
import { cn, isoDia, plural } from "@/lib/utils"
import { sequencia, useAlternarHabito, valeNoDia, type Habito, type RegistroHabito } from "@/features/habitos/dados"
import { useHabitoTreino } from "./dados"

const LETRAS = ["S", "T", "Q", "Q", "S", "S", "D"] // segunda a domingo
const SEMANAS = 12
const ALTURA = 72 // px da área das barras

const noDia = (iso: string) => new Date(`${iso}T12:00`)

/**
 * A semana de treinos, a partir do hábito Treino (o mesmo marcador da tela de Hábitos).
 * Fica dentro do cartão "Hoje"; tocar num dia marca ou desmarca, para treinos sem registro.
 */
export function SemanaTreino() {
  const { habito, dias, carregando } = useHabitoTreino()
  const alternar = useAlternarHabito()
  const hoje = isoDia()

  if (carregando) return <Esqueleto className="h-24" />
  if (!habito)
    return (
      <p className="text-sm text-ink-2">
        Para ver a semana aqui, crie o hábito Treino em{" "}
        <Link href="/rotina/habitos" className="font-medium text-pen hover:underline">
          Hábitos
        </Link>
        .
      </p>
    )

  const inicio = startOfWeek(new Date(), { weekStartsOn: 1 })
  const semana = Array.from({ length: 7 }, (_, i) => isoDia(addDays(inicio, i)))
  const feitos = semana.filter((d) => dias?.has(d)).length
  const previstos = semana.filter((d) => valeNoDia(habito, d)).length
  const seq = sequencia(habito, dias, hoje)
  const temDescanso = (habito.weekdays?.length || 7) < 7
  const marcar = (dia: string) => alternar.mutate({ habito: habito.id, dia, registro: dias?.get(dia) })

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm">
          <span className="font-semibold">Esta semana:</span> {feitos} de {plural(previstos, "treino")}
          {seq > 1 ? <span className="text-ink-3"> · {seq} seguidos</span> : null}
        </p>
        <Link href="/rotina/habitos" className="text-sm text-ink-2 hover:text-ink">
          Ver hábitos
        </Link>
      </div>

      <ol aria-label="Dias desta semana" className="mt-3 grid grid-cols-7 gap-1">
        {semana.map((d, i) => {
          const registro = dias?.get(d)
          const futuro = d > hoje
          const previsto = valeNoDia(habito, d)
          const ehHoje = d === hoje
          const data = noDia(d)
          return (
            <li key={d}>
              <button
                type="button"
                disabled={futuro}
                aria-pressed={Boolean(registro)}
                aria-label={`${format(data, "EEEE, d 'de' MMMM", { locale: ptBR })}${registro ? ", treinou" : previsto ? "" : ", descanso"}`}
                onClick={() => marcar(d)}
                className="group flex w-full flex-col items-center gap-1.5 rounded-lg py-1.5 disabled:cursor-default"
              >
                <span className={cn("text-xs", ehHoje ? "font-semibold text-ink" : "text-ink-3")}>{LETRAS[i]}</span>
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-full border text-sm transition-colors",
                    registro
                      ? "border-pen bg-pen text-pen-ink"
                      : ehHoje
                        ? "border-2 border-pen text-ink"
                        : previsto
                          ? "border-line-strong text-ink-2"
                          : "border-dashed border-line-strong text-ink-3",
                    futuro ? "opacity-45" : !registro && "group-hover:border-pen",
                  )}
                >
                  {registro ? <Check className="size-4 animate-marcar" strokeWidth={2.5} /> : <span className="tabular">{data.getDate()}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-xs text-ink-3">
        {temDescanso ? "Tracejado: dia sem treino previsto. " : ""}Treinou sem registrar? Toque no dia para marcar.
      </p>

      <UltimasSemanas habito={habito} dias={dias} />
    </div>
  )
}

/** Treinos por semana nas últimas 12 semanas, com a meta da semana. */
function UltimasSemanas({ habito, dias }: { habito: Habito; dias: Map<string, RegistroHabito> | undefined }) {
  const atual = startOfWeek(new Date(), { weekStartsOn: 1 })
  const semanas = Array.from({ length: SEMANAS }, (_, i) => {
    const inicio = addDays(atual, -7 * (SEMANAS - 1 - i))
    const dsem = Array.from({ length: 7 }, (_, j) => isoDia(addDays(inicio, j)))
    return { inicio, feitos: dsem.filter((d) => dias?.has(d)).length, ehAtual: i === SEMANAS - 1 }
  })
  // Com menos de 3 semanas marcadas o gráfico seria quase só vazio: a faixa da semana basta
  if (semanas.filter((s) => s.feitos > 0).length < 3) return null

  const meta = habito.weekdays?.length || 7
  const maximo = Math.max(meta, ...semanas.map((s) => s.feitos))
  const altura = (n: number) => Math.round((n / maximo) * ALTURA)
  // A média conta das semanas desde a primeira marcada até a última fechada (a atual ainda não acabou)
  const fechadas = semanas.slice(semanas.findIndex((s) => s.feitos > 0), -1)
  const media = fechadas.length >= 2 ? fechadas.reduce((s, x) => s + x.feitos, 0) / fechadas.length : null

  return (
    <figure className="mt-6 border-t border-line pt-4">
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-medium">Treinos por semana</span>
        {media !== null ? <span className="text-ink-3">média de {media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por semana</span> : null}
      </figcaption>
      <div className="relative" style={{ height: ALTURA + 16 }}>
        {/* Linha da meta: traço fino e contínuo; o rótulo fica na margem da direita, longe das barras */}
        <div aria-hidden className="absolute inset-x-0 border-t border-ink-3/45" style={{ bottom: altura(meta) }}>
          <span className="absolute -top-2 right-0 w-11 bg-surface text-right text-[11px] leading-4 text-ink-3">meta {meta}</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 border-t border-line" aria-hidden />
        <ol className="absolute inset-y-0 left-0 right-12 flex items-end gap-1" aria-label={`Treinos por semana, últimas ${SEMANAS} semanas`}>
          {semanas.map((s) => {
            const h = altura(s.feitos)
            const periodo = `${format(s.inicio, "d MMM", { locale: ptBR })} a ${format(addDays(s.inicio, 6), "d MMM", { locale: ptBR })}`
            return (
              <li
                key={s.inicio.toISOString()}
                tabIndex={0}
                aria-label={`${s.ehAtual ? "Esta semana" : `Semana de ${periodo}`}: ${plural(s.feitos, "treino")}`}
                className="group relative flex h-full flex-1 justify-center rounded-sm outline-offset-1"
              >
                {s.feitos ? (
                  <>
                    <span className="absolute w-full text-center text-[11px] leading-4 text-ink-2 tabular" style={{ bottom: h + 2 }}>
                      {s.feitos}
                    </span>
                    <span
                      className={cn("absolute bottom-0 w-full max-w-6 rounded-t-[4px] bg-pen transition-opacity", !s.ehAtual && "opacity-60 group-hover:opacity-100 group-focus-visible:opacity-100")}
                      style={{ height: h }}
                    />
                  </>
                ) : null}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-overlay group-hover:block group-focus-visible:block"
                  style={{ bottom: h + 20 }}
                >
                  <strong className="font-semibold text-ink">{plural(s.feitos, "treino")}</strong>
                  <span className="block text-ink-3">{s.ehAtual ? "esta semana" : periodo}</span>
                </span>
              </li>
            )
          })}
        </ol>
      </div>
      <div aria-hidden className="mr-12 mt-1.5 flex justify-between text-[11px] text-ink-3">
        <span>{format(semanas[0].inicio, "d MMM", { locale: ptBR })}</span>
        <span>esta semana</span>
      </div>
    </figure>
  )
}
