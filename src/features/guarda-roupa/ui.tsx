"use client"

import * as React from "react"
import { Footprints, Layers, Shirt, Watch } from "lucide-react"
import { useUrlArquivo } from "@/lib/arquivos"
import { cn, normalizar } from "@/lib/utils"
import { corDaCor, type Peca } from "./logica"

/** Tipos que pedem o ícone de calçado (o resto usa a camiseta, e relógio tem o seu). */
const CALCADOS = ["tenis", "sapato", "chinelo", "meia"]

/** O ícone do tipo da peça: só aparece quando a peça não tem foto. */
export function IconeDoTipo({ tipo, className }: { tipo: string | null; className?: string }) {
  const t = normalizar(tipo)
  const Icone = CALCADOS.includes(t) ? Footprints : t === "relogio" ? Watch : Shirt
  return <Icone aria-hidden className={className} />
}

/** Sem foto: um fundo liso com o ícone do tipo. */
function SemFoto({ tipo, className }: { tipo: string | null; className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-full place-items-center bg-surface-2", className)}>
      <IconeDoTipo tipo={tipo} className="size-10 text-ink-3" />
    </span>
  )
}

/**
 * A foto de uma peça: a do storage (com link temporário), a da internet ou, sem foto, o ícone do tipo.
 * Enquanto o link do storage chega, um bloco cinza pulsando no lugar.
 */
export function FotoPeca({ peca, contain = false, className, alt = "" }: { peca: Pick<Peca, "tipo" | "foto" | "fotoUrl">; contain?: boolean; className?: string; alt?: string }) {
  const arquivo = useUrlArquivo(peca.foto)
  const [falhou, setFalhou] = React.useState<string | null>(null)
  const src = peca.foto ? (arquivo.data ?? null) : peca.fotoUrl

  if (peca.foto && arquivo.isError) return <SemFoto tipo={peca.tipo} className={className} />
  if (!src) {
    return peca.foto ? (
      <span aria-hidden className={cn("block size-full animate-pulse bg-surface-2", className)} />
    ) : (
      <SemFoto tipo={peca.tipo} className={className} />
    )
  }
  if (falhou === src) return <SemFoto tipo={peca.tipo} className={className} />
  // Foto por endereço da internet vai sem o endereço da página (alguns sites bloqueiam quem vem de outro lugar)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy={peca.foto ? undefined : "no-referrer"}
      onError={() => setFalhou(src)}
      className={cn("size-full", contain ? "object-contain" : "object-cover", className)}
    />
  )
}

/** A bolinha da cor (decorativa). Cor desconhecida não mostra nada. */
export function CorBolinha({ cor }: { cor: string }) {
  const hex = corDaCor(cor)
  if (!hex) return null
  // O contorno é do tema: preto no escuro e branco no claro continuam visíveis
  return <span aria-hidden className="inline-block size-3 shrink-0 rounded-full ring-1 ring-line-strong" style={{ backgroundColor: hex }} />
}

/** Um rótulo e o valor dele numa lista de detalhes. */
export function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{rotulo}</dt>
      <dd className="text-ink">{children}</dd>
    </>
  )
}

const PILULA = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors toque:min-h-11"
const PILULA_ATIVA = "border-pen bg-pen/15 text-ink"
const PILULA_INATIVA = "border-line text-ink-2 hover:border-line-strong hover:text-ink"

/** Escolha de várias opções em pílulas (cores, lugares, horas, climas). */
export function EscolhaVarias({
  rotulo,
  opcoes,
  valores,
  aoMudar,
  comCor = false,
}: {
  rotulo: string
  opcoes: string[]
  valores: string[]
  aoMudar: (v: string[]) => void
  comCor?: boolean
}) {
  const alternar = (opcao: string) => aoMudar(valores.includes(opcao) ? valores.filter((v) => v !== opcao) : [...valores, opcao])
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const ativa = valores.includes(o)
        return (
          <button key={o} type="button" aria-pressed={ativa} onClick={() => alternar(o)} className={cn(PILULA, ativa ? PILULA_ATIVA : PILULA_INATIVA)}>
            {comCor ? <CorBolinha cor={o} /> : null}
            {o}
          </button>
        )
      })}
    </div>
  )
}

/** Filtro de uma lista por tipo ou lugar: uma linha que rola para o lado, com a contagem em cada opção. */
export function FiltroChips({
  rotulo,
  todos,
  opcoes,
  valor,
  aoMudar,
}: {
  rotulo: string
  todos: { rotulo: string; n: number }
  opcoes: { valor: string; n: number }[]
  valor: string | null
  aoMudar: (v: string | null) => void
}) {
  const chip = (ativo: boolean) =>
    cn("shrink-0 rounded-full border px-3 py-1 text-sm toque:min-h-11", ativo ? PILULA_ATIVA : PILULA_INATIVA)
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-0"
    >
      <button type="button" role="radio" aria-checked={valor === null} onClick={() => aoMudar(null)} className={chip(valor === null)}>
        {todos.rotulo} <span className="tabular text-ink-3">{todos.n}</span>
      </button>
      {opcoes.map((o) => (
        <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor} onClick={() => aoMudar(o.valor)} className={chip(valor === o.valor)}>
          {o.valor} <span className="tabular text-ink-3">{o.n}</span>
        </button>
      ))}
    </div>
  )
}

const COLAGEM = "grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line"

/** A colagem do outfit: até quatro peças, dispostas conforme a quantidade. Sem peças, um aviso. */
export function ColagemOutfit({ pecas, className }: { pecas: Peca[]; className?: string }) {
  const fotos = pecas.slice(0, 4)
  if (fotos.length === 0) {
    return (
      <span className={cn(COLAGEM, className)}>
        <span className="col-span-2 row-span-2 grid place-items-center content-center gap-2 text-sm text-ink-3">
          <Layers aria-hidden className="size-6" />
          Sem peças
        </span>
      </span>
    )
  }
  const n = fotos.length
  return (
    <span className={cn(COLAGEM, className)}>
      {fotos.map((p, i) => (
        <span
          key={p.id}
          className={cn(
            "relative min-h-0",
            n === 1 && "col-span-2 row-span-2",
            n === 2 && "row-span-2",
            n === 3 && i === 0 && "row-span-2",
          )}
        >
          <FotoPeca peca={p} className="absolute inset-0" />
        </span>
      ))}
    </span>
  )
}
