"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import { useRouter } from "next/navigation"
import * as React from "react"
import { isThisWeek } from "date-fns"
import { ChevronRight, FileText, Library, NotebookText, Plus, Search, Star, X } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Carregando } from "@/components/ui/basicos"
import { ACAO_ACESA, type ItemHud } from "@/components/ui/cabecalho-hud"
import { CabecalhoCerebro, MolduraCerebro } from "@/features/segundo-cerebro/cabecalho"
import { VazioCerebro } from "@/features/segundo-cerebro/ui"
import { CabecalhoEstudio, MolduraEstudio } from "@/features/conteudo/moldura"
import { MapaDoCurso, useCursosDaBiblioteca } from "@/features/conteudo/curso-biblioteca"
import { novoId, useCriar } from "@/lib/data"
import { cn, contem } from "@/lib/utils"
import { SECOES, useArvorePaginas, type PaginaResumo } from "./dados"

import { indexarArvore, filtrarArvore, type IndiceArvore } from "./arvore"

const SEM_PAGINAS: PaginaResumo[] = []
const SEM_FILHOS: PaginaResumo[] = []

const NoArvore = React.memo(function NoArvore({ pagina, indice, nivel, busca, visiveis }: { pagina: PaginaResumo; indice: IndiceArvore; nivel: number; busca: string; visiveis: Set<string> | null }) {
  const filhos = indice.filhos.get(pagina.id) ?? SEM_FILHOS
  const [aberto, setAberto] = React.useState(false)
  if (visiveis && !visiveis.has(pagina.id)) return null
  const expandido = busca ? true : aberto

  return (
    <li className="min-w-0">
      <div className="flex min-w-0 items-center gap-1 rounded-lg transition-colors hover:bg-white/[0.04]">
        {filhos.length ? (
          <button
            type="button"
            aria-label={expandido ? `Recolher subpáginas de ${pagina.title}` : `Expandir subpáginas de ${pagina.title}`}
            aria-expanded={expandido}
            onClick={() => setAberto((a) => !a)}
            disabled={Boolean(busca)}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-white/[0.06] disabled:opacity-60 sm:size-8 toque:size-11"
          >
            <ChevronRight className={cn("size-4 transition-transform", expandido && "rotate-90")} />
          </button>
        ) : (
          <span className="grid size-9 shrink-0 place-items-center text-ink-3 sm:size-8 toque:size-11">
            <FileText className="size-3.5" />
          </span>
        )}
        <Link href={`/paginas/${pagina.id}`} className={cn("min-w-0 flex-1 truncate rounded-lg px-2 py-2.5 text-sm transition-colors hover:text-[var(--b-luz)] focus-visible:outline-offset-1 toque:py-3", nivel === 0 && "font-semibold")}>
          {pagina.icon && !pagina.icon.startsWith("/") && pagina.icon.length <= 4 ? <span className="mr-1.5">{pagina.icon}</span> : null}
          {pagina.title || "Sem título"}
        </Link>
        {pagina.favorite ? <Star aria-label="Favorita" className="size-3.5 shrink-0 fill-estudos text-estudos" /> : null}
        {filhos.length ? <span className="tabular shrink-0 pr-2 text-xs text-ink-3">{indice.descendentes.get(pagina.id) ?? 0}</span> : null}
      </div>
      {expandido && filhos.length ? (
        <ul className="ml-3 border-l border-[var(--b-borda)] pl-2 sm:ml-4 sm:pl-3">
          {filhos.map((f) => (
            <NoArvore key={f.id} pagina={f} indice={indice} nivel={nivel + 1} busca={busca} visiveis={visiveis} />
          ))}
        </ul>
      ) : null}
    </li>
  )
})

/**
 * A lista de páginas de uma área, com o tema dela: as Páginas do Segundo Cérebro (a rede neural) e a
 * Biblioteca de Conteúdo e IA (o estúdio, com os cursos em módulos).
 */
