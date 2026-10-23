const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { Worker } = require('node:worker_threads')
const { zipSync, strToU8 } = require('fflate')

// Executa o worker real em thread separada, com a pequena ponte de mensagens
// equivalente à API de Web Worker. Não substitui validação em navegador.
function executar(bytes) {
  const raiz = path.resolve(__dirname, '..')
  const worker = new Worker(`
    const { parentPort } = require('node:worker_threads')
    const fs = require('node:fs')
    const ts = require(${JSON.stringify(require.resolve('typescript'))})
    require.extensions['.ts'] = (m, nome) => m._compile(ts.transpileModule(fs.readFileSync(nome, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText, nome)
    global.self = { postMessage: (data, options) => parentPort.postMessage(data, options?.transfer) }
    require(${JSON.stringify(path.join(raiz, 'src/features/importar/preparar.worker.ts'))})
    parentPort.on('message', data => self.onmessage({ data }))
  `, { eval: true })
  return new Promise((resolve, reject) => {
    const encerrar = () => worker.terminate()
    worker.once('message', data => { encerrar(); resolve(data) })
    worker.once('error', erro => { encerrar(); reject(erro) })
    worker.postMessage({ bytes, usuarioId: 'usuario-teste' }, [bytes.buffer])
  })
}

test('worker abre ZIPs aninhados e transfere Map e anexos sem alterar bytes', { timeout: 10000 }, async () => {
  const foto = new Uint8Array([0, 128, 255, 20])
  const bytes = zipSync({ 'parte.zip': zipSync({ 'foto.png': foto, 'Página.md': strToU8('# Página\n\nConteúdo de teste') }) })
  const resultado = await executar(bytes)
  assert.equal(resultado.erro, undefined)
  assert.ok(resultado.arquivos instanceof Map)
  assert.deepEqual(resultado.arquivos.get('foto.png'), foto)
  assert.ok(resultado.plano.linhas.pages.some(p => p.title === 'Página'))
  assert.ok(Array.isArray(resultado.resumo))
})

test('worker devolve erro para ZIP inválido sem produzir plano parcial', { timeout: 10000 }, async () => {
  const resultado = await executar(new Uint8Array([1, 2, 3]))
  assert.equal(typeof resultado.erro, 'string')
  assert.equal(resultado.plano, undefined)
})
