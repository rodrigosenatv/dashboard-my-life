"use client"

import Link from "next/link"
import * as React from "react"
import { CalendarPlus, Check, FlaskConical, Flag, NotebookPen, Plus } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { cn, formatar } from "@/lib/utils"
import { useAcoesDoExperimento, useRegistrarDia, type Insight } from "./dados"
import { andamento, diaIso, diarioDo, diasComRegistro, diasDoTeste, plural, type Experimento } from "./logica"
import { AnelDias, FaixaDias, IconeTipo } from "./ui"

/**
 * "Em teste agora": cada experimento numa bancada de vidro, com o dia do teste no anel de luz, a
 * hipótese, a faixa de dias registrados e o registro do dia ali mesmo.
 */
export function EmTesteAgora({
  experimentos,
  insights,
  aoConcluir,
  aoNovo,
  ideias,
  aoComecarIdeia,
}: {
  experimentos: Experimento[]
  insights: Insight[]
  aoConcluir: (e: Experimento) => void
  aoNovo: () => void
  ideias: Experimento[]
  aoComecarIdeia: (e: Experimento) => void
}) {
  if (!experimentos.length) return <BancadaVazia aoNovo={aoNovo} ideias={ideias} aoComecarIdeia={aoComecarIdeia} />
  return (
    <section aria-label="Em teste agora" className="grid gap-4">
      {experimentos.map((e) => (
        <Bancada key={e.id} experimento={e} diario={diarioDo(insights, e.id)} aoConcluir={() => aoConcluir(e)} />
      ))}
    </section>
  )
}

function Bancada({ experimento: e, diario, aoConcluir }: { experimento: Experimento; diario: Insight[]; aoConcluir: () => void }) {
  const hoje = diaIso()
  const a = andamento(e, hoje)
  const registrados = diasComRegistro(diario)
  const dias = diasDoTeste(e, hoje)
  const deHoje = diario.filter((i) => (i.noted_on ?? i.created_at.slice(0, 10)) === hoje)
  const ultimo = diario.find((i) => (i.noted_on ?? i.created_at.slice(0, 10)) !== hoje) ?? null
  const acoes = useAcoesDoExperimento()

  return (
    <article className="vidro relative overflow-hidden p-4 sm:p-6 lg:p-7">
      <span aria-hidden className="pointer-events-none absolute -left-20 -top-24 size-72 rounded-full bg-[var(--b-luz)]/12 blur-3xl" />
      <div className="relative grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-7">
        <div className="flex items-center gap-4 sm:block">
          <AnelDias dia={a.dia} total={a.total} bolhas />
          <div className="min-w-0 sm:hidden">
            <Cabecalho e={e} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="hidden sm:block">
            <Cabecalho e={e} />
          </div>
          {e.hypothesis ? (
            <p className="mt-3 border-l-2 border-[var(--b-luz)]/60 pl-3 text-[15px] italic leading-relaxed text-ink-2">{e.hypothesis}</p>
          ) : null}

          {a.passou ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--b-ambar)]/40 bg-[var(--b-ambar)]/10 px-3.5 py-3">
              <Flag className="size-4 shrink-0 text-[var(--b-ambar)]" aria-hidden />
              <p className="min-w-0 flex-1 text-sm">O prazo terminou {e.ends_on ? formatar(e.ends_on, "'em' d 'de' MMM") : ""}. Hora de ver se funcionou.</p>
              <Botao variante="fantasma" tamanho="sm" onClick={() => acoes.estender(e)}>
                <CalendarPlus /> Mais 7 dias
              </Botao>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-3">
              {a.total ? (a.restam === 0 ? "Último dia do teste." : `Faltam ${plural(a.restam ?? 0, "dia")} · termina ${formatar(e.ends_on!, "EEE, d 'de' MMM")}`) : "Sem prazo para terminar."}
            </p>
          )}

          <FaixaDias className="mt-4" dias={dias} registrados={registrados} hoje={hoje} />

          <RegistroDoDia experimento={e} deHoje={deHoje} ultimo={ultimo} />

          <div className="mt-4 flex flex-wrap gap-2">
            <Botao variante={a.passou ? "primario" : "contorno"} onClick={aoConcluir} className={cn(!a.passou && "bg-transparent")}>
              <Check /> Concluir
            </Botao>
            <Botao asChild variante="fantasma">
              <Link href={`/estudos/laboratorio/${e.id}`}>
                <NotebookPen /> Diário e protocolo
              </Link>
            </Botao>
          </div>
        </div>
      </div>
    </article>
  )
}

