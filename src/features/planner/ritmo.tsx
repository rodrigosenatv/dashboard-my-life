"use client"

import * as React from "react"
import { Activity, BatteryFull, BatteryLow, BatteryWarning, Check, ChevronDown, Flame, Plus } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuRotulo, MenuSeparador } from "@/components/ui/menu"
import { TituloPainel } from "@/features/conteudo/moldura"
import { historicoSemanas, reservaDeConteudo, ritmoDaSemana, semanasSeguidas } from "@/features/conteudo/logica"
import { cn, formatar, plural } from "@/lib/utils"
import { OPCOES_META } from "./dados"
import { etapaDe, type Conteudo } from "./ui"

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** "Quarta-feira, 5 de novembro (hoje): 1 publicado, 1 agendado" */
function rotuloDoDia(d: ReturnType<typeof ritmoDaSemana<Conteudo>>["dias"][number]): string {
  const publicados = d.itens.filter((i) => i.status === "publicado").length
  const pendentes = d.itens.length - publicados
  const partes = [
    publicados ? plural(publicados, "publicado") : null,
    pendentes ? plural(pendentes, d.passou ? "atrasado" : "agendado") : null,
  ].filter(Boolean)
  return `${maiuscula(formatar(d.dia, "EEEE, d 'de' MMMM"))}${d.hoje ? " (hoje)" : ""}: ${partes.length ? partes.join(", ") : "nada marcado"}`
}

/** A meta da semana, num menu: quantas publicações por semana. */
function MenuMeta({ meta, aoMudar }: { meta: number; aoMudar: (n: number) => void }) {
  return (
    <Menu>
      <MenuGatilho asChild>
        <Botao variante="contorno" tamanho="sm" className="rounded-full" aria-label={`Meta: ${meta} por semana. Mudar a meta`}>
          Meta: {meta}
          <span className="-ml-1 hidden sm:inline"> por semana</span> <ChevronDown className="text-ink-3" />
        </Botao>
      </MenuGatilho>
      <MenuConteudo className="w-60">
        <MenuRotulo>Publicações por semana</MenuRotulo>
        {OPCOES_META.map((n) => (
          <MenuItem key={n} onSelect={() => aoMudar(n)} className="justify-between">
            {n} por semana
            {n === meta ? <Check className="!text-[var(--b-luz)]" aria-label="atual" /> : null}
          </MenuItem>
        ))}
        <MenuSeparador />
        <p className="px-2.5 pb-1.5 pt-1 text-xs text-ink-3">Constância vale mais que volume: escolha um ritmo que dá para manter. No Instagram, 3 a 5 por semana já fazem o perfil crescer.</p>
      </MenuConteudo>
    </Menu>
  )
}

