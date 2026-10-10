"use client"

import Link from "next/link"
import * as React from "react"
import { useSearchParams } from "next/navigation"
import { BookOpenCheck, Plus, Quote, Star } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Progresso, Segmentos, Vazio } from "@/components/ui/basicos"
import { novoId, useAtualizar, useCriar, useExcluir, useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { contem, porcentagem } from "@/lib/utils"
import { COLUNAS_LIVRO_LISTA } from "./dados"
import { DialogoLivro } from "./dialogo-livro"
import { Pomodoro } from "@/components/pomodoro"
import { isoDia } from "@/lib/utils"

type Livro = Tables<"books">
type Aba = "estante" | "pausados" | "lidos" | "desejos" | "insights"

function Lombada({ livro }: { livro: Livro }) {
  // Capa tipográfica: sem imagem, o título é a capa.
  const tons = ["bg-estudos-soft", "bg-pen-soft", "bg-rotina-soft", "bg-projetos-soft", "bg-conteudo-soft"]
  const tom = tons[[...livro.title].reduce((n, c) => n + c.charCodeAt(0), 0) % tons.length]
  return (
    <div className={`flex aspect-[2/3] flex-col justify-between rounded-md p-3 ${tom}`}>
      <p className="line-clamp-5 hyphens-auto break-words font-display text-[15px] font-semibold leading-tight">{livro.title}</p>
      <p className="line-clamp-2 text-xs text-ink-2">{livro.author}</p>
    </div>
  )
}

function AtualizarPagina({ livro }: { livro: Livro }) {
  const atualizar = useAtualizar("books")
  const [valor, setValor] = React.useState(String(livro.pages_read))
  React.useEffect(() => setValor(String(livro.pages_read)), [livro.pages_read])
  const salvar = () => {
    const n = Math.max(0, Number(valor) || 0)
    if (n === livro.pages_read) return
    const terminou = livro.pages_total ? n >= livro.pages_total : false
    atualizar.mutate({
      id: livro.id,
      pages_read: n,
      ...(terminou ? { status: "finalizado", finished_at: new Date().toISOString().slice(0, 10), read_years: [...new Set([...livro.read_years, new Date().getFullYear()])] } : {}),
    })
  }
  return (
    <label className="flex items-center gap-1.5 text-xs text-ink-3">
      Página
      <input
        inputMode="numeric"
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))}
        onBlur={salvar}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="tabular h-7 w-14 rounded-md border border-line-strong bg-surface px-1.5 text-center text-sm text-ink focus-visible:border-pen focus-visible:outline-none"
      />
      {livro.pages_total ? <span className="tabular">de {livro.pages_total}</span> : null}
    </label>
  )
}

