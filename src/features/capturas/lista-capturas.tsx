"use client"

import * as React from "react"
import { useProjetosPorNome } from "@/features/projetos/dados"
import { useAbrirDoEndereco } from "@/lib/abrir-do-endereco"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Archive, ArchiveRestore, ExternalLink, FolderKanban, Plus, Search, X, SlidersHorizontal } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Carregando, Etiqueta, Segmentos, Vazio } from "@/components/ui/basicos"
import { Seletor } from "@/components/ui/campos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuRotulo } from "@/components/ui/menu"
import { MarkdownSobDemanda } from "@/components/markdown-sob-demanda"
import { useAtualizar, useLista } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/database.types"
import { cn, contem, dominio, haQuanto, urlValida } from "@/lib/utils"
import { DialogoCaptura } from "./dialogo-captura"
import { previaTexto } from "./texto"

export type Captura = Tables<"captures">

/**
 * Os filtros do PARA, iguais aos do Segundo Cérebro no Notion:
 * - entrada: sem área, sem projeto e sem tipo
 * - anotacoes: tudo que não está arquivado
 * - recursos: sem área e sem projeto, não arquivado
 * - arquivo: arquivado
 * - area: capturas de uma área
 */
export type ModoCapturas = "entrada" | "anotacoes" | "recursos" | "arquivo" | { area: string }

type Agrupar = "nenhum" | "tag" | "tipo" | "categoria" | "mes"

export function useVinculosCapturas() {
  const { data: vinculos = [] } = useLista("capture_projects", { colunas: "capture_id,project_id" })
  return React.useMemo(() => {
    const mapa = new Map<string, string[]>()
    for (const v of vinculos) mapa.set(v.capture_id, [...(mapa.get(v.capture_id) ?? []), v.project_id])
    return mapa
  }, [vinculos])
}

export function filtroModo(modo: ModoCapturas, projetosDe: Map<string, string[]>) {
  return (c: Captura) => {
    if (typeof modo === "object") return c.area_id === modo.area
    const solta = !c.area_id && !projetosDe.has(c.id)
    if (modo === "entrada") return !c.archived && solta && !c.kind
    if (modo === "recursos") return !c.archived && solta
    if (modo === "arquivo") return c.archived
    return !c.archived
  }
}

const LOTE = 20
const LOTE_GRUPO = 6

const VAZIOS: Record<string, { titulo: string; descricao?: string }> = {
  entrada: { titulo: "Caixa de entrada vazia.", descricao: "Tudo organizado. Use a captura rápida da página inicial para anotar ideias." },
  anotacoes: { titulo: "Nenhuma anotação ainda." },
  recursos: { titulo: "Nenhum recurso solto.", descricao: "Recursos são anotações sem projeto e sem área." },
  arquivo: { titulo: "Nada arquivado." },
  area: { titulo: "Nenhuma captura nesta área." },
}