/** As publicações das últimas semanas, em barrinhas, com a linha da meta; a semana atual na cor de destaque. */
function Semanas({ semanas, meta }: { semanas: { inicio: string; publicados: number }[]; meta: number }) {
  // Uma folga acima da meta, para a linha dela não colar no topo
  const max = Math.max(meta + 1, ...semanas.map((s) => s.publicados))
  const resumo = semanas.map((s) => `${formatar(s.inicio, "d/MM")}: ${s.publicados}`).join("; ")
  return (
    <div>
      <div role="img" aria-label={`Publicações por semana nas últimas ${semanas.length} semanas (meta de ${meta}). ${resumo}`} className="relative mt-3 flex h-11 items-end gap-0.5">
        {/* A linha da meta: as barras que passam dela bateram a meta */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-ink-3/70" style={{ bottom: `${(meta / max) * 100}%` }} />
        {semanas.map((s, k) => {
          const atual = k === semanas.length - 1
          return (
            <span key={s.inicio} title={`${atual ? "Esta semana" : `Semana de ${formatar(s.inicio, "d 'de' MMM")}`}: ${plural(s.publicados, "publicação", "publicações")}`} className="flex h-full flex-1 items-end justify-center">
              <span
                className="w-full max-w-6 rounded-t-[4px]"
                style={{
                  height: s.publicados ? `${Math.max(10, (s.publicados / max) * 100)}%` : "2px",
                  background: atual ? "var(--b-luz)" : s.publicados ? "color-mix(in oklab, var(--ink-3) 50%, var(--surface))" : "var(--surface-3)",
                }}
              />
            </span>
          )
        })}
      </div>
      <div aria-hidden className="mt-1 flex justify-between text-[10px] text-ink-3">
        <span>{semanas.length} semanas atrás</span>
        <span>esta semana</span>
      </div>
    </div>
  )
}

function Reserva({ itens, meta }: { itens: Conteudo[]; meta: number }) {
  const r = reservaDeConteudo(itens, meta)
  const Icone = r.nivel === "boa" ? BatteryFull : r.nivel === "baixa" ? BatteryLow : BatteryWarning
  const cor = r.nivel === "boa" ? "var(--b-verde)" : "var(--b-ambar)"
  const dura = r.dias === 0 ? "menos de um dia" : r.dias === 1 ? "cerca de 1 dia" : `cerca de ${r.dias} dias`
  const texto =
    r.nivel === "vazia"
      ? `Nada pronto ainda. Uma semana de reserva são ${plural(meta, "conteúdo pronto", "conteúdos prontos")}.`
      : r.nivel === "baixa"
        ? `Dá para ${dura}. ${r.faltam === 1 ? "Falta 1" : `Faltam ${r.faltam}`} para uma semana de reserva.`
        : `Dá para ${dura} sem precisar produzir.`
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Icone className="size-4 shrink-0" style={{ color: cor }} aria-hidden />
        Reserva
        <span className="sr-only">{r.nivel === "boa" ? "(boa)" : r.nivel === "baixa" ? "(baixa)" : "(vazia)"}</span>
      </p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-semibold leading-none">{r.prontos}</span>
        <span className="text-sm text-ink-2">{r.prontos === 1 ? "pronto para publicar" : "prontos para publicar"}</span>
      </p>
      <p className="mt-1.5 text-xs text-ink-2">{texto}</p>
    </div>
  )
}

/**
 * O ritmo da semana: quantos saíram contra a meta, os dias de segunda a domingo (toque num dia para ver
 * ou agendar), as semanas seguidas publicando e a reserva de conteúdos prontos.
 */
