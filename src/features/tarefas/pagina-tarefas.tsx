"use client"

import * as React from "react"
import { useProjetosPorNome } from "@/features/projetos/dados"
import { useAbrirDoEndereco } from "@/lib/abrir-do-endereco"
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { Plus, Search } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, ErroCarregar, Segmentos, Secao } from "@/components/ui/basicos"
import { Seletor } from "@/components/ui/campos"
import { useAtualizar, useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { cn, contem, isoDia, somarDias } from "@/lib/utils"
import { DialogoTarefa } from "./dialogo-tarefa"
import { ItemTarefa } from "./item-tarefa"

type Tarefa = Tables<"tasks">
type Visao = "triade" | "prazo" | "quadro"

const TRIADE = [
  { valor: "urgente", titulo: "Urgente", cor: "text-danger" },
  { valor: "necessario", titulo: "Necessário", cor: "text-rotina" },
  { valor: "bom_fazer", titulo: "Bom fazer", cor: "text-ink-2" },
  { valor: "sem", titulo: "Sem prioridade", cor: "text-ink-3" },
] as const
type ChaveTriade = (typeof TRIADE)[number]["valor"]
const triadeDe = (t: Tarefa): ChaveTriade => (t.priority as ChaveTriade | null) ?? "sem"

function ordenar(a: Tarefa, b: Tarefa) {
  const da = a.due_date ?? "9999"
  const db = b.due_date ?? "9999"
  if (da !== db) return da < db ? -1 : 1
  const pr = { urgente: 0, necessario: 1, bom_fazer: 2 } as Record<string, number>
  const pa = pr[a.priority ?? ""] ?? 3
  const pb = pr[b.priority ?? ""] ?? 3
  if (pa !== pb) return pa - pb
  return (a.due_time ?? "99").localeCompare(b.due_time ?? "99")
}

function Cartao({ tarefa, projeto, aoAbrir }: { tarefa: Tarefa; projeto?: string | null; aoAbrir: (t: Tarefa) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tarefa.id })
  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn(
        "touch-none rounded-lg border border-line bg-surface px-3 py-1 shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        isDragging && "relative z-10 opacity-90 shadow-overlay",
      )}
      {...attributes}
      {...listeners}
    >
      <ul>
        <ItemTarefa tarefa={tarefa} projeto={projeto} aoAbrir={aoAbrir} />
      </ul>
    </div>
  )
}

function Coluna({ id, titulo, cor, children, total }: { id: string; titulo: string; cor?: string; children: React.ReactNode; total: number }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cn("min-h-40 rounded-xl bg-surface-2/60 p-2.5 transition-colors", isOver && "bg-pen-soft")}>
      <p className={cn("mb-2 flex items-center justify-between px-1 text-sm font-semibold", cor)}>
        {titulo}
        <span className="tabular font-normal text-ink-3">{total}</span>
      </p>
      <div className="grid gap-2">{children}</div>
    </div>
  )
}

