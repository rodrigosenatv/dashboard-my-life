"use client"

import * as React from "react"
import { ExternalLink, Plus, Search, Trash } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Etiqueta, Vazio } from "@/components/ui/basicos"
import { Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { novoId, useCriar, useExcluir, useLista } from "@/lib/data"
import { contem, dominio, urlValida } from "@/lib/utils"

const GRUPOS = { ferramentas: "Ferramentas", favoritos: "Sites favoritos", links: "Links" } as const

export function PaginaLinks() {
  const { data: links = [], isLoading } = useLista("bookmarks", { ordem: [{ coluna: "position" }, { coluna: "title" }] })
  const criar = useCriar("bookmarks")
  const excluir = useExcluir("bookmarks")
  const [busca, setBusca] = React.useState("")
  const [novo, setNovo] = React.useState(false)
  const [titulo, setTitulo] = React.useState("")
  const [url, setUrl] = React.useState("")
  const [grupo, setGrupo] = React.useState("favoritos")
  const [tags, setTags] = React.useState("")

  const lista = links.filter((l) => contem(`${l.title} ${l.url ?? ""} ${l.tags.join(" ")}`, busca))

  return (
    <div>
      <Cabecalho titulo="Links úteis" descricao="Ferramentas, sites e atalhos que você usa." acoes={<Botao variante="primario" onClick={() => setNovo(true)}><Plus /> Novo link</Botao>} />
      <div className="relative mb-8 max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar" aria-label="Filtrar links" className="h-9 w-full rounded-md border border-line-strong bg-surface pl-8 pr-3 text-sm focus-visible:border-pen focus-visible:outline-none" />
      </div>
      {isLoading ? <Carregando /> : links.length === 0 ? <Vazio titulo="Nenhum link salvo." /> : (
        <div className="grid gap-10">
          {(Object.keys(GRUPOS) as (keyof typeof GRUPOS)[]).map((g) => {
            const itens = lista.filter((l) => l.collection === g)
            if (!itens.length) return null
            return (
              <section key={g}>
                <h2 className="mb-3 font-display text-lg font-semibold">{GRUPOS[g]}</h2>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {itens.map((l) => {
                    const u = urlValida(l.url)
                    return (
                      <li key={l.id} className="group flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          {u ? <a href={u} target="_blank" rel="noreferrer" className="block truncate font-medium hover:underline">{l.title}</a> : <p className="truncate font-medium">{l.title}</p>}
                          <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                            {dominio(l.url)}
                            {l.kind ? <span>{l.kind}</span> : null}
                            {l.tags.slice(0, 3).map((t) => <Etiqueta key={t}>{t}</Etiqueta>)}
                          </p>
                        </div>
                        {u ? <a href={u} target="_blank" rel="noreferrer" aria-label={`Abrir ${l.title}`} className="text-ink-3 hover:text-ink"><ExternalLink className="size-4" /></a> : null}
                        <button type="button" aria-label={`Excluir ${l.title}`} onClick={() => excluir.mutate(l.id)} className="text-ink-3 opacity-0 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"><Trash className="size-4" /></button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
      <Janela
        aberta={novo}
        aoMudar={setNovo}
        titulo="Novo link"
        rodape={<><Botao variante="fantasma" onClick={() => setNovo(false)}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-link" disabled={!titulo.trim()}>Salvar</Botao></>}
      >
        <form
          id="form-link"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            criar.mutate({ id: novoId(), title: titulo.trim(), url: url.trim() || null, collection: grupo, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) })
            setTitulo(""); setUrl(""); setTags(""); setNovo(false)
          }}
        >
          <Campo rotulo="Nome" htmlFor="lk-t"><Entrada id="lk-t" autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Campo>
          <Campo rotulo="Endereço" htmlFor="lk-u"><Entrada id="lk-u" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Grupo" htmlFor="lk-g"><Seletor id="lk-g" value={grupo} onChange={(e) => setGrupo(e.target.value)}>{Object.entries(GRUPOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</Seletor></Campo>
            <Campo rotulo="Tags" htmlFor="lk-tags"><Entrada id="lk-tags" value={tags} onChange={(e) => setTags(e.target.value)} /></Campo>
          </div>
        </form>
      </Janela>
    </div>
  )
}
