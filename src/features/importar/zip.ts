import { unzipSync } from "fflate"

/**
 * Abre o .zip da exportação do Notion. Exportações grandes vêm com zips
 * dentro do zip (Part-1, Part-2…); esses também são abertos.
 */
export function abrirZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const saida = new Map<string, Uint8Array>()
  const fila: Uint8Array[] = [bytes]
  while (fila.length) {
    const atual = fila.shift()!
    const arquivos = unzipSync(atual)
    for (const [caminho, conteudo] of Object.entries(arquivos)) {
      if (caminho.endsWith("/") || caminho.startsWith("__MACOSX")) continue
      if (caminho.toLowerCase().endsWith(".zip")) {
        fila.push(conteudo)
        continue
      }
      saida.set(caminho.normalize("NFC"), conteudo)
    }
  }
  return saida
}

const decodificador = new TextDecoder("utf-8")

export function texto(bytes: Uint8Array): string {
  const t = decodificador.decode(bytes)
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t
}
