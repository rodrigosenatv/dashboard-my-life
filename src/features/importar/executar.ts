/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js"
import { ORDEM_TABELAS, nomeTabela, type Plano } from "./notion"

export type Progresso = { etapa: string; feito: number; total: number }

type Opcoes = {
  cliente: SupabaseClient<any>
  plano: Plano
  arquivos: Map<string, Uint8Array>
  usuarioId: string
  aoProgredir?: (p: Progresso) => void
}

const TAMANHO_LOTE = 400
const BUCKET = "arquivos"

/** Tabelas em que as linhas importadas guardam o notion_id. */
const COM_NOTION_ID = new Set<string>(ORDEM_TABELAS.filter((t) => !["capture_projects", "habit_logs", "day_notes"].includes(t)))

function lotes<T>(lista: T[], tamanho = TAMANHO_LOTE): T[][] {
  const saida: T[][] = []
  for (let i = 0; i < lista.length; i += tamanho) saida.push(lista.slice(i, i + tamanho))
  return saida
}

async function emParalelo<T>(itens: T[], limite: number, fn: (item: T) => Promise<void>) {
  let i = 0
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (i < itens.length) await fn(itens[i++])
  })
  await Promise.all(trabalhadores)
}

/** Apaga o que veio de uma importação anterior, para não duplicar. */
async function limparImportacaoAnterior({ cliente, aoProgredir }: Opcoes) {
  const tabelas = [...ORDEM_TABELAS].reverse().filter((t) => COM_NOTION_ID.has(t))
  let feito = 0
  for (const tabela of tabelas) {
    aoProgredir?.({ etapa: `Limpando importação anterior: ${nomeTabela(tabela)}`, feito: feito++, total: tabelas.length + 2 })
    const { error } = await cliente.from(tabela).delete().not("notion_id", "is", null)
    if (error) throw new Error(`${nomeTabela(tabela)}: ${error.message}`)
  }
  aoProgredir?.({ etapa: "Limpando observações importadas", feito: feito++, total: tabelas.length + 2 })
  {
    const { error } = await cliente.from("day_notes").delete().eq("extra->>importado", "true")
    if (error) throw new Error(`Observações do dia: ${error.message}`)
  }
  aoProgredir?.({ etapa: "Limpando arquivos importados", feito: feito++, total: tabelas.length + 2 })
  for (;;) {
    const { data, error } = await cliente.from("files").select("id, path").not("source_path", "is", null).limit(500)
    if (error) throw new Error(`Arquivos: ${error.message}`)
    if (!data?.length) break
    await cliente.storage.from(BUCKET).remove(data.map((f: any) => f.path))
    const { error: e2 } = await cliente.from("files").delete().in("id", data.map((f: any) => f.id))
    if (e2) throw new Error(`Arquivos: ${e2.message}`)
  }
}

/** Hábitos com o mesmo nome de um que já existe no app passam a usar o existente. */
async function reaproveitarHabitos(cliente: SupabaseClient<any>, linhas: Record<string, any[]>) {
  const habitos = linhas.habits ?? []
  if (!habitos.length) return
  const { data, error } = await cliente.from("habits").select("id, name").is("notion_id", null)
  if (error) throw new Error(`Hábitos: ${error.message}`)
  const existentes = new Map((data ?? []).map((h: any) => [String(h.name).trim().toLowerCase(), h.id as string]))
  const troca = new Map<string, string>()
  linhas.habits = habitos.filter((h) => {
    const id = existentes.get(String(h.name).trim().toLowerCase())
    if (!id) return true
    troca.set(h.id, id)
    return false
  })
  if (troca.size) linhas.habit_logs = (linhas.habit_logs ?? []).map((l) => (troca.has(l.habit_id) ? { ...l, habit_id: troca.get(l.habit_id) } : l))
}

