"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, CloudUpload, Play } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Esqueleto, Secao, Segmentos } from "@/components/ui/basicos"
import { dataRelativa, formatar, isoDia, plural } from "@/lib/utils"
import type { Colecao } from "@/features/colecoes/visao-colecao"
import { camposExercicio, lerExercicio, listarFichas, useItensDe } from "./dados"
import { contar, gravarSessao, novaSessao, proximaFicha, rotuloDaFicha, salvarSessao, useHistoricoTreino, useSessaoAtiva, type SessaoAtiva } from "./sessao"
import { SemanaTreino } from "./semana"

const nomeCurto = (valor: string) => rotuloDaFicha(valor).split(" · ")[0]

/**
 * O que fazer hoje: o próximo treino do rodízio (A, B, C…) com o botão de começar, o treino
 * em andamento para continuar, ou o que ficou para salvar. Abaixo, a semana.
 */
export function HojeTreino({ exercicios: colecao, historico }: { exercicios: Colecao | undefined; historico: Colecao | undefined }) {
  const router = useRouter()
  const qc = useQueryClient()
  const sessao = useSessaoAtiva()
  const { data: itens = [], isLoading } = useItensDe(colecao)
  const { sessoes, indice, carregando } = useHistoricoTreino(historico)
  const campos = React.useMemo(() => camposExercicio(colecao, itens), [colecao, itens])
  const exercicios = React.useMemo(() => itens.map((i) => lerExercicio(i, campos)), [itens, campos])
  const fichas = React.useMemo(() => listarFichas(exercicios), [exercicios])
  const [escolhida, setEscolhida] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)
  const emCurso = React.useRef(false)

  // Treino terminado sem internet: tenta salvar ao abrir a página e quando a conexão volta
  const salvarPendente = React.useCallback(
    async (s: SessaoAtiva, avisarErro: boolean) => {
      if (emCurso.current) return
      emCurso.current = true
      setSalvando(true)
      try {
        await salvarSessao(s)
        gravarSessao(null)
        await Promise.all(["collection_items", "collections", "habit_logs"].map((t) => qc.invalidateQueries({ queryKey: [t] })))
        toast.success("Treino salvo", { description: rotuloDaFicha(s.ficha) })
      } catch {
        if (avisarErro) toast.error("Ainda não deu para salvar.", { description: "O treino continua guardado neste aparelho." })
      } finally {
        emCurso.current = false
        setSalvando(false)
      }
    },
    [qc],
  )
  React.useEffect(() => {
    if (!sessao?.pendente) return
    void salvarPendente(sessao, false)
    const aoVoltar = () => void salvarPendente(sessao, false)
    window.addEventListener("online", aoVoltar)
    return () => window.removeEventListener("online", aoVoltar)
  }, [sessao, salvarPendente])

  const sugerida = proximaFicha(fichas, sessoes)
  const ficha = fichas.find((f) => f.valor === escolhida) ?? sugerida
  const daFicha = ficha ? exercicios.filter((e) => e.fichas.includes(ficha.valor)) : []
  const seriesDaFicha = daFicha.reduce((t, e) => t + (e.series ?? 0), 0)
  const hoje = isoDia()
  const deHoje = sessoes.filter((s) => s.data === hoje).at(-1)
  const ultima = sessoes.at(-1)

  const comecar = () => {
    if (!ficha || !daFicha.length) return
    gravarSessao(novaSessao(ficha, daFicha, indice))
    router.push("/treinar")
  }

  let conteudo: React.ReactNode
  if (isLoading || carregando) conteudo = <Esqueleto className="h-36" />
  else if (sessao?.pendente)
    conteudo = (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-warning">Ainda não salvo</p>
          <h3 className="text-2xl font-semibold leading-tight">{rotuloDaFicha(sessao.ficha)}</h3>
          <p className="mt-1 text-sm text-ink-2">
            Ficou guardado neste aparelho. {salvando ? "Salvando…" : "É salvo sozinho quando a internet voltar."}
          </p>
        </div>
        <Botao variante="primario" disabled={salvando} className="max-sm:w-full" onClick={() => void salvarPendente(sessao, true)}>
          <CloudUpload /> Salvar agora
        </Botao>
      </div>
    )
  else if (sessao) {
    const c = contar(sessao)
    const dia = isoDia(new Date(sessao.inicio))
    conteudo = (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-pen">Em andamento</p>
          <h3 className="text-2xl font-semibold leading-tight">{rotuloDaFicha(sessao.ficha)}</h3>
          <p className="mt-1 text-sm text-ink-2">
            Começou {dia === hoje ? "" : `${dataRelativa(dia)} `}às {formatar(sessao.inicio, "HH:mm")} · {c.feitas} de {c.previstas} séries
          </p>
        </div>
        <Botao variante="primario" tamanho="lg" className="max-sm:w-full" onClick={() => router.push("/treinar")}>
          <Play /> Continuar treino
        </Botao>
      </div>
    )
  } else if (!ficha)
    conteudo = <p className="text-sm text-ink-2">Coloque os exercícios nas fichas (A, B, C…) logo abaixo para começar a registrar os treinos.</p>
  else
    conteudo = (
      <>
        {deHoje ? (
          <p className="mb-4 flex items-center gap-2 rounded-lg bg-pen-soft px-3 py-2 text-sm">
            <Check className="size-4 shrink-0 text-pen" />
            <span>
              <strong className="font-semibold">{nomeCurto(deHoje.ficha)}</strong> feito hoje
              {deHoje.duracao ? ` · ${deHoje.duracao} min` : ""} · {plural(deHoje.series.length, "série")}
            </span>
          </p>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-3">{ficha.valor !== sugerida?.valor ? "Treino escolhido" : ultima ? "Próximo treino" : "Para começar"}</p>
            <h3 className="text-2xl font-semibold leading-tight">{rotuloDaFicha(ficha.valor)}</h3>
            <p className="mt-1 text-sm text-ink-2">
              {plural(daFicha.length, "exercício")}
              {seriesDaFicha ? ` · ${seriesDaFicha} séries` : ""}
              {ultima ? ` · último: ${nomeCurto(ultima.ficha)} ${dataRelativa(ultima.data)}` : ""}
            </p>
          </div>
          {fichas.length > 1 ? (
            <Segmentos rotulo="Escolher a ficha" valor={ficha.valor} aoMudar={setEscolhida} opcoes={fichas.map((f) => ({ valor: f.valor, rotulo: f.letra }))} />
          ) : null}
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-ink-3">{daFicha.map((e) => e.nome).join(" · ")}</p>
        <Botao variante={deHoje ? "contorno" : "primario"} tamanho="lg" className="mt-4 w-full sm:w-auto" disabled={!daFicha.length} onClick={comecar}>
          <Play /> {deHoje ? `Começar outro: ${nomeCurto(ficha.valor)}` : `Começar ${nomeCurto(ficha.valor)}`}
        </Botao>
      </>
    )

  return (
    <Secao titulo="Hoje">
      <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        {conteudo}
        <div className="mt-5 border-t border-line pt-4">
          <SemanaTreino />
        </div>
      </div>
    </Secao>
  )
}
