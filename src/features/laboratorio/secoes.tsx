"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import * as React from "react"
import { Atom, Lightbulb, Pause, Play, Plus, Sparkles, Telescope, X } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Janela } from "@/components/ui/janela"
import { novoId, useCriar, useExcluir } from "@/lib/data"
import { cn, formatar } from "@/lib/utils"
import { OBSERVACAO, useAcoesDoExperimento, type Insight } from "./dados"
import { diaIso, duracaoDe, DURACOES, itensDe, notaDo, plural, protocolo, resultadoDo, somarDias, type Experimento } from "./logica"
import { IconeTipo, SeloResultado } from "./ui"

/* ------------------------------------------------------------------ */
/* Começar (com a duração)                                             */
/* ------------------------------------------------------------------ */

/** Começar um experimento hoje: por quantos dias? */
export function JanelaComecar({ experimento: e, aoMudar }: { experimento: Experimento | null; aoMudar: (v: boolean) => void }) {
  const acoes = useAcoesDoExperimento()
  const [dias, setDias] = React.useState<number | null>(7)
  React.useEffect(() => {
    if (e) setDias(duracaoDe(e) ?? 7)
  }, [e])
  if (!e) return null
  return (
    <Janela
      aberta={Boolean(e)}
      aoMudar={aoMudar}
      titulo="Começar hoje"
      descricao={e.name}
      largura="sm"
      className="tema-lab"
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao
            variante="primario"
            onClick={() => {
              acoes.comecar(e, dias ?? 0)
              aoMudar(false)
            }}
          >
            <Play /> Começar
          </Botao>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink-2">Por quantos dias você vai testar?</p>
      <div role="radiogroup" aria-label="Duração do teste" className="grid grid-cols-3 gap-2">
        {[...DURACOES, 0].map((d) => {
          const ativo = (dias ?? 0) === d
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => setDias(d || null)}
              className={cn(
                "min-h-12 rounded-xl border text-sm font-medium transition-colors",
                ativo ? "border-[var(--b-luz)] bg-[var(--b-luz)]/12 text-ink" : "border-[var(--b-borda)] text-ink-2 hover:border-[var(--b-borda-2)] hover:text-ink",
              )}
            >
              {d ? `${d} dias` : "Sem prazo"}
            </button>
          )
        })}
      </div>
      {dias ? <p className="mt-3 text-xs text-ink-3">Termina {formatar(somarDias(diaIso(), dias - 1), "EEEE, d 'de' MMMM")}.</p> : null}
    </Janela>
  )
}

/* ------------------------------------------------------------------ */
/* Ideias para testar                                                  */
/* ------------------------------------------------------------------ */

