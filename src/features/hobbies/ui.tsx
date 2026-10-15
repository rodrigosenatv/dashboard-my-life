"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { Capa } from "@/features/colecoes/visao-colecao"
import { cn, formatar, normalizar } from "@/lib/utils"
import type { Hobby } from "./logica"

/** Cores da capa sem foto: cada hobby fica sempre com a mesma. */
const ACENTOS = ["bg-petroleo", "bg-rotina", "bg-projetos", "bg-conteudo", "bg-estudos"]

function acento(nome: string): string {
  let h = 0
  for (const c of normalizar(nome)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return ACENTOS[h % ACENTOS.length]
}

function SemFoto({ nome, className }: { nome: string; className?: string }) {
  return (
    <div aria-hidden className={cn("@container relative grid h-full w-full place-items-center overflow-hidden text-white", acento(nome), className)}>
      <span className="select-none font-display text-[clamp(2rem,38cqw,5rem)] font-semibold leading-none opacity-30">{nome.trim().charAt(0).toUpperCase()}</span>
    </div>
  )
}

function FotoPorEndereco({ url, nome, className }: { url: string; nome: string; className?: string }) {
  const [falhou, setFalhou] = React.useState(false)
  if (falhou) return <SemFoto nome={nome} className={className} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFalhou(true)} className={cn("h-full w-full object-cover", className)} />
  )
}

/** A foto do hobby (enviada ou a do Notion) ou, sem foto, uma cor com a inicial. */
export function CapaHobby({ hobby, className }: { hobby: Pick<Hobby, "capa" | "capaUrl" | "nome">; className?: string }) {
  if (hobby.capa) return <Capa caminho={hobby.capa} className={cn("aspect-auto h-full w-full", className)} />
  if (hobby.capaUrl) return <FotoPorEndereco url={hobby.capaUrl} nome={hobby.nome} className={className} />
  return <SemFoto nome={hobby.nome} className={className} />
}

/** Uma bolinha por dia da meta da semana; as feitas ficam cheias. */
export function Bolinhas({ feitas, meta, className }: { feitas: number; meta: number; className?: string }) {
  const total = Math.max(meta, feitas)
  return (
    <span role="img" aria-label={`${feitas} de ${meta} dias nesta semana`} className={cn("inline-flex items-center gap-1", className)}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} aria-hidden className={cn("size-2.5 rounded-full border transition-colors", i < feitas ? "border-pen bg-pen" : "border-line-strong")} />
      ))}
    </span>
  )
}

/** Os sete dias da semana: os que tiveram prática ficam marcados e hoje ganha um contorno. */
export function FaixaSemana({ dias, praticados, hoje, className }: { dias: string[]; praticados: ReadonlySet<string>; hoje: string; className?: string }) {
  return (
    <ol aria-label="Dias desta semana" className={cn("flex gap-1.5", className)}>
      {dias.map((d) => {
        const feito = praticados.has(d)
        const ehHoje = d === hoje
        const futuro = d > hoje
        return (
          <li key={d} aria-label={`${formatar(d, "EEEE, d 'de' MMMM")}: ${feito ? "praticou" : futuro ? "ainda não chegou" : "sem prática"}`} className="flex flex-col items-center gap-1">
            <span aria-hidden className={cn("text-[11px] font-medium uppercase", ehHoje ? "text-ink" : "text-ink-3")}>
              {formatar(d, "EEEEE")}
            </span>
            <span
              aria-hidden
              className={cn(
                "grid size-7 place-items-center rounded-full border text-xs tabular transition-colors",
                feito ? "border-pen bg-pen text-pen-ink" : ehHoje ? "border-pen text-pen" : futuro ? "border-line text-ink-3/60" : "border-line-strong text-ink-3",
              )}
            >
              {feito ? <Check className="size-3.5 animate-marcar" strokeWidth={2.5} /> : formatar(d, "d")}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
