"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { CalendarClock, ChevronRight, FolderKanban, Plus, Search, X } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Carregando, Etiqueta, Progresso, Segmentos, Vazio } from "@/components/ui/basicos"
import { CabecalhoCerebro } from "@/features/segundo-cerebro/cabecalho"
import { AreaTexto, Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { novoId, useAtualizar, useCriar, useLista } from "@/lib/data"
import { STATUS_AREA } from "@/lib/rotulos"
import { cn, contem, dataRelativa, diasAte, porcentagem } from "@/lib/utils"
import { progresso, useAreas, useProjetos, type AreaPara } from "./dados"

type Aba = "ativos" | "concluidos" | "arquivados"

function DialogoNovoProjeto({ aberta, aoMudar }: { aberta: boolean; aoMudar: (v: boolean) => void }) {
  const router = useRouter()
  const criar = useCriar("projects")
  const { data: areas = [] } = useAreas()
  const [nome, setNome] = React.useState("")
  const [area, setArea] = React.useState("")
  const [prazo, setPrazo] = React.useState("")
  React.useEffect(() => {
    if (aberta) {
      setNome("")
      setArea("")
      setPrazo("")
    }
  }, [aberta])
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return
    const id = novoId()
    await criar.mutateAsync({ id, name: nome.trim(), area_id: area || null, deadline: prazo || null, position: Date.now() % 1_000_000 })
    aoMudar(false)
    router.push(`/projetos/${id}`)
  }
  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo="Novo projeto"
      descricao="Um projeto tem um objetivo e um fim. Você divide em etapas na próxima tela."
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-projeto" disabled={!nome.trim()}>Criar projeto</Botao>
        </>
      }
    >
      <form id="form-projeto" onSubmit={salvar} className="grid gap-4">
        <Campo rotulo="Nome" htmlFor="p-nome">
          <Entrada id="p-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Lançar ebook de questões" />
        </Campo>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo rotulo="Área" htmlFor="p-area">
            <Seletor id="p-area" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Nenhuma</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Seletor>
          </Campo>
          <Campo rotulo="Prazo" htmlFor="p-prazo">
            <Entrada id="p-prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </Campo>
        </div>
      </form>
    </Janela>
  )
}

export function DialogoArea({ aberta, aoMudar, area }: { aberta: boolean; aoMudar: (v: boolean) => void; area?: AreaPara | null }) {
  const criar = useCriar("areas")
  const atualizar = useAtualizar("areas")
  const [nome, setNome] = React.useState("")
  const [status, setStatus] = React.useState("ativa")
  const [descricao, setDescricao] = React.useState("")
  React.useEffect(() => {
    if (!aberta) return
    setNome(area?.name ?? "")
    setStatus(area?.status ?? "ativa")
    setDescricao(area?.description ?? "")
  }, [aberta, area])
  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return
    const campos = { name: nome.trim(), status, description: descricao.trim() || null }
    if (area) atualizar.mutate({ id: area.id, ...campos })
    else criar.mutate({ id: novoId(), ...campos })
    aoMudar(false)
  }
  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={area ? "Editar área" : "Nova área"}
      descricao="Áreas são responsabilidades contínuas, sem data para acabar: saúde, finanças, concursos…"
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-area" disabled={!nome.trim()}>{area ? "Salvar" : "Criar área"}</Botao>
        </>
      }
    >
      <form id="form-area" onSubmit={salvar} className="grid gap-4">
        <Campo rotulo="Nome" htmlFor="a-nome">
          <Entrada id="a-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <Campo rotulo="Situação" htmlFor="a-status">
          <Seletor id="a-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(STATUS_AREA).map(([v, r]) => (
              <option key={v} value={v}>{r}</option>
            ))}
          </Seletor>
        </Campo>
        <Campo rotulo="Descrição" htmlFor="a-desc">
          <AreaTexto id="a-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
        </Campo>
      </form>
    </Janela>
  )
}

