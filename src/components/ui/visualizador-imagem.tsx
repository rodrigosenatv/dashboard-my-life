"use client"

import { Dialog } from "radix-ui"
import * as React from "react"
import { ImageOff, LoaderCircle, X, ZoomIn, ZoomOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { alternarZoom, encaixar, escalaMaxima, fatorDaRoda, limitar, pinca, sobreAImagem, VISTA_INICIAL, zoomEm, type Ponto, type Tamanho, type Vista } from "@/lib/zoom"

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
// Cinza escuro translúcido: aparece sobre o fundo preto e continua legível por cima da imagem (celular deitado)
const FUNDO_BOTOES = "bg-neutral-800/65 backdrop-blur-sm"
const BOTAO = cn(
  "grid size-10 shrink-0 place-items-center rounded-full text-white transition-colors hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent [&_svg]:size-5 toque:size-11",
  FOCO,
)

/** Dois toques seguidos (no celular) contam como um toque duplo se vierem até este tempo e perto um do outro. */
const TOQUE_DUPLO_MS = 300

type Props = {
  url: string | null | undefined
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  /** O nome da imagem, para leitores de tela. */
  titulo: string
  /**
   * Uma linha junto da imagem: no topo, ao lado dos botões (telas largas), ou embaixo da imagem inteira,
   * quando sobra espaço (celular em pé). Some enquanto a imagem está ampliada.
   */
  legenda?: (lugar: "topo" | "embaixo") => React.ReactNode
  /** Botões a mais no topo, antes do zoom (ex.: um atalho para ajustar a imagem). */
  acoes?: React.ReactNode
}

/**
 * A imagem inteira em tela cheia, sem véu nem corte, com zoom: um clique ou dois toques ampliam no ponto
 * tocado (e voltam), a pinça e a roda do mouse ampliam aos poucos, arrastar move a imagem ampliada.
 * Fecha no X, com Esc ou tocando fora da imagem.
 */
export function VisualizadorDeImagem({ url, aberto, aoMudar, titulo, legenda, acoes }: Props) {
  const fechar = React.useRef<HTMLButtonElement>(null)
  // Quem abriu (o botão "Ver quadro"): o foco volta para ele ao fechar, para o teclado não se perder na página
  const quemAbriu = React.useRef<HTMLElement | null>(null)
  return (
    <Dialog.Root open={aberto} onOpenChange={aoMudar}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/[0.97] data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <Dialog.Content
          className="fixed inset-0 z-50 text-white outline-none data-[state=open]:animate-[fade-in_160ms_ease-out]"
          // O foco começa no X: Enter ou Esc fecham sem precisar procurar o botão
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            quemAbriu.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            fechar.current?.focus()
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            quemAbriu.current?.focus({ preventScroll: true })
          }}
        >
          <Dialog.Title className="sr-only">{titulo}</Dialog.Title>
          <Dialog.Description className="sr-only">Clique ou toque duas vezes para ampliar, arraste para mover. Esc fecha.</Dialog.Description>
          {url ? <Palco key={url} url={url} titulo={titulo} legenda={legenda} acoes={acoes} fechar={fechar} aoFechar={() => aoMudar(false)} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type Gesto = { tipo: "arrastar"; inicio: Vista; ponto: Ponto } | { tipo: "pinca"; inicio: Vista; meio: Ponto; distancia: number }

function Palco({
  url,
  titulo,
  legenda,
  acoes,
  fechar,
  aoFechar,
}: Pick<Props, "titulo" | "legenda" | "acoes"> & {
  url: string
  fechar: React.RefObject<HTMLButtonElement | null>
  aoFechar: () => void
}) {
  const palcoRef = React.useRef<HTMLDivElement>(null)
  const [palco, setPalco] = React.useState<Tamanho>({ largura: 0, altura: 0 })

  const [natural, setNatural] = React.useState<Tamanho>({ largura: 0, altura: 0 })
  const [erro, setErro] = React.useState(false)
  const [vista, setVista] = React.useState<Vista>(VISTA_INICIAL)
  // Os toques e os botões animam a mudança; a pinça, a roda e o arrastar seguem o gesto sem atraso
  const [animar, setAnimar] = React.useState(false)
  // A vista mais recente, mesmo antes de o React redesenhar (vários giros da roda ou movimentos entre dois quadros)
  const atual = React.useRef<Vista>(VISTA_INICIAL)
  const mudar = React.useCallback((nova: Vista, animado = false) => {
    atual.current = nova
    setAnimar(animado)
    setVista(nova)
  }, [])

  // Tela cheia de verdade (como no feed de vídeos): sem o espaço guardado para a barra de rolagem da página
  // (no computador virava uma faixa à direita) e com a barra do sistema do celular preta
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

  // Em tela grande sobra uma margem em volta da imagem; no celular (em pé ou deitado) ela vai de ponta a ponta
  const margem = palco.largura >= 640 && palco.altura >= 480 ? 24 : 0
  const encaixada = encaixar(natural, { largura: palco.largura - 2 * margem, altura: palco.altura - 2 * margem })
  const maxima = escalaMaxima(natural, encaixada)
  const carregada = encaixada.largura > 0
  const ampliada = vista.escala > 1.01

  React.useEffect(() => {
    const el = palcoRef.current
    if (!el) return
    const medir = () => {
      setPalco({ largura: el.clientWidth, altura: el.clientHeight })
      // Girar o aparelho ou mudar o tamanho da janela recomeça com a imagem inteira
      mudar(VISTA_INICIAL)
    }
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [mudar])

  /** A posição de um ponto da tela no palco, a partir do centro dele. */
  const noPalco = (clientX: number, clientY: number): Ponto => {
    const r = palcoRef.current!.getBoundingClientRect()
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 }
  }

  // A roda do mouse e a pinça do touchpad (que chega como roda com Ctrl) ampliam no ponto do cursor.
  // O ouvinte é do navegador, e não do React, para poder impedir o zoom da página inteira.
  const aoRodar = React.useEffectEvent((e: WheelEvent) => {
    e.preventDefault()
    if (!carregada) return
    const v = atual.current
    mudar(zoomEm(v, v.escala * fatorDaRoda(e.deltaY, e.deltaMode, e.ctrlKey), noPalco(e.clientX, e.clientY), encaixada, palco, maxima))
  })
  React.useEffect(() => {
    const el = palcoRef.current
    if (!el) return
    const roda = (e: WheelEvent) => aoRodar(e)
    el.addEventListener("wheel", roda, { passive: false })
    return () => el.removeEventListener("wheel", roda)
  }, [])

  const ampliarNoCentro = (fator: number) => mudar(zoomEm(atual.current, atual.current.escala * fator, { x: 0, y: 0 }, encaixada, palco, maxima), true)
  const alternar = (p: Ponto) => mudar(alternarZoom(atual.current, p, encaixada, palco, maxima), true)

  /* Gestos ---------------------------------------------------------- */

  const ponteiros = React.useRef(new Map<number, Ponto>())
  const gesto = React.useRef<Gesto | null>(null)
  // O toque ou clique em andamento (para separar o toque do arrastar) e o último toque (para o toque duplo)
  const toque = React.useRef<{ ponto: Ponto; quando: number; moveu: boolean } | null>(null)
  const ultimoToque = React.useRef<{ ponto: Ponto; quando: number } | null>(null)
  const fecharDepois = React.useRef<number | undefined>(undefined)
  React.useEffect(() => () => window.clearTimeout(fecharDepois.current), [])

  const doisDedos = (): { meio: Ponto; distancia: number } => {
    const [a, b] = [...ponteiros.current.values()]
    return { meio: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distancia: Math.hypot(a.x - b.x, a.y - b.y) }
  }

  const aoApertar = (e: React.PointerEvent) => {
    if ((e.pointerType === "mouse" && e.button !== 0) || !carregada) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = noPalco(e.clientX, e.clientY)
    ponteiros.current.set(e.pointerId, p)
    if (ponteiros.current.size === 1) {
      gesto.current = { tipo: "arrastar", inicio: atual.current, ponto: p }
      toque.current = { ponto: p, quando: e.timeStamp, moveu: false }
    } else if (ponteiros.current.size === 2) {
      const { meio, distancia } = doisDedos()
      gesto.current = { tipo: "pinca", inicio: atual.current, meio, distancia }
      if (toque.current) toque.current.moveu = true
      ultimoToque.current = null
      window.clearTimeout(fecharDepois.current)
    }
  }

  const aoMover = (e: React.PointerEvent) => {
    if (!ponteiros.current.has(e.pointerId)) return
    const p = noPalco(e.clientX, e.clientY)
    ponteiros.current.set(e.pointerId, p)
    const g = gesto.current
    if (!g) return
    if (g.tipo === "pinca" && ponteiros.current.size >= 2) {
      const { meio, distancia } = doisDedos()
      mudar(pinca(g.inicio, g.meio, g.distancia, meio, distancia, encaixada, palco, maxima))
    } else if (g.tipo === "arrastar") {
      const dx = p.x - g.ponto.x
      const dy = p.y - g.ponto.y
      if (toque.current && Math.hypot(dx, dy) > 6) toque.current.moveu = true
      if (g.inicio.escala > 1.01) mudar(limitar({ ...g.inicio, x: g.inicio.x + dx, y: g.inicio.y + dy }, encaixada, palco, maxima))
    }
  }

  const aoSoltar = (e: React.PointerEvent) => {
    if (!ponteiros.current.delete(e.pointerId)) return
    // Sobrou um dedo da pinça: ele continua arrastando a partir de onde a imagem está, sem pular
    if (ponteiros.current.size === 1) {
      const [resto] = [...ponteiros.current.values()]
      gesto.current = { tipo: "arrastar", inicio: atual.current, ponto: resto }
      return
    }
    if (ponteiros.current.size > 0) return
    gesto.current = null
    const t = toque.current
    toque.current = null
    if (e.type !== "pointerup" || !t || t.moveu || e.timeStamp - t.quando > 400) return

    const p = noPalco(e.clientX, e.clientY)
    const v = atual.current
    const naImagem = sobreAImagem(p, v, encaixada)
    const jaAmpliada = v.escala > 1.01
    if (e.pointerType === "mouse") {
      // Clique: amplia na imagem (ou volta, se já ampliada); no fundo em volta da imagem inteira, fecha
      if (naImagem || jaAmpliada) alternar(p)
      else aoFechar()
      return
    }
    // Toque: dois toques seguidos ampliam (ou voltam); um toque só, no fundo em volta da imagem inteira, fecha
    const anterior = ultimoToque.current
    if (anterior && e.timeStamp - anterior.quando < TOQUE_DUPLO_MS && Math.hypot(p.x - anterior.ponto.x, p.y - anterior.ponto.y) < 40) {
      window.clearTimeout(fecharDepois.current)
      ultimoToque.current = null
      alternar(p)
      return
    }
    ultimoToque.current = { ponto: p, quando: e.timeStamp }
    if (!naImagem && !jaAmpliada) {
      window.clearTimeout(fecharDepois.current)
      fecharDepois.current = window.setTimeout(aoFechar, TOQUE_DUPLO_MS)
    }
  }

  /* Teclado: + e - ampliam, 0 volta à imagem inteira, as setas movem a imagem ampliada */
  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return
    const v = atual.current
    const mover = (dx: number, dy: number) => mudar(limitar({ ...v, x: v.x + dx, y: v.y + dy }, encaixada, palco, maxima), true)
    if (e.key === "+" || e.key === "=") ampliarNoCentro(1.5)
    else if (e.key === "-" || e.key === "_") ampliarNoCentro(1 / 1.5)
    else if (e.key === "0") mudar(VISTA_INICIAL, true)
    else if (ampliada && e.key === "ArrowLeft") mover(80, 0)
    else if (ampliada && e.key === "ArrowRight") mover(-80, 0)
    else if (ampliada && e.key === "ArrowUp") mover(0, 80)
    else if (ampliada && e.key === "ArrowDown") mover(0, -80)
    else return
    e.preventDefault()
  }

  // No celular em pé sobra espaço embaixo da imagem inteira: a legenda vai ali
  const sobraEmbaixo = carregada ? (palco.altura - encaixada.altura) / 2 : 0
  const porcentagem = Math.round(vista.escala * 100)

  return (
    <div className="absolute inset-0 flex flex-col" onKeyDown={aoTeclar}>
      <div className="visualizador-topo flex items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-3 sm:px-5">
        <div className="min-w-0 flex-1">
          {legenda ? (
            <div className={cn("hidden min-w-0 transition-opacity sm:block", ampliada && "opacity-0")}>
              <div className="visualizador-legenda">{legenda("topo")}</div>
            </div>
          ) : null}
        </div>
        {acoes}
        <div className={cn("flex items-center rounded-full p-0.5", FUNDO_BOTOES)}>
          <button type="button" className={BOTAO} onClick={() => ampliarNoCentro(1 / 1.5)} disabled={!carregada || !ampliada} aria-label="Diminuir o zoom" title="Diminuir o zoom (-)">
            <ZoomOut aria-hidden />
          </button>
          <button
            type="button"
            className={cn("tabular h-10 min-w-[3.25rem] rounded-full px-1 text-center text-sm font-medium text-white/85 transition-colors hover:text-white disabled:text-white/55 toque:h-11", FOCO)}
            onClick={() => mudar(VISTA_INICIAL, true)}
            disabled={!ampliada}
            aria-label={ampliada ? `Zoom de ${porcentagem}%. Mostrar a imagem inteira` : "Imagem inteira, sem zoom"}
            title="Mostrar a imagem inteira (0)"
          >
            {porcentagem}%
          </button>
          <button type="button" className={BOTAO} onClick={() => ampliarNoCentro(1.5)} disabled={!carregada || vista.escala >= maxima - 0.01} aria-label="Aumentar o zoom" title="Aumentar o zoom (+)">
            <ZoomIn aria-hidden />
          </button>
        </div>
        <Dialog.Close asChild>
          <button ref={fechar} type="button" className={cn(BOTAO, FUNDO_BOTOES, "hover:bg-neutral-700/80")} aria-label="Fechar" title="Fechar (Esc)">
            <X aria-hidden />
          </button>
        </Dialog.Close>
      </div>

      <div
        ref={palcoRef}
        // Focável: um clique na imagem leva o foco para cá (e não para fora da janela), e as teclas continuam valendo
        tabIndex={-1}
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden outline-none"
        onPointerDown={aoApertar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- link temporário do storage, já otimizado no envio */}
        <img
          src={url}
          alt={titulo}
          draggable={false}
          onLoad={(e) => setNatural({ largura: e.currentTarget.naturalWidth, altura: e.currentTarget.naturalHeight })}
          onError={() => setErro(true)}
          className={cn(
            "absolute left-1/2 top-1/2 max-w-none select-none opacity-0 transition-opacity duration-200",
            carregada && "opacity-100",
            animar && "transition-[opacity,transform] ease-out",
            carregada && (ampliada ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"),
          )}
          style={{
            width: carregada ? encaixada.largura : undefined,
            height: carregada ? encaixada.altura : undefined,
            transform: `translate(-50%, -50%) translate3d(${vista.x}px, ${vista.y}px, 0) scale(${vista.escala})`,
          }}
        />
        {!carregada && !erro ? (
          <div className="absolute inset-0 grid place-items-center" role="status" aria-label="Carregando a imagem">
            <LoaderCircle className="size-6 animate-spin text-white/60" aria-hidden />
          </div>
        ) : null}
        {erro ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/75" role="alert">
            <div className="grid justify-items-center gap-2">
              <ImageOff className="size-6" aria-hidden />
              Não foi possível abrir a imagem. Feche e tente de novo.
            </div>
          </div>
        ) : null}
        {legenda && sobraEmbaixo >= 72 ? (
          <div
            aria-hidden
            className={cn("pointer-events-none absolute inset-x-0 bottom-0 grid place-items-center px-6 pb-[env(safe-area-inset-bottom)] text-center transition-opacity duration-200 sm:hidden", ampliada && "opacity-0")}
            style={{ height: sobraEmbaixo }}
          >
            {legenda("embaixo")}
          </div>
        ) : null}
      </div>
    </div>
  )
}
