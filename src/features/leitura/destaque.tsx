"use client"

import Link from "next/link"
import * as React from "react"
import { BookMarked, BookOpen, Library, Sparkles } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { cn, formatar } from "@/lib/utils"
import { Livro3D } from "./capa"
import type { Livro } from "./dados"
import { codigoDoLivro, diaIso, fracaoLida, paginasRestantes, paginasEntre, plural, previsaoDeTermino, ritmoDoLivro, textoPagina, type DiaLeitura } from "./logica"

/**
 * "Lendo agora": o livro em 3D sobre o pedestal de luz, o progresso e as ações. Com mais de um
 * livro aberto, os cartões deslizam para o lado.
 */
export function LendoAgora({
  livros,
  dias,
  temArquivo,
  aoAtualizar,
  aoEscolherProximo,
  temFila,
}: {
  livros: Livro[]
  dias: DiaLeitura[]
  temArquivo: (id: string) => boolean
  aoAtualizar: (l: Livro) => void
  aoEscolherProximo: () => void
  temFila: boolean
}) {
  const trilho = React.useRef<HTMLUListElement>(null)
  const [atual, setAtual] = React.useState(0)

  React.useEffect(() => {
    const el = trilho.current
    if (!el || livros.length < 2) return
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) if (e.isIntersecting) setAtual(Number((e.target as HTMLElement).dataset.indice))
      },
      { root: el, threshold: 0.6 },
    )
    for (const li of Array.from(el.children)) observador.observe(li)
    return () => observador.disconnect()
  }, [livros.length])

  if (!livros.length) return <SemLeitura aoEscolherProximo={aoEscolherProximo} temFila={temFila} />

  const ir = (i: number) => {
    const el = trilho.current?.children[i] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" })
  }

  return (
    <section aria-label="Lendo agora" className="min-w-0">
      <ul
        ref={trilho}
        className={cn(
          "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 scroll-px-4 [scrollbar-width:none] lg:mx-0 lg:px-0 lg:scroll-px-0 [&::-webkit-scrollbar]:hidden",
          livros.length === 1 && "overflow-visible",
        )}
      >
        {livros.map((l, i) => (
          <li key={l.id} data-indice={i} className={cn("snap-start", livros.length > 1 ? "w-[88%] shrink-0 sm:w-[84%] lg:w-[88%]" : "w-full")}>
            <CartaoLendo livro={l} dias={dias} temArquivo={temArquivo(l.id)} aoAtualizar={() => aoAtualizar(l)} prioridade={i === 0} />
          </li>
        ))}
      </ul>
      {livros.length > 1 ? (
        <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="Livros em leitura">
          {livros.map((l, i) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={i === atual}
              aria-label={l.title}
              onClick={() => ir(i)}
              className="relative grid h-6 place-items-center px-1 toque:h-8"
            >
              <span className={cn("block h-1.5 rounded-full transition-all", i === atual ? "w-6 bg-[var(--b-luz)] shadow-[0_0_8px_var(--b-luz)]" : "w-1.5 bg-white/25")} />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function CartaoLendo({ livro: l, dias, temArquivo, aoAtualizar, prioridade }: { livro: Livro; dias: DiaLeitura[]; temArquivo: boolean; aoAtualizar: () => void; prioridade?: boolean }) {
  const hoje = diaIso()
  const pct = Math.round(fracaoLida(l) * 100)
  const restam = paginasRestantes(l)
  const ritmo = ritmoDoLivro(dias, l.id, hoje)
  const previsao = previsaoDeTermino(restam, ritmo, hoje)
  const lidasHoje = paginasEntre(
    dias.filter((d) => d.livro === l.id),
    hoje,
    hoje,
  )

  return (
    // No celular: o livro pequeno ao lado do título e, embaixo, o progresso e os botões (cabe na primeira tela).
    // A partir do tablet: o livro grande à esquerda e tudo à direita.
    <article className="vidro relative grid h-full grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-5 gap-y-5 overflow-hidden p-5 pb-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-8 sm:p-7 lg:p-8">
      {/* Brilho atrás do livro */}
      <span aria-hidden className="pointer-events-none absolute -left-16 -top-20 size-72 rounded-full bg-[var(--b-luz)]/15 blur-3xl" />
      <div className="relative w-full pb-4 sm:row-span-2 sm:w-44 sm:pb-5 lg:w-48">
        <Link href={`/estudos/leitura/${l.id}`} aria-label={`Abrir ${l.title}`} className="flutuar block rounded-md focus-visible:outline-none">
          <Livro3D livro={l} prioridade={prioridade} />
        </Link>
        <span aria-hidden className="pedestal" />
      </div>

      <div className="relative min-w-0 sm:self-end">
        <p className="rotulo-hud flex items-center gap-2">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--b-luz)] opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--b-luz)]" />
          </span>
          <span className="truncate">
            Lendo agora<span className="hidden sm:inline"> · {codigoDoLivro(l)}</span>
          </span>
        </p>
        <h2 className="mt-2 font-display text-[1.5rem] font-semibold leading-[1.1] tracking-tight text-balance sm:text-4xl">
          <Link href={`/estudos/leitura/${l.id}`} className="hover:underline hover:decoration-[var(--b-luz)]/60 hover:underline-offset-4">
            {l.title}
          </Link>
        </h2>
        {l.author ? <p className="mt-1.5 text-ink-2">{l.author}</p> : null}
      </div>

      <div className="relative col-span-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:self-start">
        <div className="flex items-center gap-3">
          <div className="barra-luz flex-1" role="progressbar" aria-label={`Progresso de ${l.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <span className="tabular w-11 shrink-0 text-right text-sm font-semibold">{l.pages_total ? `${pct}%` : ""}</span>
        </div>
        <p className="tabular mt-2 text-sm text-ink-2">
          {textoPagina(l)}
          {restam ? ` · faltam ${plural(restam, "página")}` : ""}
        </p>
        {lidasHoje > 0 || previsao ? (
          <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-3">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[var(--b-ambar)]" aria-hidden />
            <span>
              {lidasHoje > 0 ? `Hoje: ${plural(lidasHoje, "página")}` : null}
              {lidasHoje > 0 && previsao ? " · " : null}
              {previsao ? (previsao.dias <= 1 ? "termina amanhã no seu ritmo" : `no seu ritmo, termina em ${previsao.dias} dias (${formatar(previsao.dia, "d 'de' MMM")})`) : null}
            </span>
          </p>
        ) : null}

        {/* Com o arquivo, "Continuar lendo" é a ação (o leitor já marca a página); sem arquivo, marcar a página */}
        <div className="mt-5 flex gap-2 sm:flex-wrap">
          {temArquivo ? (
            <Botao asChild variante="primario" tamanho="lg" className="flex-1 shadow-[0_0_24px_-4px_var(--b-luz)] sm:flex-none">
              <Link href={`/ler/${l.id}`}>
                <BookOpen /> Continuar lendo
              </Link>
            </Botao>
          ) : null}
          <Botao
            variante={temArquivo ? "contorno" : "primario"}
            tamanho="lg"
            onClick={aoAtualizar}
            aria-label="Atualizar página"
            title="Atualizar página"
            className={cn(temArquivo ? "size-11 bg-transparent px-0 sm:w-auto sm:px-5" : "flex-1 shadow-[0_0_24px_-4px_var(--b-luz)] sm:flex-none")}
          >
            <BookMarked /> <span className={cn(temArquivo && "sr-only sm:not-sr-only")}>Atualizar página</span>
          </Botao>
        </div>
      </div>
    </article>
  )
}

function SemLeitura({ aoEscolherProximo, temFila }: { aoEscolherProximo: () => void; temFila: boolean }) {
  return (
    <section aria-label="Lendo agora" className="vidro relative overflow-hidden px-6 py-10 text-center sm:py-12">
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-0 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--b-luz)]/15 blur-3xl" />
      <Library className="relative mx-auto size-8 text-[var(--b-luz)]" aria-hidden />
      <h2 className="relative mt-3 font-display text-2xl font-semibold">A sala de leitura está em silêncio</h2>
      <p className="relative mx-auto mt-1.5 max-w-sm text-ink-2">
        {temFila ? "Escolha o próximo livro da fila e ele aparece aqui, pronto para continuar." : "Adicione um livro e marque como “Lendo” para ele aparecer aqui."}
      </p>
      {temFila ? (
        <Botao variante="primario" tamanho="lg" className="relative mt-5" onClick={aoEscolherProximo}>
          Escolher o próximo
        </Botao>
      ) : null}
    </section>
  )
}
