const test = require('node:test')
const assert = require('node:assert/strict')
const Q = require('./carregar-ts.cjs')('src/features/flow/quadro-logica.ts')

test('quadro dos alvos nas preferências: só um caminho de arquivo válido', () => {
  assert.equal(Q.lerQuadro({ quadroAlvos: 'u1/flow/quadro-1.webp' }), 'u1/flow/quadro-1.webp')
  assert.equal(Q.lerQuadro({ quadroAlvos: '  u1/flow/quadro-1.webp ' }), 'u1/flow/quadro-1.webp')
  assert.equal(Q.lerQuadro(undefined), null)
  assert.equal(Q.lerQuadro({}), null)
  assert.equal(Q.lerQuadro({ quadroAlvos: null }), null)
  assert.equal(Q.lerQuadro({ quadroAlvos: '' }), null)
  assert.equal(Q.lerQuadro({ quadroAlvos: 42 }), null)
  // Sem pasta, subindo de pasta ou a partir da raiz: fora
  assert.equal(Q.lerQuadro({ quadroAlvos: 'quadro.webp' }), null)
  assert.equal(Q.lerQuadro({ quadroAlvos: 'u1/../u2/quadro.webp' }), null)
  assert.equal(Q.lerQuadro({ quadroAlvos: '/u1/flow/quadro.webp' }), null)
  assert.equal(Q.lerQuadro({ quadroAlvos: 'u1//quadro.webp' }), null)
})

test('extensão e caminho de um quadro novo', () => {
  assert.equal(Q.extensaoDaImagem('image/webp', 'quadro.png'), 'webp')
  assert.equal(Q.extensaoDaImagem('image/jpeg', 'x'), 'jpg')
  assert.equal(Q.extensaoDaImagem('IMAGE/PNG', 'x'), 'png')
  // A capa do Hoje é copiada: o tipo não vem, vale o nome
  assert.equal(Q.extensaoDaImagem('', 'u1/capa/capa-123.webp'), 'webp')
  assert.equal(Q.extensaoDaImagem('', 'foto.JPEG'), 'jpg')
  assert.equal(Q.extensaoDaImagem('', 'sem-extensao'), 'jpg')
  assert.equal(Q.extensaoDaImagem('', 'pagina.html'), 'jpg')
  assert.equal(Q.caminhoNovoDoQuadro('u1', 'webp', 1700000000000), 'u1/flow/quadro-1700000000000.webp')
})

test('progresso da fase (a barra fina da tela de foco)', () => {
  assert.equal(Q.progressoDaFase(1500, 1500), 0)
  assert.equal(Q.progressoDaFase(750, 1500), 0.5)
  assert.equal(Q.progressoDaFase(0, 1500), 1)
  assert.equal(Q.progressoDaFase(-5, 1500), 1)
  assert.equal(Q.progressoDaFase(10, 0), 0)
})
