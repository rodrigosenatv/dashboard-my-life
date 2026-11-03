const test = require('node:test')
const assert = require('node:assert/strict')
const L = require('./carregar-ts.cjs')('src/features/conteudo/logica.ts')

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

test('prompts: blocos de código com o título mais próximo', () => {
  const md = '# Módulo\n\n## The A.I.D.A.\n\n```\nEscreva um anúncio para [PRODUTO] usando a fórmula A.I.D.A.\n```\n\n**Curto**\n\n```\nok\n```\n'
  assert.deepEqual(L.extrairPrompts(md), [{ titulo: 'The A.I.D.A.', texto: 'Escreva um anúncio para [PRODUTO] usando a fórmula A.I.D.A.' }])
})

test('campos de um prompt: colchetes e chaves, sem links nem repetição', () => {
  const t = 'Crie para [PÚBLICO-ALVO] sobre [TÓPICO]. Veja [o site](https://x.com). De novo [TÓPICO] e {número} ideias.'
  assert.deepEqual(L.camposDoPrompt(t), ['[PÚBLICO-ALVO]', '[TÓPICO]', '{número}'])
  assert.equal(L.preencherPrompt('Sobre [TÓPICO] e [TÓPICO]', { '[TÓPICO]': ' foco ' }), 'Sobre foco e foco')
  assert.equal(L.preencherPrompt('Sobre [TÓPICO]', { '[TÓPICO]': '  ' }), 'Sobre [TÓPICO]')
})

test('o texto do prompt em pedaços, com os campos marcados', () => {
  assert.deepEqual(L.partesDoPrompt('Fale de [TEMA] para {público}.'), [
    { texto: 'Fale de ', campo: false },
    { texto: '[TEMA]', campo: true },
    { texto: ' para ', campo: false },
    { texto: '{público}', campo: true },
    { texto: '.', campo: false },
  ])
  assert.deepEqual(L.partesDoPrompt('[A1] sozinho'), [{ texto: '[A1]', campo: true }, { texto: ' sozinho', campo: false }])
  assert.deepEqual(L.partesDoPrompt('sem campos'), [{ texto: 'sem campos', campo: false }])
})

test('os módulos de um curso, como no Notion (callouts com ícone e grupos dentro)', () => {
  const md = [
    `[**RECURSOS PREMIUMS - IA PROMPTS**](/paginas/${id(1)})`,
    '',
    '> <img src="https://prod-files/startup.png" alt="x" width="40px" /> **MÓDULO 01 - VOCÊ TEM NOÇÃO DISSO?**',
    '',
    '---',
    '',
    `[**MATERIAL DO MÓDULO 01**](/paginas/${id(2)})`,
    '',
    '> 🔀 **PROMPTS GERAIS**',
    '',
    `[Especialista em finanças](/paginas/${id(3)})`,
    `[Melhorar o texto](/paginas/${id(4)})`,
    '',
    '> ✨ **MÓDULO 06 - YOUTUBE**',
    '',
    '> **VÍDEOS**',
    '>',
    `> [VÍDEOS - IDEIAS](/paginas/${id(5)})`,
    `> [VÍDEOS - TÍTULOS](/paginas/${id(6)})`,
    '',
    '> **SHORTS**',
    `> [SHORTS - IDEIAS](/paginas/${id(7)})`,
    '',
    '> ✨ **MÓDULO 07 - SEM AULAS**',
    '',
    `[Repetida](/paginas/${id(3)})`,
  ].join('\n')
  const { soltas, modulos } = L.modulosDoCurso(md)
  assert.deepEqual(soltas, [id(1)])
  assert.deepEqual(modulos.map((m) => [m.numero, m.nome, m.ids.length]), [
    ['01', 'VOCÊ TEM NOÇÃO DISSO?', 1],
    [null, 'PROMPTS GERAIS', 2],
    ['06', 'YOUTUBE', 3],
  ])
  assert.equal(modulos[0].titulo, 'MÓDULO 01 - VOCÊ TEM NOÇÃO DISSO?')
  assert.deepEqual(modulos[2].grupos.map((g) => [g.titulo, g.ids.length]), [['VÍDEOS', 2], ['SHORTS', 1]])
  // Sem módulos no texto: nada a mostrar como curso
  assert.deepEqual(L.modulosDoCurso('Só um texto com [link](https://x.com).').modulos, [])
  assert.deepEqual(L.partesDoModulo('Módulo 3: Instagram'), { numero: '03', nome: 'Instagram' })
  assert.deepEqual(L.partesDoModulo('PROMPTS GERAIS'), { numero: null, nome: 'PROMPTS GERAIS' })
})

