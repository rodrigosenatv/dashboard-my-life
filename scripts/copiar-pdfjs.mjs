// Copia os arquivos do pdf.js que o navegador busca à parte (o worker, fontes padrão, cmaps e
// decodificadores) para public/pdfjs. Roda sozinho antes de `npm run dev` e `npm run build`.
import { cp, mkdir, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const origem = dirname(require.resolve("pdfjs-dist/package.json"))
const destino = join(process.cwd(), "public", "pdfjs")

await rm(destino, { recursive: true, force: true })
await mkdir(destino, { recursive: true })
await cp(join(origem, "legacy", "build", "pdf.worker.min.mjs"), join(destino, "pdf.worker.min.mjs"))
for (const pasta of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  await cp(join(origem, pasta), join(destino, pasta), { recursive: true })
}
console.log("pdf.js copiado para public/pdfjs")
