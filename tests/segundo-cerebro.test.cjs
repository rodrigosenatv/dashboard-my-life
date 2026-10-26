const test = require('node:test')
const assert = require('node:assert/strict')
const L = require('./carregar-ts.cjs')('src/features/segundo-cerebro/logica.ts')

const no = (id, pai, feito = false, pos = 1) => ({ id, parent_id: pai, done: feito, position: pos })

test('progresso: etapas e subetapas', () => {
  // Projeto com 5 etapas: 1 feita e uma com 3 subetapas (1 feita) conta 1/3
  const todos = [
    no('p', null),
    no('e1', 'p', true, 1), no('e2', 'p', false, 2), no('e3', 'p', false, 3), no('e4', 'p', false, 4), no('e5', 'p', false, 5),
    no('s1', 'e2', true, 1), no('s2', 'e2', false, 2), no('s3', 'e2', false, 3),
  ]
  assert.deepEqual(L.progresso('p', todos), { feitos: 1.3, total: 5 })
  // Etapa com subetapas marcada como feita conta inteira
  todos[2].done = true
  assert.deepEqual(L.progresso('p', todos), { feitos: 2, total: 5 })
  assert.deepEqual(L.progresso('sem-etapas', todos), { feitos: 0, total: 0 })
})

test('texto das etapas, com vírgula', () => {
  assert.equal(L.textoEtapas(1.3, 5), '1,3 de 5 etapas')
  assert.equal(L.textoEtapas(2, 4), '2 de 4 etapas')
  assert.equal(L.textoEtapas(0, 1), '0 de 1 etapa')
  assert.equal(L.textoEtapas(0, 0), 'Sem etapas')
})

test('a próxima etapa é a primeira aberta, na ordem', () => {
  const todos = [no('a', 'p', true, 1), no('c', 'p', false, 3), no('b', 'p', false, 2), no('x', 'outro', false, 0)]
  assert.equal(L.proximaEtapa('p', todos).id, 'b')
  assert.equal(L.proximaEtapa('p', [no('a', 'p', true, 1)]), null)
})

test('estado do prazo', () => {
  assert.equal(L.estadoPrazo(-3), 'atrasado')
  assert.equal(L.estadoPrazo(0), 'perto')
  assert.equal(L.estadoPrazo(7), 'perto')
  assert.equal(L.estadoPrazo(8), 'longe')
  assert.equal(L.estadoPrazo(null), null)
  // Projeto feito não fica atrasado
  assert.equal(L.estadoPrazo(-3, true), null)
})

test('dias na fila da caixa de entrada', () => {
  const hoje = new Date('2026-10-26T10:00:00')
  assert.equal(L.diasNaFila(['2026-10-26T09:40:00Z', '2026-10-22T21:00:00Z'], hoje), 4)
  assert.equal(L.diasNaFila([], hoje), 0)
  assert.equal(L.diasNaFila(['data ruim'], hoje), 0)
})
