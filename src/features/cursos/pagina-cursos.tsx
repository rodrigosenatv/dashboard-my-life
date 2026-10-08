"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { ExternalLink, Plus } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Segmentos, Cabecalho, Carregando, Etiqueta, Progresso, Vazio } from "@/components/ui/basicos"
import { AreaTexto, Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { novoId, useAtualizar, useCriar, useExcluir, useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { STATUS_CURSO, type StatusCurso } from "@/lib/rotulos"
import { urlValida } from "@/lib/utils"
import { Pomodoro } from "@/components/pomodoro"

type Curso = Tables<"courses">

function DialogoCurso({ aberta, aoMudar, curso }: { aberta: boolean; aoMudar: (v: boolean) => void; curso?: Curso | null }) {
  const criar = useCriar("courses")
  const atualizar = useAtualizar("courses")
  const excluir = useExcluir("courses")
  const [nome, setNome] = React.useState("")
  const [status, setStatus] = React.useState("nao_comecou")
  const [cats, setCats] = React.useState("")
  const [url, setUrl] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [prog, setProg] = React.useState("")
  const [notas, setNotas] = React.useState("")
  React.useEffect(() => {
    if (!aberta) return
    setNome(curso?.name ?? "")
    setStatus(curso?.status ?? "nao_comecou")
    setCats((curso?.categories ?? []).join(", "))
    setUrl(curso?.url ?? "")
    setEmail(curso?.access_email ?? "")
    setProg(curso?.progress?.toString() ?? "")
    setNotas(curso?.notes ?? "")
  }, [aberta, curso])
  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return
    const campos = {
      name: nome.trim(),
      status,
      categories: cats.split(",").map((c) => c.trim()).filter(Boolean),
      url: url.trim() || null,
      access_email: email.trim() || null,
      progress: prog ? Math.min(100, Math.max(0, Number(prog))) : status === "concluido" ? 100 : null,
      notes: notas.trim() || null,
    }
    if (curso) atualizar.mutate({ id: curso.id, ...campos })
    else criar.mutate({ id: novoId(), ...campos })
    aoMudar(false)
  }
  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={curso ? "Editar curso" : "Novo curso"}
      rodape={
        <>
          {curso ? <Botao variante="fantasma" className="mr-auto text-danger hover:text-danger" onClick={() => { excluir.mutate(curso.id); aoMudar(false) }}>Excluir</Botao> : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-curso" disabled={!nome.trim()}>{curso ? "Salvar" : "Adicionar"}</Botao>
        </>
      }
    >
      <form id="form-curso" onSubmit={salvar} className="grid gap-4">
        <Campo rotulo="Curso" htmlFor="cu-nome"><Entrada id="cu-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Situação" htmlFor="cu-status">
            <Seletor id="cu-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(STATUS_CURSO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </Seletor>
          </Campo>
          <Campo rotulo="Progresso (%)" htmlFor="cu-prog"><Entrada id="cu-prog" inputMode="numeric" value={prog} onChange={(e) => setProg(e.target.value)} /></Campo>
        </div>
        <Campo rotulo="Categorias" htmlFor="cu-cats" dica="Separe por vírgula"><Entrada id="cu-cats" value={cats} onChange={(e) => setCats(e.target.value)} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Link de acesso" htmlFor="cu-url"><Entrada id="cu-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Campo>
          <Campo rotulo="E-mail de acesso" htmlFor="cu-email"><Entrada id="cu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
        </div>
        <Campo rotulo="Anotações" htmlFor="cu-notas" dica="Não guarde senhas aqui; use um gerenciador de senhas.">
          <AreaTexto id="cu-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={4} />
        </Campo>
      </form>
    </Janela>
  )
}

export function PaginaCursos() {
  const params = useSearchParams()
  const { data: cursos = [], isLoading } = useLista("courses", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  const atualizar = useAtualizar("courses")
  const [aberto, setAberto] = React.useState<Curso | null>(null)
  const [novo, setNovo] = React.useState(false)
  const [visao, setVisao] = React.useState<"aprendendo" | "fila" | "concluidos" | "categorias">("aprendendo")

  React.useEffect(() => {
    const id = params.get("abrir")
    const c = id ? cursos.find((x) => x.id === id) : null
    if (c) setAberto(c)
  }, [params, cursos])

  const porStatus = (st: StatusCurso[]) => cursos.filter((c) => st.includes(c.status as StatusCurso))
  const porCategoria = (lista: typeof cursos) => {
    const mapa = new Map<string, typeof cursos>()
    for (const c of lista) for (const k of c.categories.length ? c.categories : ["Sem categoria"]) mapa.set(k, [...(mapa.get(k) ?? []), c])
    return [...mapa.entries()].sort(([a], [b]) => (a === "Sem categoria" ? 1 : b === "Sem categoria" ? -1 : a.localeCompare(b))).map(([titulo, itens]) => ({ titulo, itens }))
  }
  const grupos =
    visao === "aprendendo"
      ? [{ titulo: "Em andamento", itens: porStatus(["em_andamento"]) }, { titulo: "Pausados", itens: porStatus(["pausado"]) }].filter((g) => g.itens.length)
      : visao === "fila"
        ? [{ titulo: "Não começou", itens: porStatus(["nao_comecou"]) }].filter((g) => g.itens.length)
        : visao === "concluidos"
          ? porCategoria(porStatus(["concluido"]))
          : porCategoria(cursos)

  return (
    <div>
      <Cabecalho
        area="estudos"
        titulo="Cursos"
        descricao="O que você está aprendendo, o que já terminou e o que está na fila."
        acoes={<Botao variante="primario" onClick={() => setNovo(true)}><Plus /> Novo curso</Botao>}
      />
      {isLoading ? (
        <Carregando />
      ) : cursos.length === 0 ? (
        <Vazio titulo="Nenhum curso cadastrado." />
      ) : (
        <>
          <Segmentos
            rotulo="Visualização dos cursos"
            className="mb-6"
            valor={visao}
            aoMudar={setVisao}
            opcoes={[
              { valor: "aprendendo", rotulo: "Aprendendo", contagem: cursos.filter((c) => c.status === "em_andamento" || c.status === "pausado").length },
              { valor: "fila", rotulo: "Não começou", contagem: cursos.filter((c) => c.status === "nao_comecou").length },
              { valor: "concluidos", rotulo: "Concluídos", contagem: cursos.filter((c) => c.status === "concluido").length },
              { valor: "categorias", rotulo: "Por categoria" },
            ]}
          />
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="grid min-w-0 gap-10">
              {grupos.length === 0 ? <Vazio titulo="Nenhum curso aqui." /> : null}
              {grupos.map((g) => (
                <section key={g.titulo}>
                  <h2 className="mb-3 flex items-baseline gap-2 font-display text-lg font-semibold">
                    {g.titulo} <span className="tabular text-sm font-normal text-ink-3">{g.itens.length}</span>
                  </h2>
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {g.itens.map((c) => {
                      const s = c.status as StatusCurso
                    const link = urlValida(c.url)
                    return (
                      <li key={c.id} className="flex flex-col rounded-lg border border-line bg-surface p-4">
                        <button type="button" onClick={() => setAberto(c)} className="text-left font-medium leading-snug hover:underline">{c.name}</button>
                        <div className="mt-2 flex flex-wrap gap-1">{c.categories.map((t) => <Etiqueta key={t}>{t}</Etiqueta>)}</div>
                        <div className="mt-auto flex items-center gap-2 pt-4">
                          {c.progress !== null && s !== "concluido" ? (
                            <>
                              <Progresso valor={c.progress} cor="estudos" rotulo={`Progresso de ${c.name}`} />
                              <span className="tabular text-xs text-ink-3">{c.progress}%</span>
                            </>
                          ) : (
                            <span className="flex-1" />
                          )}
                          {link ? (
                            <a href={link} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-pen hover:underline">
                              <ExternalLink className="size-3.5" /> Acessar
                            </a>
                          ) : null}
                        </div>
                        <Seletor aria-label={`Situação de ${c.name}`} value={c.status} onChange={(e) => atualizar.mutate({ id: c.id, status: e.target.value })} className="mt-3 h-8">
                          {Object.entries(STATUS_CURSO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                        </Seletor>
                      </li>
                    )
                    })}
                  </ul>
                </section>
              ))}
            </div>
            <aside className="order-first xl:order-none">
              <Pomodoro className="xl:sticky xl:top-6" />
            </aside>
          </div>
        </>
      )}
      <DialogoCurso aberta={novo || Boolean(aberto)} aoMudar={(v) => { if (!v) { setNovo(false); setAberto(null) } }} curso={aberto} />
    </div>
  )
}
