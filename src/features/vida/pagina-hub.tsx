"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import { ExternalLink, FileText, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Secao, Vazio } from "@/components/ui/basicos"
import { Markdown } from "@/components/markdown"
import { Pomodoro } from "@/components/pomodoro"
import { novoId, useCriar, useLista, useRegistro } from "@/lib/data"
import { cn, normalizar } from "@/lib/utils"
import { BlocoColecao, type Colecao } from "@/features/colecoes/visao-colecao"
import { AgendaProxima, TarefasHoje } from "@/features/hoje/hoje"
import { contarDescendentes, filhosDe, useArvorePaginas } from "@/features/paginas/dados"
import { HUBS, hubPorSlug, type BlocoBanco, type Hub } from "./hubs"

const semPrefixo = (nome: string) => normalizar(nome.replace(/^database:?\s*/i, ""))

/** A página importada do Notion com o título do hub (prefere as de primeiro nível). */
function usePaginaDoHub(hub: Hub | undefined) {
  const { data: paginas = [], isLoading } = useArvorePaginas()
  const pagina = React.useMemo(() => {
    if (!hub) return null
    const titulos = hub.paginas.map(normalizar)
    return [...paginas].sort((a, b) => Number(Boolean(a.parent_id)) - Number(Boolean(b.parent_id))).find((p) => titulos.includes(normalizar(p.title))) ?? null
  }, [paginas, hub])
  return { pagina, paginas, isLoading }
}