export function PaginaProjetos() {
  const [aba, setAba] = React.useState<Aba>("ativos")
  const [busca, setBusca] = React.useState("")
  const [novo, setNovo] = React.useState(false)
  const [areaAberta, setAreaAberta] = React.useState<AreaPara | null>(null)
  const [novaArea, setNovaArea] = React.useState(false)
  const [filtroArea, setFiltroArea] = React.useState<string | null>(null)
  const { data: projetos = [], isLoading } = useProjetos()
  const { data: areas = [] } = useAreas()
  const { data: tarefas = [] } = useLista("tasks", { colunas: "id,project_id,status", chave: ["resumo-projetos"] })

  const raiz = projetos.filter((p) => !p.parent_id)
  const nomesArea = new Map(areas.map((a) => [a.id, a.name]))
  const lista = raiz
    .filter((p) =>
      aba === "ativos" ? !p.archived && !p.done : aba === "concluidos" ? p.done : p.archived && !p.done,
    )
    .filter((p) => !filtroArea || p.area_id === filtroArea)
    .filter((p) => !busca || contem(p.name, busca))
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"))

  const contagem = {
    ativos: raiz.filter((p) => !p.archived && !p.done).length,
    concluidos: raiz.filter((p) => p.done).length,
    arquivados: raiz.filter((p) => p.archived && !p.done).length,
  }

  const tarefasPendentes = new Map<string, number>()
  for (const t of tarefas) if (t.project_id && t.status !== "done") tarefasPendentes.set(t.project_id, (tarefasPendentes.get(t.project_id) ?? 0) + 1)

  return (
    <div>
      <CabecalhoCerebro
        icone={FolderKanban}
        titulo="Projetos"
        descricao="Transforme ideias em resultados. Acompanhe etapas, tarefas e referências de cada projeto."
        acoes={
          <Botao variante="primario" onClick={() => setNovo(true)}>
            <Plus /> Novo projeto
          </Botao>
        }
      />

      <div>
        <section>
          <div className="mb-5 grid gap-3 rounded-2xl border border-line bg-surface p-3 sm:p-4">
            <Segmentos
              rotulo="Situação dos projetos"
              className="w-full sm:w-fit"
              valor={aba}
              aoMudar={setAba}
              opcoes={[
                { valor: "ativos", rotulo: "Em andamento", contagem: contagem.ativos },
                { valor: "concluidos", rotulo: "Concluídos", contagem: contagem.concluidos },
                { valor: "arquivados", rotulo: "Arquivados", contagem: contagem.arquivados },
              ]}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar projetos…" aria-label="Buscar projetos" className="h-11 w-full rounded-xl border border-line-strong bg-bg/50 pl-10 pr-10 text-base focus-visible:border-projetos focus-visible:outline-none sm:text-sm" />
                {busca ? <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-ink-2"><X className="size-4" /></button> : null}
              </div>
              {areas.length ? (
                <Seletor aria-label="Filtrar por área" value={filtroArea ?? ""} onChange={(e) => setFiltroArea(e.target.value || null)} className="w-full sm:w-auto sm:max-w-60">
                  <option value="">Todas as áreas</option>
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Seletor>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <span className="tabular text-xs font-medium text-ink-2" aria-live="polite">{lista.length} {lista.length === 1 ? "projeto" : "projetos"}</span>
              {busca || filtroArea ? <button type="button" onClick={() => { setBusca(""); setFiltroArea(null) }} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-semibold text-projetos hover:bg-projetos-soft"><X className="size-3.5" /> Limpar filtros</button> : null}
            </div>
          </div>

          {isLoading ? (
            <Carregando />
          ) : lista.length === 0 ? (
            <Vazio className="rounded-2xl bg-surface p-7 sm:p-10" titulo={busca || filtroArea ? "Nenhum projeto encontrado." : aba === "ativos" ? "Nenhum projeto em andamento." : "Nada por aqui."} descricao={busca || filtroArea ? "Tente outra busca ou remova o filtro de área." : "Crie um projeto para organizar objetivos, etapas e entregas."} acao={busca || filtroArea ? <Botao variante="contorno" onClick={() => { setBusca(""); setFiltroArea(null) }}>Limpar filtros</Botao> : <Botao variante="primario" onClick={() => setNovo(true)}><Plus /> Novo projeto</Botao>} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lista.map((p) => {
                const pr = progresso(p.id, projetos)
                const pct = porcentagem(pr.feitos, pr.total)
                const dias = diasAte(p.deadline)
                const nTarefas = tarefasPendentes.get(p.id) ?? 0
                return (
                  <li key={p.id}>
                    <Link
                      href={`/projetos/${p.id}`}
                      className="group flex h-full min-h-44 flex-col rounded-2xl border border-line bg-surface p-4 shadow-[0_8px_24px_-24px_rgba(20,36,43,0.5)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-projetos/40 hover:shadow-md focus-visible:outline-offset-2 sm:p-5"
                    >
                      <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-projetos-soft text-projetos"><FolderKanban className="size-5" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-display text-base font-semibold leading-snug group-hover:text-projetos">{p.name}</p>
                          {p.area_id ? <Etiqueta cor="projetos" className="mt-2 max-w-full">{nomesArea.get(p.area_id)}</Etiqueta> : null}
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-ink-3 group-hover:text-projetos" aria-hidden />
                      </div>
                      <div className="mt-auto pt-5">
                        <div className="mb-1.5 flex items-center justify-between text-xs text-ink-3">
                          <span className="tabular">{pr.total ? `${pr.feitos} de ${pr.total} etapas` : "Sem etapas"}</span>
                          {p.deadline ? (
                            <span className={cn("inline-flex items-center gap-1", dias !== null && dias < 0 && !p.done && "text-danger")}>
                              <CalendarClock className="size-3.5" />
                              {dataRelativa(p.deadline)}
                            </span>
                          ) : nTarefas ? (
                            <span>{nTarefas === 1 ? "1 tarefa" : `${nTarefas} tarefas`}</span>
                          ) : null}
                        </div>
                        <Progresso className="h-2" valor={p.done ? 100 : pct} cor="projetos" rotulo={`Progresso de ${p.name}`} />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

      </div>

      <DialogoNovoProjeto aberta={novo} aoMudar={setNovo} />
      <DialogoArea aberta={novaArea || Boolean(areaAberta)} aoMudar={(v) => { if (!v) { setNovaArea(false); setAreaAberta(null) } }} area={areaAberta} />
    </div>
  )
}
