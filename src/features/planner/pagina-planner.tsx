"use client"

import Link from "next/link"
import * as React from "react"
import { useSearchParams } from "next/navigation"
import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, FileText, Lightbulb, Plus, Wrench } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Etiqueta, Segmentos, Secao } from "@/components/ui/basicos"
import { novoId, useAtualizar, useCriar, useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { STATUS_CONTEUDO, type StatusConteudo } from "@/lib/rotulos"
import { cn, contem, dataRelativa, isoDia, numero, normalizar } from "@/lib/utils"
import { useArvorePaginas } from "@/features/paginas/dados"
import { DialogoConteudo } from "./dialogo-conteudo"

type Conteudo = Tables<"content_items">
type Visao = "ideias" | "quadro" | "calendario" | "desempenho"

/** Páginas do Planner que no Notion ficam em "Ferramentas". */
const FERRAMENTAS = ["viral canva", "como editar", "gpt prompts", "prompts"]
const ehFerramenta = (titulo: string) => FERRAMENTAS.some((f) => normalizar(titulo).includes(f))

function BancoIdeias({
  ideias,
  linhas,
  aoAbrir,
}: {
  ideias: Conteudo[]
  linhas: Tables<"editorial_lines">[]
  aoAbrir: (c: Conteudo) => void
}) {
  const criar = useCriar("content_items")
  const atualizar = useAtualizar("content_items")
  const [texto, setTexto] = React.useState("")
  const [linha, setLinha] = React.useState("")
  const [busca, setBusca] = React.useState("")
  const nomes = new Map(linhas.map((l) => [l.id, l.name]))
  const visiveis = ideias.filter((i) => !busca || contem(i.title, busca)).sort((a, b) => b.created_at.localeCompare(a.created_at))

  const adicionar = (e: React.FormEvent) => {
    e.preventDefault()
    const t = texto.trim()
    if (!t) return
    criar.mutate({ id: novoId(), title: t, status: "ideia", editorial_line_id: linha || null, position: Date.now() })
    setTexto("")
  }

  return (
    <section aria-label="Banco de ideias">
      <form onSubmit={adicionar} className="mb-4 flex flex-wrap gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Anote uma ideia de conteúdo e aperte Enter"
          aria-label="Nova ideia"
          className="h-10 min-w-0 flex-1 basis-64 rounded-md border border-line-strong bg-surface px-3 text-sm placeholder:text-ink-3 focus-visible:border-pen focus-visible:outline-none"
        />
        {linhas.length ? (
          <select value={linha} onChange={(e) => setLinha(e.target.value)} aria-label="Linha editorial da ideia" className="h-10 rounded-md border border-line-strong bg-surface px-2 text-sm">
            <option value="">Sem linha editorial</option>
            {linhas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        ) : null}
        <Botao type="submit" variante="primario" disabled={!texto.trim()}>
          <Plus /> Guardar ideia
        </Botao>
      </form>
      {ideias.length > 8 ? (
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Filtrar ideias"
          aria-label="Filtrar ideias"
          className="mb-3 h-9 w-full max-w-xs rounded-md border border-line-strong bg-surface px-3 text-sm placeholder:text-ink-3 focus-visible:border-pen focus-visible:outline-none"
        />
      ) : null}
      {visiveis.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-2">
          {busca ? "Nenhuma ideia com esse texto." : "O banco está vazio. Toda ideia que surgir cabe aqui, mesmo pela metade."}
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {visiveis.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
              <Lightbulb className="size-4 shrink-0 text-conteudo" aria-hidden />
              <button type="button" onClick={() => aoAbrir(i)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium hover:underline">{i.title}</span>
                <span className="block text-xs text-ink-3">
                  {[nomes.get(i.editorial_line_id ?? ""), i.format, dataRelativa(i.created_at.slice(0, 10))].filter(Boolean).join(", ")}
                </span>
              </button>
              <Botao variante="fantasma" tamanho="sm" onClick={() => atualizar.mutate({ id: i.id, status: "idealizando" })} title="Levar para Idealizando no quadro">
                Produzir <ArrowRight />
              </Botao>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

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

function ListaGuias({ paginas, icone: Icone }: { paginas: { id: string; title: string; icon: string | null }[]; icone: typeof FileText }) {
  return (
    <ul className="grid gap-0.5">
      {paginas.map((p) => (
        <li key={p.id}>
          <Link href={`/paginas/${p.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
            {p.icon && !p.icon.startsWith("/") && p.icon.length <= 4 ? <span className="w-4 text-center">{p.icon}</span> : <Icone className="size-4 shrink-0 text-ink-3" />}
            <span className="truncate">{p.title}</span>
          </Link>
        </li>
      ))}
    </ul>
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
  const estrategia = guias.filter((p) => !ehFerramenta(p.title))
  const ferramentas = guias.filter((p) => ehFerramenta(p.title))
  const { data: links = [] } = useLista("bookmarks", { filtro: (q) => q.eq("collection", "links"), ordem: [{ coluna: "position" }], chave: ["links-planner"] })
  const ideias = filtrados.filter((i) => i.status === "ideia")

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
        <Segmentos rotulo="Visualização" valor={visao} aoMudar={setVisao} opcoes={[{ valor: "ideias", rotulo: "Banco de ideias", contagem: ideias.length }, { valor: "quadro", rotulo: "Quadro" }, { valor: "calendario", rotulo: "Calendário" }, { valor: "desempenho", rotulo: "Desempenho" }]} />
        {linhas.length ? (
          <select value={filtroLinha} onChange={(e) => setFiltroLinha(e.target.value)} aria-label="Linha editorial" className="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm">
            <option value="">Todas as linhas editoriais</option>
            {linhas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        ) : null}
      </div>

      {isLoading ? (
        <Carregando />
      ) : visao === "ideias" ? (
        <BancoIdeias ideias={ideias} linhas={linhas} aoAbrir={setAberto} />
      ) : visao === "quadro" ? (
        <DndContext sensors={sensores} onDragEnd={soltar}>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-thin sm:mx-0 sm:px-0">
            {(Object.keys(STATUS_CONTEUDO) as StatusConteudo[]).filter((s) => s !== "ideia").map((s) => {
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

      <div className="mt-12 grid gap-10 lg:grid-cols-3">
        {estrategia.length ? (
          <Secao titulo="Estratégia">
            <ListaGuias paginas={estrategia} icone={FileText} />
          </Secao>
        ) : null}
        <div className="grid content-start gap-10">
          {ferramentas.length ? (
            <Secao titulo="Ferramentas">
              <ListaGuias paginas={ferramentas} icone={Wrench} />
            </Secao>
          ) : null}
          <Secao titulo="Linhas editoriais">
            <ul className="mb-3 flex flex-wrap gap-2">
              {linhas.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => setFiltroLinha((f) => (f === l.id ? "" : l.id))} aria-pressed={filtroLinha === l.id}>
                    <Etiqueta cor="conteudo" className={cn("px-3 py-1 text-sm", filtroLinha === l.id && "ring-1 ring-conteudo")}>
                      {l.name} <span className="tabular opacity-70">{itens.filter((i) => i.editorial_line_id === l.id).length}</span>
                    </Etiqueta>
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={(e) => { e.preventDefault(); if (linhaNova.trim()) { criarLinha.mutate({ id: novoId(), name: linhaNova.trim(), position: linhas.length + 1 }); setLinhaNova("") } }} className="flex max-w-sm gap-2">
              <input value={linhaNova} onChange={(e) => setLinhaNova(e.target.value)} placeholder="Nova linha editorial" aria-label="Nova linha editorial" className="h-9 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 text-sm focus-visible:border-pen focus-visible:outline-none" />
              <Botao type="submit" disabled={!linhaNova.trim()}>Adicionar</Botao>
            </form>
          </Secao>
        </div>
        <Secao titulo="Links externos">
          {links.length ? (
            <ul className="grid gap-0.5">
              {links.map((l) => (
                <li key={l.id}>
                  <a href={l.url ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                    <ExternalLink className="size-4 shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1 truncate">{l.title}</span>
                    {l.kind ? <span className="shrink-0 text-xs text-ink-3">{l.kind}</span> : null}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">
              Nenhum link ainda. Adicione em <Link href="/links" className="text-pen hover:underline">Links úteis</Link>, na coleção Links.
            </p>
          )}
        </Secao>
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
