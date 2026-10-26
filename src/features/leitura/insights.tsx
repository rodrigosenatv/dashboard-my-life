"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import * as React from "react"
import { ArrowRight, Quote } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { useDoisToques } from "@/components/ui/botao-excluir"
import { novoId, useCriar, useExcluir } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { cn, formatar } from "@/lib/utils"
import type { Livro } from "./dados"
import { normalizar } from "./logica"

type Insight = Tables<"insights">

/** Os trechos guardados dos livros (e os pessoais), sem os do Laboratório. */
export function trechosDeLeitura(insights: Insight[]): Insight[] {
  return insights.filter((i) => i.source !== "laboratorio")
}

function Trecho({ insight: i, livro, grande, aoExcluir }: { insight: Insight; livro?: Livro; grande?: boolean; aoExcluir?: () => void }) {
  return (
    <figure className={cn("vidro group relative flex h-full flex-col p-5", grande && "sm:p-6")}>
      <Quote aria-hidden className="size-5 text-[var(--b-luz)] drop-shadow-[0_0_8px_var(--b-luz)]" />
      <blockquote className={cn("mt-3 flex-1 font-display leading-snug text-ink", grande ? "text-lg sm:text-xl" : "line-clamp-5 text-base")}>{i.text}</blockquote>
      <figcaption className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-3">
        <span className="min-w-0 truncate">
          {livro ? (
            <Link href={`/estudos/leitura/${livro.id}`} className="font-medium text-ink-2 hover:text-ink hover:underline">
              {livro.title}
            </Link>
          ) : (
            "Pessoal"
          )}
          {i.noted_on || i.created_at ? <span> · {formatar(i.noted_on ?? i.created_at, "d MMM yyyy")}</span> : null}
        </span>
        {aoExcluir ? <ExcluirTrecho aoExcluir={aoExcluir} /> : null}
      </figcaption>
    </figure>
  )
}

function ExcluirTrecho({ aoExcluir }: { aoExcluir: () => void }) {
  const { armado, tocar, desarmar } = useDoisToques(aoExcluir)
  return (
    <button
      type="button"
      onClick={tocar}
      onBlur={desarmar}
      className={cn(
        "-my-2 shrink-0 rounded-md px-2 py-2 hover:text-[var(--danger)] focus-visible:opacity-100 toque:opacity-100",
        armado ? "font-medium text-[var(--danger)] opacity-100" : "opacity-0 group-hover:opacity-100",
      )}
    >
      {armado ? "Confirmar" : "Excluir"}
    </button>
  )
}

/** Os três trechos mais recentes, para a tela inicial da biblioteca. */
export function TrechosRecentes({ insights, livros, aoVerTodos }: { insights: Insight[]; livros: Livro[]; aoVerTodos: () => void }) {
  const lista = trechosDeLeitura(insights).slice(0, 3)
  const porId = new Map(livros.map((l) => [l.id, l]))
  if (!lista.length) return null
  return (
    <section aria-labelledby="trechos-recentes" className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="trechos-recentes" className="font-display text-xl font-semibold">
            Trechos guardados
          </h2>
          <p className="text-sm text-ink-3">As frases que você quis lembrar</p>
        </div>
        <button type="button" onClick={aoVerTodos} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium text-[var(--b-luz)] hover:bg-white/[0.06]">
          Ver todos <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
      <ul className="grid gap-3 md:grid-cols-3">
        {lista.map((i) => (
          <li key={i.id}>
            <Trecho insight={i} livro={i.book_id ? porId.get(i.book_id) : undefined} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Todos os trechos e insights, com busca, filtro por livro e o campo para guardar um novo. */
export function PainelInsights({ insights, livros }: { insights: Insight[]; livros: Livro[] }) {
  const criar = useCriar("insights")
  const excluir = useExcluir("insights")
  const [texto, setTexto] = React.useState("")
  const [livro, setLivro] = React.useState("")
  const [filtroLivro, setFiltroLivro] = React.useState("")
  const [busca, setBusca] = React.useState("")
  const porId = React.useMemo(() => new Map(livros.map((l) => [l.id, l])), [livros])
  const todos = trechosDeLeitura(insights)
  const comTrechos = React.useMemo(() => {
    const ids = new Set(todos.map((i) => i.book_id).filter(Boolean))
    return livros.filter((l) => ids.has(l.id)).sort((a, b) => a.title.localeCompare(b.title, "pt-BR"))
  }, [todos, livros])
  const termo = normalizar(busca)
  const lista = todos.filter((i) => (!filtroLivro || i.book_id === filtroLivro) && (!termo || normalizar(i.text).includes(termo)))

  return (
    <div className="grid gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!texto.trim()) return
          criar.mutate({ id: novoId(), text: texto.trim(), book_id: livro || null, source: livro ? "livro" : "pessoal" })
          setTexto("")
        }}
        className="vidro grid gap-3 p-4 sm:grid-cols-[1fr_14rem_auto] sm:items-center"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Uma frase que você quer lembrar"
          aria-label="Novo trecho"
          className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none toque:text-[16px]"
        />
        <select
          value={livro}
          onChange={(e) => setLivro(e.target.value)}
          aria-label="Livro do trecho"
          className="h-11 rounded-lg border border-line-strong bg-surface px-2 text-sm text-ink toque:text-[16px]"
        >
          <option value="">Sem livro</option>
          {[...livros]
            .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"))
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
        </select>
        <Botao type="submit" variante="primario" tamanho="lg" disabled={!texto.trim()}>
          Guardar
        </Botao>
      </form>

      {todos.length ? (
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nos trechos"
            aria-label="Buscar nos trechos"
            className="h-10 min-w-0 flex-1 rounded-full border border-line-strong bg-surface/60 px-4 text-sm text-ink placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none sm:max-w-xs toque:h-11 toque:text-[16px]"
          />
          {comTrechos.length ? (
            <select
              value={filtroLivro}
              onChange={(e) => setFiltroLivro(e.target.value)}
              aria-label="Filtrar por livro"
              className="h-10 max-w-[60vw] rounded-full border border-line-strong bg-surface/60 px-3 text-sm text-ink toque:h-11 toque:text-[16px]"
            >
              <option value="">Todos os livros</option>
              {comTrechos.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ) : null}

      {!lista.length ? (
        <p className="vidro px-5 py-8 text-center text-ink-2">{todos.length ? "Nenhum trecho com esse filtro." : "Nenhum trecho guardado ainda. No leitor, selecione um trecho e toque em “Guardar trecho”."}</p>
      ) : (
        <ul className="columns-1 gap-3 sm:columns-2 lg:columns-3 [&>li]:mb-3 [&>li]:break-inside-avoid">
          {lista.map((i) => (
            <li key={i.id}>
              <Trecho insight={i} livro={i.book_id ? porId.get(i.book_id) : undefined} grande aoExcluir={() => excluir.mutate(i.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
