"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import {
  Brain,
  CirclePlay,
  Crown,
  Dumbbell,
  FolderOpen,
  GraduationCap,
  Microscope,
  NotebookPen,
  Plane,
  Popcorn,
  Rocket,
  Shirt,
  SquareCheck,
  Sun,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useUrlArquivo } from "@/components/markdown"
import { novoId, useCriar } from "@/lib/data"
import { normalizar } from "@/lib/utils"
import { useConfiguracoes } from "@/features/configuracoes/dados"
import { useArvorePaginas } from "@/features/paginas/dados"

export const FRASE_PADRAO = "A vida é agora, agradece e vai!"

/* ------------------------------------------------------------------ */
/* Capa                                                                */
/* ------------------------------------------------------------------ */

export function Capa() {
  const { data: cfg } = useConfiguracoes()
  const prefs = (cfg?.prefs ?? {}) as { frase?: string; capa?: string }
  const frase = prefs.frase?.trim() || FRASE_PADRAO
  const { data: urlCapa } = useUrlArquivo(prefs.capa || null)

  if (urlCapa) {
    return (
      <div className="-mx-4 mb-8 overflow-hidden sm:-mx-6 lg:mx-0 lg:rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={urlCapa} alt={`Capa: My life. ${frase}`} className="h-44 w-full object-cover sm:h-56" />
      </div>
    )
  }

  return (
    <div className="relative -mx-4 mb-8 overflow-hidden bg-petroleo px-6 py-9 text-petroleo-tinta sm:-mx-6 sm:py-12 lg:mx-0 lg:rounded-xl">
      {/* Textura discreta de papel de parede, como na capa do Notion */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #fff 0 1px, transparent 1px 64px), repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 64px)",
        }}
      />
      <div className="relative mx-auto flex max-w-xl flex-col items-center text-center">
        <p className="font-assinatura text-6xl leading-none sm:text-7xl">My life</p>
        <p className="mt-3 text-base text-white/85 sm:text-lg">“{frase}”</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */

type Atalho = {
  rotulo: string
  icone: LucideIcon
  /** Rota de um módulo do app. */
  href?: string
  /** Sem módulo próprio: abre a página importada com um destes títulos. */
  paginas?: string[]
}

export const MENU: Atalho[] = [
  { rotulo: "Atividades", icone: SquareCheck, href: "/rotina/tarefas" },
  { rotulo: "Hábitos & Rotinas", icone: Sun, href: "/rotina/habitos" },
  { rotulo: "Flow", icone: Rocket, href: "/vida/flow" },
  { rotulo: "Treino", icone: Dumbbell, href: "/vida/treino" },
  { rotulo: "Alimentação", icone: UtensilsCrossed, href: "/vida/alimentacao" },
  { rotulo: "Viagens", icone: Plane, href: "/vida/viagens" },
  { rotulo: "Hobbies", icone: Crown, href: "/vida/hobbies" },
  { rotulo: "Pessoal", icone: FolderOpen, href: "/vida/pessoal" },
  { rotulo: "Planner de Conteúdo", icone: CirclePlay, href: "/conteudo/planner" },
  { rotulo: "Filmes & Séries", icone: Popcorn, href: "/vida/filmes-series" },
  { rotulo: "Guarda Roupa", icone: Shirt, href: "/vida/guarda-roupa" },
  { rotulo: "Segundo Cérebro", icone: Brain, href: "/projetos" },
  { rotulo: "Anotações", icone: NotebookPen, href: "/projetos/capturas" },
  { rotulo: "Dominando a IA", icone: Zap, href: "/conteudo/biblioteca" },
  { rotulo: "Laboratório", icone: Microscope, href: "/estudos/laboratorio" },
  { rotulo: "SCA", icone: GraduationCap, href: "/estudos/concursos" },
]

const estiloAtalho =
  "group flex h-[4.5rem] items-center justify-center gap-2.5 rounded-lg border border-petroleo-borda bg-petroleo-2 px-3 text-center text-petroleo-tinta transition-colors hover:bg-petroleo hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen sm:h-20"

function Conteudo({ a }: { a: Atalho }) {
  const Icone = a.icone
  return (
    <>
      <Icone aria-hidden className="size-6 shrink-0 sm:size-7" strokeWidth={1.75} />
      <span className="text-[0.95rem] font-semibold leading-tight sm:text-base">{a.rotulo}</span>
    </>
  )
}

export function MenuAtalhos() {
  const router = useRouter()
  const { data: paginas = [] } = useArvorePaginas()
  const criar = useCriar("pages")

  // Título normalizado -> página (prefere as de primeiro nível)
  const porTitulo = React.useMemo(() => {
    const m = new Map<string, string>()
    const ordenadas = [...paginas].sort((x, y) => Number(Boolean(x.parent_id)) - Number(Boolean(y.parent_id)))
    for (const p of ordenadas) {
      const k = normalizar(p.title)
      if (!m.has(k)) m.set(k, p.id)
    }
    return m
  }, [paginas])

  const abrirPagina = (a: Atalho) => {
    const id = a.paginas!.map((t) => porTitulo.get(normalizar(t))).find(Boolean)
    if (id) return router.push(`/paginas/${id}`)
    const nova = novoId()
    criar.mutate(
      { id: nova, title: a.paginas![0], section: "geral", content: "" },
      {
        onSuccess: () => router.push(`/paginas/${nova}`),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <nav aria-label="Menu" className="mb-12">
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {MENU.map((a) => (
          <li key={a.rotulo}>
            {a.href ? (
              <Link href={a.href} className={estiloAtalho}>
                <Conteudo a={a} />
              </Link>
            ) : (
              <button type="button" onClick={() => abrirPagina(a)} className={`${estiloAtalho} w-full`}>
                <Conteudo a={a} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
