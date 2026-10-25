"use client"

import * as React from "react"
import { Flame, Target } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Janela } from "@/components/ui/janela"
import { cn, formatar, numero } from "@/lib/utils"
import type { Livro } from "./dados"
import { diaIso, lidosNoAno, plural, resumoSemana, ritmoDaMeta, sequencia, type DiaLeitura } from "./logica"

/** O painel da biblioteca: meta do ano, dias seguidos de leitura e o acervo em números. */
export function PainelLeitura({
  livros,
  dias,
  ano,
  meta,
  aoDefinirMeta,
}: {
  livros: Livro[]
  dias: DiaLeitura[]
  ano: number
  meta: number
  aoDefinirMeta: () => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:gap-3.5">
      <BlocoMeta livros={livros} ano={ano} meta={meta} aoDefinirMeta={aoDefinirMeta} />
      <BlocoSequencia dias={dias} />
      <BlocoAcervo livros={livros} ano={ano} className="sm:col-span-2 lg:col-span-1" />
    </div>
  )
}

function Anel({ valor, total, tamanho = 76 }: { valor: number; total: number; tamanho?: number }) {
  const raio = (tamanho - 10) / 2
  const volta = 2 * Math.PI * raio
  const fracao = total > 0 ? Math.min(1, valor / total) : 0
  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} className="anel-luz shrink-0 -rotate-90" aria-hidden>
      <circle cx={tamanho / 2} cy={tamanho / 2} r={raio} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="6" />
      <circle
        className="anel-valor"
        cx={tamanho / 2}
        cy={tamanho / 2}
        r={raio}
        fill="none"
        stroke="var(--b-ambar)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={volta}
        strokeDashoffset={volta * (1 - fracao)}
      />
    </svg>
  )
}

function BlocoMeta({ livros, ano, meta, aoDefinirMeta }: { livros: Livro[]; ano: number; meta: number; aoDefinirMeta: () => void }) {
  const feitos = lidosNoAno(livros, ano)
  const paginas = feitos.reduce((n, l) => n + (l.pages_total ?? 0), 0)
  if (!meta) {
    return (
      <section aria-label={`Meta de ${ano}`} className="vidro flex items-center gap-4 p-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full border border-[var(--b-ambar)]/40 text-[var(--b-ambar)]">
          <Target className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="rotulo-hud">Meta {ano}</p>
          <p className="mt-0.5 text-sm text-ink-2">
            {feitos.length ? `${plural(feitos.length, "livro lido", "livros lidos")} até agora.` : "Nenhum livro terminado ainda."} Quantos você quer ler no ano?
          </p>
        </div>
        <Botao variante="contorno" tamanho="sm" onClick={aoDefinirMeta} className="bg-transparent">
          Definir
        </Botao>
      </section>
    )
  }
  const ritmo = ritmoDaMeta(meta, feitos.length, diaIso())
  return (
    <section aria-label={`Meta de ${ano}`} className="vidro relative">
      <button type="button" onClick={aoDefinirMeta} className="flex w-full items-center gap-4 rounded-[inherit] p-4 text-left hover:bg-white/[0.03]">
        <span className="relative grid place-items-center">
          <Anel valor={feitos.length} total={meta} />
          <span className="absolute inset-0 grid place-items-center text-center leading-none">
            <span>
              <span className="tabular block font-display text-xl font-semibold">{feitos.length}</span>
              <span className="tabular block text-[11px] text-ink-3">de {meta}</span>
            </span>
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="rotulo-hud block">Meta {ano}</span>
          <span
            className={cn(
              "mt-0.5 block text-sm font-semibold",
              ritmo.tom === "atras" ? "text-[#ffb36b]" : ritmo.tom === "no-ritmo" ? "text-ink" : "text-[var(--b-ambar)]",
            )}
          >
            {ritmo.texto}
          </span>
          <span className="mt-0.5 block text-xs text-ink-3">
            {ritmo.cadencia ? `Para chegar lá: ${ritmo.cadencia}` : paginas ? `${numero(paginas)} páginas lidas no ano` : "Parabéns pelo ano de leitura"}
          </span>
        </span>
      </button>
    </section>
  )
}

const INICIAIS = ["S", "T", "Q", "Q", "S", "S", "D"]

