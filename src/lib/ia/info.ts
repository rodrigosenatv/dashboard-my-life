export type Provedor = "anthropic" | "openai" | "gemini" | "openrouter"

/** Onde um prompt escolhido em outra tela espera até o Assistente abrir (sessionStorage). */
export const CHAVE_PROMPT = "dml-prompt-para-assistente"

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
    modeloPadrao: "auto",
    exemploModelos: "auto, ou uma lista em ordem: gemini-2.5-pro, gemini-2.5-flash",
    painel: "https://aistudio.google.com/apikey",
    dica: "Crie no Google AI Studio, em Get API key.",
  },
  {
    id: "openrouter",
    nome: "OpenRouter",
    empresa: "modelos gratuitos",
    modeloPadrao: "auto",
    exemploModelos: "auto, ou uma lista em ordem: deepseek/deepseek-r1:free, qwen/qwen3-coder:free",
    painel: "https://openrouter.ai/settings/keys",
    dica: "Crie em openrouter.ai, em Keys. Começa com sk-or-. Não precisa de cartão para os modelos gratuitos.",
  },
]

export const infoProvedor = (id: string) => PROVEDORES.find((p) => p.id === id)

