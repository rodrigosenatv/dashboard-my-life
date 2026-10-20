"use client"

import * as React from "react"
import { ExternalLink, Play } from "lucide-react"
import { Janela } from "@/components/ui/janela"
import { TelaYoutube } from "@/components/video-youtube"
import { PREFIXO_ARQUIVO, useUrlArquivo } from "@/lib/arquivos"
import { useNaTela } from "@/lib/na-tela"
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

/** Altura de um post do Instagram antes de ele avisar a dele (cabeçalho, vídeo em pé e rodapé). */
export const alturaEstimadaInstagram = (largura: number, tipo: "p" | "reel" | "tv") => Math.round(largura * (tipo === "p" ? 9 / 5 : 21 / 9))

/** Largura máxima do post do Instagram (a mesma do embed oficial deles, com folga para o celular). */
export const LARGURA_INSTAGRAM = 360

/**
 * Post ou reel do Instagram no player oficial deles. O Instagram avisa a altura do post por
 * mensagem; até lá a caixa fica com a proporção de um reel. Com `caixa` (no feed), o post
 * inteiro é reduzido para caber nela, sem cortar o nome da conta nem os botões do Instagram.
 */
export function TelaInstagram({
  video,
  titulo,
  caixa,
  imediato = false,
}: {
  video: Extract<VideoDeSite, { fonte: "instagram" }>
  titulo: string
  caixa?: { largura: number; altura: number } | null
  /** Carrega já, sem esperar chegar perto na rolagem (o vídeo da vez no feed). */
  imediato?: boolean
}) {
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

  const quadro = (estilo?: React.CSSProperties) => (
    <div
      // A moldura é um "ring" (não ocupa espaço): o iframe fica com a altura exata do post. Se sobrasse
      // 1px de rolagem dentro dele, o dedo rolaria o post em vez de passar para o próximo vídeo.
      className={cn("relative w-full overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line", !caixa && "midia-instagram")}
      data-tipo={video.tipo}
      style={estilo}
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
          loading={imediato ? "eager" : "lazy"}
          onLoad={() => setCarregou(true)}
          className="absolute inset-0 size-full"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          scrolling="no"
        />
      ) : null}
    </div>
  )

  if (!caixa) return quadro(altura ? { height: altura } : undefined)

  // No feed: o post na largura dele, reduzido por inteiro até caber na altura da tela
  const largura = Math.max(1, Math.min(LARGURA_INSTAGRAM, Math.floor(caixa.largura)))
  const alto = altura ?? alturaEstimadaInstagram(largura, video.tipo)
  const escala = Math.min(1, caixa.altura / alto)
  return (
    <div className="relative" style={{ width: Math.floor(largura * escala), height: Math.floor(alto * escala) }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: largura, height: alto, transform: escala < 1 ? `scale(${escala})` : undefined }}>
        {quadro({ height: "100%" })}
      </div>
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
        scrolling="no"
      />
    </div>
  )
}

/**
 * Reel ou vídeo do Facebook no player oficial deles (o mesmo do "Incorporar"). O player ocupa a
 * largura do iframe e acompanha quando a caixa muda de tamanho, então basta a caixa ter a forma do
 * vídeo (em pé ou deitado). Começa com um toque, com som. Só toca o vídeo que é público no Facebook.
 */
export function TelaFacebook({
  video,
  titulo,
  className,
  imediato = false,
}: {
  video: Extract<VideoDeSite, { fonte: "facebook" }>
  titulo: string
  /** Forma e tamanho da caixa (quem usa decide); o player ocupa a caixa toda. */
  className?: string
  /** Carrega já, sem esperar chegar perto na rolagem (o vídeo da vez no feed). */
  imediato?: boolean
}) {
  const [carregou, setCarregou] = React.useState(false)
  return (
    <div className={cn("relative overflow-hidden bg-black", className)}>
      {carregou ? null : (
        <span aria-hidden className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-3 text-center text-xs text-white/60">
          Carregando o Facebook…
        </span>
      )}
      <iframe
        src={enderecoDoPlayer(video)}
        title={titulo}
        loading={imediato ? "eager" : "lazy"}
        onLoad={() => setCarregou(true)}
        className="absolute inset-0 size-full"
        // A página do player não diz o tema: no tema escuro do app, o navegador pintaria o fundo do iframe de branco
        style={{ colorScheme: "light" }}
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        scrolling="no"
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
 * Um vídeo (ou áudio) que toca dentro do app: YouTube, Instagram, TikTok, Facebook ou arquivo.
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
  // Saiu da tela (o Next só esconde): o player sai e o vídeo para; ao voltar, ele nasce de novo
  const ref = React.useRef<HTMLElement>(null)
  const naTela = useNaTela(ref)
  if (!midia) return null
  const nome = midia.fonte === "arquivo" ? null : NOME_DA_FONTE[midia.fonte]
  const titulo = legenda || (midia.fonte !== "arquivo" ? `Vídeo do ${nome}` : midia.tipo === "audio" ? "Áudio" : "Vídeo")

  return (
    <figure ref={ref} className={cn("midia grid min-w-0 content-start justify-items-start gap-1.5", className)} data-formato={emPe(midia) ? "em-pe" : "deitado"}>
      {midia.fonte === "youtube" ? (
        <div className={cn("relative overflow-hidden rounded-lg bg-black", midia.youtube.vertical ? "midia-em-pe" : "aspect-video w-full")}>
          <TelaYoutube key={midia.youtube.id} video={midia.youtube} titulo={titulo} iniciar={iniciar} />
        </div>
      ) : !naTela ? null : midia.fonte === "instagram" ? (
        <TelaInstagram video={midia} titulo={titulo} />
      ) : midia.fonte === "tiktok" ? (
        <TelaTiktok video={midia} titulo={titulo} />
      ) : midia.fonte === "facebook" ? (
        <TelaFacebook video={midia} titulo={titulo} className={cn("rounded-lg", midia.tipo === "reel" ? "midia-em-pe" : "aspect-video w-full")} />
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
