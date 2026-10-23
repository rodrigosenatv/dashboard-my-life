const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
module.exports = function carregar(arquivo) {
  const nome = path.resolve(__dirname, '..', arquivo)
  const codigo = ts.transpileModule(fs.readFileSync(nome, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const m = new Module(nome, module)
  m.filename = nome
  m.paths = Module._nodeModulePaths(path.dirname(nome))
  m._compile(codigo, nome)
  return m.exports
}
