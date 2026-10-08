export type Provedor = "anthropic" | "openai" | "gemini"

export type InfoProvedor = {
  id: Provedor
  nome: string
  empresa: string
  modeloPadrao: string
  exemploModelos: string
  /** Onde criar a chave. */
  painel: string
  dica: string
}

export const PROVEDORES: InfoProvedor[] = [
  {
    id: "anthropic",
    nome: "Claude",
    empresa: "Anthropic",
    modeloPadrao: "claude-sonnet-5-5",
    exemploModelos: "claude-sonnet-5-5, claude-opus-5-5, claude-haiku-4-5-20251001",
    painel: "https://console.anthropic.com/settings/keys",
    dica: "Crie em console.anthropic.com, em API Keys. Começa com sk-ant-.",
  },
  {
    id: "openai",
    nome: "ChatGPT",
    empresa: "OpenAI",
    modeloPadrao: "gpt-5-mini",
    exemploModelos: "gpt-5-mini, gpt-5",
    painel: "https://platform.openai.com/api-keys",
    dica: "Crie em platform.openai.com, em API keys. Começa com sk-.",
  },
  {
    id: "gemini",
    nome: "Gemini",
    empresa: "Google",
    modeloPadrao: "gemini-2.5-flash",
    exemploModelos: "gemini-2.5-flash, gemini-2.5-pro",
    painel: "https://aistudio.google.com/apikey",
    dica: "Crie no Google AI Studio, em Get API key.",
  },
]

export const infoProvedor = (id: string) => PROVEDORES.find((p) => p.id === id)

