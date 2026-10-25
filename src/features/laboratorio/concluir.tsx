"use client"

import * as React from "react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { AreaTexto, Campo } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { useAtualizar } from "@/lib/data"
import { cn } from "@/lib/utils"
import { useAcoesDoExperimento } from "./dados"
import { diaIso, escreverConclusao, itensDe, notaDo, protocolo, PROXIMOS, RESULTADOS, resultadoDo, type Experimento, type ProximoPasso, type ResultadoExp } from "./logica"

type Final = Exclude<ResultadoExp, "indefinido">
const OPCOES: { id: Final; rotulo: string; cor: string }[] = [
  { id: "funcionou", rotulo: RESULTADOS.funcionou, cor: "border-[var(--b-luz)] bg-[var(--b-luz)]/14 shadow-[0_0_18px_-6px_var(--b-luz)]" },
  { id: "parcial", rotulo: RESULTADOS.parcial, cor: "border-[var(--b-ambar)] bg-[var(--b-ambar)]/14" },
  { id: "nao_funcionou", rotulo: RESULTADOS.nao_funcionou, cor: "border-[var(--b-rosa)] bg-[var(--b-rosa)]/14" },
]

/**
 * Concluir o experimento: funcionou?, a nota, o que aprendeu, a conclusão e o próximo passo. Tudo vai
 * para o protocolo (as seções Resultado, Aprendizados-chave e Conclusão final do modelo).
 */
export function JanelaConcluir({ experimento: e, aberta, aoMudar, aoNovaRodada }: { experimento: Experimento | null; aberta: boolean; aoMudar: (v: boolean) => void; aoNovaRodada?: (id: string) => void }) {
  const { mutate } = useAtualizar("experiments")
  const acoes = useAcoesDoExperimento()
  const [resultado, setResultado] = React.useState<Final | null>(null)
  const [nota, setNota] = React.useState<number | null>(null)
  const [aprendizados, setAprendizados] = React.useState("")
  const [conclusao, setConclusao] = React.useState("")
  const [proximo, setProximo] = React.useState<ProximoPasso | null>(null)

  React.useEffect(() => {
    if (!aberta || !e) return
    const p = protocolo(e.notes)
    const r = resultadoDo(e)
    setResultado(r === "indefinido" ? null : r)
    setNota(notaDo(p.resultado ?? e.notes))
    setAprendizados(itensDe(p.aprendizados).join("\n"))
    setConclusao(p.conclusao && !/^texto livre\.?$/i.test(p.conclusao) ? p.conclusao : "")
    setProximo(null)
  }, [aberta, e])

  if (!e) return null

  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!resultado) {
      toast.error("Diga se funcionou.")
      return
    }
    const hoje = diaIso()
    const antes = { status: e.status, result: e.result, ends_on: e.ends_on, notes: e.notes }
    const notes = escreverConclusao(e.notes, { resultado, nota, aprendizados: aprendizados.split("\n"), conclusao, proximo })
    // Terminou antes do prazo: o fim passa a ser hoje
    const ends_on = !e.ends_on || e.ends_on > hoje ? hoje : e.ends_on
    mutate({ id: e.id, status: "concluido", result: resultado, ends_on, starts_on: e.starts_on ?? hoje, notes })
    toast.success(resultado === "funcionou" ? "Experimento concluído: funcionou!" : "Experimento concluído. Todo resultado ensina.", {
      action: { label: "Desfazer", onClick: () => mutate({ id: e.id, ...antes }) },
    })
    if (proximo === "ajustar") acoes.novaRodada(e, aoNovaRodada)
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo="Concluir experimento"
      descricao={e.name}
      largura="lg"
      className="tema-lab"
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form="form-concluir" disabled={!resultado}>
            Concluir
          </Botao>
        </>
      }
    >
      <form id="form-concluir" onSubmit={salvar} className="grid gap-5">
        {e.hypothesis ? (
          <p className="rounded-xl border border-[var(--b-borda)] bg-white/[0.03] px-3.5 py-2.5 text-sm text-ink-2">
            <span className="rotulo-hud mb-1 block">Hipótese</span>
            {e.hypothesis}
          </p>
        ) : null}

        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Funcionou?</span>
          <div role="radiogroup" aria-label="Funcionou?" className="grid grid-cols-3 gap-2">
            {OPCOES.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={resultado === o.id}
                onClick={() => setResultado(o.id)}
                className={cn(
                  "min-h-12 rounded-xl border px-2 text-sm font-medium transition-colors",
                  resultado === o.id ? cn("text-ink", o.cor) : "border-[var(--b-borda)] text-ink-2 hover:border-[var(--b-borda-2)] hover:text-ink",
                )}
              >
                {o.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="concluir-nota" className="text-sm font-medium text-ink-2">
              Nota
            </label>
            <span className="tabular text-sm font-semibold">{nota === null ? "—" : `${String(nota).replace(".", ",")} de 10`}</span>
          </div>
          <input id="concluir-nota" type="range" min={0} max={10} step={0.5} value={nota ?? 5} onChange={(ev) => setNota(Number(ev.target.value))} className="h-11 w-full accent-[var(--pen)]" />
        </div>

        <Campo rotulo="O que você aprendeu" htmlFor="concluir-aprendizados" dica="Um aprendizado por linha.">
          <AreaTexto id="concluir-aprendizados" value={aprendizados} onChange={(ev) => setAprendizados(ev.target.value)} rows={3} placeholder="Ex.: Ler antes do celular muda o humor da manhã" />
        </Campo>

        <Campo rotulo="Conclusão" htmlFor="concluir-conclusao">
          <AreaTexto id="concluir-conclusao" value={conclusao} onChange={(ev) => setConclusao(ev.target.value)} rows={2} placeholder="Em poucas palavras: o que fica deste teste?" />
        </Campo>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">E agora?</span>
          <div role="radiogroup" aria-label="Próximo passo" className="flex flex-wrap gap-1.5">
            {(Object.keys(PROXIMOS) as ProximoPasso[]).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={proximo === p}
                onClick={() => setProximo(proximo === p ? null : p)}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm transition-colors toque:min-h-11",
                  proximo === p ? "border-[var(--b-luz)] bg-[var(--b-luz)]/12 text-ink" : "border-[var(--b-borda)] text-ink-2 hover:border-[var(--b-borda-2)] hover:text-ink",
                )}
              >
                {PROXIMOS[p]}
              </button>
            ))}
          </div>
          {proximo === "ajustar" ? <p className="text-xs text-ink-3">Uma nova rodada deste experimento entra nas ideias para testar.</p> : null}
        </div>
      </form>
    </Janela>
  )
}
