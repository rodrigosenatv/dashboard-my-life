"use client"

import * as React from "react"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Cartaz } from "./ui"
import { rotuloDoTitulo, textoProgresso, type Titulo } from "./logica"

/**
 * Uma faixa de cartazes que desliza para o lado. No celular o dedo rola; no computador aparecem setas
 * nas laterais, só quando há para onde rolar.
 */
export function Fileira({ id, titulo, itens, aoAbrir }: { id: string; titulo: string; itens: Titulo[]; aoAbrir: (t: Titulo) => void }) {
  const faixa = React.useRef<HTMLUListElement>(null)
  const [setas, setSetas] = React.useState({ voltar: false, avancar: false })

  const medir = React.useCallback(() => {
    const el = faixa.current
    if (!el) return
    const voltar = el.scrollLeft > 4
    const avancar = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setSetas((s) => (s.voltar === voltar && s.avancar === avancar ? s : { voltar, avancar }))
  }, [])

  // Mede de novo quando a janela muda de tamanho ou quando a lista muda
  React.useEffect(() => {
    const el = faixa.current
    if (!el) return
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [medir, itens.length])

  const rolar = (sentido: -1 | 1) => {
    const el = faixa.current
    if (el) el.scrollBy({ left: sentido * el.clientWidth * 0.8 })
  }

  const rotuloId = `fileira-${id}`
  return (
    <section aria-labelledby={rotuloId} className="min-w-0">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 id={rotuloId} className="font-display text-lg font-semibold">
          {titulo}
        </h2>
        <span className="text-sm text-ink-3">{itens.length}</span>
      </div>
      <div className="relative">
        <ul
          ref={faixa}
          onScroll={medir}
          className="flex snap-x snap-mandatory scroll-smooth gap-3 overflow-x-auto pb-2 -mx-4 px-4 scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-0 lg:scroll-px-0"
        >
          {itens.map((t) => (
            <CartaoTitulo key={t.id} titulo={t} aoAbrir={aoAbrir} />
          ))}
        </ul>
        {setas.voltar ? (
          <button
            type="button"
            aria-label={`Voltar em ${titulo}`}
            onClick={() => rolar(-1)}
            className="absolute left-2 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-surface text-ink shadow-overlay ring-1 ring-line hover:bg-surface-2 pointer-fine:grid"
          >
            <ChevronLeft aria-hidden />
          </button>
        ) : null}
        {setas.avancar ? (
          <button
            type="button"
            aria-label={`Ver mais em ${titulo}`}
            onClick={() => rolar(1)}
            className="absolute right-2 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-surface text-ink shadow-overlay ring-1 ring-line hover:bg-surface-2 pointer-fine:grid"
          >
            <ChevronRight aria-hidden />
          </button>
        ) : null}
      </div>
    </section>
  )
}

/** Um título na faixa (ou na grade da busca): o cartaz com os selos e, embaixo, o nome. */
export function CartaoTitulo({ titulo: t, aoAbrir, largura = "fileira" }: { titulo: Titulo; aoAbrir: (t: Titulo) => void; largura?: "fileira" | "grade" }) {
  const progresso = textoProgresso(t)
  return (
    <li className={cn("snap-start", largura === "fileira" ? "w-28 shrink-0 sm:w-32 lg:w-36" : "min-w-0")}>
      <button
        type="button"
        aria-label={rotuloDoTitulo(t)}
        onClick={() => aoAbrir(t)}
        className="group block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen/50"
      >
        <span className="relative block aspect-[2/3] overflow-hidden rounded-lg bg-surface-2 shadow-sm ring-1 ring-line motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-[1.04]">
          <Cartaz titulo={t} />
          {t.plataforma ? (
            <span aria-hidden className="absolute left-1.5 top-1.5 max-w-[70%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white">
              {t.plataforma}
            </span>
          ) : null}
          {t.assistido ? (
            <span aria-hidden className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white">
              <Check className="size-3.5" />
            </span>
          ) : null}
          {t.nota !== null ? (
            <span aria-hidden className={cn("absolute left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white", progresso ? "bottom-8" : "bottom-1.5")}>
              ★ {t.nota}
            </span>
          ) : null}
          {progresso ? <span aria-hidden className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-[11px] font-medium text-white">{progresso}</span> : null}
        </span>
        <span aria-hidden className="mt-1.5 line-clamp-2 block text-sm font-medium leading-snug text-ink">
          {t.nome}
        </span>
      </button>
    </li>
  )
}
