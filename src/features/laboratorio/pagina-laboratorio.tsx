"use client"

import { useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { FlaskConical, Plus } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { ErroCarregar, Esqueleto } from "@/components/ui/basicos"
import { cn } from "@/lib/utils"
import { JanelaConcluir } from "./concluir"
import { useExperimentos, useInsightsDoLab } from "./dados"
import { EmTesteAgora } from "./destaque"
import { JanelaExperimento } from "./formulario"
import { placar, porStatus, type Experimento } from "./logica"
import { Descobertas, IdeiasParaTestar, JanelaComecar, Pausados, Resultados } from "./secoes"

const MOLDURA = "tema-lab laboratorio -mx-4 -mb-28 -mt-5 min-h-[calc(100dvh-7rem)] px-4 pb-32 pt-6 sm:mx-0 sm:mb-0 sm:mt-0 sm:min-h-0 sm:rounded-[1.75rem] sm:px-6 sm:pb-10 sm:pt-8 lg:px-8"

/**
 * Laboratório: o laboratório do futuro. O que está em teste numa bancada de vidro (o dia no anel de luz,
 * a faixa dos dias registrados e o registro do dia ali mesmo), as ideias para testar, os resultados
 * e as descobertas.
 */
export function PaginaLaboratorio() {
  const router = useRouter()
  const params = useSearchParams()
  const { data: experimentos = [], isLoading, error, refetch } = useExperimentos()
  const { data: insights = [] } = useInsightsDoLab()
  const [novo, setNovo] = React.useState(false)
  const [concluir, setConcluir] = React.useState<Experimento | null>(null)
  const [comecar, setComecar] = React.useState<Experimento | null>(null)

  // Links antigos (?abrir=<id>) levam para a tela do experimento
  const abrir = params.get("abrir")
  React.useEffect(() => {
    if (abrir) router.replace(`/estudos/laboratorio/${abrir}`)
  }, [abrir, router])

  const g = React.useMemo(() => porStatus(experimentos), [experimentos])
  const p = React.useMemo(() => placar(experimentos), [experimentos])

  const hud = [
    { n: g.em_teste.length, rotulo: "em teste", cor: "var(--b-luz)" },
    { n: g.a_iniciar.length, rotulo: g.a_iniciar.length === 1 ? "ideia" : "ideias" },
    { n: p.concluidos, rotulo: p.concluidos === 1 ? "concluído" : "concluídos" },
    ...(p.concluidos ? [{ n: p.funcionou, rotulo: p.funcionou === 1 ? "funcionou" : "funcionaram", cor: "var(--b-ambar)" }] : []),
  ]

  return (
    <div className={MOLDURA}>
      <header>
        <p className="rotulo-hud flex items-center gap-2">
          <FlaskConical className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Estudos · Laboratório de experimentos
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <h1 className="font-display text-[2.4rem] font-semibold leading-none tracking-tight sm:text-[3.25rem]">Laboratório</h1>
          <Botao variante="primario" tamanho="lg" onClick={() => setNovo(true)} className="shrink-0 px-4">
            <Plus /> Experimento
          </Botao>
        </div>
        <p className={cn("mt-1.5 max-w-2xl text-ink-2", experimentos.length > 0 && "hidden sm:block")}>
          Teste uma técnica, um hábito ou uma ferramenta por alguns dias, registre o que acontece e descubra o que funciona para você.
        </p>
        {experimentos.length ? (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Seus experimentos">
            {hud.map((h) => (
              <li key={h.rotulo} className="inline-flex min-h-9 items-baseline gap-1.5 rounded-full border border-[var(--b-borda)] bg-ink/[0.03] px-3 py-1 text-sm text-ink-2">
                <span className="tabular font-display text-base font-semibold" style={h.cor ? { color: h.cor } : undefined}>
                  {h.n}
                </span>
                {h.rotulo}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="mt-8">
        {isLoading ? (
          <Carregando />
        ) : error ? (
          <ErroCarregar erro={error} aoTentar={() => void refetch()} />
        ) : (
          <div className="grid gap-12">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
              <EmTesteAgora experimentos={g.em_teste} insights={insights} aoConcluir={setConcluir} aoNovo={() => setNovo(true)} ideias={g.a_iniciar} aoComecarIdeia={setComecar} />
              <div className="grid gap-4">
                <IdeiasParaTestar ideias={g.a_iniciar} aoComecar={setComecar} />
                <Descobertas insights={insights} experimentos={experimentos} />
              </div>
            </div>
            <Pausados lista={g.pausado} />
            <Resultados concluidos={g.concluido} abandonados={g.abandonado} />
          </div>
        )}
      </div>

      <JanelaExperimento aberta={novo} aoMudar={setNovo} />
      <JanelaConcluir experimento={concluir} aberta={Boolean(concluir)} aoMudar={(v) => !v && setConcluir(null)} />
      <JanelaComecar experimento={comecar} aoMudar={(v) => !v && setComecar(null)} />
    </div>
  )
}

function Carregando() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]" aria-busy="true" aria-label="Carregando o laboratório">
      <Esqueleto className="h-80 rounded-[1.25rem] bg-ink/[0.05]" />
      <div className="grid gap-4">
        <Esqueleto className="h-40 rounded-[1.25rem] bg-ink/[0.05]" />
        <Esqueleto className="h-40 rounded-[1.25rem] bg-ink/[0.05]" />
      </div>
    </div>
  )
}