function Insights({ livros }: { livros: Livro[] }) {
  const { data: insights = [] } = useLista("insights", { ordem: [{ coluna: "created_at", asc: false }] })
  const criar = useCriar("insights")
  const excluir = useExcluir("insights")
  const [texto, setTexto] = React.useState("")
  const [livro, setLivro] = React.useState("")
  const titulos = new Map(livros.map((l) => [l.id, l.title]))
  const lista = insights.filter((i) => i.source !== "laboratorio")

  return (
    <div className="max-w-3xl">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!texto.trim()) return
          criar.mutate({ id: novoId(), text: texto.trim(), book_id: livro || null, source: livro ? "livro" : "pessoal" })
          setTexto("")
        }}
        className="mb-8 grid gap-2 sm:grid-cols-[1fr_14rem_auto]"
      >
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Uma frase que você quer lembrar" aria-label="Novo insight" className="h-9 rounded-md border border-line-strong bg-surface px-3 text-sm focus-visible:border-pen focus-visible:outline-none" />
        <select value={livro} onChange={(e) => setLivro(e.target.value)} aria-label="Livro" className="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm">
          <option value="">Sem livro</option>
          {livros.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
        <Botao type="submit" variante="primario" disabled={!texto.trim()}>Guardar</Botao>
      </form>
      {lista.length === 0 ? (
        <Vazio titulo="Nenhum insight guardado." />
      ) : (
        <ul className="grid gap-6">
          {lista.map((i) => (
            <li key={i.id} className="group flex gap-3">
              <Quote className="mt-1 size-4 shrink-0 text-estudos" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg leading-snug">{i.text}</p>
                <p className="mt-1 text-xs text-ink-3">
                  {i.book_id ? <Link href={`/estudos/leitura/${i.book_id}`} className="hover:underline">{titulos.get(i.book_id)}</Link> : "Pessoal"}
                  <button type="button" onClick={() => excluir.mutate(i.id)} className="ml-3 opacity-0 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100">Excluir</button>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function PaginaLeitura() {
  const params = useSearchParams()
  const [aba, setAba] = React.useState<Aba>(params.get("aba") === "insights" ? "insights" : "estante")
  const [busca, setBusca] = React.useState("")
  const [novo, setNovo] = React.useState(false)
  const { data: livros = [], isLoading } = useLista("books", { colunas: COLUNAS_LIVRO_LISTA, ordem: [{ coluna: "title" }] })

  const atualizarLivro = useAtualizar("books")
  const [soFavoritos, setSoFavoritos] = React.useState(false)
  const lendo = livros.filter((l) => l.status === "lendo")
  const pausados = livros.filter((l) => l.status === "pausado")
  const lidos = livros.filter((l) => l.status === "finalizado").sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""))
  const desejos = livros.filter((l) => l.status === "desejo")
  const ano = new Date().getFullYear()
  const lidosAno = lidos.filter((l) => l.read_years.includes(ano) || l.finished_at?.startsWith(String(ano))).length

  const anoDe = (l: Livro) => (l.finished_at ? Number(l.finished_at.slice(0, 4)) : l.read_years.length ? Math.max(...l.read_years) : 0)
  const porAno = () => {
    const f = lidos.filter((l) => contem(`${l.title} ${l.author ?? ""}`, busca) && (!soFavoritos || l.favorite))
    const anos = [...new Set(f.map(anoDe))].sort((a, b) => b - a)
    if (!f.length) return <Vazio titulo="Nenhum livro aqui." />
    return (
      <div className="grid gap-10">
        {anos.map((a) => (
          <section key={a}>
            <h2 className="mb-3 flex items-baseline gap-2 font-display text-lg font-semibold">
              {a || "Sem data"} <span className="tabular text-sm font-normal text-ink-3">{f.filter((l) => anoDe(l) === a).length}</span>
            </h2>
            {grade(f.filter((l) => anoDe(l) === a))}
          </section>
        ))}
      </div>
    )
  }

  const grade = (lista: Livro[], acao?: (l: Livro) => React.ReactNode) => {
    const f = lista.filter((l) => contem(`${l.title} ${l.author ?? ""}`, busca) && (!soFavoritos || l.favorite))
    if (!f.length) return <Vazio titulo="Nenhum livro aqui." />
    return (
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
        {f.map((l) => (
          <li key={l.id}>
            <Link href={`/estudos/leitura/${l.id}`} className="block">
              <Lombada livro={l} />
              <div className="mt-2 flex items-center gap-1 text-xs text-ink-3">
                {l.rating ? <span className="text-estudos">{"★".repeat(l.rating)}</span> : null}
                {l.favorite ? <Star className="size-3 fill-estudos text-estudos" /> : null}
                {l.read_years.length ? <span className="tabular">{l.read_years.join(", ")}</span> : null}
              </div>
            </Link>
            {acao ? acao(l) : null}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div>
      <Cabecalho
        area="estudos"
        titulo="Leitura"
        descricao={`${lidosAno === 0 ? `Nenhum livro terminado em ${ano} ainda` : lidosAno === 1 ? `1 livro lido em ${ano}` : `${lidosAno} livros lidos em ${ano}`}, ${lidos.length} no total. Atualize a página em que parou e o progresso se ajusta sozinho.`}
        acoes={<Botao variante="primario" onClick={() => setNovo(true)}><Plus /> Adicionar livro</Botao>}
      />
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <Segmentos
          rotulo="Estante"
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: "estante", rotulo: "Lendo", contagem: lendo.length },
            { valor: "pausados", rotulo: "Pausados", contagem: pausados.length },
            { valor: "lidos", rotulo: "Lidos", contagem: lidos.length },
            { valor: "desejos", rotulo: "Quero ler", contagem: desejos.length },
            { valor: "insights", rotulo: "Insights" },
          ]}
        />
        {aba !== "insights" && aba !== "estante" ? (
          <>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por título ou autor" aria-label="Filtrar livros" className="h-9 min-w-56 rounded-md border border-line-strong bg-surface px-3 text-sm focus-visible:border-pen focus-visible:outline-none" />
            <button
              type="button"
              aria-pressed={soFavoritos}
              onClick={() => setSoFavoritos((v) => !v)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm ${soFavoritos ? "border-estudos bg-estudos-soft text-ink" : "border-line-strong text-ink-2 hover:text-ink"}`}
            >
              <Star className={`size-4 ${soFavoritos ? "fill-estudos text-estudos" : ""}`} /> Favoritos
            </button>
          </>
        ) : null}
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="min-w-0">
      {isLoading ? (
        <Carregando />
      ) : aba === "estante" ? (
        lendo.length === 0 ? (
          <Vazio titulo="Nenhum livro em leitura." descricao="Escolha um da lista de desejos ou adicione um novo." />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {lendo.map((l) => {
              const p = porcentagem(l.pages_read, l.pages_total)
              return (
                <li key={l.id} className="grid grid-cols-[6.5rem_1fr] gap-4 rounded-lg border border-line bg-surface p-3">
                  <Link href={`/estudos/leitura/${l.id}`}><Lombada livro={l} /></Link>
                  <div className="flex min-w-0 flex-col py-1">
                    <Link href={`/estudos/leitura/${l.id}`} className="font-medium leading-snug hover:underline">{l.title}</Link>
                    <p className="text-sm text-ink-2">{l.author}</p>
                    {l.status === "pausado" ? <p className="mt-1 text-xs text-ink-3">Pausado</p> : null}
                    <div className="mt-auto grid gap-2 pt-3">
                      <div className="flex items-center gap-2">
                        <Progresso valor={p} cor="estudos" rotulo={`Leitura de ${l.title}`} />
                        <span className="tabular w-9 shrink-0 text-right text-xs text-ink-3">{l.pages_total ? `${p}%` : ""}</span>
                      </div>
                      <AtualizarPagina livro={l} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )
      ) : aba === "pausados" ? (
        grade(pausados, (l) => (
          <button type="button" onClick={() => atualizarLivro.mutate({ id: l.id, status: "lendo" })} className="mt-1 text-xs font-medium text-pen hover:underline">
            Retomar leitura
          </button>
        ))
      ) : aba === "lidos" ? (
        porAno()
      ) : aba === "desejos" ? (
        grade(desejos, (l) => (
          <button
            type="button"
            onClick={() => atualizarLivro.mutate({ id: l.id, status: "lendo", started_at: l.started_at ?? isoDia() })}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-pen hover:underline"
          >
            <BookOpenCheck className="size-3.5" /> Comecei a ler
          </button>
        ))
      ) : (
        <Insights livros={livros} />
      )}
      </div>
      <aside className="order-first xl:order-none">
        <Pomodoro className="xl:sticky xl:top-6" />
      </aside>
      </div>

      <DialogoLivro aberta={novo} aoMudar={setNovo} statusInicial={aba === "desejos" ? "desejo" : aba === "lidos" ? "finalizado" : "lendo"} />
    </div>
  )
}
