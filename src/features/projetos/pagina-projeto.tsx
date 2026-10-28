"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Archive, ArrowLeft, ChevronRight, ClipboardList, Ellipsis, Link2, ListChecks, ListTodo, NotebookPen, Plus, RotateCcw, Sparkles, Trash, type LucideIcon } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Carregando, ErroCarregar, Esqueleto, Etiqueta, Marcador } from "@/components/ui/basicos"
import { EdicaoEmLinha, Entrada, Seletor } from "@/components/ui/campos"
import { Confirmar } from "@/components/ui/janela"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { EditorMarkdown } from "@/components/markdown"
import { novoId, useAtualizar, useCriar, useExcluir, useLista, useRegistro } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import { cn, dominio, formatar, plural, porcentagem } from "@/lib/utils"
import { ItemTarefa } from "@/features/tarefas/item-tarefa"
import { DialogoTarefa } from "@/features/tarefas/dialogo-tarefa"
import { DialogoCaptura } from "@/features/capturas/dialogo-captura"
import type { Tables } from "@/lib/supabase/database.types"
import { progresso, useAreas, useProjetos, type Projeto } from "./dados"
import { MolduraCerebro } from "@/features/segundo-cerebro/cabecalho"
import { AnelProgresso, ChipPrazo, IconeCaptura, textoEtapas, TituloEditavel, VazioCerebro } from "@/features/segundo-cerebro/ui"

