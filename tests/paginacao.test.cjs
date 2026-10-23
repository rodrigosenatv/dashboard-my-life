const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buscarTodos } = require('./carregar-ts.cjs')('src/lib/paginacao.ts')
test('preserva todos os registros e limites inclusivos entre lotes', async () => {
  const linhas = Array.from({length: 2003}, (_, id) => ({id}))
  const chamadas = []
  const resultado = await buscarTodos((de, ate) => { chamadas.push([de, ate]); return Promise.resolve({data:linhas.slice(de, ate+1), error:null}) })
  assert.deepEqual(resultado, linhas)
  assert.deepEqual(chamadas, [[0,999],[1000,1999],[2000,2999]])
})
test('não consulta quando o sinal já está abortado', async () => {
  const c = new AbortController(); c.abort(); let chamadas = 0
  await assert.rejects(buscarTodos(() => { chamadas++; return Promise.resolve({data:[],error:null}) }, c.signal), {name:'AbortError'})
  assert.equal(chamadas, 0)
})
test('interrompe a paginação entre lotes', async () => {
  const c = new AbortController(); let chamadas = 0
  await assert.rejects(buscarTodos(() => { chamadas++; c.abort(); return Promise.resolve({data:chamadas === 1 ? Array(1000).fill(1) : [],error:null}) }, c.signal), {name:'AbortError'})
  assert.equal(chamadas, 1)
})
test('propaga erro do banco sem devolver uma lista parcial', async () => {
  await assert.rejects(buscarTodos(() => Promise.resolve({data:null,error:{message:'indisponível'}})), /indisponível/)
})
