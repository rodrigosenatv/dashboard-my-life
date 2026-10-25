"use client"

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import * as React from "react"
import { toast } from "sonner"
import { useAtualizar, useLista, useRegistro } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import { BUCKET_ARQUIVOS } from "@/lib/supabase/env"
import { camposDoStatus, STATUS, type Curso, type StatusCurso } from "./logica"

export type { Curso } from "./logica"

export function useCursos() {
  return useLista("courses", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
}

export function useCurso(id: string) {
  return useRegistro("courses", id)
}

/* ------------------------------------------------------------------ */
/* Anotações                                                           */
/* ------------------------------------------------------------------ */

/**
 * O texto mais novo de cada curso enquanto a gravação não volta do banco: duas mudanças seguidas (marcar
 * duas ações) partem sempre do texto com a mudança anterior, mesmo antes de a tela atualizar.
 */
const pendentes = new Map<string, string>()

export type MudancaNotas = { antes: string; depois: string }

/** As anotações do curso como estão na tela agora (o objeto guardado num aviso pode ser antigo). */
function notasNoCache(qc: QueryClient, id: string): string | null | undefined {
  const um = qc.getQueryData<Curso | null>(["courses", "um", id])
  if (um) return um.notes
  for (const [, dados] of qc.getQueriesData<unknown>({ queryKey: ["courses"] })) {
    if (!Array.isArray(dados)) continue
    const achado = (dados as Curso[]).find((c) => c?.id === id)
    if (achado) return achado.notes
  }
  return undefined
}

/** Muda as anotações de um curso a partir do texto mais novo. Devolve o antes e o depois (null se nada mudou). */
export function useMudarNotas() {
  const qc = useQueryClient()
  const { mutate } = useAtualizar("courses", { escopo: "cursos-notas" })
  return React.useCallback(
    (curso: Pick<Curso, "id" | "notes">, mudar: (texto: string) => string): MudancaNotas | null => {
      const noCache = notasNoCache(qc, curso.id)
      const antes = pendentes.get(curso.id) ?? (noCache !== undefined ? noCache : curso.notes) ?? ""
      const depois = mudar(antes)
      if (depois === antes) return null
      pendentes.set(curso.id, depois)
      mutate(
        { id: curso.id, notes: depois.trim() ? depois : null },
        {
          onSettled: () => {
            if (pendentes.get(curso.id) === depois) pendentes.delete(curso.id)
          },
        },
      )
      return { antes, depois }
    },
    [mutate, qc],
  )
}

/** "Desfazer" de uma mudança nas anotações: volta ao texto de antes se nada mudou depois dela. */
export function useDesfazerNotas() {
  const mudar = useMudarNotas()
  return React.useCallback(
    (curso: Pick<Curso, "id" | "notes">, m: MudancaNotas) => {
      mudar(curso, (atual) => {
        if (atual === m.depois) return m.antes
        toast.error("Não deu para desfazer: as anotações mudaram depois disso.")
        return atual
      })
    },
    [mudar],
  )
}

/* ------------------------------------------------------------------ */
/* Situação                                                            */
/* ------------------------------------------------------------------ */

/** Muda a situação do curso, com aviso e "Desfazer". */
export function useMudarStatus() {
  const { mutate } = useAtualizar("courses")
  return React.useCallback(
    (curso: Pick<Curso, "id" | "status" | "progress" | "name">, status: StatusCurso) => {
      if (curso.status === status) return
      const antes = { status: curso.status, progress: curso.progress }
      mutate({ id: curso.id, ...camposDoStatus(curso, status) })
      const texto =
        status === "concluido" ? `“${curso.name}” concluído. Mais uma competência!` : status === "em_andamento" ? `Bons estudos em “${curso.name}”.` : `“${curso.name}” agora em ${STATUS[status].rotulo.toLowerCase()}.`
      toast.success(texto, { action: { label: "Desfazer", onClick: () => mutate({ id: curso.id, ...antes }) } })
    },
    [mutate],
  )
}

/* ------------------------------------------------------------------ */
/* Capas enviadas                                                      */
/* ------------------------------------------------------------------ */

/** A foto da capa de um curso fica em `files` (os cursos não têm coluna de capa). */
export const ENTIDADE_CAPA_CURSO = "curso_capa"

/** As capas enviadas: id do curso → caminho da mais nova no storage. */
export function useCapasDosCursos() {
  return useQuery({
    queryKey: ["files", ENTIDADE_CAPA_CURSO],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("files")
        .select("entity_id, path, created_at")
        .eq("entity_type", ENTIDADE_CAPA_CURSO)
        .order("created_at", { ascending: false })
      if (error) throw new Error(error.message)
      const mapa = new Map<string, string>()
      for (const f of data ?? []) if (f.entity_id && !mapa.has(f.entity_id)) mapa.set(f.entity_id, f.path)
      return mapa
    },
  })
}

