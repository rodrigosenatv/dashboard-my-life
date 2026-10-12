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
import { novoId, useCriar } from "@/lib/data"
import { normalizar } from "@/lib/utils"
import { useArvorePaginas } from "@/features/paginas/dados"

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

// Hoje todos os atalhos levam a telas do app; a árvore de páginas só é buscada se algum voltar a abrir uma página pelo título
const ALGUM_ATALHO_ABRE_PAGINA = MENU.some((a) => a.paginas?.length)

// Cartões de papel: a cor fica para a capa; aqui o petróleo aparece só no ícone
const estiloAtalho =
  "group flex h-14 items-center gap-3 rounded-lg border border-line bg-surface px-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2"

function Conteudo({ a }: { a: Atalho }) {
  const Icone = a.icone
  return (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-pen-soft text-pen">
        <Icone aria-hidden className="size-[1.125rem]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 truncate text-sm font-medium">{a.rotulo}</span>
    </>
  )
}

export function MenuAtalhos() {
  const router = useRouter()
  const { data: paginas = [] } = useArvorePaginas({ enabled: ALGUM_ATALHO_ABRE_PAGINA })
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
    <nav aria-label="Atalhos">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
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
