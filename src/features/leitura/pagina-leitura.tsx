"use client"

import { useSearchParams } from "next/navigation"
import * as React from "react"
import { ArrowLeft, Ellipsis, ImageIcon, Library, LoaderCircle, PencilLine, Plus, Quote, Search, Target, X } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { ErroCarregar, Esqueleto } from "@/components/ui/basicos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { useLista } from "@/lib/data"
import { cn, numero, plural } from "@/lib/utils"
import { useDisponibilidade } from "@/features/leitor/dados"
import { Acervo, type EstadoAcervo } from "./acervo"
import { JanelaAdicionarLivro } from "./adicionar"
import { semCapaPendente, useBuscarCapas } from "./capas"
import { useDiarioLeitura, useLivros, useMetaLeitura, type Livro } from "./dados"
import { LendoAgora } from "./destaque"
import { DialogoLivro } from "./dialogo-livro"
import { PainelInsights, TrechosRecentes, trechosDeLeitura } from "./insights"
import { lendoAgora, lidosNoAno, prateleiras, queroLer, type FiltroAcervo, type IdPrateleira, type OrdemAcervo } from "./logica"
import { JanelaMeta, PainelLeitura } from "./painel"
import { Prateleira } from "./prateleira"
import { JanelaProgresso } from "./progresso"

type Visao = "inicio" | "acervo" | "insights"

const FILTRO_DA_PRATELEIRA: Record<IdPrateleira, Partial<EstadoAcervo>> = {
  desejos: { filtro: "desejos" },
  pausados: { filtro: "pausados" },
  "lidos-ano": { filtro: "lidos", ano: new Date().getFullYear() },
  favoritos: { filtro: "favoritos" },
  lidos: { filtro: "lidos" },
}

const FILTROS_VALIDOS: FiltroAcervo[] = ["todos", "lendo", "desejos", "lidos", "pausados", "favoritos"]

/** O estado do acervo como parâmetros do endereço (os valores padrão saem do endereço). */
function paramsDoAcervo(e: Partial<EstadoAcervo>): Record<string, string | number | null> {
  const p: Record<string, string | number | null> = {}
  if ("filtro" in e) p.filtro = e.filtro && e.filtro !== "todos" ? e.filtro : null
  if ("categoria" in e) p.categoria = e.categoria || null
  if ("ano" in e) p.ano = e.ano ?? null
  if ("ordem" in e) p.ordem = e.ordem && e.ordem !== "recentes" ? e.ordem : null
  return p
}
const ORDENS_VALIDAS: OrdemAcervo[] = ["recentes", "titulo", "autor", "nota"]

/** O aviso das capas fechado neste aparelho. */
const CHAVE_AVISO_CAPAS = "leitura:aviso-capas"

function lerAvisoFechado(): boolean {
  try {
    return localStorage.getItem(CHAVE_AVISO_CAPAS) === "fechado"
  } catch {
    return false
  }
}

/**
 * Leitura: a biblioteca do futuro. O livro que está sendo lido em 3D no destaque, o painel com a
 * meta do ano e os dias seguidos, as prateleiras iluminadas, o acervo com filtros e os trechos.
 * O estado da tela (visão, filtros e busca) fica no endereço, para o "voltar" funcionar.
 */
