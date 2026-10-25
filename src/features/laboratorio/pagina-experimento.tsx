"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import { ArrowLeft, Ban, BookText, CalendarPlus, Check, Ellipsis, FlaskConical, Lightbulb, NotebookPen, Pause, Pencil, Play, Repeat, Trash, X } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Esqueleto } from "@/components/ui/basicos"
import { Confirmar } from "@/components/ui/janela"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { EditorMarkdown } from "@/components/markdown"
import { useAtualizar, useCriar, useExcluir } from "@/lib/data"
import { cn, formatar } from "@/lib/utils"
import { JanelaConcluir } from "./concluir"
import { OBSERVACAO, useAcoesDoExperimento, useExperimento, useInsightsDoLab, useRegistrarDia, type Insight } from "./dados"
import { andamento, diaIso, diarioDo, diasComRegistro, diasDoTeste, diasEntre, duracaoDe, itensDe, notaDo, plural, protocolo, resultadoDo, STATUS_EXP, statusDo, type Experimento } from "./logica"
import { JanelaExperimento } from "./formulario"
import { JanelaComecar } from "./secoes"
import { AnelDias, FaixaDias, IconeTipo, SeloResultado } from "./ui"

const MOLDURA = "tema-lab laboratorio -mx-4 -mb-28 -mt-5 min-h-[calc(100dvh-7rem)] px-4 pb-32 pt-5 sm:mx-0 sm:mb-0 sm:mt-0 sm:min-h-0 sm:rounded-[1.75rem] sm:px-6 sm:pb-10 sm:pt-6 lg:px-8"

