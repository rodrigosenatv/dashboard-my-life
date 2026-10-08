import {
  Archive,
  BookOpen,
  Boxes,
  StickyNote,
  Shapes,
  CalendarDays,
  CircleCheck,
  ClipboardCheck,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  Inbox,
  Layers,
  Library,
  Link2,
  ListTodo,
  MessageSquareText,
  NotebookText,
  Settings,
  Sun,
  Clapperboard,
  Crown,
  Dumbbell,
  FolderOpen,
  Plane,
  Popcorn,
  Rocket,
  Shirt,
  UtensilsCrossed,
  Target,
  type LucideIcon,
} from "lucide-react"
import type { Area } from "./areas"

export type ItemNav = {
  rotulo: string
  href: string
  icone: LucideIcon
}

export type GrupoNav = {
  area: Area
  rotulo: string
  inicio: string
  itens: ItemNav[]
}

export const HOJE: ItemNav = { rotulo: "Hoje", href: "/", icone: Sun }

export const GRUPOS: GrupoNav[] = [
  {
    area: "rotina",
    rotulo: "Rotina",
    inicio: "/rotina/habitos",
    itens: [
      { rotulo: "Hábitos", href: "/rotina/habitos", icone: CircleCheck },
      { rotulo: "Tarefas", href: "/rotina/tarefas", icone: ListTodo },
      { rotulo: "Agenda", href: "/rotina/agenda", icone: CalendarDays },
      { rotulo: "Metas", href: "/rotina/metas", icone: Target },
    ],
  },
  {
    area: "projetos",
    rotulo: "Segundo Cérebro",
    inicio: "/projetos",
    itens: [
      { rotulo: "Caixa de Entrada", href: "/projetos/entrada", icone: Inbox },
      { rotulo: "Anotações", href: "/projetos/capturas", icone: StickyNote },
      { rotulo: "Projetos", href: "/projetos", icone: FolderKanban },
      { rotulo: "Áreas", href: "/projetos/areas", icone: Shapes },
      { rotulo: "Recursos", href: "/projetos/recursos", icone: Boxes },
      { rotulo: "Arquivo", href: "/projetos/arquivo", icone: Archive },
      { rotulo: "Páginas", href: "/projetos/notas", icone: NotebookText },
    ],
  },
  {
    area: "estudos",
    rotulo: "Estudos",
    inicio: "/estudos/leitura",
    itens: [
      { rotulo: "Leitura", href: "/estudos/leitura", icone: BookOpen },
      { rotulo: "Cursos", href: "/estudos/cursos", icone: GraduationCap },
      { rotulo: "Concursos", href: "/estudos/concursos", icone: ClipboardCheck },
      { rotulo: "Laboratório", href: "/estudos/laboratorio", icone: FlaskConical },
    ],
  },
  {
    area: "conteudo",
    rotulo: "Conteúdo e IA",
    inicio: "/conteudo/biblioteca",
    itens: [
      { rotulo: "Biblioteca", href: "/conteudo/biblioteca", icone: Library },
      { rotulo: "Planner", href: "/conteudo/planner", icone: Clapperboard },
      { rotulo: "Assistente", href: "/conteudo/assistente", icone: MessageSquareText },
    ],
  },
]

GRUPOS.push({
  area: "geral",
  rotulo: "Vida pessoal",
  inicio: "/vida/flow",
  itens: [
    { rotulo: "Flow", href: "/vida/flow", icone: Rocket },
    { rotulo: "Treino", href: "/vida/treino", icone: Dumbbell },
    { rotulo: "Alimentação", href: "/vida/alimentacao", icone: UtensilsCrossed },
    { rotulo: "Viagens", href: "/vida/viagens", icone: Plane },
    { rotulo: "Hobbies", href: "/vida/hobbies", icone: Crown },
    { rotulo: "Pessoal", href: "/vida/pessoal", icone: FolderOpen },
    { rotulo: "Filmes & Séries", href: "/vida/filmes-series", icone: Popcorn },
    { rotulo: "Guarda Roupa", href: "/vida/guarda-roupa", icone: Shirt },
  ],
})

export const EXTRAS: ItemNav[] = [
  { rotulo: "Coleções", href: "/colecoes", icone: Layers },
  { rotulo: "Links úteis", href: "/links", icone: Link2 },
  { rotulo: "Configurações", href: "/configuracoes", icone: Settings },
]

export function ativo(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  if (href === "/projetos") return pathname === "/projetos" || /^\/projetos\/(?!capturas|notas|entrada|recursos|arquivo|areas)[^/]+/.test(pathname)
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function grupoDaRota(pathname: string): GrupoNav | undefined {
  return GRUPOS.find((g) => g.itens.some((i) => ativo(pathname, i.href)))
}
