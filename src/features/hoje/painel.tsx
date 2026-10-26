"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import { useRouter } from "next/navigation"
import * as React from "react"
import {
  Brain,
  CirclePlay,
  Crown,
  Dumbbell,
  FolderOpen,
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
import { grupoDaRota } from "@/lib/navegacao"
import type { Area } from "@/lib/areas"
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
]

// Hoje todos os atalhos levam a telas do app; a árvore de páginas só é buscada se algum voltar a abrir uma página pelo título
const ALGUM_ATALHO_ABRE_PAGINA = MENU.some((a) => a.paginas?.length)

// Ladrilhos de vidro (a página Hoje tem o tema da ponte); o ícone acende na cor da área do destino
const estiloAtalho =
  "group flex h-14 items-center gap-3 rounded-2xl border border-[var(--b-borda)] bg-[var(--b-vidro)] px-3 text-left transition-[border-color,background-color,box-shadow] hover:border-[var(--b-borda-2)] hover:bg-[var(--b-vidro-2)] hover:shadow-[0_12px_30px_-20px_rgb(99_227_255/0.6)]"

const LUZ_DA_AREA: Record<Area, string> = {
  rotina: "var(--b-verde)",
  projetos: "var(--b-violeta)",
  estudos: "var(--b-ambar)",
  conteudo: "#ff7aa6",
  geral: "var(--b-luz)",
}

function Conteudo({ a }: { a: Atalho }) {
  const Icone = a.icone
  const area = a.href ? grupoDaRota(a.href)?.area : undefined
  return (
    <>
      <span className="icone-aceso size-9" style={{ "--cor": LUZ_DA_AREA[area ?? "geral"] } as React.CSSProperties}>
        <Icone aria-hidden className="size-[1.125rem]" strokeWidth={1.75} />
      </span>
      {/* No celular os nomes longos quebram em duas linhas em vez de cortar ("Hábitos & Rotinas") */}
      <span className="line-clamp-2 min-w-0 text-sm font-medium leading-tight transition-colors group-hover:text-ink">{a.rotulo}</span>
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