function BlocoSequencia({ dias }: { dias: DiaLeitura[] }) {
  const hoje = diaIso()
  const seguidos = sequencia(dias, hoje)
  const semana = resumoSemana(dias, hoje)
  const vazio = dias.length === 0
  return (
    <section aria-label="Dias de leitura" className="vidro p-4">
      <div className="flex items-center justify-between gap-4 lg:block">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="rotulo-hud flex items-center gap-1.5">
              Sequência <Flame className={cn("size-3.5", seguidos > 0 ? "text-[var(--b-ambar)]" : "text-ink-3")} aria-hidden />
            </p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className={cn("tabular font-display text-3xl font-semibold leading-none", seguidos > 0 && "text-[var(--b-ambar)] drop-shadow-[0_0_10px_rgb(245_197_74/0.5)]")}>{seguidos}</span>
              <span className="text-sm text-ink-2">{seguidos === 1 ? "dia seguido" : "dias seguidos"}</span>
            </p>
          </div>
        </div>
        <ol className="grid shrink-0 grid-cols-7 gap-1.5 lg:mt-3 lg:gap-1" aria-label="Esta semana">
          {semana.dias.map((d, i) => {
            const lido = semana.lidos.has(d)
            const ehHoje = d === hoje
            const futuro = d > hoje
            return (
              <li key={d} className="grid justify-items-center gap-1" aria-label={`${formatar(d, "EEEE")}: ${lido ? "leu" : futuro ? "ainda não chegou" : "sem leitura"}`}>
                <span aria-hidden className={cn("text-[10px] font-semibold", ehHoje ? "text-ink" : "text-ink-3")}>
                  {INICIAIS[i]}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "size-3.5 rounded-full border transition-colors",
                    lido ? "border-[var(--b-luz)] bg-[var(--b-luz)] shadow-[0_0_8px_var(--b-luz)]" : ehHoje ? "border-[var(--b-luz)]/70" : futuro ? "border-white/10" : "border-white/25",
                  )}
                />
              </li>
            )
          })}
        </ol>
      </div>
      <p className="mt-3 text-xs text-ink-3">
        {vazio ? "Atualize a página do livro e a contagem começa." : semana.paginas ? `${numero(semana.paginas)} páginas nesta semana` : "Nenhuma página nesta semana ainda"}
      </p>
    </section>
  )
}

const FAIXAS = [
  { chave: "finalizado", rotulo: "Lidos", cor: "var(--b-ambar)" },
  { chave: "lendo", rotulo: "Lendo", cor: "var(--b-luz)" },
  { chave: "desejo", rotulo: "Na fila", cor: "var(--b-luz-2)" },
  { chave: "pausado", rotulo: "Pausados", cor: "rgb(255 255 255 / 0.35)" },
] as const

function BlocoAcervo({ livros, ano, className }: { livros: Livro[]; ano: number; className?: string }) {
  const total = livros.length
  const contagem = FAIXAS.map((f) => ({ ...f, n: livros.filter((l) => l.status === f.chave).length }))
  const autores = new Set(livros.map((l) => l.author?.trim().toLowerCase()).filter(Boolean)).size
  return (
    <section aria-label="Acervo" className={cn("vidro p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="rotulo-hud">Acervo</p>
        <p className="text-xs text-ink-3">{autores ? plural(autores, "autor", "autores") : `${ano}`}</p>
      </div>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="tabular font-display text-3xl font-semibold leading-none">{total}</span>
        <span className="text-sm text-ink-2">{total === 1 ? "livro" : "livros"}</span>
      </p>
      {total ? (
        <>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
            {contagem.map((f) => (f.n ? <span key={f.chave} style={{ width: `${(f.n / total) * 100}%`, background: f.cor }} className="h-full first:rounded-l-full last:rounded-r-full" /> : null))}
          </div>
          <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-2">
            {contagem.map((f) => (
              <li key={f.chave} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full" style={{ background: f.cor }} />
                {f.rotulo} <span className="tabular ml-auto text-ink-3">{f.n}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}

/** Quantos livros ler no ano. */
export function JanelaMeta({ aberta, aoMudar, ano, meta, aoSalvar }: { aberta: boolean; aoMudar: (v: boolean) => void; ano: number; meta: number; aoSalvar: (n: number) => void }) {
  const [valor, setValor] = React.useState(String(meta || 12))
  React.useEffect(() => {
    if (aberta) setValor(String(meta || 12))
  }, [aberta, meta])
  const n = Math.max(0, Math.min(999, Math.round(Number(valor) || 0)))
  const sugestoes = [6, 12, 24, 52]
  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={`Meta de leitura de ${ano}`}
      descricao="Quantos livros você quer terminar no ano?"
      largura="sm"
      className="tema-biblioteca"
      rodape={
        <>
          {meta ? (
            <Botao
              variante="fantasma"
              className="mr-auto"
              onClick={() => {
                aoSalvar(0)
                aoMudar(false)
              }}
            >
              Tirar a meta
            </Botao>
          ) : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao
            variante="primario"
            disabled={n < 1}
            onClick={() => {
              aoSalvar(n)
              aoMudar(false)
            }}
          >
            Salvar
          </Botao>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="grid justify-items-center gap-1">
          <span className="sr-only">Livros no ano</span>
          <input
            inputMode="numeric"
            autoFocus
            value={valor}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setValor(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className="tabular w-32 rounded-xl bg-transparent text-center font-display text-5xl font-semibold text-ink outline-none focus-visible:bg-white/[0.06]"
          />
          <span className="rotulo-hud">livros em {ano}</span>
        </label>
        <div className="flex flex-wrap justify-center gap-2">
          {sugestoes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setValor(String(s))}
              aria-pressed={n === s}
              className={cn(
                "min-h-10 rounded-full border px-4 text-sm font-medium transition-colors toque:min-h-11",
                n === s ? "border-[var(--b-ambar)] bg-[var(--b-ambar)]/15 text-ink" : "border-line-strong text-ink-2 hover:text-ink",
              )}
            >
              {s === 52 ? "52 · um por semana" : s === 12 ? "12 · um por mês" : s}
            </button>
          ))}
        </div>
      </div>
    </Janela>
  )
}
