"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import * as React from "react"
import { ArrowUpRight, NotebookPen, Radar, Route } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CapaCurso, IconePlataforma } from "./capa"
import { linkDoCurso, mapaDe, ondeParei, partesDoTitulo, plataformaDoLink, plural, progressoDo, type Curso } from "./logica"

/**
 * "Estudando agora": o curso numa tela de luz, onde a pessoa parou, as ações por fazer e o caminho de
 * volta para a plataforma. Com mais de um curso em andamento, os cartões deslizam para o lado.
 */
export function EstudandoAgora({
  cursos,
  capas,
  aoAnotar,
  aoEscolher,
  temFila,
}: {
  cursos: Curso[]
  capas: Map<string, string> | undefined
  aoAnotar: (c: Curso) => void
  aoEscolher: () => void
  temFila: boolean
}) {
  const trilho = React.useRef<HTMLUListElement>(null)
  const [atual, setAtual] = React.useState(0)

  React.useEffect(() => {
    const el = trilho.current
    if (!el || cursos.length < 2) return
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) if (e.isIntersecting) setAtual(Number((e.target as HTMLElement).dataset.indice))
      },
      { root: el, threshold: 0.6 },
    )
    for (const li of Array.from(el.children)) observador.observe(li)
    return () => observador.disconnect()
  }, [cursos.length])

  if (!cursos.length) return <SemCurso aoEscolher={aoEscolher} temFila={temFila} />

  const ir = (i: number) => {
    const el = trilho.current?.children[i] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" })
  }

  return (
    <section aria-label="Estudando agora" className="min-w-0">
      <ul
        ref={trilho}
        className={cn(
          "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 scroll-px-4 [scrollbar-width:none] lg:mx-0 lg:px-0 lg:scroll-px-0 [&::-webkit-scrollbar]:hidden",
          cursos.length === 1 && "overflow-visible",
        )}
      >
        {cursos.map((c, i) => (
          <li key={c.id} data-indice={i} className={cn("snap-start", cursos.length > 1 ? "w-[90%] shrink-0 sm:w-[86%] lg:w-[90%]" : "w-full")}>
            <CartaoDestaque curso={c} capa={capas?.get(c.id)} aoAnotar={() => aoAnotar(c)} prioridade={i === 0} />
          </li>
        ))}
      </ul>
      {cursos.length > 1 ? (
        <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="Cursos em andamento">
          {cursos.map((c, i) => (
            <button key={c.id} type="button" role="tab" aria-selected={i === atual} aria-label={c.name} onClick={() => ir(i)} className="grid h-6 place-items-center px-1 toque:h-8">
              <span className={cn("block h-1.5 rounded-full transition-all", i === atual ? "w-6 bg-[var(--b-luz)] shadow-[0_0_8px_var(--b-luz)]" : "w-1.5 bg-white/25")} />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function CartaoDestaque({ curso: c, capa, aoAnotar, prioridade }: { curso: Curso; capa?: string; aoAnotar: () => void; prioridade?: boolean }) {
  const mapa = mapaDe(c.notes)
  const parou = ondeParei(mapa)
  const partes = parou ? partesDoTitulo(parou.titulo) : null
  const pendentes = mapa.praticas.filter((p) => !p.feito).length
  const pct = progressoDo(c)
  const link = linkDoCurso(c.url)
  const plataforma = plataformaDoLink(c.url)

  return (
    // No celular: a capa pequena ao lado do nome e, embaixo, onde parou e os botões (cabe na primeira tela).
    // A partir do tablet: a capa grande na tela de luz à esquerda e tudo à direita.
    <article className="vidro relative grid h-full grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-center gap-x-4 gap-y-4 overflow-hidden p-4 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] sm:items-start sm:gap-x-7 sm:p-6 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] lg:p-7">
      <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[var(--b-luz-2)]/20 blur-3xl" />
      <Link href={`/estudos/cursos/${c.id}`} aria-label={`Abrir ${c.name}`} className="tela-holo block focus-visible:outline-none sm:row-span-2">
        <span className="tela-conteudo block aspect-video">
          <CapaCurso curso={c} caminho={capa} prioridade={prioridade} />
        </span>
      </Link>

      <div className="relative min-w-0">
        <p className="rotulo-hud flex items-center gap-2">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--b-luz)] opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--b-luz)]" />
          </span>
          <span className="truncate">
            Estudando agora{plataforma ? <span className="hidden sm:inline"> · {plataforma.nome}</span> : null}
          </span>
        </p>
        <h2 className="mt-1.5 font-display text-[1.3rem] font-semibold leading-[1.12] tracking-tight text-balance sm:mt-2 sm:text-[2rem]">
          <Link href={`/estudos/cursos/${c.id}`} className="hover:underline hover:decoration-[var(--b-luz)]/60 hover:underline-offset-4">
            {c.name}
          </Link>
        </h2>
        {c.categories.length ? <p className="mt-1 truncate text-xs text-ink-3 sm:text-sm">{c.categories.join(" · ")}</p> : null}
      </div>

      <div className="relative col-span-2 flex min-w-0 flex-col sm:col-span-1 sm:col-start-2">
        <div className="rounded-xl border border-[var(--b-borda)] bg-white/[0.03] px-3.5 py-3">
          {parou && partes ? (
            <>
              <p className="rotulo-hud flex items-center gap-1.5">
                <Radar className="size-3.5 text-[var(--b-rosa)]" aria-hidden /> Parou em{parou.modulo ? ` · ${parou.modulo}` : ""}
              </p>
              <p className="mt-1 flex items-baseline gap-2 text-[15px] font-medium leading-snug">
                {partes.numero ? <span className="tabular shrink-0 font-display text-[var(--b-luz)]">{partes.numero}</span> : null}
                <span className="min-w-0">{partes.nome}</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-2">Nenhuma aula anotada ainda. Anote a primeira e a trilha começa.</p>
          )}
          <p className="mt-2 text-xs text-ink-3">
            {plural(mapa.aulas.length, "aula anotada", "aulas anotadas")}
            {pendentes ? ` · ${plural(pendentes, "ação para praticar", "ações para praticar")}` : ""}
          </p>
        </div>

        {pct !== null ? (
          <div className="mt-4 flex items-center gap-3">
            <div className="barra-luz flex-1" role="progressbar" aria-label={`Progresso de ${c.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <span style={{ width: `${pct}%` }} />
            </div>
            <span className="tabular w-10 shrink-0 text-right text-sm font-semibold">{pct}%</span>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
          {link ? (
            <Botao asChild variante="primario" tamanho="lg" className="flex-1 shadow-[0_0_26px_-6px_var(--b-luz)] sm:flex-none">
              <a href={link} target="_blank" rel="noopener noreferrer">
                {plataforma ? <IconePlataforma id={plataforma.id} /> : <ArrowUpRight />} {plataforma?.em ? `Continuar ${plataforma.em}` : "Continuar o curso"}
              </a>
            </Botao>
          ) : null}
          <Botao variante={link ? "contorno" : "primario"} tamanho="lg" onClick={aoAnotar} className={cn(link ? "bg-transparent" : "flex-1 sm:flex-none")}>
            <NotebookPen /> Anotar aula
          </Botao>
          <Botao asChild variante="fantasma" tamanho="lg" className="px-3">
            <Link href={`/estudos/cursos/${c.id}`}>
              <Route /> Trilha
            </Link>
          </Botao>
        </div>
      </div>
    </article>
  )
}

function SemCurso({ aoEscolher, temFila }: { aoEscolher: () => void; temFila: boolean }) {
  return (
    <section aria-label="Estudando agora" className="vidro relative overflow-hidden px-6 py-10 text-center sm:py-12">
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-0 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--b-luz-2)]/25 blur-3xl" />
      <Route className="relative mx-auto size-8 text-[var(--b-luz)]" aria-hidden />
      <h2 className="relative mt-3 font-display text-2xl font-semibold">Nenhum curso em andamento</h2>
      <p className="relative mx-auto mt-1.5 max-w-sm text-ink-2">
        {temFila ? "Escolha um curso da fila ou retome um pausado: ele aparece aqui, com a aula onde você parou." : "Cadastre um curso e marque como “Em andamento” para ele aparecer aqui."}
      </p>
      {temFila ? (
        <Botao variante="primario" tamanho="lg" className="relative mt-5" onClick={aoEscolher}>
          Escolher um curso
        </Botao>
      ) : null}
    </section>
  )
}
