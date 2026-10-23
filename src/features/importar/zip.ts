import { unzipSync } from "fflate"

/** Limites baseados nos metadados ANTES de extrair cada arquivo. */
export const MAX_ZIP_BYTES = 250 * 1024 * 1024
const MAX_EXPANDIDO = 768 * 1024 * 1024
const MAX_ENTRADA = 100 * 1024 * 1024
const MAX_ENTRADAS = 20_000
const MAX_PROFUNDIDADE = 4

export function abrirZip(bytes: Uint8Array): Map<string, Uint8Array> {
  if (bytes.byteLength > MAX_ZIP_BYTES) throw new Error("O ZIP excede o limite de 250 MB.")
  const saida = new Map<string, Uint8Array>()
  const fila: { bytes: Uint8Array; profundidade: number }[] = [{ bytes, profundidade: 0 }]
  let total = 0
  let entradas = 0

  while (fila.length) {
    const atual = fila.shift()!
    if (atual.profundidade > MAX_PROFUNDIDADE) throw new Error("O ZIP contém níveis aninhados demais.")
    const arquivos = unzipSync(atual.bytes, {
      filter(info) {
        entradas++
        if (entradas > MAX_ENTRADAS) throw new Error("O ZIP possui arquivos demais.")
        if (!Number.isFinite(info.originalSize) || info.originalSize < 0 || info.originalSize > MAX_ENTRADA) {
          throw new Error("O ZIP contém um arquivo grande demais.")
        }
        total += info.originalSize
        if (total > MAX_EXPANDIDO) throw new Error("O ZIP descompactado é grande demais.")
        return !info.name.endsWith("/") && !info.name.startsWith("__MACOSX")
      },
    })
    for (const [caminho, conteudo] of Object.entries(arquivos)) {
      if (caminho.toLowerCase().endsWith(".zip")) {
        if (atual.profundidade >= MAX_PROFUNDIDADE) throw new Error("O ZIP contém níveis aninhados demais.")
        fila.push({ bytes: conteudo, profundidade: atual.profundidade + 1 })
      } else {
        saida.set(caminho.normalize("NFC"), conteudo)
      }
    }
  }
  return saida
}

const decodificador = new TextDecoder("utf-8")
export function texto(bytes: Uint8Array): string {
  const t = decodificador.decode(bytes)
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t
}
