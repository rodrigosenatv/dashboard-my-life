"use client"

// Livros guardados no próprio aparelho (IndexedDB): abrem na hora e funcionam sem internet.
// Nada disso vai para o servidor; a cópia na nuvem é opcional e fica em ./nuvem.ts.

const BANCO = "my-life-leitor"
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

let conexao: Promise<IDBDatabase> | null = null

function abrir(): Promise<IDBDatabase> {
  if (conexao) return conexao
  conexao = new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, VERSAO)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains("livros")) db.createObjectStore("livros", { keyPath: "id" })
      if (!db.objectStoreNames.contains("originais")) db.createObjectStore("originais", { keyPath: "id" })
      if (!db.objectStoreNames.contains("posicoes")) db.createObjectStore("posicoes", { keyPath: "id" })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      conexao = null
      reject(req.error ?? new Error("Não foi possível abrir o armazenamento do aparelho."))
    }
  })
  return conexao
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

export const lerLivroLocal = (id: string) => operar<LivroLocal | undefined>("livros", "readonly", (s) => s.get(id))
export const salvarLivroLocal = (l: LivroLocal) => operar("livros", "readwrite", (s) => s.put(l))
export const listarLivrosLocais = () => operar<IDBValidKey[]>("livros", "readonly", (s) => s.getAllKeys()).then((k) => k.map(String))

/** O PDF original, guardado para converter de novo quando o conversor melhorar. */
export const lerOriginal = (id: string) => operar<{ id: string; arquivo: Blob; nome: string } | undefined>("originais", "readonly", (s) => s.get(id))
export const salvarOriginal = (id: string, arquivo: Blob, nome: string) => operar("originais", "readwrite", (s) => s.put({ id, arquivo, nome }))

export const lerPosicaoLocal = (id: string) => operar<PosicaoLocal | undefined>("posicoes", "readonly", (s) => s.get(id))
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