export function ListaPaginas({
  titulo,
  descricao,
  secoes,
  secaoNova,
  area,
  topo,
  substituir,
  hudExtra = [],
  cursos = false,
}: {
  /** Fica logo abaixo do cabeçalho (ex.: abas). */
  topo?: React.ReactNode
  /** Quando informado, aparece no lugar da árvore de páginas. */
  substituir?: React.ReactNode
  titulo: string
  descricao: string
  secoes: string[]
  secaoNova: string
  area: "projetos" | "conteudo"
  /** Números a mais no resumo do cabeçalho (ex.: quantos prompts). */
  hudExtra?: ItemHud[]
  /** Mostra as páginas da seção "biblioteca" que organizam aulas em módulos como cursos. */
  cursos?: boolean
}) {
  const router = useRouter()
  const { data: paginas = SEM_PAGINAS, isLoading } = useArvorePaginas()
  const criar = useCriar("pages")
  const [busca, setBusca] = React.useState("")
  const estudio = area === "conteudo"

  const indice = React.useMemo(() => indexarArvore(paginas), [paginas])
  const visiveis = React.useMemo(() => (busca ? filtrarArvore(indice, (p) => contem(p.title, busca)) : null), [indice, busca])
  const { daSecao, favoritas, porSecao, porId } = React.useMemo(() => {
    const daSecao = paginas.filter((p) => secoes.includes(p.section))
    const ids = new Set(daSecao.map((p) => p.id))
    const raizes = daSecao.filter((p) => !p.parent_id || !ids.has(p.parent_id))
    const favoritas = daSecao.filter((p) => p.favorite)
    const porSecao = secoes.map((s) => ({ secao: s, itens: raizes.filter((p) => p.section === s).sort((a, b) => a.position - b.position || a.title.localeCompare(b.title)) }))
    return { daSecao, favoritas, porSecao, porId: new Map(daSecao.map((p) => [p.id, p])) }
  }, [paginas, secoes])

  // Os cursos (páginas com módulos) aparecem como mapas; na busca, voltam para a árvore
  const raizesBiblioteca = React.useMemo(() => (cursos ? (porSecao.find((s) => s.secao === "biblioteca")?.itens ?? []) : []), [cursos, porSecao])
  const { cursos: listaCursos, carregando: carregandoCursos } = useCursosDaBiblioteca(raizesBiblioteca, cursos && !substituir)
  const carregando = isLoading || carregandoCursos
  const idsCursos = new Set(busca ? [] : listaCursos.map((c) => c.pagina.id))

  const nova = async () => {
    const id = novoId()
    await criar.mutateAsync({ id, title: "Nova página", section: secaoNova, position: Date.now() % 1_000_000 })
    router.push(`/paginas/${id}?editar=1`)
  }

  const editadas = daSecao.filter((p) => isThisWeek(new Date(p.updated_at), { weekStartsOn: 0 })).length
  const Cabecalho = estudio ? CabecalhoEstudio : CabecalhoCerebro
  const Moldura = estudio ? MolduraEstudio : MolduraCerebro
  const encontradas = busca ? daSecao.filter((p) => contem(p.title, busca)).length : 0

  return (
    <Moldura>
      <Cabecalho
        icone={estudio ? Library : NotebookText}
        papel={estudio ? "Prompts, cursos e módulos" : "Wiki e textos longos"}
        titulo={titulo}
        descricao={descricao}
        descricaoNoCelular={!daSecao.length}
        acoes={
          <Botao variante="primario" tamanho="lg" onClick={nova} disabled={criar.isPending} className={cn("rounded-full px-5", ACAO_ACESA)}>
            <Plus /> Nova página
          </Botao>
        }
        hud={
          carregando || !daSecao.length
            ? []
            : [
                { n: daSecao.length, rotulo: daSecao.length === 1 ? "página" : "páginas", cor: "var(--b-luz)" },
                ...(listaCursos.length ? [{ n: listaCursos.reduce((s, c) => s + c.modulos.length, 0), rotulo: "módulos", cor: "var(--b-luz-2)" }] : []),
                ...(favoritas.length ? [{ n: favoritas.length, rotulo: favoritas.length === 1 ? "favorita" : "favoritas", cor: "var(--b-ambar)" }] : []),
                ...(editadas ? [{ n: editadas, rotulo: editadas === 1 ? "editada nesta semana" : "editadas nesta semana" }] : []),
                // Por último: o que chega depois (os prompts) não empurra os números que já estão na tela
                ...hudExtra,
              ]
        }
      />
      {topo}
      {substituir ?? (
        <>
          <div className="vidro mb-6 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar páginas por título…"
                aria-label="Buscar páginas por título"
                className="h-11 w-full rounded-full border border-[var(--b-borda)] bg-black/25 pl-10 pr-10 text-base placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none sm:text-sm"
              />
              {busca ? (
                <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-ink-2">
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <span className={cn("tabular text-xs font-medium text-ink-3 sm:text-sm", !busca && "hidden sm:inline")} aria-live="polite">
              {busca ? `${encontradas} encontradas` : `${daSecao.length} páginas`}
            </span>
          </div>

          {carregando ? (
            <Carregando />
          ) : daSecao.length === 0 ? (
            <VazioCerebro
              icone={estudio ? Library : NotebookText}
              titulo="Nenhuma página ainda."
              descricao="Crie sua primeira página ou importe o conteúdo do Notion em Configurações."
              acao={
                <Botao variante="primario" className="rounded-full" onClick={nova}>
                  <Plus /> Nova página
                </Botao>
              }
            />
          ) : busca && !encontradas ? (
            <VazioCerebro
              icone={Search}
              titulo="Nenhuma página encontrada."
              descricao="Experimente outro termo ou limpe a busca."
              acao={
                <Botao variante="contorno" className="rounded-full bg-transparent" onClick={() => setBusca("")}>
                  Limpar busca
                </Botao>
              }
            />
          ) : (
            <div className="grid gap-8 sm:gap-10">
              {favoritas.length && !busca ? (
                <section>
                  <h2 className="rotulo-hud mb-3 flex items-center gap-2">
                    <Star className="size-3.5 fill-estudos text-estudos" /> Favoritas
                  </h2>
                  <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                    {favoritas.map((p) => (
                      <li key={p.id} className="min-w-0 max-w-full shrink-0">
                        <Link
                          href={`/paginas/${p.id}`}
                          className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-[var(--b-ambar)]/30 bg-[var(--b-ambar)]/[0.08] px-3 py-2 text-sm font-medium shadow-[0_0_18px_-10px_var(--b-ambar)] transition-colors hover:border-[var(--b-ambar)]/60 hover:text-ink"
                        >
                          <Star className="size-3.5 shrink-0 fill-estudos text-estudos" />
                          <span className="max-w-[65vw] truncate sm:max-w-64">{p.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {!busca ? listaCursos.map((c) => <MapaDoCurso key={c.pagina.id} curso={c} paginas={porId} />) : null}
              {porSecao
                .map((s) => ({ ...s, itens: s.itens.filter((p) => !idsCursos.has(p.id)) }))
                .filter((s) => s.itens.length)
                .map((s) => (
                  <section key={s.secao}>
                    {secoes.length > 1 ? (
                      <h2 className="mb-3 flex items-center gap-2">
                        <span className="rotulo-hud">{SECOES[s.secao] ?? s.secao}</span>
                        <span className="tabular rounded-full border border-[var(--b-borda)] bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-[var(--b-luz)]">{s.itens.length}</span>
                        <span aria-hidden className="h-px min-w-6 flex-1 bg-gradient-to-r from-[var(--b-borda-2)] to-transparent" />
                      </h2>
                    ) : null}
                    <ul className="vidro min-w-0 p-2 sm:p-3">
                      {s.itens.map((p) => (
                        <NoArvore key={p.id} pagina={p} indice={indice} nivel={0} busca={busca} visiveis={visiveis} />
                      ))}
                    </ul>
                  </section>
                ))}
            </div>
          )}
        </>
      )}
    </Moldura>
  )
}
