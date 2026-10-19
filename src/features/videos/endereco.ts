/** Quem abre o feed de dentro do app marca a volta: o "fechar" do feed volta para lá em vez de abrir outra tela. */
export const CHAVE_VOLTA_DO_FEED = "feed:volta"

export function marcarVoltaDoFeed() {
  try {
    sessionStorage.setItem(CHAVE_VOLTA_DO_FEED, "1")
  } catch {}
}

/**
 * Endereço do feed: de um hobby (só de uma página do material, com `grupo`), de uma página ou de
 * todos os hobbies, começando num vídeo.
 */
export function enderecoDoFeed(escopo: { hobby?: string; pagina?: string; grupo?: string; video?: string } = {}) {
  const p = new URLSearchParams()
  if (escopo.hobby) p.set("hobby", escopo.hobby)
  if (escopo.pagina) p.set("pagina", escopo.pagina)
  if (escopo.grupo) p.set("g", escopo.grupo)
  if (escopo.video) p.set("v", escopo.video)
  const q = p.toString()
  return q ? `/assistir?${q}` : "/assistir"
}
