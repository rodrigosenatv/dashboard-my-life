"use client"

import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { ChevronRight, Ellipsis, FileText, Plus, Star, Trash } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Carregando, Secao, Vazio } from "@/components/ui/basicos"
import { EdicaoEmLinha, Seletor } from "@/components/ui/campos"
import { Confirmar } from "@/components/ui/janela"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { EditorMarkdown } from "@/components/markdown"
import { useUrlArquivo } from "@/lib/arquivos"
import { novoId, useAtualizar, useCriar, useExcluir, useRegistro } from "@/lib/data"
import { haQuanto } from "@/lib/utils"
import { ancestrais, filhosDe, SECOES, useArvorePaginas } from "./dados"

function Capa({ caminho }: { caminho: string }) {
  const { data } = useUrlArquivo(caminho)
  if (!data) return <div className="mb-6 h-36 animate-pulse rounded-xl bg-surface-2" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={data} alt="" className="mb-6 h-36 w-full rounded-xl object-cover sm:h-44" />
}

export function PaginaDocumento() {
  const { id } = useParams<{ id: string }>()
  const params = useSearchParams()
  const router = useRouter()
  const { data: pagina, isLoading } = useRegistro("pages", id)
  const { data: arvore = [] } = useArvorePaginas()
  const atualizar = useAtualizar("pages")
  const criar = useCriar("pages")
  const excluir = useExcluir("pages")
  const [apagar, setApagar] = React.useState(false)

  if (isLoading) return <Carregando linhas={6} />
  if (!pagina) return <Vazio titulo="Página não encontrada." acao={<Link href="/conteudo/biblioteca" className="text-sm font-medium text-pen">Ir para a biblioteca</Link>} />

  const caminho = ancestrais(arvore, pagina.id)
  const filhos = filhosDe(arvore, pagina.id)
  const voltar = pagina.section === "biblioteca" || pagina.section === "planner" ? "/conteudo/biblioteca" : "/projetos/notas"

  const subpagina = async () => {
    const nova = novoId()
    await criar.mutateAsync({ id: nova, title: "Nova página", parent_id: pagina.id, section: pagina.section, position: filhos.length + 1 })
    router.push(`/paginas/${nova}?editar=1`)
  }

  return (
    <article className="max-w-3xl">
      <nav aria-label="Caminho" className="mb-5 flex flex-wrap items-center gap-1 text-sm text-ink-3">
        <Link href={voltar} className="hover:text-ink">{SECOES[pagina.section] ?? "Páginas"}</Link>
        {caminho.map((p) => (
          <React.Fragment key={p.id}>
            <ChevronRight className="size-3.5" />
            <Link href={`/paginas/${p.id}`} className="max-w-48 truncate hover:text-ink">{p.title}</Link>
          </React.Fragment>
        ))}
      </nav>

      {pagina.cover_path ? <Capa caminho={pagina.cover_path} /> : null}

      <header className="mb-6 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <EdicaoEmLinha rotulo="Título da página" valor={pagina.title} aoSalvar={(v) => atualizar.mutate({ id: pagina.id, title: v || "Sem título" })} className="font-display text-3xl font-semibold" />
          <p className="mt-1 text-xs text-ink-3">Editada {haQuanto(pagina.updated_at)}</p>
        </div>
        <Botao
          variante="fantasma"
          tamanho="icone"
          aria-label={pagina.favorite ? "Tirar dos favoritos" : "Favoritar"}
          aria-pressed={pagina.favorite}
          onClick={() => atualizar.mutate({ id: pagina.id, favorite: !pagina.favorite })}
        >
          <Star className={pagina.favorite ? "fill-estudos text-estudos" : ""} />
        </Botao>
        <Menu>
          <MenuGatilho asChild>
            <Botao variante="contorno" tamanho="icone" aria-label="Mais ações"><Ellipsis /></Botao>
          </MenuGatilho>
          <MenuConteudo className="w-60">
            <MenuItem onSelect={subpagina}><Plus /> Nova subpágina</MenuItem>
            <div className="px-2.5 py-1.5">
              <label className="mb-1 block text-xs text-ink-3" htmlFor="secao-pagina">Mostrar em</label>
              <Seletor id="secao-pagina" className="h-8" value={pagina.section} onChange={(e) => atualizar.mutate({ id: pagina.id, section: e.target.value })}>
                {Object.entries(SECOES).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </Seletor>
            </div>
            <MenuSeparador />
            <MenuItem perigo onSelect={() => setApagar(true)}><Trash /> Excluir página</MenuItem>
          </MenuConteudo>
        </Menu>
      </header>

      <EditorMarkdown
        key={pagina.id}
        rotulo="conteúdo da página"
        valor={pagina.content}
        inicioEditando={params.get("editar") === "1"}
        aoSalvar={(v) => atualizar.mutate({ id: pagina.id, content: v })}
      />

      {filhos.length ? (
        <Secao titulo="Subpáginas" className="mt-12">
          <ul className="grid gap-1 sm:grid-cols-2">
            {filhos.map((f) => (
              <li key={f.id}>
                <Link href={`/paginas/${f.id}`} className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2.5 text-sm hover:border-line-strong">
                  <FileText className="size-4 shrink-0 text-ink-3" />
                  <span className="truncate">{f.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <Confirmar
        aberta={apagar}
        aoMudar={setApagar}
        titulo={`Excluir “${pagina.title}”?`}
        descricao={filhos.length ? "As subpáginas também serão excluídas." : undefined}
        aoConfirmar={() => {
          excluir.mutate(pagina.id)
          router.push(caminho.length ? `/paginas/${caminho[caminho.length - 1].id}` : voltar)
        }}
      />
    </article>
  )
}
