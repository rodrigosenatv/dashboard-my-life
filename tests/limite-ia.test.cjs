const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const carregar = require("./carregar-ts.cjs")

const { interpretarDecisaoReserva, LIMITES_IA_COMPARTILHADA } =
  carregar("src/lib/ia/politica-limite.ts")

test("só aceita reserva aprovada explicitamente pelo banco", () => {
  assert.deepEqual(interpretarDecisaoReserva({ permitido: true }), { permitido: true })
  for (const dado of [null, undefined, {}, [], { permitido: "true" }, { permitido: 1 }]) {
    assert.equal(interpretarDecisaoReserva(dado), null)
  }
})

test("interpreta negativa e arredonda Retry-After", () => {
  assert.deepEqual(
    interpretarDecisaoReserva({ permitido: false, motivo: "usuario_hora", retryAfter: 4.1 }),
    { permitido: false, motivo: "usuario_hora", retryAfter: 5 },
  )
  for (const motivo of ["global_dia", "concorrencia"]) {
    assert.ok(interpretarDecisaoReserva({ permitido: false, motivo, retryAfter: 15 }))
  }
})

test("falha fechada em respostas malformadas ou Retry-After inválido", () => {
  for (const retryAfter of [-1, 0, Infinity, "15", 100000]) {
    assert.equal(interpretarDecisaoReserva({
      permitido: false, motivo: "concorrencia", retryAfter,
    }), null)
  }
  assert.equal(interpretarDecisaoReserva({ permitido: false, motivo: "outro", retryAfter: 15 }), null)
})

test("migration e constantes preservam a política e bloqueiam acesso direto de clientes", () => {
  const sql = fs.readFileSync(
    path.resolve(__dirname, "../supabase/migrations/20261023180000_limite_ia_compartilhada.sql"),
    "utf8",
  )
  assert.match(sql, /pg_advisory_xact_lock\(/)
  assert.match(sql, /security invoker/g)
  assert.match(sql, /from public, anon, authenticated/g)
  assert.match(sql, /to service_role/g)
  assert.match(sql, /enable row level security/g)
  assert.match(sql, new RegExp(`coalesce\\(uso_usuario, 0\\) >= ${LIMITES_IA_COMPARTILHADA.porUsuarioHora}`))
  assert.match(sql, new RegExp(`coalesce\\(uso_global, 0\\) >= ${LIMITES_IA_COMPARTILHADA.globalDia}`))
  assert.match(sql, new RegExp(`ocupacao_usuario >= ${LIMITES_IA_COMPARTILHADA.simultaneasPorUsuario}`))
  assert.match(sql, new RegExp(`ocupacao_global >= ${LIMITES_IA_COMPARTILHADA.simultaneasGlobais}`))
  assert.match(sql, new RegExp(`interval '${LIMITES_IA_COMPARTILHADA.minutosDaReserva} minutes'`))
})

test("o POST reserva antes de chamar o provedor e libera nos dois caminhos", () => {
  const route = fs.readFileSync(path.resolve(__dirname, "../src/app/api/ia/route.ts"), "utf8")
  assert.ok(route.indexOf("await reservarUsoIACompartilhada") < route.indexOf("for await (const pedaco of responder"))
  assert.match(route, /status: 429/)
  assert.match(route, /Retry-After/)
  assert.match(route, /status: 503/)
  assert.equal((route.match(/await liberarUsoIACompartilhada/g) || []).length, 2)
})
