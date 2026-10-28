"use client"

import * as React from "react"
import { cn, plural } from "@/lib/utils"
import type { Livro } from "./dados"
import { anoDeLeitura, anosDeLeitura, categorias, filtrarAcervo, type FiltroAcervo, type OrdemAcervo } from "./logica"
import { LivroNaGrade } from "./prateleira"

export type EstadoAcervo = { filtro: FiltroAcervo; categoria: string; ano: number | null; ordem: OrdemAcervo }

const FILTROS: { valor: FiltroAcervo; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "lendo", rotulo: "Lendo" },
  { valor: "desejos", rotulo: "Quero ler" },
  { valor: "lidos", rotulo: "Lidos" },
  { valor: "pausados", rotulo: "Pausados" },
  { valor: "favoritos", rotulo: "Favoritos" },
]

const ORDENS: { valor: OrdemAcervo; rotulo: string }[] = [
  { valor: "recentes", rotulo: "Mais recentes" },
  { valor: "titulo", rotulo: "Título (A–Z)" },
  { valor: "autor", rotulo: "Autor (A–Z)" },
  { valor: "nota", rotulo: "Maior nota" },
]

const estiloSeletor =
  "h-10 rounded-full border border-line-strong bg-[var(--b-fundo)]/60 px-3 text-sm text-ink focus-visible:border-[var(--b-luz)] focus-visible:outline-none toque:h-11 toque:text-[16px]"

/** A linha de informação de cada livro na grade, conforme o filtro. */
function infoDoLivro(l: Livro, filtro: FiltroAcervo): string | undefined {
  if (filtro === "lidos" || (filtro === "todos" && l.status === "finalizado")) {
    const ano = anoDeLeitura(l)
    return [l.author, ano ? String(ano) : null].filter(Boolean).join(" · ") || undefined
  }
  return l.author ?? undefined
}

/** O acervo inteiro em grade, com filtros por situação, categoria e ano, e a ordem. */
export function Acervo({ livros, busca, estado, aoMudar }: { livros: Livro[]; busca: string; estado: EstadoAcervo; aoMudar: (e: Partial<EstadoAcervo>) => void }) {
  const lista = React.useMemo(() => filtrarAcervo(livros, { ...estado, busca }), [livros, estado, busca])
  const cats = React.useMemo(() => categorias(livros), [livros])
  const anos = React.useMemo(() => anosDeLeitura(livros), [livros])
  const contagem = (f: FiltroAcervo) => filtrarAcervo(livros, { filtro: f }).length

  return (
    <div className="grid gap-5">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:flex-wrap lg:px-0">
        {FILTROS.map((f) => {
          const ativo = estado.filtro === f.valor
          return (
            <button
              key={f.valor}
              type="button"
              aria-pressed={ativo}
              onClick={() => aoMudar({ filtro: f.valor, ano: f.valor === "lidos" || f.valor === "todos" ? estado.ano : null })}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors toque:min-h-11",
                ativo ? "border-[var(--b-luz)] bg-[var(--b-luz)]/12 text-ink" : "border-line-strong text-ink-2 hover:text-ink",
              )}
            >
              {f.rotulo}
              <span className="tabular text-xs text-ink-3">{contagem(f.valor)}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {cats.length ? (
          <select aria-label="Categoria" value={estado.categoria} onChange={(e) => aoMudar({ categoria: e.target.value })} className={cn(estiloSeletor, "max-w-[70vw]")}>
            <option value="">Todas as categorias</option>
            {cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null}
        {anos.length && (estado.filtro === "lidos" || estado.filtro === "todos") ? (
          <select aria-label="Ano de leitura" value={estado.ano ?? ""} onChange={(e) => aoMudar({ ano: e.target.value ? Number(e.target.value) : null })} className={estiloSeletor}>
            <option value="">Qualquer ano</option>
            {anos.map((a) => (
              <option key={a} value={a}>
                Lidos em {a}
              </option>
            ))}
          </select>
        ) : null}
        <select aria-label="Ordem" value={estado.ordem} onChange={(e) => aoMudar({ ordem: e.target.value as OrdemAcervo })} className={estiloSeletor}>
          {ORDENS.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
        <p aria-live="polite" className="ml-auto text-sm text-ink-3">
          {plural(lista.length, "livro")}
        </p>
      </div>

      {lista.length ? (
        <ul className="grid grid-cols-3 gap-x-3.5 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {lista.map((l) => (
            <LivroNaGrade key={l.id} livro={l} info={infoDoLivro(l, estado.filtro)} />
          ))}
        </ul>
      ) : (
        <p className="vidro px-5 py-10 text-center text-ink-2">{busca.trim() ? `Nada encontrado para “${busca.trim()}”.` : "Nenhum livro com esses filtros."}</p>
      )}
    </div>
  )
}
