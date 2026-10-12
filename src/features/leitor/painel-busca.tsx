"use client"

import * as React from "react"
import { LoaderCircle, Search } from "lucide-react"
import type { ResultadoBusca, VisaoFoliate } from "./foliate"
import { PainelLeitor } from "./painel-leitor"

type Grupo = { rotulo: string; itens: ResultadoBusca[] }

/** Busca no texto do livro inteiro (sem diferenciar acentos nem maiúsculas). */
export function PainelBusca({
  visao,
  cor,
  aoIr,
  aoFechar,
}: {
  visao: React.RefObject<VisaoFoliate | null>
  cor: string
  aoIr: (cfi: string) => void
  aoFechar: () => void
}) {
  const [termo, setTermo] = React.useState("")
  const [grupos, setGrupos] = React.useState<Grupo[]>([])
  const [buscando, setBuscando] = React.useState(false)
  const [progresso, setProgresso] = React.useState(0)
  const [feito, setFeito] = React.useState(false)
  const rodada = React.useRef(0)

  React.useEffect(() => () => void (rodada.current += 1), [])

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = visao.current
    const q = termo.trim()
    if (!v || q.length < 2) return
    const minha = ++rodada.current
    setGrupos([])
    setFeito(false)
    setBuscando(true)
    setProgresso(0)
    try {
      v.clearSearch()
      for await (const r of v.search({ query: q, drawOptions: { color: cor, width: 2, radius: 3 } })) {
        if (rodada.current !== minha) return
        if (r === "done") break
        if ("subitems" in r && r.subitems) {
          const grupo = { rotulo: r.label ?? "", itens: r.subitems }
          setGrupos((g) => [...g, grupo])
        } else if ("progress" in r && typeof r.progress === "number") setProgresso(r.progress)
      }
    } finally {
      if (rodada.current === minha) {
        setBuscando(false)
        setFeito(true)
      }
    }
  }

  const total = grupos.reduce((n, g) => n + g.itens.length, 0)

  return (
    <PainelLeitor titulo="Buscar no livro" aoFechar={aoFechar}>
      <form onSubmit={buscar} className="sticky top-0 z-10 -mx-5 mb-2 flex gap-2 bg-[var(--l-painel)] px-5 pb-3">
        <input
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Palavra ou trecho"
          aria-label="Buscar no livro"
          autoFocus
          className="h-11 min-w-0 flex-1 rounded-lg border bg-[var(--l-fundo)] px-3 text-[16px] outline-none focus:border-[var(--l-link)]"
          style={{ borderColor: "var(--l-borda)" }}
        />
        <button type="submit" aria-label="Buscar" className="grid size-11 place-items-center rounded-lg bg-[var(--l-realce)]" disabled={buscando}>
          {buscando ? <LoaderCircle className="size-5 animate-spin" /> : <Search className="size-5" />}
        </button>
      </form>
      {buscando ? <p className="tabular mb-2 text-xs text-[var(--l-suave)]">Procurando… {Math.round(progresso * 100)}%</p> : null}
      {feito && !buscando ? (
        <p className="mb-2 text-xs text-[var(--l-suave)]">{total ? `${total} ${total === 1 ? "resultado" : "resultados"}` : "Nada encontrado."}</p>
      ) : null}
      <div className="grid gap-4">
        {grupos.map((g, i) => (
          <section key={i}>
            {g.rotulo ? <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--l-suave)]">{g.rotulo}</h3> : null}
            <ul className="grid">
              {g.itens.map((item) => (
                <li key={item.cfi}>
                  <button
                    type="button"
                    onClick={() => aoIr(item.cfi)}
                    className="w-full rounded-lg px-2 py-2 text-left text-sm leading-snug hover:bg-[var(--l-realce)]"
                  >
                    {item.excerpt.pre}
                    <mark className="rounded-sm bg-[color-mix(in_srgb,var(--l-link)_30%,transparent)] px-0.5 text-inherit">{item.excerpt.match}</mark>
                    {item.excerpt.post}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PainelLeitor>
  )
}
