"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import { ArrowLeft, Plus, Trash } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Vazio } from "@/components/ui/basicos"
import { EdicaoEmLinha, Entrada } from "@/components/ui/campos"
import { Confirmar } from "@/components/ui/janela"
import { EditorMarkdown } from "@/components/markdown"
import { novoId, useAtualizar, useCriar, useExcluir, useLista, useRegistro } from "@/lib/data"
import type { Json } from "@/lib/supabase/database.types"
import { BlocoColecao, Capa, esquema, opcoesDe, valorTexto, type Propriedade } from "./visao-colecao"

export function PaginaColecoes() {
  const { data: colecoes = [], isLoading } = useLista("collections", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  const { data: itens = [] } = useLista("collection_items", { colunas: "collection_id", chave: ["contagem"] })
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
  const atualizarCol = useAtualizar("collections")
  const excluirCol = useExcluir("collections")
  const [apagar, setApagar] = React.useState(false)

  if (isLoading) return <Carregando />
  if (!colecao) return <Vazio titulo="Coleção não encontrada." />

  return (
    <div>
      <Link href="/colecoes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" /> Coleções</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <EdicaoEmLinha rotulo="Nome da coleção" valor={colecao.name} aoSalvar={(v) => v && atualizarCol.mutate({ id: colecao.id, name: v })} className="max-w-xl font-display text-3xl font-semibold" />
        <Botao variante="fantasma" tamanho="icone" aria-label="Excluir coleção" onClick={() => setApagar(true)}><Trash /></Botao>
      </div>
      <BlocoColecao colecao={colecao} titulo="Itens" />
      <Confirmar aberta={apagar} aoMudar={setApagar} titulo={`Excluir a coleção “${colecao.name}”?`} descricao="Todos os itens dela também serão excluídos." aoConfirmar={() => { excluirCol.mutate(colecao.id); router.push("/colecoes") }} />
    </div>
  )
}

export function PaginaItem() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: item, isLoading } = useRegistro("collection_items", id)
  const { data: colecao } = useRegistro("collections", item?.collection_id)
  const { data: irmaos = [] } = useLista("collection_items", {
    filtro: (q) => q.eq("collection_id", item?.collection_id ?? ""),
    ordem: [{ coluna: "position" }, { coluna: "title" }],
    chave: ["de", item?.collection_id],
    enabled: Boolean(item?.collection_id),
  })
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
      {item.cover_path ? <div className="mb-6 overflow-hidden rounded-xl"><Capa caminho={item.cover_path} className="aspect-[3/1] max-h-72" /></div> : null}
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
                ) : p.type === "select" ? (
                  <select value={valorTexto(vals[p.name])} onChange={(e) => salvarProp(p.name, e.target.value, p.type)} aria-label={p.name} className="h-8 max-w-full rounded-md border border-line-strong bg-surface px-2 text-sm">
                    <option value="">Vazio</option>
                    {opcoesDe(p, irmaos).map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : p.type === "date" ? (
                  <input type="date" value={valorTexto(vals[p.name]).slice(0, 10)} onChange={(e) => salvarProp(p.name, e.target.value, p.type)} aria-label={p.name} className="h-8 rounded-md border border-line-strong bg-surface px-2 text-sm" />
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

