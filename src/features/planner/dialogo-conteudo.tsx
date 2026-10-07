"use client"

import * as React from "react"
import { Botao } from "@/components/ui/button"
import { AreaTexto, Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { novoId, useAtualizar, useCriar, useExcluir, useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { FORMATOS_CONTEUDO, STATUS_CONTEUDO } from "@/lib/rotulos"

type Conteudo = Tables<"content_items">

const PLATAFORMAS = ["Instagram", "YouTube", "TikTok", "LinkedIn", "WhatsApp", "Blog"]

function num(v: string): number | null {
  const n = Number(v.replace(/\./g, "").replace(",", "."))
  return v.trim() === "" || Number.isNaN(n) ? null : Math.round(n)
}

export function DialogoConteudo({
  aberta,
  aoMudar,
  item,
  statusInicial,
  dataInicial,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  item?: Conteudo | null
  statusInicial?: string
  dataInicial?: string
}) {
  const criar = useCriar("content_items")
  const atualizar = useAtualizar("content_items")
  const excluir = useExcluir("content_items")
  const { data: linhas = [] } = useLista("editorial_lines", { ordem: [{ coluna: "position" }, { coluna: "name" }] })

  const [titulo, setTitulo] = React.useState("")
  const [status, setStatus] = React.useState("ideia")
  const [formato, setFormato] = React.useState("")
  const [linha, setLinha] = React.useState("")
  const [plataformas, setPlataformas] = React.useState<string[]>([])
  const [data, setData] = React.useState("")
  const [roteiro, setRoteiro] = React.useState("")
  const [referencia, setReferencia] = React.useState("")
  const [publicado, setPublicado] = React.useState("")
  const [views, setViews] = React.useState("")
  const [likes, setLikes] = React.useState("")
  const [comentarios, setComentarios] = React.useState("")
  const [compart, setCompart] = React.useState("")

  React.useEffect(() => {
    if (!aberta) return
    setTitulo(item?.title ?? "")
    setStatus(item?.status ?? statusInicial ?? "ideia")
    setFormato(item?.format ?? "")
    setLinha(item?.editorial_line_id ?? "")
    setPlataformas(item?.platforms ?? [])
    setData(item?.publish_date ?? dataInicial ?? "")
    setRoteiro(item?.script ?? "")
    setReferencia(item?.reference_url ?? "")
    setPublicado(item?.published_url ?? item?.media_url ?? "")
    setViews(item?.views?.toString() ?? "")
    setLikes(item?.likes?.toString() ?? "")
    setComentarios(item?.comments?.toString() ?? "")
    setCompart(item?.shares?.toString() ?? "")
  }, [aberta, item, statusInicial, dataInicial])

  const alternar = (p: string) =>
    setPlataformas((atual) => (atual.includes(p) ? atual.filter((x) => x !== p) : [...atual, p]))

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) return
    const campos = {
      title: titulo.trim(),
      status,
      format: formato || null,
      editorial_line_id: linha || null,
      platforms: plataformas,
      publish_date: data || null,
      script: roteiro.trim() || null,
      reference_url: referencia.trim() || null,
      published_url: publicado.trim() || null,
      views: num(views),
      likes: num(likes),
      comments: num(comentarios),
      shares: num(compart),
    }
    if (item) atualizar.mutate({ id: item.id, ...campos })
    else criar.mutate({ id: novoId(), position: Date.now(), ...campos })
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      largura="lg"
      titulo={item ? "Editar conteúdo" : "Novo conteúdo"}
      rodape={
        <>
          {item ? (
            <Botao
              variante="fantasma"
              className="mr-auto text-danger hover:text-danger"
              onClick={() => {
                excluir.mutate(item.id)
                aoMudar(false)
              }}
            >
              Excluir
            </Botao>
          ) : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form="form-conteudo" disabled={!titulo.trim()}>
            {item ? "Salvar" : "Criar conteúdo"}
          </Botao>
        </>
      }
    >
      <form id="form-conteudo" onSubmit={salvar} className="grid gap-4">
        <Campo rotulo="Título ou gancho" htmlFor="ct-titulo">
          <Entrada id="ct-titulo" autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: 3 erros que reprovam no concurso" />
        </Campo>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Campo rotulo="Etapa" htmlFor="ct-status">
            <Seletor id="ct-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(STATUS_CONTEUDO).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </Seletor>
          </Campo>
          <Campo rotulo="Formato" htmlFor="ct-formato">
            <Seletor id="ct-formato" value={formato} onChange={(e) => setFormato(e.target.value)}>
              <option value="">Escolher</option>
              {FORMATOS_CONTEUDO.map((f) => (
                <option key={f}>{f}</option>
              ))}
              {formato && !(FORMATOS_CONTEUDO as readonly string[]).includes(formato) ? <option>{formato}</option> : null}
            </Seletor>
          </Campo>
          <Campo rotulo="Publicação" htmlFor="ct-data" className="col-span-2 sm:col-span-1">
            <Entrada id="ct-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="Linha editorial" htmlFor="ct-linha">
          <Seletor id="ct-linha" value={linha} onChange={(e) => setLinha(e.target.value)}>
            <option value="">Nenhuma</option>
            {linhas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Seletor>
        </Campo>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-ink-2">Plataformas</legend>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set([...PLATAFORMAS, ...plataformas])].map((p) => {
              const sel = plataformas.includes(p)
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => alternar(p)}
                  className={
                    sel
                      ? "rounded-full border border-conteudo bg-conteudo-soft px-3 py-1 text-sm font-medium text-conteudo"
                      : "rounded-full border border-line-strong px-3 py-1 text-sm text-ink-2 hover:text-ink"
                  }
                >
                  {p}
                </button>
              )
            })}
          </div>
        </fieldset>
        <Campo rotulo="Roteiro" htmlFor="ct-roteiro" dica="Aceita markdown.">
          <AreaTexto id="ct-roteiro" value={roteiro} onChange={(e) => setRoteiro(e.target.value)} rows={8} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Post de referência" htmlFor="ct-ref">
            <Entrada id="ct-ref" type="url" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="https://" />
          </Campo>
          <Campo rotulo="Link publicado" htmlFor="ct-pub">
            <Entrada id="ct-pub" type="url" value={publicado} onChange={(e) => setPublicado(e.target.value)} placeholder="https://" />
          </Campo>
        </div>
        {status === "publicado" || views || likes ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Campo rotulo="Visualizações" htmlFor="ct-v">
              <Entrada id="ct-v" inputMode="numeric" value={views} onChange={(e) => setViews(e.target.value)} />
            </Campo>
            <Campo rotulo="Curtidas" htmlFor="ct-l">
              <Entrada id="ct-l" inputMode="numeric" value={likes} onChange={(e) => setLikes(e.target.value)} />
            </Campo>
            <Campo rotulo="Comentários" htmlFor="ct-c">
              <Entrada id="ct-c" inputMode="numeric" value={comentarios} onChange={(e) => setComentarios(e.target.value)} />
            </Campo>
            <Campo rotulo="Compartilhamentos" htmlFor="ct-s">
              <Entrada id="ct-s" inputMode="numeric" value={compart} onChange={(e) => setCompart(e.target.value)} />
            </Campo>
          </div>
        ) : null}
      </form>
    </Janela>
  )
}