const item = (status, dia, extra = {}) => ({ status, publish_date: dia, views: null, likes: null, comments: null, shares: null, ...extra })

test('o resumo do planner e o prazo de cada conteúdo', () => {
  const hoje = '2026-10-26'
  const itens = [
    item('ideia', null), item('ideia', '2026-10-01'),
    item('idealizando', '2026-10-29'), item('gravando', '2026-10-20'), item('editando', hoje),
    item('finalizado', '2026-11-05'),
    item('publicado', '2026-10-10'), item('publicado', '2026-09-30'),
  ]
  assert.deepEqual(L.resumoDoPlanner(itens, hoje), { ideias: 2, producao: 3, prontos: 1, semana: 2, atrasados: 1, publicadosMes: 1 })
  assert.equal(L.prazoDoConteudo(item('gravando', '2026-10-20'), hoje), 'atrasado')
  assert.equal(L.prazoDoConteudo(item('editando', hoje), hoje), 'hoje')
  assert.equal(L.prazoDoConteudo(item('idealizando', '2026-10-28'), hoje), 'breve')
  assert.equal(L.prazoDoConteudo(item('idealizando', '2026-10-29'), hoje), null)
  assert.equal(L.prazoDoConteudo(item('publicado', '2026-10-01'), hoje), null)
  assert.equal(L.prazoDoConteudo(item('ideia', '2026-10-01'), hoje), null)
})

test('desempenho: mais vistos primeiro, totais e engajamento médio', () => {
  const d = L.desempenho([
    item('publicado', '2026-10-01', { views: 1000, likes: 80, comments: 10, shares: 10 }),
    item('publicado', '2026-10-02', { views: 4000, likes: 100, comments: 0, shares: 100 }),
    item('publicado', '2026-10-03'),
    item('editando', '2026-10-04', { views: 99 }),
  ])
  assert.deepEqual(d.lista.map((i) => i.views), [4000, 1000])
  assert.equal(d.visualizacoes, 5000)
  assert.equal(d.curtidas, 180)
  assert.equal(d.mediaEngajamento, 7.5)
  assert.equal(d.melhor.views, 4000)
  assert.equal(d.maximo, 4000)
  assert.equal(L.engajamento(item('publicado', null, { views: 0, likes: 3 })), null)
})

/* ------------------------------------------------------------------ */
/* A esteira, o ritmo, a reserva e os próximos passos                  */
/* ------------------------------------------------------------------ */

let seq = 0
const com = (status, dia, extra = {}) => ({ id: `c${++seq}`, format: null, ...item(status, dia), ...extra })

test('a esteira: a próxima etapa (carrossel, imagem e texto não passam por Gravando)', () => {
  assert.equal(L.proximaEtapa('ideia'), 'idealizando')
  assert.equal(L.proximaEtapa('idealizando', 'Reels/Shorts'), 'gravando')
  assert.equal(L.proximaEtapa('idealizando', 'Carrossel'), 'editando')
  assert.equal(L.proximaEtapa('idealizando', 'imagem'), 'editando')
  assert.equal(L.proximaEtapa('idealizando', 'Texto'), 'editando')
  assert.equal(L.proximaEtapa('idealizando', 'Stories'), 'gravando')
  assert.equal(L.proximaEtapa('gravando', 'Carrossel'), 'editando')
  assert.equal(L.proximaEtapa('editando'), 'finalizado')
  assert.equal(L.proximaEtapa('finalizado'), 'publicado')
  assert.equal(L.proximaEtapa('publicado'), null)
  assert.equal(L.proximaEtapa('outra'), null)
})

test('ao publicar: sem data ou com data futura vale hoje; com data passada, fica a marcada', () => {
  const hoje = '2026-11-04'
  assert.deepEqual(L.camposAoPublicar({ publish_date: null }, hoje), { status: 'publicado', publish_date: hoje })
  assert.deepEqual(L.camposAoPublicar({ publish_date: '2026-11-07' }, hoje), { status: 'publicado', publish_date: hoje })
  assert.deepEqual(L.camposAoPublicar({ publish_date: '2026-11-02' }, hoje), { status: 'publicado', publish_date: '2026-11-02' })
})

