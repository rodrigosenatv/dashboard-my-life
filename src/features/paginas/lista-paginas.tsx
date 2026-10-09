"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { ChevronRight, FileText, Plus, Search, Star } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Vazio } from "@/components/ui/basicos"
import { novoId, useCriar } from "@/lib/data"
import type { Area } from "@/lib/areas"
import { cn, contem } from "@/lib/utils"
import { contarDescendentes, filhosDe, SECOES, useArvorePaginas, type PaginaResumo } from "./dados"

function NoArvore({ pagina, todas, nivel, busca }: { pagina: PaginaResumo; todas: PaginaResumo[]; nivel: number; busca: string }) {
  const filhos = filhosDe(todas, pagina.id)
  const [aberto, setAberto] = React.useState(nivel === 0 && filhos.length > 0 && filhos.length < 30)
  const casa = (p: PaginaResumo): boolean => contem(p.title, busca) || filhosDe(todas, p.id).some(casa)
  if (busca && !casa(pagina)) return null
  const expandido = busca ? true : aberto

  return (
    <li>
      <div className="flex items-center gap-1" style={{ paddingLeft: nivel * 18 }}>
        {filhos.length ? (
          <button
            type="button"
            aria-label={expandido ? "Recolher" : "Expandir"}
            aria-expanded={expandido}
            onClick={() => setAberto((a) => !a)}
            className="grid size-6 place-items-center rounded text-ink-3 hover:bg-surface-2 toque:size-11"
          >
            <ChevronRight className={cn("size-4 transition-transform", expandido && "rotate-90")} />
          </button>
        ) : (
          <span className="grid size-6 place-items-center text-ink-3 toque:size-11">
            <FileText className="size-3.5" />
          </span>
        )}
        <Link href={`/paginas/${pagina.id}`} className={cn("min-w-0 flex-1 truncate rounded-md px-1.5 py-1.5 text-sm hover:bg-surface-2 toque:py-3", nivel === 0 && "font-medium")}>
          {pagina.icon && !pagina.icon.startsWith("/") && pagina.icon.length <= 4 ? <span className="mr-1.5">{pagina.icon}</span> : null}
          {pagina.title || "Sem título"}
        </Link>
        {pagina.favorite ? <Star className="size-3.5 fill-estudos text-estudos" /> : null}
        {filhos.length ? <span className="tabular pr-2 text-xs text-ink-3">{contarDescendentes(todas, pagina.id)}</span> : null}
      </div>
      {expandido && filhos.length ? (
        <ul>
          {filhos.map((f) => (
            <NoArvore key={f.id} pagina={f} todas={todas} nivel={nivel + 1} busca={busca} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

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
  const { data: paginas = [], isLoading } = useArvorePaginas()
  const criar = useCriar("pages")
  const [busca, setBusca] = React.useState("")

  const daSecao = paginas.filter((p) => secoes.includes(p.section))
  const ids = new Set(daSecao.map((p) => p.id))
  const raizes = daSecao.filter((p) => !p.parent_id || !ids.has(p.parent_id))
  const favoritas = daSecao.filter((p) => p.favorite)
  const porSecao = secoes.map((s) => ({ secao: s, itens: raizes.filter((p) => p.section === s).sort((a, b) => a.position - b.position || a.title.localeCompare(b.title)) }))

  const nova = async () => {
    const id = novoId()
    await criar.mutateAsync({ id, title: "Nova página", section: secaoNova, position: Date.now() % 1_000_000 })
    router.push(`/paginas/${id}?editar=1`)
  }

  return (
    <div>
      <Cabecalho area={area} titulo={titulo} descricao={descricao} acoes={<Botao variante="primario" onClick={nova}><Plus /> Nova página</Botao>} />
      {topo}
      {substituir ?? (
      <>
      <div className="relative mb-6 max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar pelo título" aria-label="Filtrar páginas" className="h-9 w-full rounded-md border toque:h-11 toque:text-[16px] border-line-strong bg-surface pl-8 pr-3 text-sm placeholder:text-ink-3 focus-visible:border-pen focus-visible:outline-none" />
      </div>

      {isLoading ? (
        <Carregando />
      ) : daSecao.length === 0 ? (
        <Vazio titulo="Nenhuma página ainda." descricao="Crie uma página ou importe seu conteúdo do Notion em Configurações." />
      ) : (
        <div className="grid gap-8">
          {favoritas.length && !busca ? (
            <section>
              <h2 className="mb-2 font-display text-lg font-semibold">Favoritas</h2>
              <ul className="flex flex-wrap gap-2">
                {favoritas.map((p) => (
                  <li key={p.id}>
                    <Link href={`/paginas/${p.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-line-strong">
                      <Star className="size-3.5 fill-estudos text-estudos" />
                      {p.title}
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
                {secoes.length > 1 ? <h2 className="mb-2 font-display text-lg font-semibold">{SECOES[s.secao] ?? s.secao}</h2> : null}
                <ul className="rounded-lg border border-line bg-surface p-2">
                  {s.itens.map((p) => (
                    <NoArvore key={p.id} pagina={p} todas={paginas} nivel={0} busca={busca} />
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
