"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import { useRouter } from "next/navigation"
import * as React from "react"
import { ChevronRight, FolderKanban, Plus, Search, X } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Carregando, Etiqueta, Segmentos } from "@/components/ui/basicos"
import { ACAO_ACESA, CabecalhoCerebro, MolduraCerebro } from "@/features/segundo-cerebro/cabecalho"
import { AnelProgresso, ChipPrazo, textoEtapas, VazioCerebro } from "@/features/segundo-cerebro/ui"
import { proximaEtapa } from "@/features/segundo-cerebro/logica"
import { AreaTexto, Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { novoId, useAtualizar, useCriar, useLista } from "@/lib/data"
import { STATUS_AREA } from "@/lib/rotulos"
import { cn, contem, diasAte, plural, porcentagem } from "@/lib/utils"
import { progresso, useAreas, useProjetos, type AreaPara, type Projeto } from "./dados"

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

  const ativos = raiz.filter((p) => !p.archived && !p.done)
  const contagem = {
    ativos: ativos.length,
    concluidos: raiz.filter((p) => p.done).length,
    arquivados: raiz.filter((p) => p.archived && !p.done).length,
  }
  const atrasados = ativos.filter((p) => (diasAte(p.deadline) ?? 0) < 0).length
  const vencendo = ativos.filter((p) => {
    const d = diasAte(p.deadline)
    return d !== null && d >= 0 && d <= 7
  }).length

  const tarefasPendentes = new Map<string, number>()
  for (const t of tarefas) if (t.project_id && t.status !== "done") tarefasPendentes.set(t.project_id, (tarefasPendentes.get(t.project_id) ?? 0) + 1)
  const haFiltros = Boolean(busca || filtroArea)
  const limpar = () => {
    setBusca("")
    setFiltroArea(null)
  }

  return (
    <MolduraCerebro>
      <CabecalhoCerebro
        icone={FolderKanban}
        papel="Objetivos com prazo"
        titulo="Projetos"
        descricao="Transforme ideias em resultados: cada projeto tem um objetivo, um fim e as etapas para chegar lá."
        descricaoNoCelular={!raiz.length}
        acoes={
          <Botao variante="primario" tamanho="lg" onClick={() => setNovo(true)} className={cn("rounded-full px-5", ACAO_ACESA)}>
            <Plus /> Novo projeto
          </Botao>
        }
        hud={
          isLoading || !raiz.length
            ? []
            : [
                { n: contagem.ativos, rotulo: "em andamento", cor: "var(--b-luz)" },
                ...(atrasados ? [{ n: atrasados, rotulo: atrasados === 1 ? "atrasado" : "atrasados", cor: "var(--b-rosa)" }] : []),
                ...(vencendo ? [{ n: vencendo, rotulo: "vencem em 7 dias", cor: "var(--b-ambar)" }] : []),
                { n: contagem.concluidos, rotulo: contagem.concluidos === 1 ? "concluído" : "concluídos", cor: "var(--b-menta)" },
              ]
        }
      />

      <div className="vidro mb-6 grid gap-3 p-3 sm:p-4">
        <Segmentos
          rotulo="Situação dos projetos"
          className="w-full bg-surface sm:w-fit"
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
            <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar projetos…" aria-label="Buscar projetos" className="h-11 w-full rounded-full border border-[var(--b-borda)] bg-surface pl-10 pr-10 text-base placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none sm:text-sm" />
            {busca ? <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-ink-2"><X className="size-4" /></button> : null}
          </div>
          {areas.length ? (
            <Seletor aria-label="Filtrar por área" value={filtroArea ?? ""} onChange={(e) => setFiltroArea(e.target.value || null)} className="w-full rounded-full bg-surface sm:w-auto sm:max-w-60">
              <option value="">Todas as áreas</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Seletor>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--b-borda)] pt-3">
          <span className="tabular text-xs font-medium text-ink-2" aria-live="polite">{plural(lista.length, "projeto")}</span>
          {haFiltros ? <button type="button" onClick={limpar} className="inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-[var(--b-luz)] hover:bg-ink/[0.06]"><X className="size-3.5" /> Limpar filtros</button> : null}
        </div>
      </div>

      {isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <VazioCerebro
          icone={FolderKanban}
          titulo={haFiltros ? "Nenhum projeto encontrado." : aba === "ativos" ? "Nenhum projeto em andamento." : aba === "concluidos" ? "Nenhum projeto concluído ainda." : "Nenhum projeto arquivado."}
          descricao={haFiltros ? "Tente outra busca ou tire o filtro de área." : aba === "ativos" ? "Crie um projeto para organizar o objetivo, as etapas e as entregas." : undefined}
          acao={
            haFiltros ? (
              <Botao variante="contorno" className="rounded-full bg-transparent" onClick={limpar}>Limpar filtros</Botao>
            ) : aba === "ativos" ? (
              <Botao variante="primario" className="rounded-full" onClick={() => setNovo(true)}><Plus /> Novo projeto</Botao>
            ) : null
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((p) => (
            <CartaoProjeto key={p.id} projeto={p} todos={projetos} area={p.area_id ? nomesArea.get(p.area_id) : undefined} tarefas={tarefasPendentes.get(p.id) ?? 0} />
          ))}
        </ul>
      )}

      <DialogoNovoProjeto aberta={novo} aoMudar={setNovo} />
    </MolduraCerebro>
  )
}

/** O cartão de um projeto: o anel de progresso, a área, o prazo e a próxima etapa. */
function CartaoProjeto({ projeto: p, todos, area, tarefas }: { projeto: Projeto; todos: Projeto[]; area?: string; tarefas: number }) {
  const pr = progresso(p.id, todos)
  const pct = p.done ? 100 : porcentagem(pr.feitos, pr.total)
  const proxima = p.done ? null : proximaEtapa(p.id, todos)
  return (
    <li>
      <Link href={`/projetos/${p.id}`} className="vidro-vivo group flex h-full min-h-48 flex-col p-4 focus-visible:outline-offset-2 sm:p-5">
        <div className="flex items-start gap-3.5">
          <AnelProgresso pct={pct} tamanho={56} espessura={4} />
          <div className="min-w-0 flex-1">
            <p className="break-words font-display text-[1.05rem] font-semibold leading-snug transition-colors group-hover:text-[var(--b-luz)]">{p.name}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {area ? <Etiqueta cor="projetos" className="max-w-full">{area}</Etiqueta> : null}
              <ChipPrazo prazo={p.deadline} feito={p.done} className="-ml-1" />
            </div>
          </div>
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-ink-3 transition-colors group-hover:text-[var(--b-luz)]" aria-hidden />
        </div>
        <div className="mt-auto pt-5">
          {proxima ? (
            <p className="mb-2 flex min-w-0 items-center gap-2 text-sm">
              <span className="rotulo-hud shrink-0 text-[10px]">Próxima</span>
              <span className="min-w-0 truncate text-ink-2">{proxima.name}</span>
            </p>
          ) : null}
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
            <span className="tabular">{p.done ? "Concluído" : textoEtapas(pr.feitos, pr.total)}</span>
            {tarefas ? <span>· {plural(tarefas, "tarefa pendente", "tarefas pendentes")}</span> : null}
          </p>
        </div>
      </Link>
    </li>
  )
}
