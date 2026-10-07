"use client"

import Link from "next/link"
import * as React from "react"
import { useSearchParams } from "next/navigation"
import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { ChevronLeft, ChevronRight, FileText, Plus } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Etiqueta, Segmentos, Secao } from "@/components/ui/basicos"
import { novoId, useAtualizar, useCriar, useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { STATUS_CONTEUDO, type StatusConteudo } from "@/lib/rotulos"
import { cn, dataRelativa, isoDia, numero } from "@/lib/utils"
import { useArvorePaginas } from "@/features/paginas/dados"
import { DialogoConteudo } from "./dialogo-conteudo"

type Conteudo = Tables<"content_items">
type Visao = "quadro" | "calendario" | "desempenho"

function Cartao({ item, linha, aoAbrir }: { item: Conteudo; linha?: string; aoAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id })
  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      {...attributes}
      {...listeners}
      onClick={aoAbrir}
      className={cn("cursor-pointer touch-none rounded-lg border border-line bg-surface p-3 text-sm", isDragging && "relative z-10 shadow-overlay")}
    >
      <p className="font-medium leading-snug">{item.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
        {item.format ? <Etiqueta cor="conteudo">{item.format}</Etiqueta> : null}
        {linha ? <span>{linha}</span> : null}
        {item.publish_date ? <span className="first-letter:uppercase">{dataRelativa(item.publish_date)}</span> : null}
      </div>
    </div>
  )
}

function Coluna({ status, children, total, aoCriar }: { status: StatusConteudo; children: React.ReactNode; total: number; aoCriar: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div ref={setNodeRef} className={cn("w-64 shrink-0 rounded-xl bg-surface-2/60 p-2.5 transition-colors", isOver && "bg-conteudo-soft")}>
      <div className="mb-2 flex items-center justify-between px-1 text-sm font-medium">
        <span>{STATUS_CONTEUDO[status]} <span className="tabular font-normal text-ink-3">{total}</span></span>
        <button type="button" aria-label={`Novo em ${STATUS_CONTEUDO[status]}`} onClick={aoCriar} className="rounded p-0.5 text-ink-3 hover:bg-surface hover:text-ink">
          <Plus className="size-4" />
        </button>
      </div>
      <div className="grid gap-2">{children}</div>
    </div>
  )
}

