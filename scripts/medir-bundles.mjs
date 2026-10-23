import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

// Execute depois de npm run build. Mede scripts referenciados no HTML, sem
// confundir payload estático com Web Vitals ou requests de uma sessão real.
const raiz = path.resolve(process.argv[2] || '.')
const pasta = path.join(raiz, '.next/server/app')
const resultados = []
async function visitar(dir) {
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const nome = path.join(dir, entrada.name)
    if (entrada.isDirectory()) { await visitar(nome); continue }
    if (!nome.endsWith('.html')) continue
    const html = await readFile(nome, 'utf8')
    const scripts = [...new Set([...html.matchAll(/<script\b[^>]*\bsrc="(\/_next\/[^"?]+)(?:\?[^"\s]*)?"/g)].map(m => m[1]))]
    let bytes = 0, gzip = 0
    for (const script of scripts) {
      const conteudo = await readFile(path.join(raiz, '.next', script.slice('/_next/'.length)))
      bytes += conteudo.length
      gzip += gzipSync(conteudo).length
    }
    resultados.push({ rota: path.relative(pasta, nome), bytes, gzip, scripts: scripts.length })
  }
}
await visitar(pasta)
console.log(JSON.stringify(resultados.sort((a, b) => a.rota.localeCompare(b.rota)), null, 2))
