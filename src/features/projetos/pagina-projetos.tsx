"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { CalendarClock, Plus } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Etiqueta, Progresso, Secao, Segmentos, Vazio } from "@/components/ui/basicos"
import { AreaTexto, Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { novoId, useAtualizar, useCriar, useLista } from "@/lib/data"
import { STATUS_AREA } from "@/lib/rotulos"
import { cn, dataRelativa, diasAte, porcentagem } from "@/lib/utils"
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
        <div className="grid grid-cols-2 gap-3">
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

function DialogoArea({ aberta, aoMudar, area }: { aberta: boolean; aoMudar: (v: boolean) => void; area?: AreaPara | null }) {
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
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"))

  const contagem = {
    ativos: raiz.filter((p) => !p.archived && !p.done).length,
    concluidos: raiz.filter((p) => p.done).length,
    arquivados: raiz.filter((p) => p.archived && !p.done).length,
  }

  return (
    <div>
      <Cabecalho
        area="projetos"
        titulo="Projetos"
        descricao="Seu segundo cérebro: projetos com começo e fim, áreas de responsabilidade e tudo que você captura."
        acoes={
          <Botao variante="primario" onClick={() => setNovo(true)}>
            <Plus /> Novo projeto
          </Botao>
        }
      />

      <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <section>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Segmentos
              rotulo="Situação dos projetos"
              valor={aba}
              aoMudar={setAba}
              opcoes={[
                { valor: "ativos", rotulo: "Em andamento", contagem: contagem.ativos },
                { valor: "concluidos", rotulo: "Concluídos", contagem: contagem.concluidos },
                { valor: "arquivados", rotulo: "Arquivados", contagem: contagem.arquivados },
              ]}
            />
            {filtroArea ? (
              <button type="button" onClick={() => setFiltroArea(null)} className="text-sm text-ink-2 hover:text-ink">
                Área: {nomesArea.get(filtroArea)} (limpar)
              </button>
            ) : null}
          </div>

          {isLoading ? (
            <Carregando />
          ) : lista.length === 0 ? (
            <Vazio titulo={aba === "ativos" ? "Nenhum projeto em andamento." : "Nada por aqui."} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {lista.map((p) => {
                const pr = progresso(p.id, projetos)
                const pct = porcentagem(pr.feitos, pr.total)
                const dias = diasAte(p.deadline)
                const nTarefas = tarefas.filter((t) => t.project_id === p.id && t.status !== "done").length
                return (
                  <li key={p.id}>
                    <Link
                      href={`/projetos/${p.id}`}
                      className="flex h-full flex-col rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium leading-snug">{p.name}</p>
                        {p.area_id ? <Etiqueta cor="projetos" className="shrink-0">{nomesArea.get(p.area_id)}</Etiqueta> : null}
                      </div>
                      <div className="mt-auto pt-4">
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
                        <Progresso valor={p.done ? 100 : pct} cor="projetos" rotulo={`Progresso de ${p.name}`} />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <Secao
          titulo="Áreas"
          acao={
            <button type="button" onClick={() => setNovaArea(true)} className="text-sm text-ink-2 hover:text-ink">
              Nova área
            </button>
          }
        >
          {areas.length === 0 ? (
            <p className="text-sm text-ink-2">Nenhuma área cadastrada.</p>
          ) : (
            <ul className="grid gap-1">
              {areas.map((a) => {
                const n = raiz.filter((p) => p.area_id === a.id && !p.archived && !p.done).length
                return (
                  <li key={a.id} className="group flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFiltroArea(filtroArea === a.id ? null : a.id)}
                      className={cn(
                        "flex min-w-0 flex-1 items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-surface-2",
                        filtroArea === a.id && "bg-projetos-soft",
                        a.status === "arquivada" && "text-ink-3",
                      )}
                    >
                      <span className="truncate">{a.name}</span>
                      <span className="tabular text-xs text-ink-3">{n || ""}</span>
                    </button>
                    <button type="button" onClick={() => setAreaAberta(a)} className="rounded px-1.5 text-xs text-ink-3 opacity-0 hover:text-ink group-hover:opacity-100 focus-visible:opacity-100">
                      Editar
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Secao>
      </div>

      <DialogoNovoProjeto aberta={novo} aoMudar={setNovo} />
      <DialogoArea aberta={novaArea || Boolean(areaAberta)} aoMudar={(v) => { if (!v) { setNovaArea(false); setAreaAberta(null) } }} area={areaAberta} />
    </div>
  )
}