export function PaginaLeitura() {
  const params = useSearchParams()
  const visao: Visao = params.get("ver") === "acervo" ? "acervo" : params.get("ver") === "insights" || params.get("aba") === "insights" ? "insights" : "inicio"
  const filtroParam = params.get("filtro") as FiltroAcervo | null
  const ordemParam = params.get("ordem") as OrdemAcervo | null
  const estadoAcervo: EstadoAcervo = {
    filtro: filtroParam && FILTROS_VALIDOS.includes(filtroParam) ? filtroParam : "todos",
    categoria: params.get("categoria") ?? "",
    ano: Number(params.get("ano")) || null,
    ordem: ordemParam && ORDENS_VALIDAS.includes(ordemParam) ? ordemParam : "recentes",
  }

  const { data: livros = [], isLoading, error, refetch } = useLivros()
  const { data: insights = [] } = useLista("insights", { ordem: [{ coluna: "created_at", asc: false }] })
  const { dias } = useDiarioLeitura()
  const disponivel = useDisponibilidade()
  const ano = new Date().getFullYear()
  const { meta, definir } = useMetaLeitura(ano)
  const capas = useBuscarCapas()

  const [busca, setBusca] = React.useState(() => params.get("q") ?? "")
  const [adicionar, setAdicionar] = React.useState(false)
  const [manual, setManual] = React.useState<{ aberta: boolean; titulo: string }>({ aberta: false, titulo: "" })
  const [progresso, setProgresso] = React.useState<Livro | null>(null)
  const [metaAberta, setMetaAberta] = React.useState(false)
  const [avisoCapasFechado, setAvisoCapasFechado] = React.useState(true)
  React.useEffect(() => setAvisoCapasFechado(lerAvisoFechado()), [])

  /** Muda o endereço sem recarregar: `empilhar` cria uma entrada no histórico (o voltar volta para cá). */
  const irPara = React.useCallback((mudar: Record<string, string | number | null>, empilhar = false) => {
    const url = new URL(window.location.href)
    for (const [k, v] of Object.entries(mudar)) {
      if (v === null || v === "" || v === undefined) url.searchParams.delete(k)
      else url.searchParams.set(k, String(v))
    }
    url.searchParams.delete("aba")
    if (empilhar) window.history.pushState(null, "", url)
    else window.history.replaceState(null, "", url)
  }, [])

  // A busca vai para o endereço (sem empilhar), para continuar lá ao voltar de um livro
  React.useEffect(() => {
    const t = setTimeout(() => {
      const atual = new URL(window.location.href).searchParams.get("q") ?? ""
      if (atual !== busca.trim()) irPara({ q: busca.trim() || null })
    }, 300)
    return () => clearTimeout(t)
  }, [busca, irPara])

  // A visão aberta por um toque aqui volta com o "voltar"; aberta por link, volta para o início
  const empilhou = React.useRef(false)
  const abrirVisao = (v: Visao, extra: Partial<EstadoAcervo> = {}) => {
    irPara({ ver: v === "inicio" ? null : v, ...paramsDoAcervo({ filtro: "todos", categoria: "", ano: null, ordem: "recentes", ...extra }) }, v !== "inicio")
    if (v !== "inicio") empilhou.current = true
    window.scrollTo({ top: 0 })
  }
  const voltarAoInicio = () => {
    if (empilhou.current) {
      empilhou.current = false
      window.history.back()
    } else abrirVisao("inicio")
  }

  const lendo = React.useMemo(() => lendoAgora(livros), [livros])
  const fila = React.useMemo(() => queroLer(livros), [livros])
  const lista = React.useMemo(() => prateleiras(livros, ano), [livros, ano])
  const lidosAno = React.useMemo(() => lidosNoAno(livros, ano).length, [livros, ano])
  const pendentesCapa = React.useMemo(() => semCapaPendente(livros), [livros])
  const termo = busca.trim()

  const resumo = !livros.length
    ? "Sua biblioteca começa aqui."
    : `${plural(livros.length, "livro")} no acervo · ${lidosAno === 1 ? `1 lido em ${ano}` : `${numero(lidosAno)} lidos em ${ano}`}`

  return (
    <div className="tema-biblioteca biblioteca -mx-4 -mb-28 -mt-5 min-h-[calc(100dvh-7rem)] px-4 pb-32 pt-6 sm:mx-0 sm:mb-0 sm:mt-0 sm:min-h-0 sm:rounded-[1.75rem] sm:px-6 sm:pb-10 sm:pt-8 lg:px-8">
      {/* Cabeçalho */}
      <header>
        <p className="rotulo-hud flex items-center gap-2">
          <Library className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Estudos · Biblioteca
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <h1 className="font-display text-[2.5rem] font-semibold leading-none tracking-tight sm:text-[3.25rem]">Leitura</h1>
          <div className="flex shrink-0 items-center gap-2">
            <Botao variante="primario" tamanho="lg" onClick={() => setAdicionar(true)} className="px-4">
              <Plus /> Livro
            </Botao>
            <Menu>
              <MenuGatilho asChild>
                <Botao variante="contorno" tamanho="icone" aria-label="Mais opções da biblioteca" className="size-11 bg-transparent">
                  <Ellipsis />
                </Botao>
              </MenuGatilho>
              <MenuConteudo className="tema-biblioteca w-64">
                <MenuItem onSelect={() => abrirVisao("acervo")}>
                  <Library /> Acervo completo
                </MenuItem>
                <MenuItem onSelect={() => abrirVisao("insights")}>
                  <Quote /> Trechos e insights
                </MenuItem>
                <MenuItem onSelect={() => setMetaAberta(true)}>
                  <Target /> Meta de {ano}
                </MenuItem>
                <MenuSeparador />
                {pendentesCapa.length ? (
                  <MenuItem disabled={capas.rodando} onSelect={() => void capas.buscar(pendentesCapa)}>
                    <ImageIcon /> Buscar capas ({pendentesCapa.length})
                  </MenuItem>
                ) : null}
                <MenuItem onSelect={() => setManual({ aberta: true, titulo: "" })}>
                  <PencilLine /> Cadastrar sem buscar
                </MenuItem>
              </MenuConteudo>
            </Menu>
          </div>
        </div>
        <p className="mt-1.5 text-ink-2">{isLoading ? " " : resumo}</p>
      </header>

      {/* Busca no acervo */}
      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Título, autor ou categoria"
          aria-label="Buscar no acervo"
          className="h-12 w-full rounded-2xl border border-[var(--b-borda)] bg-ink/[0.04] pl-11 pr-11 text-[16px] text-ink backdrop-blur placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none sm:text-[15px]"
        />
        {busca ? (
          <button type="button" aria-label="Limpar busca" onClick={() => setBusca("")} className="absolute right-2 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:text-ink">
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {/* Busca de capas em andamento (ou o convite para buscar) */}
      {capas.rodando ? (
        <div className="vidro mt-4 flex items-center gap-3 px-4 py-3" aria-live="polite">
          <LoaderCircle className="size-4 shrink-0 animate-spin text-[var(--b-luz)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-2">
              Buscando capas… {capas.feitos} de {capas.total}
              {capas.achadas ? ` · ${plural(capas.achadas, "encontrada")}` : ""}
            </p>
            <div className="barra-luz mt-2">
              <span style={{ width: `${capas.total ? (capas.feitos / capas.total) * 100 : 0}%` }} />
            </div>
          </div>
          <Botao variante="fantasma" tamanho="sm" onClick={capas.parar}>
            Parar
          </Botao>
        </div>
      ) : !avisoCapasFechado && pendentesCapa.length >= 3 && visao === "inicio" && !termo ? (
        <div className="vidro mt-4 grid gap-3 px-4 py-3.5 sm:flex sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <ImageIcon className="mt-0.5 size-5 shrink-0 text-[var(--b-luz)]" aria-hidden />
            <p className="min-w-0 text-sm text-ink-2">
              <span className="font-medium text-ink">{plural(pendentesCapa.length, "livro sem capa", "livros sem capa")}.</span> Busco as capas na internet, junto com o autor e as páginas que faltam.
            </p>
          </div>
          <div className="flex justify-end gap-1">
            <Botao
              variante="fantasma"
              tamanho="sm"
              onClick={() => {
                try {
                  localStorage.setItem(CHAVE_AVISO_CAPAS, "fechado")
                } catch {}
                setAvisoCapasFechado(true)
              }}
            >
              Agora não
            </Botao>
            <Botao variante="primario" tamanho="sm" onClick={() => void capas.buscar(pendentesCapa)}>
              Buscar capas
            </Botao>
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        {isLoading ? (
          <Carregando />
        ) : error ? (
          <ErroCarregar erro={error} aoTentar={() => void refetch()} />
        ) : termo ? (
          <section aria-label="Resultados da busca">
            <Acervo livros={livros} busca={termo} estado={estadoAcervo} aoMudar={(e) => irPara(paramsDoAcervo(e))} />
          </section>
        ) : visao === "acervo" ? (
          <section aria-labelledby="titulo-acervo">
            <Voltar aoVoltar={voltarAoInicio} />
            <h2 id="titulo-acervo" className="mb-5 font-display text-2xl font-semibold">
              Acervo
            </h2>
            <Acervo livros={livros} busca="" estado={estadoAcervo} aoMudar={(e) => irPara(paramsDoAcervo(e))} />
          </section>
        ) : visao === "insights" ? (
          <section aria-labelledby="titulo-trechos">
            <Voltar aoVoltar={voltarAoInicio} />
            <h2 id="titulo-trechos" className="mb-1 font-display text-2xl font-semibold">
              Trechos e insights
            </h2>
            <p className="mb-5 text-ink-2">{plural(trechosDeLeitura(insights).length, "trecho guardado", "trechos guardados")}</p>
            <PainelInsights insights={insights} livros={livros} />
          </section>
        ) : !livros.length ? (
          <BibliotecaVazia aoAdicionar={() => setAdicionar(true)} />
        ) : (
          <div className="grid gap-12">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
              <LendoAgora
                livros={lendo}
                dias={dias}
                temArquivo={(id) => disponivel(id).temArquivo}
                aoAtualizar={setProgresso}
                temFila={fila.length > 0}
                aoEscolherProximo={() => abrirVisao("acervo", { filtro: "desejos" })}
              />
              <PainelLeitura livros={livros} dias={dias} ano={ano} meta={meta} aoDefinirMeta={() => setMetaAberta(true)} />
            </div>
            {lista.map((p) => (
              <Prateleira key={p.id} id={p.id} titulo={p.titulo} descricao={p.descricao} livros={p.livros} aoVerTudo={() => abrirVisao("acervo", FILTRO_DA_PRATELEIRA[p.id])} />
            ))}
            <TrechosRecentes insights={insights} livros={livros} aoVerTodos={() => abrirVisao("insights")} />
            <div className="flex justify-center">
              <Botao variante="contorno" tamanho="lg" className="bg-transparent" onClick={() => abrirVisao("acervo")}>
                <Library /> Ver o acervo completo
              </Botao>
            </div>
          </div>
        )}
      </div>

      <JanelaAdicionarLivro
        aberta={adicionar}
        aoMudar={setAdicionar}
        livros={livros}
        situacaoInicial={estadoAcervo.filtro === "lidos" && visao === "acervo" ? "finalizado" : "desejo"}
        aoCadastrarAMao={(titulo) => {
          setAdicionar(false)
          setManual({ aberta: true, titulo })
        }}
      />
      <DialogoLivro aberta={manual.aberta} aoMudar={(v) => setManual((m) => ({ ...m, aberta: v }))} tituloInicial={manual.titulo} statusInicial="desejo" />
      <JanelaProgresso livro={progresso} aberta={Boolean(progresso)} aoMudar={(v) => !v && setProgresso(null)} />
      <JanelaMeta aberta={metaAberta} aoMudar={setMetaAberta} ano={ano} meta={meta} aoSalvar={definir} />
    </div>
  )
}

function Voltar({ aoVoltar }: { aoVoltar: () => void }) {
  return (
    <button type="button" onClick={aoVoltar} className="-ml-2 mb-3 inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-sm text-ink-2 hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> Biblioteca
    </button>
  )
}

function Carregando() {
  return (
    <div className="grid gap-10" aria-busy="true" aria-label="Carregando a biblioteca">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <Esqueleto className="h-72 rounded-[1.25rem] bg-ink/[0.05]" />
        <div className="grid gap-3">
          <Esqueleto className="h-24 rounded-[1.25rem] bg-ink/[0.05]" />
          <Esqueleto className="h-24 rounded-[1.25rem] bg-ink/[0.05]" />
        </div>
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <Esqueleto key={i} className="aspect-[2/3] w-28 shrink-0 rounded-md bg-ink/[0.05]" />
        ))}
      </div>
    </div>
  )
}

function BibliotecaVazia({ aoAdicionar }: { aoAdicionar: () => void }) {
  return (
    <section className={cn("vidro relative overflow-hidden px-6 py-14 text-center")}>
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-0 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--b-luz)]/15 hidden" />
      <Library className="relative mx-auto size-9 text-[var(--b-luz)]" aria-hidden />
      <h2 className="relative mt-4 font-display text-2xl font-semibold">As prateleiras estão esperando</h2>
      <p className="relative mx-auto mt-2 max-w-md text-ink-2">Adicione o primeiro livro: busque pelo nome e a capa, o autor e o número de páginas vêm junto.</p>
      <Botao variante="primario" tamanho="lg" className="relative mt-6" onClick={aoAdicionar}>
        <Plus /> Adicionar livro
      </Botao>
    </section>
  )
}