/** As ideias para testar (e os agendados), com a anotação rápida de uma ideia nova. */
export function IdeiasParaTestar({ ideias, aoComecar }: { ideias: Experimento[]; aoComecar: (e: Experimento) => void }) {
  const criar = useCriar("experiments")
  const [texto, setTexto] = React.useState("")
  const hoje = diaIso()
  const guardar = (ev: React.FormEvent) => {
    ev.preventDefault()
    const nome = texto.replace(/\s+/g, " ").trim()
    if (!nome) return
    criar.mutate({ id: novoId(), name: nome, kind: "Ideia", status: "a_iniciar", result: "indefinido" })
    toast.success("Ideia guardada para testar.")
    setTexto("")
  }
  return (
    <section aria-labelledby="titulo-ideias" className="vidro p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="titulo-ideias" className="rotulo-hud flex items-center gap-2">
          <Lightbulb className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Ideias para testar
        </h2>
        {ideias.length ? <span className="tabular text-xs text-ink-3">{ideias.length}</span> : null}
      </div>
      <form onSubmit={guardar} className="mt-3 flex gap-2">
        <input
          value={texto}
          onChange={(ev) => setTexto(ev.target.value)}
          placeholder="Tenho uma ideia para testar…"
          aria-label="Nova ideia para testar"
          className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--b-borda)] bg-surface px-3 text-[16px] text-ink placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none sm:text-sm"
        />
        <button type="submit" aria-label="Guardar ideia" disabled={!texto.trim()} className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--b-borda-2)] text-[var(--b-luz)] hover:bg-ink/[0.06] disabled:opacity-40">
          <Plus className="size-4" />
        </button>
      </form>
      {ideias.length ? (
        <ul className="mt-3 grid gap-1">
          {ideias.map((e) => {
            const agendado = e.starts_on && e.starts_on >= hoje
            return (
              <li key={e.id} className="flex items-center gap-3 rounded-xl px-1.5 py-2 hover:bg-ink/[0.03]">
                <IconeTipo tipo={e.kind} className="size-4 shrink-0 text-[var(--b-luz)]" />
                <Link href={`/estudos/laboratorio/${e.id}`} className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-medium leading-snug hover:text-[var(--b-luz)]">{e.name}</span>
                  {agendado ? (
                    <span className="block text-xs text-[var(--b-luz)]">{e.starts_on === hoje ? "Começa hoje" : e.starts_on === somarDias(hoje, 1) ? "Começa amanhã" : `Começa ${formatar(e.starts_on, "d 'de' MMM")}`}</span>
                  ) : e.hypothesis ? (
                    <span className="block truncate text-xs text-ink-3">{e.hypothesis}</span>
                  ) : null}
                </Link>
                <Botao variante="fantasma" tamanho="sm" onClick={() => aoComecar(e)} className="shrink-0">
                  <Play /> Começar
                </Botao>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-3">Guarde aqui o que você quer testar um dia: uma técnica, um hábito, uma ferramenta.</p>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Pausados e resultados                                               */
/* ------------------------------------------------------------------ */

export function Pausados({ lista }: { lista: Experimento[] }) {
  const acoes = useAcoesDoExperimento()
  if (!lista.length) return null
  return (
    <section aria-labelledby="titulo-pausados">
      <h2 id="titulo-pausados" className="mb-3 flex items-baseline gap-2 font-display text-xl font-semibold">
        Pausados <span className="tabular text-sm font-normal text-ink-3">{lista.length}</span>
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {lista.map((e) => (
          <li key={e.id} className="vidro flex items-center gap-3 px-3.5 py-3">
            <Pause className="size-4 shrink-0 text-ink-3" aria-hidden />
            <Link href={`/estudos/laboratorio/${e.id}`} className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm font-medium leading-snug hover:text-[var(--b-luz)]">{e.name}</span>
              <span className="block truncate text-xs text-ink-3">{e.kind ?? "Experimento"}</span>
            </Link>
            <Botao variante="fantasma" tamanho="sm" onClick={() => acoes.mudar(e, "em_teste")}>
              <Play /> Retomar
            </Botao>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Os experimentos concluídos (e os deixados de lado), como fichas de resultado. */
export function Resultados({ concluidos, abandonados }: { concluidos: Experimento[]; abandonados: Experimento[] }) {
  const [verAbandonados, setVerAbandonados] = React.useState(false)
  if (!concluidos.length && !abandonados.length) return null
  return (
    <section aria-labelledby="titulo-resultados">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="rotulo-hud flex items-center gap-2">
            <Telescope className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Resultados
          </p>
          <h2 id="titulo-resultados" className="mt-1 font-display text-xl font-semibold">
            O que você já testou
          </h2>
        </div>
        {abandonados.length ? (
          <button type="button" onClick={() => setVerAbandonados((v) => !v)} className="min-h-10 rounded-full px-3 text-sm font-medium text-[var(--b-luz)] hover:bg-ink/[0.06]">
            {verAbandonados ? "Esconder os deixados de lado" : `Deixados de lado (${abandonados.length})`}
          </button>
        ) : null}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[...concluidos, ...(verAbandonados ? abandonados : [])].map((e) => (
          <li key={e.id}>
            <FichaResultado experimento={e} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function FichaResultado({ experimento: e }: { experimento: Experimento }) {
  const p = protocolo(e.notes)
  const nota = notaDo(p.resultado ?? e.notes)
  const aprendizado = itensDe(p.aprendizados)[0]
  const dias = duracaoDe(e)
  const abandonado = e.status === "abandonado"
  return (
    <Link href={`/estudos/laboratorio/${e.id}`} className="vidro block h-full p-4 transition-colors hover:border-[var(--b-borda-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--b-luz)]/50">
      <div className="flex items-start justify-between gap-3">
        <IconeTipo tipo={e.kind} className="mt-0.5 size-4 shrink-0 text-[var(--b-luz)]" />
        <span className="flex shrink-0 items-center gap-2">
          {nota !== null ? <span className="tabular text-sm font-semibold text-[var(--b-ambar)]">{String(nota).replace(".", ",")}</span> : null}
          {abandonado ? <span className="rounded-full border border-[var(--b-borda-2)] px-2.5 py-0.5 text-xs text-ink-3">Deixado de lado</span> : <SeloResultado resultado={resultadoDo(e)} />}
        </span>
      </div>
      <p className="mt-2 font-medium leading-snug">{e.name}</p>
      {aprendizado ? <p className="mt-2 line-clamp-3 text-sm text-ink-2">“{aprendizado}”</p> : e.hypothesis ? <p className="mt-2 line-clamp-2 text-sm text-ink-3">{e.hypothesis}</p> : null}
      <p className="mt-3 text-xs text-ink-3">
        {[dias ? plural(dias, "dia") : null, e.ends_on ? `terminou ${formatar(e.ends_on, "d 'de' MMM 'de' yyyy")}` : null].filter(Boolean).join(" · ")}
      </p>
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* Descobertas                                                         */
/* ------------------------------------------------------------------ */

const TIPOS_DESCOBERTA = [
  { id: "descoberta", rotulo: "Descoberta", icone: Sparkles },
  { id: "reflexão", rotulo: "Reflexão", icone: Atom },
  { id: "ideia solta", rotulo: "Ideia solta", icone: Lightbulb },
] as const

/** As descobertas, reflexões e ideias soltas do Laboratório (o diário de cada teste fica no experimento). */
export function Descobertas({ insights, experimentos }: { insights: Insight[]; experimentos: Experimento[] }) {
  const criar = useCriar("insights")
  const excluir = useExcluir("insights")
  const [texto, setTexto] = React.useState("")
  const [tipo, setTipo] = React.useState<(typeof TIPOS_DESCOBERTA)[number]["id"]>("descoberta")
  const nomes = React.useMemo(() => new Map(experimentos.map((e) => [e.id, e.name])), [experimentos])
  const lista = insights.filter((i) => i.kind !== OBSERVACAO)

  const guardar = (ev: React.FormEvent) => {
    ev.preventDefault()
    const t = texto.trim()
    if (!t) return
    criar.mutate({ id: novoId(), text: t, source: "laboratorio", kind: tipo, noted_on: diaIso() })
    setTexto("")
  }

  return (
    <section aria-labelledby="titulo-descobertas" className="vidro p-4 sm:p-5">
      <h2 id="titulo-descobertas" className="rotulo-hud flex items-center gap-2">
        <Sparkles className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Descobertas
      </h2>
      <form onSubmit={guardar} className="mt-3 grid gap-2">
        <textarea
          value={texto}
          onChange={(ev) => setTexto(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) guardar(ev)
          }}
          rows={2}
          placeholder="Uma descoberta, uma reflexão, uma ideia solta…"
          aria-label="Nova descoberta"
          className="w-full resize-none rounded-xl border border-[var(--b-borda)] bg-surface px-3 py-2.5 text-[16px] leading-snug text-ink placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none sm:text-sm"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {TIPOS_DESCOBERTA.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tipo === t.id}
              onClick={() => setTipo(t.id)}
              className={cn(
                "inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors toque:min-h-11",
                tipo === t.id ? "border-[var(--b-luz)] bg-[var(--b-luz)]/12 text-ink" : "border-[var(--b-borda)] text-ink-2 hover:text-ink",
              )}
            >
              <t.icone className="size-3.5" aria-hidden /> {t.rotulo}
            </button>
          ))}
          <Botao type="submit" variante="primario" tamanho="sm" disabled={!texto.trim()} className="ml-auto">
            Guardar
          </Botao>
        </div>
      </form>
      {lista.length ? (
        <ul className="mt-4 grid gap-3">
          {lista.map((i) => {
            const T = TIPOS_DESCOBERTA.find((t) => t.id === i.kind)
            const Icone = T?.icone ?? Sparkles
            return (
              <li key={i.id} className="group flex gap-2.5 text-sm">
                <Icone className="mt-0.5 size-4 shrink-0 text-[var(--b-luz)]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="leading-snug">{i.text}</p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {[T?.rotulo ?? i.kind, i.potential ? `potencial ${i.potential.toLowerCase()}` : null, i.noted_on ? formatar(i.noted_on, "d 'de' MMM") : null].filter(Boolean).join(" · ")}
                    {i.experiment_id && nomes.get(i.experiment_id) ? (
                      <>
                        {" · "}
                        <Link href={`/estudos/laboratorio/${i.experiment_id}`} className="hover:text-[var(--b-luz)]">
                          {nomes.get(i.experiment_id)}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Apagar: ${i.text}`}
                  onClick={() => {
                    excluir.mutate(i.id)
                    toast("Descoberta apagada.", { action: { label: "Desfazer", onClick: () => criar.mutate({ ...i }) } })
                  }}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-ink/[0.06] hover:text-ink pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
                >
                  <X className="size-4" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-3">O que os testes ensinam além do resultado. Guarde aqui.</p>
      )}
    </section>
  )
}
