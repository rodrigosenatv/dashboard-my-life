"use client"

import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CopyPlus, Eye, Flame, Heart, Recycle, Shapes, Tags, TrendingUp, type LucideIcon } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { TituloPainel } from "@/features/conteudo/moldura"
import { VazioCerebro } from "@/features/segundo-cerebro/ui"
import { desempenho, desempenhoPorGrupo, engajamento, paraReaproveitar } from "@/features/conteudo/logica"
import { cn, haQuanto, numero, plural } from "@/lib/utils"
import { MenuNovaVersao } from "./nova-versao"
import type { Conteudo } from "./ui"

const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 })
const curto = (n: number) => (n < 10_000 ? numero(Math.round(n)) : compacto.format(n))

/** O que funciona: a média de visualizações e o engajamento por formato ou por linha editorial. */
function PorGrupo({ titulo, icone, grupos, rotulo, vazio }: { titulo: string; icone: LucideIcon; grupos: ReturnType<typeof desempenhoPorGrupo>; rotulo: (chave: string) => string; vazio: string }) {
  const max = Math.max(1, ...grupos.map((g) => g.mediaViews))
  return (
    <section aria-label={titulo} className="vidro min-w-0 p-4 sm:p-5">
      <TituloPainel icone={icone} titulo={titulo} className="mb-1" />
      <p className="mb-3 text-xs text-ink-3">Média de visualizações por post e o engajamento médio.</p>
      {grupos.length < 2 ? (
        <p className="text-sm text-ink-2">{vazio}</p>
      ) : (
        <ul className="grid gap-3">
          {grupos.slice(0, 6).map((g) => (
            <li key={g.chave} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{rotulo(g.chave)}</span>
                <span className="shrink-0 text-xs text-ink-3">{plural(g.n, "post")}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <span className="barra-luz flex-1" aria-hidden>
                  <span style={{ width: `${Math.max(3, (g.mediaViews / max) * 100)}%` }} />
                </span>
                <span className="tabular w-28 shrink-0 text-right text-xs text-ink-2">
                  {curto(g.mediaViews)} <span className="text-ink-3">por post</span>
                </span>
              </div>
              <span className="sr-only">
                Média de {numero(Math.round(g.mediaViews))} visualizações por post{g.mediaEngajamento !== null ? `, engajamento médio de ${numero(g.mediaEngajamento, 1)}%` : ""}.
              </span>
              {g.mediaEngajamento !== null ? <p aria-hidden className="mt-0.5 text-xs text-ink-3">Engajamento médio de {numero(g.mediaEngajamento, 1)}%</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function Desempenho({
  itens,
  nomesLinha,
  hoje,
  aoAbrir,
  aoNovaVersao,
}: {
  itens: Conteudo[]
  nomesLinha: Map<string, string>
  hoje: string
  aoAbrir: (c: Conteudo) => void
  aoNovaVersao: (c: Conteudo, formato: string) => void
}) {
  const d = desempenho(itens)
  if (!d.lista.length)
    return <VazioCerebro icone={TrendingUp} titulo="Nada para medir ainda." descricao="Registre visualizações e curtidas nos conteúdos publicados (uns 7 dias depois de publicar) para ver o que funciona." />
  const indicadores = [
    { rotulo: "Visualizações", valor: numero(d.visualizacoes), icone: Eye, cor: "var(--b-luz)" },
    { rotulo: "Curtidas", valor: numero(d.curtidas), icone: Heart, cor: "var(--b-rosa)" },
    { rotulo: "Engajamento médio", valor: d.mediaEngajamento === null ? "–" : `${numero(d.mediaEngajamento, 1)}%`, icone: TrendingUp, cor: "var(--b-verde)" },
    { rotulo: "Mais visto", valor: d.melhor ? numero(d.melhor.views) : "–", detalhe: d.melhor?.title, icone: Flame, cor: "var(--b-ambar)" },
  ]
  const porFormato = desempenhoPorGrupo(itens, (i) => i.format)
  const porLinha = desempenhoPorGrupo(itens, (i) => i.editorial_line_id)
  const reaproveitar = paraReaproveitar(itens, hoje)

  return (
    <div className="grid gap-5">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo do desempenho">
        {indicadores.map((x) => (
          <li key={x.rotulo} className="vidro min-w-0 p-4">
            <p className="rotulo-hud flex items-center gap-1.5">
              <x.icone className="size-3.5 shrink-0" style={{ color: x.cor }} aria-hidden /> <span className="truncate">{x.rotulo}</span>
            </p>
            <p className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{x.valor}</p>
            {x.detalhe ? <p className="mt-0.5 truncate text-xs text-ink-3">{x.detalhe}</p> : null}
          </li>
        ))}
      </ul>

      <div className="grid gap-4 md:grid-cols-2">
        <PorGrupo titulo="O que funciona por formato" icone={Shapes} grupos={porFormato} rotulo={(c) => c} vazio="Quando dois formatos ou mais tiverem posts com números, a comparação aparece aqui." />
        <PorGrupo
          titulo="O que funciona por linha editorial"
          icone={Tags}
          grupos={porLinha}
          rotulo={(c) => nomesLinha.get(c) ?? "Linha removida"}
          vazio="Quando duas linhas editoriais ou mais tiverem posts com números, a comparação aparece aqui."
        />
      </div>

      {reaproveitar.length ? (
        <section aria-labelledby="titulo-reaproveitar" className="vidro p-4 sm:p-5">
          <TituloPainel id="titulo-reaproveitar" icone={Recycle} titulo="Vale uma nova versão" cor="var(--b-verde)" />
          <p className="-mt-1 mb-3 max-w-2xl text-sm text-ink-2">Assuntos que já funcionaram, publicados há um mês ou mais. Leve para outro formato: um terço do que você publica pode sair daqui.</p>
          <ul className="grid gap-1">
            {reaproveitar.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                <button type="button" onClick={() => aoAbrir(c)} className="min-w-0 flex-1 rounded-md text-left hover:text-[var(--b-luz)]">
                  <span className="block truncate text-sm font-medium">{c.title}</span>
                  <span className="block truncate text-xs text-ink-3">
                    {[c.format, `${numero(c.views)} visualizações`, c.publish_date ? `publicado ${haQuanto(c.publish_date)}` : null].filter(Boolean).join(" · ")}
                  </span>
                </button>
                <MenuNovaVersao formatoAtual={c.format} aoEscolher={(f) => aoNovaVersao(c, f)}>
                  <Botao variante="contorno" tamanho="sm" className="shrink-0 rounded-full" aria-label={`Nova versão de ${c.title}`}>
                    <CopyPlus /> Nova versão
                  </Botao>
                </MenuNovaVersao>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="titulo-ranking" className="vidro p-3 sm:p-5">
        <TituloPainel id="titulo-ranking" icone={TrendingUp} titulo="Os mais vistos" />
        <div aria-hidden className="hidden grid-cols-[2rem_minmax(0,1fr)_13rem_5rem_6rem_6rem] gap-3 px-2 pb-2 text-xs text-ink-3 lg:grid">
          <span />
          <span>Conteúdo</span>
          <span>Visualizações</span>
          <span className="text-right">Curtidas</span>
          <span className="text-right">Comentários</span>
          <span className="text-right">Engajamento</span>
        </div>
        <ol className="grid gap-1">
          {d.lista.map((p, i) => {
            const eng = engajamento(p)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => aoAbrir(p)}
                  className="grid w-full grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 rounded-xl px-2 py-2.5 text-left text-sm transition-colors hover:bg-ink/[0.04] lg:grid-cols-[2rem_minmax(0,1fr)_13rem_5rem_6rem_6rem]"
                >
                  <span className={cn("tabular row-span-3 self-start pt-0.5 text-center font-display text-lg font-semibold lg:row-span-1 lg:self-center lg:pt-0", i === 0 ? "text-[var(--b-ambar)]" : "text-ink-3")}>{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.title}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {[p.format, p.publish_date ? format(new Date(`${p.publish_date}T12:00`), "d MMM yyyy", { locale: ptBR }) : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="col-start-2 flex items-center gap-2 lg:col-start-auto" title={`${numero(p.views)} visualizações`}>
                    <span className="barra-luz flex-1" aria-hidden>
                      <span style={{ width: `${Math.max(2, ((p.views ?? 0) / d.maximo) * 100)}%` }} />
                    </span>
                    <span className="tabular w-14 shrink-0 text-right text-xs">
                      {numero(p.views)}
                      <span className="sr-only"> visualizações</span>
                    </span>
                  </span>
                  <span className="col-start-2 flex flex-wrap gap-x-3 gap-y-0.5 whitespace-nowrap text-xs text-ink-3 lg:contents">
                    <span className="tabular lg:text-right lg:text-sm lg:text-ink">
                      {numero(p.likes)}
                      <span className="lg:sr-only"> curtidas</span>
                    </span>
                    <span className="tabular lg:text-right lg:text-sm lg:text-ink">
                      {numero(p.comments)}
                      <span className="lg:sr-only"> comentários</span>
                    </span>
                    <span className="tabular lg:text-right lg:text-sm lg:text-ink">
                      {eng === null ? "–" : `${numero(eng, 1)}%`}
                      <span className="lg:sr-only"> de engajamento</span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