export function PaginaTarefas() {
  const hoje = isoDia()
  const [visao, setVisao] = React.useState<Visao>("triade")
  const [busca, setBusca] = React.useState("")
  const [projetoFiltro, setProjetoFiltro] = React.useState("")
  const [aberta, setAberta] = React.useState<Tarefa | null>(null)
  const [nova, setNova] = React.useState(false)
  const [verConcluidas, setVerConcluidas] = React.useState(false)

  const { data: tarefas = [], isLoading, error, refetch } = useLista("tasks", { ordem: [{ coluna: "position" }] })
  const { data: projetos = [] } = useProjetosPorNome()
  const atualizar = useAtualizar("tasks")
  const nomes = React.useMemo(() => new Map(projetos.map((p) => [p.id, p.name])), [projetos])

  useAbrirDoEndereco(tarefas, setAberta)

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  const filtradas = tarefas.filter(
    (t) => contem(`${t.title} ${t.description ?? ""}`, busca) && (!projetoFiltro || t.project_id === projetoFiltro),
  )
  const abertas = filtradas.filter((t) => t.status !== "done").sort(ordenar)
  const concluidas = filtradas
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.done_at ?? b.updated_at).localeCompare(a.done_at ?? a.updated_at))

  const grupos: { titulo: string; itens: Tarefa[]; destaque?: boolean }[] = [
    { titulo: "Atrasadas", itens: abertas.filter((t) => t.due_date && t.due_date < hoje), destaque: true },
    { titulo: "Hoje", itens: abertas.filter((t) => t.due_date === hoje) },
    { titulo: "Próximos 7 dias", itens: abertas.filter((t) => t.due_date && t.due_date > hoje && t.due_date <= somarDias(hoje, 7)) },
    { titulo: "Mais adiante", itens: abertas.filter((t) => t.due_date && t.due_date > somarDias(hoje, 7)) },
    { titulo: "Sem data", itens: abertas.filter((t) => !t.due_date) },
  ]

  // Quadro pela Tríade do Tempo: soltar numa coluna muda a prioridade
  const soltar = (e: DragEndEvent) => {
    const destino = e.over?.id as ChaveTriade | undefined
    const t = tarefas.find((x) => x.id === e.active.id)
    if (!t || !destino || triadeDe(t) === destino) return
    atualizar.mutate({ id: t.id, priority: destino === "sem" ? null : destino })
  }
  const porTriade = TRIADE.map((g) => ({ ...g, itens: abertas.filter((t) => triadeDe(t) === g.valor) }))

  const projetosComTarefa = projetos.filter((p) => tarefas.some((t) => t.project_id === p.id))

  return (
    <div>
      <Cabecalho
        area="rotina"
        titulo="Tarefas"
        descricao="Organizadas pela Tríade do Tempo: urgente, necessário e bom fazer. No quadro, arraste para mudar a prioridade."
        acoes={
          <Botao variante="primario" onClick={() => setNova(true)}>
            <Plus /> Nova tarefa
          </Botao>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Segmentos
          rotulo="Visualização"
          valor={visao}
          aoMudar={setVisao}
          opcoes={[
            { valor: "triade", rotulo: "Tríade" },
            { valor: "prazo", rotulo: "Por prazo" },
            { valor: "quadro", rotulo: "Quadro" },
          ]}
        />
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar tarefas"
            aria-label="Filtrar tarefas"
            className="h-9 w-full rounded-md border toque:h-11 toque:text-[16px] border-line-strong bg-surface pl-8 pr-3 text-sm placeholder:text-ink-3 focus-visible:border-pen focus-visible:outline-none"
          />
        </div>
        {projetosComTarefa.length ? (
          <Seletor aria-label="Filtrar por projeto" value={projetoFiltro} onChange={(e) => setProjetoFiltro(e.target.value)} className="w-auto max-w-56">
            <option value="">Todos os projetos</option>
            {projetosComTarefa.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Seletor>
        ) : null}
      </div>

      {error ? (
        <ErroCarregar erro={error} aoTentar={() => refetch()} />
      ) : isLoading ? (
        <Carregando />
      ) : visao !== "quadro" ? (
        <div className="grid gap-8">
          {abertas.length === 0 ? <p className="text-ink-2">Nenhuma tarefa pendente{busca ? " com esse filtro" : ""}.</p> : null}
          {(visao === "triade" ? porTriade.map((g) => ({ titulo: g.titulo, itens: g.itens, destaque: g.valor === "urgente" })) : grupos)
            .filter((g) => g.itens.length)
            .map((g) => (
              <Secao key={g.titulo} titulo={g.titulo} acao={<span className={cn("tabular text-sm", g.destaque ? "text-danger" : "text-ink-3")}>{g.itens.length}</span>}>
                <ul className="grid">
                  {g.itens.map((t) => (
                    <ItemTarefa key={t.id} tarefa={t} projeto={t.project_id ? nomes.get(t.project_id) : null} aoAbrir={setAberta} />
                  ))}
                </ul>
              </Secao>
            ))}
          {concluidas.length ? (
            <section>
              <button type="button" onClick={() => setVerConcluidas((v) => !v)} className="text-sm font-medium text-ink-2 hover:text-ink">
                {verConcluidas ? "Ocultar concluídas" : `Mostrar concluídas (${concluidas.length})`}
              </button>
              {verConcluidas ? (
                <ul className="mt-3 grid">
                  {concluidas.slice(0, 100).map((t) => (
                    <ItemTarefa key={t.id} tarefa={t} projeto={t.project_id ? nomes.get(t.project_id) : null} aoAbrir={setAberta} />
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : (
        <DndContext sensors={sensores} onDragEnd={soltar}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {porTriade.map((g) => (
              <Coluna key={g.valor} id={g.valor} titulo={g.titulo} cor={g.cor} total={g.itens.length}>
                {g.itens.map((t) => (
                  <Cartao key={t.id} tarefa={t} projeto={t.project_id ? nomes.get(t.project_id) : null} aoAbrir={setAberta} />
                ))}
              </Coluna>
            ))}
          </div>
        </DndContext>
      )}

      <DialogoTarefa aberta={nova || Boolean(aberta)} aoMudar={(v) => { if (!v) { setNova(false); setAberta(null) } }} tarefa={aberta} />
    </div>
  )
}

