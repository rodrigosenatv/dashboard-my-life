/*
 * Cliente do TMDB no navegador. A chave é a que a pessoa colou nas preferências da conta. As respostas
 * viram dados prontos pelos leitores puros de logica.ts.
 */
import { lerDetalhes, lerResultadosBusca, type Detalhes, type ResultadoBusca } from "./logica"

const API = "https://api.themoviedb.org/3"

/** Erro devolvido pelo TMDB (chave errada, limite de uso…), com o código HTTP e a mensagem dele. */
export class ErroTmdb extends Error {
  readonly status: number

  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.name = "ErroTmdb"
    this.status = status
  }
}

/** Uma chamada à API. Token de leitura (começa com "eyJ") vai no cabeçalho; a chave antiga vai no endereço. */
export async function chamarTmdb<T>(chave: string, caminho: string, params: Record<string, string> = {}, sinal?: AbortSignal): Promise<T> {
  const endereco = new URL(API + caminho)
  endereco.searchParams.set("language", "pt-BR")
  for (const [nome, valor] of Object.entries(params)) endereco.searchParams.set(nome, valor)
  const cabecalhos: Record<string, string> = { Accept: "application/json" }
  if (chave.startsWith("eyJ")) cabecalhos.Authorization = `Bearer ${chave}`
  else endereco.searchParams.set("api_key", chave)
  const resposta = await fetch(endereco, { headers: cabecalhos, signal: sinal })
  const json = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new ErroTmdb(resposta.status, json.status_message ?? `Erro ${resposta.status}`)
  return json as T
}

/** Confere a chave: lança erro se o TMDB não aceitar. */
export async function testarChave(chave: string, sinal?: AbortSignal): Promise<void> {
  await chamarTmdb(chave, "/configuration", {}, sinal)
}

/** A busca geral (filmes e séries; pessoas saem na leitura). */
export async function buscarNoTmdb(chave: string, termo: string, sinal?: AbortSignal): Promise<ResultadoBusca[]> {
  const json = await chamarTmdb<unknown>(chave, "/search/multi", { query: termo, include_adult: "false", page: "1" }, sinal)
  return lerResultadosBusca(json)
}

/** Sinopse, duração, temporadas, trailer e onde assistir, numa chamada só. */
export async function detalhesNoTmdb(chave: string, tipo: "movie" | "tv", id: number, sinal?: AbortSignal): Promise<Detalhes> {
  const json = await chamarTmdb<unknown>(
    chave,
    `/${tipo}/${id}`,
    { append_to_response: "videos,watch/providers", include_video_language: "pt,en,null" },
    sinal,
  )
  return lerDetalhes(json, tipo)
}
