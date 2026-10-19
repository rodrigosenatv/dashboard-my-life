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
    descricao: "O treino de hoje, as fichas e a evolução do corpo.",
    // Treino tem tela própria (src/features/treino), servida em /vida/treino
    blocos: [],
  },
  {
    slug: "alimentacao",
    titulo: "Alimentação",
    icone: UtensilsCrossed,
    paginas: ["Alimentação"],
    descricao: "O plano do dia, a água e as receitas.",
    // Alimentação tem tela própria (src/features/alimentacao), servida em /vida/alimentacao
    blocos: [],
  },
  {
    slug: "viagens",
    titulo: "Viagens",
    icone: Plane,
    paginas: ["Viagens", "Viagem"],
    descricao: "Próximas viagens, lista de desejos e as que você já fez.",
    // Viagens tem tela própria (src/features/viagens), servida em /vida/viagens
    blocos: [],
  },
  {
    slug: "hobbies",
    titulo: "Hobbies",
    icone: Crown,
    paginas: ["Hobbies"],
    descricao: "O que você está aprendendo: a prática da semana e o material de estudo.",
    // Hobbies tem tela própria (src/features/hobbies), servida em /vida/hobbies
    blocos: [],
  },
  {
    slug: "pessoal",
    titulo: "Pessoal",
    icone: FolderOpen,
    paginas: ["Pessoal"],
    descricao: "Seu diário, os aniversários, os contatos e a sua wiki pessoal.",
    // Pessoal tem tela própria (src/features/pessoal), servida em /vida/pessoal
    blocos: [],
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
