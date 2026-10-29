const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const G = require("./carregar-ts.cjs")("src/lib/ia/gemini-logica.ts")

const gen = (name, extra = {}) => ({ name: `models/${name}`, baseModelId: name, displayName: name, inputTokenLimit: 1048576, supportedGenerationMethods: ["generateContent", "countTokens"], ...extra })

test("ordem: geração mais nova, depois Pro > Flash > Flash-Lite, estável antes da prévia", () => {
  const lista = [
    gen("gemini-2.5-flash"),
    gen("gemini-2.5-pro"),
    gen("gemini-3.5-flash-lite"),
    gen("gemini-3.8-flash"),
    gen("gemini-3.8-flash-preview-09-2026"),
    gen("gemini-3.8-pro-preview"),
    gen("gemini-3.5-flash"),
  ]
  assert.deepEqual(G.ordenarGemini(lista).map((m) => m.id), [
    "gemini-3.8-pro-preview",
    "gemini-3.8-flash",
    "gemini-3.8-flash-preview-09-2026",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
  ])
})

test("fora da fila: voz, imagem, embeddings, Gemma, apelidos -latest e quem não gera conteúdo", () => {
  const lista = [
    gen("gemini-2.5-flash-preview-tts"),
    gen("gemini-2.5-flash-image"),
    gen("gemini-embedding-001", { supportedGenerationMethods: ["embedContent"] }),
    gen("gemma-4-27b-it"),
    gen("gemini-flash-latest"),
    gen("gemini-2.5-flash-native-audio-preview"),
    gen("gemini-robotics-er-2-preview"),
    gen("gemini-2.5-computer-use-preview"),
    gen("gemini-3-flash", { supportedGenerationMethods: ["countTokens"] }),
    gen("gemini-2.5-flash"),
  ]
  assert.deepEqual(G.ordenarGemini(lista).map((m) => m.id), ["gemini-2.5-flash"])
})

test("variantes repetidas ficam uma vez, com o nome mais curto", () => {
  const lista = [gen("gemini-2.5-flash-001"), gen("gemini-2.5-flash"), gen("gemini-2.5-flash-002")]
  assert.deepEqual(G.ordenarGemini(lista).map((m) => m.id), ["gemini-2.5-flash"])
})

test("lê versão, nível e canal pelo nome", () => {
  assert.deepEqual(G.lerModeloGemini("gemini-3-pro-preview"), { versao: 3, nivel: 3, canal: 1 })
  assert.deepEqual(G.lerModeloGemini("gemini-3.1-flash-lite-preview"), { versao: 3.1, nivel: 1, canal: 1 })
  assert.deepEqual(G.lerModeloGemini("gemini-2.0-flash-exp"), { versao: 2, nivel: 2, canal: 0 })
  assert.equal(G.lerModeloGemini("gemma-3-27b-it"), null)
})

test("espera do RetryInfo e meia-noite do Pacífico", () => {
  assert.equal(G.lerEspera("39s"), 39000)
  assert.equal(G.lerEspera("1.5s"), 1500)
  assert.equal(G.lerEspera(undefined), undefined)
  // 23h no Pacífico (PDT, UTC-7) → 1 hora até a meia-noite
  assert.equal(G.ateMeiaNoitePacifico(Date.parse("2026-10-29T06:00:00Z")), 60 * 60_000)
  // 10h no Pacífico → 14 horas
  assert.equal(G.ateMeiaNoitePacifico(Date.parse("2026-10-29T17:00:00Z")), 14 * 3600_000)
})

test("decisão: limites trocam de modelo; chave e região param", () => {
  const AGORA = Date.parse("2026-10-29T17:00:00Z")
  const minuto = G.decidirAposFalhaGemini({ status: 429, mensagem: "You exceeded your current quota", cotas: ["GenerateRequestsPerMinutePerProjectPerModel-FreeTier"], esperaMs: 39000 }, AGORA)
  assert.deepEqual(minuto, { acao: "trocar", pausaMs: 39000, limite: true })
  const dia = G.decidirAposFalhaGemini({ status: 429, mensagem: "You exceeded your current quota", cotas: ["GenerateRequestsPerDayPerProjectPerModel-FreeTier"] }, AGORA)
  assert.deepEqual(dia, { acao: "trocar", pausaMs: 14 * 3600_000, limite: true })
  const naoGratuito = G.decidirAposFalhaGemini({ status: 429, mensagem: "Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-2.5-pro" })
  assert.deepEqual(naoGratuito, { acao: "trocar", pausaMs: 12 * 3600_000, limite: true })
  assert.equal(G.decidirAposFalhaGemini({ status: 400, mensagem: "API key not valid. Please pass a valid API key." }).codigo, "chave-invalida")
  assert.equal(G.decidirAposFalhaGemini({ status: 400, mensagem: "User location is not supported for the API use." }).codigo, "regiao")
  assert.equal(G.decidirAposFalhaGemini({ status: 403, mensagem: "Permission denied" }).acao, "parar")
  assert.equal(G.decidirAposFalhaGemini({ status: 404, mensagem: "models/x is not found" }).acao, "trocar")
  assert.deepEqual(G.decidirAposFalhaGemini({ status: 503, mensagem: "The model is overloaded" }), { acao: "trocar", pausaMs: 120_000 })
})

test("Gemini usa só a chave da pessoa e não troca depois do primeiro texto", () => {
  const g = fs.readFileSync(path.join(__dirname, "..", "src/lib/ia/gemini.ts"), "utf8")
  assert.match(g, /import "server-only"/)
  assert.doesNotMatch(g, /process\.env|GEMINI_API_KEY|GOOGLE_API_KEY/)
  assert.match(g, /if \(emitiu \|\| erro\.codigo === "bloqueado"\) throw erro/)
})
