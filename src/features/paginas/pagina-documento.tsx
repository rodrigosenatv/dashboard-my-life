"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { ChevronRight, Ellipsis, FileText, Play, Plus, Star, Trash, Video } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Carregando, Secao, Vazio } from "@/components/ui/basicos"
import { EdicaoEmLinha, Seletor } from "@/components/ui/campos"
import { Confirmar } from "@/components/ui/janela"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { EditorMarkdown } from "@/components/markdown"
import { useUrlArquivo } from "@/lib/arquivos"
import { novoId, useAtualizar, useCriar, useExcluir, useRegistro } from "@/lib/data"
import { cn, haQuanto, plural } from "@/lib/utils"
import { AdicionarVideo } from "@/features/videos/adicionar-video"
import { enderecoDoFeed, marcarVoltaDoFeed } from "@/features/videos/endereco"
import { extrairVideos, type ItemFeed } from "@/features/videos/logica"
import { ancestrais, filhosDe, SECOES, useArvorePaginas } from "./dados"
import { MolduraCerebro } from "@/features/segundo-cerebro/cabecalho"
import { MolduraEstudio } from "@/features/conteudo/moldura"
import { TituloEditavel } from "@/features/segundo-cerebro/ui"

/** As seções que aparecem em Páginas, no Segundo Cérebro: as páginas delas abrem com o tema da rede neural. */
const SECOES_CEREBRO = new Set(["notas", "recursos", "wiki", "geral", "arquivo"])
/** As da Biblioteca, do Planner e as conversas do assistente abrem com o tema do estúdio (Conteúdo e IA). */
const SECOES_ESTUDIO = new Set(["biblioteca", "planner", "assistente"])

