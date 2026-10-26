"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import * as React from "react"
import { Target } from "lucide-react"
import { toast } from "sonner"
import { abrirNovo } from "@/components/shell/novo"
import { Esqueleto, Etiqueta, Secao } from "@/components/ui/basicos"
import { Botao } from "@/components/ui/button"
import { useProjetosPorNome } from "@/features/projetos/dados"
import { DialogoTarefa } from "@/features/tarefas/dialogo-tarefa"
import { ItemTarefa } from "@/features/tarefas/item-tarefa"
import { novoId, useCriar } from "@/lib/data"
import { isoDia } from "@/lib/utils"
import { useEventos, useTarefas } from "./dados"
import { agendaDoDia, concluidasHoje, emAndamento, horarioDoEvento, rodando, tarefasDeHoje, type Tarefa } from "./logica"
import { foco, useAgora, useSessaoFoco } from "./relogio"

const SEM_TAREFAS: Tarefa[] = []
/** Quantas tarefas aparecem antes do "Mostrar todas" */
const LIMITE_TAREFAS = 8

/** Posição de uma tarefa nova: o momento da criação (a ordem da lista). Lido só no envio. */
function novaPosicao(): number {
  return Date.now()
}

/** As tarefas de hoje (atrasadas, de hoje e em andamento), com "Focar" em cada uma. */
export function TarefasDeHoje() {
  const hoje = isoDia()
  const { data: tarefasBanco, isLoading } = useTarefas()
  const tarefas = tarefasBanco ?? SEM_TAREFAS
  const { data: projetos } = useProjetosPorNome()
  const sessao = useSessaoFoco()
  const criar = useCriar("tasks")
  const [nova, setNova] = React.useState("")
  const [aberta, setAberta] = React.useState<Tarefa | null>(null)
  const [todas, setTodas] = React.useState(false)

  const nomes = React.useMemo(() => new Map((projetos ?? []).map((p) => [p.id, p.name])), [projetos])
  const deHoje = tarefasDeHoje(tarefas, hoje)
  const feitasHoje = concluidasHoje(tarefas, hoje)
  const visiveis = todas ? deHoje : deHoje.slice(0, LIMITE_TAREFAS)

  const adicionar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nova.trim()) return
    criar.mutate({ id: novoId(), title: nova.trim(), due_date: hoje, position: novaPosicao() })
    setNova("")
  }

  const focar = (t: Tarefa) => {
    foco.escolherTarefa({ id: t.id, titulo: t.title })
    // Se o timer já conta, só avisa; se está parado, oferece começar
    const contando = rodando(foco.agora())
    toast(`Focando em “${t.title}”`, contando ? { id: "flow-focar" } : { id: "flow-focar", action: { label: "Começar foco", onClick: () => foco.comecar() } })
  }

  return (
    <Secao
      titulo="Para hoje"
      acao={
        <Link href="/rotina/tarefas" className="text-sm text-ink-2 hover:text-ink toque:-my-3 toque:py-3">
          Todas as tarefas
        </Link>
      }
    >
      {isLoading ? (
        <div className="grid gap-2">
          {[1, 2, 3].map((i) => (
            <Esqueleto key={i} className="h-9" />
          ))}
        </div>
      ) : (
        <>
          {deHoje.length === 0 ? (
            <p className="py-2 text-ink-2">{feitasHoje ? "Tudo feito por hoje. Bom trabalho." : "Nada pendente para hoje."}</p>
          ) : (
            <ul className="grid">
              {visiveis.map((t) => {
                const emFoco = sessao.tarefa?.id === t.id
                return (
                  <ItemTarefa
                    key={t.id}
                    tarefa={t}
                    projeto={t.project_id ? nomes.get(t.project_id) : null}
                    aoAbrir={setAberta}
                    acao={
                      emFoco ? (
                        <Etiqueta cor="estudos">Em foco</Etiqueta>
                      ) : (
                        <Botao variante="fantasma" tamanho="sm" aria-label={`Focar em ${t.title}`} onClick={() => focar(t)} className="toque:min-w-11">
                          <Target aria-hidden />
                          <span className="max-sm:sr-only">Focar</span>
                        </Botao>
                      )
                    }
                  />
                )
              })}
            </ul>
          )}
          {deHoje.length > LIMITE_TAREFAS ? (
            <button type="button" onClick={() => setTodas(!todas)} className="mt-2 text-sm font-medium text-pen hover:underline toque:min-h-11">
              {todas ? "Mostrar menos" : `Mostrar todas as ${deHoje.length}`}
            </button>
          ) : null}
          <form onSubmit={adicionar} className="mt-2 -mx-2 flex items-center gap-3 rounded-md px-2">
            <span aria-hidden className="size-5 shrink-0 rounded-full border-[1.5px] border-dashed border-line-strong" />
            <input
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              placeholder="Adicionar tarefa para hoje"
              aria-label="Adicionar tarefa para hoje"
              className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3 toque:h-11 toque:text-[16px]"
            />
          </form>
          {feitasHoje ? (
            <p className="mt-3 text-sm text-ink-3">{feitasHoje === 1 ? "1 tarefa concluída hoje" : `${feitasHoje} tarefas concluídas hoje`}</p>
          ) : null}
        </>
      )}
      <DialogoTarefa aberta={Boolean(aberta)} aoMudar={(v) => !v && setAberta(null)} tarefa={aberta} />
    </Secao>
  )
}

/** O que ainda falta na agenda de hoje, com os horários. */
export function AgendaDeHoje() {
  const { data: eventos, isLoading } = useEventos()
  const agora = useAgora(true, 30_000)
  const momento = new Date(agora)
  const lista = agendaDoDia(eventos ?? [], momento)

  return (
    <Secao
      titulo="Agenda de hoje"
      acao={
        <button type="button" onClick={() => abrirNovo("evento")} className="text-sm text-ink-2 hover:text-ink toque:-my-3 toque:py-3">
          Agendar
        </button>
      }
    >
      {isLoading ? (
        <Esqueleto className="h-24" />
      ) : lista.length === 0 ? (
        <p className="py-2 text-ink-2">Nada na agenda pelo resto do dia.</p>
      ) : (
        <ol aria-label="Agenda de hoje" className="grid gap-2">
          {lista.map((e) => (
            // A linha inteira abre o compromisso (no toque, com 44 px de altura)
            <li key={e.id} className="relative flex items-baseline gap-3 text-sm toque:min-h-11 toque:items-center">
              <span className="tabular w-24 shrink-0 text-ink-3">{horarioDoEvento(e)}</span>
              <div className="min-w-0">
                <Link href={`/rotina/agenda?abrir=${e.id}`} className="after:absolute after:inset-0 hover:underline">
                  {e.title}
                </Link>
                {e.location ? <span className="text-ink-3"> · {e.location}</span> : null}
                {emAndamento(e, momento) ? (
                  <Etiqueta cor="caneta" className="ml-2">
                    agora
                  </Etiqueta>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      <Link href="/rotina/agenda" className="mt-3 inline-flex items-center text-sm text-ink-2 hover:text-ink toque:min-h-11">
        Ver agenda completa
      </Link>
    </Secao>
  )
}
