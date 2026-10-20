"use client"

import Link from "next/link"
import * as React from "react"
import { Pencil, Plus, Search } from "lucide-react"
import { FiltroChips } from "@/features/guarda-roupa/ui"
import { DialogoLink, Inicial } from "@/features/links/pagina-links"
import { Botao } from "@/components/ui/button"
import { Esqueleto, Etiqueta, Secao, Vazio } from "@/components/ui/basicos"
import { plural } from "@/lib/utils"
import {
  filtrarFerramentas,
  LIMITE_FERRAMENTAS,
  tagsMaisUsadas,
  useFerramentas,
  type Ferramenta,
  type LinkSalvo,
} from "./dados"

/** As ferramentas úteis, sem repetição: busca, filtro por tag e a janela de Links para adicionar ou editar. */
export function FerramentasUteis() {
  const { ferramentas, carregando } = useFerramentas()
  const [tag, setTag] = React.useState<string | null>(null)
  const [busca, setBusca] = React.useState("")
  const [todas, setTodas] = React.useState(false)
  const [dialogo, setDialogo] = React.useState<{ link: LinkSalvo | null } | null>(null)

  const tags = React.useMemo(() => tagsMaisUsadas(ferramentas), [ferramentas])
  // Tag escolhida que deixou de existir volta a "Todas"
  const tagAtiva = tag !== null && tags.some((t) => t.valor === tag) ? tag : null
  const lista = filtrarFerramentas(ferramentas, { tag: tagAtiva, busca })
  const filtrando = tagAtiva !== null || busca.trim() !== ""
  const visiveis = filtrando || todas ? lista : lista.slice(0, LIMITE_FERRAMENTAS)

  const novo = () => setDialogo({ link: null })
  const limpar = () => {
    setTag(null)
    setBusca("")
  }

  return (
    <Secao
      titulo="Ferramentas úteis"
      acao={
        <div className="flex items-center gap-3">
          <Botao variante="fantasma" tamanho="sm" onClick={novo}>
            <Plus aria-hidden /> Adicionar
          </Botao>
          <Link href="/links" className="text-sm text-ink-2 hover:text-ink toque:-my-3 toque:py-3">
            Ver em Links
          </Link>
        </div>
      }
    >
      {carregando ? (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Esqueleto key={i} className="h-24" />
          ))}
        </div>
      ) : ferramentas.length === 0 ? (
        <Vazio
          titulo="Nenhuma ferramenta salva."
          descricao="Guarde aqui os sites e apps que você usa para trabalhar."
          acao={
            <Botao variante="contorno" onClick={novo}>
              <Plus /> Adicionar ferramenta
            </Botao>
          }
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3">
            <div className="relative max-w-xs">
              <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input
                type="search"
                aria-label="Buscar ferramentas"
                placeholder="Buscar ferramenta"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-9 w-full rounded-md border border-line-strong bg-surface pl-8 pr-3 text-sm focus-visible:border-pen focus-visible:outline-none toque:h-11 toque:text-[16px]"
              />
            </div>
            {tags.length ? (
              <FiltroChips
                rotulo="Filtrar por tag"
                todos={{ rotulo: "Todas", n: ferramentas.length }}
                opcoes={tags}
                valor={tagAtiva}
                aoMudar={setTag}
              />
            ) : null}
          </div>

          <p className="mb-3 text-sm text-ink-3">
            {filtrando ? `${lista.length} de ${plural(ferramentas.length, "ferramenta")}` : plural(ferramentas.length, "ferramenta")}
          </p>

          {lista.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong px-5 py-6 text-sm">
              <p className="font-medium">Nenhuma ferramenta encontrada.</p>
              <button type="button" onClick={limpar} className="mt-2 text-pen hover:underline toque:min-h-11">
                Limpar filtros
              </button>
            </div>
          ) : (
            <ul aria-label="Ferramentas" className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {visiveis.map((f) => (
                <CartaoFerramenta key={f.id} f={f} aoEditar={() => setDialogo({ link: f.link })} />
              ))}
            </ul>
          )}

          {!filtrando && ferramentas.length > LIMITE_FERRAMENTAS ? (
            <Botao variante="contorno" tamanho="sm" className="mt-4" onClick={() => setTodas(!todas)}>
              {todas ? "Mostrar menos" : `Mostrar todas as ${ferramentas.length}`}
            </Botao>
          ) : null}
        </>
      )}

      <DialogoLink aberta={Boolean(dialogo)} aoMudar={(v) => !v && setDialogo(null)} link={dialogo?.link ?? null} grupoInicial="ferramentas" />
    </Secao>
  )
}

/** Um cartão: a inicial, o nome (com o link), o domínio, a descrição, as tags e o preço. */
function CartaoFerramenta({ f, aoEditar }: { f: Ferramenta; aoEditar: () => void }) {
  return (
    <li className="group relative flex gap-3 rounded-lg border border-line bg-surface p-3 hover:border-line-strong">
      <Inicial texto={f.nome} />
      <div className="min-w-0 flex-1">
        {f.url ? (
          <a href={f.url} target="_blank" rel="noreferrer" className="block truncate pr-9 font-medium after:absolute after:inset-0 hover:underline">
            {f.nome}
          </a>
        ) : (
          <p className="truncate pr-9 font-medium">{f.nome}</p>
        )}
        {f.url ? <p className="truncate text-xs text-ink-3">{f.dominio}</p> : <p className="text-xs text-ink-3">sem link</p>}
        {f.descricao ? <p className="mt-1 line-clamp-2 text-sm text-ink-2">{f.descricao}</p> : null}
        {f.tags.length || f.preco ? (
          <p className="mt-2 flex flex-wrap items-center gap-1">
            {f.tags.slice(0, 2).map((t) => (
              <Etiqueta key={t}>{t}</Etiqueta>
            ))}
            {f.preco ? <span className="text-xs text-ink-3">{f.preco}</span> : null}
          </p>
        ) : null}
      </div>
      <Botao
        variante="fantasma"
        tamanho="icone-sm"
        aria-label={`Editar ${f.nome}`}
        title="Editar"
        onClick={aoEditar}
        className="absolute right-1.5 top-1.5 z-10 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 toque:opacity-100"
      >
        <Pencil />
      </Botao>
    </li>
  )
}
