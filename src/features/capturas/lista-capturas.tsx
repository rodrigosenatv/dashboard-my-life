"use client"

import * as React from "react"
import { useAbrirDoEndereco } from "@/lib/abrir-do-endereco"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Archive, ArchiveRestore, ExternalLink, FolderKanban, Plus, Search } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Carregando, Etiqueta, Segmentos, Vazio } from "@/components/ui/basicos"
import { Seletor } from "@/components/ui/campos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuRotulo } from "@/components/ui/menu"
import { Markdown } from "@/components/markdown"
import { useAtualizar, useLista } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/database.types"
import { cn, contem, dominio, haQuanto, urlValida } from "@/lib/utils"
import { DialogoCaptura } from "./dialogo-captura"
import { previaTexto, semModeloNotion } from "./texto"

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
  const { data: projetos = [] } = useLista("projects", { colunas: "id,name,parent_id,archived,done", ordem: [{ coluna: "name" }] })
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

  const item = (c: Captura) => {
    const link = urlValida(c.url)
    const projetosC = projetosDe.get(c.id) ?? []
    const aberto = expandida === c.id
    const corpo = c.content ? semModeloNotion(c.content) : ""
    const previa = previaTexto(corpo)
    return (
      <li key={c.id} className="px-4 py-3">
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => setAberta(c)} className="min-w-0 flex-1 text-left">
            <p className="break-words font-medium leading-snug">{c.title || "Sem título"}</p>
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
          <div className="flex shrink-0 items-center gap-1">
            {link ? (
              <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs text-ink-2 hover:bg-surface-2 toque:min-h-11 toque:min-w-11" title={link}>
                <ExternalLink className="size-3.5" /> <span className="hidden sm:inline">{dominio(link)}</span>
              </a>
            ) : null}
            {!c.archived ? (
              <Menu>
                <MenuGatilho asChild>
                  <Botao variante="fantasma" tamanho="sm">Organizar</Botao>
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
              <Botao variante="fantasma" tamanho="sm" onClick={() => atualizar.mutate({ id: c.id, archived: false })}>
                <ArchiveRestore /> Restaurar
              </Botao>
            )}
          </div>
        </div>
        {corpo ? (
          <div className="mt-2">
            {aberto ? <Markdown texto={corpo} className="text-sm" /> : previa ? <p className="line-clamp-2 text-sm text-ink-2">{previa}</p> : null}
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
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {agrupamentos.length > 1 ? (
          <Segmentos rotulo="Agrupar" valor={agrupar} aoMudar={setAgrupar} opcoes={agrupamentos.map((a) => ({ valor: a, rotulo: ROTULO_AGRUPAR[a] }))} />
        ) : null}
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar" aria-label="Filtrar capturas" className="h-9 w-full rounded-md border toque:h-11 toque:text-[16px] border-line-strong bg-surface pl-8 pr-3 text-sm placeholder:text-ink-3 focus-visible:border-pen focus-visible:outline-none" />
        </div>
        {tipos.length > 1 && agrupar !== "tipo" ? (
          <Seletor aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-auto">
            <option value="">Todos os tipos</option>
            {tipos.map((t) => <option key={t}>{t}</option>)}
          </Seletor>
        ) : null}
        {categorias.length > 1 && agrupar !== "categoria" ? (
          <Seletor aria-label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-auto max-w-60">
            <option value="">Todas as categorias</option>
            {categorias.map((t) => <option key={t}>{t}</option>)}
          </Seletor>
        ) : null}
        <span className="tabular ml-auto text-sm text-ink-3">{lista.length === 1 ? "1 captura" : `${lista.length} capturas`}</span>
        <Botao variante="contorno" tamanho="sm" onClick={() => setNova(true)}>
          <Plus /> Nova captura
        </Botao>
      </div>

      {isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Vazio titulo={busca ? "Nenhuma captura encontrada." : VAZIOS[chaveVazio].titulo} descricao={busca ? undefined : VAZIOS[chaveVazio].descricao} />
      ) : (
        <div className="grid gap-8">
          {grupos.map((g) => {
            const limite = (agrupar === "nenhum" ? LOTE : LOTE_GRUPO) + (extras[chaveFiltro + g.titulo] ?? 0)
            const restam = g.itens.length - limite
            return (
            <section key={g.titulo || "todas"}>
              {g.titulo ? (
                <h2 className={cn("mb-2 flex items-baseline gap-2 font-display text-base font-semibold", agrupar === "mes" && "first-letter:uppercase")}>
                  {g.titulo}
                  <span className="tabular text-sm font-normal text-ink-3">{g.itens.length}</span>
                </h2>
              ) : null}
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">{g.itens.slice(0, limite).map(item)}</ul>
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
