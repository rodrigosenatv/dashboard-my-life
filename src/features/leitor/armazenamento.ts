"use client"

import { supabase } from "@/lib/supabase/client"

// Livros guardados no próprio aparelho (IndexedDB): abrem na hora e funcionam sem internet.
// Nada disso vai para o servidor; a cópia na nuvem é opcional e fica em ./nuvem.ts.

const BANCO = "my-life-leitor"
const IDENTIDADE = "dml:usuario-offline"
const VERSAO = 1

export type LivroLocal = {
  id: string
  /** O arquivo que o leitor abre (EPUB, MOBI, AZW3 ou FB2). */
  arquivo: Blob
  nome: string
  tamanho: number
  /** Formato de origem: "pdf" quando o EPUB foi gerado pelo conversor. */
  origem: "pdf" | "epub" | "outro"
  /** Versão do conversor que gerou o EPUB (para oferecer converter de novo quando melhorar). */
  versaoConversor?: number
  paginasPdf?: number
  salvoEm: string
}

export type PosicaoLocal = {
  id: string
  cfi: string
  fracao: number
  pagina?: string
  em: string
}

let conexao: { usuario: string; promessa: Promise<IDBDatabase> } | null = null

async function usuarioAtual(): Promise<string> {
  const { data } = await supabase().auth.getSession()
  const id = data.session?.user.id
  if (id) {
    try { localStorage.setItem(IDENTIDADE, id) } catch {}
    return id
  }
  // Só preserva leitura offline do MESMO usuário que já havia iniciado sessão.
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      const salvo = localStorage.getItem(IDENTIDADE)
      if (salvo && /^[a-f\\d-]{36}$/i.test(salvo)) return salvo
    } catch {}
  }
  throw new Error("Entre na sua conta para acessar os livros deste aparelho.")
}

function abrirBanco(nome: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(nome, VERSAO)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains("livros")) db.createObjectStore("livros", { keyPath: "id" })
      if (!db.objectStoreNames.contains("originais")) db.createObjectStore("originais", { keyPath: "id" })
      if (!db.objectStoreNames.contains("posicoes")) db.createObjectStore("posicoes", { keyPath: "id" })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("Não foi possível abrir o armazenamento do aparelho."))
  })
}

async function abrir(): Promise<IDBDatabase> {
  const usuario = await usuarioAtual()
  if (conexao?.usuario !== usuario) {
    const anterior = conexao
    conexao = { usuario, promessa: abrirBanco(`${BANCO}:${usuario}`) }
    anterior?.promessa.then((db) => db.close()).catch(() => {})
  }
  return conexao!.promessa
}

async function operar<T>(loja: string, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(loja, modo)
    const req = fn(tx.objectStore(loja))
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error ?? req.error ?? new Error("Falha no armazenamento do aparelho."))
    tx.onabort = () => reject(tx.error ?? new Error("Sem espaço no aparelho para guardar o livro."))
  })
}

// Migra cópias antigas SOMENTE depois de verificar a propriedade da ID no Supabase.
// Nenhum arquivo legado é atribuído a uma nova conta por suposição.
const migracoes = new Map<string, Promise<void>>()
async function lerDoBancoLegado<T>(loja: string, id: string): Promise<T | undefined> {
  const db = await abrirBanco(BANCO)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(loja, "readonly")
    const req = tx.objectStore(loja).get(id)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}
async function apagarDoBancoLegado(loja: string, id: string): Promise<void> {
  const db = await abrirBanco(BANCO)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(loja, "readwrite")
    tx.objectStore(loja).delete(id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
async function migrarUmLivro(id: string, autorizado = false): Promise<void> {
  const usuario = await usuarioAtual()
  const chave = usuario + ":" + id
  if (migracoes.has(chave)) return migracoes.get(chave)
  const tarefa = (async () => {
    if (!autorizado) {
      const { data, error } = await supabase().from("books").select("id").eq("id", id).maybeSingle()
      if (error || !data) return
    }
    for (const loja of ["livros", "originais", "posicoes"]) {
      const registro = await lerDoBancoLegado<{ id: string }>(loja, id)
      if (!registro) continue
      await operar(loja, "readwrite", (s) => s.put(registro))
      await apagarDoBancoLegado(loja, id)
    }
  })()
  migracoes.set(chave, tarefa)
  try { await tarefa } finally { migracoes.delete(chave) }
}
async function migrarLivrosProprios(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return
  const db = await abrirBanco(BANCO)
  const ids = await new Promise<string[]>((resolve, reject) => {
    const req = db.transaction("livros", "readonly").objectStore("livros").getAllKeys()
    req.onsuccess = () => resolve(req.result.map(String))
    req.onerror = () => reject(req.error)
  })
  db.close()
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100)
    if (!lote.length) continue
    const { data, error } = await supabase().from("books").select("id").in("id", lote)
    if (error) return
    for (const livro of data ?? []) await migrarUmLivro(livro.id, true)
  }
}

export const lerLivroLocal = async (id: string) => {
  let livro = await operar<LivroLocal | undefined>("livros", "readonly", (s) => s.get(id))
  if (!livro && (typeof navigator === "undefined" || navigator.onLine)) {
    await migrarUmLivro(id).catch(() => {})
    livro = await operar<LivroLocal | undefined>("livros", "readonly", (s) => s.get(id))
  }
  return livro
}
export const salvarLivroLocal = (l: LivroLocal) => operar("livros", "readwrite", (s) => s.put(l))
export const listarLivrosLocais = async () => {
  await migrarLivrosProprios().catch(() => {})
  return operar<IDBValidKey[]>("livros", "readonly", (s) => s.getAllKeys()).then((k) => k.map(String))
}

/** O PDF original, guardado para converter de novo quando o conversor melhorar. */
export const lerOriginal = async (id: string) => {
  let original = await operar<{ id: string; arquivo: Blob; nome: string } | undefined>("originais", "readonly", (s) => s.get(id))
  if (!original && (typeof navigator === "undefined" || navigator.onLine)) {
    await migrarUmLivro(id).catch(() => {})
    original = await operar<{ id: string; arquivo: Blob; nome: string } | undefined>("originais", "readonly", (s) => s.get(id))
  }
  return original
}
export const salvarOriginal = (id: string, arquivo: Blob, nome: string) => operar("originais", "readwrite", (s) => s.put({ id, arquivo, nome }))

export const lerPosicaoLocal = async (id: string) => {
  let posicao = await operar<PosicaoLocal | undefined>("posicoes", "readonly", (s) => s.get(id))
  if (!posicao && (typeof navigator === "undefined" || navigator.onLine)) {
    await migrarUmLivro(id).catch(() => {})
    posicao = await operar<PosicaoLocal | undefined>("posicoes", "readonly", (s) => s.get(id))
  }
  return posicao
}
export const salvarPosicaoLocal = (p: PosicaoLocal) => operar("posicoes", "readwrite", (s) => s.put(p))

export async function apagarLivroLocal(id: string) {
  await operar("livros", "readwrite", (s) => s.delete(id))
  await operar("originais", "readwrite", (s) => s.delete(id))
}

/**
 * Pede ao navegador para não apagar os livros quando faltar espaço.
 * No iPhone, isso só é concedido com o app instalado na tela de início.
 */
export async function pedirArmazenamentoPersistente(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** Arquivo pronto para o leitor (o motor de leitura usa o nome para reconhecer o formato). */
export function comoArquivo(l: Pick<LivroLocal, "arquivo" | "nome">): File {
  const tipo = l.arquivo.type || "application/epub+zip"
  return new File([l.arquivo], l.nome || "livro.epub", { type: tipo })
}