function Capa({ caminho }: { caminho: string }) {
  const { data } = useUrlArquivo(caminho)
  if (!data) return <div className="mb-6 h-36 animate-pulse rounded-xl bg-surface-2" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={data} alt="" className="mb-6 h-40 w-full rounded-2xl object-cover sm:h-56" />
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
  const [adicionarVideo, setAdicionarVideo] = React.useState(false)
  // Os vídeos desta página, para assistir em sequência e para avisar de vídeo repetido
  const videos = React.useMemo<ItemFeed[]>(() => {
    if (!pagina) return []
    const titulo = pagina.title.trim() || "Sem título"
    return extrairVideos(pagina.content).map((v) => ({ ...v, paginaId: pagina.id, paginaTitulo: titulo, grupo: pagina.id, grupoTitulo: titulo }))
  }, [pagina])

  if (isLoading) return <Carregando linhas={6} />
  if (!pagina) return <Vazio titulo="Página não encontrada." acao={<Link href="/conteudo/biblioteca" className="text-sm font-medium text-pen">Ir para a biblioteca</Link>} />

  const caminho = ancestrais(arvore, pagina.id)
  const filhos = filhosDe(arvore, pagina.id)
  const voltar = pagina.section === "biblioteca" || pagina.section === "planner" ? "/conteudo/biblioteca" : pagina.section === "assistente" ? "/conteudo/assistente" : "/projetos/notas"
  const tema = SECOES_CEREBRO.has(pagina.section) ? "cerebro" : SECOES_ESTUDIO.has(pagina.section) ? "estudio" : null
  const futurista = tema !== null

  const subpagina = async () => {
    const nova = novoId()
    await criar.mutateAsync({ id: nova, title: "Nova página", parent_id: pagina.id, section: pagina.section, position: filhos.length + 1 })
    router.push(`/paginas/${nova}?editar=1`)
  }

  const artigo = (
    <article className="mx-auto min-w-0 max-w-3xl">
      <nav aria-label="Caminho" className="mb-5 flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap pb-2 text-sm text-ink-3 scrollbar-thin">
        <Link href={voltar} className="hover:text-ink">{SECOES[pagina.section] ?? "Páginas"}</Link>
        {caminho.map((p) => (
          <React.Fragment key={p.id}>
            <ChevronRight className="size-3.5" />
            <Link href={`/paginas/${p.id}`} className="max-w-40 shrink-0 truncate hover:text-ink sm:max-w-56">{p.title}</Link>
          </React.Fragment>
        ))}
      </nav>

      {pagina.cover_path ? <Capa caminho={pagina.cover_path} /> : null}

      <header className={cn("mb-6 flex flex-wrap items-start gap-2 p-4 sm:gap-3 sm:p-6", futurista ? "vidro relative overflow-hidden" : "rounded-2xl border border-line bg-surface")}>
        {futurista ? <span aria-hidden className="pointer-events-none absolute -left-16 -top-20 size-56 rounded-full bg-[var(--b-luz)]/15 blur-3xl" /> : null}
        <div className="relative min-w-0 flex-[1_1_100%] sm:flex-1">
          {futurista ? (
            <TituloEditavel rotulo="Renomear a página" valor={pagina.title} aoSalvar={(v) => atualizar.mutate({ id: pagina.id, title: v })} className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-3xl" />
          ) : (
            <EdicaoEmLinha rotulo="Título da página" valor={pagina.title} aoSalvar={(v) => atualizar.mutate({ id: pagina.id, title: v || "Sem título" })} className="break-words font-display text-[1.75rem] font-semibold leading-tight sm:text-3xl" />
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
            Editada {haQuanto(pagina.updated_at)}
            {videos.length > 1 ? (
              <Link
                href={enderecoDoFeed({ pagina: pagina.id })}
                onClick={marcarVoltaDoFeed}
                className="inline-flex items-center gap-1 rounded-sm font-medium text-pen hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen/40 toque:py-2 toque:text-sm"
              >
                <Play className="size-3.5 fill-current" aria-hidden /> Assistir {plural(videos.length, "vídeo")} em sequência
              </Link>
            ) : null}
          </p>
        </div>
        <Botao
          variante="fantasma"
          tamanho="icone"
          className={cn("relative", futurista && "rounded-full")}
          aria-label={pagina.favorite ? "Tirar dos favoritos" : "Favoritar"}
          aria-pressed={pagina.favorite}
          onClick={() => atualizar.mutate({ id: pagina.id, favorite: !pagina.favorite })}
        >
          <Star className={pagina.favorite ? "fill-estudos text-estudos" : ""} />
        </Botao>
        <Menu>
          <MenuGatilho asChild>
            <Botao variante="contorno" tamanho="icone" className={cn("relative", futurista && "rounded-full bg-transparent")} aria-label="Mais ações"><Ellipsis /></Botao>
          </MenuGatilho>
          <MenuConteudo className="w-60">
            <MenuItem onSelect={subpagina}><Plus /> Nova subpágina</MenuItem>
            <MenuItem onSelect={() => setAdicionarVideo(true)}><Video /> Adicionar vídeo</MenuItem>
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

      <div className={cn("min-h-52 px-4 py-5 sm:px-7 sm:py-7", futurista ? "vidro" : "rounded-2xl border border-line bg-surface")}>
        <EditorMarkdown
          key={pagina.id}
          rotulo="conteúdo da página"
          valor={pagina.content}
          inicioEditando={params.get("editar") === "1"}
          aoSalvar={(v) => atualizar.mutate({ id: pagina.id, content: v })}
        />
      </div>

      {filhos.length ? (
        <Secao titulo="Subpáginas" className="mt-10">
          <ul className="grid gap-2 sm:grid-cols-2">
            {filhos.map((f) => (
              <li key={f.id}>
                <Link href={`/paginas/${f.id}`} className={cn("flex min-h-12 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors", futurista ? "vidro-vivo rounded-xl hover:text-[var(--b-luz)]" : "rounded-xl border border-line bg-surface hover:border-projetos/40 hover:text-projetos")}>
                  <FileText className="size-4 shrink-0 text-ink-3" />
                  <span className="truncate">{f.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <AdicionarVideo
        aberta={adicionarVideo}
        aoMudar={setAdicionarVideo}
        destinos={[{ id: pagina.id, titulo: pagina.title.trim() || "Sem título", nivel: 0, hobby: null }]}
        paginaHobbies={null}
        arvore={arvore}
        existentes={videos}
      />

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

  if (tema === "cerebro") return <MolduraCerebro detalhe>{artigo}</MolduraCerebro>
  if (tema === "estudio") return <MolduraEstudio detalhe>{artigo}</MolduraEstudio>
  return artigo
}
