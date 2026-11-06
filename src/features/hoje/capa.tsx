"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import dynamic from "next/dynamic"
import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarDays, CornerDownLeft, Maximize2, SlidersHorizontal, Sun } from "lucide-react"
import { novoId, useCriar } from "@/lib/data"
import { cn, isoDia, saudacao } from "@/lib/utils"
import type { Tables } from "@/lib/supabase/database.types"
import { useConfiguracoes, useNomeExibicao } from "@/features/configuracoes/dados"
import { useUrlArquivo } from "@/lib/arquivos"
import { FRASE_PADRAO } from "@/lib/marca"
import { ajustesDaCapa, corDoEvento, eventosComHora, faixaDoDia, posicaoNaFaixa, situacaoDaAgenda, textoEspera, type AjustesCapa } from "./logica"

type Evento = Tables<"events">

// A imagem em tela cheia só é baixada quando vai abrir (o ponteiro sobre "Ver quadro" já antecipa)
const carregarVisualizador = () => import("@/components/ui/visualizador-imagem").then((m) => m.VisualizadorDeImagem)
const VisualizadorDeImagem = dynamic(carregarVisualizador, { ssr: false })
const anteciparVisualizador = () => void carregarVisualizador().catch(() => {})

export type Chip = { href: string; n: number | string; rotulo: string; cor?: string }

/** A capa do dia com o que vem da conta: o nome, a frase e a imagem de Configurações (com os ajustes dela) e a captura rápida. */
export function CapaDoDia({ agora, eventos, chips }: { agora: Date; eventos: Evento[]; chips: Chip[] }) {
  const nome = useNomeExibicao()
  const { data: cfg } = useConfiguracoes()
  const prefs = (cfg?.prefs ?? {}) as { frase?: string; capa?: string; capaDestaque?: unknown; capaFoco?: unknown }
  const { data: urlCapa } = useUrlArquivo(prefs.capa || null)
  const criar = useCriar("captures", { aviso: "Guardado na Caixa de Entrada" })

  return (
    <Capa
      agora={agora}
      eventos={eventos}
      chips={chips}
      nome={nome}
      frase={prefs.frase?.trim() || FRASE_PADRAO}
      imagem={prefs.capa ? (urlCapa ?? null) : null}
      ajustes={ajustesDaCapa(prefs)}
      aoCapturar={(t) => {
        const ehLink = /^https?:\/\//i.test(t)
        // Sem tipo: a captura cai na Caixa de Entrada do Segundo Cérebro para ser organizada depois
        criar.mutate({ id: novoId(), title: t, url: ehLink ? t : null, kind: null })
      }}
    />
  )
}

/**
 * A capa do dia: a data, a frase, a linha do dia, a captura rápida e o resumo. Com uma imagem (o quadro dos
 * alvos, por exemplo), ela fica à mostra onde não há texto, enquadrada no ponto escolhido, e "Ver quadro"
 * abre a imagem inteira, sem véu, em tela cheia.
 */
