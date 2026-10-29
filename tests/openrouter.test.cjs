const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const L = require("./carregar-ts.cjs")("src/lib/ia/openrouter-logica.ts")

const AGORA = Date.parse("2026-10-29T12:00:00Z")
const seg = (iso) => Date.parse(iso) / 1000
const gratis = { prompt: "0", completion: "0" }
const texto = { input_modalities: ["text"], output_modalities: ["text"] }

const lista = [
  // grande e caro na versão paga
  { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (free)", created: seg("2026-05-01"), context_length: 163840, pricing: gratis, architecture: texto, supported_parameters: ["reasoning"] },
  { id: "deepseek/deepseek-r1", created: seg("2026-05-01"), pricing: { prompt: "0.0000007", completion: "0.0000025" }, architecture: texto },
  // pequeno
  { id: "meta-llama/llama-3.2-3b-instruct:free", name: "Llama 3.2 3B (free)", created: seg("2024-09-25"), context_length: 131072, pricing: gratis, architecture: texto },
  // sem versão paga, mas grande pelo nome
  { id: "qwen/qwen3-235b-a22b:free", name: "Qwen3 235B A22B (free)", created: seg("2026-04-28"), context_length: 131072, pricing: gratis, architecture: texto, supported_parameters: ["tools"] },
  // pago: não entra
  { id: "openai/gpt-5", pricing: { prompt: "0.00000125", completion: "0.00001" }, architecture: texto },
  // gera imagem: não entra
  { id: "google/imagem:free", pricing: gratis, architecture: { input_modalities: ["text"], output_modalities: ["image"] } },
  // roteadores e expirados: não entram no ranking
  { id: "openrouter/free", pricing: gratis, architecture: texto },
  { id: "velho/modelo-70b:free", pricing: gratis, architecture: texto, expiration_date: "2026-10-01" },
]

test("ranking só tem gratuitos de texto, do mais avançado ao mais simples", () => {
  const ids = L.ordenarGratuitos(lista, AGORA).map((m) => m.id)
  assert.deepEqual(ids, ["deepseek/deepseek-r1:free", "qwen/qwen3-235b-a22b:free", "meta-llama/llama-3.2-3b-instruct:free"])
})

test("gratuito exige preço zero em entrada, saída e por pedido", () => {
  assert.equal(L.ehGratuito({ id: "a", pricing: gratis }), true)
  assert.equal(L.ehGratuito({ id: "a", pricing: { prompt: "0", completion: "0.000001" } }), false)
  assert.equal(L.ehGratuito({ id: "a", pricing: { prompt: "0", completion: "0", request: "0.01" } }), false)
  assert.equal(L.ehGratuito({ id: "a" }), false)
})

test("tamanho lido do nome, inclusive mistura de especialistas", () => {
  assert.equal(L.bilhoesDeParametros("meta-llama/llama-3.3-70b-instruct"), 70)
  assert.equal(L.bilhoesDeParametros("mistralai/mixtral-8x22b"), 176)
  assert.equal(L.bilhoesDeParametros("qwen3-235b-a22b"), 235)
  assert.equal(L.bilhoesDeParametros("deepseek-v3.1"), 0)
})

test("fila: auto expande o ranking e termina no roteador gratuito; lista manual mantém a ordem", () => {
  const ranking = ["a:free", "b:free"]
  assert.deepEqual(L.filaDeModelos("", ranking), ["a:free", "b:free", "openrouter/free"])
  assert.deepEqual(L.filaDeModelos("auto", ranking), ["a:free", "b:free", "openrouter/free"])
  assert.deepEqual(L.filaDeModelos("x:free, b:free", ranking), ["x:free", "b:free"])
  assert.deepEqual(L.filaDeModelos("b:free, auto", ranking), ["b:free", "a:free", "openrouter/free"])
  assert.equal(L.usaAutomatico("x:free"), false)
  assert.equal(L.usaAutomatico(undefined), true)
})

test("modelos em pausa ficam de fora; se todos estiverem, tenta o que volta primeiro", () => {
  const fila = ["a", "b", "c", "d", "e", "f", "g"]
  const pausa = { a: AGORA + 1000, c: AGORA + 5000 }
  assert.deepEqual(L.escolherTentativas(fila, (id) => pausa[id] ?? 0, AGORA), ["b", "d", "e", "f", "g"])
  const todas = { a: AGORA + 9000, b: AGORA + 1000 }
  assert.deepEqual(L.escolherTentativas(["a", "b"], (id) => todas[id], AGORA), ["b", "a"])
})

test("decisão depois de falha: troca de modelo ou para", () => {
  assert.deepEqual(L.decidirAposFalha(429, "Rate limit exceeded: free-models-per-day"), { acao: "parar", pausaMs: 0, codigo: "limite-diario" })
  assert.deepEqual(L.decidirAposFalha(429, "Rate limit exceeded", 20_000), { acao: "trocar", pausaMs: 20_000 })
  assert.deepEqual(L.decidirAposFalha(429, "temporarily rate-limited upstream"), { acao: "trocar", pausaMs: 60_000 })
  assert.equal(L.decidirAposFalha(404, "No endpoints found for x:free").acao, "trocar")
  assert.equal(L.decidirAposFalha(404, "No endpoints found matching your data policy").codigo, "politica-dados")
  assert.equal(L.decidirAposFalha(401, "User not found.").acao, "parar")
  assert.equal(L.decidirAposFalha(402, "Insufficient credits").codigo, "conta")
  assert.equal(L.decidirAposFalha(503, "No available provider").pausaMs, 120_000)
  assert.equal(L.decidirAposFalha(undefined, "fetch failed").acao, "trocar")
  assert.deepEqual(L.decidirAposFalha(204, "o modelo não devolveu texto"), { acao: "trocar", pausaMs: 0 })
})

test("OpenRouter segue as regras de chave pessoal e só troca antes do primeiro texto", () => {
  const ler = (n) => fs.readFileSync(path.join(__dirname, "..", n), "utf8")
  const or = ler("src/lib/ia/openrouter.ts")
  assert.match(or, /import "server-only"/)
  assert.doesNotMatch(or, /process\.env|OPENROUTER_API_KEY/)
  assert.match(or, /if \(emitiu\) throw erro/)
  assert.match(ler("src/lib/ia/servidor.ts"), /provedor === "openrouter"/)
  const gratuitos = ler("src/app/api/ia/gratuitos/route.ts")
  assert.match(gratuitos, /getClaims\(\)/)
  assert.doesNotMatch(gratuitos, /corpo\.chave|Authorization/)
})
