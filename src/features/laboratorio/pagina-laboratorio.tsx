"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Lightbulb, Plus } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Etiqueta, Secao, Vazio } from "@/components/ui/basicos"
import { AreaTexto, Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { Markdown } from "@/components/markdown"
import { novoId, useAtualizar, useCriar, useExcluir, useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { RESULTADO_EXPERIMENTO, STATUS_EXPERIMENTO, type StatusExperimento } from "@/lib/rotulos"
import { formatar } from "@/lib/utils"

type Experimento = Tables<"experiments">
const TIPOS = ["Técnica", "Hábito", "Ferramenta", "Processo", "Metodologia", "Ideia", "Projeto curto"]

const corResultado: Record<string, "rotina" | "perigo" | "estudos" | "neutra"> = {
  funcionou: "rotina",
  nao_funcionou: "perigo",
  parcial: "estudos",
  indefinido: "neutra",
}

// Mesmo roteiro do modelo "Novo Experimento" do Notion
const MODELO_EXPERIMENTO = `### Objetivo
-

### Procedimento
1.

### Evidências
Prints, links ou observações diárias.

### Resultado
- Funcionou?
- Nota:

### Aprendizados-chave
-

### Conclusão final
`

function DialogoExperimento({ aberta, aoMudar, exp }: { aberta: boolean; aoMudar: (v: boolean) => void; exp?: Experimento | null }) {
  const criar = useCriar("experiments")
  const atualizar = useAtualizar("experiments")
  const excluir = useExcluir("experiments")
  const [nome, setNome] = React.useState("")
  const [tipo, setTipo] = React.useState("Técnica")
  const [status, setStatus] = React.useState("a_iniciar")
  const [resultado, setResultado] = React.useState("indefinido")
  const [inicio, setInicio] = React.useState("")
  const [fim, setFim] = React.useState("")
  const [hipotese, setHipotese] = React.useState("")
  const [notas, setNotas] = React.useState("")
  React.useEffect(() => {
    if (!aberta) return
    setNome(exp?.name ?? "")
    setTipo(exp?.kind ?? "Técnica")
    setStatus(exp?.status ?? "a_iniciar")
    setResultado(exp?.result ?? "indefinido")
    setInicio(exp?.starts_on ?? "")
    setFim(exp?.ends_on ?? "")
    setHipotese(exp?.hypothesis ?? "")
    setNotas(exp ? (exp.notes ?? "") : MODELO_EXPERIMENTO)
  }, [aberta, exp])
  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return
    const campos = { name: nome.trim(), kind: tipo, status, result: resultado, starts_on: inicio || null, ends_on: fim || null, hypothesis: hipotese.trim() || null, notes: notas.trim() || null }
    if (exp) atualizar.mutate({ id: exp.id, ...campos })
    else criar.mutate({ id: novoId(), ...campos })
    aoMudar(false)
  }
  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      largura="lg"
      titulo={exp ? "Experimento" : "Novo experimento"}
      rodape={
        <>
          {exp ? <Botao variante="fantasma" className="mr-auto text-danger hover:text-danger" onClick={() => { excluir.mutate(exp.id); aoMudar(false) }}>Excluir</Botao> : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-exp" disabled={!nome.trim()}>{exp ? "Salvar" : "Criar"}</Botao>
        </>
      }
    >
      <form id="form-exp" onSubmit={salvar} className="grid gap-4">
        <Campo rotulo="O que você vai testar" htmlFor="x-nome"><Entrada id="x-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo="Tipo" htmlFor="x-tipo">
            <Seletor id="x-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {[...new Set([...TIPOS, tipo])].map((t) => <option key={t}>{t}</option>)}
            </Seletor>
          </Campo>
          <Campo rotulo="Situação" htmlFor="x-status">
            <Seletor id="x-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(STATUS_EXPERIMENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </Seletor>
          </Campo>
          <Campo rotulo="Resultado" htmlFor="x-res">
            <Seletor id="x-res" value={resultado} onChange={(e) => setResultado(e.target.value)}>
              {Object.entries(RESULTADO_EXPERIMENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </Seletor>
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Início" htmlFor="x-ini"><Entrada id="x-ini" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo>
          <Campo rotulo="Fim" htmlFor="x-fim"><Entrada id="x-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></Campo>
        </div>
        <Campo rotulo="Hipótese" htmlFor="x-hip"><AreaTexto id="x-hip" value={hipotese} onChange={(e) => setHipotese(e.target.value)} rows={2} placeholder="Se eu fizer X, espero que Y" /></Campo>
        <Campo rotulo="Roteiro, evidências e aprendizados" htmlFor="x-notas"><AreaTexto id="x-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={12} className="font-mono text-[13px]" /></Campo>
      </form>
    </Janela>
  )
}

export function PaginaLaboratorio() {
  const params = useSearchParams()
  const { data: exps = [], isLoading } = useLista("experiments", { ordem: [{ coluna: "starts_on", asc: false }] })
  const { data: insights = [] } = useLista("insights", { ordem: [{ coluna: "created_at", asc: false }] })
  const criarInsight = useCriar("insights")
  const [aberto, setAberto] = React.useState<Experimento | null>(null)
  const [novo, setNovo] = React.useState(false)
  const [texto, setTexto] = React.useState("")

  React.useEffect(() => {
    const id = params.get("abrir")
    const e = id ? exps.find((x) => x.id === id) : null
    if (e) setAberto(e)
  }, [params, exps])

  const ordem: StatusExperimento[] = ["em_teste", "a_iniciar", "pausado", "concluido", "abandonado"]
  const doLab = insights.filter((i) => i.source === "laboratorio")
  const nomes = new Map(exps.map((e) => [e.id, e.name]))

  return (
    <div>
      <Cabecalho
        area="estudos"
        titulo="Laboratório"
        descricao="Teste técnicas, hábitos e ferramentas por um período e registre o que funcionou."
        acoes={<Botao variante="primario" onClick={() => setNovo(true)}><Plus /> Novo experimento</Botao>}
      />
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-8">
          {isLoading ? <Carregando /> : exps.length === 0 ? <Vazio titulo="Nenhum experimento ainda." /> : null}
          {ordem.map((s) => {
            const lista = exps.filter((e) => e.status === s)
            if (!lista.length) return null
            return (
              <Secao key={s} titulo={STATUS_EXPERIMENTO[s]} acao={<span className="tabular text-sm text-ink-3">{lista.length}</span>}>
                <ul className="grid gap-3">
                  {lista.map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => setAberto(e)} className="w-full rounded-lg border border-line bg-surface p-4 text-left hover:border-line-strong">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-medium">{e.name}</p>
                          <div className="flex gap-1.5">
                            {e.kind ? <Etiqueta>{e.kind}</Etiqueta> : null}
                            {e.result && e.result !== "indefinido" ? <Etiqueta cor={corResultado[e.result]}>{RESULTADO_EXPERIMENTO[e.result as keyof typeof RESULTADO_EXPERIMENTO]}</Etiqueta> : null}
                          </div>
                        </div>
                        {e.starts_on ? (
                          <p className="mt-1 text-xs text-ink-3">
                            {formatar(e.starts_on, "d MMM yyyy")}
                            {e.ends_on ? ` até ${formatar(e.ends_on, "d MMM yyyy")}` : ""}
                          </p>
                        ) : null}
                        {e.hypothesis ? <p className="mt-2 text-sm text-ink-2">{e.hypothesis}</p> : null}
                        {e.notes ? <Markdown texto={e.notes.slice(0, 400)} className="mt-2 text-sm text-ink-2" /> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </Secao>
            )
          })}
        </div>
        <Secao titulo="Insights">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!texto.trim()) return
              criarInsight.mutate({ id: novoId(), text: texto.trim(), source: "laboratorio" })
              setTexto("")
            }}
            className="mb-4"
          >
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Uma descoberta, uma observação…" aria-label="Novo insight do laboratório" className="h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm focus-visible:border-pen focus-visible:outline-none" />
          </form>
          {doLab.length === 0 ? (
            <p className="text-sm text-ink-2">Nenhum insight registrado.</p>
          ) : (
            <ul className="grid gap-4">
              {doLab.map((i) => (
                <li key={i.id} className="flex gap-2.5 text-sm">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-estudos" />
                  <div>
                    <p>{i.text}</p>
                    <p className="mt-0.5 text-xs text-ink-3">{[i.kind, i.potential ? `potencial ${i.potential.toLowerCase()}` : null, i.experiment_id ? nomes.get(i.experiment_id) : null].filter(Boolean).join(", ")}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>
      <DialogoExperimento aberta={novo || Boolean(aberto)} aoMudar={(v) => { if (!v) { setNovo(false); setAberto(null) } }} exp={aberto} />
    </div>
  )
}
