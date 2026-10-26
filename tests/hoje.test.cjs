process.env.TZ = 'America/Bahia'
const test = require('node:test')
const assert = require('node:assert/strict')
const L = require('./carregar-ts.cjs')('src/features/hoje/logica.ts')

const tarefa = (titulo, status, dia, hora = null, feitaEm = null) => ({ titulo, status, due_date: dia, due_time: hora, done_at: feitaEm })

test('tarefas do dia: atrasadas primeiro, depois pela hora', () => {
  const t = L.tarefasDoDia(
    [
      tarefa('sem hora', 'todo', '2026-10-26'),
      tarefa('às 14h', 'todo', '2026-10-26', '14:00'),
      tarefa('de ontem', 'todo', '2026-10-25'),
      tarefa('amanhã', 'todo', '2026-10-27'),
      tarefa('fazendo, sem data', 'doing', null),
      tarefa('feita hoje', 'done', '2026-10-26', null, '2026-10-26T14:20:00Z'),
      tarefa('feita ontem à noite (no fuso daqui)', 'done', '2026-10-25', null, '2026-10-26T01:00:00Z'),
    ],
    '2026-10-26',
  )
  assert.deepEqual(t.pendentes.map((x) => x.titulo), ['de ontem', 'às 14h', 'sem hora'])
  assert.equal(t.atrasadas, 1)
  assert.deepEqual(t.semData.map((x) => x.titulo), ['fazendo, sem data'])
  assert.deepEqual(t.concluidasHoje.map((x) => x.titulo), ['feita hoje'])
})

const evento = (titulo, ini, fim = null, todoDia = false) => ({ titulo, starts_at: ini, ends_at: fim, all_day: todoDia })

test('agenda dos próximos dias, por dia', () => {
  const eventos = [
    evento('viagem que começou ontem', '2026-10-25T08:00:00-03:00', '2026-10-27T18:00:00-03:00'),
    evento('reunião', '2026-10-26T10:00:00-03:00'),
    evento('mentoria', '2026-10-27T09:00:00-03:00'),
    evento('longe demais', '2026-11-05T09:00:00-03:00'),
    evento('já passou', '2026-10-20T09:00:00-03:00'),
  ]
  const dias = L.agendaPorDia(eventos, '2026-10-26')
  assert.deepEqual(dias.map(([d, l]) => [d, l.map((e) => e.titulo)]), [
    ['2026-10-26', ['viagem que começou ontem', 'reunião']],
    ['2026-10-27', ['mentoria']],
  ])
})

test('a linha do dia: faixa, posição e o que vem agora', () => {
  const hoje = '2026-10-26'
  const doDia = L.eventosComHora(
    [
      evento('live', '2026-10-26T20:00:00-03:00', '2026-10-26T21:00:00-03:00'),
      evento('reunião', '2026-10-26T10:00:00-03:00', '2026-10-26T11:00:00-03:00'),
      evento('aniversário', '2026-10-26T00:00:00-03:00', null, true),
      evento('amanhã', '2026-10-27T09:00:00-03:00'),
    ],
    hoje,
  )
  assert.deepEqual(doDia.map((e) => e.titulo), ['reunião', 'live'])

  const agora = new Date('2026-10-26T08:35:00-03:00')
  const faixa = L.faixaDoDia(agora, doDia.map((e) => new Date(e.starts_at)))
  assert.deepEqual(faixa, { inicio: 6, fim: 24 })
  assert.equal(L.posicaoNaFaixa(new Date('2026-10-26T15:00:00-03:00'), faixa), 50)
  assert.equal(L.posicaoNaFaixa(new Date('2026-10-26T03:00:00-03:00'), faixa), 0)
  // De madrugada a faixa começa mais cedo
  assert.deepEqual(L.faixaDoDia(new Date('2026-10-26T02:10:00-03:00'), []), { inicio: 0, fim: 24 })
  assert.deepEqual(L.faixaDoDia(new Date('2026-10-26T09:00:00-03:00'), [new Date('2026-10-26T05:30:00-03:00')]), { inicio: 3, fim: 24 })

  const s = L.situacaoDaAgenda(doDia, agora)
  assert.equal(s.tipo, 'proximo')
  assert.equal(s.evento.titulo, 'reunião')
  assert.equal(s.minutos, 85)
  assert.equal(L.situacaoDaAgenda(doDia, new Date('2026-10-26T10:30:00-03:00')).tipo, 'agora')
  assert.equal(L.situacaoDaAgenda(doDia, new Date('2026-10-26T22:00:00-03:00')).tipo, 'fim')
  assert.equal(L.situacaoDaAgenda([], agora).tipo, 'livre')
  // Sem hora de fim, conta 1 hora
  assert.equal(L.situacaoDaAgenda([evento('café', '2026-10-26T08:00:00-03:00')], agora).tipo, 'agora')
})

test('textos de espera e a caixa de entrada', () => {
  assert.equal(L.textoEspera(25), 'em 25 min')
  assert.equal(L.textoEspera(0), 'em 1 min')
  assert.equal(L.textoEspera(60), 'em 1 h')
  assert.equal(L.textoEspera(85), 'em 1 h 25')
  assert.equal(L.textoEspera(125), 'em 2 h 05')
  const caps = [
    { id: 'a', archived: false, area_id: null, kind: null },
    { id: 'b', archived: false, area_id: null, kind: 'Ideia' },
    { id: 'c', archived: false, area_id: 'x', kind: null },
    { id: 'd', archived: true, area_id: null, kind: null },
    { id: 'e', archived: false, area_id: null, kind: null },
  ]
  assert.equal(L.capturasNaCaixa(caps, new Set(['e'])), 1)
})
