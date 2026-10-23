const test = require("node:test")
const assert = require("node:assert/strict")
const carregar = require("./carregar-ts.cjs")
const { identificarTipoImagem } = carregar("src/lib/otimizar-imagem.ts")

test("rejeita SVG, HTML e dados arbitrários, mesmo com MIME de imagem", () => {
  for (const v of ["<svg xmlns='http://www.w3.org/2000/svg'></svg>", "<script>alert(1)</script>", "not-image"]) {
    assert.equal(identificarTipoImagem(new TextEncoder().encode(v)), null)
  }
})

test("identifica assinaturas JPEG, PNG, WebP e AVIF", () => {
  assert.equal(identificarTipoImagem(Uint8Array.from([255,216,255,224])), "image/jpeg")
  assert.equal(identificarTipoImagem(Uint8Array.from([137,80,78,71,13,10,26,10])), "image/png")
  assert.equal(identificarTipoImagem(new TextEncoder().encode("RIFF0000WEBP")), "image/webp")
  assert.equal(identificarTipoImagem(new TextEncoder().encode("0000ftypavif0000")), "image/avif")
})
