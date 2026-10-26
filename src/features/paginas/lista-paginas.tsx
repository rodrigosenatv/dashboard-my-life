"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { isThisWeek } from "date-fns"
import { ChevronRight, FileText, NotebookText, Plus, Search, Star, X } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Vazio } from "@/components/ui/basicos"
import { ACAO_ACESA, CabecalhoCerebro, MolduraCerebro } from "@/features/segundo-cerebro/cabecalho"
import { VazioCerebro } from "@/features/segundo-cerebro/ui"
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

  // No Segundo Cérebro a lista vem com o tema da rede neural; na Biblioteca (Conteúdo), com o visual de sempre
  const futurista = area === "projetos"
  const editadas = futurista ? daSecao.filter((p) => isThisWeek(new Date(p.updated_at), { weekStartsOn: 0 })).length : 0

  const conteudo = (
    <div>
      {futurista ? (
        <CabecalhoCerebro
          icone={NotebookText}
          papel="Wiki e textos longos"
          titulo={titulo}
          descricao={descricao}
          descricaoNoCelular={!daSecao.length}
          acoes={
            <Botao variante="primario" tamanho="lg" onClick={nova} disabled={criar.isPending} className={cn("rounded-full px-5", ACAO_ACESA)}>
              <Plus /> Nova página
            </Botao>
          }
          hud={
            isLoading || !daSecao.length
              ? []
              : [
                  { n: daSecao.length, rotulo: daSecao.length === 1 ? "página" : "páginas", cor: "var(--b-luz)" },
                  ...(favoritas.length ? [{ n: favoritas.length, rotulo: favoritas.length === 1 ? "favorita" : "favoritas", cor: "var(--b-ambar)" }] : []),
                  ...(editadas ? [{ n: editadas, rotulo: editadas === 1 ? "editada nesta semana" : "editadas nesta semana" }] : []),
                ]
          }
        />
      ) : (
        <Cabecalho area={area} titulo={titulo} descricao={descricao} acoes={<Botao variante="primario" onClick={nova} disabled={criar.isPending}><Plus /> Nova página</Botao>} />
      )}
      {topo}
      {substituir ?? (
      <>
      <div className={cn("flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4", futurista ? "vidro mb-6" : "mb-5 rounded-2xl border border-line bg-surface")}>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar páginas por título…" aria-label="Buscar páginas por título" className={cn("h-11 w-full pl-10 pr-10 text-base focus-visible:outline-none sm:text-sm", futurista ? "rounded-full border border-[var(--b-borda)] bg-black/25 placeholder:text-ink-3 focus-visible:border-[var(--b-luz)]" : "rounded-xl border border-line-strong bg-bg/50 focus-visible:border-projetos")} />
          {busca ? <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-ink-2"><X className="size-4" /></button> : null}
        </div>
        <span className="tabular text-xs font-medium text-ink-3 sm:text-sm" aria-live="polite">{busca ? `${daSecao.filter((p) => contem(p.title, busca)).length} encontradas` : `${daSecao.length} páginas`}</span>
      </div>

      {isLoading ? (
        <Carregando />
      ) : daSecao.length === 0 ? (
        futurista ? (
          <VazioCerebro icone={NotebookText} titulo="Nenhuma página ainda." descricao="Crie sua primeira página ou importe o conteúdo do Notion em Configurações." acao={<Botao variante="primario" className="rounded-full" onClick={nova}><Plus /> Nova página</Botao>} />
        ) : (
          <Vazio className="rounded-2xl bg-surface p-7 sm:p-10" titulo="Nenhuma página ainda." descricao="Crie sua primeira página ou importe conteúdo do Notion em Configurações." acao={<Botao variante="primario" onClick={nova}><Plus /> Nova página</Botao>} />
        )
      ) : busca && !daSecao.some((p) => contem(p.title, busca)) ? (
        futurista ? (
          <VazioCerebro icone={Search} titulo="Nenhuma página encontrada." descricao="Experimente outro termo ou limpe a busca." acao={<Botao variante="contorno" className="rounded-full bg-transparent" onClick={() => setBusca("")}>Limpar busca</Botao>} />
        ) : (
          <Vazio className="rounded-2xl bg-surface p-7 sm:p-10" titulo="Nenhuma página encontrada." descricao="Experimente outro termo ou limpe a busca." acao={<Botao variante="contorno" onClick={() => setBusca("")}>Limpar busca</Botao>} />
        )
      ) : (
        <div className="grid gap-6 sm:gap-8">
          {favoritas.length && !busca ? (
            <section>
              <h2 className={cn("mb-3 flex items-center gap-2", futurista ? "rotulo-hud" : "font-display text-lg font-semibold")}><Star className={cn("fill-estudos text-estudos", futurista ? "size-3.5" : "size-4")} /> Favoritas</h2>
              <ul className="flex flex-wrap gap-2">
                {favoritas.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/paginas/${p.id}`}
                      className={cn(
                        "inline-flex min-h-10 max-w-full items-center gap-1.5 px-3 py-2 text-sm font-medium",
                        futurista
                          ? "rounded-full border border-[var(--b-ambar)]/30 bg-[var(--b-ambar)]/[0.08] shadow-[0_0_18px_-10px_var(--b-ambar)] transition-colors hover:border-[var(--b-ambar)]/60 hover:text-ink"
                          : "rounded-xl border border-line bg-surface hover:border-projetos/40 hover:text-projetos",
                      )}
                    >
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
                {secoes.length > 1 ? (
                  futurista ? (
                    <h2 className="mb-3 flex items-center gap-2">
                      <span className="rotulo-hud">{SECOES[s.secao] ?? s.secao}</span>
                      <span className="tabular rounded-full border border-[var(--b-borda)] bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-[var(--b-luz)]">{s.itens.length}</span>
                      <span aria-hidden className="h-px min-w-6 flex-1 bg-gradient-to-r from-[var(--b-borda-2)] to-transparent" />
                    </h2>
                  ) : (
                    <h2 className="mb-3 font-display text-lg font-semibold">{SECOES[s.secao] ?? s.secao} <span className="tabular ml-1 text-sm font-normal text-ink-3">{s.itens.length}</span></h2>
                  )
                ) : null}
                <ul className={cn("min-w-0 p-2 sm:p-3", futurista ? "vidro" : "rounded-2xl border border-line bg-surface")}>
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

  return futurista ? <MolduraCerebro>{conteudo}</MolduraCerebro> : conteudo
}
