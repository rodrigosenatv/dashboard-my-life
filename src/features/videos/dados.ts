"use client"

import * as React from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { buscarTodos, novoId, useAtualizar, useCriar } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import type { PaginaResumo } from "@/features/paginas/dados"
import { lerIds, useDadosHobbies, useGravarHobbies, usePaginasDosHobbies, type Hobby } from "@/features/hobbies/dados"
import { comSubpaginas, inserirVideo, montarFeed, removerVideo, type FontePagina, type ItemFeed } from "./logica"

/** Uma página onde dá para pôr vídeos, com o hobby dela (para criar página nova e para agrupar na lista). */
export type Destino = { id: string; titulo: string; nivel: number; hobby: Hobby | null }

type Fonte = Omit<FontePagina, "conteudo"> & { nivel: number; hobby: Hobby | null }

const tituloDe = (p: PaginaResumo) => p.title.trim() || "Sem título"

/**
 * As páginas de estudo de um hobby e as subpáginas delas, na ordem do material. O grupo (filtro
 * do feed) é a página do material: os vídeos das subpáginas contam junto com ela.
 */
function fontesDoHobby(hobby: Hobby, arvore: PaginaResumo[], porId: Map<string, PaginaResumo>): Fonte[] {
  const raizes = hobby.paginas.map((id) => porId.get(id)).filter((p): p is PaginaResumo => Boolean(p))
  return comSubpaginas(raizes, arvore).map(({ pagina, nivel, raiz }) => ({ id: pagina.id, titulo: tituloDe(pagina), grupo: raiz.id, grupoTitulo: tituloDe(raiz), nivel, hobby }))
}

/** Quantos vídeos cada grupo tem (no hobby: cada página do material, com as subpáginas). */
export function contarPorGrupo(videos: ItemFeed[]): Map<string, number> {
  const mapa = new Map<string, number>()
  for (const v of videos) mapa.set(v.grupo, (mapa.get(v.grupo) ?? 0) + 1)
  return mapa
}

/**
 * O texto de várias páginas numa consulta só (o mesmo cache serve o feed, o hobby e o material).
 * Quando entra uma página nova na lista, o que já estava na tela fica até a resposta chegar.
 */
export function useConteudos(ids: string[]) {
  const chave = React.useMemo(() => [...new Set(ids)].sort().join(","), [ids])
  const { data, isLoading, isFetching, error } = useQuery({
    // Começa com "pages": as gravações de páginas atualizam este cache na hora, como as outras listas
    queryKey: ["pages", "conteudo", chave],
    enabled: Boolean(chave),
    placeholderData: keepPreviousData,
    queryFn: () =>
      buscarTodos<{ id: string; content: string }>((de, ate) =>
        supabase().from("pages").select("id,content").in("id", chave.split(",")).order("id", { ascending: true }).range(de, ate),
      ),
  })
  const conteudos = React.useMemo(() => new Map((chave ? (data ?? []) : []).map((p) => [p.id, p.content])), [data, chave])
  return { conteudos, carregando: Boolean(chave) && isLoading, atualizando: Boolean(chave) && isFetching, erro: error }
}

/** Os vídeos de um hobby: os das páginas do material e das subpáginas delas. */
export function useVideosDoHobby(hobby: Hobby | undefined, arvore: PaginaResumo[], porId: Map<string, PaginaResumo>) {
  const fontes = React.useMemo(() => (hobby ? fontesDoHobby(hobby, arvore, porId) : []), [hobby, arvore, porId])
  const { conteudos, carregando, erro } = useConteudos(React.useMemo(() => fontes.map((f) => f.id), [fontes]))
  const videos = React.useMemo(() => montarFeed(fontes.map((f) => ({ ...f, conteudo: conteudos.get(f.id) }))), [fontes, conteudos])
  const destinos = React.useMemo<Destino[]>(() => fontes.map((f) => ({ id: f.id, titulo: f.titulo, nivel: f.nivel, hobby: f.hobby })), [fontes])
  return { fontes, videos, destinos, carregando, erro }
}

/**
 * O feed: os vídeos de um hobby (com filtro por página), de uma página (e das subpáginas)
 * ou de todos os hobbies (com filtro por hobby).
 */
