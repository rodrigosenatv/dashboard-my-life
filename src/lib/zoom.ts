// As contas do zoom de uma imagem em tela cheia (o "Ver quadro" da capa), testadas em tests/zoom.test.cjs.
// As posições contam a partir do centro do palco. Na escala 1 a imagem cabe inteira no palco, centralizada.

export type Tamanho = { largura: number; altura: number }
export type Ponto = { x: number; y: number }
/** Como a imagem aparece: a escala sobre o tamanho encaixado e o deslocamento do centro. */
export type Vista = { escala: number; x: number; y: number }

export const VISTA_INICIAL: Vista = { escala: 1, x: 0, y: 0 }

/** A escala do toque duplo (ou do clique): perto o bastante para ler os detalhes. */
const ESCALA_DO_TOQUE = 2.5

/** O tamanho da imagem inteira dentro do palco, sem cortar nada. */
export function encaixar(imagem: Tamanho, palco: Tamanho): Tamanho {
  if (!(imagem.largura > 0 && imagem.altura > 0 && palco.largura > 0 && palco.altura > 0)) return { largura: 0, altura: 0 }
  const f = Math.min(palco.largura / imagem.largura, palco.altura / imagem.altura)
  return { largura: imagem.largura * f, altura: imagem.altura * f }
}

/** Até onde dá para ampliar: 4x, ou mais se for preciso para ver a imagem com o dobro do tamanho original. */
export function escalaMaxima(imagem: Tamanho, encaixada: Tamanho): number {
  if (!(encaixada.largura > 0)) return 4
  return Math.min(12, Math.max(4, (2 * imagem.largura) / encaixada.largura))
}

/** Prende a escala entre 1 e a máxima e o deslocamento ao quanto a imagem passa da borda do palco (sem sobrar fundo). */
export function limitar(vista: Vista, encaixada: Tamanho, palco: Tamanho, maxima: number): Vista {
  const escala = Math.min(maxima, Math.max(1, vista.escala))
  const folgaX = Math.max(0, (encaixada.largura * escala - palco.largura) / 2)
  const folgaY = Math.max(0, (encaixada.altura * escala - palco.altura) / 2)
  const prender = (v: number, folga: number) => (folga === 0 ? 0 : Math.min(folga, Math.max(-folga, v)))
  return { escala, x: prender(vista.x, folgaX), y: prender(vista.y, folgaY) }
}

/** Amplia ou reduz mantendo parado o ponto do palco sob o cursor ou os dedos. */
export function zoomEm(vista: Vista, escala: number, ponto: Ponto, encaixada: Tamanho, palco: Tamanho, maxima: number): Vista {
  const nova = Math.min(maxima, Math.max(1, escala))
  const r = nova / vista.escala
  return limitar({ escala: nova, x: ponto.x - r * (ponto.x - vista.x), y: ponto.y - r * (ponto.y - vista.y) }, encaixada, palco, maxima)
}

/**
 * A pinça: a escala acompanha a distância entre os dedos e o ponto da imagem que estava entre eles
 * no começo acompanha o meio dos dedos (amplia e arrasta no mesmo gesto).
 */
export function pinca(inicio: Vista, meioInicial: Ponto, distanciaInicial: number, meio: Ponto, distancia: number, encaixada: Tamanho, palco: Tamanho, maxima: number): Vista {
  if (!(distanciaInicial > 0)) return inicio
  const escala = Math.min(maxima, Math.max(1, inicio.escala * (distancia / distanciaInicial)))
  const r = escala / inicio.escala
  return limitar({ escala, x: meio.x - r * (meioInicial.x - inicio.x), y: meio.y - r * (meioInicial.y - inicio.y) }, encaixada, palco, maxima)
}

/** Se o ponto do palco cai sobre a imagem (e não no fundo em volta dela). */
export function sobreAImagem(ponto: Ponto, vista: Vista, encaixada: Tamanho): boolean {
  const meiaLargura = (encaixada.largura * vista.escala) / 2
  const meiaAltura = (encaixada.altura * vista.escala) / 2
  return Math.abs(ponto.x - vista.x) <= meiaLargura && Math.abs(ponto.y - vista.y) <= meiaAltura
}

/** O toque duplo ou o clique: amplia no ponto tocado ou, já ampliada, volta a mostrar a imagem inteira. */
export function alternarZoom(vista: Vista, ponto: Ponto, encaixada: Tamanho, palco: Tamanho, maxima: number): Vista {
  if (vista.escala > 1.01) return VISTA_INICIAL
  return zoomEm(vista, Math.min(maxima, ESCALA_DO_TOQUE), ponto, encaixada, palco, maxima)
}

/** Quanto um giro da roda (ou o gesto de pinça do touchpad, que chega como roda com Ctrl) muda a escala. */
export function fatorDaRoda(deltaY: number, modo: number, doTouchpad: boolean): number {
  // modo 1: linhas; modo 2: páginas; modo 0: pixels
  const pixels = modo === 1 ? deltaY * 16 : modo === 2 ? deltaY * 400 : deltaY
  const passo = Math.max(-300, Math.min(300, pixels))
  return Math.exp(-passo * (doTouchpad ? 0.01 : 0.0015))
}
