const test = require('node:test')
const assert = require('node:assert/strict')
const { indexarArvore, filtrarArvore } = require('./carregar-ts.cjs')('src/features/paginas/arvore.ts')
const pagina = (id, parent_id = null, title = id, position = 0, section = 'notas') => ({ id, parent_id, title, position, section })

test('ordena sem mutar a entrada e conta filhos de outras seções', () => {
  const paginas = [pagina('r'), pagina('b', 'r', 'B'), pagina('a', 'r', 'A'), pagina('c', 'a', 'C', 0, 'wiki'), pagina('d', 'r', 'D', -1)]
  const original = JSON.stringify(paginas)
  const indice = indexarArvore(paginas)
  assert.deepEqual(indice.filhos.get('r').map(p => p.id), ['d', 'a', 'b'])
  assert.equal(indice.descendentes.get('r'), 4)
  assert.equal(indice.descendentes.get('a'), 1)
  assert.equal(indice.descendentes.get('c'), 0)
  assert.equal(JSON.stringify(paginas), original)
})

test('busca mostra apenas correspondências e seus ancestrais', () => {
  const indice = indexarArvore([pagina('r'), pagina('a', 'r'), pagina('b', 'r'), pagina('c', 'a')])
  assert.deepEqual([...filtrarArvore(indice, p => p.id === 'c')].sort(), ['a', 'c', 'r'])
  assert.deepEqual([...filtrarArvore(indice, p => p.id === 'r')], ['r'])
  assert.equal(filtrarArvore(indice, () => false).size, 0)
  assert.equal(filtrarArvore(indice, () => true).size, 4)
})

test('preserva órfãos, folhas e ordem estável de títulos iguais', () => {
  const indice = indexarArvore([pagina('a', 'ausente', 'Mesmo'), pagina('b', 'ausente', 'Mesmo')])
  assert.deepEqual(indice.filhos.get('ausente').map(p => p.id), ['a', 'b'])
  assert.deepEqual([...indice.descendentes.values()], [0, 0])
  assert.equal(indexarArvore([]).posOrdem.length, 0)
})

test('árvores profundas não usam recursão e avaliam cada título uma vez', () => {
  const tamanho = 30000
  const paginas = Array.from({ length: tamanho }, (_, i) => pagina(String(i), i ? String(i - 1) : null))
  const indice = indexarArvore(paginas)
  assert.equal(indice.descendentes.get('0'), tamanho - 1)
  let consultas = 0
  const encontrados = filtrarArvore(indice, p => { consultas++; return p.id === String(tamanho - 1) })
  assert.equal(consultas, tamanho)
  assert.equal(encontrados.size, tamanho)
})

test('ciclos e autorreferências têm uma aresta removida e terminam', () => {
  const indice = indexarArvore([pagina('a', 'b'), pagina('b', 'a'), pagina('c', 'b'), pagina('s', 's')])
  assert.equal(indice.descendentes.get('a'), 2)
  assert.equal(indice.descendentes.get('s'), 0)
  assert.equal(indice.filhos.get('s').length, 0)
  assert.deepEqual([...filtrarArvore(indice, p => p.id === 'c')].sort(), ['a', 'b', 'c'])
})

test('índices equivalem à implementação anterior numa floresta com várias ramificações', () => {
  const paginas = Array.from({ length: 250 }, (_, i) => pagina(String(i), i % 13 === 0 ? null : String(Math.floor((i - 1) / 3)), `Título ${i % 9}`, i % 4))
  const filhos = id => paginas.filter(p => p.parent_id === id).sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
  const contar = id => filhos(id).reduce((n, p) => n + 1 + contar(p.id), 0)
  const indice = indexarArvore(paginas)
  for (const p of paginas) {
    assert.deepEqual(indice.filhos.get(p.id) ?? [], filhos(p.id))
    assert.equal(indice.descendentes.get(p.id), contar(p.id))
  }
  for (const busca of ['0', '7', 'inexistente']) {
    const casa = p => p.title.includes(busca) || filhos(p.id).some(casa)
    assert.deepEqual([...filtrarArvore(indice, p => p.title.includes(busca))].sort(), paginas.filter(casa).map(p => p.id).sort())
  }
})
