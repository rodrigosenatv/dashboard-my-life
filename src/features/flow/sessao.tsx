"use client"

import * as React from "react"
import { CalendarClock, Check, ChevronDown, FolderKanban, Pause, Play, RotateCcw, SkipForward, TriangleAlert, X } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Entrada, Seletor } from "@/components/ui/campos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { useProjetosPorNome } from "@/features/projetos/dados"
import { novoId, useAtualizar, useCriar } from "@/lib/data"
import { cn, isoDia } from "@/lib/utils"
import {
  CICLOS_ATE_LONGA,
  RITMOS,
  ROTULO_FASE,
  bolinhas,
  ciclosDaTarefa,
  conflitaComFoco,
  doDia,
  duracao,
  mmss,
  perdeProgresso,
  proximaSugestao,
  proximoCompromisso,
  resumoDoDia,
  rodando,
  rotuloBotao,
  tarefasDeHoje,
  textoBolinhas,
  textoCiclosTarefa,
  textoPrazo,
  textoProximo,
  type Evento,
  type Fase,
  type RitmoId,
  type Sessao,
  type Tarefa,
} from "./logica"
import { useEventos, useTarefas } from "./dados"
import { PilulaFoco } from "./indicador"
import { foco, useAgora, useAvisoFoco, useRestante, useSessaoFoco } from "./relogio"

const FASES: Fase[] = ["foco", "pausa", "longa"]
const RAIO = 46
const VOLTA = 2 * Math.PI * RAIO
const SEM_TAREFAS: Tarefa[] = []
const SEM_EVENTOS: Evento[] = []

/** Um aviso com "Desfazer", que volta ao estado de antes da ação. */
function avisarComDesfazer(texto: string, antes: Sessao) {
  toast(texto, { action: { label: "Desfazer", onClick: () => foco.restaurar(antes) } })
}

/** Ações que zeram o timer: se havia progresso, a pessoa pode desfazer. Lê o relógio só no clique. */
function acaoComDesfazer(texto: string, acao: () => void) {
  const antes = foco.agora()
  const tinhaProgresso = perdeProgresso(antes, Date.now())
  acao()
  if (tinhaProgresso) avisarComDesfazer(texto, antes)
}

/** Posição de uma tarefa nova: o momento da criação (a ordem da lista). Lido só no envio. */
function novaPosicao(): number {
  return Date.now()
}