function Cabecalho({ e }: { e: Experimento }) {
  return (
    <>
      <p className="rotulo-hud flex items-center gap-2">
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--b-luz)] opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-[var(--b-luz)]" />
        </span>
        <span className="truncate">Em teste{e.kind ? ` · ${e.kind}` : ""}</span>
      </p>
      <h2 className="mt-1.5 font-display text-[1.35rem] font-semibold leading-[1.12] tracking-tight text-balance sm:text-[1.9rem]">
        <Link href={`/estudos/laboratorio/${e.id}`} className="hover:underline hover:decoration-[var(--b-luz)]/60 hover:underline-offset-4">
          {e.name}
        </Link>
      </h2>
    </>
  )
}

/** O registro do dia, ali mesmo: o que aconteceu hoje no teste. */
export function RegistroDoDia({ experimento, deHoje, ultimo }: { experimento: Experimento; deHoje: Insight[]; ultimo?: Insight | null }) {
  const registrar = useRegistrarDia()
  const [texto, setTexto] = React.useState("")
  const [aberto, setAberto] = React.useState(false)
  const enviar = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (registrar(experimento, texto)) {
      setTexto("")
      setAberto(false)
    }
  }
  const mostrarCampo = !deHoje.length || aberto
  return (
    <div className="mt-4 rounded-xl border border-[var(--b-borda)] bg-white/[0.03] p-3.5">
      {deHoje.length ? (
        <div>
          <p className="rotulo-hud flex items-center gap-1.5 text-[var(--b-luz)]">
            <Check className="size-3.5" aria-hidden /> Hoje registrado
          </p>
          <ul className="mt-1.5 grid gap-1">
            {deHoje.map((i) => (
              <li key={i.id} className="text-sm leading-snug">
                {i.text}
              </li>
            ))}
          </ul>
          {!aberto ? (
            <button type="button" onClick={() => setAberto(true)} className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-full px-1 text-xs font-medium text-[var(--b-luz)] hover:underline">
              <Plus className="size-3.5" aria-hidden /> Mais uma observação
            </button>
          ) : null}
        </div>
      ) : ultimo ? (
        <p className="text-xs text-ink-3">
          Último registro ({formatar(ultimo.noted_on ?? ultimo.created_at, "EEE, d/MM")}): <span className="text-ink-2">{ultimo.text}</span>
        </p>
      ) : null}
      {mostrarCampo ? (
        <form onSubmit={enviar} className={cn("flex items-end gap-2", (deHoje.length || ultimo) && "mt-2.5")}>
          <label className="min-w-0 flex-1">
            <span className="sr-only">Como foi hoje no teste</span>
            <textarea
              value={texto}
              onChange={(ev) => setTexto(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) enviar(ev)
              }}
              rows={1}
              placeholder="Como foi hoje? O que você observou?"
              className="block max-h-40 min-h-11 w-full resize-none rounded-xl border border-[var(--b-borda)] bg-black/20 px-3 py-2.5 text-[16px] leading-snug text-ink [field-sizing:content] placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none sm:text-sm"
            />
          </label>
          <Botao type="submit" variante="primario" disabled={!texto.trim()} className="h-11 shadow-[0_0_20px_-6px_var(--b-luz)]">
            Registrar
          </Botao>
        </form>
      ) : null}
    </div>
  )
}

function BancadaVazia({ aoNovo, ideias, aoComecarIdeia }: { aoNovo: () => void; ideias: Experimento[]; aoComecarIdeia: (e: Experimento) => void }) {
  return (
    <section aria-label="Em teste agora" className="vidro relative overflow-hidden px-5 py-10 text-center sm:px-8 sm:py-12">
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-0 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--b-luz)]/20 blur-3xl" />
      <FlaskConical className="relative mx-auto size-9 text-[var(--b-luz)]" aria-hidden />
      <h2 className="relative mt-3 font-display text-2xl font-semibold">A bancada está livre</h2>
      <p className="relative mx-auto mt-1.5 max-w-md text-ink-2">Escolha uma ideia e teste por alguns dias: anote o que acontece a cada dia e, no fim, veja se funcionou.</p>
      <div className="relative mt-5 flex flex-wrap justify-center gap-2">
        <Botao variante="primario" tamanho="lg" onClick={aoNovo} className="shadow-[0_0_24px_-6px_var(--b-luz)]">
          <Plus /> Novo experimento
        </Botao>
      </div>
      {ideias.length ? (
        <div className="relative mx-auto mt-6 max-w-lg text-left">
          <p className="rotulo-hud mb-2">Ou comece uma das suas ideias</p>
          <ul className="grid gap-2">
            {ideias.slice(0, 3).map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-xl border border-[var(--b-borda)] bg-white/[0.03] px-3.5 py-2.5">
                <IconeTipo tipo={e.kind} className="size-4 shrink-0 text-[var(--b-luz)]" />
                <span className="min-w-0 flex-1 truncate text-sm">{e.name}</span>
                <Botao variante="fantasma" tamanho="sm" onClick={() => aoComecarIdeia(e)}>
                  Começar
                </Botao>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