/** Envia os arquivos do plano e devolve os caminhos que chegaram ao armazenamento. */
async function enviarArquivos({ cliente, plano, arquivos, aoProgredir, usuarioId }: Opcoes, avisos: string[]): Promise<Set<string>> {
  const total = plano.arquivos.length
  let feito = 0
  const registros: any[] = []
  await emParalelo(plano.arquivos, 4, async (a) => {
    const bytes = arquivos.get(a.origem)
    if (bytes) {
      const corpo = new Blob([bytes as BlobPart], { type: a.mime || "application/octet-stream" })
      const { error } = await cliente.storage.from(BUCKET).upload(a.destino, corpo, { upsert: true, contentType: a.mime || undefined })
      if (error) avisos.push(`Arquivo não enviado (${a.nome}): ${error.message}`)
      else registros.push({ user_id: usuarioId, path: a.destino, name: a.nome, mime: a.mime || null, size: a.tamanho, source_path: a.origem })
    } else avisos.push(`Arquivo não encontrado no zip: ${a.origem}`)
    aoProgredir?.({ etapa: "Enviando arquivos", feito: ++feito, total })
  })
  for (const lote of lotes(registros)) {
    const { error } = await cliente.from("files").upsert(lote, { onConflict: "user_id,path", defaultToNull: false })
    if (error) avisos.push(`Registro de arquivos: ${error.message}`)
  }
  return new Set(registros.map((r) => r.path as string))
}

async function inserirLinhas({ cliente, plano, aoProgredir }: Opcoes) {
  const linhas: Record<string, any[]> = { ...plano.linhas }
  await reaproveitarHabitos(cliente, linhas)
  const tabelas = ORDEM_TABELAS.filter((t) => linhas[t]?.length)
  const total = tabelas.reduce((s, t) => s + linhas[t].length, 0)
  let feito = 0
  for (const tabela of tabelas) {
    for (const lote of lotes(linhas[tabela])) {
      aoProgredir?.({ etapa: `Gravando ${nomeTabela(tabela).toLowerCase()}`, feito, total })
      const consulta =
        tabela === "day_notes"
          ? cliente.from(tabela).upsert(lote, { onConflict: "user_id,day", defaultToNull: false })
          : tabela === "habit_logs"
            ? cliente.from(tabela).upsert(lote, { onConflict: "habit_id,day", ignoreDuplicates: true, defaultToNull: false })
            : tabela === "capture_projects"
              ? cliente.from(tabela).upsert(lote, { onConflict: "capture_id,project_id", ignoreDuplicates: true, defaultToNull: false })
              : cliente.from(tabela).insert(lote, { defaultToNull: false })
      const { error } = await consulta
      if (error) throw new Error(`${nomeTabela(tabela)}: ${error.message}`)
      feito += lote.length
    }
  }
  aoProgredir?.({ etapa: "Concluído", feito: total, total })
}

/**
 * Grava o plano no Supabase com a sessão da própria pessoa (RLS vale normalmente).
 * Uma importação nova substitui a anterior; o que foi criado no app fica intocado.
 */
export async function executarImportacao(opcoes: Opcoes): Promise<{ avisos: string[] }> {
  const avisos: string[] = []
  await limparImportacaoAnterior(opcoes)
  await enviarArquivos(opcoes, avisos)
  await inserirLinhas(opcoes)
  return { avisos }
}

const PREFIXO = "arquivo://"
const ehArquivo = (v: unknown): v is string => typeof v === "string" && v.startsWith(PREFIXO)
const decodificar = (t: string) => {
  try {
    return decodeURIComponent(t)
  } catch {
    return t
  }
}

/**
 * Traz só as fotos e anexos das coleções que não vieram numa importação anterior
 * (o caminho do Notion ficou no lugar da foto). Não apaga nada: cada item ganha a foto
 * na mesma propriedade e, se não tiver capa, a capa; o resto do item fica como está.
 */
