// Rótulos em português para os códigos guardados no banco.

export const STATUS_TAREFA = {
  todo: "A fazer",
  doing: "Fazendo",
  done: "Feito",
} as const
export type StatusTarefa = keyof typeof STATUS_TAREFA

export const PRIORIDADE = {
  urgente: "Urgente",
  necessario: "Necessário",
  bom_fazer: "Bom fazer",
} as const
export type Prioridade = keyof typeof PRIORIDADE

export const TIPO_TAREFA = {
  tarefa: "Tarefa",
  rotina: "Rotina",
} as const

export const STATUS_LIVRO = {
  lendo: "Lendo",
  pausado: "Pausado",
  finalizado: "Lido",
  desejo: "Quero ler",
} as const
export type StatusLivro = keyof typeof STATUS_LIVRO

export const STATUS_CURSO = {
  em_andamento: "Em andamento",
  nao_comecou: "Não começou",
  pausado: "Pausado",
  concluido: "Concluído",
} as const
export type StatusCurso = keyof typeof STATUS_CURSO

export const STATUS_EXPERIMENTO = {
  a_iniciar: "A iniciar",
  em_teste: "Em teste",
  pausado: "Pausado",
  concluido: "Concluído",
  abandonado: "Abandonado",
} as const
export type StatusExperimento = keyof typeof STATUS_EXPERIMENTO

export const RESULTADO_EXPERIMENTO = {
  indefinido: "Indefinido",
  funcionou: "Funcionou",
  parcial: "Parcial",
  nao_funcionou: "Não funcionou",
} as const

export const STATUS_CONTEUDO = {
  ideia: "Ideia",
  idealizando: "Idealizando",
  gravando: "Gravando",
  editando: "Editando",
  finalizado: "Finalizado",
  publicado: "Publicado",
} as const
export type StatusConteudo = keyof typeof STATUS_CONTEUDO

export const FORMATOS_CONTEUDO = ["Carrossel", "Reels/Shorts", "Vídeo", "Imagem", "Stories", "Texto"] as const

export const TIPOS_CAPTURA = ["Anotação", "Ideia", "Citação", "Metodologia", "Vídeo", "Link"] as const

export const CATEGORIAS_CAPTURA = [
  "Marketing Digital & Vendas",
  "Desenvolvimento & Produtividade",
  "Mídias Sociais & Design",
  "Tecnologia & IA",
  "Produtos & Negócios",
  "Conhecimento & Espiritualidade",
  "Diversos",
] as const

export const CATEGORIAS_EVENTO = ["Compromisso", "Reunião", "Aniversário", "Viagem", "Saúde", "Estudo"] as const

export const STATUS_AREA = {
  ativa: "Acontecendo",
  nao_iniciada: "Não iniciada",
  arquivada: "Arquivada",
} as const
