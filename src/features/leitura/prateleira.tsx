"use client"

import Link from "next/link"
import * as React from "react"
import { ArrowRight, ChevronLeft, ChevronRight, Star } from "lucide-react"
import { CapaEmPe } from "./capa"
import type { Livro } from "./dados"
import { fracaoLida, plural } from "./logica"

/** Nome do livro para leitor de tela: título, autor e a situação. */
export function rotuloDoLivro(l: Livro): string {
  const partes = [l.title, l.author ? `de ${l.author}` : null]
  if (l.status === "lendo" || l.status === "pausado") {
    const pct = Math.round(fracaoLida(l) * 100)
    partes.push(l.status === "pausado" ? `pausado em ${pct}%` : `${pct}% lido`)
  }
  if (l.rating) partes.push(`nota ${l.rating} de 5`)
  if (l.favorite) partes.push("favorito")
  return partes.filter(Boolean).join(", ")
}

/** Selos sobre a capa: favorito, nota e o quanto foi lido (pausados e em leitura). */
export function SelosDaCapa({ livro: l }: { livro: Livro }) {
  const pct = l.status === "lendo" || l.status === "pausado" ? Math.round(fracaoLida(l) * 100) : null
  return (
    <>
      {l.favorite ? (
        <span aria-hidden className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/55 text-[var(--b-ambar)] backdrop-blur-sm">
          <Star className="size-3.5 fill-current" />
        </span>
      ) : null}
      {l.rating && l.status === "finalizado" ? (
        <span aria-hidden className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold tabular text-[var(--b-ambar)] backdrop-blur-sm">
          ★ {l.rating}
        </span>
      ) : null}
      {pct !== null && l.pages_total ? (
        <span aria-hidden className="absolute inset-x-1.5 bottom-1.5 h-1 overflow-hidden rounded-full bg-black/55">
          <span className="block h-full rounded-full bg-[var(--b-luz)] shadow-[0_0_8px_var(--b-luz)]" style={{ width: `${pct}%` }} />
        </span>
      ) : null}
    </>
  )
}

/**
 * Uma prateleira: os livros em pé sobre uma faixa de luz, deslizando para o lado. No computador
 * aparecem setas quando há para onde rolar.
 */
export function Prateleira({
  id,
  titulo,
  descricao,
  livros,
  aoVerTudo,
}: {
  id: string
  titulo: string
  descricao?: string
  livros: Livro[]
  aoVerTudo?: () => void
}) {
  const trilho = React.useRef<HTMLUListElement>(null)
  const [setas, setSetas] = React.useState({ voltar: false, avancar: false })

  const medir = React.useCallback(() => {
    const el = trilho.current
    if (!el) return
    const voltar = el.scrollLeft > 4
    const avancar = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setSetas((s) => (s.voltar === voltar && s.avancar === avancar ? s : { voltar, avancar }))
  }, [])

  React.useEffect(() => {
    const el = trilho.current
    if (!el) return
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [medir, livros.length])

  const rolar = (sentido: -1 | 1) => {
    const el = trilho.current
    if (el) el.scrollBy({ left: sentido * el.clientWidth * 0.8 })
  }

  const rotuloId = `prateleira-${id}`
  return (
    <section aria-labelledby={rotuloId} className="min-w-0">
      <div className="mb-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={rotuloId} className="flex items-baseline gap-2 font-display text-xl font-semibold">
            {titulo}
            <span className="tabular text-sm font-normal text-ink-3">{livros.length}</span>
          </h2>
          {descricao ? <p className="text-sm text-ink-3">{descricao}</p> : null}
        </div>
        {aoVerTudo ? (
          <button
            type="button"
            onClick={aoVerTudo}
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium text-[var(--b-luz)] hover:bg-white/[0.06]"
          >
            Ver tudo <ArrowRight className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="relative">
        <div aria-hidden className="prateleira-tabua absolute inset-x-0 bottom-0" />
        <ul
          ref={trilho}
          onScroll={medir}
          className="relative -mx-4 flex snap-x snap-mandatory items-end gap-3.5 overflow-x-auto scroll-smooth px-4 pb-[14px] pt-5 scroll-px-4 [scrollbar-width:none] sm:gap-5 [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-1 lg:scroll-px-1"
        >
          {livros.map((l) => (
            <li key={l.id} className="w-[5.75rem] shrink-0 snap-start sm:w-28 lg:w-[7.5rem]">
              <Link
                href={`/estudos/leitura/${l.id}`}
                aria-label={rotuloDoLivro(l)}
                className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--b-luz)]/60"
              >
                <CapaEmPe livro={l} className="motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:-translate-y-1.5 motion-safe:group-focus-visible:-translate-y-1.5">
                  <SelosDaCapa livro={l} />
                </CapaEmPe>
              </Link>
            </li>
          ))}
        </ul>
        {setas.voltar ? (
          <button
            type="button"
            aria-label={`Voltar em ${titulo}`}
            onClick={() => rolar(-1)}
            className="absolute left-1 top-[45%] z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-[var(--b-fundo)]/85 text-ink backdrop-blur hover:border-[var(--b-luz)] pointer-fine:grid"
          >
            <ChevronLeft aria-hidden />
          </button>
        ) : null}
        {setas.avancar ? (
          <button
            type="button"
            aria-label={`Ver mais em ${titulo}`}
            onClick={() => rolar(1)}
            className="absolute right-1 top-[45%] z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-[var(--b-fundo)]/85 text-ink backdrop-blur hover:border-[var(--b-luz)] pointer-fine:grid"
          >
            <ChevronRight aria-hidden />
          </button>
        ) : null}
      </div>
    </section>
  )
}

/** Um livro na grade do acervo: a capa em pé, o título e uma linha de informação. */
export function LivroNaGrade({ livro: l, info }: { livro: Livro; info?: string }) {
  return (
    <li className="min-w-0">
      <Link href={`/estudos/leitura/${l.id}`} aria-label={rotuloDoLivro(l)} className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--b-luz)]/60">
        <CapaEmPe livro={l} className="motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:-translate-y-1">
          <SelosDaCapa livro={l} />
        </CapaEmPe>
        <span aria-hidden className="mt-2.5 line-clamp-2 block text-sm font-medium leading-snug text-ink">
          {l.title}
        </span>
        {info ?? l.author ? (
          <span aria-hidden className="mt-0.5 block truncate text-xs text-ink-3">
            {info ?? l.author}
          </span>
        ) : null}
      </Link>
    </li>
  )
}

export function contagemLivros(n: number) {
  return plural(n, "livro")
}
