"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import { useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { ChevronDown, ChevronUp, Ellipsis, ExternalLink, FileText, Loader2, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { LARGURA_INSTAGRAM, TelaFacebook, TelaInstagram, alturaEstimadaInstagram } from "@/components/midia"
import { PREFIXO_ARQUIVO, useUrlArquivo } from "@/lib/arquivos"
import { useNaTela } from "@/lib/na-tela"
import { cn, plural } from "@/lib/utils"
import { enderecoDoPlayer, linkDoVideo, NOME_DA_FONTE, type ArquivoDeMidia } from "@/lib/videos"
import { miniaturaYoutube } from "@/lib/youtube"
import { AdicionarVideo } from "./adicionar-video"
import { ErroAoLerPagina, useFeed, useGravarVideos } from "./dados"
import { CHAVE_VOLTA_DO_FEED } from "./endereco"
import type { ItemFeed } from "./logica"

const CHAVE_VOLTA = CHAVE_VOLTA_DO_FEED
const CHAVE_DICA = "feed:dica-arrastar"

// Caixas do player que cabem na área do vídeo (a área é um "container" de tamanho)
const EM_PE = "aspect-[9/16] w-[min(100cqw,calc(100cqh*9/16))]"
const DEITADO = "aspect-video w-[min(100cqw,calc(100cqh*16/9))]"

function useTamanho() {
  const [tamanho, setTamanho] = React.useState<{ largura: number; altura: number } | null>(null)
  const ref = React.useCallback((el: HTMLElement | null) => {
    if (!el) return
    const medir = () => {
      const r = el.getBoundingClientRect()
      setTamanho((t) => (t && Math.abs(t.largura - r.width) < 1 && Math.abs(t.altura - r.height) < 1 ? t : { largura: r.width, altura: r.height }))
    }
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, tamanho] as const
}

function useReduzirMovimento() {
  return React.useSyncExternalStore(
    (aviso) => {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)")
      m.addEventListener("change", aviso)
      return () => m.removeEventListener("change", aviso)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  )
}

/** Vídeo guardado no app: toca quando é o da vez, para quando sai. */
function VideoDoArquivo({ midia, ativo, titulo }: { midia: ArquivoDeMidia; ativo: boolean; titulo: string }) {
  const ref = React.useRef<HTMLVideoElement>(null)
  const caminho = midia.guardado ? decodeURIComponent(midia.endereco.slice(PREFIXO_ARQUIVO.length)) : null
  const { data } = useUrlArquivo(caminho)
  const url = midia.guardado ? data : midia.endereco
  React.useEffect(() => {
    const v = ref.current
    if (!v) return
    if (ativo) v.play().catch(() => undefined)
    else v.pause()
  }, [ativo, url])
  if (!url) return <div className={cn("animate-pulse rounded-xl bg-white/10", EM_PE)} />
  return <video ref={ref} src={url} controls playsInline loop preload="metadata" aria-label={titulo} className="max-h-full max-w-full rounded-xl bg-black" />
}

function Aviso({ children }: { children: React.ReactNode }) {
  return <span className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-white/60">{children}</span>
}

/**
 * O player de um vídeo do feed. Só o vídeo da vez toca; o próximo do Instagram e o do Facebook já
 * ficam carregados (lá a pessoa toca para começar, então não sai som); o que ficou para trás é
 * desmontado e para.
 */
function TelaDoFeed({ video, distancia, titulo }: { video: ItemFeed; distancia: number; titulo: string }) {
  const [area, caixa] = useTamanho()
  const m = video.midia
  const ativo = distancia === 0
  let conteudo: React.ReactNode = null

  if (m.fonte === "youtube") {
    conteudo = (
      <div className={cn("relative overflow-hidden rounded-xl bg-neutral-900", m.youtube.vertical ? EM_PE : DEITADO)}>
        {ativo ? (
          <iframe
            src={enderecoDoPlayer(m, { feed: true })}
            title={titulo}
            className="absolute inset-0 size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            scrolling="no"
          />
        ) : Math.abs(distancia) <= 2 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={miniaturaYoutube(m.youtube.id)} alt="" className="absolute inset-0 size-full object-cover opacity-80" />
        ) : null}
      </div>
    )
  } else if (m.fonte === "tiktok") {
    conteudo = (
      <div className={cn("relative overflow-hidden rounded-xl bg-neutral-900", EM_PE)}>
        {ativo ? (
          <iframe src={enderecoDoPlayer(m, { feed: true })} title={titulo} className="absolute inset-0 size-full" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen scrolling="no" />
        ) : (
          <Aviso>TikTok</Aviso>
        )}
      </div>
    )
  } else if (m.fonte === "facebook") {
    const forma = cn("rounded-xl bg-neutral-900", m.tipo === "reel" ? EM_PE : DEITADO)
    conteudo =
      distancia === 0 || distancia === 1 ? (
        <TelaFacebook video={m} titulo={titulo} imediato={ativo} className={forma} />
      ) : (
        <div className={cn("relative overflow-hidden", forma)}>
          <Aviso>Facebook</Aviso>
        </div>
      )
  } else if (m.fonte === "instagram") {
    if (caixa && caixa.altura > 0) {
      if (distancia === 0 || distancia === 1) conteudo = <TelaInstagram video={m} titulo={titulo} caixa={caixa} imediato={ativo} />
      else {
        const largura = Math.min(LARGURA_INSTAGRAM, Math.floor(caixa.largura))
        const alto = alturaEstimadaInstagram(largura, m.tipo)
        const escala = Math.min(1, caixa.altura / alto)
        conteudo = (
          <div className="relative rounded-lg bg-white/10" style={{ width: Math.floor(largura * escala), height: Math.floor(alto * escala) }}>
            <Aviso>Instagram</Aviso>
          </div>
        )
      }
    }
  } else {
    conteudo = Math.abs(distancia) <= 1 ? <VideoDoArquivo midia={m} ativo={ativo} titulo={titulo} /> : <div className={cn("rounded-xl bg-white/10", EM_PE)} />
  }

  return (
    <div ref={area} className="relative min-h-0 flex-1 [container-type:size]">
      <div className="absolute inset-0 grid place-items-center">{conteudo}</div>
    </div>
  )
}

