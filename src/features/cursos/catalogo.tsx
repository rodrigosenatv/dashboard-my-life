"use client"

import * as React from "react"
import { Sparkles, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { CartaoCurso } from "./fileira"
import { buscarCursos, categoriasDos, competencias, ORDEM_STATUS, porStatus, statusDo, STATUS, type Curso, type StatusCurso } from "./logica"

export type EstadoCatalogo = { status: StatusCurso | "todos"; categoria: string }

const ROTULO_FILTRO: Record<StatusCurso | "todos", string> = {
  todos: "Todos",
  em_andamento: "Estudando",
  pausado: "Pausados",
  nao_comecou: "Na fila",
  concluido: "Concluídos",
}

function Pilula({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors toque:min-h-11",
        ativo ? "border-[var(--b-luz)] bg-[var(--b-luz)]/12 text-ink" : "border-[var(--b-borda)] text-ink-2 hover:border-[var(--b-borda-2)] hover:text-ink",
      )}
    >
      {children}
    </button>
  )
}

/** Todos os cursos (ou o resultado da busca): filtros por situação e categoria e a grade de cartões. */
export function Catalogo({
  cursos,
  capas,
  busca,
  estado,
  aoMudar,
}: {
  cursos: Curso[]
  capas: Map<string, string> | undefined
  busca: string
  estado: EstadoCatalogo
  aoMudar: (e: Partial<EstadoCatalogo>) => void
}) {
  const achados = React.useMemo(() => buscarCursos(cursos, busca), [cursos, busca])
  const grupos = React.useMemo(() => porStatus(achados), [achados])
  const daSituacao = estado.status === "todos" ? ORDEM_STATUS.flatMap((s) => grupos[s]) : grupos[estado.status]
  const categorias = React.useMemo(() => categoriasDos(daSituacao), [daSituacao])
  const lista = estado.categoria ? daSituacao.filter((c) => c.categories.some((k) => k.trim() === estado.categoria)) : daSituacao

  return (
    <div>
      <div role="group" aria-label="Situação" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden">
        {(["todos", ...ORDEM_STATUS] as const).map((s) => (
          <Pilula key={s} ativo={estado.status === s} onClick={() => aoMudar({ status: s, categoria: "" })}>
            {ROTULO_FILTRO[s]}
            <span className="tabular text-xs text-ink-3">{s === "todos" ? achados.length : grupos[s].length}</span>
          </Pilula>
        ))}
      </div>
      {categorias.length > 1 ? (
        <div role="group" aria-label="Categoria" className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden">
          <Pilula ativo={!estado.categoria} onClick={() => aoMudar({ categoria: "" })}>
            Todas as áreas
          </Pilula>
          {categorias.map((k) => (
            <Pilula key={k.nome} ativo={estado.categoria === k.nome} onClick={() => aoMudar({ categoria: estado.categoria === k.nome ? "" : k.nome })}>
              {k.nome}
              <span className="tabular text-xs text-ink-3">{k.total}</span>
            </Pilula>
          ))}
        </div>
      ) : null}

      {lista.length ? (
        <ul className="mt-6 grid grid-cols-2 gap-x-3.5 gap-y-6 sm:grid-cols-3 sm:gap-x-4 xl:grid-cols-4">
          {lista.map((c) => (
            <li key={c.id} className="min-w-0">
              <CartaoCurso curso={c} capa={capas?.get(c.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="vidro mt-6 px-5 py-8 text-center">
          <p className="font-medium">{busca ? `Nada encontrado para “${busca}”.` : "Nenhum curso com esses filtros."}</p>
          {estado.status !== "todos" || estado.categoria ? (
            <button type="button" onClick={() => aoMudar({ status: "todos", categoria: "" })} className="mt-2 min-h-10 rounded-full px-3 text-sm font-medium text-[var(--b-luz)] hover:bg-ink/[0.06]">
              Limpar filtros
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

/** As competências: as áreas dos cursos concluídos, com o que está em andamento em cada uma. */
export function PainelCompetencias({ cursos, aoVerArea }: { cursos: Curso[]; aoVerArea: (area: string) => void }) {
  const lista = React.useMemo(() => competencias(cursos).slice(0, 7), [cursos])
  const concluidos = cursos.filter((c) => statusDo(c) === "concluido").length
  if (!lista.length) return null
  const maximo = Math.max(...lista.map((k) => k.concluidos + k.estudando), 1)
  return (
    <section aria-labelledby="titulo-competencias" className="vidro p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="rotulo-hud flex items-center gap-2">
            <Trophy className="size-3.5 text-[var(--b-ambar)]" aria-hidden /> Suas competências
          </p>
          <h2 id="titulo-competencias" className="mt-1 font-display text-xl font-semibold">
            O que você já domina
          </h2>
        </div>
        <p className="text-sm text-ink-3">
          <span className="tabular font-display text-2xl font-semibold text-[var(--b-ambar)]">{concluidos}</span>{" "}
          {concluidos === 1 ? "curso concluído" : "cursos concluídos"}
        </p>
      </div>
      <ul className="mt-5 grid gap-x-8 gap-y-3.5 md:grid-cols-2">
        {lista.map((k) => (
          <li key={k.nome}>
            <button type="button" onClick={() => aoVerArea(k.nome)} className="group block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--b-luz)]/50">
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium group-hover:text-[var(--b-luz)]">{k.nome}</span>
                <span className="tabular shrink-0 text-xs text-ink-3">
                  {k.concluidos} {k.concluidos === 1 ? "concluído" : "concluídos"}
                  {k.estudando ? (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-[var(--b-luz)]">
                      <Sparkles className="size-3" aria-hidden />+{k.estudando}
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="barra-competencia mt-1.5 flex [&>span]:rounded-none" aria-hidden>
                <span style={{ width: `${(k.concluidos / maximo) * 100}%` }} />
                {k.estudando ? <span className="!shadow-none" style={{ width: `${(k.estudando / maximo) * 100}%`, background: "repeating-linear-gradient(135deg, color-mix(in oklab, var(--b-luz) 55%, transparent) 0 4px, color-mix(in oklab, var(--b-luz) 15%, transparent) 4px 8px)" }} /> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-3">A barra cheia são os cursos concluídos; a listrada, os que estão em andamento.</p>
    </section>
  )
}

export function rotuloDaSituacao(s: StatusCurso): string {
  return STATUS[s].rotulo
}
