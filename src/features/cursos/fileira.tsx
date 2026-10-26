"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import * as React from "react"
import { ArrowRight, Check, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { CapaCurso } from "./capa"
import { mapaDe, ondeParei, partesDoTitulo, plataformaDoLink, plural, progressoDo, statusDo, STATUS, type Curso } from "./logica"

/** Nome do curso para leitor de tela: nome, situação e onde parou. */
export function rotuloDoCurso(c: Curso): string {
  const partes = [c.name, STATUS[statusDo(c)].rotulo.toLowerCase()]
  const pct = progressoDo(c)
  if (pct !== null && statusDo(c) !== "concluido") partes.push(`${pct}%`)
  const parou = ondeParei(mapaDe(c.notes))
  if (parou && statusDo(c) !== "concluido") partes.push(`parou em ${partesDoTitulo(parou.titulo).nome}`)
  return partes.join(", ")
}

/** A linha de informação do cartão: onde parou, quantas aulas ou onde o curso fica. */
export function infoDoCurso(c: Curso): string {
  const mapa = mapaDe(c.notes)
  const parou = ondeParei(mapa)
  const s = statusDo(c)
  if (parou && s !== "concluido") {
    const p = partesDoTitulo(parou.titulo)
    return `Parou em ${p.numero ? `${p.numero} · ` : ""}${p.nome}`
  }
  const plataforma = plataformaDoLink(c.url)
  const partes = [plataforma && plataforma.id !== "site" && plataforma.id !== "link" ? plataforma.nome : null, mapa.aulas.length ? plural(mapa.aulas.length, "aula anotada", "aulas anotadas") : null]
  return partes.filter(Boolean).join(" · ") || c.categories[0] || ""
}

/** Um curso como miniatura de streaming: a capa 16:9, o nome e uma linha de informação. */
export function CartaoCurso({ curso: c, capa, className }: { curso: Curso; capa?: string; className?: string }) {
  const pct = progressoDo(c)
  const s = statusDo(c)
  return (
    <Link href={`/estudos/cursos/${c.id}`} aria-label={rotuloDoCurso(c)} className={cn("cartao-curso group block focus-visible:outline-none", className)}>
      <span className="relative block aspect-video overflow-hidden rounded-[0.875rem] ring-1 ring-white/10">
        <CapaCurso curso={c} caminho={capa} />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        {s === "concluido" ? (
          <span aria-hidden className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-[var(--b-ambar)] ring-1 ring-[var(--b-ambar)]/40 backdrop-blur-sm">
            <Check className="size-3" /> Concluído
          </span>
        ) : null}
        {pct !== null && s !== "concluido" ? (
          <span aria-hidden className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-black/55">
            <span className="block h-full rounded-full bg-[var(--b-luz)] shadow-[0_0_8px_var(--b-luz)]" style={{ width: `${pct}%` }} />
          </span>
        ) : null}
      </span>
      <span aria-hidden className="mt-2.5 line-clamp-2 block px-0.5 text-sm font-medium leading-snug text-ink group-hover:text-[var(--b-luz)]">
        {c.name}
      </span>
      {infoDoCurso(c) ? (
        <span aria-hidden className="mt-0.5 block truncate px-0.5 text-xs text-ink-3">
          {infoDoCurso(c)}
        </span>
      ) : null}
    </Link>
  )
}

/**
 * Uma fileira de cursos que desliza para o lado, como num streaming. No computador aparecem setas
 * quando há para onde rolar.
 */
export function Fileira({
  id,
  titulo,
  descricao,
  cursos,
  capas,
  aoVerTudo,
}: {
  id: string
  titulo: string
  descricao?: string
  cursos: Curso[]
  capas: Map<string, string> | undefined
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
  }, [medir, cursos.length])

  const rolar = (sentido: -1 | 1) => {
    const el = trilho.current
    if (el) el.scrollBy({ left: sentido * el.clientWidth * 0.8 })
  }

  if (!cursos.length) return null
  const rotuloId = `fileira-${id}`
  return (
    <section aria-labelledby={rotuloId} className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={rotuloId} className="flex items-baseline gap-2 font-display text-xl font-semibold">
            {titulo}
            <span className="tabular text-sm font-normal text-ink-3">{cursos.length}</span>
          </h2>
          {descricao ? <p className="text-sm text-ink-3">{descricao}</p> : null}
        </div>
        {aoVerTudo ? (
          <button type="button" onClick={aoVerTudo} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium text-[var(--b-luz)] hover:bg-white/[0.06]">
            Ver tudo <ArrowRight className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="relative">
        <ul
          ref={trilho}
          onScroll={medir}
          className="-mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-smooth px-4 pb-2 pt-1 scroll-px-4 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-1 lg:scroll-px-1"
        >
          {cursos.map((c) => (
            <li key={c.id} className="w-[13.5rem] shrink-0 snap-start sm:w-[15.5rem] lg:w-[16.5rem]">
              <CartaoCurso curso={c} capa={capas?.get(c.id)} />
            </li>
          ))}
        </ul>
        {setas.voltar ? (
          <button
            type="button"
            aria-label={`Voltar em ${titulo}`}
            onClick={() => rolar(-1)}
            className="absolute left-1 top-[38%] z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-[var(--b-fundo)]/85 text-ink backdrop-blur hover:border-[var(--b-luz)] pointer-fine:grid"
          >
            <ChevronLeft aria-hidden />
          </button>
        ) : null}
        {setas.avancar ? (
          <button
            type="button"
            aria-label={`Ver mais em ${titulo}`}
            onClick={() => rolar(1)}
            className="absolute right-1 top-[38%] z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-[var(--b-fundo)]/85 text-ink backdrop-blur hover:border-[var(--b-luz)] pointer-fine:grid"
          >
            <ChevronRight aria-hidden />
          </button>
        ) : null}
      </div>
    </section>
  )
}
