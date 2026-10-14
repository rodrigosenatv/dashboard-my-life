"use client"

import * as React from "react"
import {
  BedDouble,
  Bus,
  Camera,
  CarFront,
  MapPin,
  Plane,
  Receipt,
  Route,
  Ship,
  ShoppingBag,
  Ticket,
  TrainFront,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react"
import { Campo, Seletor } from "@/components/ui/campos"
import { Capa } from "@/features/colecoes/visao-colecao"
import { cn, formatar, normalizar } from "@/lib/utils"
import type { Parada, TipoGasto, TipoParada, Viagem } from "./logica"

export const ICONE_TIPO_PARADA: Record<TipoParada, LucideIcon> = {
  transporte: Route,
  hospedagem: BedDouble,
  passeio: Camera,
  restaurante: UtensilsCrossed,
  outro: MapPin,
}

const ICONES_TRANSPORTE = { aviao: Plane, onibus: Bus, carro: CarFront, barco: Ship, trem: TrainFront, outro: Route } satisfies Record<string, LucideIcon>

/** No transporte, o ícone segue o meio: avião, ônibus, carro, barco ou trem. */
function meioDeTransporte(p: Pick<Parada, "titulo" | "categoria">): keyof typeof ICONES_TRANSPORTE {
  const n = normalizar(`${p.titulo} ${p.categoria}`)
  if (/\b(voo|aviao|aeroporto|embarque)\b/.test(n)) return "aviao"
  if (/\b(onibus|rodoviaria)\b/.test(n)) return "onibus"
  if (/\b(carro|uber|taxi|transfer|99)\b/.test(n)) return "carro"
  if (/\b(barco|balsa|ferry|lancha|catamara)\b/.test(n)) return "barco"
  if (/\b(trem|metro)\b/.test(n)) return "trem"
  return "outro"
}

/** O ícone de um item do roteiro. */
export function IconeParada({ parada, className }: { parada: Pick<Parada, "tipo" | "titulo" | "categoria">; className?: string }) {
  const Icone = parada.tipo === "transporte" ? ICONES_TRANSPORTE[meioDeTransporte(parada)] : ICONE_TIPO_PARADA[parada.tipo]
  return <Icone className={className} aria-hidden />
}

export const ICONE_GASTO: Record<TipoGasto, LucideIcon> = {
  transporte: Route,
  hospedagem: BedDouble,
  alimentacao: UtensilsCrossed,
  passeios: Ticket,
  compras: ShoppingBag,
  outros: Receipt,
}

export function IconeGasto({ tipo, className }: { tipo: TipoGasto; className?: string }) {
  const Icone = ICONE_GASTO[tipo]
  return <Icone className={className} aria-hidden />
}

/** A foto da viagem ou, sem foto, o azul petróleo da capa do caderno com o avião. */
export function CapaViagem({ viagem, className }: { viagem: Pick<Viagem, "capa" | "nome">; className?: string }) {
  if (viagem.capa) return <Capa caminho={viagem.capa} className={cn("aspect-auto h-full w-full", className)} />
  return (
    <div aria-hidden className={cn("@container relative grid h-full w-full place-items-center overflow-hidden bg-petroleo text-petroleo-tinta", className)}>
      <Plane className="size-[clamp(1.5rem,14cqw,2.75rem)] opacity-30" strokeWidth={1.5} />
      <span className="pointer-events-none absolute -bottom-[0.18em] -right-[0.04em] select-none font-display text-[clamp(3rem,38cqw,8rem)] font-semibold leading-none opacity-[0.07]">
        {viagem.nome.trim().charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

/** Escolha de uma opção em pílulas (tipo do item, categoria do gasto). */
export function EscolhaPilulas<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
  icones,
}: {
  opcoes: { id: T; rotulo: string }[]
  valor: T
  aoMudar: (v: T) => void
  rotulo: string
  icones?: Partial<Record<string, LucideIcon>>
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const ativo = o.id === valor
        const Icone: LucideIcon | undefined = icones?.[o.id]
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => aoMudar(o.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors toque:min-h-10",
              ativo ? "border-pen bg-pen/15 text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
            )}
          >
            {Icone ? <Icone className="size-3.5" aria-hidden /> : null}
            {o.rotulo}
          </button>
        )
      })}
    </div>
  )
}

/** Campo de valor em reais: aceita "1.234,56", "25,5" ou "25.50". */
export function CampoReais({ className, ...props }: Omit<React.ComponentProps<"input">, "type" | "inputMode">) {
  return (
    <div className={cn("relative", className)}>
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">
        R$
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-sm text-ink tabular placeholder:text-ink-3 transition-colors focus-visible:border-pen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen/25 toque:h-11 toque:text-[16px]"
        {...props}
      />
    </div>
  )
}

/** Valor para mostrar num campo de reais ("1234.5" → "1234,50"). */
export const valorNoCampo = (n: number | null | undefined) => (n === null || n === undefined ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2, useGrouping: false }))

/** Em que viagem o item está: dá para mover para outra ou deixar sem viagem. */
export function EscolherViagem({ id, valor, aoMudar, viagens }: { id: string; valor: string; aoMudar: (v: string) => void; viagens: Viagem[] }) {
  const ordenadas = [...viagens].sort((a, b) => (b.ida ?? "9999").localeCompare(a.ida ?? "9999"))
  return (
    <Campo rotulo="Viagem" htmlFor={id}>
      <Seletor id={id} value={valor} onChange={(e) => aoMudar(e.target.value)}>
        {ordenadas.map((v) => (
          <option key={v.id} value={v.id}>
            {v.nome}
            {v.ida ? ` · ${formatar(v.ida, "MMM yyyy")}` : " · sem data"}
          </option>
        ))}
        <option value="">Sem viagem</option>
      </Seletor>
    </Campo>
  )
}
