import type { Plano } from "./notion"
import { MAX_ZIP_BYTES } from "./zip"

export type Preparado = { plano: Plano; arquivos: Map<string, Uint8Array>; resumo: { tabela: string; nome: string; total: number }[] }

/** Um worker por importação; transfere os bytes sem duplicar o ZIP na memória. */
export async function prepararImportacao(arquivo: File, usuarioId: string, sinal: AbortSignal): Promise<Preparado> {
  sinal.throwIfAborted()
  if (arquivo.size > MAX_ZIP_BYTES) throw new Error("O arquivo ZIP excede o limite de 250 MB.")
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  sinal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./preparar.worker.ts", import.meta.url), { type: "module" })
    const limpar = () => {
      sinal.removeEventListener("abort", cancelar)
      worker.terminate()
    }
    const cancelar = () => { limpar(); reject(sinal.reason) }
    sinal.addEventListener("abort", cancelar, { once: true })
    worker.onmessage = (evento: MessageEvent<Preparado & { erro?: string }>) => {
      limpar()
      if ("erro" in evento.data) reject(new Error(evento.data.erro || "Não foi possível ler o arquivo."))
      else resolve(evento.data)
    }
    const falhar = () => { limpar(); reject(new Error("Não foi possível preparar a importação. Tente novamente.")) }
    worker.onerror = falhar
    worker.onmessageerror = falhar
    try { worker.postMessage({ bytes, usuarioId }, [bytes.buffer]) }
    catch (erro) { limpar(); reject(erro) }
  })
}
