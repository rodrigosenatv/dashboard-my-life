"use client"

import * as React from "react"
import { BookOpenCheck, Cloud, FolderOpen, Globe, Link2, MonitorPlay, Play, Send, type LucideIcon } from "lucide-react"
import { useUrlArquivo } from "@/lib/arquivos"
import { cn } from "@/lib/utils"
import { iniciais, plataformaDoLink, tonsDoCurso, type Curso } from "./logica"

const ICONES: Record<string, LucideIcon> = {
  telegram: Send,
  hotmart: MonitorPlay,
  kiwify: MonitorPlay,
  eduzz: MonitorPlay,
  udemy: MonitorPlay,
  alura: MonitorPlay,
  coursera: MonitorPlay,
  domestika: MonitorPlay,
  youtube: Play,
  drive: FolderOpen,
  terabox: Cloud,
  notion: BookOpenCheck,
  link: Link2,
  site: Globe,
}

/** O ícone de onde o curso fica (Telegram, área de membros, Drive…). */
export function IconePlataforma({ id, className }: { id: string; className?: string }) {
  const Icone = ICONES[id] ?? Globe
  return <Icone className={className} aria-hidden />
}

/**
 * A capa do curso: a foto enviada ou, sem ela, uma capa gerada com o tom da categoria e as iniciais.
 * Ocupa a caixa onde estiver (a proporção vem de fora).
 */
export function CapaCurso({ curso, caminho, className, prioridade }: { curso: Pick<Curso, "name" | "categories" | "url">; caminho?: string | null; className?: string; prioridade?: boolean }) {
  const { data: url } = useUrlArquivo(caminho ?? null)
  const [falhou, setFalhou] = React.useState(false)
  const plataforma = plataformaDoLink(curso.url)
  if (caminho && url && !falhou) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        loading={prioridade ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFalhou(true)}
        className={cn("h-full w-full object-cover", className)}
      />
    )
  }
  if (caminho && !url && !falhou) return <div aria-hidden className={cn("h-full w-full animate-pulse bg-white/[0.06]", className)} />
  const { h1, h2 } = tonsDoCurso(curso)
  return (
    <div aria-hidden className={cn("capa-curso", className)} style={{ "--h1": h1, "--h2": h2 } as React.CSSProperties}>
      <span className="capa-curso-anel" />
      <span className="capa-curso-sigla">{iniciais(curso.name)}</span>
      {plataforma ? (
        <span className="absolute bottom-[7%] right-[6%] grid size-[clamp(18px,12cqw,34px)] place-items-center rounded-full bg-black/35 text-white/85 ring-1 ring-white/15 backdrop-blur-sm">
          <IconePlataforma id={plataforma.id} className="size-[55%]" />
        </span>
      ) : null}
    </div>
  )
}