export function PainelRitmo({
  itens,
  hoje,
  meta,
  aoMudarMeta,
  aoAbrirDia,
}: {
  itens: Conteudo[]
  hoje: string
  meta: number
  aoMudarMeta: (n: number) => void
  aoAbrirDia: (dia: string) => void
}) {
  const r = ritmoDaSemana(itens, hoje, meta)
  const semanas = historicoSemanas(itens, hoje, 12)
  const seguidas = semanasSeguidas(itens, hoje)
  const naMeta = semanas.filter((s) => s.publicados >= meta).length
  const segmentos = Math.min(21, Math.max(meta, r.publicados + r.agendados))
  const legenda = r.naMeta
    ? r.publicados > meta
      ? `Meta batida, e mais ${r.publicados - meta}.`
      : "Meta da semana batida."
    : r.faltam === 0
      ? `${plural(r.agendados, "agendado")} até domingo: dá para bater a meta.`
      : [r.agendados ? plural(r.agendados, "agendado") : null, `${r.faltam === 1 ? "falta 1" : `faltam ${r.faltam}`} até domingo`].filter(Boolean).join(" · ")

  return (
    <section aria-labelledby="titulo-ritmo" className="vidro min-w-0 p-4 sm:p-5">
      <TituloPainel id="titulo-ritmo" icone={Activity} titulo="Ritmo da semana" acao={<MenuMeta meta={meta} aoMudar={aoMudarMeta} />} />

      <p className="flex items-baseline gap-2">
        <span className="font-display text-[3rem] font-semibold leading-none tracking-tight">{r.publicados}</span>
        <span className="text-base text-ink-2">de {meta} publicados nesta semana</span>
      </p>
      <div aria-hidden className="mt-3 flex gap-0.5">
        {Array.from({ length: segmentos }, (_, k) => (
          <span
            key={k}
            className="h-2 flex-1 first:rounded-l-full last:rounded-r-full"
            style={{
              background:
                k < r.publicados
                  ? "var(--b-luz)"
                  : k < r.publicados + r.agendados
                    ? "color-mix(in oklab, var(--b-luz) 40%, var(--surface))"
                    : "color-mix(in oklab, var(--b-luz) 10%, var(--surface-2))",
            }}
          />
        ))}
      </div>
      <p className={cn("mt-2 flex items-center gap-1.5 text-sm", r.naMeta ? "font-medium text-ink" : "text-ink-2")}>
        {r.naMeta ? <Check className="size-4 shrink-0 text-[var(--b-verde)]" aria-hidden /> : null}
        {legenda}
      </p>

      <ol className="mt-4 grid grid-cols-7 gap-1 sm:gap-1.5" aria-label="Os dias desta semana">
        {r.dias.map((d, k) => {
          const vazio = d.itens.length === 0
          return (
            <li key={d.dia} className="min-w-0">
              <button
                type="button"
                onClick={() => aoAbrirDia(d.dia)}
                aria-label={rotuloDoDia(d)}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-xl border px-0.5 pb-2 pt-1.5 transition-colors hover:border-[var(--b-borda-2)] hover:bg-ink/[0.03]",
                  d.hoje ? "border-[var(--b-luz)] bg-[var(--b-luz)]/[0.06]" : "border-[var(--b-borda)]",
                  vazio && !d.passou && !d.hoje && "border-dashed",
                  d.passou && "opacity-60",
                )}
              >
                <span className={cn("text-[11px] font-medium", d.hoje ? "text-[var(--b-luz)]" : "text-ink-3")}>{DIAS[k]}</span>
                <span className="tabular text-sm font-semibold leading-none">{Number(d.dia.slice(8))}</span>
                <span aria-hidden className="flex h-3 items-center gap-0.5">
                  {d.itens.slice(0, 3).map((i) => {
                    const cor = i.status === "publicado" ? "var(--b-verde)" : d.passou ? "var(--danger)" : etapaDe(i.status).cor
                    // Publicado ou atrasado: ponto cheio; agendado: só o contorno (ainda não saiu)
                    return i.status === "publicado" || d.passou ? (
                      <span key={i.id} className="size-2 rounded-full" style={{ background: cor }} />
                    ) : (
                      <span key={i.id} className="size-2 rounded-full border-2" style={{ borderColor: cor }} />
                    )
                  })}
                  {d.itens.length > 3 ? <span className="text-[10px] leading-none text-ink-3">+{d.itens.length - 3}</span> : null}
                  {vazio && !d.passou ? <Plus className="size-3 text-ink-3 opacity-60" /> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-[var(--b-borda)] pt-4 sm:gap-x-6">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Flame className={cn("size-4 shrink-0", seguidas >= 2 ? "text-[var(--b-ambar)]" : "text-ink-3")} aria-hidden />
            {seguidas === 0 ? "Comece uma sequência" : seguidas === 1 ? "1 semana publicando" : `${seguidas} semanas seguidas publicando`}
          </p>
          <Semanas semanas={semanas} meta={meta} />
          <p className="mt-1.5 text-xs text-ink-2">
            {naMeta ? `Na meta em ${naMeta} das últimas ${semanas.length} semanas.` : "Publicar toda semana, mesmo pouco, é o que mais conta."}
          </p>
        </div>
        <Reserva itens={itens} meta={meta} />
      </div>
    </section>
  )
}
