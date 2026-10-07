"use client"

import * as React from "react"
import { Botao } from "@/components/ui/button"
import { AreaTexto, Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { novoId, useCriar, useAtualizar, useExcluir, useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { PRIORIDADE, STATUS_TAREFA, TIPO_TAREFA } from "@/lib/rotulos"
import { isoDia } from "@/lib/utils"

type Tarefa = Tables<"tasks">

export function DialogoTarefa({
  aberta,
  aoMudar,
  tarefa,
  padrao,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  tarefa?: Tarefa | null
  padrao?: Partial<Tarefa>
}) {
  const criar = useCriar("tasks")
  const atualizar = useAtualizar("tasks")
  const excluir = useExcluir("tasks")
  const { data: projetos = [] } = useLista("projects", {
    colunas: "id,name,parent_id,archived,done",
    ordem: [{ coluna: "name" }],
  })

  const [titulo, setTitulo] = React.useState("")
  const [descricao, setDescricao] = React.useState("")
  const [data, setData] = React.useState("")
  const [hora, setHora] = React.useState("")
  const [prioridade, setPrioridade] = React.useState<string>("")
  const [tipo, setTipo] = React.useState<string>("tarefa")
  const [status, setStatus] = React.useState<string>("todo")
  const [projeto, setProjeto] = React.useState<string>("")

  React.useEffect(() => {
    if (!aberta) return
    const base = { ...padrao, ...tarefa }
    setTitulo(base.title ?? "")
    setDescricao(base.description ?? "")
    setData(base.due_date ?? (tarefa ? "" : isoDia()))
    setHora(base.due_time?.slice(0, 5) ?? "")
    setPrioridade(base.priority ?? "")
    setTipo(base.kind ?? "tarefa")
    setStatus(base.status ?? "todo")
    setProjeto(base.project_id ?? "")
  }, [aberta, tarefa, padrao])

  const ativos = projetos.filter((p) => !p.archived && !p.done && !p.parent_id)

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) return
    const campos = {
      title: titulo.trim(),
      description: descricao.trim() || null,
      due_date: data || null,
      due_time: hora || null,
      priority: (prioridade || null) as Tarefa["priority"],
      kind: tipo,
      status,
      project_id: projeto || null,
      done_at: status === "done" ? (tarefa?.done_at ?? new Date().toISOString()) : null,
    }
    if (tarefa) atualizar.mutate({ id: tarefa.id, ...campos })
    else criar.mutate({ id: novoId(), position: Date.now(), ...campos })
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={tarefa ? "Editar tarefa" : "Nova tarefa"}
      rodape={
        <>
          {tarefa ? (
            <Botao
              variante="fantasma"
              className="mr-auto text-danger hover:text-danger"
              onClick={() => {
                excluir.mutate(tarefa.id)
                aoMudar(false)
              }}
            >
              Excluir
            </Botao>
          ) : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form="form-tarefa" disabled={!titulo.trim()}>
            {tarefa ? "Salvar" : "Criar tarefa"}
          </Botao>
        </>
      }
    >
      <form id="form-tarefa" onSubmit={salvar} className="grid gap-4">
        <Campo rotulo="O que precisa ser feito" htmlFor="t-titulo">
          <Entrada id="t-titulo" autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Enviar cálculo do mês" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Vencimento" htmlFor="t-data">
            <Entrada id="t-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo rotulo="Horário" htmlFor="t-hora">
            <Entrada id="t-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Tríade do tempo" htmlFor="t-prio">
            <Seletor id="t-prio" value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
              <option value="">Sem classificação</option>
              {Object.entries(PRIORIDADE).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </Seletor>
          </Campo>
          <Campo rotulo="Situação" htmlFor="t-status">
            <Seletor id="t-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(STATUS_TAREFA).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </Seletor>
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Tipo" htmlFor="t-tipo">
            <Seletor id="t-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {Object.entries(TIPO_TAREFA).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </Seletor>
          </Campo>
          <Campo rotulo="Projeto" htmlFor="t-proj">
            <Seletor id="t-proj" value={projeto} onChange={(e) => setProjeto(e.target.value)}>
              <option value="">Nenhum</option>
              {ativos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {projeto && !ativos.some((p) => p.id === projeto) ? (
                <option value={projeto}>{projetos.find((p) => p.id === projeto)?.name ?? "Projeto"}</option>
              ) : null}
            </Seletor>
          </Campo>
        </div>
        <Campo rotulo="Detalhes" htmlFor="t-desc">
          <AreaTexto id="t-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" />
        </Campo>
      </form>
    </Janela>
  )
}
