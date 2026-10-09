"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Archive, ArrowLeft, ChevronRight, Ellipsis, Link2, Plus, RotateCcw, Trash } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Carregando, Etiqueta, Marcador, MarcaArea, Progresso, Secao, Vazio } from "@/components/ui/basicos"
import { EdicaoEmLinha, Entrada, Seletor } from "@/components/ui/campos"
import { Confirmar } from "@/components/ui/janela"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { EditorMarkdown } from "@/components/markdown"
import { novoId, useAtualizar, useCriar, useExcluir, useLista } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import { cn, dominio, porcentagem } from "@/lib/utils"
import { ItemTarefa } from "@/features/tarefas/item-tarefa"
import { DialogoTarefa } from "@/features/tarefas/dialogo-tarefa"
import { DialogoCaptura } from "@/features/capturas/dialogo-captura"
import type { Tables } from "@/lib/supabase/database.types"
import { progresso, useAreas, useProjetos, type Projeto } from "./dados"

function Etapa({ etapa, todos, nivel }: { etapa: Projeto; todos: Projeto[]; nivel: number }) {
  const atualizar = useAtualizar("projects")
  const excluir = useExcluir("projects")
  const criar = useCriar("projects")
  const [sub, setSub] = React.useState(false)
  const [texto, setTexto] = React.useState("")
  const filhos = todos.filter((p) => p.parent_id === etapa.id).sort((a, b) => a.position - b.position)

  return (
    <li>
      <div className="group flex items-start gap-3 rounded-md py-1.5">
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
          <MenuGatilho className="rounded-md p-1 text-ink-3 opacity-60 hover:bg-surface-2 group-hover:opacity-100" aria-label={`Opções de ${etapa.name}`}>
            <Ellipsis className="size-4" />
          </MenuGatilho>
          <MenuConteudo>
            {nivel < 2 ? <MenuItem onSelect={() => setSub(true)}><Plus /> Adicionar subetapa</MenuItem> : null}
            <MenuItem asChild><Link href={`/projetos/${etapa.id}`}><ChevronRight /> Abrir como projeto</Link></MenuItem>
            <MenuSeparador />
            <MenuItem perigo onSelect={() => excluir.mutate(etapa.id)}><Trash /> Excluir</MenuItem>
          </MenuConteudo>
        </Menu>
      </div>
      {filhos.length || sub ? (
        <ul className="ml-8 border-l border-line pl-3">
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
                <Entrada autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} onBlur={() => !texto && setSub(false)} placeholder="Nova subetapa e Enter" className="my-1 h-8" />
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
  if (isLoading) return <Carregando />
  if (!projeto) {
    return <Vazio titulo="Projeto não encontrado." descricao="Ele pode ter sido excluído." acao={<Link href="/projetos" className="text-sm font-medium text-pen">Voltar para projetos</Link>} />
  }

  const pai = projeto.parent_id ? projetos.find((p) => p.id === projeto.parent_id) : null
  const etapas = projetos.filter((p) => p.parent_id === projeto.id).sort((a, b) => a.position - b.position)
  const pr = progresso(projeto.id, projetos)
  const pct = projeto.done ? 100 : porcentagem(pr.feitos, pr.total)
  const tarefasDoProjeto = tarefas.filter((t) => t.project_id === projeto.id)
  const idsCapturas = new Set(vinculos.filter((v) => v.project_id === projeto.id).map((v) => v.capture_id))
  const capturasDoProjeto = capturas.filter((c) => idsCapturas.has(c.id))

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
    <div className="max-w-4xl">
      <Link href={pai ? `/projetos/${pai.id}` : "/projetos"} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" /> {pai ? pai.name : "Projetos"}
      </Link>

      <header className="mb-8">
        <div className="flex items-start gap-3">
          <MarcaArea area="projetos" className="mt-2 h-8" />
          <div className="min-w-0 flex-1">
            <EdicaoEmLinha
              rotulo="Nome do projeto"
              valor={projeto.name}
              aoSalvar={(v) => v && atualizar.mutate({ id: projeto.id, name: v })}
              className="font-display text-3xl font-semibold"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {projeto.done ? <Etiqueta cor="rotina">Concluído</Etiqueta> : null}
              {projeto.archived ? <Etiqueta>Arquivado</Etiqueta> : null}
            </div>
          </div>
          <Menu>
            <MenuGatilho asChild>
              <Botao variante="contorno" tamanho="icone" aria-label="Mais ações"><Ellipsis /></Botao>
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
              <MenuItem perigo onSelect={() => setApagar(true)}><Trash /> Excluir projeto</MenuItem>
            </MenuConteudo>
          </Menu>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="mb-1 text-xs text-ink-3">Área</dt>
            <dd>
              <Seletor aria-label="Área" value={projeto.area_id ?? ""} onChange={(e) => atualizar.mutate({ id: projeto.id, area_id: e.target.value || null })} className="h-8">
                <option value="">Nenhuma</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Seletor>
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-ink-3">Prazo</dt>
            <dd>
              <Entrada type="date" aria-label="Prazo" value={projeto.deadline ?? ""} onChange={(e) => atualizar.mutate({ id: projeto.id, deadline: e.target.value || null })} className="h-8" />
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-ink-3">Publicação</dt>
            <dd>
              <Entrada type="date" aria-label="Publicação" value={projeto.publish_date ?? ""} onChange={(e) => atualizar.mutate({ id: projeto.id, publish_date: e.target.value || null })} className="h-8" />
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-ink-3">Progresso</dt>
            <dd className="pt-1.5">
              <div className="flex items-center gap-2">
                <Progresso valor={pct} cor="projetos" rotulo="Progresso do projeto" />
                <span className="tabular text-sm">{pct}%</span>
              </div>
            </dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-10">
        <Secao titulo="Etapas" acao={<span className="tabular text-sm text-ink-3">{pr.total ? `${pr.feitos} de ${pr.total}` : ""}</span>}>
          <ul>
            {etapas.map((e) => (
              <Etapa key={e.id} etapa={e} todos={projetos} nivel={1} />
            ))}
          </ul>
          <form onSubmit={adicionarEtapa} className="mt-1 flex items-center gap-3">
            <span aria-hidden className="size-5 shrink-0 rounded-full border-[1.5px] border-dashed border-line-strong" />
            <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Adicionar etapa" aria-label="Adicionar etapa" className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3" />
          </form>
        </Secao>

        <Secao titulo="Tarefas" acao={<button type="button" onClick={() => setNovaTarefa(true)} className="text-sm text-ink-2 hover:text-ink">Nova tarefa</button>}>
          {tarefasDoProjeto.length === 0 ? (
            <p className="text-sm text-ink-2">Nenhuma tarefa ligada a este projeto.</p>
          ) : (
            <ul className="grid">
              {tarefasDoProjeto
                .sort((a, b) => Number(a.status === "done") - Number(b.status === "done"))
                .map((t) => <ItemTarefa key={t.id} tarefa={t} aoAbrir={setTarefaAberta} />)}
            </ul>
          )}
        </Secao>

        <Secao titulo="Anotações">
          <EditorMarkdown rotulo="anotações do projeto" valor={projeto.description ?? ""} aoSalvar={(v) => atualizar.mutate({ id: projeto.id, description: v || null })} />
        </Secao>

        <Secao titulo="Capturas ligadas" acao={<button type="button" onClick={() => setNovaCaptura(true)} className="text-sm text-ink-2 hover:text-ink">Nova captura</button>}>
          {capturasDoProjeto.length === 0 ? (
            <p className="text-sm text-ink-2">Nenhuma captura ligada. Ligue capturas pela caixa de entrada.</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {capturasDoProjeto.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  <button type="button" onClick={() => setCapturaAberta(c)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium">{c.title}</span>
                    <span className="flex items-center gap-2 text-xs text-ink-3">
                      {c.kind}
                      {c.url ? <span className="inline-flex items-center gap-1"><Link2 className="size-3" />{dominio(c.url)}</span> : null}
                    </span>
                  </button>
                  <button type="button" onClick={() => desvincular(c.id)} className="text-xs text-ink-3 hover:text-ink">Desligar</button>
                </li>
              ))}
            </ul>
          )}
        </Secao>
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
    </div>
  )
}
