"use client"

import * as React from "react"
import { useUrlArquivo } from "@/lib/arquivos"
import { cn } from "@/lib/utils"
import { capaDoLivro, codigoDoLivro, espessura, tonsDaCapa, type LivroBase } from "./logica"

export type LivroDaCapa = Pick<LivroBase, "id" | "title" | "author" | "category" | "cover_path" | "pages_total">

/** Capa de um livro sem foto: as cores saem do título (sempre as mesmas) e o nome fica na frente. */
export function CapaGerada({ livro, className }: { livro: LivroDaCapa; className?: string }) {
  const { a, b } = tonsDaCapa(livro.title)
  return (
    <div aria-hidden className={cn("capa-gerada", className)} style={{ "--h1": a, "--h2": b } as React.CSSProperties}>
      <p className="capa-gerada-titulo">{livro.title}</p>
      <p className="capa-gerada-autor">{livro.author?.trim() || codigoDoLivro(livro)}</p>
    </div>
  )
}

/**
 * A capa do livro: a foto (buscada na internet ou enviada) ou, sem foto, a capa gerada pelo título.
 * Enquanto a foto carrega (ou se ela falhar), a capa gerada fica no lugar; a foto entra suave por cima.
 */
export function CapaLivro({ livro, className, prioridade }: { livro: LivroDaCapa; className?: string; prioridade?: boolean }) {
  const capa = capaDoLivro(livro.cover_path)
  const [falhou, setFalhou] = React.useState<string | null>(null)
  const [carregou, setCarregou] = React.useState<string | null>(null)
  const { data: assinada } = useUrlArquivo(capa?.tipo === "arquivo" ? capa.caminho : null)
  const src = capa?.tipo === "url" ? capa.url : capa?.tipo === "arquivo" ? assinada : null
  const img = React.useRef<HTMLImageElement>(null)
  // Imagem que já estava no cache pode terminar antes do aviso de carregamento chegar
  React.useEffect(() => {
    if (src && img.current?.complete && img.current.naturalWidth > 0) setCarregou(src)
  }, [src])
  const pronta = Boolean(src) && carregou === src
  if (!capa || (src && falhou === src)) return <CapaGerada livro={livro} className={className} />
  return (
    <span className={cn("relative block size-full overflow-hidden", className)}>
      <CapaGerada livro={livro} className={cn("absolute inset-0 transition-opacity duration-500", pronta && "opacity-0")} />
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={img}
          src={src}
          alt=""
          draggable={false}
          loading={prioridade ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setCarregou(src)}
          onError={() => setFalhou(src)}
          className={cn("absolute inset-0 size-full object-cover transition-opacity duration-500", pronta ? "opacity-100" : "opacity-0")}
        />
      ) : null}
    </span>
  )
}

/** A capa em pé, como na prateleira: vinco da lombada, brilho do papel e sombra. */
export function CapaEmPe({ livro, className, children, prioridade }: { livro: LivroDaCapa; className?: string; children?: React.ReactNode; prioridade?: boolean }) {
  return (
    <span className={cn("capa-em-pe block aspect-[2/3]", className)}>
      <span className="capa-imagem block size-full">
        <CapaLivro livro={livro} prioridade={prioridade} />
      </span>
      {children}
    </span>
  )
}

/** O livro inteiro em 3D (frente, páginas, lombada e verso), com a espessura do número de páginas. */
export function Livro3D({ livro, className, deFrente, prioridade }: { livro: LivroDaCapa; className?: string; deFrente?: boolean; prioridade?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn("livro3d", className)}
      data-de-frente={deFrente ? "" : undefined}
      style={{ "--esp-rel": espessura(livro.pages_total) / 2 } as React.CSSProperties}
    >
      <div className="livro3d-corpo">
        <div className="livro3d-verso" />
        <div className="livro3d-lombada" />
        <div className="livro3d-paginas" />
        <div className="livro3d-frente">
          <CapaLivro livro={livro} prioridade={prioridade} />
        </div>
      </div>
    </div>
  )
}
