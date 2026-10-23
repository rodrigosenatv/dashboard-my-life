/** Limites antes de decodificar: evita alocar bitmaps gigantes no dispositivo. */
const MAX_BYTES = 20 * 1024 * 1024
const MAX_PIXELS = 32_000_000

type Dimensoes = { largura: number; altura: number }

export function dimensoesReduzidas(largura: number, altura: number, limite = 1920): Dimensoes {
  const escala = Math.min(1, limite / Math.max(largura, altura))
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) }
}

/** Só aceita JPEG/PNG estático reconhecido pelos bytes, nunca pela extensão. */
export function identificarImagem(bytes: Uint8Array): Dimensoes | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) {
    let dimensoes: Dimensoes | null = null
    for (let i = 8; i + 12 <= bytes.length;) {
      const tamanho = view.getUint32(i)
      if (tamanho > bytes.length - i - 12) return null
      const tipo = String.fromCharCode(...bytes.subarray(i + 4, i + 8))
      if (tipo === "acTL") return null
      if (tipo === "IHDR" && i === 8 && tamanho === 13) dimensoes = { largura: view.getUint32(i + 8), altura: view.getUint32(i + 12) }
      if (tipo === "IEND") return dimensoes
      i += tamanho + 12
    }
    return null
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  for (let i = 2; i + 3 < bytes.length;) {
    if (bytes[i++] !== 0xff) return null
    while (bytes[i] === 0xff) i++
    const marcador = bytes[i++]
    if (marcador === 0xda || marcador === 0xd9) return null
    if (i + 2 > bytes.length) return null
    const tamanho = view.getUint16(i)
    if (tamanho < 2 || i + tamanho > bytes.length) return null
    if ([0xc0, 0xc1, 0xc2].includes(marcador) && tamanho >= 8) {
      return { largura: view.getUint16(i + 5), altura: view.getUint16(i + 3) }
    }
    i += tamanho
  }
  return null
}

/** Assinaturas aceitas: SVG/HTML e MIME falsificados são rejeitados antes do Storage. */
export function identificarTipoImagem(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)) return "image/png"
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0,4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8,12)) === "WEBP") return "image/webp"
  if (bytes.length >= 16 && String.fromCharCode(...bytes.subarray(4,8)) === "ftyp") {
    const marca = String.fromCharCode(...bytes.subarray(8,12))
    if (marca === "avif" || marca === "avis") return "image/avif"
  }
  return null
}

export async function validarImagemParaUpload(arquivo: File): Promise<void> {
  if (arquivo.size < 16 || arquivo.size > MAX_BYTES) throw new Error("Arquivo de imagem vazio ou grande demais (máximo de 20 MB).")
  const tipo = identificarTipoImagem(new Uint8Array(await arquivo.slice(0,32).arrayBuffer()))
  if (!tipo || arquivo.type !== tipo) throw new Error("Formato inválido. Use JPG, PNG, WebP ou AVIF.")
}

/** Carregar com import() apenas ao enviar. Retorna o original em falhas de otimização. */
export async function otimizarImagem(arquivo: File, { dimensaoMaxima = 1920 }: { dimensaoMaxima?: number } = {}): Promise<File> {
  await validarImagemParaUpload(arquivo)
  // WebP/AVIF já são eficientes; GIF e SVG não são aceitos.
  if (!["image/jpeg", "image/png"].includes(arquivo.type) || arquivo.size < 150 * 1024 || arquivo.size > MAX_BYTES ||
    typeof createImageBitmap !== "function" || typeof document === "undefined") return arquivo
  let bitmap: ImageBitmap | undefined
  let canvas: HTMLCanvasElement | undefined
  try {
    const info = identificarImagem(new Uint8Array(await arquivo.arrayBuffer()))
    if (!info || info.largura < 1 || info.altura < 1 || info.largura * info.altura > MAX_PIXELS ||
      Math.max(info.largura, info.altura) > 16384) return arquivo
    // O bitmap aplica a orientação EXIF; calcular a redução depois preserva retratos.
    bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" })
    const limite = Number.isFinite(dimensaoMaxima) ? Math.max(1, Math.min(1920, dimensaoMaxima)) : 1920
    const { largura, altura } = dimensoesReduzidas(bitmap.width, bitmap.height, limite)
    canvas = document.createElement("canvas")
    canvas.width = largura
    canvas.height = altura
    const contexto = canvas.getContext("2d", { alpha: true })
    if (!contexto) return arquivo
    contexto.drawImage(bitmap, 0, 0, largura, altura)
    const blob = await new Promise<Blob | null>((resolve) => canvas!.toBlob(resolve, "image/webp", 0.82))
    if (!blob || blob.type !== "image/webp" || blob.size >= arquivo.size) return arquivo
    return new File([blob], arquivo.name.replace(/\.[^.]+$/, "") + ".webp", { type: blob.type, lastModified: arquivo.lastModified })
  } catch {
    return arquivo
  } finally {
    bitmap?.close()
    if (canvas) { canvas.width = 0; canvas.height = 0 }
  }
}