function ItemDoFeed({
  video,
  indice,
  total,
  distancia,
  aoRemover,
}: {
  video: ItemFeed
  indice: number
  total: number
  distancia: number
  aoRemover: (v: ItemFeed) => void
}) {
  const site = video.midia.fonte === "arquivo" ? null : video.midia
  const nome = site ? NOME_DA_FONTE[site.fonte] : null
  const titulo = video.legenda ?? `${nome ? `Vídeo do ${nome}` : "Vídeo"} em ${video.paginaTitulo}`
  return (
    <article
      aria-posinset={indice + 1}
      aria-setsize={total}
      aria-label={`Vídeo ${indice + 1} de ${total}: ${video.legenda ?? video.paginaTitulo}`}
      className="flex h-full snap-start snap-always flex-col pt-[var(--topo)]"
    >
      <TelaDoFeed video={video} distancia={distancia} titulo={titulo} />
      <footer className="mx-auto flex w-full max-w-md items-end gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="min-w-0 flex-1">
          <Link href={`/paginas/${video.paginaId}`} className="block truncate rounded-sm text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
            {video.paginaTitulo}
            {video.parte ? <span className="font-normal text-white/70"> · {video.parte}</span> : null}
          </Link>
          {video.legenda ? <p className="mt-0.5 line-clamp-2 text-sm text-white/85">{video.legenda}</p> : null}
        </div>
        {site ? (
          <a
            href={linkDoVideo(site)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Abrir no ${nome}`}
            title={`Abrir no ${nome}`}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <ExternalLink className="size-5" />
          </a>
        ) : null}
        <Menu>
          <MenuGatilho asChild>
            <button
              type="button"
              aria-label="Mais opções do vídeo"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Ellipsis className="size-5" />
            </button>
          </MenuGatilho>
          <MenuConteudo align="end" className="w-60">
            <MenuItem asChild>
              <Link href={`/paginas/${video.paginaId}`}>
                <FileText /> Abrir a página
              </Link>
            </MenuItem>
            {site ? (
              <MenuItem asChild>
                <a href={linkDoVideo(site)} target="_blank" rel="noreferrer">
                  <ExternalLink /> Abrir no {nome}
                </a>
              </MenuItem>
            ) : null}
            {video.sozinho ? (
              <>
                <MenuSeparador />
                <MenuItem perigo onSelect={() => aoRemover(video)}>
                  <Trash2 /> Tirar da página
                </MenuItem>
              </>
            ) : null}
          </MenuConteudo>
        </Menu>
      </footer>
    </article>
  )
}

const botaoClaro =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-white/15 font-medium text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-40"

/**
 * O feed começa do zero a cada vez que é aberto (link ou botão), mas volta do jeito que estava
 * no "voltar" do navegador (o Next guarda a tela escondida; ver useNaTela).
 */
export function FeedDeVideos() {
  const { bfcacheId } = useRouter()
  return <Feed key={bfcacheId} />
}

/** Os vídeos em tela cheia, um por vez: passa com o dedo, com a rolagem, com as setas ou com o teclado. */
function Feed() {
  const params = useSearchParams()
  const router = useRouter()
  const feed = useFeed({ hobby: params.get("hobby"), pagina: params.get("pagina") })
  const gravar = useGravarVideos()
  const reduzir = useReduzirMovimento()
  // Ao sair do feed (o Next só esconde a tela), os players saem e tudo para de tocar
  const raiz = React.useRef<HTMLDivElement>(null)
  const naTela = useNaTela(raiz)

  // Tela cheia de verdade enquanto o feed aparece: sem o espaço guardado para a barra de rolagem da
  // página (no computador virava uma faixa clara à direita) e com a barra do sistema (celular) preta
  React.useLayoutEffect(() => {
    const html = document.documentElement
    const antes = { gutter: html.style.getPropertyValue("scrollbar-gutter"), overflow: html.style.getPropertyValue("overflow") }
    html.style.setProperty("scrollbar-gutter", "auto")
    html.style.setProperty("overflow", "hidden")
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))
    const cores = metas.map((m) => m.content)
    for (const m of metas) m.content = "#000000"
    return () => {
      html.style.setProperty("scrollbar-gutter", antes.gutter)
      html.style.setProperty("overflow", antes.overflow)
      metas.forEach((m, i) => (m.content = cores[i]))
    }
  }, [])

  const [grupo, setGrupo] = React.useState<string | null>(() => params.get("g"))
  const [adicionando, setAdicionando] = React.useState(false)
  const [irPara, setIrPara] = React.useState<string | null>(() => params.get("v"))
  const [atual, setAtual] = React.useState(0)
  const [parado, setParado] = React.useState(0)
  const [dica, setDica] = React.useState(false)
  const rolagem = React.useRef<HTMLDivElement>(null)
  const espera = React.useRef<number | undefined>(undefined)

  // A janela de adicionar não fica aberta esperando a volta para o feed
  React.useLayoutEffect(() => () => setAdicionando(false), [])

  // Escondida, a lista perde a posição da rolagem: ao voltar (do "voltar" do navegador), volta ao vídeo da vez
  React.useLayoutEffect(() => {
    const el = rolagem.current
    if (!naTela || !el || !el.clientHeight) return
    el.scrollTop = parado * el.clientHeight
    // Só quando o feed volta a aparecer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naTela])

  const grupos = React.useMemo(() => {
    const mapa = new Map<string, { id: string; titulo: string; total: number }>()
    for (const v of feed.videos) {
      const g = mapa.get(v.grupo)
      if (g) g.total++
      else mapa.set(v.grupo, { id: v.grupo, titulo: v.grupoTitulo, total: 1 })
    }
    return [...mapa.values()]
  }, [feed.videos])
  const grupoAtivo = grupo && grupos.some((g) => g.id === grupo) ? grupo : null
  const lista = React.useMemo(() => (grupoAtivo ? feed.videos.filter((v) => v.grupo === grupoAtivo) : feed.videos), [feed.videos, grupoAtivo])
  const daVez = lista[Math.min(atual, lista.length - 1)]

  // Qual vídeo está na tela: muda na hora (contador) e, quando a rolagem para, troca o player
  const medir = React.useCallback(() => {
    const el = rolagem.current
    if (!el || !el.clientHeight || !lista.length) return
    const i = Math.max(0, Math.min(lista.length - 1, Math.round(el.scrollTop / el.clientHeight)))
    setAtual(i)
    window.clearTimeout(espera.current)
    espera.current = window.setTimeout(() => setParado(i), 160)
    if (i > 0) setDica(false)
  }, [lista.length])

  React.useEffect(() => {
    const el = rolagem.current
    if (!el) return
    const fim = () => {
      if (!el.clientHeight) return
      const i = Math.max(0, Math.min(lista.length - 1, Math.round(el.scrollTop / el.clientHeight)))
      window.clearTimeout(espera.current)
      setAtual(i)
      setParado(i)
    }
    el.addEventListener("scrollend", fim)
    return () => el.removeEventListener("scrollend", fim)
  }, [lista.length])

  // A lista mudou (vídeo novo, vídeo tirado, outro filtro): confere qual está na tela
  React.useEffect(() => {
    medir()
  }, [lista, medir])

  // Ir para um vídeo pedido (o do endereço ou o que acabou de entrar) assim que ele estiver na lista
  React.useLayoutEffect(() => {
    if (!irPara) return
    const i = lista.findIndex((v) => v.chave === irPara)
    if (i < 0) {
      // Uma página nova ainda pode estar chegando: espera a busca terminar antes de desistir
      if (!feed.carregando && !feed.atualizando) setIrPara(null)
      return
    }
    const el = rolagem.current
    if (!el) return
    el.scrollTo({ top: i * el.clientHeight, behavior: "auto" })
    setAtual(i)
    setParado(i)
    setIrPara(null)
  }, [irPara, lista, feed.carregando, feed.atualizando])

  // O endereço guarda o vídeo da vez: ao voltar de uma página (ou recarregar), o feed continua dele
  React.useEffect(() => {
    const chave = lista[parado]?.chave
    if (!chave || irPara) return
    const url = new URL(window.location.href)
    if (url.searchParams.get("v") === chave) return
    url.searchParams.set("v", chave)
    // Sem estado próprio: o Next copia o dele e atualiza o endereço que ele conhece
    window.history.replaceState(null, "", url)
  }, [parado, lista, irPara])

  // Dica de arrastar, só na primeira vez, em tela de toque
  React.useEffect(() => {
    if (lista.length < 2 || !window.matchMedia("(pointer: coarse)").matches) return
    try {
      if (localStorage.getItem(CHAVE_DICA)) return
      localStorage.setItem(CHAVE_DICA, "1")
    } catch {
      return
    }
    setDica(true)
    const t = window.setTimeout(() => setDica(false), 4000)
    return () => window.clearTimeout(t)
  }, [lista.length])

  // Para onde a rolagem está indo: apertar a seta várias vezes seguidas anda vários vídeos
  const destino = React.useRef<number | null>(null)
  React.useEffect(() => {
    destino.current = null
  }, [parado])

  const passo = React.useCallback(
    (direcao: number) => {
      const el = rolagem.current
      if (!el || !lista.length) return
      const base = destino.current ?? atual
      const alvo = Math.max(0, Math.min(lista.length - 1, base + direcao))
      destino.current = alvo
      el.scrollTo({ top: alvo * el.clientHeight, behavior: reduzir ? "auto" : "smooth" })
    },
    [lista.length, reduzir, atual],
  )

  // Roda do mouse e trackpad: um gesto, um vídeo (a rolagem com encaixe sozinha voltava ao mesmo
  // vídeo num giro curto). Em cima do player, quem rola é o próprio navegador.
  React.useEffect(() => {
    const el = rolagem.current
    if (!el) return
    let acumulado = 0
    let travado = 0
    const aoRodar = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
      e.preventDefault()
      const agora = Date.now()
      if (agora < travado) return
      acumulado += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY
      if (Math.abs(acumulado) < 40) return
      passo(acumulado > 0 ? 1 : -1)
      acumulado = 0
      travado = agora + 550
    }
    el.addEventListener("wheel", aoRodar, { passive: false })
    return () => el.removeEventListener("wheel", aoRodar)
  }, [passo])

  const destinoDeFechar = feed.paginaRaiz ? `/paginas/${feed.paginaRaiz.id}` : feed.hobby ? `/vida/hobbies/${feed.hobby.id}?aba=material` : "/vida/hobbies"
  const fechar = React.useCallback(() => {
    let voltar = false
    try {
      voltar = Boolean(sessionStorage.getItem(CHAVE_VOLTA))
      sessionStorage.removeItem(CHAVE_VOLTA)
    } catch {}
    // Aberto numa aba nova não há para onde voltar
    if (voltar && window.history.length > 1) router.back()
    else router.push(destinoDeFechar)
  }, [router, destinoDeFechar])

  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (adicionando || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const alvo = e.target as HTMLElement | null
      if (alvo?.closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu]")) return
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === "j") {
        e.preventDefault()
        passo(1)
      } else if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k") {
        e.preventDefault()
        passo(-1)
      } else if (e.key === "Escape") {
        fechar()
      }
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [adicionando, passo, fechar])

  /** Troca o filtro (e guarda no endereço, para voltar nele). */
  const trocarGrupo = (g: string | null) => {
    setGrupo(g)
    const url = new URL(window.location.href)
    if (g) url.searchParams.set("g", g)
    else url.searchParams.delete("g")
    url.searchParams.delete("v")
    window.history.replaceState(null, "", url)
  }

  const filtrar = (g: string | null) => {
    trocarGrupo(g)
    setAtual(0)
    setParado(0)
    rolagem.current?.scrollTo({ top: 0, behavior: "auto" })
  }

  const remover = async (v: ItemFeed) => {
    try {
      const antes = await gravar.remover(v.paginaId, v.chave)
      if (antes === null) {
        toast("Este vídeo está no meio de um texto.", { description: "Abra a página para tirar." })
        return
      }
      toast.success(`Vídeo tirado de “${v.paginaTitulo}”`, {
        action: { label: "Desfazer", onClick: () => gravar.voltarTexto(v.paginaId, antes) },
      })
    } catch (erro) {
      // Falha ao gravar já aparece num aviso; aqui só a de ler a página antes
      if (erro instanceof ErroAoLerPagina) toast.error("Não foi possível tirar o vídeo.", { description: erro.message })
    }
  }

  const comFiltros = grupos.length > 1
  const topo = comFiltros ? "calc(env(safe-area-inset-top) + 6.5rem)" : "calc(env(safe-area-inset-top) + 3.75rem)"

  return (
    <div ref={raiz} className="dark fixed inset-0 bg-black text-white" style={{ "--topo": topo } as React.CSSProperties}>
      <div
        ref={rolagem}
        onScroll={medir}
        role="feed"
        aria-busy={feed.carregando}
        aria-label={`Vídeos de ${feed.titulo}`}
        className="absolute inset-0 snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {lista.map((v, i) => (
          <ItemDoFeed key={v.chave} video={v} indice={i} total={lista.length} distancia={naTela ? i - parado : Infinity} aoRemover={remover} />
        ))}
      </div>

      {feed.carregando ? (
        <div className="absolute inset-0 grid place-items-center" role="status">
          <Loader2 className="size-7 animate-spin text-white/70" aria-hidden />
          <span className="sr-only">Carregando os vídeos…</span>
        </div>
      ) : feed.naoAchado ? (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="grid max-w-sm justify-items-center gap-3">
            <p className="text-lg font-semibold">Não achei esses vídeos.</p>
            <p className="text-sm text-white/70">O hobby ou a página pode ter sido excluído.</p>
            <Link href="/vida/hobbies" className={cn(botaoClaro, "h-11 px-5 text-sm")}>
              Ver os hobbies
            </Link>
          </div>
        </div>
      ) : !lista.length ? (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="grid max-w-sm justify-items-center gap-3">
            <p className="text-lg font-semibold">Nenhum vídeo ainda</p>
            <p className="text-sm text-white/70">
              {feed.destinos.length || feed.hobby ? "Cole o link de um vídeo do YouTube, do Instagram, do TikTok ou do Facebook e ele aparece aqui." : "Crie um hobby e adicione páginas de estudo para guardar vídeos."}
            </p>
            {feed.destinos.length || feed.hobby ? (
              <button type="button" onClick={() => setAdicionando(true)} className="mt-1 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black hover:bg-white/90">
                <Plus className="size-4" /> Adicionar vídeo
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <header className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/85 via-black/55 to-transparent pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center gap-2 px-2 sm:px-4">
          <button type="button" onClick={fechar} aria-label="Fechar os vídeos" className={cn(botaoClaro, "size-11 shrink-0 bg-transparent hover:bg-white/15")}>
            <X className="size-6" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">{feed.titulo}</h1>
            <p className="text-xs text-white/70" aria-live="polite">
              {lista.length ? `${Math.min(atual, lista.length - 1) + 1} de ${plural(lista.length, "vídeo")}` : "Vídeos"}
            </p>
          </div>
          {feed.destinos.length || feed.hobby ? (
            <button type="button" onClick={() => setAdicionando(true)} aria-label="Adicionar vídeo" className={cn(botaoClaro, "h-11 shrink-0 px-4 text-sm")}>
              <Plus className="size-4" /> Vídeo
            </button>
          ) : null}
        </div>
        {comFiltros ? (
          <nav aria-label="Filtrar os vídeos" className="flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
            {[{ id: null, titulo: "Todos", total: feed.videos.length }, ...grupos].map((g) => {
              const ativo = grupoAtivo === g.id
              return (
                <button
                  key={g.id ?? "todos"}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => filtrar(g.id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors toque:h-11",
                    ativo ? "border-white bg-white font-medium text-black" : "border-white/25 bg-black/30 text-white/90 hover:border-white/50",
                  )}
                >
                  {g.titulo}
                  <span className={cn("tabular-nums", ativo ? "text-black/60" : "text-white/55")}>{g.total}</span>
                </button>
              )
            })}
          </nav>
        ) : null}
      </header>

      {lista.length > 1 ? (
        <div className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 md:pointer-fine:flex lg:right-8">
          <button type="button" onClick={() => passo(-1)} disabled={atual <= 0} aria-label="Vídeo anterior" className={cn(botaoClaro, "size-12")}>
            <ChevronUp className="size-6" />
          </button>
          <button type="button" onClick={() => passo(1)} disabled={atual >= lista.length - 1} aria-label="Próximo vídeo" className={cn(botaoClaro, "size-12")}>
            <ChevronDown className="size-6" />
          </button>
        </div>
      ) : null}

      {dica ? (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-28 z-20 grid justify-items-center gap-1 text-sm font-medium text-white motion-safe:animate-bounce">
          <ChevronUp className="size-6" />
          Arraste para cima
        </div>
      ) : null}

      <AdicionarVideo
        aberta={adicionando}
        aoMudar={setAdicionando}
        destinos={feed.destinos}
        hobbyPadrao={feed.hobby ?? null}
        paginaHobbies={feed.paginaHobbies}
        arvore={feed.arvore}
        inicial={daVez ? { paginaId: daVez.paginaId, parte: daVez.parte } : undefined}
        existentes={feed.videos}
        aoAdicionar={({ chave, paginaId }) => {
          const fonte = feed.fontes.find((f) => f.id === paginaId)
          if (grupoAtivo && fonte?.grupo !== grupoAtivo) trocarGrupo(null)
          setIrPara(chave)
        }}
      />
    </div>
  )
}
