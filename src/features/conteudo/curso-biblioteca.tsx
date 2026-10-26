"use client"

import Link from "next/link"
import * as React from "react"
import { ArrowUpRight, GraduationCap, Sparkles, Star } from "lucide-react"
import { useLista } from "@/lib/data"
import type { PaginaResumo } from "@/features/paginas/dados"
import { modulosDoCurso, type GrupoModulo, type Modulo } from "./logica"

export type Curso = { pagina: PaginaResumo; soltas: string[]; modulos: Modulo[] }

/**
 * Os cursos da Biblioteca: páginas de primeiro nível (como "Dominando a IA") cujo texto organiza as aulas em
 * módulos, como os callouts do Notion. Só o texto dessas páginas é buscado.
 */
export function useCursosDaBiblioteca(raizes: PaginaResumo[], ativo = true) {
  const ids = raizes.map((r) => r.id).sort()
  const { data = [] } = useLista("pages", {
    colunas: "id,content",
    filtro: (q) => q.in("id", ids),
    chave: ["cursos-biblioteca", ids.join(",")],
    enabled: ativo && ids.length > 0,
  })
  return React.useMemo(() => {
    const porId = new Map(raizes.map((r) => [r.id, r]))
    const cursos: Curso[] = []
    for (const linha of data) {
      const pagina = porId.get(linha.id)
      if (!pagina) continue
      const { soltas, modulos } = modulosDoCurso(linha.content ?? "")
      // Um curso de verdade tem ao menos dois módulos; com menos, a árvore de sempre mostra melhor
      if (modulos.length >= 2) cursos.push({ pagina, soltas, modulos })
    }
    return cursos.sort((a, b) => a.pagina.position - b.pagina.position || a.pagina.title.localeCompare(b.pagina.title))
  }, [data, raizes])
}

const LIMITE_AULAS = 4

/** As primeiras aulas dos grupos, até o limite, mantendo o grupo de cada uma. */
function primeirasAulas(grupos: GrupoModulo[], limite: number): GrupoModulo[] {
  const saida: GrupoModulo[] = []
  let restam = limite
  for (const g of grupos) {
    if (restam <= 0) break
    const ids = g.ids.slice(0, restam)
    restam -= ids.length
    saida.push({ ...g, ids })
  }
  return saida
}

function CartaoModulo({ modulo, paginas }: { modulo: Modulo; paginas: Map<string, PaginaResumo> }) {
  const [aberto, setAberto] = React.useState(false)
  const grupos = modulo.grupos.map((g) => ({ ...g, ids: g.ids.filter((id) => paginas.has(id)) })).filter((g) => g.ids.length)
  const total = grupos.reduce((s, g) => s + g.ids.length, 0)
  if (!total) return null
  // Fechado, mostra as primeiras aulas (com o título do grupo delas)
  const visiveis = aberto ? grupos : primeirasAulas(grupos, LIMITE_AULAS)

  return (
    <li className="vidro-vivo flex min-w-0 flex-col p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--b-borda-2)] bg-black/25 font-display text-lg font-bold tabular-nums text-[var(--b-luz)] shadow-[inset_0_0_14px_-6px_var(--b-luz)] [text-shadow:0_0_12px_rgb(255_111_181/0.6)]"
        >
          {modulo.numero ?? <Sparkles className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="rotulo-hud">{modulo.numero ? `Módulo ${modulo.numero}` : "Coleção"}</p>
          <h3 className="mt-0.5 break-words font-display text-[15px] font-semibold leading-snug">{modulo.nome}</h3>
        </div>
        <span className="tabular shrink-0 pt-0.5 text-xs text-ink-3">{total === 1 ? "1 aula" : `${total} aulas`}</span>
      </div>
      <ul className="mt-3 grid min-w-0 gap-px border-l border-[var(--b-borda-2)] pl-2">
        {visiveis.map((g, i) => (
          <React.Fragment key={`${g.titulo ?? "grupo"}-${i}`}>
            {g.titulo ? <li className="rotulo-hud px-2 pb-0.5 pt-2 text-[10px] first:pt-0.5">{g.titulo}</li> : null}
            {g.ids.map((id) => (
              <li key={id} className="min-w-0">
                <Link href={`/paginas/${id}`} className="block truncate rounded-lg px-2 py-1.5 text-sm text-ink-2 transition-colors hover:bg-white/[0.05] hover:text-[var(--b-luz)] toque:py-2.5">
                  {paginas.get(id)?.title || "Sem título"}
                </Link>
              </li>
            ))}
          </React.Fragment>
        ))}
      </ul>
      {total > LIMITE_AULAS ? (
        <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="mt-2 inline-flex min-h-9 self-start items-center rounded-full px-2 text-xs font-medium text-[var(--b-luz)] hover:bg-white/[0.05] toque:min-h-10">
          {aberto ? "Mostrar menos" : `Ver as ${total} aulas`}
        </button>
      ) : null}
    </li>
  )
}

/** Um curso da Biblioteca: o nome, os destaques e os módulos com as aulas, como no Notion. */
export function MapaDoCurso({ curso, paginas }: { curso: Curso; paginas: Map<string, PaginaResumo> }) {
  const { pagina, soltas, modulos } = curso
  const aulas = modulos.reduce((s, m) => s + m.ids.filter((id) => paginas.has(id)).length, 0)
  const icone = pagina.icon && !pagina.icon.startsWith("/") && pagina.icon.length <= 4 ? pagina.icon : null
  const destaques = soltas.filter((id) => paginas.has(id))
  const idTitulo = `curso-${pagina.id}`
  return (
    <section aria-labelledby={idTitulo}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="icone-aceso size-11 text-xl" aria-hidden>
            {icone ?? <GraduationCap className="size-5" />}
          </span>
          <div className="min-w-0">
            <p className="rotulo-hud">
              Curso · {modulos.length} módulos · {aulas} aulas
            </p>
            <h2 id={idTitulo} className="truncate font-display text-xl font-semibold sm:text-2xl">
              {pagina.title}
            </h2>
          </div>
        </div>
        <Link href={`/paginas/${pagina.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--b-borda)] bg-white/[0.03] px-3.5 text-sm text-ink-2 transition-colors hover:border-[var(--b-borda-2)] hover:text-ink">
          Abrir a página <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>
      {destaques.length ? (
        <ul className="mb-4 flex flex-wrap gap-2" aria-label="Destaques do curso">
          {destaques.map((id) => (
            <li key={id} className="min-w-0 max-w-full">
              <Link
                href={`/paginas/${id}`}
                className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-[var(--b-luz)]/35 bg-[var(--b-luz)]/[0.08] px-3.5 py-2 text-sm font-medium shadow-[0_0_20px_-10px_var(--b-luz)] transition-colors hover:border-[var(--b-luz)]/70"
              >
                <Star className="size-3.5 shrink-0 fill-[var(--b-ambar)] text-[var(--b-ambar)]" aria-hidden />
                <span className="truncate">{paginas.get(id)?.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modulos.map((m, i) => (
          <CartaoModulo key={`${m.titulo}-${i}`} modulo={m} paginas={paginas} />
        ))}
      </ul>
    </section>
  )
}
