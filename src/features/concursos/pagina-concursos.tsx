"use client"

import Link from "next/link"
import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { FileText, Plus, NotebookText } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Secao, Vazio } from "@/components/ui/basicos"
import { Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { novoId, useAtualizar, useCriar, useExcluir, useLista } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/database.types"
import { cn, formatar, isoDia, porcentagem, somarDias } from "@/lib/utils"
import { useArvorePaginas } from "@/features/paginas/dados"
import { Pomodoro } from "@/components/pomodoro"
import { JanelaNotas } from "@/components/janela-notas"

type Assunto = Tables<"exam_topics">

function nivel(acerto: number, questoes: number) {
  if (!questoes) return { rotulo: "Sem questões", cor: "text-ink-3" }
  if (acerto >= 85) return { rotulo: "Dominado", cor: "text-rotina" }
  if (acerto >= 70) return { rotulo: "Bom", cor: "text-pen" }
  if (acerto >= 50) return { rotulo: "Revisar", cor: "text-estudos" }
  return { rotulo: "Atenção", cor: "text-danger" }
}

function DialogoSessao({ aberta, aoMudar, assuntos, inicial, minutosIniciais }: { aberta: boolean; aoMudar: (v: boolean) => void; assuntos: (Assunto & { disciplina: string })[]; inicial?: string; minutosIniciais?: number }) {
  const qc = useQueryClient()
  const [assunto, setAssunto] = React.useState("")
  const [questoes, setQuestoes] = React.useState("")
  const [acertos, setAcertos] = React.useState("")
  const [minutos, setMinutos] = React.useState("")
  const [salvando, setSalvando] = React.useState(false)
  React.useEffect(() => {
    if (aberta) {
      setAssunto(inicial ?? assuntos[0]?.id ?? "")
      setQuestoes("")
      setAcertos("")
      setMinutos(minutosIniciais ? String(minutosIniciais) : "")
    }
  }, [aberta, inicial, assuntos, minutosIniciais])

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const a = assuntos.find((x) => x.id === assunto)
    if (!a) return
    const q = Number(questoes) || 0
    const c = Math.min(q, Number(acertos) || 0)
    setSalvando(true)
    const sb = supabase()
    await sb.from("study_sessions").insert({ id: novoId(), topic_id: a.id, subject_id: a.subject_id, questions: q, correct: c, minutes: Number(minutos) || 0, day: isoDia() })
    await sb.from("exam_topics").update({ questions: a.questions + q, correct: a.correct + c, last_review: isoDia() }).eq("id", a.id)
    qc.invalidateQueries({ queryKey: ["exam_topics"] })
    qc.invalidateQueries({ queryKey: ["study_sessions"] })
    setSalvando(false)
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo="Registrar estudo"
      descricao="Some as questões que você resolveu. O aproveitamento do assunto é recalculado."
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-sessao" disabled={!assunto || salvando}>Registrar</Botao>
        </>
      }
    >
      <form id="form-sessao" onSubmit={salvar} className="grid gap-4">
        <Campo rotulo="Assunto" htmlFor="s-assunto">
          <Seletor id="s-assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)}>
            {assuntos.map((a) => <option key={a.id} value={a.id}>{a.disciplina}: {a.name}</option>)}
          </Seletor>
        </Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo="Questões" htmlFor="s-q"><Entrada id="s-q" inputMode="numeric" autoFocus value={questoes} onChange={(e) => setQuestoes(e.target.value)} /></Campo>
          <Campo rotulo="Acertos" htmlFor="s-c"><Entrada id="s-c" inputMode="numeric" value={acertos} onChange={(e) => setAcertos(e.target.value)} /></Campo>
          <Campo rotulo="Minutos" htmlFor="s-m"><Entrada id="s-m" inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value)} /></Campo>
        </div>
      </form>
    </Janela>
  )
}

