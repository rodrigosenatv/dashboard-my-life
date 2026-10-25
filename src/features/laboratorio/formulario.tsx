"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import * as React from "react"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { AreaTexto, Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { EscolhaPilulas } from "@/components/ui/pilulas"
import { novoId, useAtualizar, useCriar } from "@/lib/data"
import { diaIso, DURACOES, protocoloInicial, RESULTADOS, somarDias, STATUS_EXP, SUGESTOES, TIPOS, type Experimento, type ResultadoExp, type StatusExp } from "./logica"
import { iconeDoTipo, IconeTipo } from "./ui"

type Quando = "hoje" | "amanha" | "depois"
const QUANDO: { id: Quando; rotulo: string }[] = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "amanha", rotulo: "Amanhã" },
  { id: "depois", rotulo: "Mais tarde" },
]

/**
 * Um experimento novo, em poucos passos: o que testar, o tipo, a hipótese, quando começa e por quantos
 * dias. Editando, também a situação, o resultado e as datas.
 */
export function JanelaExperimento({
  aberta,
  aoMudar,
  experimento,
  nomeInicial = "",
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  experimento?: Experimento | null
  /** Para o "Tenho uma ideia…" da tela: a janela já abre com o nome. */
  nomeInicial?: string
}) {
  const router = useRouter()
  const qc = useQueryClient()
  const criar = useCriar("experiments")
  const atualizar = useAtualizar("experiments")
  const editando = Boolean(experimento)
  const [nome, setNome] = React.useState("")
  const [tipo, setTipo] = React.useState("Hábito")
  const [hipotese, setHipotese] = React.useState("")
  const [quando, setQuando] = React.useState<Quando>("hoje")
  const [dias, setDias] = React.useState<number | null>(7)
  const [procedimento, setProcedimento] = React.useState("")
  const [status, setStatus] = React.useState<StatusExp>("a_iniciar")
  const [resultado, setResultado] = React.useState<ResultadoExp>("indefinido")
  const [inicio, setInicio] = React.useState("")
  const [fim, setFim] = React.useState("")

  React.useEffect(() => {
    if (!aberta) return
    setNome(experimento?.name ?? nomeInicial)
    setTipo(experimento?.kind ?? "Hábito")
    setHipotese(experimento?.hypothesis ?? "")
    setQuando("hoje")
    setDias(7)
    setProcedimento("")
    setStatus((experimento?.status as StatusExp) ?? "a_iniciar")
    setResultado((experimento?.result as ResultadoExp) ?? "indefinido")
    setInicio(experimento?.starts_on ?? "")
    setFim(experimento?.ends_on ?? "")
  }, [aberta, experimento, nomeInicial])

  const usarSugestao = (s: (typeof SUGESTOES)[number]) => {
    setNome(s.nome)
    setTipo(s.tipo)
    setHipotese(s.hipotese)
    setDias(s.dias)
  }

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    const n = nome.replace(/\s+/g, " ").trim()
    if (!n) return
    if (experimento) {
      if (inicio && fim && fim < inicio) {
        toast.error("O fim vem antes do início.")
        return
      }
      atualizar.mutate({ id: experimento.id, name: n, kind: tipo, hypothesis: hipotese.trim() || null, status, result: resultado, starts_on: inicio || null, ends_on: fim || null })
      aoMudar(false)
      return
    }
    const hoje = diaIso()
    const comeco = quando === "hoje" ? hoje : quando === "amanha" ? somarDias(hoje, 1) : null
    const id = novoId()
    criar.mutate(
      {
        id,
        name: n,
        kind: tipo,
        status: quando === "hoje" ? "em_teste" : "a_iniciar",
        result: "indefinido",
        hypothesis: hipotese.trim() || null,
        starts_on: comeco,
        ends_on: comeco && dias ? somarDias(comeco, dias - 1) : null,
        notes: protocoloInicial({ procedimento }),
      },
      {
        onSuccess: (novo) => {
          qc.setQueryData(["experiments", "um", id], novo)
          if (quando === "hoje") router.push(`/estudos/laboratorio/${id}`)
        },
      },
    )
    toast.success(quando === "hoje" ? "Experimento em teste. Registre cada dia no diário." : quando === "amanha" ? "Experimento marcado para amanhã." : "Ideia guardada para testar depois.")
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={editando ? "Dados do experimento" : "Novo experimento"}
      descricao={editando ? undefined : "Teste uma ideia por alguns dias e veja o que acontece."}
      largura="lg"
      className="tema-lab"
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form="form-experimento" disabled={!nome.trim()}>
            {editando ? "Salvar" : quando === "hoje" ? "Começar hoje" : "Guardar"}
          </Botao>
        </>
      }
    >
      <form id="form-experimento" onSubmit={salvar} className="grid gap-5">
        <Campo rotulo="O que você vai testar?" htmlFor="exp-nome">
          <Entrada id="exp-nome" autoFocus={!editando} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ler 20 minutos ao acordar" autoComplete="off" />
        </Campo>

        {!editando && !nome.trim() ? (
          <div className="grid gap-2">
            <p className="flex items-center gap-1.5 text-xs text-ink-3">
              <Sparkles className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Sem ideia? Teste uma destas:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGESTOES.map((s) => (
                <button
                  key={s.nome}
                  type="button"
                  onClick={() => usarSugestao(s)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--b-borda)] bg-white/[0.03] px-3 py-1 text-sm text-ink-2 hover:border-[var(--b-borda-2)] hover:text-ink toque:min-h-11"
                >
                  <IconeTipo tipo={s.tipo} className="size-3.5 text-[var(--b-luz)]" />
                  {s.nome}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Tipo</span>
          <EscolhaPilulas
            rotulo="Tipo de experimento"
            opcoes={[...new Set([...TIPOS, tipo])].map((t) => ({ id: t, rotulo: t }))}
            valor={tipo}
            aoMudar={setTipo}
            icones={Object.fromEntries(TIPOS.map((t) => [t, iconeDoTipo(t)]))}
          />
        </div>

        <Campo rotulo="Hipótese" htmlFor="exp-hipotese" dica="O que você espera que aconteça. No fim, você confere se aconteceu.">
          <AreaTexto id="exp-hipotese" value={hipotese} onChange={(e) => setHipotese(e.target.value)} rows={2} placeholder="Se eu fizer X, espero que Y." />
        </Campo>

        {editando ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Situação" htmlFor="exp-status">
                <Seletor id="exp-status" value={status} onChange={(e) => setStatus(e.target.value as StatusExp)}>
                  {Object.entries(STATUS_EXP).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </Seletor>
              </Campo>
              <Campo rotulo="Resultado" htmlFor="exp-resultado">
                <Seletor id="exp-resultado" value={resultado} onChange={(e) => setResultado(e.target.value as ResultadoExp)}>
                  {Object.entries(RESULTADOS).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </Seletor>
              </Campo>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Campo rotulo="Início" htmlFor="exp-inicio">
                <Entrada id="exp-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </Campo>
              <Campo rotulo="Fim" htmlFor="exp-fim">
                <Entrada id="exp-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
              </Campo>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <span className="text-sm font-medium text-ink-2">Quando começa</span>
                <EscolhaPilulas rotulo="Quando começa" opcoes={QUANDO} valor={quando} aoMudar={setQuando} />
              </div>
              {quando !== "depois" ? (
                <div className="grid gap-1.5">
                  <span className="text-sm font-medium text-ink-2">Por quantos dias</span>
                  <EscolhaPilulas
                    rotulo="Duração do teste"
                    opcoes={[...DURACOES.map((d) => ({ id: String(d), rotulo: `${d}` })), { id: "0", rotulo: "Sem prazo" }]}
                    valor={String(dias ?? 0)}
                    aoMudar={(v) => setDias(Number(v) || null)}
                  />
                </div>
              ) : null}
            </div>
            <Campo rotulo="Como você vai fazer (opcional)" htmlFor="exp-procedimento" dica="Os passos do teste. Ficam no protocolo do experimento.">
              <AreaTexto id="exp-procedimento" value={procedimento} onChange={(e) => setProcedimento(e.target.value)} rows={3} placeholder={"1. Deixar o livro na mesa de cabeceira\n2. Ler antes de pegar o celular"} />
            </Campo>
          </>
        )}
      </form>
    </Janela>
  )
}
