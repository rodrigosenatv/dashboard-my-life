"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import { ArrowLeft, Plus, Search, Trash } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Etiqueta, Segmentos, Vazio } from "@/components/ui/basicos"
import { EdicaoEmLinha, Entrada } from "@/components/ui/campos"
import { Confirmar } from "@/components/ui/janela"
import { EditorMarkdown, useUrlArquivo } from "@/components/markdown"
import { novoId, useAtualizar, useCriar, useExcluir, useLista, useRegistro } from "@/lib/data"
import type { Json, Tables } from "@/lib/supabase/database.types"
import { contem, formatar, urlValida } from "@/lib/utils"

type Colecao = Tables<"collections">
type Propriedade = { name: string; type: string; options?: string[] }

function esquema(c: Colecao | null | undefined): Propriedade[] {
  return Array.isArray(c?.schema) ? (c!.schema as unknown as Propriedade[]) : []
}

function valorTexto(v: Json | undefined): string {
  if (v === null || v === undefined) return ""
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ")
  if (typeof v === "boolean") return v ? "Sim" : "Não"
  return String(v)
}

function Valor({ prop, valor }: { prop: Propriedade; valor: Json | undefined }) {
  if (valor === null || valor === undefined || valor === "") return <span className="text-ink-3">–</span>
  if (prop.type === "checkbox") return <span>{valor ? "Sim" : "Não"}</span>
  if (prop.type === "date" && typeof valor === "string") return <span>{formatar(valor, "d MMM yyyy") || valor}</span>
  if ((prop.type === "multi_select" || Array.isArray(valor)) && Array.isArray(valor))
    return (
      <span className="flex flex-wrap gap-1">
        {valor.map((x) => <Etiqueta key={String(x)}>{String(x)}</Etiqueta>)}
      </span>
    )
  if (prop.type === "select") return <Etiqueta>{String(valor)}</Etiqueta>
  if (prop.type === "url") {
    const u = urlValida(String(valor))
    return u ? <a href={u} target="_blank" rel="noreferrer" className="text-pen hover:underline">{String(valor)}</a> : <span>{String(valor)}</span>
  }
  if (prop.type === "file" && typeof valor === "string" && valor.startsWith("arquivo://")) return <span className="text-ink-2">arquivo</span>
  return <span className="line-clamp-2">{valorTexto(valor)}</span>
}

function Capa({ caminho }: { caminho: string }) {
  const { data } = useUrlArquivo(caminho)
  // eslint-disable-next-line @next/next/no-img-element
  return data ? <img src={data} alt="" className="aspect-[4/3] w-full rounded-t-lg object-cover" /> : <div className="aspect-[4/3] animate-pulse rounded-t-lg bg-surface-2" />
}

