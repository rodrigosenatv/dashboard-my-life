"use client"

import * as React from "react"
import { ExternalLink, Pencil, Plus, Search } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Etiqueta, Segmentos, Vazio } from "@/components/ui/basicos"
import { AreaTexto, Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { novoId, useAtualizar, useCriar, useExcluir, useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { cn, contem, dominio, urlValida } from "@/lib/utils"

type Link_ = Tables<"bookmarks">
type Grupo = "ferramentas" | "favoritos" | "links"

const GRUPOS: Record<Grupo, { rotulo: string; descricao: string; tipo: string }> = {
  ferramentas: { rotulo: "Ferramentas", descricao: "Apps e serviços que você usa, por categoria.", tipo: "Categoria" },
  favoritos: { rotulo: "Sites favoritos", descricao: "Sites que você visita sempre.", tipo: "Tipo" },
  links: { rotulo: "Links", descricao: "Links externos do Planner de Conteúdo e outros.", tipo: "Tipo" },
}

/** Inicial colorida no lugar do ícone do site (sem chamar serviços de terceiros). */
function Inicial({ texto }: { texto: string }) {
  const letra = (texto.trim()[0] ?? "?").toUpperCase()
  const tons = ["bg-rotina-soft text-rotina", "bg-projetos-soft text-projetos", "bg-estudos-soft text-estudos", "bg-conteudo-soft text-conteudo", "bg-pen-soft text-pen"]
  const tom = tons[[...texto].reduce((s, c) => s + c.charCodeAt(0), 0) % tons.length]
  return <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-lg font-display text-base font-semibold", tom)}>{letra}</span>
}

function DialogoLink({ aberta, aoMudar, link, grupoInicial }: { aberta: boolean; aoMudar: (v: boolean) => void; link: Link_ | null; grupoInicial: Grupo }) {
  const criar = useCriar("bookmarks")
  const atualizar = useAtualizar("bookmarks")
  const excluir = useExcluir("bookmarks")
  const [titulo, setTitulo] = React.useState("")
  const [url, setUrl] = React.useState("")
  const [grupo, setGrupo] = React.useState<string>(grupoInicial)
  const [tipo, setTipo] = React.useState("")
  const [tags, setTags] = React.useState("")
  const [descricao, setDescricao] = React.useState("")

  React.useEffect(() => {
    if (!aberta) return
    setTitulo(link?.title ?? "")
    setUrl(link?.url ?? "")
    setGrupo(link?.collection ?? grupoInicial)
    setTipo(link?.kind ?? "")
    setTags(link?.tags.join(", ") ?? "")
    setDescricao(link?.description ?? "")
  }, [aberta, link, grupoInicial])

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim() && !url.trim()) return
    const campos = {
      title: titulo.trim() || dominio(url) || url.trim(),
      url: url.trim() || null,
      collection: grupo,
      kind: tipo.trim() || null,
      description: descricao.trim() || null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    }
    if (link) atualizar.mutate({ id: link.id, ...campos })
    else criar.mutate({ id: novoId(), position: Date.now() % 1_000_000, ...campos })
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={link ? "Editar link" : "Novo link"}
      rodape={
        <>
          {link ? (
            <Botao variante="fantasma" className="mr-auto text-danger hover:text-danger" onClick={() => { excluir.mutate(link.id); aoMudar(false) }}>
              Excluir
            </Botao>
          ) : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-link" disabled={!titulo.trim() && !url.trim()}>Salvar</Botao>
        </>
      }
    >
      <form id="form-link" className="grid gap-4" onSubmit={salvar}>
        <Campo rotulo="Endereço" htmlFor="lk-u"><Entrada id="lk-u" autoFocus={!link} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Campo>
        <Campo rotulo="Nome" htmlFor="lk-t"><Entrada id="lk-t" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={dominio(url) || "Ex.: Canva"} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Grupo" htmlFor="lk-g">
            <Seletor id="lk-g" value={grupo} onChange={(e) => setGrupo(e.target.value)}>
              {(Object.keys(GRUPOS) as Grupo[]).map((g) => <option key={g} value={g}>{GRUPOS[g].rotulo}</option>)}
            </Seletor>
          </Campo>
          <Campo rotulo={GRUPOS[grupo as Grupo]?.tipo ?? "Tipo"} htmlFor="lk-k"><Entrada id="lk-k" value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder={grupo === "ferramentas" ? "Ex.: Inteligência Artificial" : ""} /></Campo>
        </div>
        <Campo rotulo="Tags" htmlFor="lk-tags" dica="Separe por vírgula."><Entrada id="lk-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Ex.: Gratuito, Edição de vídeo" /></Campo>
        <Campo rotulo="Para que serve" htmlFor="lk-d"><AreaTexto id="lk-d" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Campo>
      </form>
    </Janela>
  )
}

function CartaoLink({ l, aoEditar }: { l: Link_; aoEditar: () => void }) {
  const u = urlValida(l.url)
  return (
    <li className="group relative flex gap-3 rounded-lg border border-line bg-surface p-3 hover:border-line-strong">
      <Inicial texto={l.title} />
      <div className="min-w-0 flex-1">
        {u ? (
          <a href={u} target="_blank" rel="noreferrer" className="block truncate pr-12 font-medium after:absolute after:inset-0 hover:underline">
            {l.title}
          </a>
        ) : (
          <p className="truncate pr-12 font-medium">{l.title}</p>
        )}
        <p className="truncate text-xs text-ink-3">{dominio(l.url)}</p>
        {l.description ? <p className="mt-1 line-clamp-2 text-sm text-ink-2">{l.description}</p> : null}
        {l.tags.length ? (
          <p className="mt-1.5 flex flex-wrap gap-1">
            {l.tags.slice(0, 4).map((t) => <Etiqueta key={t}>{t}</Etiqueta>)}
          </p>
        ) : null}
      </div>
      <div className="absolute right-2 top-2 z-10 flex gap-0.5">
        <button type="button" aria-label={`Editar ${l.title}`} onClick={aoEditar} className="rounded p-1.5 text-ink-3 opacity-100 hover:bg-surface-2 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
          <Pencil className="size-3.5" />
        </button>
        {u ? <ExternalLink aria-hidden className="m-1.5 size-3.5 text-ink-3" /> : null}
      </div>
    </li>
  )
}

export function PaginaLinks() {
  const { data: links = [], isLoading } = useLista("bookmarks", { ordem: [{ coluna: "position" }, { coluna: "title" }] })
  const [grupo, setGrupo] = React.useState<Grupo>("ferramentas")
  const [busca, setBusca] = React.useState("")
  const [tag, setTag] = React.useState("")
  const [dialogo, setDialogo] = React.useState<{ link: Link_ | null } | null>(null)

  React.useEffect(() => {
    // Abre na primeira aba que tiver algo
    if (links.length && !links.some((l) => l.collection === grupo)) {
      const primeira = (Object.keys(GRUPOS) as Grupo[]).find((g) => links.some((l) => l.collection === g))
      if (primeira) setGrupo(primeira)
    }
  }, [links, grupo])

  const doGrupo = links.filter((l) => l.collection === grupo)
  const tagsDoGrupo = [...new Set(doGrupo.flatMap((l) => l.tags))].sort((a, b) => a.localeCompare(b, "pt-BR"))
  const lista = (busca ? links : doGrupo).filter((l) => (!tag || busca || l.tags.includes(tag)) && contem(`${l.title} ${l.url ?? ""} ${l.kind ?? ""} ${l.description ?? ""} ${l.tags.join(" ")}`, busca))

  const porTipo = new Map<string, Link_[]>()
  for (const l of lista) {
    const chave = busca ? GRUPOS[l.collection as Grupo]?.rotulo ?? "Outros" : l.kind || "Sem categoria"
    porTipo.set(chave, [...(porTipo.get(chave) ?? []), l])
  }
  const secoes = [...porTipo.entries()].sort((a, b) => (a[0] === "Sem categoria" ? 1 : b[0] === "Sem categoria" ? -1 : a[0].localeCompare(b[0], "pt-BR")))

  return (
    <div>
      <Cabecalho titulo="Links úteis" descricao="Ferramentas, sites favoritos e links externos, num lugar só." acoes={<Botao variante="primario" onClick={() => setDialogo({ link: null })}><Plus /> Novo link</Botao>} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Segmentos
          rotulo="Grupo de links"
          valor={grupo}
          aoMudar={(g) => { setGrupo(g); setTag("") }}
          opcoes={(Object.keys(GRUPOS) as Grupo[]).map((g) => ({ valor: g, rotulo: GRUPOS[g].rotulo, contagem: links.filter((l) => l.collection === g).length }))}
        />
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar em todos os links" aria-label="Buscar links" className="h-9 w-full rounded-md border toque:h-11 toque:text-[16px] border-line-strong bg-surface pl-8 pr-3 text-sm focus-visible:border-pen focus-visible:outline-none" />
        </div>
      </div>

      {!busca && tagsDoGrupo.length > 1 ? (
        <div className="mb-6 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tag">
          {["", ...tagsDoGrupo].map((t) => (
            <button
              key={t || "todas"}
              type="button"
              aria-pressed={tag === t}
              onClick={() => setTag(t)}
              className={cn("rounded-full border px-2.5 py-0.5 text-xs toque:min-h-9 toque:px-3.5 toque:text-sm", tag === t ? "border-pen bg-pen/15 font-medium text-ink" : "border-line text-ink-2 hover:text-ink")}
            >
              {t || "Todas"}
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Vazio
          titulo={busca ? "Nenhum link com esse texto." : `Nenhum link em ${GRUPOS[grupo].rotulo}.`}
          descricao={busca ? undefined : GRUPOS[grupo].descricao}
          acao={busca ? undefined : <Botao variante="contorno" onClick={() => setDialogo({ link: null })}><Plus /> Adicionar</Botao>}
        />
      ) : (
        <div className="grid gap-10">
          {secoes.map(([titulo, itens]) => (
            <section key={titulo}>
              {secoes.length > 1 || busca ? (
                <h2 className="mb-3 font-display text-lg font-semibold">
                  {titulo} <span className="tabular text-sm font-normal text-ink-3">{itens.length}</span>
                </h2>
              ) : null}
              <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {itens.map((l) => <CartaoLink key={l.id} l={l} aoEditar={() => setDialogo({ link: l })} />)}
              </ul>
            </section>
          ))}
        </div>
      )}

      <DialogoLink aberta={Boolean(dialogo)} aoMudar={(v) => !v && setDialogo(null)} link={dialogo?.link ?? null} grupoInicial={grupo} />
    </div>
  )
}
