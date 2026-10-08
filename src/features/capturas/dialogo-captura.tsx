"use client"

import * as React from "react"
import { Botao } from "@/components/ui/button"
import { AreaTexto, Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { novoId, useAtualizar, useCriar, useLista } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/database.types"
import { CATEGORIAS_CAPTURA, TIPOS_CAPTURA } from "@/lib/rotulos"
import { useQueryClient } from "@tanstack/react-query"

type Captura = Tables<"captures">

export function DialogoCaptura({
  aberta,
  aoMudar,
  captura,
  projetoInicial,
  areaInicial,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  captura?: Captura | null
  projetoInicial?: string
  areaInicial?: string
}) {
  const qc = useQueryClient()
  const criar = useCriar("captures")
  const atualizar = useAtualizar("captures")
  const { data: areas = [] } = useLista("areas", { colunas: "id,name,status", ordem: [{ coluna: "name" }] })
  const { data: projetos = [] } = useLista("projects", {
    colunas: "id,name,parent_id,archived,done",
    ordem: [{ coluna: "name" }],
  })

  const [titulo, setTitulo] = React.useState("")
  const [tipo, setTipo] = React.useState("Anotação")
  const [categoria, setCategoria] = React.useState("")
  const [link, setLink] = React.useState("")
  const [conteudo, setConteudo] = React.useState("")
  const [area, setArea] = React.useState("")
  const [projeto, setProjeto] = React.useState("")
  const [tags, setTags] = React.useState("")

  React.useEffect(() => {
    if (!aberta) return
    setTitulo(captura?.title ?? "")
    setTipo(captura?.kind ?? "Anotação")
    setCategoria(captura?.category ?? "")
    setLink(captura?.url ?? "")
    setConteudo(captura?.content ?? "")
    setArea(captura?.area_id ?? areaInicial ?? "")
    setTags((captura?.tags ?? []).join(", "))
    setProjeto(projetoInicial ?? "")
  }, [aberta, captura, projetoInicial, areaInicial])

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim() && !link.trim()) return
    const campos = {
      title: titulo.trim() || link.trim(),
      kind: tipo || null,
      category: categoria || null,
      url: link.trim() || null,
      content: conteudo.trim() || null,
      area_id: area || null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    }
    if (captura) {
      atualizar.mutate({ id: captura.id, ...campos })
    } else {
      const id = novoId()
      await criar.mutateAsync({ id, ...campos })
      if (projeto) {
        await supabase().from("capture_projects").insert({ capture_id: id, project_id: projeto })
        qc.invalidateQueries({ queryKey: ["capture_projects"] })
      }
    }
    aoMudar(false)
  }

  const ativos = projetos.filter((p) => !p.archived && !p.done)

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={captura ? "Editar captura" : "Nova captura"}
      descricao={captura ? undefined : "Anote agora e organize depois. Sem projeto nem área, ela fica na caixa de entrada."}
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form="form-captura" disabled={!titulo.trim() && !link.trim()}>
            {captura ? "Salvar" : "Capturar"}
          </Botao>
        </>
      }
    >
      <form id="form-captura" onSubmit={salvar} className="grid gap-4">
        <Campo rotulo="Título" htmlFor="c-titulo">
          <Entrada id="c-titulo" autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Ideia de ebook sobre concursos" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Tipo" htmlFor="c-tipo">
            <Seletor id="c-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_CAPTURA.map((t) => (
                <option key={t}>{t}</option>
              ))}
              {tipo && !(TIPOS_CAPTURA as readonly string[]).includes(tipo) ? <option>{tipo}</option> : null}
            </Seletor>
          </Campo>
          <Campo rotulo="Categoria" htmlFor="c-cat">
            <Seletor id="c-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Sem categoria</option>
              {CATEGORIAS_CAPTURA.map((t) => (
                <option key={t}>{t}</option>
              ))}
              {categoria && !(CATEGORIAS_CAPTURA as readonly string[]).includes(categoria) ? <option>{categoria}</option> : null}
            </Seletor>
          </Campo>
        </div>
        <Campo rotulo="Link" htmlFor="c-link">
          <Entrada id="c-link" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
        </Campo>
        <Campo rotulo="Anotação" htmlFor="c-conteudo" dica="Aceita markdown: **negrito**, listas com -, links.">
          <AreaTexto id="c-conteudo" value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={5} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Área" htmlFor="c-area">
            <Seletor id="c-area" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Nenhuma</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Seletor>
          </Campo>
          {captura ? null : (
            <Campo rotulo="Projeto" htmlFor="c-proj">
              <Seletor id="c-proj" value={projeto} onChange={(e) => setProjeto(e.target.value)}>
                <option value="">Nenhum</option>
                {ativos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Seletor>
            </Campo>
          )}
        </div>
        <Campo rotulo="Tags" htmlFor="c-tags" dica="Separe por vírgula.">
          <Entrada id="c-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Copy, Produtividade" />
        </Campo>
      </form>
    </Janela>
  )
}
