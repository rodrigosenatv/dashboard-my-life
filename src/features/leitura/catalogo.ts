"use client"

/*
 * Busca de livros na internet, direto do navegador: Google Books (o que mais tem livros em português)
 * e, quando ele falha ou não acha, a Open Library. Nenhum dos dois pede chave.
 */
import {
  capaGrandeGoogle,
  consultaDeBusca,
  lerDocOpenLibrary,
  lerVolumeGoogle,
  semRepetidos,
  sinopseEmTexto,
  urlDeCapaSegura,
  type ResultadoLivro,
} from "./logica"

const GOOGLE = "https://www.googleapis.com/books/v1/volumes"
const OPEN_LIBRARY = "https://openlibrary.org/search.json"
const CAMPOS_OPEN_LIBRARY = "key,title,author_name,cover_i,number_of_pages_median,first_publish_year,language,publisher,isbn"

/** O Google limitou as buscas por um tempo (muitas seguidas). */
export class BuscaOcupada extends Error {
  constructor() {
    super("A busca de livros está ocupada. Tente de novo em instantes.")
  }
}

async function pedir(url: string, sinal?: AbortSignal, prazo = 9000): Promise<unknown> {
  const tempo = new AbortController()
  const t = setTimeout(() => tempo.abort(), prazo)
  const aoAbortar = () => tempo.abort()
  sinal?.addEventListener("abort", aoAbortar)
  try {
    const r = await fetch(url, { signal: tempo.signal, referrerPolicy: "no-referrer", credentials: "omit" })
    if (r.status === 429 || r.status === 403) throw new BuscaOcupada()
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.json()
  } finally {
    clearTimeout(t)
    sinal?.removeEventListener("abort", aoAbortar)
  }
}

async function buscarNoGoogle(consulta: string, max: number, sinal?: AbortSignal): Promise<ResultadoLivro[]> {
  const url = `${GOOGLE}?q=${encodeURIComponent(consulta)}&maxResults=${max}&printType=books&orderBy=relevance`
  const dados = (await pedir(url, sinal)) as { items?: unknown[] }
  return (dados.items ?? []).map(lerVolumeGoogle).filter((r): r is ResultadoLivro => r !== null)
}

async function buscarNaOpenLibrary(consulta: string, max: number, sinal?: AbortSignal): Promise<ResultadoLivro[]> {
  const isbn = consulta.startsWith("isbn:") ? consulta.slice(5) : null
  const url = isbn
    ? `${OPEN_LIBRARY}?isbn=${encodeURIComponent(isbn)}&limit=${max}&fields=${CAMPOS_OPEN_LIBRARY}`
    : `${OPEN_LIBRARY}?q=${encodeURIComponent(consulta)}&limit=${max}&fields=${CAMPOS_OPEN_LIBRARY}`
  const dados = (await pedir(url, sinal)) as { docs?: unknown[] }
  return (dados.docs ?? []).map(lerDocOpenLibrary).filter((r): r is ResultadoLivro => r !== null)
}

/**
 * Livros que combinam com o que foi digitado (título, autor ou ISBN). Primeiro o Google; a Open
 * Library entra quando o Google falha ou não acha nada.
 */
export async function buscarLivros(termo: string, { sinal, max = 12 }: { sinal?: AbortSignal; max?: number } = {}): Promise<ResultadoLivro[]> {
  const consulta = consultaDeBusca(termo)
  if (consulta.length < 2) return []
  let doGoogle: ResultadoLivro[] = []
  let falhaGoogle: unknown = null
  try {
    doGoogle = await buscarNoGoogle(consulta, max, sinal)
  } catch (e) {
    if (sinal?.aborted) throw e
    falhaGoogle = e
  }
  if (doGoogle.length) return semRepetidos(doGoogle)
  try {
    return semRepetidos(await buscarNaOpenLibrary(consulta, max, sinal))
  } catch (e) {
    if (sinal?.aborted) throw e
    throw falhaGoogle ?? e
  }
}

export type DetalhesLivro = {
  /** A maior capa disponível (https). */
  capa: string | null
  sinopse: string
  paginas: number | null
  categorias: string[]
  editora: string | null
}

/** Detalhes de um volume do Google Books: capa grande e sinopse. */
export async function detalhesGoogle(googleId: string, sinal?: AbortSignal): Promise<DetalhesLivro> {
  const dados = (await pedir(`${GOOGLE}/${encodeURIComponent(googleId)}`, sinal)) as { volumeInfo?: Record<string, unknown> }
  const v = dados.volumeInfo ?? {}
  return {
    capa: capaGrandeGoogle(v.imageLinks),
    sinopse: sinopseEmTexto(typeof v.description === "string" ? v.description : ""),
    paginas: typeof v.pageCount === "number" && v.pageCount > 0 ? v.pageCount : null,
    categorias: Array.isArray(v.categories) ? v.categories.filter((c): c is string => typeof c === "string") : [],
    editora: typeof v.publisher === "string" ? v.publisher : null,
  }
}

/** A capa para guardar: a grande do Google (ou a pequena, se os detalhes falharem) ou a grande da Open Library. */
export async function capaParaGuardar(r: ResultadoLivro, sinal?: AbortSignal): Promise<string | null> {
  if (r.fonte === "google" && r.googleId) {
    try {
      const d = await detalhesGoogle(r.googleId, sinal)
      if (d.capa) return d.capa
    } catch (e) {
      if (sinal?.aborted) throw e
    }
    return r.capa
  }
  if (r.capaOpenLibrary) return urlDeCapaSegura(`https://covers.openlibrary.org/b/id/${r.capaOpenLibrary}-L.jpg`)
  return r.capa
}

export const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms))
