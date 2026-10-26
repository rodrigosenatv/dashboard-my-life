"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import { ArrowLeft, BookMarked, BookOpen, Check, ChevronDown, Ellipsis, ImageIcon, Pause, Pencil, Play, Quote, RotateCcw, Star, Trash } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Esqueleto } from "@/components/ui/basicos"
import { Confirmar } from "@/components/ui/janela"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { EditorMarkdown } from "@/components/markdown"
import { novoId, useAtualizar, useCriar, useExcluir, useLista, useRegistro } from "@/lib/data"
import { STATUS_LIVRO } from "@/lib/rotulos"
import { cn, formatar, numero } from "@/lib/utils"
import { SecaoLivroDigital } from "@/features/leitor/secao-livro-digital"
import { apagarLivroLocal } from "@/features/leitor/armazenamento"
import { useDisponibilidade } from "@/features/leitor/dados"
import { apagarLivroNuvem } from "@/features/leitor/nuvem"
import { CapaLivro, Livro3D } from "./capa"
import { JanelaEscolherCapa } from "./capas"
import { apagarCapasEnviadas, camposDaSituacao, useDetalhesDoLivro, useDiarioLeitura, type Livro } from "./dados"
import { DialogoLivro } from "./dialogo-livro"
import { codigoDoLivro, diaIso, fracaoLida, paginasRestantes, plural, previsaoDeTermino, ritmoDoLivro, somarDias, textoPagina, type DiaLeitura } from "./logica"
import { JanelaProgresso } from "./progresso"