test('a semana começa na segunda-feira', () => {
  assert.equal(L.inicioDaSemana('2026-11-04'), '2026-11-02') // quarta
  assert.equal(L.inicioDaSemana('2026-11-02'), '2026-11-02') // segunda
  assert.equal(L.inicioDaSemana('2026-11-08'), '2026-11-02') // domingo
  assert.equal(L.inicioDaSemana('2026-11-01'), '2026-10-26') // domingo da semana anterior
  assert.equal(L.inicioDaSemana('2027-01-01'), '2026-12-28') // virada do ano
})

test('o ritmo da semana: publicados, agendados para os dias que faltam e o que cai em cada dia', () => {
  const hoje = '2026-11-04'
  const itens = [
    com('publicado', '2026-11-02'),
    com('publicado', '2026-10-31'), // semana passada
    com('finalizado', '2026-11-06'),
    com('editando', '2026-11-08'),
    com('gravando', '2026-11-03'), // passou e não saiu: não conta como agendado
    com('ideia', '2026-11-05'),
    com('finalizado', '2026-11-10'), // semana que vem
  ]
  const r = L.ritmoDaSemana(itens, hoje, 3)
  assert.equal(r.inicio, '2026-11-02')
  assert.equal(r.fim, '2026-11-08')
  assert.equal(r.publicados, 1)
  assert.equal(r.agendados, 2)
  assert.equal(r.faltam, 0)
  assert.equal(r.naMeta, false)
  assert.equal(r.dias.length, 7)
  assert.deepEqual(r.dias.map((d) => d.itens.length), [1, 1, 0, 0, 1, 0, 1])
  assert.equal(r.dias[2].hoje, true)
  assert.equal(r.dias[1].passou, true)
  assert.equal(r.dias[3].itens.length, 0, 'as ideias não entram nos dias')
  assert.equal(L.ritmoDaSemana(itens, hoje, 5).faltam, 2)
  assert.equal(L.ritmoDaSemana(itens, hoje, 1).naMeta, true)
})

