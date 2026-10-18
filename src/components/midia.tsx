"use client"

import * as React from "react"
import { ExternalLink, Play } from "lucide-react"
import { Janela } from "@/components/ui/janela"
import { TelaYoutube } from "@/components/video-youtube"
import { PREFIXO_ARQUIVO, useUrlArquivo } from "@/lib/arquivos"
import { cn } from "@/lib/utils"
import {
  alturaDoInstagram,
  emPe,
  enderecoDoPlayer,
  lerMidia,
  lerVideoDeSite,
  linkDoVideo,
  NOME_DA_FONTE,
  type ArquivoDeMidia,
  type VideoDeSite,
} from "@/lib/videos"

const ORIGEM_INSTAGRAM = "https://www.instagram.com"

const semInscricao = () => () => {}
const verdadeiro = () => true
const falso = () => false

/**
 * Post ou reel do Instagram no player oficial deles. O Instagram avisa a altura do post por
 * mensagem; até lá a caixa fica com a proporção de um reel.
 */
function TelaInstagram({ video, titulo }: { video: Extract<VideoDeSite, { fonte: "instagram" }>; titulo: string }) {
  // O iframe só nasce no navegador, já com a escuta ligada: assim o aviso de altura não se perde
  const noNavegador = React.useSyncExternalStore(semInscricao, verdadeiro, falso)
  const [altura, setAltura] = React.useState<number | null>(null)
  const [carregou, setCarregou] = React.useState(false)

  const ligar = React.useCallback((iframe: HTMLIFrameElement | null) => {
    if (!iframe) return
    const aoReceber = (e: MessageEvent) => {
      if (e.origin !== ORIGEM_INSTAGRAM || e.source !== iframe.contentWindow) return
      const h = alturaDoInstagram(e.data)
      if (h) setAltura(h)
    }
    window.addEventListener("message", aoReceber)
    return () => window.removeEventListener("message", aoReceber)
  }, [])

  return (
    <div
      className="midia-instagram relative w-full overflow-hidden rounded-lg border border-line bg-surface-2"
      data-tipo={video.tipo}
      style={altura ? { height: altura } : undefined}
    >
      {carregou ? null : (
        <span aria-hidden className="absolute inset-x-0 top-1/3 text-center text-xs text-ink-3">
          Carregando o Instagram…
        </span>
      )}
      {noNavegador ? (
        <iframe
          ref={ligar}
          src={enderecoDoPlayer(video)}
          title={titulo}
          loading="lazy"
          onLoad={() => setCarregou(true)}
          className="absolute inset-0 size-full"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen"
          allowFullScreen
        />
      ) : null}
    </div>
  )
}

function TelaTiktok({ video, titulo }: { video: Extract<VideoDeSite, { fonte: "tiktok" }>; titulo: string }) {
  return (
    <div className="midia-em-pe relative overflow-hidden rounded-lg bg-black">
      <iframe
        src={enderecoDoPlayer(video)}
        title={titulo}
        loading="lazy"
        className="absolute inset-0 size-full"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

/** Vídeo ou áudio guardado no app (veio do Notion ou foi enviado) ou link direto para o arquivo. */
function TelaArquivo({ midia, titulo }: { midia: ArquivoDeMidia; titulo: string }) {
  const caminho = midia.guardado ? decodeURIComponent(midia.endereco.slice(PREFIXO_ARQUIVO.length)) : null
  const { data, isError } = useUrlArquivo(caminho)
  const url = midia.guardado ? data : midia.endereco
  if (!url) {
    if (isError) return <p className="text-sm text-ink-3">Não foi possível abrir este arquivo agora.</p>
    return <div className={cn("w-full animate-pulse rounded-lg bg-surface-2", midia.tipo === "audio" ? "h-12" : "h-48")} />
  }
  if (midia.tipo === "audio") return <audio controls preload="metadata" src={url} aria-label={titulo} className="w-full" />
  return <video controls playsInline preload="metadata" src={url} aria-label={titulo} className="midia-arquivo rounded-lg bg-black" />
}

/**
 * Um vídeo (ou áudio) que toca dentro do app: YouTube, Instagram, TikTok ou arquivo.
 * Embaixo, a legenda (o texto do link, quando não é só o endereço) e o atalho para o site.
 */
export function MidiaIncorporada({
  endereco,
  legenda,
  iniciar = false,
  className,
}: {
  endereco: string
  legenda?: string | null
  /** Já começa tocando (YouTube), por exemplo quando a pessoa tocou no link para abrir. */
  iniciar?: boolean
  className?: string
}) {
  const midia = React.useMemo(() => lerMidia(endereco), [endereco])
  if (!midia) return null
  const nome = midia.fonte === "arquivo" ? null : NOME_DA_FONTE[midia.fonte]
  const titulo = legenda || (midia.fonte !== "arquivo" ? `Vídeo do ${nome}` : midia.tipo === "audio" ? "Áudio" : "Vídeo")

  return (
    <figure className={cn("midia grid min-w-0 content-start justify-items-start gap-1.5", className)} data-formato={emPe(midia) ? "em-pe" : "deitado"}>
      {midia.fonte === "youtube" ? (
        <div className={cn("relative overflow-hidden rounded-lg bg-black", midia.youtube.vertical ? "midia-em-pe" : "aspect-video w-full")}>
          <TelaYoutube key={midia.youtube.id} video={midia.youtube} titulo={titulo} iniciar={iniciar} />
        </div>
      ) : midia.fonte === "instagram" ? (
        <TelaInstagram video={midia} titulo={titulo} />
      ) : midia.fonte === "tiktok" ? (
        <TelaTiktok video={midia} titulo={titulo} />
      ) : (
        <TelaArquivo midia={midia} titulo={titulo} />
      )}
      {legenda || nome ? (
        <figcaption className="flex min-w-0 max-w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs leading-5 text-ink-3">
          {legenda ? <span className="min-w-0 text-sm text-ink-2">{legenda}</span> : null}
          {midia.fonte !== "arquivo" ? (
            <a href={linkDoVideo(midia)} target="_blank" rel="noreferrer" className="midia-fonte inline-flex items-center gap-1 hover:text-ink">
              <ExternalLink className="size-3.5" />
              Abrir no {nome}
            </a>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  )
}

/**
 * Link de vídeo no meio de um texto: continua no texto, com um ▶ na frente, e ao tocar
 * abre o vídeo numa janela, sem sair do app. Com Ctrl/⌘ ou o botão do meio, abre no site.
 */
export function LinkDeVideo({ href, children }: { href: string; children: React.ReactNode }) {
  const video = React.useMemo(() => lerVideoDeSite(href), [href])
  const [aberta, setAberta] = React.useState(false)
  if (!video)
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    )
  const nome = NOME_DA_FONTE[video.fonte]
  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-haspopup="dialog"
        onClick={(e) => {
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
          e.preventDefault()
          setAberta(true)
        }}
      >
        <Play aria-hidden className="mr-1 inline size-[0.8em] -translate-y-px fill-current" />
        {children}
      </a>
      {/* Os cliques dentro da janela não sobem para o texto (numa tarefa, marcariam a caixa) */}
      <span onClick={(e) => e.stopPropagation()}>
        <Janela aberta={aberta} aoMudar={setAberta} titulo={`Vídeo do ${nome}`} largura={emPe(video) ? "sm" : "lg"}>
          <MidiaIncorporada endereco={href} iniciar className="[--video-altura:64dvh]" />
        </Janela>
      </span>
    </>
  )
}