/** A tela de um livro: a capa em 3D, nota, situação e progresso, sinopse, livro digital, diário, trechos e anotações. */
export function PaginaLivro() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: livro, isLoading } = useRegistro("books", id)
  const { data: insights = [] } = useLista("insights", { ordem: [{ coluna: "created_at", asc: false }] })
  const { dias } = useDiarioLeitura()
  const atualizar = useAtualizar("books")
  const excluir = useExcluir("books")
  const [editar, setEditar] = React.useState(false)
  const [apagar, setApagar] = React.useState(false)
  const [capa, setCapa] = React.useState(false)
  const [progresso, setProgresso] = React.useState(false)

  const moldura = "tema-biblioteca biblioteca -mx-4 -mb-28 -mt-5 min-h-[calc(100dvh-7rem)] px-4 pb-32 pt-5 sm:mx-0 sm:mb-0 sm:mt-0 sm:min-h-0 sm:rounded-[1.75rem] sm:px-6 sm:pb-10 sm:pt-6 lg:px-8"

  if (isLoading)
    return (
      <div className={moldura} aria-busy="true" aria-label="Carregando o livro">
        <div className="grid gap-6 pt-10 sm:grid-cols-[12rem_1fr]">
          <Esqueleto className="mx-auto aspect-[2/3] w-40 rounded-md bg-white/[0.06] sm:w-48" />
          <div className="grid content-start gap-3">
            <Esqueleto className="h-10 w-3/4 bg-white/[0.06]" />
            <Esqueleto className="h-5 w-1/3 bg-white/[0.06]" />
            <Esqueleto className="mt-6 h-2 w-full bg-white/[0.06]" />
          </div>
        </div>
      </div>
    )
  if (!livro)
    return (
      <div className={moldura}>
        <div className="vidro mx-auto mt-10 max-w-md px-6 py-10 text-center">
          <p className="font-display text-xl font-semibold">Livro não encontrado</p>
          <p className="mt-1 text-ink-2">Ele pode ter sido excluído.</p>
          <Botao asChild variante="primario" className="mt-5">
            <Link href="/estudos/leitura">Voltar para a biblioteca</Link>
          </Botao>
        </div>
      </div>
    )

  const doLivro = insights.filter((i) => i.book_id === livro.id)
  const diasDoLivro = dias.filter((d) => d.livro === livro.id)

  const mudarSituacao = (status: string) => {
    const antes = { status: livro.status, started_at: livro.started_at, finished_at: livro.finished_at, read_years: livro.read_years, pages_read: livro.pages_read }
    atualizar.mutate({ id: livro.id, ...camposDaSituacao(livro, status) })
    toast(`Agora em “${STATUS_LIVRO[status as keyof typeof STATUS_LIVRO] ?? status}”.`, { action: { label: "Desfazer", onClick: () => atualizar.mutate({ id: livro.id, ...antes }) } })
  }

  return (
    <div className={moldura}>
      <nav className="flex items-center justify-between gap-2">
        <Link href="/estudos/leitura" className="-ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Biblioteca
        </Link>
        <div className="flex items-center gap-1">
          <Botao variante="fantasma" tamanho="icone" aria-label="Editar dados do livro" onClick={() => setEditar(true)}>
            <Pencil />
          </Botao>
          <Menu>
            <MenuGatilho asChild>
              <Botao variante="fantasma" tamanho="icone" aria-label="Mais opções do livro">
                <Ellipsis />
              </Botao>
            </MenuGatilho>
            <MenuConteudo className="tema-biblioteca w-56">
              <MenuItem onSelect={() => setCapa(true)}>
                <ImageIcon /> Trocar capa
              </MenuItem>
              <MenuItem onSelect={() => setEditar(true)}>
                <Pencil /> Editar dados
              </MenuItem>
              <MenuSeparador />
              <MenuItem perigo onSelect={() => setApagar(true)}>
                <Trash /> Excluir livro
              </MenuItem>
            </MenuConteudo>
          </Menu>
        </div>
      </nav>

      <Cabeca livro={livro} dias={diasDoLivro} aoCapa={() => setCapa(true)} aoProgresso={() => setProgresso(true)} aoSituacao={mudarSituacao} />

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="grid min-w-0 gap-10">
          <Sinopse livro={livro} />
          <SecaoLivroDigital livro={livro} />
          <Trechos livro={livro} insights={doLivro} />
          <section aria-labelledby="titulo-anotacoes" className="min-w-0">
            <h2 id="titulo-anotacoes" className="mb-3 font-display text-xl font-semibold">
              Anotações
            </h2>
            <div className="vidro p-4 sm:p-5">
              <EditorMarkdown rotulo="anotações do livro" valor={livro.notes ?? ""} aoSalvar={(v) => atualizar.mutate({ id: livro.id, notes: v || null })} />
            </div>
          </section>
        </div>
        <aside className="grid gap-4">
          <Ficha livro={livro} />
          <Diario dias={diasDoLivro} />
        </aside>
      </div>

      <DialogoLivro aberta={editar} aoMudar={setEditar} livro={livro} />
      <JanelaEscolherCapa livro={livro} aberta={capa} aoMudar={setCapa} />
      <JanelaProgresso livro={livro} aberta={progresso} aoMudar={setProgresso} />
      <Confirmar
        aberta={apagar}
        aoMudar={setApagar}
        titulo={`Excluir “${livro.title}”?`}
        descricao="Os trechos, a capa enviada e o arquivo do livro (no aparelho e na nuvem) também serão excluídos."
        aoConfirmar={() => {
          excluir.mutate(livro.id)
          void apagarLivroNuvem(livro.id).catch(() => {})
          void apagarLivroLocal(livro.id).catch(() => {})
          void apagarCapasEnviadas(livro.id).catch(() => {})
          router.push("/estudos/leitura")
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cabeça: capa, título, nota, situação e progresso                    */
/* ------------------------------------------------------------------ */

function Cabeca({
  livro: l,
  dias,
  aoCapa,
  aoProgresso,
  aoSituacao,
}: {
  livro: Livro
  dias: DiaLeitura[]
  aoCapa: () => void
  aoProgresso: () => void
  aoSituacao: (s: string) => void
}) {
  const atualizar = useAtualizar("books")
  const disponivel = useDisponibilidade()(l.id)
  const hoje = diaIso()
  const pct = Math.round(fracaoLida(l) * 100)
  const restam = paginasRestantes(l)
  const previsao = l.status === "lendo" ? previsaoDeTermino(restam, ritmoDoLivro(dias, l.id, hoje), hoje) : null
  const situacao = STATUS_LIVRO[l.status as keyof typeof STATUS_LIVRO] ?? l.status

  return (
    <header className="relative mt-4 grid items-center gap-x-10 gap-y-8 sm:grid-cols-[auto_minmax(0,1fr)]">
      {/* A própria capa, desfocada, ilumina o fundo */}
      <span aria-hidden className="pointer-events-none absolute -inset-x-10 -top-24 bottom-0 -z-10 overflow-hidden opacity-40 [mask-image:radial-gradient(70%_70%_at_30%_40%,#000,transparent)]">
        <span className="block size-full scale-125 blur-3xl saturate-150">
          <CapaLivro livro={l} />
        </span>
      </span>

      <div className="relative mx-auto w-44 pb-6 sm:mx-0 sm:w-52">
        <button type="button" onClick={aoCapa} aria-label="Trocar a capa" className="flutuar block w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--b-luz)]">
          <Livro3D livro={l} prioridade />
        </button>
        <span aria-hidden className="pedestal" />
      </div>

      <div className="min-w-0">
        <p className="rotulo-hud">
          {codigoDoLivro(l)}
          {l.category ? ` · ${l.category}` : ""}
        </p>
        <h1 className="mt-2 font-display text-[2rem] font-semibold leading-[1.08] tracking-tight text-balance sm:text-[2.75rem]">{l.title}</h1>
        {l.author ? <p className="mt-2 text-lg text-ink-2">{l.author}</p> : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Estrelas nota={l.rating} aoMudar={(n) => atualizar.mutate({ id: l.id, rating: n })} />
          <button
            type="button"
            aria-pressed={l.favorite}
            onClick={() => atualizar.mutate({ id: l.id, favorite: !l.favorite })}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors toque:min-h-11",
              l.favorite ? "border-[var(--b-ambar)]/60 bg-[var(--b-ambar)]/12 text-[var(--b-ambar)]" : "border-line-strong text-ink-2 hover:text-ink",
            )}
          >
            <Star className={cn("size-4", l.favorite && "fill-current")} aria-hidden /> {l.favorite ? "Favorito" : "Favoritar"}
          </button>
          <Situacao livro={l} rotulo={situacao} aoSituacao={aoSituacao} />
        </div>

        {l.status !== "desejo" ? (
          <div className="mt-6 max-w-xl">
            <div className="flex items-center gap-3">
              <div className="barra-luz flex-1" role="progressbar" aria-label="Progresso da leitura" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                <span style={{ width: `${pct}%` }} />
              </div>
              <span className="tabular w-11 shrink-0 text-right text-sm font-semibold">{pct}%</span>
            </div>
            <p className="tabular mt-2 text-sm text-ink-2">
              {l.status === "finalizado" ? (l.pages_total ? `${numero(l.pages_total)} páginas lidas` : "Lido") : textoPagina(l)}
              {l.status !== "finalizado" && restam ? ` · faltam ${plural(restam, "página")}` : ""}
              {previsao ? ` · termina por volta de ${formatar(previsao.dia, "d 'de' MMM")}` : ""}
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {disponivel.temArquivo ? (
            <Botao asChild variante="primario" tamanho="lg" className="shadow-[0_0_24px_-4px_var(--b-luz)]">
              <Link href={`/ler/${l.id}`}>
                <BookOpen /> {l.pages_read ? "Continuar lendo" : "Ler"}
              </Link>
            </Botao>
          ) : null}
          {l.status === "desejo" ? (
            <Botao variante={disponivel.temArquivo ? "contorno" : "primario"} tamanho="lg" className={disponivel.temArquivo ? "bg-transparent" : undefined} onClick={() => aoSituacao("lendo")}>
              <Play /> Começar a ler
            </Botao>
          ) : l.status !== "finalizado" ? (
            <Botao variante={disponivel.temArquivo ? "contorno" : "primario"} tamanho="lg" className={disponivel.temArquivo ? "bg-transparent" : undefined} onClick={aoProgresso}>
              <BookMarked /> Atualizar página
            </Botao>
          ) : null}
        </div>
      </div>
    </header>
  )
}

function Estrelas({ nota, aoMudar }: { nota: number | null; aoMudar: (n: number | null) => void }) {
  const [sobre, setSobre] = React.useState<number | null>(null)
  const mostrada = sobre ?? nota ?? 0
  return (
    <div role="radiogroup" aria-label="Nota" className="flex items-center" onMouseLeave={() => setSobre(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={nota === n}
          aria-label={`${n} de 5`}
          onMouseEnter={() => setSobre(n)}
          onClick={() => aoMudar(nota === n ? null : n)}
          className="grid size-9 place-items-center rounded-full transition-transform active:scale-90 toque:size-10"
        >
          <Star className={cn("size-6 transition-colors", n <= mostrada ? "fill-[var(--b-ambar)] text-[var(--b-ambar)] drop-shadow-[0_0_6px_rgb(245_197_74/0.6)]" : "text-white/25")} aria-hidden />
        </button>
      ))}
    </div>
  )
}

function Situacao({ livro: l, rotulo, aoSituacao }: { livro: Livro; rotulo: string; aoSituacao: (s: string) => void }) {
  return (
    <Menu>
      <MenuGatilho asChild>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--b-luz)]/40 bg-[var(--b-luz)]/10 px-3 text-sm font-medium text-ink transition-colors hover:border-[var(--b-luz)] toque:min-h-11"
        >
          <span aria-hidden className="size-2 rounded-full bg-[var(--b-luz)] shadow-[0_0_8px_var(--b-luz)]" />
          {rotulo}
          <ChevronDown className="size-4 text-ink-3" aria-hidden />
        </button>
      </MenuGatilho>
      <MenuConteudo align="start" className="tema-biblioteca w-56">
        {l.status !== "lendo" ? (
          <MenuItem onSelect={() => aoSituacao("lendo")}>
            {l.status === "pausado" ? <RotateCcw /> : <Play />} {l.status === "pausado" ? "Retomar a leitura" : l.status === "finalizado" ? "Ler de novo" : "Começar a ler"}
          </MenuItem>
        ) : null}
        {l.status === "lendo" ? (
          <MenuItem onSelect={() => aoSituacao("pausado")}>
            <Pause /> Pausar
          </MenuItem>
        ) : null}
        {l.status !== "finalizado" ? (
          <MenuItem onSelect={() => aoSituacao("finalizado")}>
            <Check /> Terminei
          </MenuItem>
        ) : null}
        {l.status !== "desejo" ? (
          <MenuItem onSelect={() => aoSituacao("desejo")}>
            <BookMarked /> Voltar para “Quero ler”
          </MenuItem>
        ) : null}
      </MenuConteudo>
    </Menu>
  )
}

/* ------------------------------------------------------------------ */
/* Sinopse (Google Books)                                              */
/* ------------------------------------------------------------------ */

function Sinopse({ livro }: { livro: Livro }) {
  const { data } = useDetalhesDoLivro(livro.cover_path)
  const [aberta, setAberta] = React.useState(false)
  const texto = data?.sinopse?.trim()
  const resumo = livro.summary?.trim()
  if (!texto && !resumo) return null
  return (
    <section aria-labelledby="titulo-sinopse" className="min-w-0">
      <h2 id="titulo-sinopse" className="mb-3 font-display text-xl font-semibold">
        {resumo ? "Resumo" : "Sinopse"}
      </h2>
      {resumo ? <p className="max-w-[68ch] whitespace-pre-line text-ink-2">{resumo}</p> : null}
      {texto ? (
        <div className={cn(resumo && "mt-4")}>
          {resumo ? <p className="rotulo-hud mb-2">Sinopse</p> : null}
          <p className={cn("max-w-[68ch] whitespace-pre-line text-ink-2", !aberta && "line-clamp-5")}>{texto}</p>
          {texto.length > 360 ? (
            <button type="button" onClick={() => setAberta((v) => !v)} className="mt-2 text-sm font-medium text-[var(--b-luz)] hover:underline">
              {aberta ? "Mostrar menos" : "Ler mais"}
            </button>
          ) : null}
          <p className="mt-2 text-xs text-ink-3">Sinopse do Google Books</p>
        </div>
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Trechos do livro                                                    */
/* ------------------------------------------------------------------ */

function Trechos({ livro, insights }: { livro: Livro; insights: { id: string; text: string; created_at: string; noted_on: string | null }[] }) {
  const criar = useCriar("insights")
  const excluir = useExcluir("insights")
  const [frase, setFrase] = React.useState("")
  return (
    <section aria-labelledby="titulo-trechos-livro" className="min-w-0">
      <h2 id="titulo-trechos-livro" className="mb-3 flex items-baseline gap-2 font-display text-xl font-semibold">
        Trechos <span className="tabular text-sm font-normal text-ink-3">{insights.length || ""}</span>
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!frase.trim()) return
          criar.mutate({ id: novoId(), text: frase.trim(), book_id: livro.id, source: "livro" })
          setFrase("")
        }}
        className="mb-4 flex gap-2"
      >
        <input
          value={frase}
          onChange={(e) => setFrase(e.target.value)}
          placeholder="Uma frase ou ideia do livro"
          aria-label="Novo trecho"
          className="h-11 min-w-0 flex-1 rounded-lg border border-line-strong bg-white/[0.04] px-3 text-sm text-ink placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none toque:text-[16px]"
        />
        <Botao type="submit" variante="primario" tamanho="lg" disabled={!frase.trim()}>
          Guardar
        </Botao>
      </form>
      {insights.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhum trecho ainda. No leitor, selecione um trecho e toque em “Guardar trecho”.</p>
      ) : (
        <ul className="grid gap-3">
          {insights.map((i) => (
            <li key={i.id} className="vidro group flex gap-3 p-4">
              <Quote className="mt-1 size-4 shrink-0 text-[var(--b-luz)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg leading-snug">{i.text}</p>
                <p className="mt-1 text-xs text-ink-3">{formatar(i.noted_on ?? i.created_at, "d 'de' MMM yyyy")}</p>
              </div>
              <button
                type="button"
                onClick={() => excluir.mutate(i.id)}
                className="-my-2 self-start rounded-md px-2 py-2 text-xs text-ink-3 opacity-0 hover:text-[var(--danger)] focus-visible:opacity-100 group-hover:opacity-100 toque:opacity-100"
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Ficha e diário                                                      */
/* ------------------------------------------------------------------ */

function Ficha({ livro: l }: { livro: Livro }) {
  const linhas: [string, string][] = []
  if (l.pages_total) linhas.push(["Páginas", numero(l.pages_total)])
  if (l.category) linhas.push(["Categoria", l.category])
  if (l.started_at) linhas.push(["Começou", formatar(l.started_at, "d 'de' MMM yyyy")])
  if (l.finished_at) linhas.push(["Terminou", formatar(l.finished_at, "d 'de' MMM yyyy")])
  if (l.read_years?.length) linhas.push([l.read_years.length > 1 ? "Lido em" : "Ano", l.read_years.join(", ")])
  if (!linhas.length) return null
  return (
    <section aria-label="Ficha do livro" className="vidro p-4">
      <p className="rotulo-hud mb-3">Ficha</p>
      <dl className="grid gap-2 text-sm">
        {linhas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-ink-3">{k}</dt>
            <dd className="tabular text-right text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** As últimas duas semanas de leitura deste livro (barras) e os dias registrados. */
function Diario({ dias }: { dias: DiaLeitura[] }) {
  if (!dias.length) return null
  const hoje = diaIso()
  const janela = Array.from({ length: 14 }, (_, i) => somarDias(hoje, i - 13))
  const porDia = new Map<string, number>()
  for (const d of dias) porDia.set(d.dia, (porDia.get(d.dia) ?? 0) + d.paginas)
  const maior = Math.max(1, ...janela.map((d) => porDia.get(d) ?? 0))
  const total = dias.reduce((n, d) => n + d.paginas, 0)
  return (
    <section aria-label="Diário de leitura" className="vidro p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="rotulo-hud">Diário</p>
        <p className="tabular text-xs text-ink-3">
          {plural(dias.length, "dia")} · {plural(total, "página")}
        </p>
      </div>
      <div className="mt-3 flex h-16 items-end gap-1" aria-hidden>
        {janela.map((d) => {
          const n = porDia.get(d) ?? 0
          return (
            <span key={d} className="flex-1 rounded-t-sm bg-white/[0.06]" style={{ height: `${Math.max(6, (n / maior) * 100)}%` }}>
              {n ? <span className="block size-full rounded-t-sm bg-gradient-to-t from-[var(--b-luz-2)] to-[var(--b-luz)] shadow-[0_0_10px_-2px_var(--b-luz)]" /> : null}
            </span>
          )
        })}
      </div>
      <p className="mt-1.5 flex justify-between text-[10px] text-ink-3" aria-hidden>
        <span>{formatar(janela[0], "d MMM")}</span>
        <span>hoje</span>
      </p>
      <ul className="mt-3 grid gap-1.5 text-sm">
        {dias.slice(0, 6).map((d) => (
          <li key={d.id} className="flex justify-between gap-3">
            <span className="text-ink-2">{d.dia === hoje ? "Hoje" : formatar(d.dia, "EEE, d 'de' MMM")}</span>
            <span className="tabular text-ink">
              {d.paginas ? `+${d.paginas}` : "0"} <span className="text-ink-3">· p. {d.ate}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