/** A sessão de foco: o timer, a fase, o ritmo e a tarefa em foco, com o próximo compromisso embaixo. */
export function SessaoFoco() {
  const hoje = isoDia()
  const s = doDia(useSessaoFoco(), hoje)
  const restante = useRestante()
  const aviso = useAvisoFoco()
  const agora = useAgora(true, 30_000)
  const { data: tarefasBanco, isSuccess: tarefasCarregadas } = useTarefas()
  const { data: eventosBanco } = useEventos()
  const { data: projetos } = useProjetosPorNome()
  const tarefas = tarefasBanco ?? SEM_TAREFAS
  const eventos = eventosBanco ?? SEM_EVENTOS
  const nomesProjetos = React.useMemo(() => new Map((projetos ?? []).map((p) => [p.id, p.name])), [projetos])

  const idEmFoco = s.tarefa?.id ?? null
  const tarefa = idEmFoco ? tarefas.find((t) => t.id === idEmFoco) : undefined
  React.useEffect(() => {
    // Tarefa apagada (aqui ou em outro aparelho): o foco volta ao campo para escolher outra
    if (tarefasCarregadas && idEmFoco && !tarefas.some((t) => t.id === idEmFoco)) foco.escolherTarefa(null)
  }, [tarefasCarregadas, idEmFoco, tarefas])

  const deHoje = tarefasDeHoje(tarefas, hoje)
  const proximo = proximoCompromisso(eventos, new Date(agora))
  const conflito = conflitaComFoco(proximo, s, agora)
  const duracaoFase = duracao(s.ritmo, s.fase)
  const pausadaNoMeio = !rodando(s) && s.restante < duracaoFase
  const n = bolinhas(s)

  const ref = React.useRef<HTMLElement>(null)
  const [heroVisivel, setHeroVisivel] = React.useState(true)
  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const observador = new IntersectionObserver(([entrada]) => setHeroVisivel(entrada.isIntersecting), { threshold: 0 })
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  const voltarAoTimer = () => {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ref.current?.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "start" })
  }

  const trocarFase = (f: Fase) => {
    if (f === s.fase) return
    acaoComDesfazer("Timer reiniciado", () => foco.escolherFase(f))
  }
  const trocarRitmo = (r: RitmoId) => {
    if (r === s.ritmo) return
    acaoComDesfazer("Timer reiniciado", () => foco.trocarRitmo(r))
  }

  return (
    <section id="sessao-foco" aria-label="Sessão de foco" ref={ref} className="scroll-mt-20 rounded-2xl border border-line bg-surface p-5 sm:p-7 lg:p-8">
      {/* Linha de cima: a fase e o ritmo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Fase" className="inline-flex rounded-lg bg-surface-2 p-0.5">
          {FASES.map((f) => {
            const ativa = s.fase === f
            return (
              <button
                key={f}
                type="button"
                aria-pressed={ativa}
                onClick={() => trocarFase(f)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors toque:min-h-11",
                  ativa ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-2 hover:text-ink",
                )}
              >
                {ROTULO_FASE[f]}
              </button>
            )
          })}
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          Ritmo
          <Seletor className="w-auto" value={s.ritmo} onChange={(e) => trocarRitmo(e.target.value as RitmoId)}>
            {RITMOS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </Seletor>
        </label>
      </div>

      <div className="mt-6 grid items-center gap-8 lg:grid-cols-2 lg:gap-10">
        {/* Timer */}
        <div className="grid justify-items-center">
          <div className="relative grid size-56 place-items-center sm:size-64">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r={RAIO} fill="none" strokeWidth="4" className="stroke-surface-3" />
              {/* Traço reto: com a ponta redonda, um arco quase zerado aparecia como um pontinho no topo */}
              <circle
                cx="50"
                cy="50"
                r={RAIO}
                fill="none"
                strokeWidth="4"
                strokeLinecap="butt"
                strokeDasharray={VOLTA}
                strokeDashoffset={VOLTA * (restante / duracaoFase)}
                className={cn("motion-safe:transition-[stroke-dashoffset] motion-safe:duration-300", s.fase === "foco" ? "stroke-estudos" : "stroke-rotina")}
              />
            </svg>
            <div className="grid justify-items-center">
              <span role="timer" aria-live="off" className="font-display text-6xl font-semibold tabular tracking-tight sm:text-7xl">
                {mmss(restante)}
              </span>
              <span className="mt-1 text-sm font-medium text-ink-2">
                {ROTULO_FASE[s.fase]}
                {pausadaNoMeio ? <span className="text-ink-3"> · pausado</span> : null}
              </span>
            </div>
          </div>
          <div role="img" aria-label={textoBolinhas(n)} className="mt-3 flex gap-1.5">
            {Array.from({ length: CICLOS_ATE_LONGA }, (_, i) => (
              <span key={i} aria-hidden className={cn("size-2 rounded-full", i < n ? "bg-estudos" : "bg-surface-3")} />
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2">
            <Botao variante="primario" tamanho="lg" className="min-w-36" onClick={() => foco.alternar()}>
              {rodando(s) ? <Pause /> : <Play />} {rotuloBotao(s)}
            </Botao>
            <Botao
              variante="fantasma"
              tamanho="icone"
              aria-label="Reiniciar"
              title="Reiniciar"
              onClick={() => acaoComDesfazer("Timer reiniciado", () => foco.reiniciar())}
            >
              <RotateCcw />
            </Botao>
            <Botao
              variante="fantasma"
              tamanho="icone"
              aria-label={s.fase === "foco" ? "Pular para a pausa" : "Pular para o foco"}
              title={s.fase === "foco" ? "Pular para a pausa" : "Pular para o foco"}
              onClick={() => acaoComDesfazer("Fase pulada", () => foco.pular())}
            >
              <SkipForward />
            </Botao>
          </div>
          <p className="mt-3 text-center text-sm text-ink-3">{resumoDoDia(s, hoje)}</p>
        </div>

        {/* Foco e próximo compromisso */}
        <div className="min-w-0 lg:border-l lg:border-line lg:pl-10">
          <PainelDeFoco s={s} tarefa={tarefa} deHoje={deHoje} hoje={hoje} nomesProjetos={nomesProjetos} />
          <hr className="my-5 border-line" />
          <div className="flex gap-2.5 text-sm">
            <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
            <div>
              <p className="text-ink-2">{textoProximo(proximo)}</p>
              {conflito ? (
                <p className="mt-1 flex items-center gap-1.5 font-medium text-warning">
                  <TriangleAlert aria-hidden className="size-3.5" /> Começa antes de este ciclo terminar.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {aviso?.texto ?? ""}
      </p>
      {!heroVisivel && rodando(s) ? <PilulaFoco fase={s.fase} restante={restante} aoClicar={voltarAoTimer} rotulo="Voltar ao timer" /> : null}
    </section>
  )
}

/** O painel da tarefa em foco: concluir, trocar ou tirar; sem tarefa, o campo para escrever o que vai fazer. */
function PainelDeFoco({
  s,
  tarefa,
  deHoje,
  hoje,
  nomesProjetos,
}: {
  s: Sessao
  tarefa: Tarefa | undefined
  deHoje: Tarefa[]
  hoje: string
  nomesProjetos: Map<string, string>
}) {
  const atualizar = useAtualizar("tasks")
  if (!s.tarefa) return <CampoFocoLivre hoje={hoje} deHoje={deHoje} />
  if (!tarefa) {
    // As tarefas ainda estão carregando: mostra o nome que ficou guardado
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Focando em</p>
        <p className="mt-1.5 font-display text-2xl font-semibold leading-snug text-balance">{s.tarefa.titulo}</p>
      </div>
    )
  }

  const concluida = tarefa.status === "done"
  const projeto = tarefa.project_id ? nomesProjetos.get(tarefa.project_id) : undefined
  const ciclos = textoCiclosTarefa(ciclosDaTarefa(s, tarefa.id, hoje))
  const sugestao = concluida ? proximaSugestao(deHoje, tarefa.id) : null

  const concluir = () => {
    const statusAntes = tarefa.status
    atualizar.mutate({ id: tarefa.id, status: "done", done_at: new Date().toISOString() })
    toast("Tarefa concluída", {
      action: { label: "Desfazer", onClick: () => atualizar.mutate({ id: tarefa.id, status: statusAntes, done_at: null }) },
    })
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Focando em</p>
      <p className={cn("mt-1.5 font-display text-2xl font-semibold leading-snug text-balance", concluida && "line-through text-ink-3")}>{tarefa.title}</p>
      {concluida ? (
        <>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-rotina">
            <Check aria-hidden className="size-4" /> Concluída. Boa!
          </p>
          {sugestao ? (
            <>
              <p className="mt-3 text-sm text-ink-2">
                Próxima da lista: <strong className="font-medium text-ink">{sugestao.title}</strong>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Botao variante="primario" onClick={() => foco.escolherTarefa({ id: sugestao.id, titulo: sugestao.title })}>
                  Focar nesta
                </Botao>
                <TrocarTarefa deHoje={deHoje} atual={tarefa.id} />
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-ink-2">Nada mais para hoje.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Botao variante="fantasma" onClick={() => foco.escolherTarefa(null)}>
                  Tirar o foco
                </Botao>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-ink-3">
            {projeto ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <FolderKanban aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{projeto}</span>
              </span>
            ) : null}
            <span>{textoPrazo(tarefa, hoje)}</span>
            {ciclos ? <span>{ciclos}</span> : null}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Botao variante="contorno" onClick={concluir}>
              <Check aria-hidden /> Concluir tarefa
            </Botao>
            <TrocarTarefa deHoje={deHoje} atual={tarefa.id} />
            <Botao variante="fantasma" tamanho="icone" aria-label="Tirar o foco" title="Tirar o foco" onClick={() => foco.escolherTarefa(null)}>
              <X />
            </Botao>
          </div>
        </>
      )}
    </div>
  )
}

/** O menu "Trocar": as outras tarefas de hoje (até oito) e "Sem tarefa". */
function TrocarTarefa({ deHoje, atual }: { deHoje: Tarefa[]; atual: string }) {
  const outras = deHoje.filter((t) => t.id !== atual).slice(0, 8)
  return (
    <Menu>
      <MenuGatilho asChild>
        <Botao variante="fantasma" tamanho="sm">
          Trocar <ChevronDown />
        </Botao>
      </MenuGatilho>
      <MenuConteudo align="start" collisionPadding={16} className="w-72">
        {outras.map((t) => (
          <MenuItem key={t.id} onSelect={() => foco.escolherTarefa({ id: t.id, titulo: t.title })}>
            <span className="truncate">{t.title}</span>
          </MenuItem>
        ))}
        {outras.length ? <MenuSeparador /> : null}
        <MenuItem onSelect={() => foco.escolherTarefa(null)}>Sem tarefa</MenuItem>
      </MenuConteudo>
    </Menu>
  )
}

/** Sem tarefa: escreve o que vai fazer (vira tarefa de hoje) ou escolhe uma das de hoje. */
function CampoFocoLivre({ hoje, deHoje }: { hoje: string; deHoje: Tarefa[] }) {
  const criar = useCriar("tasks")
  const [texto, setTexto] = React.useState("")

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const titulo = texto.trim()
    if (!titulo) return
    const id = novoId()
    try {
      await criar.mutateAsync({ id, title: titulo, due_date: hoje, position: novaPosicao() })
      setTexto("")
      foco.escolherTarefa({ id, titulo })
    } catch {
      // O aviso de erro já sai do hook; o texto fica para tentar de novo
    }
  }

  return (
    <div>
      <form onSubmit={enviar}>
        <label htmlFor="flow-intencao" className="font-display text-xl font-semibold">
          Em que você vai focar?
        </label>
        <div className="mt-3 flex gap-2">
          <Entrada id="flow-intencao" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: Escrever o roteiro" />
          <Botao type="submit" variante="contorno">
            Focar
          </Botao>
        </div>
      </form>
      {deHoje.length ? (
        <>
          <p className="mt-4 text-sm text-ink-3">Ou escolha uma tarefa de hoje:</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {deHoje.slice(0, 4).map((t) => (
              <li key={t.id} className="min-w-0 max-w-full">
                <button
                  type="button"
                  aria-label={`Focar em ${t.title}`}
                  onClick={() => foco.escolherTarefa({ id: t.id, titulo: t.title })}
                  className="max-w-full truncate rounded-full border border-line px-3 py-1 text-sm text-ink-2 hover:border-line-strong hover:text-ink toque:min-h-11"
                >
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-4 text-sm text-ink-3">Nenhuma tarefa para hoje.</p>
      )}
    </div>
  )
}