export function PaginaConcursos() {
  const { data: disciplinas = [], isLoading } = useLista("exam_subjects", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  const { data: assuntos = [] } = useLista("exam_topics", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  const { data: sessoes = [] } = useLista("study_sessions", { filtro: (q) => q.gte("day", somarDias(isoDia(), -30)), chave: ["30d"] })
  const { data: paginas = [] } = useArvorePaginas()
  const criarDisc = useCriar("exam_subjects")
  const criarAssunto = useCriar("exam_topics")
  const excluirAssunto = useExcluir("exam_topics")
  const atualizarDisc = useAtualizar("exam_subjects")
  const atualizarAssunto = useAtualizar("exam_topics")
  const [notas, setNotas] = React.useState<{ tipo: "disc" | "assunto"; id: string; titulo: string } | null>(null)
  const [sessao, setSessao] = React.useState<string | null | undefined>(undefined)
  const [minutosFoco, setMinutosFoco] = React.useState<number | undefined>(undefined)
  const [novaDisc, setNovaDisc] = React.useState("")
  const [novoAssunto, setNovoAssunto] = React.useState<Record<string, string>>({})

  const nomesDisc = new Map(disciplinas.map((d) => [d.id, d.name]))
  const comDisc = assuntos.map((a) => ({ ...a, disciplina: nomesDisc.get(a.subject_id ?? "") ?? "Sem disciplina" }))
  const metodologia = paginas.filter((p) => p.section === "concursos" && !p.parent_id)
  const q30 = sessoes.reduce((n, s) => n + s.questions, 0)
  const c30 = sessoes.reduce((n, s) => n + s.correct, 0)
  const totalQ = assuntos.reduce((n, a) => n + a.questions, 0)
  const totalC = assuntos.reduce((n, a) => n + a.correct, 0)

  return (
    <div>
      <Cabecalho
        area="estudos"
        titulo="Concursos"
        descricao="Disciplinas e assuntos do edital, com o aproveitamento nas questões de cada um. Ao fim de um Pomodoro, o app já abre o registro do estudo."
        acoes={assuntos.length ? <Botao variante="primario" onClick={() => setSessao(null)}><Plus /> Registrar estudo</Botao> : null}
      />

      <div className="mb-10 grid gap-6 border-b border-line pb-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
      <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {[
          { r: "Questões resolvidas", v: totalQ.toLocaleString("pt-BR") },
          { r: "Aproveitamento geral", v: totalQ ? `${porcentagem(totalC, totalQ)}%` : "–" },
          { r: "Questões em 30 dias", v: q30.toLocaleString("pt-BR") },
          { r: "Acerto em 30 dias", v: q30 ? `${porcentagem(c30, q30)}%` : "–" },
        ].map((i) => (
          <div key={i.r}>
            <dt className="text-sm text-ink-3">{i.r}</dt>
            <dd className="tabular mt-1 font-display text-3xl font-semibold">{i.v}</dd>
          </div>
        ))}
      </dl>
      <Pomodoro
        aoConcluirFoco={(min) => {
          if (!assuntos.length) return
          setMinutosFoco(min)
          setSessao(null)
        }}
      />
      </div>

      {metodologia.length ? (
        <Secao titulo="Metodologia" className="mb-10">
          <ul className="flex flex-wrap gap-2">
            {metodologia.map((p) => (
              <li key={p.id}>
                <Link href={`/paginas/${p.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-line-strong">
                  <FileText className="size-3.5 text-ink-3" />
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      {isLoading ? (
        <Carregando />
      ) : (
        <div className="grid gap-8">
          {disciplinas.length === 0 ? <Vazio titulo="Nenhuma disciplina cadastrada." descricao="Comece pelas matérias do seu edital." /> : null}
          {disciplinas.map((d) => {
            const lista = comDisc.filter((a) => a.subject_id === d.id && !a.parent_id)
            const q = lista.reduce((n, a) => n + a.questions, 0)
            const c = lista.reduce((n, a) => n + a.correct, 0)
            return (
              <section key={d.id} className="rounded-lg border border-line bg-surface">
                <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
                  <input
                    defaultValue={d.name}
                    aria-label="Nome da disciplina"
                    onBlur={(e) => e.target.value.trim() && e.target.value !== d.name && atualizarDisc.mutate({ id: d.id, name: e.target.value.trim() })}
                    className="min-w-0 flex-1 bg-transparent font-display text-lg font-semibold outline-none"
                  />
                  <span className="tabular text-sm text-ink-2">{q ? `${porcentagem(c, q)}% de acerto em ${q} questões` : "Sem questões ainda"}</span>
                  <button
                    type="button"
                    onClick={() => setNotas({ tipo: "disc", id: d.id, titulo: d.name })}
                    className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-surface-2", d.notes ? "font-medium text-pen" : "text-ink-3")}
                  >
                    <NotebookText className="size-3.5" /> {d.notes ? "Anotações" : "Anotar"}
                  </button>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-ink-3">
                        <th className="px-4 py-2 font-medium">Assunto</th>
                        <th className="w-24 py-2 text-right font-medium">Questões</th>
                        <th className="w-24 py-2 text-right font-medium">Acertos</th>
                        <th className="w-40 px-4 py-2 font-medium">Aproveitamento</th>
                        <th className="w-28 py-2 font-medium">Revisão</th>
                        <th className="w-24" />
                      </tr>
                    </thead>
                    <tbody>
                      {lista.flatMap((pai) => [pai, ...comDisc.filter((x) => x.parent_id === pai.id)]).map((a) => {
                        const pct = porcentagem(a.correct, a.questions)
                        const n = nivel(pct, a.questions)
                        return (
                          <tr key={a.id} className="group border-t border-line">
                            <td className={cn("px-4 py-2", a.parent_id && "pl-9 text-ink-2")}>
                              <button type="button" onClick={() => setNotas({ tipo: "assunto", id: a.id, titulo: a.name })} className="inline-flex items-center gap-1.5 text-left hover:underline" title={a.notes ? "Ver anotações" : "Anotar"}>
                                {a.name}
                                {a.notes ? <NotebookText aria-label="Tem anotações" className="size-3.5 shrink-0 text-pen" /> : null}
                              </button>
                            </td>
                            <td className="tabular py-2 text-right">{a.questions}</td>
                            <td className="tabular py-2 text-right">{a.correct}</td>
                            <td className="px-4 py-2">
                              <span className="flex items-center gap-2">
                                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                                  <span className={cn("block h-full rounded-full", pct >= 70 ? "bg-rotina" : pct >= 50 ? "bg-estudos" : "bg-danger")} style={{ width: `${a.questions ? pct : 0}%` }} />
                                </span>
                                <span className={cn("tabular w-24 text-xs", n.cor)}>{a.questions ? `${pct}% ${n.rotulo.toLowerCase()}` : n.rotulo}</span>
                              </span>
                            </td>
                            <td className="py-2 text-xs text-ink-3">{a.last_review ? formatar(a.last_review, "d MMM") : "–"}</td>
                            <td className="whitespace-nowrap py-2 pr-3 text-right">
                              <button type="button" onClick={() => setSessao(a.id)} className="text-xs font-medium text-pen hover:underline">Registrar</button>
                              <button type="button" onClick={() => excluirAssunto.mutate(a.id)} className="ml-2 text-xs text-ink-3 opacity-0 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100">Excluir</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <form
                  className="border-t border-line px-4 py-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const nome = novoAssunto[d.id]?.trim()
                    if (!nome) return
                    criarAssunto.mutate({ id: novoId(), name: nome, subject_id: d.id, position: lista.length + 1 })
                    setNovoAssunto((s) => ({ ...s, [d.id]: "" }))
                  }}
                >
                  <input value={novoAssunto[d.id] ?? ""} onChange={(e) => setNovoAssunto((s) => ({ ...s, [d.id]: e.target.value }))} placeholder="Adicionar assunto" aria-label={`Adicionar assunto em ${d.name}`} className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-ink-3" />
                </form>
              </section>
            )
          })}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!novaDisc.trim()) return
              criarDisc.mutate({ id: novoId(), name: novaDisc.trim(), position: disciplinas.length + 1 })
              setNovaDisc("")
            }}
            className="flex max-w-md gap-2"
          >
            <Entrada value={novaDisc} onChange={(e) => setNovaDisc(e.target.value)} placeholder="Nova disciplina" aria-label="Nova disciplina" />
            <Botao type="submit" disabled={!novaDisc.trim()}>Adicionar</Botao>
          </form>
        </div>
      )}

      <JanelaNotas
        aberta={Boolean(notas)}
        aoMudar={(v) => !v && setNotas(null)}
        titulo={notas?.titulo ?? ""}
        texto={notas ? (notas.tipo === "disc" ? disciplinas.find((d) => d.id === notas.id)?.notes : assuntos.find((a) => a.id === notas.id)?.notes) : ""}
        aoSalvar={(v) => {
          if (!notas) return
          if (notas.tipo === "disc") atualizarDisc.mutate({ id: notas.id, notes: v || null })
          else atualizarAssunto.mutate({ id: notas.id, notes: v || null })
        }}
      />
      <DialogoSessao aberta={sessao !== undefined} aoMudar={(v) => { if (!v) { setSessao(undefined); setMinutosFoco(undefined) } }} assuntos={comDisc} inicial={sessao ?? undefined} minutosIniciais={minutosFoco} />
    </div>
  )
}