export function Capa({
  agora,
  eventos,
  chips,
  nome,
  frase,
  imagem,
  ajustes,
  aoCapturar,
}: {
  agora: Date
  eventos: Evento[]
  chips: Chip[]
  nome: string
  frase: string
  imagem: string | null
  ajustes: AjustesCapa
  aoCapturar: (texto: string) => void
}) {
  const [texto, setTexto] = React.useState("")
  const [verQuadro, setVerQuadro] = React.useState(false)

  const capturar = (e: React.FormEvent) => {
    e.preventDefault()
    const t = texto.trim()
    if (!t) return
    aoCapturar(t)
    setTexto("")
  }

  return (
    // A capa é um contêiner: a frase só vai para o lado da data quando a própria capa tem largura para os dois
    <header className="capa-hoje @container p-5 sm:p-7" data-imagem={imagem ? ajustes.destaque : undefined}>
      {imagem ? (
        <>
          {/* A imagem de Configurações vira o fundo; o véu na cor do papel fica atrás do texto e deixa o resto à mostra */}
          {/* eslint-disable-next-line @next/next/no-img-element -- link temporário do storage, já otimizado no envio */}
          <img src={imagem} alt="" className="capa-imagem" style={{ objectPosition: `${ajustes.foco.x}% ${ajustes.foco.y}%` }} />
          <div aria-hidden className="capa-veu" />
          <button
            type="button"
            onClick={() => setVerQuadro(true)}
            onPointerEnter={anteciparVisualizador}
            onFocus={anteciparVisualizador}
            title="Ver a imagem inteira, em tela cheia"
            className="capa-ver-quadro"
          >
            <Maximize2 aria-hidden />
            <span className="sr-only @2xs:not-sr-only">Ver quadro</span>
          </button>
        </>
      ) : null}

      <p className="rotulo-hud flex items-center gap-2">
        <Sun className="size-3.5 text-[var(--b-ambar)]" aria-hidden />
        Hoje
        <span aria-hidden>·</span>
        <span className="tabular tracking-[0.12em] text-[var(--b-luz)]" aria-label={`Agora são ${format(agora, "HH:mm")}`}>
          {format(agora, "HH:mm")}
        </span>
      </p>

      <div className="mt-3 grid gap-x-10 gap-y-4 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] @3xl:items-end">
        <div className="flex items-end gap-4 sm:gap-5">
          <span className="numero-dia text-[4.5rem] sm:text-[5.75rem]" aria-hidden>
            {format(agora, "dd")}
          </span>
          <div className="min-w-0 pb-1">
            <h1 className="font-display text-2xl font-semibold leading-tight first-letter:uppercase sm:text-[1.75rem]">{format(agora, "EEEE", { locale: ptBR })}</h1>
            <p className="text-ink-2">{format(agora, "MMMM 'de' yyyy", { locale: ptBR })}</p>
            <p className="mt-1.5">
              {saudacao(agora)}
              {nome ? `, ${nome}` : ""}.
            </p>
          </div>
        </div>
        {/* A frase da capa, escrita à mão */}
        <p className="frase-luz font-assinatura text-balance text-[2rem] leading-[1.1] @lg:text-[2.25rem] @3xl:pb-1 @3xl:text-right @3xl:text-[2.4rem]">{frase}</p>
      </div>

      <LinhaDoDia agora={agora} eventos={eventos} sobreImagem={Boolean(imagem)} className="mt-6" />

      <form onSubmit={capturar} className="relative mt-5">
        <label htmlFor="captura-rapida" className="sr-only">
          Captura rápida
        </label>
        <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg leading-none text-[var(--b-luz)]">
          ›
        </span>
        <input
          id="captura-rapida"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Capturar ideia, link ou lembrete…"
          className="h-12 w-full rounded-2xl border border-[var(--b-borda-2)] bg-surface pl-9 pr-11 text-base text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] focus-visible:border-[var(--b-luz)] focus-visible:outline-none"
        />
        <CornerDownLeft aria-hidden className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
      </form>

      {chips.length ? (
        // No celular as pílulas ficam numa linha que rola para o lado; no computador, quebram linha
        <ul aria-label="Resumo do dia" className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {chips.map((c) => (
            <li key={c.rotulo} className="shrink-0">
              <Link
                href={c.href}
                className={cn(
                  "capa-pilula inline-flex min-h-9 items-baseline gap-1.5 rounded-full border px-3 py-1 text-sm text-ink-2 transition-colors hover:border-[var(--b-borda-2)] hover:text-ink toque:min-h-10",
                  // Sobre a imagem, a pílula ganha o fundo do papel para continuar legível
                  imagem ? "border-[var(--b-borda-2)] bg-surface/85" : "border-[var(--b-borda)] bg-ink/[0.04]",
                )}
              >
                <span className="tabular font-display text-base font-semibold" style={c.cor ? { color: c.cor } : undefined}>
                  {c.n}
                </span>
                {c.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {verQuadro && imagem ? (
        <VisualizadorDeImagem
          url={imagem}
          aberto
          aoMudar={(v) => !v && setVerQuadro(false)}
          titulo="Imagem da capa"
          legenda={(lugar) => (
            <span className={cn("font-assinatura text-white/90", lugar === "topo" ? "block truncate text-[1.9rem] leading-tight" : "text-balance text-[2.1rem] leading-[1.1]")}>{frase}</span>
          )}
          acoes={
            <Link
              href="/configuracoes#capa"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-neutral-800/65 px-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-neutral-700/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white toque:h-11 toque:min-w-11 toque:justify-center [&_svg]:size-4"
              title="Escolher quanto a imagem aparece na capa e o ponto que fica sempre à vista"
            >
              <SlidersHorizontal aria-hidden />
              <span className="sr-only sm:not-sr-only">Ajustar a capa</span>
            </Link>
          }
        />
      ) : null}
    </header>
  )
}

/** A linha do dia: das 6h à meia-noite, com o que já passou em luz, o agora pulsando e os compromissos marcados. */
export function LinhaDoDia({ agora, eventos, sobreImagem = false, className }: { agora: Date; eventos: Evento[]; sobreImagem?: boolean; className?: string }) {
  const hoje = isoDia(agora)
  const doDia = eventosComHora(eventos, hoje)
  const faixa = faixaDoDia(agora, doDia.map((e) => new Date(e.starts_at)))
  const pAgora = posicaoNaFaixa(agora, faixa)
  const sit = situacaoDaAgenda(doDia, agora)
  const marcas: number[] = []
  for (let h = faixa.inicio; h <= faixa.fim; h += 3) marcas.push(h)
  const hora = (iso: string | Date) => format(new Date(iso), "HH:mm")

  const situacao =
    sit.tipo === "agora" ? (
      <>
        <span className="font-medium text-[var(--b-luz)]">Agora:</span> {sit.evento.title} <span className="text-ink-3">· até {hora(sit.ate)}</span>
      </>
    ) : sit.tipo === "proximo" ? (
      <>
        <span className="font-medium text-[var(--b-luz)]">Próximo:</span> <span className="tabular">{hora(sit.evento.starts_at)}</span> {sit.evento.title}{" "}
        <span className="text-ink-3">· {textoEspera(sit.minutos)}</span>
      </>
    ) : sit.tipo === "fim" ? (
      <span className="text-ink-2">A agenda de hoje já passou. Resto do dia livre.</span>
    ) : (
      <span className="text-ink-2">Dia livre na agenda.</span>
    )

  return (
    <div className={className}>
      <div className="relative h-6" role="img" aria-label={`Linha do dia: agora são ${hora(agora)}.${doDia.length ? ` Compromissos: ${doDia.map((e) => `${hora(e.starts_at)} ${e.title}`).join("; ")}.` : ""}`}>
        <span className="linha-dia-trilho" />
        <span className="linha-dia-feito" style={{ width: `${pAgora}%` }} />
        {doDia.map((e) => (
          <span
            key={e.id}
            className="linha-dia-marco"
            data-passou={new Date(e.ends_at ?? e.starts_at) < agora ? "" : undefined}
            style={{ left: `${posicaoNaFaixa(new Date(e.starts_at), faixa)}%`, "--cor": corDoEvento(e.category) } as React.CSSProperties}
            title={`${hora(e.starts_at)} ${e.title}`}
          />
        ))}
        <span className="absolute top-1/2" style={{ left: `${pAgora}%` }} aria-hidden>
          <span className="absolute -left-2 -top-2 size-4 animate-ping rounded-full bg-[var(--b-luz)] opacity-40 motion-reduce:hidden" />
          <span className="linha-dia-agora absolute -left-1.5 -top-1.5 size-3 rounded-full bg-white" />
        </span>
      </div>
      {/* Sobre a imagem, as horas ficam um tom mais escuras (no claro) ou mais claras (no escuro) */}
      <div className={cn("relative mt-1 h-4 text-[10px]", sobreImagem ? "text-ink-2" : "text-ink-3")} aria-hidden>
        {marcas.map((h, i) => (
          <span
            key={h}
            className={cn("tabular absolute", i === 0 ? "translate-x-0" : i === marcas.length - 1 ? "-translate-x-full" : "-translate-x-1/2")}
            style={{ left: `${((h - faixa.inicio) / (faixa.fim - faixa.inicio)) * 100}%` }}
          >
            {h}h
          </span>
        ))}
      </div>
      <p className="mt-2 flex min-w-0 items-center gap-2 text-sm">
        <CalendarDays className="size-4 shrink-0 text-ink-3" aria-hidden />
        <span className="min-w-0 truncate">{situacao}</span>
      </p>
    </div>
  )
}
