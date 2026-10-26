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