function Etapa({ etapa, todos, nivel }: { etapa: Projeto; todos: Projeto[]; nivel: number }) {
  const atualizar = useAtualizar("projects")
  const excluir = useExcluir("projects")
  const criar = useCriar("projects")
  const [sub, setSub] = React.useState(false)
  const [apagar, setApagar] = React.useState(false)
  const [texto, setTexto] = React.useState("")
  const filhos = todos.filter((p) => p.parent_id === etapa.id).sort((a, b) => a.position - b.position)

  return (
    <li>
      <div className="group flex items-start gap-3 rounded-lg py-2">
        <div className="pt-0.5">
          <Marcador
            marcado={etapa.done}
            area="projetos"
            rotulo={`Concluir ${etapa.name}`}
            aoMudar={(v) => atualizar.mutate({ id: etapa.id, done: v, done_at: v ? new Date().toISOString() : null })}
          />
        </div>
        <div className="min-w-0 flex-1">
          <EdicaoEmLinha
            rotulo="Nome da etapa"
            valor={etapa.name}
            aoSalvar={(v) => v && atualizar.mutate({ id: etapa.id, name: v })}
            className={cn("text-[15px]", etapa.done && "text-ink-3 line-through")}
          />
          {filhos.length ? (
            <p className="tabular text-xs text-ink-3">
              {filhos.filter((f) => f.done).length} de {filhos.length} subetapas
            </p>
          ) : null}
        </div>
        <Menu>
          <MenuGatilho className="grid size-10 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-ink/[0.06] hover:text-ink focus-visible:opacity-100 sm:opacity-60 sm:group-hover:opacity-100 toque:opacity-100" aria-label={`Opções de ${etapa.name}`}>
            <Ellipsis className="size-4" />
          </MenuGatilho>
          <MenuConteudo>
            {nivel < 2 ? <MenuItem onSelect={() => setSub(true)}><Plus /> Adicionar subetapa</MenuItem> : null}
            <MenuItem asChild><Link href={`/projetos/${etapa.id}`}><ChevronRight /> Abrir como projeto</Link></MenuItem>
            <MenuSeparador />
            <MenuItem perigo onSelect={() => setApagar(true)}><Trash /> Excluir</MenuItem>
          </MenuConteudo>
        </Menu>
      </div>
      <Confirmar
        aberta={apagar}
        aoMudar={setApagar}
        titulo={`Excluir a etapa “${etapa.name}”?`}
        descricao={filhos.length ? "As subetapas também serão excluídas." : undefined}
        aoConfirmar={() => excluir.mutate(etapa.id)}
      />
      {filhos.length || sub ? (
        <ul className="ml-[0.6rem] border-l border-[var(--b-borda-2)] pl-5">
          {filhos.map((f) => (
            <Etapa key={f.id} etapa={f} todos={todos} nivel={nivel + 1} />
          ))}
          {sub ? (
            <li>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (texto.trim()) criar.mutate({ id: novoId(), name: texto.trim(), parent_id: etapa.id, area_id: etapa.area_id, position: filhos.length + 1 })
                  setTexto("")
                }}
              >
                <Entrada autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} onBlur={() => !texto && setSub(false)} placeholder="Nova subetapa e Enter" className="my-1 h-9 rounded-full bg-surface" />
              </form>
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  )
}

type Captura = Tables<"captures">

export function PaginaProjeto() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const { data: projetos = [], isLoading } = useProjetos()
  // A lista de projetos não traz as anotações (texto longo); só este projeto busca as suas
  const anotacoes = useRegistro("projects", id)
  const { data: areas = [] } = useAreas()
  const { data: tarefas = [] } = useLista("tasks", { ordem: [{ coluna: "position" }] })
  const { data: vinculos = [] } = useLista("capture_projects", { colunas: "capture_id,project_id" })
  const { data: capturas = [] } = useLista("captures", { ordem: [{ coluna: "captured_at", asc: false }] })
  const atualizar = useAtualizar("projects")
  const excluir = useExcluir("projects")
  const criar = useCriar("projects")
  const [nova, setNova] = React.useState("")
  const [tarefaAberta, setTarefaAberta] = React.useState<Tables<"tasks"> | null>(null)
  const [novaTarefa, setNovaTarefa] = React.useState(false)
  const [novaCaptura, setNovaCaptura] = React.useState(false)
  const [capturaAberta, setCapturaAberta] = React.useState<Captura | null>(null)
  const [apagar, setApagar] = React.useState(false)

  const projeto = projetos.find((p) => p.id === id)
  if (isLoading)
    return (
      <MolduraCerebro detalhe>
        <Carregando />
      </MolduraCerebro>
    )
  if (!projeto) {
    return (
      <MolduraCerebro detalhe>
        <VazioCerebro
          titulo="Projeto não encontrado."
          descricao="Ele pode ter sido excluído."
          acao={
            <Botao asChild variante="primario" className="rounded-full">
              <Link href="/projetos">Voltar para Projetos</Link>
            </Botao>
          }
        />
      </MolduraCerebro>
    )
  }

  const pai = projeto.parent_id ? projetos.find((p) => p.id === projeto.parent_id) : null
  const etapas = projetos.filter((p) => p.parent_id === projeto.id).sort((a, b) => a.position - b.position)
  const pr = progresso(projeto.id, projetos)
  const pct = projeto.done ? 100 : porcentagem(pr.feitos, pr.total)
  const tarefasDoProjeto = tarefas.filter((t) => t.project_id === projeto.id)
  const pendentes = tarefasDoProjeto.filter((t) => t.status !== "done").length
  const idsCapturas = new Set(vinculos.filter((v) => v.project_id === projeto.id).map((v) => v.capture_id))
  const capturasDoProjeto = capturas.filter((c) => idsCapturas.has(c.id))
  const area = areas.find((a) => a.id === projeto.area_id)

  const adicionarEtapa = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nova.trim()) return
    criar.mutate({ id: novoId(), name: nova.trim(), parent_id: projeto.id, area_id: projeto.area_id, position: etapas.length + 1 })
    setNova("")
  }

  const desvincular = async (captura: string) => {
    const { error } = await supabase().from("capture_projects").delete().eq("capture_id", captura).eq("project_id", projeto.id)
    if (error) toast.error("Não foi possível desvincular a captura.", { description: error.message })
    qc.invalidateQueries({ queryKey: ["capture_projects"] })
  }

  return (
    <MolduraCerebro detalhe>
      <div className="mx-auto min-w-0 max-w-6xl">
        <Link href={pai ? `/projetos/${pai.id}` : "/projetos"} className="-ml-2 mb-3 inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full px-2 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4 shrink-0" /> <span className="truncate">{pai ? pai.name : "Projetos"}</span>
        </Link>

        <header className="vidro relative overflow-hidden p-4 sm:p-6">
          <span aria-hidden className="pointer-events-none absolute -left-16 -top-20 size-64 rounded-full bg-[var(--b-luz)]/15 hidden" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
            <div className="flex items-start justify-between gap-3 sm:block">
              <AnelProgresso pct={pct} tamanho={116} legenda={projeto.done ? "concluído" : "feito"} />
              <ProjetoMenu projeto={projeto} atualizar={atualizar} aoApagar={() => setApagar(true)} className="sm:hidden" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="rotulo-hud flex flex-wrap items-center gap-x-2">
                <span>{pai ? "Etapa" : "Projeto"}</span>
                {area ? (
                  <>
                    <span aria-hidden>·</span>
                    <Link href={`/projetos/areas/${area.id}`} className="hover:text-ink">{area.name}</Link>
                  </>
                ) : null}
              </p>
              <div className="mt-1">
                <TituloEditavel
                  rotulo="Renomear o projeto"
                  valor={projeto.name}
                  aoSalvar={(v) => atualizar.mutate({ id: projeto.id, name: v })}
                  className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-[2.25rem]"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {projeto.done ? <Etiqueta cor="rotina">Concluído</Etiqueta> : null}
                {projeto.archived ? <Etiqueta>Arquivado</Etiqueta> : null}
                <ChipPrazo prazo={projeto.deadline} feito={projeto.done} className="-ml-1" />
                {projeto.publish_date ? <span className="text-xs text-ink-3">publica {formatar(projeto.publish_date, "d 'de' MMM")}</span> : null}
              </div>
              <p className="mt-2 text-sm text-ink-3">
                {textoEtapas(pr.feitos, pr.total)}
                {pendentes ? ` · ${plural(pendentes, "tarefa pendente", "tarefas pendentes")}` : ""}
                {capturasDoProjeto.length ? ` · ${plural(capturasDoProjeto.length, "captura", "capturas")}` : ""}
              </p>
            </div>
            <ProjetoMenu projeto={projeto} atualizar={atualizar} aoApagar={() => setApagar(true)} className="hidden self-start sm:grid" />
          </div>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
          <div className="grid min-w-0 gap-5">
            <Painel icone={ListChecks} titulo="Etapas" acao={pr.total ? <span className="tabular text-xs text-ink-3">{textoEtapas(pr.feitos, pr.total)}</span> : null}>
              {etapas.length ? (
                <ul>
                  {etapas.map((e) => (
                    <Etapa key={e.id} etapa={e} todos={projetos} nivel={1} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-3">Divida o projeto em etapas: cada uma é um passo concreto até o fim.</p>
              )}
              <form onSubmit={adicionarEtapa} className="mt-3 flex min-h-11 items-center gap-3 rounded-full border border-dashed border-[var(--b-borda-2)] bg-surface px-3.5 focus-within:border-[var(--b-luz)]">
                <Plus className="size-4 shrink-0 text-[var(--b-luz)]" aria-hidden />
                <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Adicionar etapa" aria-label="Adicionar etapa" className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3 sm:text-sm" />
              </form>
            </Painel>

            <Painel icone={NotebookPen} titulo="Anotações">
              {anotacoes.data ? (
                <EditorMarkdown rotulo="anotações do projeto" valor={anotacoes.data.description ?? ""} aoSalvar={(v) => atualizar.mutate({ id: projeto.id, description: v || null })} />
              ) : anotacoes.error ? (
                <ErroCarregar erro={anotacoes.error} aoTentar={() => anotacoes.refetch()} />
              ) : (
                <Esqueleto className="h-24" />
              )}
            </Painel>
          </div>

          <aside className="grid min-w-0 gap-5 lg:sticky lg:top-6">
            <Painel icone={ClipboardList} titulo="Ficha">
              <dl className="grid gap-3">
                <div className="grid gap-1.5">
                  <dt className="text-xs text-ink-3">Área</dt>
                  <dd>
                    <Seletor aria-label="Área" value={projeto.area_id ?? ""} onChange={(e) => atualizar.mutate({ id: projeto.id, area_id: e.target.value || null })} className="w-full rounded-full bg-surface">
                      <option value="">Nenhuma</option>
                      {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Seletor>
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid min-w-0 gap-1.5">
                    <dt className="text-xs text-ink-3">Prazo</dt>
                    <dd>
                      <Entrada type="date" aria-label="Prazo" value={projeto.deadline ?? ""} onChange={(e) => atualizar.mutate({ id: projeto.id, deadline: e.target.value || null })} className="rounded-full bg-surface" />
                    </dd>
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <dt className="text-xs text-ink-3">Publicação</dt>
                    <dd>
                      <Entrada type="date" aria-label="Publicação" value={projeto.publish_date ?? ""} onChange={(e) => atualizar.mutate({ id: projeto.id, publish_date: e.target.value || null })} className="rounded-full bg-surface" />
                    </dd>
                  </div>
                </div>
              </dl>
            </Painel>

            <Painel
              icone={ListTodo}
              titulo="Tarefas"
              acao={<button type="button" onClick={() => setNovaTarefa(true)} className="inline-flex min-h-10 items-center gap-1 rounded-full px-2.5 text-sm font-medium text-[var(--b-luz)] hover:bg-ink/[0.06]"><Plus className="size-4" aria-hidden /> Nova</button>}
            >
              {tarefasDoProjeto.length === 0 ? (
                <p className="text-sm text-ink-3">Nenhuma tarefa ligada a este projeto.</p>
              ) : (
                <ul className="grid">
                  {tarefasDoProjeto
                    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done"))
                    .map((t) => <ItemTarefa key={t.id} tarefa={t} aoAbrir={setTarefaAberta} />)}
                </ul>
              )}
            </Painel>

            <Painel
              icone={Sparkles}
              titulo="Capturas ligadas"
              acao={<button type="button" onClick={() => setNovaCaptura(true)} className="inline-flex min-h-10 items-center gap-1 rounded-full px-2.5 text-sm font-medium text-[var(--b-luz)] hover:bg-ink/[0.06]"><Plus className="size-4" aria-hidden /> Nova</button>}
            >
              {capturasDoProjeto.length === 0 ? (
                <p className="text-sm text-ink-3">Nenhuma captura ligada. Ligue capturas pela caixa de entrada (Organizar).</p>
              ) : (
                <ul className="grid gap-1.5">
                  {capturasDoProjeto.map((c) => (
                    <li key={c.id} className="flex items-center gap-2.5 rounded-xl border border-[var(--b-borda)] bg-surface py-2 pl-2 pr-1">
                      <IconeCaptura tipo={c.kind} className="size-8" />
                      <button type="button" onClick={() => setCapturaAberta(c)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-medium hover:text-[var(--b-luz)]">{c.title}</span>
                        <span className="flex items-center gap-2 text-xs text-ink-3">
                          {c.kind}
                          {c.url ? <span className="inline-flex min-w-0 items-center gap-1"><Link2 className="size-3 shrink-0" /><span className="truncate">{dominio(c.url)}</span></span> : null}
                        </span>
                      </button>
                      <button type="button" onClick={() => desvincular(c.id)} className="inline-flex min-h-10 shrink-0 items-center rounded-full px-2.5 text-xs font-medium text-ink-3 hover:bg-ink/[0.06] hover:text-danger" aria-label={`Desligar ${c.title}`}>
                        Desligar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Painel>
          </aside>
        </div>
      </div>

      <DialogoTarefa
        aberta={novaTarefa || Boolean(tarefaAberta)}
        aoMudar={(v) => { if (!v) { setNovaTarefa(false); setTarefaAberta(null) } }}
        tarefa={tarefaAberta}
        padrao={{ project_id: projeto.id, due_date: null }}
      />
      <DialogoCaptura aberta={novaCaptura || Boolean(capturaAberta)} aoMudar={(v) => { if (!v) { setNovaCaptura(false); setCapturaAberta(null) } }} captura={capturaAberta} projetoInicial={projeto.id} />
      <Confirmar
        aberta={apagar}
        aoMudar={setApagar}
        titulo={`Excluir “${projeto.name}”?`}
        descricao="As etapas também serão excluídas. Tarefas e capturas continuam existindo, só perdem o vínculo."
        aoConfirmar={() => {
          excluir.mutate(projeto.id)
          router.push(pai ? `/projetos/${pai.id}` : "/projetos")
        }}
      />
    </MolduraCerebro>
  )
}

/** Um painel de vidro com o título em rótulo de HUD e uma ação à direita. */
function Painel({ icone: Icone, titulo, acao, children }: { icone: LucideIcon; titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="vidro min-w-0 p-4 sm:p-5" aria-label={titulo}>
      <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
        <h2 className="rotulo-hud flex items-center gap-2">
          <Icone className="size-3.5 text-[var(--b-luz)]" aria-hidden /> {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  )
}

/** Concluir, arquivar e excluir o projeto. */
function ProjetoMenu({ projeto, atualizar, aoApagar, className }: { projeto: Projeto; atualizar: ReturnType<typeof useAtualizar<"projects">>; aoApagar: () => void; className?: string }) {
  return (
    <Menu>
      <MenuGatilho asChild>
        <Botao variante="contorno" tamanho="icone" className={cn("rounded-full bg-transparent", className)} aria-label="Mais ações"><Ellipsis /></Botao>
      </MenuGatilho>
      <MenuConteudo>
        <MenuItem onSelect={() => atualizar.mutate({ id: projeto.id, done: !projeto.done, done_at: projeto.done ? null : new Date().toISOString() })}>
          {projeto.done ? <RotateCcw /> : <Archive />}
          {projeto.done ? "Reabrir" : "Marcar como concluído"}
        </MenuItem>
        <MenuItem onSelect={() => atualizar.mutate({ id: projeto.id, archived: !projeto.archived })}>
          <Archive /> {projeto.archived ? "Tirar do arquivo" : "Arquivar"}
        </MenuItem>
        <MenuSeparador />
        <MenuItem perigo onSelect={aoApagar}><Trash /> Excluir projeto</MenuItem>
      </MenuConteudo>
    </Menu>
  )
}
