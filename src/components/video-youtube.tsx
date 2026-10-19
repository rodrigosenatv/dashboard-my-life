"use client"

import * as React from "react"
import { ExternalLink, Play } from "lucide-react"
import { useNaTela } from "@/lib/na-tela"
import { embedYoutube, linkYoutube, miniaturaYoutube, type VideoYoutube } from "@/lib/youtube"
import { cn } from "@/lib/utils"

/**
 * A tela do vídeo: a miniatura com o botão de tocar e, depois do toque, o player do YouTube.
 * Ocupa a caixa onde for posta (quem usa decide o tamanho).
 */
export function TelaYoutube({ video, titulo, iniciar = false }: { video: VideoYoutube; titulo: string; iniciar?: boolean }) {
  const [tocando, setTocando] = React.useState(iniciar)
  // Saiu da tela (o Next só esconde): o player sai e o vídeo para; ao voltar, fica como quando a tela abriu
  const naTela = useNaTela()
  if (!naTela && tocando !== iniciar) setTocando(iniciar)
  return (
    <div className="absolute inset-0">
      {tocando && naTela ? (
        <iframe
          src={embedYoutube(video, { autoplay: true })}
          title={`Vídeo: ${titulo}`}
          className="absolute inset-0 size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" onClick={() => setTocando(true)} className="group absolute inset-0" aria-label={`Tocar o vídeo de ${titulo}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={miniaturaYoutube(video.id)} alt="" loading="lazy" className="size-full object-cover opacity-85 transition-opacity group-hover:opacity-100" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-14 place-items-center rounded-full bg-black/65 text-white shadow-overlay transition-transform group-hover:scale-105">
              <Play className="size-6 translate-x-0.5" fill="currentColor" />
            </span>
          </span>
        </button>
      )}
    </div>
  )
}

/**
 * Vídeo do YouTube que só carrega o player quando a pessoa toca na miniatura (mais leve e
 * sem rastreio até o play). Shorts aparecem em pé; os outros, deitados.
 */
export function PlayerYoutube({
  video,
  titulo,
  iniciar = false,
  compacto = false,
  className,
}: {
  video: VideoYoutube
  titulo: string
  iniciar?: boolean
  /** Prévia menor (por exemplo, dentro de um formulário). */
  compacto?: boolean
  className?: string
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex justify-center">
        <div
          className={cn(
            "relative overflow-hidden rounded-lg bg-black",
            video.vertical
              ? compacto
                ? "aspect-[9/16] h-[min(40dvh,320px)]"
                : "aspect-[9/16] h-[min(62dvh,520px)]"
              : compacto
                ? "aspect-video w-full max-w-md"
                : "aspect-video w-full",
          )}
        >
          <TelaYoutube video={video} titulo={titulo} iniciar={iniciar} />
        </div>
      </div>
      <a href={linkYoutube(video)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 justify-self-center text-xs text-ink-3 hover:text-ink">
        <ExternalLink className="size-3.5" /> Abrir no YouTube
      </a>
    </div>
  )
}
