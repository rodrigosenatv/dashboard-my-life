"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import { ArrowLeft, Pencil, Quote, Star, Trash } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Carregando, Etiqueta, Progresso, Secao, Vazio } from "@/components/ui/basicos"
import { Confirmar } from "@/components/ui/janela"
import { EditorMarkdown } from "@/components/markdown"
import { novoId, useAtualizar, useCriar, useExcluir, useLista, useRegistro } from "@/lib/data"
import { STATUS_LIVRO } from "@/lib/rotulos"
import { formatar, porcentagem } from "@/lib/utils"
import { DialogoLivro } from "./dialogo-livro"

export function PaginaLivro() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: livro, isLoading } = useRegistro("books", id)
  const { data: insights = [] } = useLista("insights", { ordem: [{ coluna: "created_at", asc: false }] })
  const atualizar = useAtualizar("books")
  const excluir = useExcluir("books")
  const criarInsight = useCriar("insights")
  const excluirInsight = useExcluir("insights")
  const [editar, setEditar] = React.useState(false)
  const [apagar, setApagar] = React.useState(false)
  const [frase, setFrase] = React.useState("")

  if (isLoading) return <Carregando />
  if (!livro) return <Vazio titulo="Livro não encontrado." acao={<Link href="/estudos/leitura" className="text-sm text-pen">Voltar</Link>} />

  const p = porcentagem(livro.pages_read, livro.pages_total)
  const doLivro = insights.filter((i) => i.book_id === livro.id)

  return (
    <div className="max-w-3xl">
      <Link href="/estudos/leitura" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" /> Leitura</Link>
      <header className="mb-8">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-semibold leading-tight">{livro.title}</h1>
            <p className="mt-1 text-lg text-ink-2">{livro.author}</p>
          </div>
          <Botao variante="fantasma" tamanho="icone" aria-label={livro.favorite ? "Tirar dos favoritos" : "Favoritar"} onClick={() => atualizar.mutate({ id: livro.id, favorite: !livro.favorite })}>
            <Star className={livro.favorite ? "fill-estudos text-estudos" : ""} />
          </Botao>
          <Botao variante="contorno" tamanho="icone" aria-label="Editar" onClick={() => setEditar(true)}><Pencil /></Botao>
          <Botao variante="contorno" tamanho="icone" aria-label="Excluir" onClick={() => setApagar(true)}><Trash /></Botao>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <Etiqueta cor="estudos">{STATUS_LIVRO[livro.status as keyof typeof STATUS_LIVRO] ?? livro.status}</Etiqueta>
          {livro.category ? <Etiqueta>{livro.category}</Etiqueta> : null}
          {livro.rating ? <span className="text-estudos">{"★".repeat(livro.rating)}</span> : null}
          {livro.started_at ? <span>Início {formatar(livro.started_at, "d MMM yyyy")}</span> : null}
          {livro.finished_at ? <span>Término {formatar(livro.finished_at, "d MMM yyyy")}</span> : null}
        </div>
        {livro.pages_total ? (
          <div className="mt-4 flex max-w-md items-center gap-3">
            <Progresso valor={p} cor="estudos" rotulo="Progresso da leitura" />
            <span className="tabular shrink-0 text-sm text-ink-2">{livro.pages_read} de {livro.pages_total} páginas</span>
          </div>
        ) : null}
        {livro.summary ? <p className="mt-5 text-ink-2">{livro.summary}</p> : null}
      </header>

      <div className="grid gap-10">
        <Secao titulo="Insights do livro">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!frase.trim()) return
              criarInsight.mutate({ id: novoId(), text: frase.trim(), book_id: livro.id, source: "livro" })
              setFrase("")
            }}
            className="mb-4 flex gap-2"
          >
            <input value={frase} onChange={(e) => setFrase(e.target.value)} placeholder="Anote uma frase ou ideia" aria-label="Novo insight" className="h-9 flex-1 rounded-md border border-line-strong bg-surface px-3 text-sm focus-visible:border-pen focus-visible:outline-none" />
            <Botao type="submit" variante="primario" disabled={!frase.trim()}>Guardar</Botao>
          </form>
          {doLivro.length === 0 ? (
            <p className="text-sm text-ink-2">Nenhum insight ainda.</p>
          ) : (
            <ul className="grid gap-4">
              {doLivro.map((i) => (
                <li key={i.id} className="group flex gap-3">
                  <Quote className="mt-1 size-4 shrink-0 text-estudos" />
                  <p className="flex-1 font-display text-lg leading-snug">{i.text}</p>
                  <button type="button" onClick={() => excluirInsight.mutate(i.id)} className="text-xs text-ink-3 opacity-0 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100">Excluir</button>
                </li>
              ))}
            </ul>
          )}
        </Secao>
        <Secao titulo="Anotações">
          <EditorMarkdown rotulo="anotações do livro" valor={livro.notes ?? ""} aoSalvar={(v) => atualizar.mutate({ id: livro.id, notes: v || null })} />
        </Secao>
      </div>

      <DialogoLivro aberta={editar} aoMudar={setEditar} livro={livro} />
      <Confirmar aberta={apagar} aoMudar={setApagar} titulo={`Excluir “${livro.title}”?`} descricao="Os insights do livro também serão excluídos." aoConfirmar={() => { excluir.mutate(livro.id); router.push("/estudos/leitura") }} />
    </div>
  )
}