function Ferramentas() {
  const { data: links = [] } = useLista("bookmarks", { filtro: (q) => q.eq("collection", "ferramentas"), ordem: [{ coluna: "position" }], chave: ["ferramentas-flow"] })
  return (
    <Secao titulo="Ferramentas úteis" acao={<Link href="/links" className="text-sm text-ink-2 hover:text-ink">Todos os links</Link>}>
      {links.length ? (
        <ul className="grid gap-1 sm:grid-cols-2">
          {links.map((l) => (
            <li key={l.id}>
              <a href={l.url ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                <ExternalLink className="size-4 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1 truncate">{l.title}</span>
                {l.tags?.[0] ? <span className="shrink-0 text-xs text-ink-3">{l.tags[0]}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-2">Nenhuma ferramenta salva. Adicione em Links úteis, na coleção Ferramentas.</p>
      )}
    </Secao>
  )
}

function Subpaginas({ paiId }: { paiId: string }) {
  const { data: paginas = [] } = useArvorePaginas()
  const filhos = filhosDe(paginas, paiId)
  if (!filhos.length) return null
  return (
    <Secao titulo="Páginas">
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filhos.map((p) => {
          const n = contarDescendentes(paginas, p.id)
          return (
            <li key={p.id}>
              <Link href={`/paginas/${p.id}`} className="flex h-full items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-3 hover:border-line-strong">
                {p.icon && !p.icon.startsWith("/") && p.icon.length <= 4 ? <span className="w-5 text-center">{p.icon}</span> : <FileText className="size-4 shrink-0 text-ink-3" />}
                <span className="min-w-0 flex-1 truncate font-medium">{p.title || "Sem título"}</span>
                {n ? <span className="tabular text-xs text-ink-3">{n}</span> : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </Secao>
  )
}

/** Texto da página do Notion, sem as linhas que só apontavam para os bancos. */
function TextoDaPagina({ id }: { id: string }) {
  const { data: pagina } = useRegistro("pages", id)
  const texto = (pagina?.content ?? "")
    .split("\n")
    .filter((l) => !/^\s*\[?[^\]]*\]\([^)]*\.(csv|md)\)\s*$/i.test(l) && !/^\s*(database:|banco de dados)/i.test(l.replace(/[*#_]/g, "").trim()))
    .join("\n")
    .trim()
  if (texto.replace(/[\s\-*#>_|]/g, "").length < 30) return null
  return (
    <Secao
      titulo="Anotações da página"
      acao={
        <Link href={`/paginas/${id}?editar=1`} className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
          <Pencil className="size-3.5" /> Editar
        </Link>
      }
    >
      <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
        <Markdown texto={texto} />
      </div>
    </Secao>
  )
}

export function PaginaHub() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const hub = hubPorSlug(slug)
  const { pagina, isLoading: carregandoPaginas } = usePaginaDoHub(hub)
  const { data: colecoes = [], isLoading } = useLista("collections", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  const criarColecao = useCriar("collections")
  const criarPagina = useCriar("pages")

  if (!hub) return <Vazio titulo="Página não encontrada." />
  if (isLoading || carregandoPaginas) return <Carregando />

  const acharColecao = (b: BlocoBanco): Colecao | undefined => {
    const nomes = b.nomes.map(normalizar)
    const candidatas = colecoes.filter((c) => nomes.includes(semPrefixo(c.name)))
    // Se houver duas com o mesmo nome, prefere a que veio da página deste hub
    const daPagina = candidatas.find((c) => hub.paginas.some((t) => normalizar(c.description ?? "").includes(normalizar(t))))
    return daPagina ?? candidatas[0]
  }

  const usadas = new Set<string>()
  const blocosBanco = hub.blocos.filter((b): b is BlocoBanco => b.tipo === "colecao")
  for (const b of blocosBanco) {
    const c = acharColecao(b)
    if (c) usadas.add(c.id)
  }
  // Outros bancos que moravam nesta página do Notion
  const extras = colecoes.filter((c) => !usadas.has(c.id) && hub.paginas.some((t) => normalizar(c.description ?? "").split("›").map((s) => s.trim()).includes(normalizar(t))))
  const faltando = blocosBanco.filter((b) => !acharColecao(b))

  const criarBanco = async (b: BlocoBanco) => {
    const id = novoId()
    try {
      await criarColecao.mutateAsync({ id, name: b.nomes[0], description: `Notion › ${hub.paginas[0]}`, schema: [{ name: "Status", type: "select" }, { name: "Data", type: "date" }, { name: "Notas", type: "text" }] })
      toast.success(`${b.titulo ?? b.nomes[0]} criado.`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const abrirPagina = async () => {
    if (pagina) return router.push(`/paginas/${pagina.id}`)
    const id = novoId()
    await criarPagina.mutateAsync({ id, title: hub.paginas[0], section: "geral", content: "" })
    router.push(`/paginas/${id}?editar=1`)
  }

  const Icone = hub.icone

  return (
    <div>
      <Cabecalho
        area="geral"
        titulo={hub.titulo}
        descricao={hub.descricao}
        acoes={
          <Botao variante="contorno" onClick={abrirPagina}>
            <FileText /> {pagina ? "Abrir página" : "Criar página"}
          </Botao>
        }
      />
      <nav aria-label="Vida pessoal" className="mb-8 hidden flex-wrap gap-1.5 lg:flex">
        {HUBS.map((h) => {
          const I = h.icone
          return (
            <Link
              key={h.slug}
              href={`/vida/${h.slug}`}
              aria-current={h.slug === hub.slug ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                h.slug === hub.slug ? "border-petroleo-borda bg-petroleo text-petroleo-tinta" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
              )}
            >
              <I className="size-4" /> {h.titulo}
            </Link>
          )
        })}
      </nav>

      <div className="grid gap-x-8 gap-y-12 lg:grid-cols-2">
        {hub.blocos.map((b, i) => {
          if (b.tipo === "colecao") {
            const c = acharColecao(b)
            if (!c) return null
            return <BlocoColecao key={i} colecao={c} titulo={b.titulo} abas={b.abas} visaoInicial={b.visao} marcar={b.marcar} limite={b.limite} className={b.largo ? "lg:col-span-2" : undefined} />
          }
          if (b.tipo === "hoje")
            return (
              <div key={i} className="grid gap-10">
                <TarefasHoje />
                <AgendaProxima />
              </div>
            )
          if (b.tipo === "pomodoro") return <Pomodoro key={i} className="self-start" />
          if (b.tipo === "ferramentas")
            return (
              <div key={i} className="lg:col-span-2">
                <Ferramentas />
              </div>
            )
          if (b.tipo === "subpaginas")
            return pagina ? (
              <div key={i} className="lg:col-span-2">
                <Subpaginas paiId={pagina.id} />
              </div>
            ) : null
          if (b.tipo === "texto")
            return pagina ? (
              <div key={i} className="lg:col-span-2">
                <TextoDaPagina id={pagina.id} />
              </div>
            ) : null
          return null
        })}
        {extras.map((c) => (
          <BlocoColecao key={c.id} colecao={c} />
        ))}
      </div>

      {faltando.length ? (
        <div className="mt-12 rounded-lg border border-dashed border-line p-5">
          <p className="flex items-center gap-2 font-medium">
            <Icone className="size-4 text-ink-3" /> Ainda não há dados de {faltando.map((b) => (b.titulo ?? b.nomes[0]).toLowerCase()).join(", ")}
          </p>
          <p className="mt-1 text-sm text-ink-2">Eles aparecem aqui quando você importar o Notion de novo. Se preferir, comece agora uma lista vazia.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {faltando.map((b) => (
              <Botao key={b.nomes[0]} variante="contorno" tamanho="sm" onClick={() => criarBanco(b)}>
                <Plus /> {b.titulo ?? b.nomes[0]}
              </Botao>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
