"use client"

import * as React from "react"
import { Botao } from "@/components/ui/button"
import { AreaTexto, Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { novoId, useAtualizar, useCriar } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { STATUS_LIVRO } from "@/lib/rotulos"

type Livro = Tables<"books">

export function DialogoLivro({ aberta, aoMudar, livro, statusInicial }: { aberta: boolean; aoMudar: (v: boolean) => void; livro?: Livro | null; statusInicial?: string }) {
  const criar = useCriar("books")
  const atualizar = useAtualizar("books")
  const [titulo, setTitulo] = React.useState("")
  const [autor, setAutor] = React.useState("")
  const [categoria, setCategoria] = React.useState("")
  const [status, setStatus] = React.useState("desejo")
  const [total, setTotal] = React.useState("")
  const [lidas, setLidas] = React.useState("")
  const [nota, setNota] = React.useState("")
  const [inicio, setInicio] = React.useState("")
  const [fim, setFim] = React.useState("")
  const [resumo, setResumo] = React.useState("")

  React.useEffect(() => {
    if (!aberta) return
    setTitulo(livro?.title ?? "")
    setAutor(livro?.author ?? "")
    setCategoria(livro?.category ?? "")
    setStatus(livro?.status ?? statusInicial ?? "desejo")
    setTotal(livro?.pages_total?.toString() ?? "")
    setLidas(livro?.pages_read?.toString() ?? "")
    setNota(livro?.rating?.toString() ?? "")
    setInicio(livro?.started_at ?? "")
    setFim(livro?.finished_at ?? "")
    setResumo(livro?.summary ?? "")
  }, [aberta, livro, statusInicial])

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) return
    const paginas = total ? Number(total) : null
    let lidasN = lidas ? Number(lidas) : 0
    if (status === "finalizado" && paginas) lidasN = paginas
    const campos = {
      title: titulo.trim(),
      author: autor.trim() || null,
      category: categoria.trim() || null,
      status,
      pages_total: paginas,
      pages_read: lidasN,
      rating: nota ? Number(nota) : null,
      started_at: inicio || null,
      finished_at: fim || (status === "finalizado" && !livro?.finished_at ? new Date().toISOString().slice(0, 10) : null),
      summary: resumo.trim() || null,
    }
    if (livro) atualizar.mutate({ id: livro.id, ...campos })
    else criar.mutate({ id: novoId(), ...campos })
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={livro ? "Editar livro" : "Adicionar livro"}
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-livro" disabled={!titulo.trim()}>{livro ? "Salvar" : "Adicionar"}</Botao>
        </>
      }
    >
      <form id="form-livro" onSubmit={salvar} className="grid gap-4">
        <Campo rotulo="Título" htmlFor="l-titulo">
          <Entrada id="l-titulo" autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Autor" htmlFor="l-autor"><Entrada id="l-autor" value={autor} onChange={(e) => setAutor(e.target.value)} /></Campo>
          <Campo rotulo="Categoria" htmlFor="l-cat"><Entrada id="l-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Produtividade" /></Campo>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo="Situação" htmlFor="l-status">
            <Seletor id="l-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(STATUS_LIVRO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </Seletor>
          </Campo>
          <Campo rotulo="Páginas" htmlFor="l-total"><Entrada id="l-total" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} /></Campo>
          <Campo rotulo="Já li" htmlFor="l-lidas"><Entrada id="l-lidas" inputMode="numeric" value={lidas} onChange={(e) => setLidas(e.target.value)} /></Campo>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo="Início" htmlFor="l-ini"><Entrada id="l-ini" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo>
          <Campo rotulo="Término" htmlFor="l-fim"><Entrada id="l-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></Campo>
          <Campo rotulo="Nota" htmlFor="l-nota">
            <Seletor id="l-nota" value={nota} onChange={(e) => setNota(e.target.value)}>
              <option value="">Sem nota</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
            </Seletor>
          </Campo>
        </div>
        <Campo rotulo="Resumo" htmlFor="l-resumo"><AreaTexto id="l-resumo" value={resumo} onChange={(e) => setResumo(e.target.value)} rows={3} /></Campo>
      </form>
    </Janela>
  )
}