export function ListaCapturas({ modo, agrupamentos = [] }: { modo: ModoCapturas; agrupamentos?: Agrupar[] }) {
  const qc = useQueryClient()
  const [busca, setBusca] = React.useState("")
  const [tipo, setTipo] = React.useState("")
  const [categoria, setCategoria] = React.useState("")
  const [agrupar, setAgrupar] = React.useState<Agrupar>(agrupamentos[0] ?? "nenhum")
  const [aberta, setAberta] = React.useState<Captura | null>(null)
  const [nova, setNova] = React.useState(false)
  const [expandida, setExpandida] = React.useState<string | null>(null)
  // Quantos cartões cada grupo mostra além do primeiro lote
  const [extras, setExtras] = React.useState<Record<string, number>>({})

  const { data: capturas = [], isLoading } = useLista("captures", { ordem: [{ coluna: "captured_at", asc: false }] })
  const projetosDe = useVinculosCapturas()
  const { data: projetos = [] } = useProjetosPorNome()
  const { data: areas = [] } = useLista("areas", { ordem: [{ coluna: "name" }] })
  const atualizar = useAtualizar("captures")

  useAbrirDoEndereco(capturas, setAberta)

  const nomeProjeto = new Map(projetos.map((p) => [p.id, p.name]))
  const nomeArea = new Map(areas.map((a) => [a.id, a.name]))
  const ativos = projetos.filter((p) => !p.archived && !p.done && !p.parent_id)
  const areasAtivas = areas.filter((a) => a.status !== "arquivada")

  const base = capturas.filter(filtroModo(modo, projetosDe))
  const lista = base.filter(
    (c) =>
      contem(`${c.title} ${c.content ?? ""} ${c.tags.join(" ")} ${c.url ?? ""}`, busca) &&
      (!tipo || c.kind === tipo) &&
      (!categoria || c.category === categoria),
  )
  const tipos = [...new Set(base.map((c) => c.kind).filter(Boolean))] as string[]
  const categorias = [...new Set(base.map((c) => c.category).filter(Boolean))] as string[]

  const grupos: { titulo: string; itens: Captura[] }[] = (() => {
    if (agrupar === "nenhum") return [{ titulo: "", itens: lista }]
    const mapa = new Map<string, Captura[]>()
    const por = (c: Captura): string[] => {
      if (agrupar === "tag") return c.tags.length ? c.tags : ["Sem tag"]
      if (agrupar === "tipo") return [c.kind || "Sem tipo"]
      if (agrupar === "categoria") return [c.category || "Sem categoria"]
      return [format(new Date(c.captured_at), "MMMM 'de' yyyy", { locale: ptBR })]
    }
    for (const c of lista) for (const k of por(c)) mapa.set(k, [...(mapa.get(k) ?? []), c])
    const chaves = [...mapa.keys()]
    if (agrupar !== "mes") chaves.sort((a, b) => (a.startsWith("Sem ") ? 1 : b.startsWith("Sem ") ? -1 : a.localeCompare(b)))
    return chaves.map((k) => ({ titulo: k, itens: mapa.get(k)! }))
  })()

  const ligar = async (captura: string, projeto: string) => {
    const { error } = await supabase().from("capture_projects").upsert({ capture_id: captura, project_id: projeto }, { onConflict: "capture_id,project_id", ignoreDuplicates: true })
    if (error) toast.error("Não foi possível ligar ao projeto.", { description: error.message })
    qc.invalidateQueries({ queryKey: ["capture_projects"] })
  }

  // Mudar a busca ou os filtros volta cada grupo ao primeiro lote
  const chaveFiltro = `${agrupar}|${busca}|${tipo}|${categoria}|`

  const ROTULO_AGRUPAR: Record<Agrupar, string> = { nenhum: "Lista", tag: "Por tag", tipo: "Por tipo", categoria: "Por categoria", mes: "Por mês" }
  const chaveVazio = typeof modo === "object" ? "area" : modo
  const haFiltros = Boolean(busca || tipo || categoria)
  const limparFiltros = () => { setBusca(""); setTipo(""); setCategoria(""); setExtras({}) }

  const item = (c: Captura) => {
    const link = urlValida(c.url)
    const projetosC = projetosDe.get(c.id) ?? []
    const aberto = expandida === c.id
    const corpo = c.content ?? ""
    const previa = previaTexto(corpo)
    return (
      <li key={c.id} className="group rounded-xl border border-line bg-surface px-4 py-4 transition-[border-color,background-color] hover:border-projetos/30 hover:bg-surface-2/40 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <button type="button" onClick={() => setAberta(c)} className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-offset-4">
            <p className="break-words text-[15px] font-semibold leading-snug transition-colors group-hover:text-projetos">{c.title || "Sem título"}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
              {c.kind ? <span>{c.kind}</span> : null}
              {c.category ? <span>{c.category}</span> : null}
              <span>{haQuanto(c.captured_at)}</span>
              {c.area_id && typeof modo !== "object" ? <Etiqueta cor="projetos">{nomeArea.get(c.area_id)}</Etiqueta> : null}
              {projetosC.map((p) => (
                <span key={p} className="inline-flex items-center gap-1">
                  <FolderKanban className="size-3" />
                  {nomeProjeto.get(p)}
                </span>
              ))}
              {agrupar !== "tag" ? c.tags.slice(0, 4).map((t) => <Etiqueta key={t}>{t}</Etiqueta>) : null}
            </p>
          </button>
          <div className="flex w-full shrink-0 items-center justify-end gap-2 border-t border-line pt-2 sm:w-auto sm:justify-start sm:border-0 sm:pt-0">
            {link ? (
              <a href={link} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md px-2 py-1 text-xs text-ink-2 hover:bg-surface-2 toque:min-h-11 toque:min-w-11" title={link}>
                <ExternalLink className="size-3.5" /> <span className="hidden sm:inline">{dominio(link)}</span>
              </a>
            ) : null}
            {!c.archived ? (
              <Menu>
                <MenuGatilho asChild>
                  <Botao variante="contorno" tamanho="sm" className="min-w-24">Organizar</Botao>
                </MenuGatilho>
                <MenuConteudo className="max-h-80 w-64 overflow-y-auto">
                  <MenuRotulo>Ligar a um projeto</MenuRotulo>
                  {ativos.length === 0 ? <MenuItem disabled>Nenhum projeto ativo</MenuItem> : null}
                  {ativos.map((p) => (
                    <MenuItem key={p.id} onSelect={() => ligar(c.id, p.id)}>{p.name}</MenuItem>
                  ))}
                  <MenuRotulo>Mover para a área</MenuRotulo>
                  {areasAtivas.map((a) => (
                    <MenuItem key={a.id} onSelect={() => atualizar.mutate({ id: c.id, area_id: a.id })}>{a.name}</MenuItem>
                  ))}
                  <MenuRotulo>Ou</MenuRotulo>
                  <MenuItem onSelect={() => atualizar.mutate({ id: c.id, archived: true })}>
                    <Archive /> Arquivar
                  </MenuItem>
                </MenuConteudo>
              </Menu>
            ) : (
              <Botao variante="contorno" tamanho="sm" disabled={atualizar.isPending} onClick={() => atualizar.mutate({ id: c.id, archived: false })}>
                <ArchiveRestore /> Restaurar
              </Botao>
            )}
          </div>
        </div>
        {corpo ? (
          <div className="mt-2 rounded-lg text-ink-2">
            {aberto ? <MarkdownSobDemanda texto={corpo} className="text-sm" /> : previa ? <p className="line-clamp-2 text-sm text-ink-2">{previa}</p> : null}
            {corpo.length > 160 || !previa ? (
              <button type="button" onClick={() => setExpandida(aberto ? null : c.id)} className="mt-1 text-xs font-medium text-pen toque:-mb-2 toque:mt-0 toque:py-3.5 toque:text-sm">
                {aberto ? "Mostrar menos" : "Ler tudo"}
              </button>
            ) : null}
          </div>
        ) : null}
      </li>
    )
  }

  return (
    <div>
      <div className="mb-5 rounded-2xl border border-line bg-surface p-3 sm:p-4">
        {agrupamentos.length > 1 ? (
          <div className="mb-3 min-w-0">
            <Segmentos className="w-full sm:w-auto" rotulo="Agrupar" valor={agrupar} aoMudar={(v) => { setAgrupar(v); setExtras({}) }} opcoes={agrupamentos.map((a) => ({ valor: a, rotulo: ROTULO_AGRUPAR[a] }))} />
          </div>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nas capturas…" aria-label="Buscar nas capturas" className="h-11 w-full rounded-xl border border-line-strong bg-bg/50 pl-10 pr-10 text-base placeholder:text-ink-3 focus-visible:border-projetos focus-visible:outline-none sm:text-sm" />
            {busca ? <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-ink-2 hover:text-ink"><X className="size-4" /></button> : null}
          </div>
          <Botao variante="primario" className="h-11 w-full sm:w-auto" onClick={() => setNova(true)}>
            <Plus /> Nova captura
          </Botao>
        </div>
        {(tipos.length > 1 || categorias.length > 1) ? (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <span className="hidden text-ink-3 sm:inline-flex"><SlidersHorizontal className="size-4" aria-hidden /></span>
            {tipos.length > 1 && agrupar !== "tipo" ? (
              <Seletor aria-label="Filtrar por tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full sm:w-auto sm:max-w-56">
                <option value="">Todos os tipos</option>
                {tipos.map((t) => <option key={t}>{t}</option>)}
              </Seletor>
            ) : null}
            {categorias.length > 1 && agrupar !== "categoria" ? (
              <Seletor aria-label="Filtrar por categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full sm:w-auto sm:max-w-60">
                <option value="">Todas as categorias</option>
                {categorias.map((t) => <option key={t}>{t}</option>)}
              </Seletor>
            ) : null}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <p aria-live="polite" className="tabular text-xs font-medium text-ink-2">{lista.length === 1 ? "1 captura" : `${lista.length} capturas`} {haFiltros ? "encontradas" : "no total"}</p>
          {haFiltros ? <button type="button" onClick={limparFiltros} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-projetos hover:bg-projetos-soft"><X className="size-3.5" /> Limpar filtros</button> : null}
        </div>
      </div>

      {isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Vazio className="rounded-2xl bg-surface p-7 sm:p-10" titulo={haFiltros ? "Nenhuma captura com esses filtros." : VAZIOS[chaveVazio].titulo} descricao={haFiltros ? "Experimente limpar os filtros ou usar outros termos." : VAZIOS[chaveVazio].descricao} acao={haFiltros ? <Botao variante="contorno" onClick={limparFiltros}>Limpar filtros</Botao> : <Botao variante="primario" onClick={() => setNova(true)}><Plus /> Nova captura</Botao>} />
      ) : (
        <div className="grid gap-8">
          {grupos.map((g) => {
            const limite = (agrupar === "nenhum" ? LOTE : LOTE_GRUPO) + (extras[chaveFiltro + g.titulo] ?? 0)
            const restam = g.itens.length - limite
            return (
            <section key={g.titulo || "todas"}>
              {g.titulo ? (
                <h2 className={cn("mb-3 flex flex-wrap items-center gap-2 font-display text-base font-semibold", agrupar === "mes" && "first-letter:uppercase")}>
                  {g.titulo}
                  <span className="tabular rounded-full bg-projetos-soft px-2 py-0.5 text-xs font-medium text-projetos">{g.itens.length}</span>
                </h2>
              ) : null}
              <ul className="grid gap-2">{g.itens.slice(0, limite).map(item)}</ul>
              {restam > 0 ? (
                <Botao
                  variante="contorno"
                  className="mt-3 w-full"
                  onClick={() => setExtras((e) => ({ ...e, [chaveFiltro + g.titulo]: (e[chaveFiltro + g.titulo] ?? 0) + LOTE }))}
                >
                  Mostrar mais {Math.min(LOTE, restam)} <span className="font-normal text-ink-3">de {restam} restantes</span>
                </Botao>
              ) : null}
            </section>
            )
          })}
        </div>
      )}

      <DialogoCaptura
        aberta={nova || Boolean(aberta)}
        aoMudar={(v) => {
          if (!v) {
            setNova(false)
            setAberta(null)
          }
        }}
        captura={aberta}
        areaInicial={typeof modo === "object" ? modo.area : undefined}
      />
    </div>
  )
}
