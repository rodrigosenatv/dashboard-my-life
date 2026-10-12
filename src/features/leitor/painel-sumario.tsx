"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { ItemSumarioLivro } from "./foliate"
import { PainelLeitor } from "./painel-leitor"

type Props = {
  itens: ItemSumarioLivro[]
  atual: string | null
  paginas: { label: string; href: string }[]
  paginaAtual: string | null
  aoIr: (href: string) => void
  aoFechar: () => void
}

export function PainelSumario({ itens, atual, paginas, paginaAtual, aoIr, aoFechar }: Props) {
  const lista = React.useRef<HTMLDivElement>(null)
  const [pagina, setPagina] = React.useState("")

  // Centraliza o capítulo atual rolando só a lista do painel (scrollIntoView rolaria também a tela do leitor)
  React.useEffect(() => {
    const item = lista.current?.querySelector<HTMLElement>("[aria-current='true']")
    const rolagem = item?.closest<HTMLElement>("[data-rolagem]")
    if (!item || !rolagem) return
    const a = item.getBoundingClientRect()
    const r = rolagem.getBoundingClientRect()
    rolagem.scrollTop += a.top - r.top - (r.height - a.height) / 2
  }, [])

  const irParaPagina = (e: React.FormEvent) => {
    e.preventDefault()
    const n = Number(pagina)
    if (!n) return
    // A página pedida ou a mais próxima antes dela (páginas sem texto podem faltar)
    const exata = paginas.find((p) => Number(p.label) === n)
    const anterior = [...paginas].reverse().find((p) => Number(p.label) <= n)
    const alvo = exata ?? anterior ?? paginas[0]
    if (alvo) aoIr(alvo.href)
  }

  const ultima = paginas.at(-1)?.label

  return (
    <PainelLeitor titulo="Sumário" aoFechar={aoFechar}>
      {paginas.length ? (
        <form onSubmit={irParaPagina} className="mb-3 flex items-center gap-2 border-b pb-4" style={{ borderColor: "var(--l-borda)" }}>
          <label htmlFor="ir-pagina" className="text-sm">
            Ir para a página
          </label>
          <input
            id="ir-pagina"
            inputMode="numeric"
            value={pagina}
            placeholder={paginaAtual ?? ""}
            onChange={(e) => setPagina(e.target.value.replace(/\D/g, ""))}
            className="tabular h-11 w-20 rounded-lg border bg-[var(--l-fundo)] px-2 text-center text-[16px] outline-none focus:border-[var(--l-link)]"
            style={{ borderColor: "var(--l-borda)" }}
          />
          {ultima ? <span className="tabular text-sm text-[var(--l-suave)]">de {ultima}</span> : null}
          <button type="submit" className="ml-auto min-h-11 rounded-lg bg-[var(--l-realce)] px-4 text-sm font-medium">
            Ir
          </button>
        </form>
      ) : null}
      <div ref={lista}>
        {itens.length ? (
          <Lista itens={itens} atual={atual} aoIr={aoIr} nivel={0} />
        ) : (
          <p className="py-4 text-sm text-[var(--l-suave)]">Este livro não tem sumário.</p>
        )}
      </div>
    </PainelLeitor>
  )
}

function Lista({ itens, atual, aoIr, nivel }: { itens: ItemSumarioLivro[]; atual: string | null; aoIr: (href: string) => void; nivel: number }) {
  return (
    <ol className={cn("grid", nivel > 0 && "border-l pl-3")} style={nivel > 0 ? { borderColor: "var(--l-borda)" } : undefined}>
      {itens.map((item, i) => {
        const ativo = Boolean(atual && item.href === atual)
        return (
          <li key={`${item.href}-${i}`}>
            <button
              type="button"
              aria-current={ativo}
              onClick={() => aoIr(item.href)}
              className={cn(
                "w-full rounded-lg px-2 py-2.5 text-left text-sm leading-snug hover:bg-[var(--l-realce)]",
                nivel === 0 ? "font-medium" : "text-[var(--l-suave)]",
                ativo && "bg-[var(--l-realce)] font-semibold text-[var(--l-link)]",
              )}
            >
              {item.label?.trim() || "Sem título"}
            </button>
            {item.subitems?.length ? <Lista itens={item.subitems} atual={atual} aoIr={aoIr} nivel={nivel + 1} /> : null}
          </li>
        )
      })}
    </ol>
  )
}
