import { abrirZip } from "./zip"
import { montarPlano, resumoPlano } from "./notion"

// Descompressão e leitura de CSV/Markdown não disputam a thread da interface.
self.onmessage = (evento: MessageEvent<{ bytes: Uint8Array; usuarioId: string }>) => {
  try {
    const arquivos = abrirZip(evento.data.bytes)
    const plano = montarPlano(arquivos, { usuarioId: evento.data.usuarioId, novoId: () => crypto.randomUUID() })
    const buffers = [...new Set([...arquivos.values()].map((bytes) => bytes.buffer as ArrayBuffer))]
    self.postMessage({ plano, arquivos, resumo: resumoPlano(plano) }, { transfer: buffers })
  } catch (erro) {
    self.postMessage({ erro: erro instanceof Error ? erro.message : "Não foi possível ler o arquivo." })
  }
}