/** A tela de um experimento: o dia no anel, a hipótese, o diário dos dias, o protocolo e o resultado. */
export function PaginaExperimento() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: e, isLoading } = useExperimento(id)
  const { data: insights = [] } = useInsightsDoLab()
  const excluir = useExcluir("experiments", { invalidar: ["insights"] })
  const acoes = useAcoesDoExperimento()
  const [editar, setEditar] = React.useState(false)
  const [concluir, setConcluir] = React.useState(false)
  const [comecar, setComecar] = React.useState(false)
  const [apagar, setApagar] = React.useState(false)

  if (isLoading)
    return (
      <div className={MOLDURA} aria-busy="true" aria-label="Carregando o experimento">
        <div className="flex gap-6 pt-12">
          <Esqueleto className="size-36 shrink-0 rounded-full bg-white/[0.06]" />
          <div className="grid flex-1 content-start gap-3">
            <Esqueleto className="h-4 w-40 bg-white/[0.06]" />
            <Esqueleto className="h-10 w-3/4 bg-white/[0.06]" />
            <Esqueleto className="h-16 w-full bg-white/[0.06]" />
          </div>
        </div>
      </div>
    )
  if (!e)
    return (
      <div className={MOLDURA}>
        <div className="vidro mx-auto mt-10 max-w-md px-6 py-10 text-center">
          <p className="font-display text-xl font-semibold">Experimento não encontrado</p>
          <p className="mt-1 text-ink-2">Ele pode ter sido excluído.</p>
          <Botao asChild variante="primario" className="mt-5">
            <Link href="/estudos/laboratorio">Voltar para o laboratório</Link>
          </Botao>
        </div>
      </div>
    )

  const s = statusDo(e)
  const diario = diarioDo(insights, e.id)

  return (
    <div className={MOLDURA}>
      <nav className="flex items-center justify-between gap-2">
        <Link href="/estudos/laboratorio" className="-ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Laboratório
        </Link>
        <div className="flex items-center gap-1">
          <Botao variante="fantasma" tamanho="icone" aria-label="Editar dados do experimento" onClick={() => setEditar(true)}>
            <Pencil />
          </Botao>
          <Menu>
            <MenuGatilho asChild>
              <Botao variante="fantasma" tamanho="icone" aria-label="Mais opções do experimento">
                <Ellipsis />
              </Botao>
            </MenuGatilho>
            <MenuConteudo className="tema-lab w-60">
              <MenuItem onSelect={() => setEditar(true)}>
                <Pencil /> Editar dados
              </MenuItem>
              <MenuItem onSelect={() => acoes.novaRodada(e, (novo) => router.push(`/estudos/laboratorio/${novo}`))}>
                <Repeat /> Testar de novo (nova rodada)
              </MenuItem>
              {s === "em_teste" || s === "pausado" ? (
                <MenuItem onSelect={() => acoes.mudar(e, "abandonado")}>
                  <Ban /> Deixar de lado
                </MenuItem>
              ) : null}
              {s === "abandonado" ? (
                <MenuItem onSelect={() => acoes.mudar(e, "a_iniciar")}>
                  <Lightbulb /> Voltar para as ideias
                </MenuItem>
              ) : null}
              <MenuSeparador />
              <MenuItem perigo onSelect={() => setApagar(true)}>
                <Trash /> Excluir experimento
              </MenuItem>
            </MenuConteudo>
          </Menu>
        </div>
      </nav>

      <Cabeca e={e} registros={diario} aoConcluir={() => setConcluir(true)} aoComecar={() => setComecar(true)} />

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="grid min-w-0 gap-10">
          <Diario e={e} registros={diario} />
          <Protocolo e={e} />
        </div>
        {/* No celular o resultado vem primeiro e a ficha por último; no computador os dois ficam ao lado */}
        <div className="contents lg:sticky lg:top-6 lg:grid lg:gap-4">
          {s === "concluido" ? <Resultado e={e} aoEditar={() => setConcluir(true)} className="order-first lg:order-none" /> : null}
          <Ficha e={e} />
        </div>
      </div>

      <JanelaExperimento aberta={editar} aoMudar={setEditar} experimento={e} />
      <JanelaConcluir experimento={concluir ? e : null} aberta={concluir} aoMudar={setConcluir} />
      <JanelaComecar experimento={comecar ? e : null} aoMudar={(v) => !v && setComecar(false)} />
      <Confirmar
        aberta={apagar}
        aoMudar={setApagar}
        className="tema-lab"
        titulo={`Excluir “${e.name}”?`}
        descricao="O experimento e o diário dele saem do laboratório."
        aoConfirmar={() => {
          excluir.mutate(e.id, { onSuccess: () => toast.success("Experimento excluído.") })
          router.push("/estudos/laboratorio")
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cabeça                                                              */
/* ------------------------------------------------------------------ */

function Cabeca({ e, registros, aoConcluir, aoComecar }: { e: Experimento; registros: Insight[]; aoConcluir: () => void; aoComecar: () => void }) {
  const acoes = useAcoesDoExperimento()
  const s = statusDo(e)
  const hoje = diaIso()
  const a = andamento(e, hoje)
  const duracao = duracaoDe(e)
  const nota = notaDo(protocolo(e.notes).resultado ?? e.notes)
  const periodo = e.starts_on
    ? `${formatar(e.starts_on, "d 'de' MMM")}${e.ends_on ? ` → ${formatar(e.ends_on, "d 'de' MMM")}` : ""}${duracao ? ` · ${plural(duracao, "dia")}` : ""}`
    : "Ainda sem data para começar"

  return (
    <header className="mt-6 grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-8">
      <div className="flex justify-center sm:block">
        {s === "em_teste" || s === "pausado" ? (
          <AnelDias dia={a.dia} total={a.total} tamanho={148} bolhas={s === "em_teste"} />
        ) : s === "concluido" || s === "abandonado" ? (
          <span className="grid size-[148px] place-items-center rounded-full border border-[var(--b-borda-2)] bg-white/[0.03] shadow-[0_0_40px_-12px_var(--b-luz)]">
            <span className="text-center">
              {nota !== null ? (
                <>
                  <span className="rotulo-hud block text-[10px]">Nota</span>
                  <span className="tabular mt-1 block font-display text-4xl font-semibold text-[var(--b-ambar)] drop-shadow-[0_0_10px_rgb(245_197_74/0.5)]">{String(nota).replace(".", ",")}</span>
                </>
              ) : (
                <IconeTipo tipo={e.kind} className="mx-auto size-10 text-[var(--b-luz)]" />
              )}
            </span>
          </span>
        ) : (
          <span className="grid size-[148px] place-items-center rounded-full border border-dashed border-[var(--b-borda-2)] bg-white/[0.02]">
            <FlaskConical className="size-10 text-[var(--b-luz)]" aria-hidden />
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="rotulo-hud flex flex-wrap items-center gap-x-2 gap-y-1">
          {s === "em_teste" ? (
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--b-luz)] opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-[var(--b-luz)]" />
            </span>
          ) : null}
          {STATUS_EXP[s]}
          {e.kind ? (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <IconeTipo tipo={e.kind} className="size-3" /> {e.kind}
              </span>
            </>
          ) : null}
        </p>
        <h1 className="mt-2 font-display text-[1.9rem] font-semibold leading-[1.08] tracking-tight text-balance sm:text-[2.5rem]">{e.name}</h1>
        {e.hypothesis ? <p className="mt-3 max-w-2xl border-l-2 border-[var(--b-luz)]/60 pl-3 text-base italic leading-relaxed text-ink-2">{e.hypothesis}</p> : null}
        <p className="mt-3 text-sm text-ink-3">
          {periodo}
          {s === "em_teste" && a.total && !a.passou ? ` · ${a.restam === 0 ? "último dia" : `faltam ${plural(a.restam ?? 0, "dia")}`}` : ""}
          {registros.length ? ` · ${plural(registros.length, "registro", "registros")} no diário` : ""}
        </p>
        {s === "em_teste" && a.passou ? <p className="mt-2 text-sm text-[var(--b-ambar)]">O prazo terminou. Hora de ver se funcionou.</p> : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {s === "a_iniciar" ? (
            <Botao variante="primario" tamanho="lg" onClick={aoComecar} className="shadow-[0_0_24px_-6px_var(--b-luz)]">
              <Play /> Começar hoje
            </Botao>
          ) : null}
          {s === "em_teste" ? (
            <>
              <Botao variante="primario" tamanho="lg" onClick={aoConcluir} className="shadow-[0_0_24px_-6px_var(--b-luz)]">
                <Check /> Concluir
              </Botao>
              <Botao variante="contorno" tamanho="lg" onClick={() => acoes.mudar(e, "pausado")} className="bg-transparent">
                <Pause /> Pausar
              </Botao>
              {a.total ? (
                <Botao variante="fantasma" tamanho="lg" onClick={() => acoes.estender(e)}>
                  <CalendarPlus /> Mais 7 dias
                </Botao>
              ) : null}
            </>
          ) : null}
          {s === "pausado" ? (
            <>
              <Botao variante="primario" tamanho="lg" onClick={() => acoes.mudar(e, "em_teste")}>
                <Play /> Retomar
              </Botao>
              <Botao variante="contorno" tamanho="lg" onClick={aoConcluir} className="bg-transparent">
                <Check /> Concluir
              </Botao>
            </>
          ) : null}
          {s === "concluido" ? <SeloResultado resultado={resultadoDo(e)} className="px-3 py-1 text-sm" /> : null}
          {s === "abandonado" ? (
            <Botao variante="contorno" tamanho="lg" onClick={() => acoes.mudar(e, "a_iniciar")} className="bg-transparent">
              <Lightbulb /> Voltar para as ideias
            </Botao>
          ) : null}
        </div>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Diário                                                              */
/* ------------------------------------------------------------------ */

function Diario({ e, registros }: { e: Experimento; registros: Insight[] }) {
  const hoje = diaIso()
  const s = statusDo(e)
  const registrar = useRegistrarDia()
  const excluir = useExcluir("insights")
  const criar = useCriar("insights")
  const atualizar = useAtualizar("insights")
  const [texto, setTexto] = React.useState("")
  const [dia, setDia] = React.useState(hoje)
  const registrados = diasComRegistro(registros)
  const dias = diasDoTeste(e, hoje)
  // O diário recebe registros enquanto o teste está aberto (em teste ou pausado)
  const podeRegistrar = s === "em_teste" || s === "pausado"
  const ultimoDia = e.ends_on && e.ends_on < hoje && s !== "em_teste" ? e.ends_on : hoje

  // Agrupa por dia (os mais novos primeiro)
  const grupos = React.useMemo(() => {
    const mapa = new Map<string, Insight[]>()
    for (const i of registros) {
      const d = i.noted_on ?? i.created_at.slice(0, 10)
      mapa.set(d, [...(mapa.get(d) ?? []), i])
    }
    return [...mapa.entries()]
  }, [registros])

  const enviar = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (registrar(e, texto, dia)) {
      setTexto("")
      setDia(hoje)
    }
  }

  // Teste encerrado sem nenhum registro: o diário não tem o que mostrar
  if (!podeRegistrar && s !== "a_iniciar" && !registros.length) return null

  return (
    <section aria-labelledby="titulo-diario" className="min-w-0">
      <p className="rotulo-hud flex items-center gap-2">
        <NotebookPen className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Diário do experimento
      </p>
      <h2 id="titulo-diario" className="mt-1 font-display text-2xl font-semibold">
        O que aconteceu a cada dia
      </h2>

      {dias.length && (podeRegistrar || registros.length) ? <FaixaDias className="mt-4" dias={dias} registrados={registrados} hoje={hoje} /> : null}

      {podeRegistrar ? (
        <form onSubmit={enviar} className="vidro mt-4 grid gap-2.5 p-3.5 sm:p-4">
          <label>
            <span className="sr-only">Observação do dia</span>
            <textarea
              value={texto}
              onChange={(ev) => setTexto(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) enviar(ev)
              }}
              rows={2}
              placeholder={dia === hoje ? "Como foi hoje? O que você observou?" : "O que aconteceu nesse dia?"}
              className="block w-full resize-none rounded-xl border border-[var(--b-borda)] bg-black/20 px-3 py-2.5 text-[16px] leading-snug text-ink [field-sizing:content] placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none sm:text-sm"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-ink-3">
              Dia
              <input
                type="date"
                value={dia}
                max={ultimoDia}
                min={e.starts_on ?? undefined}
                onChange={(ev) => setDia(ev.target.value || hoje)}
                className="h-9 rounded-lg border border-[var(--b-borda)] bg-black/20 px-2 text-sm text-ink [color-scheme:dark] toque:h-11"
              />
            </label>
            <Botao type="submit" variante="primario" disabled={!texto.trim()} className="ml-auto shadow-[0_0_20px_-6px_var(--b-luz)]">
              Registrar
            </Botao>
          </div>
        </form>
      ) : s === "a_iniciar" ? (
        <p className="vidro mt-4 px-4 py-3 text-sm text-ink-2">O diário abre quando o teste começar.</p>
      ) : null}

      {grupos.length ? (
        <ol className="mt-6 grid gap-5">
          {grupos.map(([d, lista]) => {
            const n = e.starts_on ? diasEntre(e.starts_on, d) + 1 : null
            return (
              <li key={d} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5">
                <span className="mt-1.5 size-2.5 rounded-full bg-[var(--b-luz)] shadow-[0_0_10px_var(--b-luz)]" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-3">
                    {formatar(d, "EEE, d 'de' MMM")}
                    {n && n >= 1 ? ` · dia ${n}` : ""}
                    {d === hoje ? " · hoje" : ""}
                  </p>
                  <ul className="mt-1.5 grid gap-1.5">
                    {lista.map((i) => (
                      <ItemDiario
                        key={i.id}
                        item={i}
                        aoSalvar={(t) => atualizar.mutate({ id: i.id, text: t })}
                        aoApagar={() => {
                          excluir.mutate(i.id)
                          toast("Registro apagado.", { action: { label: "Desfazer", onClick: () => criar.mutate({ ...i }) } })
                        }}
                      />
                    ))}
                  </ul>
                </div>
              </li>
            )
          })}
        </ol>
      ) : podeRegistrar ? (
        <p className="mt-5 text-sm text-ink-3">Nenhum registro ainda. Um minuto por dia basta: o que você fez, o que sentiu, o que mudou.</p>
      ) : null}
    </section>
  )
}

function ItemDiario({ item, aoSalvar, aoApagar }: { item: Insight; aoSalvar: (t: string) => void; aoApagar: () => void }) {
  const [editando, setEditando] = React.useState(false)
  const [texto, setTexto] = React.useState(item.text)
  React.useEffect(() => setTexto(item.text), [item.text])
  if (editando)
    return (
      <li>
        <form
          onSubmit={(ev) => {
            ev.preventDefault()
            if (texto.trim() && texto.trim() !== item.text) aoSalvar(texto.trim())
            setEditando(false)
          }}
          className="grid gap-2"
        >
          <textarea
            autoFocus
            value={texto}
            onChange={(ev) => setTexto(ev.target.value)}
            rows={2}
            aria-label="Editar registro"
            className="block w-full resize-none rounded-xl border border-[var(--b-luz)]/60 bg-black/20 px-3 py-2 text-[16px] leading-snug text-ink [field-sizing:content] focus-visible:outline-none sm:text-sm"
          />
          <div className="flex justify-end gap-2">
            <Botao variante="fantasma" tamanho="sm" onClick={() => (setTexto(item.text), setEditando(false))}>
              Cancelar
            </Botao>
            <Botao type="submit" variante="primario" tamanho="sm">
              Salvar
            </Botao>
          </div>
        </form>
      </li>
    )
  return (
    <li className={cn("group flex items-start gap-2 rounded-xl border px-3 py-2.5", item.kind && item.kind !== OBSERVACAO ? "border-[var(--b-luz)]/35 bg-[var(--b-luz)]/[0.06]" : "border-[var(--b-borda)] bg-white/[0.03]")}>
      <button type="button" onClick={() => setEditando(true)} className="min-w-0 flex-1 text-left text-[15px] leading-snug" aria-label={`Editar: ${item.text}`}>
        {item.kind && item.kind !== OBSERVACAO ? (
          <span className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--b-luz)]">
            <Lightbulb className="size-3" aria-hidden /> {item.kind}
            {item.potential ? <span className="font-normal normal-case tracking-normal text-ink-3"> · potencial {item.potential.toLowerCase()}</span> : null}
          </span>
        ) : null}
        {item.text}
      </button>
      <button
        type="button"
        aria-label={`Apagar: ${item.text}`}
        onClick={aoApagar}
        className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-white/[0.06] hover:text-ink pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
      >
        <X className="size-4" />
      </button>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Protocolo, resultado e ficha                                        */
/* ------------------------------------------------------------------ */

/** O modelo que abre quando o protocolo ainda está em branco. */
const MODELO_PROTOCOLO = "### 🎯 Objetivo\n\n\n### 📋 Procedimento\n1. \n\n### 📁 Evidências\n"

function Protocolo({ e }: { e: Experimento }) {
  const { mutate } = useAtualizar("experiments")
  const vazio = !e.notes?.trim()
  const [escrevendo, setEscrevendo] = React.useState(false)
  return (
    <section aria-labelledby="titulo-protocolo" className="vidro p-4 sm:p-6">
      <p className="rotulo-hud flex items-center gap-2">
        <BookText className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Protocolo
      </p>
      <h2 id="titulo-protocolo" className="mt-1 text-sm text-ink-2">
        Objetivo, procedimento, evidências e o que mais quiser anotar sobre o teste.
      </h2>
      <div className="mt-4">
        {vazio && !escrevendo ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-[var(--b-borda-2)] bg-white/[0.02] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-3">Ainda em branco. Anote o objetivo, o passo a passo e onde guardar as evidências.</p>
            <Botao variante="contorno" onClick={() => setEscrevendo(true)} className="shrink-0 bg-transparent">
              <Pencil /> Escrever o protocolo
            </Botao>
          </div>
        ) : (
          <EditorMarkdown
            rotulo={`protocolo de ${e.name}`}
            valor={vazio ? MODELO_PROTOCOLO : (e.notes ?? "")}
            inicioEditando={vazio}
            aoSalvar={(v) => mutate({ id: e.id, notes: v.trim() ? v : null })}
          />
        )}
      </div>
    </section>
  )
}

function Resultado({ e, aoEditar, className }: { e: Experimento; aoEditar: () => void; className?: string }) {
  const p = protocolo(e.notes)
  const nota = notaDo(p.resultado ?? e.notes)
  const proximo = /pr[oó]ximo passo:?\**:?\s*(.+)/i.exec(p.resultado ?? "")?.[1]?.trim()
  const aprendizados = itensDe(p.aprendizados)
  const conclusao = p.conclusao && !/^texto livre\.?$/i.test(p.conclusao) ? p.conclusao : null
  return (
    <section aria-labelledby="titulo-resultado" className={cn("vidro p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="titulo-resultado" className="rotulo-hud">
          Resultado
        </h2>
        <button type="button" onClick={aoEditar} className="min-h-9 rounded-full px-2 text-xs font-medium text-[var(--b-luz)] hover:bg-white/[0.06]">
          Editar
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SeloResultado resultado={resultadoDo(e)} className="px-3 py-1 text-sm" />
        {nota !== null ? (
          <span className="text-sm text-ink-2">
            nota <span className="tabular font-display text-xl font-semibold text-[var(--b-ambar)]">{String(nota).replace(".", ",")}</span>
          </span>
        ) : null}
      </div>
      {proximo ? <p className="mt-3 text-sm text-ink-2">Próximo passo: {proximo}</p> : null}
      {aprendizados.length ? (
        <>
          <p className="rotulo-hud mt-4">Aprendizados</p>
          <ul className="mt-1.5 grid gap-1.5">
            {aprendizados.map((a) => (
              <li key={a} className="flex gap-2 text-sm leading-snug">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--b-luz)]" aria-hidden />
                {a}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {conclusao ? <p className="mt-4 border-l-2 border-[var(--b-luz)]/50 pl-3 text-sm italic text-ink-2">{conclusao}</p> : null}
    </section>
  )
}

function Ficha({ e }: { e: Experimento }) {
  const linhas: [string, string][] = [
    ["Tipo", e.kind ?? "—"],
    ["Situação", STATUS_EXP[statusDo(e)]],
    ["Início", e.starts_on ? formatar(e.starts_on, "d 'de' MMM 'de' yyyy") : "—"],
    ["Fim", e.ends_on ? formatar(e.ends_on, "d 'de' MMM 'de' yyyy") : "—"],
  ]
  return (
    <section aria-label="Ficha do experimento" className={cn("vidro p-4 sm:p-5")}>
      <h2 className="rotulo-hud">Ficha</h2>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        {linhas.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="text-ink-3">{k}</dt>
            <dd className="text-right">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
    </section>
  )
}
