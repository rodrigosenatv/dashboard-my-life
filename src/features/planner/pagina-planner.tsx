"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAbrirDoEndereco } from "@/lib/abrir-do-endereco"
import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowRight, ChevronLeft, ChevronRight, Clapperboard, Compass, ExternalLink, FileText, Lightbulb, Link2, Plus, Search, Tags, Wrench, type LucideIcon } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Carregando, Segmentos } from "@/components/ui/basicos"
import { ACAO_ACESA } from "@/components/ui/cabecalho-hud"
import { VazioCerebro } from "@/features/segundo-cerebro/ui"
import { CabecalhoEstudio, LINK_PAINEL, MolduraEstudio, TituloPainel } from "@/features/conteudo/moldura"
import { proximosPassos, resumoDoPlanner } from "@/features/conteudo/logica"
import { novoId, useCriar, useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { STATUS_CONTEUDO, type StatusConteudo } from "@/lib/rotulos"
import { cn, contem, dataRelativa, formatar, isoDia, plural, urlValida, normalizar } from "@/lib/utils"
import { useArvorePaginas } from "@/features/paginas/dados"
import { DialogoConteudo } from "./dialogo-conteudo"
import { useEsteira, useMetaSemanal, useReaproveitar } from "./dados"
import { Desempenho } from "./desempenho"
import { JanelaDia } from "./dia"
import { ProximosPassos } from "./passos"
import { Quadro } from "./quadro"
import { PainelRitmo } from "./ritmo"
import { SessaoGravacao } from "./sessao-gravacao"
import { CAMPO, etapaDe, type Conteudo } from "./ui"

type Visao = "ideias" | "quadro" | "calendario" | "desempenho"

/** Páginas do Planner que no Notion ficam em "Ferramentas". */
const FERRAMENTAS = ["viral canva", "como editar", "gpt prompts", "prompts"]
const ehFerramenta = (titulo: string) => FERRAMENTAS.some((f) => normalizar(titulo).includes(f))

/* ------------------------------------------------------------------ */
/* Banco de ideias                                                     */
/* ------------------------------------------------------------------ */

function BancoIdeias({
  ideias,
  linhas,
  aoAbrir,
  aoProduzir,
}: {
  ideias: Conteudo[]
  linhas: Tables<"editorial_lines">[]
  aoAbrir: (c: Conteudo) => void
  aoProduzir: (c: Conteudo) => void
}) {
  const criar = useCriar("content_items")
  const [texto, setTexto] = React.useState("")
  const [linha, setLinha] = React.useState("")
  const [busca, setBusca] = React.useState("")
  const nomes = new Map(linhas.map((l) => [l.id, l.name]))
  const visiveis = ideias.filter((i) => !busca || contem(i.title, busca)).sort((a, b) => b.created_at.localeCompare(a.created_at))

  const adicionar = (e: React.FormEvent) => {
    e.preventDefault()
    const t = texto.trim()
    if (!t) return
    criar.mutate({ id: novoId(), title: t, status: "ideia", editorial_line_id: linha || null, position: Date.now() })
    setTexto("")
  }

  return (
    <section aria-label="Banco de ideias">
      <form onSubmit={adicionar} className="console-ia mb-5 flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-lg leading-none text-[var(--b-luz)]">
            ›
          </span>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Anote uma ideia (uma pergunta dos comentários também vale)"
            aria-label="Nova ideia"
            className="h-11 w-full bg-transparent pl-9 pr-3 text-base placeholder:text-ink-3 focus-visible:outline-none sm:text-sm"
          />
        </div>
        <div className="flex gap-2">
          {linhas.length ? (
            <select value={linha} onChange={(e) => setLinha(e.target.value)} aria-label="Linha editorial da ideia" className={cn(CAMPO, "min-w-0 flex-1 sm:w-48 sm:flex-none")}>
              <option value="">Sem linha editorial</option>
              {linhas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          ) : null}
          <Botao type="submit" variante="primario" tamanho="lg" className={cn("shrink-0 rounded-full px-5", ACAO_ACESA)} disabled={!texto.trim()}>
            <Plus /> Guardar ideia
          </Botao>
        </div>
      </form>
      {ideias.length > 8 ? (
        <div className="relative mb-3 max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar ideias" aria-label="Filtrar ideias" className={cn(CAMPO, "w-full pl-10")} />
        </div>
      ) : null}
      {visiveis.length === 0 ? (
        <VazioCerebro icone={Lightbulb} titulo={busca ? "Nenhuma ideia com esse texto." : "O banco está vazio."} descricao={busca ? "Experimente outra palavra." : "Toda ideia que surgir cabe aqui, mesmo pela metade."} />
      ) : (
        <ul className="grid gap-2">
          {visiveis.map((i) => (
            <li key={i.id} className="vidro-vivo flex items-center gap-3 px-3 py-2.5 sm:px-4">
              <span className="icone-aceso size-9" style={{ "--cor": "var(--b-ambar)" } as React.CSSProperties} aria-hidden>
                <Lightbulb className="size-4" />
              </span>
              <button type="button" onClick={() => aoAbrir(i)} className="min-w-0 flex-1 py-1 text-left">
                <span className="line-clamp-2 text-sm font-medium hover:text-[var(--b-luz)]">{i.title}</span>
                <span className="block text-xs text-ink-3">
                  {[nomes.get(i.editorial_line_id ?? ""), i.format, dataRelativa(i.created_at.slice(0, 10))].filter(Boolean).join(" · ")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => aoProduzir(i)}
                aria-label={`Produzir ${i.title}: levar para Idealizando`}
                className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-[var(--b-luz)]/40 bg-[var(--b-luz)]/[0.08] px-3 text-xs font-semibold transition-colors hover:border-[var(--b-luz)] hover:bg-[var(--b-luz)]/[0.16] toque:min-h-11"
              >
                Produzir <ArrowRight className="size-3.5 text-[var(--b-luz)]" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Calendário                                                          */
/* ------------------------------------------------------------------ */

function Calendario({ itens, hoje, aoAbrir, aoAbrirDia }: { itens: Conteudo[]; hoje: string; aoAbrir: (c: Conteudo) => void; aoAbrirDia: (dia: string) => void }) {
  const [mes, setMes] = React.useState(() => startOfMonth(new Date()))
  const dias: Date[] = []
  for (let d = startOfWeek(startOfMonth(mes)); d <= endOfWeek(endOfMonth(mes)); d = addDays(d, 1)) dias.push(d)
  const doMes = itens.filter((i) => i.publish_date?.startsWith(format(mes, "yyyy-MM"))).sort((a, b) => (a.publish_date ?? "").localeCompare(b.publish_date ?? ""))
  return (
    <section aria-label="Calendário de publicação" className="vidro p-3 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-semibold first-letter:uppercase">{format(mes, "MMMM 'de' yyyy", { locale: ptBR })}</h2>
        <div className="flex gap-1">
          <button type="button" aria-label="Mês anterior" onClick={() => setMes((m) => addMonths(m, -1))} className="grid size-10 place-items-center rounded-full border border-[var(--b-borda)] text-ink-2 hover:border-[var(--b-borda-2)] hover:text-ink">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Próximo mês" onClick={() => setMes((m) => addMonths(m, 1))} className="grid size-10 place-items-center rounded-full border border-[var(--b-borda)] text-ink-2 hover:border-[var(--b-borda-2)] hover:text-ink">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => (
          <div key={d} aria-hidden className="rotulo-hud pb-1 text-center text-[10px]">
            {d}
          </div>
        ))}
        {dias.map((d) => {
          const iso = isoDia(d)
          const doDia = itens.filter((i) => i.publish_date === iso)
          const fora = d.getMonth() !== mes.getMonth()
          return (
            <div
              key={iso}
              className={cn(
                "relative min-h-14 rounded-lg border border-ink/[0.05] bg-ink/[0.02] p-1 transition-colors hover:border-[var(--b-borda-2)] hover:bg-ink/[0.05] sm:min-h-28 sm:p-1.5",
                fora && "opacity-40",
                iso === hoje && "border-[var(--b-luz)]/50 bg-[var(--b-luz)]/[0.06]",
              )}
            >
              {/* O dia inteiro é um botão (ver o dia, agendar ou criar); os títulos ficam por cima, cada um abre o seu */}
              <button
                type="button"
                onClick={() => aoAbrirDia(iso)}
                aria-label={`${formatar(iso, "EEEE, d 'de' MMMM")}${doDia.length ? `: ${plural(doDia.length, "conteúdo")}` : ""}`}
                className="absolute inset-0 rounded-lg"
              />
              <span aria-hidden className={cn("tabular pointer-events-none relative inline-grid size-6 place-items-center rounded-full text-xs", iso === hoje && "bg-pen font-semibold text-pen-ink")}>
                {d.getDate()}
              </span>
              {/* No celular, só os pontos (a lista do mês fica embaixo); no computador, os títulos */}
              <div className="pointer-events-none relative mt-0.5 flex flex-wrap gap-1 sm:hidden" aria-hidden>
                {doDia.slice(0, 4).map((c) => (
                  <span key={c.id} className="size-1.5 rounded-full" style={{ background: etapaDe(c.status).cor }} />
                ))}
              </div>
              <div className="pointer-events-none relative hidden gap-0.5 sm:grid">
                {doDia.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => aoAbrir(c)}
                    style={{ "--cor": etapaDe(c.status).cor } as React.CSSProperties}
                    className="pointer-events-auto truncate rounded-md bg-[color-mix(in_oklab,var(--cor)_16%,transparent)] px-1.5 text-left text-[11px] font-medium leading-5 text-ink hover:bg-[color-mix(in_oklab,var(--cor)_26%,transparent)]"
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {doMes.length ? (
        <ol className="mt-4 grid gap-1 border-t border-[var(--b-borda)] pt-3 sm:hidden" aria-label="Conteúdos do mês">
          {doMes.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => aoAbrir(c)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-1.5 text-left text-sm hover:bg-ink/[0.05]">
                <span className="tabular w-12 shrink-0 text-xs text-ink-3">{format(new Date(`${c.publish_date}T12:00`), "dd/MM")}</span>
                <span className="size-2 shrink-0 rounded-full" style={{ background: etapaDe(c.status).cor }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                <span className="shrink-0 text-xs text-ink-3">{STATUS_CONTEUDO[c.status as StatusConteudo] ?? c.status}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Guias, linhas editoriais e links                                    */
/* ------------------------------------------------------------------ */

function ListaGuias({ paginas, icone: Icone }: { paginas: { id: string; title: string; icon: string | null }[]; icone: LucideIcon }) {
  return (
    <ul className="grid gap-0.5">
      {paginas.map((p) => (
        <li key={p.id}>
          <Link href={`/paginas/${p.id}`} className="flex min-h-10 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors hover:bg-ink/[0.05] hover:text-[var(--b-luz)]">
            {p.icon && !p.icon.startsWith("/") && p.icon.length <= 4 ? <span className="w-4 text-center">{p.icon}</span> : <Icone className="size-4 shrink-0 text-ink-3" />}
            <span className="truncate">{p.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

// Tudo menos `script`: o roteiro é texto longo e só a janela de edição o usa (ela busca o registro inteiro)
const COLUNAS_CONTEUDO_LISTA =
  "id,notion_id,title,status,format,editorial_line_id,platforms,publish_date,media_url,reference_url,published_url,views,likes,comments,shares,idea_type,position,created_at,updated_at"

export function PaginaPlanner() {
  const [visao, setVisao] = React.useState<Visao>("quadro")
  const { data: itens = [], isLoading } = useLista("content_items", { colunas: COLUNAS_CONTEUDO_LISTA, ordem: [{ coluna: "position" }] })
  const { data: linhas = [] } = useLista("editorial_lines", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  const { data: paginas = [] } = useArvorePaginas()
  const criarLinha = useCriar("editorial_lines")
  const [aberto, setAberto] = React.useState<Conteudo | null>(null)
  const [novo, setNovo] = React.useState<{ status?: string; dia?: string } | null>(null)
  const [dia, setDia] = React.useState<string | null>(null)
  const [sessao, setSessao] = React.useState<string[] | null>(null)
  const [linhaNova, setLinhaNova] = React.useState("")
  const [filtroLinha, setFiltroLinha] = React.useState("")
  const hoje = isoDia()
  const router = useRouter()
  const pathname = usePathname()
  const { meta, mudar: mudarMeta } = useMetaSemanal()
  const esteira = useEsteira(hoje)
  const reaproveitar = useReaproveitar()

  useAbrirDoEndereco(itens, setAberto)

  const nomesLinha = new Map(linhas.map((l) => [l.id, l.name]))
  const filtrados = itens.filter((i) => !filtroLinha || i.editorial_line_id === filtroLinha)
  const guias = paginas.filter((p) => p.section === "planner" && !p.parent_id)
  const estrategia = guias.filter((p) => !ehFerramenta(p.title))
  const ferramentas = guias.filter((p) => ehFerramenta(p.title))
  const { data: links = [] } = useLista("bookmarks", { filtro: (q) => q.eq("collection", "links"), ordem: [{ coluna: "position" }], chave: ["links-planner"] })
  const ideias = filtrados.filter((i) => i.status === "ideia")
  // O ritmo, os passos e o resumo são da esteira toda; o filtro de linha editorial vale para as visualizações abaixo dele
  const r = resumoDoPlanner(itens, hoje)
  const passos = proximosPassos(itens, hoje, meta)

  /** Troca a visualização e leva a tela até ela (no celular, ela fica abaixo do ritmo e dos passos). */
  const irPara = (v: Visao) => {
    setVisao(v)
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    requestAnimationFrame(() => document.getElementById("visoes-planner")?.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "start" }))
  }

  /** A nova versão abre pelo endereço (?abrir=), quando já está na lista. */
  const novaVersao = async (c: Conteudo, formato: string, roteiro?: string | null) => {
    const id = await reaproveitar(c, formato, roteiro)
    if (!id) return
    toast(`Nova versão em ${formato}`, {
      description: "Está em Idealizando, com o que adaptar no roteiro.",
      action: { label: "Abrir", onClick: () => router.replace(`${pathname}?abrir=${id}`, { scroll: false }) },
    })
  }

  return (
    <MolduraEstudio>
      <CabecalhoEstudio
        icone={Clapperboard}
        papel="Da ideia à publicação"
        titulo="Planner de conteúdo"
        descricao="Da ideia à publicação, num ritmo que dá para manter. Avance os cartões com um toque ou arraste entre as etapas."
        descricaoNoCelular={!itens.length}
        acoes={
          <Botao variante="primario" tamanho="lg" onClick={() => setNovo({})} className={cn("rounded-full px-5", ACAO_ACESA)}>
            <Plus /> Novo conteúdo
          </Botao>
        }
        hud={
          isLoading || !itens.length
            ? []
            : [
                { n: r.ideias, rotulo: r.ideias === 1 ? "ideia no banco" : "ideias no banco", cor: "var(--b-ambar)" },
                { n: r.producao, rotulo: "em produção", cor: "var(--b-luz)" },
                ...(r.publicadosMes ? [{ n: r.publicadosMes, rotulo: r.publicadosMes === 1 ? "publicado no mês" : "publicados no mês", cor: "var(--b-verde)" }] : []),
              ]
        }
      />

      {isLoading ? null : (
        <div className="mb-8 grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <PainelRitmo itens={itens} hoje={hoje} meta={meta} aoMudarMeta={mudarMeta} aoAbrirDia={setDia} />
          <ProximosPassos passos={passos} itens={itens} hoje={hoje} aoAbrir={setAberto} aoPublicar={esteira.publicar} aoAvancar={esteira.avancar} aoVer={irPara} />
        </div>
      )}

      <div id="visoes-planner" className="mb-6 flex scroll-mt-20 flex-wrap items-center gap-2">
        <Segmentos
          rotulo="Visualização"
          className="max-w-full rounded-full border border-[var(--b-borda)] bg-surface p-1 [&>button]:rounded-full [&>button]:px-3 sm:[&>button]:px-4"
          valor={visao}
          aoMudar={setVisao}
          opcoes={[
            { valor: "ideias", rotulo: "Ideias", contagem: ideias.length },
            { valor: "quadro", rotulo: "Quadro" },
            { valor: "calendario", rotulo: "Calendário" },
            { valor: "desempenho", rotulo: "Desempenho" },
          ]}
        />
        {linhas.length ? (
          <select value={filtroLinha} onChange={(e) => setFiltroLinha(e.target.value)} aria-label="Linha editorial" className={cn(CAMPO, "max-w-full")}>
            <option value="">Todas as linhas editoriais</option>
            {linhas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {isLoading ? (
        <Carregando />
      ) : visao === "ideias" ? (
        <BancoIdeias ideias={ideias} linhas={linhas} aoAbrir={setAberto} aoProduzir={(c) => esteira.levar(c, "idealizando")} />
      ) : visao === "quadro" ? (
        <Quadro
          itens={filtrados}
          nomesLinha={nomesLinha}
          hoje={hoje}
          aoAbrir={setAberto}
          aoCriar={(status) => setNovo({ status })}
          aoLevar={esteira.levar}
          aoAvancar={esteira.avancar}
          aoGravarEmSequencia={() =>
            setSessao(
              filtrados
                .filter((i) => i.status === "gravando")
                .sort((a, b) => (a.publish_date ?? "9").localeCompare(b.publish_date ?? "9"))
                .map((i) => i.id),
            )
          }
        />
      ) : visao === "calendario" ? (
        <Calendario itens={filtrados} hoje={hoje} aoAbrir={setAberto} aoAbrirDia={setDia} />
      ) : (
        <Desempenho itens={filtrados} nomesLinha={nomesLinha} hoje={hoje} aoAbrir={setAberto} aoNovaVersao={(c, f) => void novaVersao(c, f)} />
      )}

      <div className="mt-10 grid items-start gap-4 lg:grid-cols-3">
        <div className="grid content-start gap-4">
          {estrategia.length ? (
            <section aria-labelledby="titulo-estrategia" className="vidro p-4 sm:p-5">
              <TituloPainel id="titulo-estrategia" icone={Compass} titulo="Estratégia" cor="var(--b-violeta)" />
              <ListaGuias paginas={estrategia} icone={FileText} />
            </section>
          ) : null}
          {ferramentas.length ? (
            <section aria-labelledby="titulo-ferramentas" className="vidro p-4 sm:p-5">
              <TituloPainel id="titulo-ferramentas" icone={Wrench} titulo="Ferramentas" cor="var(--b-luz-2)" />
              <ListaGuias paginas={ferramentas} icone={Wrench} />
            </section>
          ) : null}
        </div>
        <section aria-labelledby="titulo-linhas" className="vidro p-4 sm:p-5">
          <TituloPainel id="titulo-linhas" icone={Tags} titulo="Linhas editoriais" />
          <ul className="mb-4 flex flex-wrap gap-2">
            {linhas.map((l) => {
              const ativa = filtroLinha === l.id
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setFiltroLinha((f) => (f === l.id ? "" : l.id))}
                    aria-pressed={ativa}
                    className={cn(
                      "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors toque:min-h-10",
                      ativa ? "border-[var(--b-luz)] bg-[var(--b-luz)]/[0.16]" : "border-[var(--b-borda)] bg-ink/[0.03] text-ink-2 hover:border-[var(--b-borda-2)] hover:text-ink",
                    )}
                  >
                    {l.name} <span className="tabular text-xs text-[var(--b-luz)]">{itens.filter((i) => i.editorial_line_id === l.id).length}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (linhaNova.trim()) {
                criarLinha.mutate({ id: novoId(), name: linhaNova.trim(), position: linhas.length + 1 })
                setLinhaNova("")
              }
            }}
            className="flex gap-2"
          >
            <input value={linhaNova} onChange={(e) => setLinhaNova(e.target.value)} placeholder="Nova linha editorial" aria-label="Nova linha editorial" className={cn(CAMPO, "min-w-0 flex-1")} />
            <Botao type="submit" tamanho="lg" className="rounded-full" disabled={!linhaNova.trim()}>
              Adicionar
            </Botao>
          </form>
        </section>
        <section aria-labelledby="titulo-links" className="vidro p-4 sm:p-5">
          <TituloPainel
            id="titulo-links"
            icone={Link2}
            titulo="Links externos"
            cor="var(--b-luz-2)"
            acao={
              <Link href="/links" className={LINK_PAINEL}>
                Links úteis
              </Link>
            }
          />
          {links.length ? (
            <ul className="grid gap-0.5">
              {links.map((l) => (
                <li key={l.id}>
                  <a href={urlValida(l.url) ?? "#"} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors hover:bg-ink/[0.05] hover:text-[var(--b-luz)]">
                    <ExternalLink className="size-4 shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1 truncate">{l.title}</span>
                    {l.kind ? <span className="shrink-0 text-xs text-ink-3">{l.kind}</span> : null}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">
              Nenhum link ainda. Adicione em{" "}
              <Link href="/links" className="text-[var(--b-luz)] hover:underline">
                Links úteis
              </Link>
              , na coleção Links.
            </p>
          )}
        </section>
      </div>

      <DialogoConteudo
        aberta={Boolean(novo) || Boolean(aberto)}
        aoMudar={(v) => {
          if (!v) {
            setNovo(null)
            setAberto(null)
          }
        }}
        item={aberto}
        statusInicial={novo?.status}
        dataInicial={novo?.dia}
        aoNovaVersao={(c, f, roteiro) => void novaVersao(c, f, roteiro)}
      />
      <JanelaDia
        dia={dia}
        hoje={hoje}
        itens={itens}
        aoFechar={() => setDia(null)}
        aoAbrir={(c) => {
          setDia(null)
          setAberto(c)
        }}
        aoAgendar={(c, d) => {
          esteira.mover(c, { publish_date: d }, `Agendado para ${formatar(d, "EEEE, d 'de' MMM")}`, c.title)
          setDia(null)
        }}
        aoNovo={(d, status) => {
          setDia(null)
          setNovo({ dia: d, status })
        }}
      />
      <SessaoGravacao ids={sessao} aoFechar={() => setSessao(null)} />
    </MolduraEstudio>
  )
}
