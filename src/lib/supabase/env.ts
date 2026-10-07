// Variáveis públicas do Supabase. Aceita tanto a chave nova (publishable)
// quanto a antiga (anon), para funcionar com qualquer projeto.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ""

export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_KEY)

export const BUCKET_ARQUIVOS = "arquivos"
