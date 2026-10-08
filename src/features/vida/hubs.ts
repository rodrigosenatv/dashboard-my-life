import { Crown, Dumbbell, FolderOpen, Plane, Popcorn, Rocket, Shirt, UtensilsCrossed, type LucideIcon } from "lucide-react"
import type { VisaoColecao } from "@/features/colecoes/visao-colecao"

/** Um banco do Notion mostrado dentro da página de Vida pessoal. */
export type BlocoBanco = {
  tipo: "colecao"
  /** Nomes possíveis do banco (sem o "Database:"). O primeiro que existir é usado. */
  nomes: string[]
  titulo?: string
  abas?: string | false
  visao?: VisaoColecao
  marcar?: string
  limite?: number
  /** Ocupa a largura toda em vez de meia coluna. */
  largo?: boolean
}

export type Bloco =
  | BlocoBanco
  | { tipo: "pomodoro" }
  | { tipo: "hoje" }
  | { tipo: "ferramentas" }
  | { tipo: "subpaginas" }
  | { tipo: "texto" }

export type Hub = {
  slug: string
  titulo: string
  icone: LucideIcon
  /** Títulos da página no Notion (para achar o texto e as subpáginas importadas). */
  paginas: string[]
  descricao: string
  blocos: Bloco[]
}

/**
 * As páginas de vida pessoal do menu do Notion. Cada uma junta os bancos que
 * moravam nela, com as mesmas visões (abas por status, galeria, calendário).
 */
export const HUBS: Hub[] = [
  {
    slug: "flow",
    titulo: "Flow",
    icone: Rocket,
    paginas: ["Flow"],
    descricao: "Modo foco: o que fazer agora, o timer e as ferramentas à mão.",
    blocos: [{ tipo: "hoje" }, { tipo: "pomodoro" }, { tipo: "ferramentas" }, { tipo: "texto" }],
  },
  {
    slug: "treino",
    titulo: "Treino",
    icone: Dumbbell,
    paginas: ["Treinos", "Treino"],
    descricao: "Calendário de treinos, fichas, exercícios e avaliação corporal.",
    blocos: [
      { tipo: "colecao", nomes: ["Calendário de Treinos", "Calendario de Treinos"], titulo: "Calendário", visao: "calendario", largo: true },
      { tipo: "colecao", nomes: ["Treino", "Treinos"], titulo: "Treinos", visao: "tabela" },
      { tipo: "colecao", nomes: ["Exercícios", "Exercicios", "Lista de Exercícios"], titulo: "Exercícios", visao: "tabela", limite: 15 },
      { tipo: "colecao", nomes: ["Grupos Musculares"], titulo: "Grupos musculares", visao: "galeria" },
      { tipo: "colecao", nomes: ["Avaliação Corporal", "Avaliacao Corporal"], titulo: "Avaliação corporal", visao: "tabela" },
      { tipo: "texto" },
    ],
  },
  {
    slug: "alimentacao",
    titulo: "Alimentação",
    icone: UtensilsCrossed,
    paginas: ["Alimentação"],
    descricao: "Plano alimentar, receitas e a tabela de alimentos.",
    blocos: [
      { tipo: "colecao", nomes: ["Refeições", "Refeicoes", "Plano Alimentar"], titulo: "Plano alimentar", largo: true },
      { tipo: "colecao", nomes: ["Receitas"], titulo: "Receitas", visao: "galeria", largo: true },
      { tipo: "colecao", nomes: ["Alimentos"], titulo: "Alimentos", visao: "tabela", limite: 20, largo: true },
      { tipo: "texto" },
    ],
  },
  {
    slug: "viagens",
    titulo: "Viagens",
    icone: Plane,
    paginas: ["Viagens", "Viagem"],
    descricao: "Planejadas, lista de desejos e realizadas, com roteiro e custos.",
    blocos: [
      { tipo: "colecao", nomes: ["Viagens"], titulo: "Viagens", abas: "Status", visao: "galeria", largo: true },
      { tipo: "colecao", nomes: ["Itinerários Viagens", "Itinerarios Viagens", "Itinerários"], titulo: "Itinerários", visao: "tabela" },
      { tipo: "colecao", nomes: ["Custos Viagens", "Custos"], titulo: "Custos", visao: "tabela" },
      { tipo: "texto" },
    ],
  },
  {
    slug: "hobbies",
    titulo: "Hobbies",
    icone: Crown,
    paginas: ["Hobbies"],
    descricao: "Boxe, musculação, comunicação, piano e o que mais você estiver aprendendo.",
    blocos: [{ tipo: "subpaginas" }, { tipo: "texto" }],
  },
  {
    slug: "pessoal",
    titulo: "Pessoal",
    icone: FolderOpen,
    paginas: ["Pessoal"],
    descricao: "Sua wiki pessoal e anotações sobre você.",
    blocos: [{ tipo: "colecao", nomes: ["Wiki Pessoal"], titulo: "Wiki pessoal", largo: true }, { tipo: "subpaginas" }, { tipo: "texto" }],
  },
  {
    slug: "filmes-series",
    titulo: "Filmes & Séries",
    icone: Popcorn,
    paginas: ["Filmes e Séries", "Filmes & Séries"],
    descricao: "O que assistir, o que já viu e a nota que deu.",
    blocos: [{ tipo: "colecao", nomes: ["Filmes e Séries", "Filmes & Séries"], titulo: "Filmes e séries", abas: "Filme/Série", marcar: "Assistido", largo: true }, { tipo: "texto" }],
  },
  {
    slug: "guarda-roupa",
    titulo: "Guarda Roupa",
    icone: Shirt,
    paginas: ["Guarda Roupa", "Guarda-Roupa"],
    descricao: "Peças, outfits e a lista de desejos.",
    blocos: [
      { tipo: "colecao", nomes: ["Guarda Roupa", "Guarda-Roupa"], titulo: "Roupas", visao: "galeria", largo: true },
      { tipo: "colecao", nomes: ["Outfit", "Outfits"], titulo: "Outfits", visao: "galeria", largo: true },
      { tipo: "texto" },
    ],
  },
]

export const hubPorSlug = (slug: string) => HUBS.find((h) => h.slug === slug)
