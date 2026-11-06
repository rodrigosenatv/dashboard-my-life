const test = require('node:test')
const assert = require('node:assert/strict')
const Z = require('./carregar-ts.cjs')('src/lib/zoom.ts')

// Um quadro 1920x1080 num palco de computador e num celular em pé
const quadro = { largura: 1920, altura: 1080 }
const computador = { largura: 1200, altura: 600 }
const celular = { largura: 390, altura: 700 }
const perto = (a, b) => Math.abs(a - b) < 1e-6

test('encaixar: a imagem inteira cabe no palco, sem cortar', () => {
  assert.deepEqual(Z.encaixar(quadro, computador), { largura: 1066.6666666666667, altura: 600 })
  assert.deepEqual(Z.encaixar(quadro, celular), { largura: 390, altura: 219.375 })
  assert.deepEqual(Z.encaixar({ largura: 0, altura: 0 }, celular), { largura: 0, altura: 0 })
})

test('escala máxima: pelo menos 4x, mais no celular para ver o dobro do original', () => {
  assert.equal(Z.escalaMaxima(quadro, Z.encaixar(quadro, computador)), 4)
  const noCelular = Z.escalaMaxima(quadro, Z.encaixar(quadro, celular))
  assert.ok(perto(noCelular, (2 * 1920) / 390))
  assert.equal(Z.escalaMaxima({ largura: 20000, altura: 1000 }, { largura: 390, altura: 20 }), 12)
})

test('limitar: sem zoom fica no centro; ampliada, só anda até a borda', () => {
  const enc = Z.encaixar(quadro, celular)
  assert.deepEqual(Z.limitar({ escala: 0.5, x: 40, y: -40 }, enc, celular, 4), { escala: 1, x: 0, y: 0 })
  // 2x: 780 de largura num palco de 390 sobra 195 para cada lado; a altura (438,75) ainda cabe nos 700
  assert.deepEqual(Z.limitar({ escala: 2, x: 500, y: 90 }, enc, celular, 4), { escala: 2, x: 195, y: 0 })
  assert.deepEqual(Z.limitar({ escala: 9, x: 0, y: 0 }, enc, celular, 4).escala, 4)
})

test('zoom num ponto: o ponto sob o dedo ou o cursor não sai do lugar', () => {
  const enc = Z.encaixar(quadro, computador)
  const ponto = { x: 200, y: 100 }
  const v = Z.zoomEm(Z.VISTA_INICIAL, 2, ponto, enc, computador, 4)
  assert.equal(v.escala, 2)
  // O ponto da imagem que estava em (200, 100) continua em (200, 100): (p - t) / s não muda
  assert.ok(perto((ponto.x - v.x) / v.escala, ponto.x) && perto((ponto.y - v.y) / v.escala, ponto.y))
  // Reduzir até o fim volta ao centro
  assert.deepEqual(Z.zoomEm(v, 0.2, ponto, enc, computador, 4), { escala: 1, x: 0, y: 0 })
})

test('pinça: amplia pela distância dos dedos e acompanha o meio deles', () => {
  const enc = Z.encaixar(quadro, computador)
  const v = Z.pinca(Z.VISTA_INICIAL, { x: 0, y: 0 }, 100, { x: 30, y: 0 }, 200, enc, computador, 4)
  assert.equal(v.escala, 2)
  assert.equal(v.x, 30)
  // Dedos parados no lugar: nada muda
  assert.deepEqual(Z.pinca(v, { x: 10, y: 10 }, 120, { x: 10, y: 10 }, 120, enc, computador, 4), v)
  assert.deepEqual(Z.pinca(v, { x: 0, y: 0 }, 0, { x: 0, y: 0 }, 50, enc, computador, 4), v)
})

test('toque duplo e clique: ampliam no ponto e, ampliada, voltam à imagem inteira', () => {
  const enc = Z.encaixar(quadro, celular)
  const max = Z.escalaMaxima(quadro, enc)
  const v = Z.alternarZoom(Z.VISTA_INICIAL, { x: 100, y: 50 }, enc, celular, max)
  assert.equal(v.escala, 2.5)
  assert.deepEqual(Z.alternarZoom(v, { x: 0, y: 0 }, enc, celular, max), Z.VISTA_INICIAL)
})

test('sobre a imagem ou no fundo em volta dela', () => {
  const enc = Z.encaixar(quadro, celular)
  assert.equal(Z.sobreAImagem({ x: 0, y: 100 }, Z.VISTA_INICIAL, enc), true)
  assert.equal(Z.sobreAImagem({ x: 0, y: 200 }, Z.VISTA_INICIAL, enc), false)
  assert.equal(Z.sobreAImagem({ x: 0, y: 200 }, { escala: 2, x: 0, y: 0 }, enc), true)
})

test('roda do mouse: para baixo reduz, para cima amplia; a pinça do touchpad é mais sensível', () => {
  assert.ok(Z.fatorDaRoda(100, 0, false) < 1)
  assert.ok(Z.fatorDaRoda(-100, 0, false) > 1)
  assert.ok(perto(Z.fatorDaRoda(3, 1, false), Z.fatorDaRoda(48, 0, false)))
  assert.ok(Z.fatorDaRoda(-10, 0, true) > Z.fatorDaRoda(-10, 0, false))
  // Um giro enorme não pula de uma vez
  assert.equal(Z.fatorDaRoda(-5000, 0, false), Z.fatorDaRoda(-300, 0, false))
})
