const test = require("node:test")
const assert = require("node:assert/strict")
const { zipSync, strToU8 } = require("fflate")
const carregar = require("./carregar-ts.cjs")
const { abrirZip } = carregar("src/features/importar/zip.ts")
const { mesmaOrigem } = carregar("src/lib/seguranca/origem.ts")

test("origens autenticadas devem coincidir exatamente", () => {
  const url = "https://dashboard-my-life.vercel.app/api/ia"
  assert.equal(mesmaOrigem("https://dashboard-my-life.vercel.app", url), true)
  for (const origem of [null, "null", "https://evil.example", "https://dashboard-my-life.vercel.app.evil.com", "https://dashboard-my-life.vercel.app:444", "javascript:alert(1)", "https://dashboard-my-life.vercel.app/extra"]) {
    assert.equal(mesmaOrigem(origem, url), false)
  }
})

test("ZIP do Notion válido preserva arquivos mistos", () => {
  const bytes = zipSync({ "anotacao.md": strToU8("# Título"), "foto.png": new Uint8Array([0, 5, 255]) })
  const data = abrirZip(bytes)
  assert.equal(data.size, 2)
  assert.equal(new TextDecoder().decode(data.get("anotacao.md")), "# Título")
})

test("ZIP com tamanho expandido excessivo é rejeitado antes da extração", () => {
  const bytes = zipSync({ "texto.txt": strToU8("conteudo ".repeat(120)) })
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let p = -1
  for (let i = 0; i < bytes.length - 4; i++) {
    if (v.getUint32(i, true) === 0x02014b50) { p = i; break }
  }
  assert.ok(p >= 0)
  v.setUint32(p + 24, 101 * 1024 * 1024, true)
  assert.throws(() => abrirZip(bytes), /grande demais/)
})