export function useFeed({ hobby: hobbyId, pagina: paginaId }: { hobby: string | null; pagina: string | null }) {
  const { hobbies, carregando: carregandoHobbies, erro: erroHobbies } = useDadosHobbies()
  const { pagina: paginaHobbies, paginas: arvore, porId, carregando: carregandoPaginas } = usePaginasDosHobbies()

  const hobby = hobbyId ? hobbies.find((h) => h.id === hobbyId) : undefined
  const paginaRaiz = paginaId ? porId.get(paginaId) : undefined

  const fontes = React.useMemo<Fonte[]>(() => {
    if (paginaRaiz) {
      // O hobby da página (quando ela é do material de algum), para poder criar página nova nele
      const dono = hobbies.find((h) => fontesDoHobby(h, arvore, porId).some((f) => f.id === paginaRaiz.id)) ?? null
      return comSubpaginas([paginaRaiz], arvore).map(({ pagina, nivel }) => ({ id: pagina.id, titulo: tituloDe(pagina), grupo: pagina.id, grupoTitulo: tituloDe(pagina), nivel, hobby: dono }))
    }
    if (hobbyId) return hobby ? fontesDoHobby(hobby, arvore, porId) : []
    return hobbies.flatMap((h) => fontesDoHobby(h, arvore, porId).map((f) => ({ ...f, grupo: h.id, grupoTitulo: h.nome })))
  }, [paginaRaiz, hobbyId, hobby, hobbies, arvore, porId])

  const { conteudos, carregando: carregandoTextos, atualizando, erro: erroTextos } = useConteudos(React.useMemo(() => fontes.map((f) => f.id), [fontes]))
  const videos = React.useMemo<ItemFeed[]>(() => montarFeed(fontes.map((f) => ({ ...f, conteudo: conteudos.get(f.id) }))), [fontes, conteudos])
  const destinos = React.useMemo<Destino[]>(() => fontes.map((f) => ({ id: f.id, titulo: f.titulo, nivel: f.nivel, hobby: f.hobby })), [fontes])

  const carregando = carregandoHobbies || carregandoPaginas || carregandoTextos
  const naoAchado = !carregandoHobbies && !carregandoPaginas && ((paginaId && !paginaRaiz) || (hobbyId && !paginaId && !hobby))
  const titulo = paginaRaiz ? tituloDe(paginaRaiz) : hobby ? hobby.nome : "Todos os hobbies"
  return { hobby, hobbies, paginaRaiz, paginaHobbies, arvore, fontes, destinos, videos, titulo, carregando, atualizando, naoAchado: Boolean(naoAchado), erro: erroHobbies ?? erroTextos }
}

/** Falha ao ler a página antes de mexer nela (as falhas ao gravar já aparecem num aviso das gravações). */
export class ErroAoLerPagina extends Error {}

/** O texto da página como está no banco agora (para não gravar por cima de algo mudado em outro aparelho). */
async function textoNoBanco(id: string): Promise<string> {
  const { data, error } = await supabase().from("pages").select("content").eq("id", id).single()
  if (error) throw new ErroAoLerPagina(error.message)
  return data?.content ?? ""
}

/** Pôr e tirar vídeos do texto das páginas (com o texto de antes, para desfazer). */
export function useGravarVideos() {
  const atualizar = useAtualizar("pages")
  const criar = useCriar("pages")
  const gravarHobbies = useGravarHobbies()

  const adicionar = async (paginaId: string, linha: string, parte: string | null) => {
    const antes = await textoNoBanco(paginaId)
    await atualizar.mutateAsync({ id: paginaId, content: inserirVideo(antes, linha, parte) })
    return antes
  }

  /** Tira o vídeo da página; volta o texto de antes, ou null quando o vídeo não está sozinho numa linha. */
  const remover = async (paginaId: string, chave: string) => {
    const antes = await textoNoBanco(paginaId)
    const depois = removerVideo(antes, chave)
    if (depois === null) return null
    await atualizar.mutateAsync({ id: paginaId, content: depois })
    return antes
  }

  const voltarTexto = (paginaId: string, texto: string) => atualizar.mutate({ id: paginaId, content: texto })

  /** Página nova no material do hobby, já com o vídeo. */
  const novaPagina = async (hobby: Hobby, paginaHobbies: PaginaResumo | null, arvore: PaginaResumo[], titulo: string, linha: string) => {
    const id = novoId()
    const irmas = arvore.filter((p) => p.parent_id === (paginaHobbies?.id ?? null))
    await criar.mutateAsync({ id, title: titulo, section: "geral", parent_id: paginaHobbies?.id ?? null, content: linha, position: Math.max(0, ...irmas.map((p) => p.position)) + 1 })
    await gravarHobbies.mudarProps(hobby.item, (props) => void (props._paginas = [...lerIds(props._paginas), id]), "hobbies")
    return id
  }

  return { adicionar, remover, voltarTexto, novaPagina }
}
