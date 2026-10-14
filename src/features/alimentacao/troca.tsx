"use client"

import * as React from "react"
import { ArrowLeft, Check, Search } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Vazio } from "@/components/ui/basicos"
import { Entrada } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { cn, contem } from "@/lib/utils"
import { gramas, kcal } from "./calculo"
import type { Refeicao } from "./dados"
import { combinaComRefeicao, valorDaReceita, type Receita } from "./receitas"

/**
 * Trocar uma refeição do dia por uma receita: as que combinam com a refeição vêm primeiro.
 * A troca vale só para aquele dia e conta uma porção da receita no lugar do plano.
 */
export function TrocarPorReceita({
  refeicao,
  receitas,
  atual,
  aoFechar,
  aoEscolher,
  aoVoltarAoPlano,
  aoDefinirRende,
}: {
  /** A refeição sendo trocada (null fecha a janela). */
  refeicao: Refeicao | null
  receitas: Receita[]
  /** A receita escolhida antes, se houver. */
  atual?: string
  aoFechar: () => void
  aoEscolher: (receitaId: string) => void
  aoVoltarAoPlano: () => void
  aoDefinirRende: (r: Receita, n: number) => void
}) {
  const [busca, setBusca] = React.useState("")
  const [perguntando, setPerguntando] = React.useState<Receita | null>(null)
  React.useEffect(() => {
    if (!refeicao) return
    setBusca("")
    setPerguntando(null)
  }, [refeicao])

  const nome = refeicao?.nome ?? ""
  const visiveis = receitas.filter((r) => !busca.trim() || contem(r.nome, busca) || r.ingredientes.some((i) => contem(i, busca)))
  const daRefeicao = visiveis.filter((r) => combinaComRefeicao(r, nome))
  const outras = visiveis.filter((r) => !combinaComRefeicao(r, nome))

  const escolher = (r: Receita) => {
    // Sem saber quantas porções a receita rende, a troca contaria a panela inteira
    if (!r.calc.rendeConhecido && r.calc.itens.length) return setPerguntando(r)
    aoEscolher(r.item.id)
    aoFechar()
  }

  const linha = (r: Receita) => (
    <li key={r.item.id}>
      <button
        type="button"
        onClick={() => escolher(r)}
        aria-current={atual === r.item.id ? "true" : undefined}
        className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-2 toque:min-h-14", atual === r.item.id && "bg-pen-soft/50")}
      >
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-snug">{r.nome}</span>
          <span className="block text-xs text-ink-3">
            {valorDaReceita(r)}
            {r.calc.semCalculo ? " · parte sem cálculo" : ""}
          </span>
        </span>
        {atual === r.item.id ? <Check className="size-4 shrink-0 text-pen" aria-label="Escolhida" /> : null}
      </button>
    </li>
  )

  return (
    <Janela
      aberta={Boolean(refeicao)}
      aoMudar={(v) => !v && aoFechar()}
      titulo={perguntando ? "Quantas porções?" : `Trocar ${nome.toLocaleLowerCase("pt-BR")} por uma receita`}
      descricao={perguntando ? "A troca conta uma porção no dia." : "Vale só para este dia e conta no lugar do plano. Marque como feita quando comer."}
      rodape={
        perguntando ? (
          <Botao variante="fantasma" className="mr-auto" onClick={() => setPerguntando(null)}>
            <ArrowLeft /> Voltar
          </Botao>
        ) : (
          <>
            {atual ? (
              <Botao
                variante="fantasma"
                className="mr-auto"
                onClick={() => {
                  aoVoltarAoPlano()
                  aoFechar()
                }}
              >
                Voltar ao plano
              </Botao>
            ) : null}
            <Botao variante="primario" onClick={aoFechar}>
              Fechar
            </Botao>
          </>
        )
      }
    >
      {perguntando ? (
        <div className="grid gap-4">
          <p className="text-sm">
            Quantas porções rende <span className="font-medium">“{perguntando.nome}”</span>?
          </p>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Porções que a receita rende">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <Botao
                key={n}
                variante="contorno"
                tamanho="lg"
                onClick={() => {
                  aoDefinirRende(perguntando, n)
                  aoEscolher(perguntando.item.id)
                  aoFechar()
                }}
              >
                {n}
              </Botao>
            ))}
          </div>
          <p className="text-xs text-ink-3">
            A receita toda tem {kcal(perguntando.calc.total.kcal)} kcal e {gramas(perguntando.calc.total.p)} g de proteína. A resposta fica guardada na receita.
          </p>
        </div>
      ) : receitas.length === 0 ? (
        <Vazio titulo="Nenhuma receita ainda." descricao="Crie receitas na seção Receitas, mais abaixo na página, e elas aparecem aqui." />
      ) : (
        <div className="grid gap-4">
          <label className="relative block">
            <span className="sr-only">Buscar receita</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar receita ou ingrediente" className="pl-8" />
          </label>
          {daRefeicao.length ? (
            <section>
              <h3 className="mb-1 text-xs font-medium text-ink-3">Para {nome.toLocaleLowerCase("pt-BR")}</h3>
              <ul className="-mx-3 grid">{daRefeicao.map(linha)}</ul>
            </section>
          ) : null}
          {outras.length ? (
            <section>
              <h3 className="mb-1 text-xs font-medium text-ink-3">{daRefeicao.length ? "Outras receitas" : "Receitas"}</h3>
              <ul className="-mx-3 grid">{outras.map(linha)}</ul>
            </section>
          ) : null}
          {!visiveis.length ? <p className="text-sm text-ink-2">Nenhuma receita com “{busca}”.</p> : null}
        </div>
      )}
    </Janela>
  )
}