export async function recuperarArquivos(opcoes: Opcoes): Promise<{ itens: number; arquivos: number; avisos: string[] }> {
  const { cliente, plano, aoProgredir } = opcoes
  const avisos: string[] = []
  const planejados = (plano.linhas.collection_items ?? []).filter((l) => l.notion_id && Object.values(l.props ?? {}).some(ehArquivo))
  if (!planejados.length) return { itens: 0, arquivos: 0, avisos }

  aoProgredir?.({ etapa: "Procurando o que faltou", feito: 0, total: 1 })
  const atuais = new Map<string, any>()
  for (const lote of lotes(planejados.map((l) => l.notion_id as string), 200)) {
    const { data, error } = await cliente.from("collection_items").select("id, notion_id, props, cover_path").in("notion_id", lote)
    if (error) throw new Error(`Itens de coleções: ${error.message}`)
    for (const r of data ?? []) atuais.set(r.notion_id, r)
  }

  const porDestino = new Map(plano.arquivos.map((a) => [a.destino, a]))
  type Troca = { id: string; props: Record<string, unknown>; capaAtual: string | null; destinos: Map<string, string>; capa: string | null }
  const trocas: Troca[] = []
  for (const l of planejados) {
    const atual = atuais.get(l.notion_id)
    if (!atual) continue
    const props = (atual.props ?? {}) as Record<string, unknown>
    const destinos = new Map<string, string>() // propriedade -> caminho no armazenamento
    for (const [chave, valor] of Object.entries(l.props ?? {})) {
      if (!ehArquivo(valor) || ehArquivo(props[chave])) continue
      const destino = decodificar(valor.slice(PREFIXO.length))
      const arquivo = porDestino.get(destino)
      if (!arquivo) continue
      // Só troca o que ficou como caminho do Notion (ou vazio); um texto escrito no app fica
      const hoje = props[chave]
      if (typeof hoje === "string" && hoje.trim() && !decodificar(hoje.trim()).endsWith(arquivo.nome)) continue
      destinos.set(chave, destino)
    }
    if (destinos.size) trocas.push({ id: atual.id, props, capaAtual: atual.cover_path ?? null, destinos, capa: l.cover_path ?? null })
  }
  if (!trocas.length) return { itens: 0, arquivos: 0, avisos }

  const precisa = new Set(trocas.flatMap((t) => [...t.destinos.values()]))
  const enviados = await enviarArquivos({ ...opcoes, plano: { ...plano, arquivos: plano.arquivos.filter((a) => precisa.has(a.destino)) } }, avisos)

  let itens = 0
  for (const t of trocas) {
    const novas = [...t.destinos].filter(([, destino]) => enviados.has(destino))
    if (!novas.length) continue
    const props = { ...t.props }
    for (const [chave, destino] of novas) props[chave] = `${PREFIXO}${encodeURIComponent(destino)}`
    const capa = !t.capaAtual && t.capa && enviados.has(t.capa) ? t.capa : null
    aoProgredir?.({ etapa: "Gravando as fotos nos itens", feito: itens, total: trocas.length })
    const { error } = await cliente
      .from("collection_items")
      .update({ props, ...(capa ? { cover_path: capa } : {}) })
      .eq("id", t.id)
    if (error) avisos.push(`Item não atualizado: ${error.message}`)
    else itens++
  }
  aoProgredir?.({ etapa: "Concluído", feito: trocas.length, total: trocas.length })
  return { itens, arquivos: enviados.size, avisos }
}

/** Cópia de segurança de todas as tabelas em JSON. */
export async function exportarTudo(cliente: SupabaseClient<any>): Promise<Record<string, any[]>> {
  const saida: Record<string, any[]> = {}
  const tabelas = ["settings", ...ORDEM_TABELAS, "study_sessions", "files"]
  for (const tabela of tabelas) {
    const linhas: any[] = []
    for (let de = 0; ; de += 1000) {
      const { data, error } = await cliente.from(tabela).select("*").range(de, de + 999)
      if (error) throw new Error(`${tabela}: ${error.message}`)
      linhas.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    saida[tabela] = linhas
  }
  return saida
}
