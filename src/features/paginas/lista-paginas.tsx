"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { ChevronRight, FileText, NotebookText, Plus, Search, Star, X } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Vazio } from "@/components/ui/basicos"
import { CabecalhoCerebro } from "@/features/segundo-cerebro/cabecalho"
import { novoId, useCriar } from "@/lib/data"
import type { Area } from "@/lib/areas"
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
      <div className="flex min-w-0 items-center gap-1 rounded-lg transition-colors hover:bg-surface-2/70">
        {filhos.length ? (
          <button
            type="button"
            aria-label={expandido ? `Recolher subpáginas de ${pagina.title}` : `Expandir subpáginas de ${pagina.title}`}
            aria-expanded={expandido}
            onClick={() => setAberto((a) => !a)}
            disabled={Boolean(busca)}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 disabled:opacity-60 sm:size-8 toque:size-11"
          >
            <ChevronRight className={cn("size-4 transition-transform", expandido && "rotate-90")} />
          </button>
        ) : (
          <span className="grid size-9 shrink-0 place-items-center text-ink-3 sm:size-8 toque:size-11">
            <FileText className="size-3.5" />
          </span>
        )}
        <Link href={`/paginas/${pagina.id}`} className={cn("min-w-0 flex-1 truncate rounded-lg px-2 py-2.5 text-sm hover:text-projetos focus-visible:outline-offset-1 toque:py-3", nivel === 0 && "font-semibold")}>
          {pagina.icon && !pagina.icon.startsWith("/") && pagina.icon.length <= 4 ? <span className="mr-1.5">{pagina.icon}</span> : null}
          {pagina.title || "Sem título"}
        </Link>
        {pagina.favorite ? <Star aria-label="Favorita" className="size-3.5 shrink-0 fill-estudos text-estudos" /> : null}
        {filhos.length ? <span className="tabular shrink-0 pr-2 text-xs text-ink-3">{indice.descendentes.get(pagina.id) ?? 0}</span> : null}
      </div>
      {expandido && filhos.length ? (
        <ul className="ml-3 border-l border-line pl-2 sm:ml-4 sm:pl-3">
          {filhos.map((f) => (
            <NoArvore key={f.id} pagina={f} indice={indice} nivel={nivel + 1} busca={busca} visiveis={visiveis} />
          ))}
        </ul>
      ) : null}
    </li>
  )
})

export function ListaPaginas({
  titulo,
  descricao,
  secoes,
  secaoNova,
  area,
  topo,
  substituir,
}: {
  /** Fica logo abaixo do cabeçalho (ex.: abas). */
  topo?: React.ReactNode
  /** Quando informado, aparece no lugar da árvore de páginas. */
  substituir?: React.ReactNode
  titulo: string
  descricao: string
  secoes: string[]
  secaoNova: string
  area: Area
}) {
  const router = useRouter()
  const { data: paginas = SEM_PAGINAS, isLoading } = useArvorePaginas()
  const criar = useCriar("pages")
  const [busca, setBusca] = React.useState("")

  const indice = React.useMemo(() => indexarArvore(paginas), [paginas])
  const visiveis = React.useMemo(() => busca ? filtrarArvore(indice, (p) => contem(p.title, busca)) : null, [indice, busca])
  const { daSecao, favoritas, porSecao } = React.useMemo(() => {
    const daSecao = paginas.filter((p) => secoes.includes(p.section))
    const ids = new Set(daSecao.map((p) => p.id))
    const raizes = daSecao.filter((p) => !p.parent_id || !ids.has(p.parent_id))
    const favoritas = daSecao.filter((p) => p.favorite)
    const porSecao = secoes.map((s) => ({ secao: s, itens: raizes.filter((p) => p.section === s).sort((a, b) => a.position - b.position || a.title.localeCompare(b.title)) }))
    return { daSecao, favoritas, porSecao }
  }, [paginas, secoes])

  const nova = async () => {
    const id = novoId()
    await criar.mutateAsync({ id, title: "Nova página", section: secaoNova, position: Date.now() % 1_000_000 })
    router.push(`/paginas/${id}?editar=1`)
  }

  return (
    <div>
      {area === "projetos" ? (
        <CabecalhoCerebro icone={NotebookText} titulo={titulo} descricao={descricao} acoes={<Botao variante="primario" onClick={nova} disabled={criar.isPending}><Plus /> Nova página</Botao>} />
      ) : (
        <Cabecalho area={area} titulo={titulo} descricao={descricao} acoes={<Botao variante="primario" onClick={nova} disabled={criar.isPending}><Plus /> Nova página</Botao>} />
      )}
      {topo}
      {substituir ?? (
      <>
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar páginas por título…" aria-label="Buscar páginas por título" className="h-11 w-full rounded-xl border border-line-strong bg-bg/50 pl-10 pr-10 text-base focus-visible:border-projetos focus-visible:outline-none sm:text-sm" />
          {busca ? <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-ink-2"><X className="size-4" /></button> : null}
        </div>
        <span className="tabular text-xs font-medium text-ink-3 sm:text-sm" aria-live="polite">{busca ? `${daSecao.filter((p) => contem(p.title, busca)).length} encontradas` : `${daSecao.length} páginas`}</span>
      </div>

      {isLoading ? (
        <Carregando />
      ) : daSecao.length === 0 ? (
        <Vazio className="rounded-2xl bg-surface p-7 sm:p-10" titulo="Nenhuma página ainda." descricao="Crie sua primeira página ou importe conteúdo do Notion em Configurações." acao={<Botao variante="primario" onClick={nova}><Plus /> Nova página</Botao>} />
      ) : busca && !daSecao.some((p) => contem(p.title, busca)) ? (
        <Vazio className="rounded-2xl bg-surface p-7 sm:p-10" titulo="Nenhuma página encontrada." descricao="Experimente outro termo ou limpe a busca." acao={<Botao variante="contorno" onClick={() => setBusca("")}>Limpar busca</Botao>} />
      ) : (
        <div className="grid gap-6 sm:gap-8">
          {favoritas.length && !busca ? (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><Star className="size-4 fill-estudos text-estudos" /> Favoritas</h2>
              <ul className="flex flex-wrap gap-2">
                {favoritas.map((p) => (
                  <li key={p.id}>
                    <Link href={`/paginas/${p.id}`} className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium hover:border-projetos/40 hover:text-projetos">
                      <Star className="size-3.5 fill-estudos text-estudos" />
                      <span className="max-w-[65vw] truncate sm:max-w-64">{p.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {porSecao
            .filter((s) => s.itens.length)
            .map((s) => (
              <section key={s.secao}>
                {secoes.length > 1 ? <h2 className="mb-3 font-display text-lg font-semibold">{SECOES[s.secao] ?? s.secao} <span className="tabular ml-1 text-sm font-normal text-ink-3">{s.itens.length}</span></h2> : null}
                <ul className="min-w-0 rounded-2xl border border-line bg-surface p-2 sm:p-3">
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
    </div>
  )
}