/** Envia a foto da capa (reduzida), guarda o registro e apaga as capas antigas do curso. */
export async function enviarCapaDoCurso(arquivo: File, cursoId: string): Promise<string> {
  const { otimizarImagem } = await import("@/lib/otimizar-imagem")
  const sb = supabase()
  const { data: sessao } = await sb.auth.getSession()
  const usuario = sessao.session?.user.id
  if (!usuario) throw new Error("Sua sessão expirou. Entre de novo para enviar a foto.")
  const pronta = await otimizarImagem(arquivo, { dimensaoMaxima: 1400 })
  const tipo = pronta.type || arquivo.type
  const ext = tipo === "image/jpeg" ? "jpg" : tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "avif"
  const caminho = `${usuario}/cursos/${cursoId}/capa-${Date.now()}.${ext}`
  const { error } = await sb.storage.from(BUCKET_ARQUIVOS).upload(caminho, pronta, { contentType: tipo })
  if (error) throw new Error(error.message)
  const { error: erroRegistro } = await sb
    .from("files")
    .insert({ path: caminho, name: arquivo.name || "capa", mime: tipo, size: pronta.size, entity_type: ENTIDADE_CAPA_CURSO, entity_id: cursoId })
  if (erroRegistro) {
    // Sem o registro a capa não aparece: não deixa o arquivo solto no storage
    await sb.storage.from(BUCKET_ARQUIVOS).remove([caminho])
    throw new Error(erroRegistro.message)
  }
  await apagarCapasDoCurso(cursoId, caminho)
  return caminho
}

/** Apaga as capas enviadas para o curso (menos a que continua em uso). */
export async function apagarCapasDoCurso(cursoId: string, manter?: string | null) {
  const sb = supabase()
  const { data } = await sb.from("files").select("id, path").eq("entity_type", ENTIDADE_CAPA_CURSO).eq("entity_id", cursoId)
  const sobrando = (data ?? []).filter((f) => f.path !== manter)
  if (!sobrando.length) return
  await sb.storage.from(BUCKET_ARQUIVOS).remove(sobrando.map((f) => f.path))
  await sb
    .from("files")
    .delete()
    .in(
      "id",
      sobrando.map((f) => f.id),
    )
}

/** Troca ou tira a capa de um curso e atualiza a tela. */
export function useCapaDoCurso() {
  const qc = useQueryClient()
  const [enviando, setEnviando] = React.useState(false)
  const atualizarTela = () => qc.invalidateQueries({ queryKey: ["files", ENTIDADE_CAPA_CURSO] })
  return {
    enviando,
    async enviar(arquivo: File, cursoId: string) {
      setEnviando(true)
      try {
        await enviarCapaDoCurso(arquivo, cursoId)
        await atualizarTela()
        toast.success("Capa trocada.")
      } catch (e) {
        toast.error("Não foi possível trocar a capa.", { description: e instanceof Error ? e.message : undefined })
      } finally {
        setEnviando(false)
      }
    },
    async tirar(cursoId: string) {
      try {
        await apagarCapasDoCurso(cursoId)
        await atualizarTela()
        toast.success("Capa tirada. O curso volta a usar a capa gerada.")
      } catch (e) {
        toast.error("Não foi possível tirar a capa.", { description: e instanceof Error ? e.message : undefined })
      }
    },
  }
}