function Calendario({ itens, aoAbrir, aoCriar }: { itens: Conteudo[]; aoAbrir: (c: Conteudo) => void; aoCriar: (dia: string) => void }) {
  const [mes, setMes] = React.useState(() => startOfMonth(new Date()))
  const hoje = isoDia()
  const dias: Date[] = []
  for (let d = startOfWeek(startOfMonth(mes)); d <= endOfWeek(endOfMonth(mes)); d = addDays(d, 1)) dias.push(d)
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold first-letter:uppercase">{format(mes, "MMMM 'de' yyyy", { locale: ptBR })}</h2>
        <div className="flex gap-1">
          <Botao variante="fantasma" tamanho="icone-sm" aria-label="Mês anterior" onClick={() => setMes((m) => addMonths(m, -1))}><ChevronLeft /></Botao>
          <Botao variante="fantasma" tamanho="icone-sm" aria-label="Próximo mês" onClick={() => setMes((m) => addMonths(m, 1))}><ChevronRight /></Botao>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => <div key={d} className="bg-surface-2 py-2 text-center text-xs font-medium text-ink-3">{d}</div>)}
        {dias.map((d) => {
          const iso = isoDia(d)
          const doDia = itens.filter((i) => i.publish_date === iso)
          return (
            <div key={iso} onClick={() => aoCriar(iso)} className={cn("min-h-20 cursor-pointer bg-surface p-1.5 hover:bg-surface-2 sm:min-h-28", d.getMonth() !== mes.getMonth() && "opacity-50")}>
              <span className={cn("tabular inline-grid size-6 place-items-center rounded-full text-xs", iso === hoje && "bg-pen text-pen-ink")}>{d.getDate()}</span>
              <div className="grid gap-0.5">
                {doDia.map((c) => (
                  <button key={c.id} type="button" onClick={(e) => { e.stopPropagation(); aoAbrir(c) }} className={cn("truncate rounded px-1 text-left text-[11px] leading-5", c.status === "publicado" ? "bg-rotina-soft text-rotina" : "bg-conteudo-soft text-conteudo")}>
                    {c.title}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Desempenho({ itens }: { itens: Conteudo[] }) {
  const publicados = itens.filter((i) => i.status === "publicado" && (i.views || i.likes)).sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
  const max = Math.max(1, ...publicados.map((p) => p.views ?? 0))
  if (!publicados.length) return <p className="text-ink-2">Registre visualizações e curtidas nos conteúdos publicados para ver o desempenho aqui.</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-3">
            <th className="px-4 py-2 font-medium">Conteúdo</th>
            <th className="w-56 py-2 font-medium">Visualizações</th>
            <th className="w-20 py-2 text-right font-medium">Curtidas</th>
            <th className="w-24 py-2 text-right font-medium">Comentários</th>
            <th className="w-28 px-4 py-2 text-right font-medium">Engajamento</th>
          </tr>
        </thead>
        <tbody>
          {publicados.map((p) => {
            const eng = p.views ? (((p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0)) / p.views) * 100 : null
            return (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  <span className="font-medium">{p.title}</span>
                  <span className="block text-xs text-ink-3">{[p.format, p.publish_date ? format(new Date(p.publish_date + "T12:00"), "d MMM yyyy", { locale: ptBR }) : null].filter(Boolean).join(", ")}</span>
                </td>
                <td className="py-2.5">
                  <span className="flex items-center gap-2" title={`${numero(p.views)} visualizações`}>
                    <span className="h-2 rounded-r-[4px] bg-conteudo" style={{ width: `${Math.max(2, ((p.views ?? 0) / max) * 140)}px` }} />
                    <span className="tabular text-xs">{numero(p.views)}</span>
                  </span>
                </td>
                <td className="tabular py-2.5 text-right">{numero(p.likes)}</td>
                <td className="tabular py-2.5 text-right">{numero(p.comments)}</td>
                <td className="tabular px-4 py-2.5 text-right">{eng === null ? "–" : `${numero(eng, 1)}%`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function PaginaPlanner() {
  const params = useSearchParams()
  const [visao, setVisao] = React.useState<Visao>("quadro")
  const { data: itens = [], isLoading } = useLista("content_items", { ordem: [{ coluna: "position" }] })
  const { data: linhas = [] } = useLista("editorial_lines", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  const { data: paginas = [] } = useArvorePaginas()
  const atualizar = useAtualizar("content_items")
  const criarLinha = useCriar("editorial_lines")
  const [aberto, setAberto] = React.useState<Conteudo | null>(null)
  const [novo, setNovo] = React.useState<{ status?: string; dia?: string } | null>(null)
  const [linhaNova, setLinhaNova] = React.useState("")
  const [filtroLinha, setFiltroLinha] = React.useState("")

  React.useEffect(() => {
    const id = params.get("abrir")
    const c = id ? itens.find((x) => x.id === id) : null
    if (c) setAberto(c)
  }, [params, itens])

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }))
  const nomesLinha = new Map(linhas.map((l) => [l.id, l.name]))
  const filtrados = itens.filter((i) => !filtroLinha || i.editorial_line_id === filtroLinha)
  const guias = paginas.filter((p) => p.section === "planner" && !p.parent_id)

  const soltar = (e: DragEndEvent) => {
    const destino = e.over?.id as StatusConteudo | undefined
    const item = itens.find((i) => i.id === e.active.id)
    if (item && destino && item.status !== destino) atualizar.mutate({ id: item.id, status: destino })
  }

  return (
    <div>
      <Cabecalho
        area="conteudo"
        titulo="Planner de conteúdo"
        descricao="Da ideia à publicação. Arraste os cartões entre as etapas."
        acoes={<Botao variante="primario" onClick={() => setNovo({})}><Plus /> Novo conteúdo</Botao>}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Segmentos rotulo="Visualização" valor={visao} aoMudar={setVisao} opcoes={[{ valor: "quadro", rotulo: "Quadro" }, { valor: "calendario", rotulo: "Calendário" }, { valor: "desempenho", rotulo: "Desempenho" }]} />
        {linhas.length ? (
          <select value={filtroLinha} onChange={(e) => setFiltroLinha(e.target.value)} aria-label="Linha editorial" className="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm">
            <option value="">Todas as linhas editoriais</option>
            {linhas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        ) : null}
      </div>

      {isLoading ? (
        <Carregando />
      ) : visao === "quadro" ? (
        <DndContext sensors={sensores} onDragEnd={soltar}>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-thin sm:mx-0 sm:px-0">
            {(Object.keys(STATUS_CONTEUDO) as StatusConteudo[]).map((s) => {
              const lista = filtrados.filter((i) => i.status === s).sort((a, b) => (a.publish_date ?? "9").localeCompare(b.publish_date ?? "9"))
              const mostrar = s === "publicado" ? lista.slice(-12).reverse() : lista
              return (
                <Coluna key={s} status={s} total={lista.length} aoCriar={() => setNovo({ status: s })}>
                  {mostrar.map((i) => <Cartao key={i.id} item={i} linha={nomesLinha.get(i.editorial_line_id ?? "")} aoAbrir={() => setAberto(i)} />)}
                </Coluna>
              )
            })}
          </div>
        </DndContext>
      ) : visao === "calendario" ? (
        <Calendario itens={filtrados} aoAbrir={setAberto} aoCriar={(dia) => setNovo({ dia, status: "idealizando" })} />
      ) : (
        <Desempenho itens={filtrados} />
      )}

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <Secao titulo="Linhas editoriais">
          <ul className="mb-3 flex flex-wrap gap-2">
            {linhas.map((l) => (
              <li key={l.id}>
                <Etiqueta cor="conteudo" className="px-3 py-1 text-sm">
                  {l.name} <span className="tabular opacity-70">{itens.filter((i) => i.editorial_line_id === l.id).length}</span>
                </Etiqueta>
              </li>
            ))}
          </ul>
          <form onSubmit={(e) => { e.preventDefault(); if (linhaNova.trim()) { criarLinha.mutate({ id: novoId(), name: linhaNova.trim(), position: linhas.length + 1 }); setLinhaNova("") } }} className="flex max-w-sm gap-2">
            <input value={linhaNova} onChange={(e) => setLinhaNova(e.target.value)} placeholder="Nova linha editorial" aria-label="Nova linha editorial" className="h-9 flex-1 rounded-md border border-line-strong bg-surface px-3 text-sm focus-visible:border-pen focus-visible:outline-none" />
            <Botao type="submit" disabled={!linhaNova.trim()}>Adicionar</Botao>
          </form>
        </Secao>
        {guias.length ? (
          <Secao titulo="Estratégia">
            <ul className="grid gap-1 sm:grid-cols-2">
              {guias.map((p) => (
                <li key={p.id}>
                  <Link href={`/paginas/${p.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                    <FileText className="size-4 text-ink-3" /> <span className="truncate">{p.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Secao>
        ) : null}
      </div>

      <DialogoConteudo
        aberta={Boolean(novo) || Boolean(aberto)}
        aoMudar={(v) => { if (!v) { setNovo(null); setAberto(null) } }}
        item={aberto}
        statusInicial={novo?.status}
        dataInicial={novo?.dia}
      />
    </div>
  )
}