export function PaginaColecoes() {
  const { data: colecoes = [], isLoading } = useLista("collections", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  const { data: itens = [] } = useLista("collection_items", { colunas: "id,collection_id", chave: ["contagem"] })
  const criar = useCriar("collections")
  const router = useRouter()
  const [nome, setNome] = React.useState("")
  const contagem = (id: string) => itens.filter((i) => i.collection_id === id).length

  return (
    <div>
      <Cabecalho titulo="Coleções" descricao="Listas que vieram do Notion e outras que você criar: filmes, treinos, viagens, guarda-roupa…" />
      {isLoading ? (
        <Carregando />
      ) : (
        <>
          {colecoes.length === 0 ? <Vazio titulo="Nenhuma coleção ainda." descricao="Ao importar o Notion, as listas que não têm tela própria aparecem aqui." className="mb-6" /> : null}
          <ul className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {colecoes.map((c) => (
              <li key={c.id}>
                <Link href={`/colecoes/${c.id}`} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3.5 hover:border-line-strong">
                  <span className="font-medium">{c.name}</span>
                  <span className="tabular text-sm text-ink-3">{contagem(c.id)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!nome.trim()) return
              const id = novoId()
              await criar.mutateAsync({ id, name: nome.trim(), schema: [{ name: "Status", type: "select" }, { name: "Notas", type: "text" }] })
              router.push(`/colecoes/${id}`)
            }}
            className="flex max-w-md gap-2"
          >
            <Entrada value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nova coleção" aria-label="Nova coleção" />
            <Botao type="submit" disabled={!nome.trim()}><Plus /> Criar</Botao>
          </form>
        </>
      )}
    </div>
  )
}

export function PaginaColecao() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: colecao, isLoading } = useRegistro("collections", id)
  const { data: itens = [] } = useLista("collection_items", { filtro: (q) => q.eq("collection_id", id), ordem: [{ coluna: "position" }, { coluna: "title" }], chave: ["de", id] })
  const criar = useCriar("collection_items")
  const atualizarCol = useAtualizar("collections")
  const excluirCol = useExcluir("collections")
  const [visao, setVisao] = React.useState<"tabela" | "galeria">("tabela")
  const [busca, setBusca] = React.useState("")
  const [apagar, setApagar] = React.useState(false)

  React.useEffect(() => {
    if (itens.some((i) => i.cover_path)) setVisao("galeria")
  }, [itens])

  if (isLoading) return <Carregando />
  if (!colecao) return <Vazio titulo="Coleção não encontrada." />
  const props = esquema(colecao).filter((p) => !["title", "relation", "rollup", "formula", "created_time", "last_edited_time", "button"].includes(p.type))
  const lista = itens.filter((i) => contem(`${i.title} ${JSON.stringify(i.props)}`, busca))

  const novo = async () => {
    const nid = novoId()
    await criar.mutateAsync({ id: nid, collection_id: colecao.id, title: "Novo item", position: Date.now() })
    router.push(`/colecoes/item/${nid}`)
  }

  return (
    <div>
      <Link href="/colecoes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" /> Coleções</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <EdicaoEmLinha rotulo="Nome da coleção" valor={colecao.name} aoSalvar={(v) => v && atualizarCol.mutate({ id: colecao.id, name: v })} className="max-w-xl font-display text-3xl font-semibold" />
        <div className="flex gap-2">
          <Botao variante="fantasma" tamanho="icone" aria-label="Excluir coleção" onClick={() => setApagar(true)}><Trash /></Botao>
          <Botao variante="primario" onClick={novo}><Plus /> Novo item</Botao>
        </div>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Segmentos rotulo="Visualização" valor={visao} aoMudar={setVisao} opcoes={[{ valor: "tabela", rotulo: "Tabela" }, { valor: "galeria", rotulo: "Galeria" }]} />
        <div className="relative min-w-48 max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar" aria-label="Filtrar itens" className="h-9 w-full rounded-md border border-line-strong bg-surface pl-8 pr-3 text-sm focus-visible:border-pen focus-visible:outline-none" />
        </div>
        <span className="tabular text-sm text-ink-3">{lista.length} itens</span>
      </div>
      {lista.length === 0 ? (
        <Vazio titulo="Nenhum item." />
      ) : visao === "tabela" ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th className="px-4 py-2 font-medium">Nome</th>
                {props.slice(0, 6).map((p) => <th key={p.name} className="whitespace-nowrap px-3 py-2 font-medium">{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {lista.map((i) => {
                const vals = (i.props ?? {}) as Record<string, Json>
                return (
                  <tr key={i.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                    <td className="px-4 py-2.5 font-medium"><Link href={`/colecoes/item/${i.id}`} className="hover:underline">{i.title || "Sem título"}</Link></td>
                    {props.slice(0, 6).map((p) => <td key={p.name} className="max-w-60 px-3 py-2.5 text-ink-2"><Valor prop={p} valor={vals[p.name]} /></td>)}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {lista.map((i) => {
            const vals = (i.props ?? {}) as Record<string, Json>
            return (
              <li key={i.id}>
                <Link href={`/colecoes/item/${i.id}`} className="block h-full rounded-lg border border-line bg-surface hover:border-line-strong">
                  {i.cover_path ? <Capa caminho={i.cover_path} /> : null}
                  <div className="p-3">
                    <p className="font-medium leading-snug">{i.title || "Sem título"}</p>
                    <div className="mt-1.5 grid gap-1 text-xs text-ink-2">
                      {props.slice(0, 2).map((p) => (vals[p.name] !== undefined && vals[p.name] !== null && vals[p.name] !== "" ? <Valor key={p.name} prop={p} valor={vals[p.name]} /> : null))}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <Confirmar aberta={apagar} aoMudar={setApagar} titulo={`Excluir a coleção “${colecao.name}”?`} descricao="Todos os itens dela também serão excluídos." aoConfirmar={() => { excluirCol.mutate(colecao.id); router.push("/colecoes") }} />
    </div>
  )
}

export function PaginaItem() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: item, isLoading } = useRegistro("collection_items", id)
  const { data: colecao } = useRegistro("collections", item?.collection_id)
  const atualizar = useAtualizar("collection_items")
  const excluir = useExcluir("collection_items")
  const [apagar, setApagar] = React.useState(false)

  if (isLoading) return <Carregando />
  if (!item) return <Vazio titulo="Item não encontrado." />
  const props = esquema(colecao).filter((p) => !["title", "rollup", "formula", "button"].includes(p.type))
  const vals = (item.props ?? {}) as Record<string, Json>
  const nomes = new Set(props.map((p) => p.name))
  const extras = Object.keys(vals).filter((k) => !nomes.has(k))
  const todas: Propriedade[] = [...props, ...extras.map((k) => ({ name: k, type: "text" }))]

  const salvarProp = (nome: string, valor: string, tipo: string) => {
    let v: Json = valor
    if (tipo === "multi_select") v = valor.split(",").map((s) => s.trim()).filter(Boolean)
    if (tipo === "number") v = valor === "" ? null : Number(valor.replace(",", "."))
    if (tipo === "checkbox") v = valor === "Sim"
    atualizar.mutate({ id: item.id, props: { ...vals, [nome]: v } })
  }

  return (
    <div className="max-w-3xl">
      <Link href={`/colecoes/${item.collection_id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" /> {colecao?.name ?? "Coleção"}</Link>
      {item.cover_path ? <div className="mb-6 overflow-hidden rounded-xl"><Capa caminho={item.cover_path} /></div> : null}
      <div className="mb-6 flex items-start gap-3">
        <EdicaoEmLinha rotulo="Título" valor={item.title} aoSalvar={(v) => atualizar.mutate({ id: item.id, title: v })} className="font-display text-3xl font-semibold" />
        <Botao variante="fantasma" tamanho="icone" aria-label="Excluir item" onClick={() => setApagar(true)}><Trash /></Botao>
      </div>
      {todas.length ? (
        <dl className="mb-8 grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
          {todas.map((p) => (
            <React.Fragment key={p.name}>
              <dt className="pt-1.5 text-sm text-ink-3">{p.name}</dt>
              <dd>
                {p.type === "checkbox" ? (
                  <select value={vals[p.name] ? "Sim" : "Não"} onChange={(e) => salvarProp(p.name, e.target.value, p.type)} className="h-8 rounded-md border border-line-strong bg-surface px-2 text-sm">
                    <option>Sim</option><option>Não</option>
                  </select>
                ) : (
                  <EdicaoEmLinha rotulo={p.name} valor={valorTexto(vals[p.name])} aoSalvar={(v) => salvarProp(p.name, v, p.type)} placeholder="Vazio" className="text-sm" />
                )}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      ) : null}
      <EditorMarkdown rotulo="conteúdo do item" valor={item.content ?? ""} aoSalvar={(v) => atualizar.mutate({ id: item.id, content: v || null })} />
      <Confirmar aberta={apagar} aoMudar={setApagar} titulo={`Excluir “${item.title}”?`} aoConfirmar={() => { excluir.mutate(item.id); router.push(`/colecoes/${item.collection_id}`) }} />
    </div>
  )
}

