"use client"

// O que vai para o Supabase: a cópia do livro (opcional, para abrir em outro aparelho),
// a posição de leitura e as preferências de aparência. Tudo pequeno; a conversão é feita no aparelho.
import { supabase } from "@/lib/supabase/client"
import { BUCKET_ARQUIVOS } from "@/lib/supabase/env"
import type { Json, Tables } from "@/lib/supabase/database.types"

export type ArquivoNuvem = Tables<"files">

/** Tipo de entidade usado na tabela `files` para os livros do leitor. */
export const ENTIDADE_LIVRO = "livro"

async function idDoUsuario(): Promise<string> {
  const { data } = await supabase().auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error("Entre na sua conta para guardar o livro na nuvem.")
  return id
}

export async function enviarLivroNuvem(livroId: string, arquivo: Blob, nome: string): Promise<ArquivoNuvem> {
  const sb = supabase()
  const uid = await idDoUsuario()
  const extensao = /\.(epub|mobi|azw3?|fb2|fbz|cbz)$/i.exec(nome)?.[1]?.toLowerCase() ?? "epub"
  const caminho = `${uid}/livros/${livroId}/livro.${extensao}`
  const tipo = arquivo.type || "application/epub+zip"
  const { error } = await sb.storage.from(BUCKET_ARQUIVOS).upload(caminho, arquivo, { upsert: true, contentType: tipo })
  if (error) throw new Error(error.message.includes("exceeded") ? "O arquivo passa do limite de tamanho do plano gratuito (50 MB)." : error.message)

  // Um registro por livro: troca o anterior (de outro formato, por exemplo)
  const { data: antigos } = await sb.from("files").select("id, path").eq("entity_type", ENTIDADE_LIVRO).eq("entity_id", livroId)
  const sobrando = (antigos ?? []).filter((a) => a.path !== caminho)
  if (sobrando.length) {
    await sb.storage.from(BUCKET_ARQUIVOS).remove(sobrando.map((a) => a.path))
    await sb
      .from("files")
      .delete()
      .in(
        "id",
        sobrando.map((a) => a.id),
      )
  }
  const { data, error: erro2 } = await sb
    .from("files")
    .upsert({ path: caminho, name: nome, mime: tipo, size: arquivo.size, entity_type: ENTIDADE_LIVRO, entity_id: livroId }, { onConflict: "user_id,path" })
    .select()
    .single()
  if (erro2) throw new Error(erro2.message)
  return data
}

export async function arquivoNuvemDoLivro(livroId: string): Promise<ArquivoNuvem | null> {
  const { data, error } = await supabase()
    .from("files")
    .select("*")
    .eq("entity_type", ENTIDADE_LIVRO)
    .eq("entity_id", livroId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function baixarLivroNuvem(registro: ArquivoNuvem): Promise<Blob> {
  const { data, error } = await supabase().storage.from(BUCKET_ARQUIVOS).download(registro.path)
  if (error || !data) throw new Error(error?.message ?? "Não foi possível baixar o livro.")
  return data
}

export async function apagarLivroNuvem(livroId: string) {
  const sb = supabase()
  const { data } = await sb.from("files").select("id, path").eq("entity_type", ENTIDADE_LIVRO).eq("entity_id", livroId)
  if (!data?.length) return
  await sb.storage.from(BUCKET_ARQUIVOS).remove(data.map((a) => a.path))
  const { error } = await sb
    .from("files")
    .delete()
    .in(
      "id",
      data.map((a) => a.id),
    )
  if (error) throw new Error(error.message)
}

/* ------------------------------------------------------------------ */
/* Posição de leitura, dentro de settings.prefs.leitor                 */
/* (a aparência fica em cada aparelho: no celular e no computador       */
/* a letra e as margens costumam ser diferentes)                       */
/* ------------------------------------------------------------------ */

export type PosicaoNuvem = { cfi: string; fracao: number; em: string }
export type PrefsLeitor = { posicoes?: Record<string, PosicaoNuvem> }

export async function lerPrefsLeitor(): Promise<PrefsLeitor> {
  const { data, error } = await supabase().from("settings").select("prefs").maybeSingle()
  if (error) throw new Error(error.message)
  const prefs = (data?.prefs ?? {}) as { leitor?: PrefsLeitor }
  return prefs.leitor ?? {}
}

/**
 * Grava só a parte do leitor, juntando com o que já está salvo (inclusive posições de outros livros
 * e preferências de outras telas), para um aparelho não apagar o que o outro gravou.
 */
export async function gravarPrefsLeitor(mudar: (atual: PrefsLeitor) => PrefsLeitor) {
  const sb = supabase()
  const { data, error } = await sb.from("settings").select("prefs").maybeSingle()
  if (error) throw new Error(error.message)
  const prefs = (data?.prefs ?? {}) as Record<string, Json | undefined> & { leitor?: PrefsLeitor }
  const leitor = mudar(prefs.leitor ?? {})
  const { error: erro2 } = await sb.from("settings").upsert({ prefs: { ...prefs, leitor } as unknown as Json } as never, { onConflict: "user_id" })
  if (erro2) throw new Error(erro2.message)
}

export function salvarPosicaoNuvem(livroId: string, posicao: PosicaoNuvem) {
  return gravarPrefsLeitor((atual) => ({ ...atual, posicoes: { ...(atual.posicoes ?? {}), [livroId]: posicao } }))
}