test('o histórico das semanas e as semanas seguidas publicando', () => {
  const hoje = '2026-11-04'
  const itens = [
    com('publicado', '2026-11-03'),
    com('publicado', '2026-10-28'), com('publicado', '2026-10-27'),
    com('publicado', '2026-10-20'),
    // a semana de 12/10 ficou sem nada
    com('publicado', '2026-10-06'),
    com('finalizado', '2026-10-21'), // não publicado: não conta
  ]
  const h = L.historicoSemanas(itens, hoje, 5)
  assert.deepEqual(h.map((s) => s.inicio), ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'])
  assert.deepEqual(h.map((s) => s.publicados), [1, 0, 1, 2, 1])
  assert.equal(L.semanasSeguidas(itens, hoje), 3)
  // Sem nada ainda nesta semana, a sequência das anteriores continua de pé
  assert.equal(L.semanasSeguidas(itens.slice(1), hoje), 2)
  assert.equal(L.semanasSeguidas([com('publicado', '2026-10-20')], hoje), 0)
  assert.equal(L.semanasSeguidas([], hoje), 0)
})

test('a reserva: os prontos e para quantos dias eles dão no ritmo da meta', () => {
  const prontos = (n) => Array.from({ length: n }, () => com('finalizado', null))
  assert.deepEqual(L.reservaDeConteudo([com('editando', null)], 3), { prontos: 0, dias: 0, faltam: 3, nivel: 'vazia' })
  assert.deepEqual(L.reservaDeConteudo(prontos(2), 3), { prontos: 2, dias: 4, faltam: 1, nivel: 'baixa' })
  assert.deepEqual(L.reservaDeConteudo(prontos(4), 3), { prontos: 4, dias: 9, faltam: 0, nivel: 'boa' })
  assert.equal(L.reservaDeConteudo(prontos(1), 0).nivel, 'boa', 'meta zerada conta como 1 por semana')
})

test('parado: só em produção e a partir de 7 dias sem mudar', () => {
  const hoje = '2026-11-04'
  assert.equal(L.diasParado('gravando', '2026-10-25', hoje), 10)
  assert.equal(L.diasParado('editando', '2026-10-28T23:10:00+00:00', hoje), 7)
  assert.equal(L.diasParado('idealizando', '2026-10-30', hoje), null)
  assert.equal(L.diasParado('finalizado', '2026-09-01', hoje), null)
  assert.equal(L.diasParado('gravando', null, hoje), null)
})

test('os próximos passos, do mais urgente ao menos', () => {
  const hoje = '2026-11-04'
  const itens = [
    com('finalizado', hoje, { id: 'publicar-hoje' }),
    com('finalizado', '2026-11-02', { id: 'publicar-atrasado' }),
    com('editando', '2026-11-01', { id: 'atrasado' }),
    com('idealizando', '2026-11-06', { id: 'prazo', format: 'Carrossel' }),
    com('gravando', '2026-11-20', { id: 'longe' }),
    com('finalizado', null, { id: 'sem-data' }),
    com('publicado', '2026-10-20', { id: 'sem-numeros' }),
    com('publicado', '2026-10-01', { id: 'sem-numeros-antigo' }),
    com('publicado', '2026-11-01', { id: 'recente' }), // menos de 7 dias: ainda cedo para os números
    com('publicado', '2026-10-15', { id: 'com-numeros', views: 900 }),
    com('ideia', null),
  ]
  const passos = L.proximosPassos(itens, hoje, 5)
  assert.deepEqual(passos.map((p) => p.tipo), ['publicar', 'publicar', 'atrasado', 'prazo', 'agendar', 'reserva', 'numeros'])
  assert.deepEqual(passos.slice(0, 2).map((p) => p.id), ['publicar-atrasado', 'publicar-hoje'])
  assert.deepEqual(passos[3], { tipo: 'prazo', id: 'prazo', dia: '2026-11-06', proxima: 'editando' })
  assert.deepEqual(passos[5], { tipo: 'reserva', faltam: 2, emProducao: 3, ideias: 1 })
  assert.deepEqual(passos[6], { tipo: 'numeros', id: 'sem-numeros', dia: '2026-10-20', total: 2 })
  // Com a reserva cheia e nada pendente, não há passos
  assert.deepEqual(L.proximosPassos([com('finalizado', '2026-11-06'), com('publicado', '2026-11-03')], hoje, 1), [])
})

test('o desempenho por formato e por linha editorial', () => {
  const g = L.desempenhoPorGrupo(
    [
      com('publicado', '2026-10-01', { format: 'Reels/Shorts', views: 1000, likes: 50 }),
      com('publicado', '2026-10-02', { format: 'Reels/Shorts', views: 3000, likes: 30 }),
      com('publicado', '2026-10-03', { format: 'Carrossel', views: 800, likes: 80 }),
      com('publicado', '2026-10-04', { format: null, views: 500 }),
      com('publicado', '2026-10-05', { format: 'Carrossel' }), // sem números
      com('editando', '2026-10-06', { format: 'Carrossel', views: 99 }),
    ],
    (i) => i.format,
  )
  assert.deepEqual(g.map((x) => [x.chave, x.n, x.mediaViews]), [['Reels/Shorts', 2, 2000], ['Carrossel', 1, 800]])
  assert.equal(g[0].mediaEngajamento, 3)
  assert.equal(g[1].mediaEngajamento, 10)
})

test('vale reaproveitar: publicados há 30 dias ou mais, acima da mediana', () => {
  const hoje = '2026-11-04'
  const itens = [
    com('publicado', '2026-09-01', { id: 'a', views: 5000 }),
    com('publicado', '2026-09-10', { id: 'b', views: 300 }),
    com('publicado', '2026-09-20', { id: 'c', views: 1200 }),
    com('publicado', '2026-10-25', { id: 'recente', views: 9000 }),
    com('publicado', '2026-08-01', { id: 'd', views: 1000 }),
  ]
  assert.deepEqual(L.paraReaproveitar(itens, hoje).map((i) => i.id), ['a', 'c'])
  assert.deepEqual(L.paraReaproveitar(itens, hoje, 1).map((i) => i.id), ['a'])
  assert.deepEqual(L.paraReaproveitar([], hoje), [])
})

test('o roteiro de uma nova versão: de onde veio, o que adaptar e o material do original', () => {
  const r = L.roteiroReaproveitado({ title: '3 erros *graves*', format: 'Reels/Shorts', publish_date: '2026-09-01', script: '## Gancho\n\nTexto' }, 'Carrossel')
  assert.match(r, /^> Nova versão de \*\*3 erros \\\*graves\\\*\*\* \(Reels\/Shorts, publicado em 01\/09\/2026\)\./)
  assert.match(r, /## Para virar Carrossel\n\n- \[ \] Capa com o gancho/)
  assert.match(r, /## Material do original\n\n## Gancho\n\nTexto\n$/)
  const sem = L.roteiroReaproveitado({ title: 'Ideia', format: null, publish_date: null, script: null }, 'Formato novo')
  assert.match(sem, /^> Nova versão de \*\*Ideia\*\*\. Adapte/)
  assert.match(sem, /- \[ \] Adapte o gancho e o tamanho ao formato\n$/)
  assert.doesNotMatch(sem, /Material do original/)
})
