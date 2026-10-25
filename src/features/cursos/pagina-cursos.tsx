"use client"

import { useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { ArrowLeft, Ellipsis, GraduationCap, LayoutGrid, Plus, Search, X } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { ErroCarregar, Esqueleto } from "@/components/ui/basicos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem } from "@/components/ui/menu"
import { cn } from "@/lib/utils"
import { JanelaAula } from "./aula"
import { Catalogo, PainelCompetencias, type EstadoCatalogo } from "./catalogo"
import { useCapasDosCursos, useCursos, type Curso } from "./dados"
import { EstudandoAgora } from "./destaque"
import { Fileira } from "./fileira"
import { BotaoFoco } from "./foco"
import { JanelaCurso } from "./formulario-curso"
import { categoriasDos, ORDEM_STATUS, porStatus, praticasPendentes, type StatusCurso } from "./logica"
import { PainelPraticar } from "./praticar"

type Visao = "inicio" | "todos"

const STATUS_VALIDOS: (StatusCurso | "todos")[] = ["todos", ...ORDEM_STATUS]

/**
 * Cursos: a plataforma holográfica. O curso em andamento numa tela de luz (onde parou, o que praticar e o
 * caminho de volta para a plataforma), as fileiras que deslizam como num streaming, as competências e o
 * catálogo com filtros. O estado da tela (visão, filtros e busca) fica no endereço, para o "voltar" funcionar.
 */
export function PaginaCursos() {
  const router = useRouter()
  const params = useSearchParams()
  const visao: Visao = params.get("ver") === "todos" ? "todos" : "inicio"
  const statusParam = params.get("status") as StatusCurso | "todos" | null
  const estado: EstadoCatalogo = {
    status: statusParam && STATUS_VALIDOS.includes(statusParam) ? statusParam : "todos",
    categoria: params.get("area") ?? "",
  }

  const { data: cursos = [], isLoading, error, refetch } = useCursos()
  const { data: capas } = useCapasDosCursos()
  const [busca, setBusca] = React.useState(() => params.get("q") ?? "")
  const [novo, setNovo] = React.useState(false)
  const [anotar, setAnotar] = React.useState<Curso | null>(null)

  // Links antigos (?abrir=<id>) levam para a tela do curso
  const abrir = params.get("abrir")
  React.useEffect(() => {
    if (abrir) router.replace(`/estudos/cursos/${abrir}`)
  }, [abrir, router])

  /** Muda o endereço sem recarregar: `empilhar` cria uma entrada no histórico (o voltar volta para cá). */
  const irPara = React.useCallback((mudar: Record<string, string | null>, empilhar = false) => {
    const url = new URL(window.location.href)
    for (const [k, v] of Object.entries(mudar)) {
      if (v === null || v === "") url.searchParams.delete(k)
      else url.searchParams.set(k, v)
    }
    if (empilhar) window.history.pushState(null, "", url)
    else window.history.replaceState(null, "", url)
  }, [])

  // A busca vai para o endereço (sem empilhar), para continuar lá ao voltar de um curso
  React.useEffect(() => {
    const t = setTimeout(() => {
      const atual = new URL(window.location.href).searchParams.get("q") ?? ""
      if (atual !== busca.trim()) irPara({ q: busca.trim() || null })
    }, 300)
    return () => clearTimeout(t)
  }, [busca, irPara])

  const empilhou = React.useRef(false)
  const abrirCatalogo = (e: Partial<EstadoCatalogo> = {}) => {
    irPara({ ver: "todos", status: e.status && e.status !== "todos" ? e.status : null, area: e.categoria || null }, true)
    empilhou.current = true
    window.scrollTo({ top: 0 })
  }
  const voltarAoInicio = () => {
    if (empilhou.current) {
      empilhou.current = false
      window.history.back()
    } else irPara({ ver: null, status: null, area: null })
  }
  const mudarFiltros = (e: Partial<EstadoCatalogo>) => {
    const novoEstado = { ...estado, ...e }
    irPara({ status: novoEstado.status !== "todos" ? novoEstado.status : null, area: novoEstado.categoria || null })
  }

  const grupos = React.useMemo(() => porStatus(cursos), [cursos])
  const pendentes = React.useMemo(() => praticasPendentes(cursos), [cursos])
  const categorias = React.useMemo(() => categoriasDos(cursos).map((k) => k.nome), [cursos])
  const termo = busca.trim()

  const hud: { rotulo: string; n: number; status: StatusCurso; cor?: string }[] = [
    { rotulo: "estudando", n: grupos.em_andamento.length, status: "em_andamento", cor: "var(--b-luz)" },
    { rotulo: grupos.pausado.length === 1 ? "pausado" : "pausados", n: grupos.pausado.length, status: "pausado" },
    { rotulo: "na fila", n: grupos.nao_comecou.length, status: "nao_comecou" },
    { rotulo: grupos.concluido.length === 1 ? "concluído" : "concluídos", n: grupos.concluido.length, status: "concluido", cor: "var(--b-ambar)" },
  ]

  return (
    <div className="tema-cursos plataforma -mx-4 -mb-28 -mt-5 min-h-[calc(100dvh-7rem)] px-4 pb-32 pt-6 sm:mx-0 sm:mb-0 sm:mt-0 sm:min-h-0 sm:rounded-[1.75rem] sm:px-6 sm:pb-10 sm:pt-8 lg:px-8">
      <header>
        <p className="rotulo-hud flex items-center gap-2">
          <GraduationCap className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Estudos · Plataforma de cursos
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <h1 className="font-display text-[2.5rem] font-semibold leading-none tracking-tight sm:text-[3.25rem]">Cursos</h1>
          <div className="flex shrink-0 items-center gap-2">
            <BotaoFoco className="hidden sm:inline-flex" />
            <Botao variante="primario" tamanho="lg" onClick={() => setNovo(true)} className="px-4 shadow-[0_0_24px_-6px_var(--b-luz)]">
              <Plus /> Curso
            </Botao>
            <Menu>
              <MenuGatilho asChild>
                <Botao variante="contorno" tamanho="icone" aria-label="Mais opções dos cursos" className="size-11 bg-transparent">
                  <Ellipsis />
                </Botao>
              </MenuGatilho>
              <MenuConteudo className="tema-cursos w-60">
                <MenuItem onSelect={() => abrirCatalogo()}>
                  <LayoutGrid /> Todos os cursos
                </MenuItem>
                <MenuItem onSelect={() => setNovo(true)}>
                  <Plus /> Novo curso
                </MenuItem>
              </MenuConteudo>
            </Menu>
          </div>
        </div>
        {/* O painel de números: cada um abre o catálogo filtrado */}
        {cursos.length ? (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Seus cursos">
            {hud.map((h) => (
              <li key={h.status}>
                <button
                  type="button"
                  onClick={() => abrirCatalogo({ status: h.status })}
                  className="inline-flex min-h-9 items-baseline gap-1.5 rounded-full border border-[var(--b-borda)] bg-white/[0.03] px-3 py-1 text-sm text-ink-2 backdrop-blur hover:border-[var(--b-borda-2)] hover:text-ink toque:min-h-11 toque:items-center"
                >
                  <span className="tabular font-display text-base font-semibold" style={h.cor ? { color: h.cor } : undefined}>
                    {h.n}
                  </span>
                  {h.rotulo}
                </button>
              </li>
            ))}
            <li className="sm:hidden">
              <BotaoFoco className="h-9 toque:h-11" />
            </li>
          </ul>
        ) : null}
      </header>

      {/* Busca nos cursos e nas anotações */}
      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Curso, área ou algo que você anotou"
          aria-label="Buscar nos cursos"
          className="h-12 w-full rounded-2xl border border-[var(--b-borda)] bg-white/[0.04] pl-11 pr-11 text-[16px] text-ink backdrop-blur placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:shadow-[0_0_0_3px_rgb(126_240_255/0.14),0_0_30px_-8px_var(--b-luz)] focus-visible:outline-none sm:text-[15px]"
        />
        {busca ? (
          <button type="button" aria-label="Limpar busca" onClick={() => setBusca("")} className="absolute right-2 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:text-ink">
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-8">
        {isLoading ? (
          <Carregando />
        ) : error ? (
          <ErroCarregar erro={error} aoTentar={() => void refetch()} />
        ) : !cursos.length ? (
          <SemCursos aoCriar={() => setNovo(true)} />
        ) : termo ? (
          <section aria-label="Resultados da busca">
            <Catalogo cursos={cursos} capas={capas} busca={termo} estado={estado} aoMudar={mudarFiltros} />
          </section>
        ) : visao === "todos" ? (
          <section aria-labelledby="titulo-catalogo">
            <button type="button" onClick={voltarAoInicio} className="-ml-2 mb-3 inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-sm text-ink-2 hover:text-ink">
              <ArrowLeft className="size-4" aria-hidden /> Início
            </button>
            <h2 id="titulo-catalogo" className="mb-4 font-display text-2xl font-semibold">
              Todos os cursos
            </h2>
            <Catalogo cursos={cursos} capas={capas} busca="" estado={estado} aoMudar={mudarFiltros} />
          </section>
        ) : (
          <div className="grid gap-12">
            <div className="grid gap-4">
              <EstudandoAgora
                cursos={grupos.em_andamento}
                capas={capas}
                aoAnotar={setAnotar}
                temFila={grupos.nao_comecou.length + grupos.pausado.length > 0}
                aoEscolher={() => abrirCatalogo({ status: grupos.pausado.length ? "pausado" : "nao_comecou" })}
              />
              <PainelPraticar itens={pendentes} />
            </div>
            <Fileira id="pausados" titulo="Pausados" descricao="Retome de onde parou" cursos={grupos.pausado} capas={capas} aoVerTudo={() => abrirCatalogo({ status: "pausado" })} />
            <Fileira id="fila" titulo="Na fila" descricao="Os próximos da sua trilha" cursos={grupos.nao_comecou} capas={capas} aoVerTudo={() => abrirCatalogo({ status: "nao_comecou" })} />
            <Fileira id="concluidos" titulo="Concluídos" descricao="Tudo o que você já terminou" cursos={grupos.concluido} capas={capas} aoVerTudo={() => abrirCatalogo({ status: "concluido" })} />
            <PainelCompetencias cursos={cursos} aoVerArea={(area) => abrirCatalogo({ categoria: area })} />
            <div className="flex justify-center">
              <Botao variante="contorno" tamanho="lg" className="bg-transparent" onClick={() => abrirCatalogo()}>
                <LayoutGrid /> Ver todos os cursos
              </Botao>
            </div>
          </div>
        )}
      </div>

      <JanelaCurso aberta={novo} aoMudar={setNovo} categorias={categorias} />
      <JanelaAula curso={anotar} aberta={Boolean(anotar)} aoMudar={(v) => !v && setAnotar(null)} />
    </div>
  )
}

function Carregando() {
  return (
    <div className="grid gap-10" aria-busy="true" aria-label="Carregando os cursos">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Esqueleto className="h-80 rounded-[1.25rem] bg-white/[0.05]" />
        <Esqueleto className="h-56 rounded-[1.25rem] bg-white/[0.05]" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="grid gap-3">
          <Esqueleto className="h-6 w-40 bg-white/[0.05]" />
          <div className="flex gap-4 overflow-hidden">
            {[0, 1, 2, 3].map((j) => (
              <Esqueleto key={j} className={cn("aspect-video w-[13.5rem] shrink-0 rounded-[0.875rem] bg-white/[0.05] sm:w-[15.5rem]")} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SemCursos({ aoCriar }: { aoCriar: () => void }) {
  return (
    <div className="vidro relative overflow-hidden px-6 py-12 text-center">
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-0 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--b-luz-2)]/25 blur-3xl" />
      <GraduationCap className="relative mx-auto size-9 text-[var(--b-luz)]" aria-hidden />
      <h2 className="relative mt-3 font-display text-2xl font-semibold">Sua plataforma está pronta</h2>
      <p className="relative mx-auto mt-1.5 max-w-md text-ink-2">
        Cadastre o curso que você está fazendo: o link da plataforma, as aulas que for anotando e o que vai colocar em prática ficam juntos aqui. Os cursos do Notion chegam por Configurações › Importar do Notion.
      </p>
      <Botao variante="primario" tamanho="lg" className="relative mt-6" onClick={aoCriar}>
        <Plus /> Adicionar curso
      </Botao>
    </div>
  )
}
