const test = require('node:test')
const assert = require('node:assert/strict')
const C = require('./carregar-ts.cjs')('src/features/cursos/logica.ts')

// O modelo do Notion do usuário: Links, Materiais, Modelagem com caixas e Conteúdo com módulo e aulas
const ORDEM = `> **Links:**

> **Materiais & Arquivos:**

**Modelagem   ( Passo a Passo )**

- [ ] Toda semana liste 3 pontos fortes e qualidades que você possui.
- [x] Identifique situações que você tem medo de fazer e se expor e faça.
- [ ] Construa autoconfiança #F05

### Conteúdo: 👇

# A Ordem

## #F02 01 - Mentalidade do foda-se

- O medo de ser **julgado** é herança primitiva
- A autoaceitação é o caminho.

## #F03 02 - Carisma único

- Carisma é autenticidade.
  - Postura ereta e aberta

## #F04 03 - Presença notável

- A presença te traz credibilidade
`

test('mapa do curso: módulo, aulas e onde parei', () => {
  const m = C.analisarCurso(ORDEM)
  assert.equal(m.nivelModulo, 1)
  assert.equal(m.nivelAula, 2)
  assert.deepEqual(m.modulos.map((x) => [x.titulo, x.aulas]), [['A Ordem', 3]])
  assert.deepEqual(m.aulas.map((a) => a.titulo), ['#F02 01 - Mentalidade do foda-se', '#F03 02 - Carisma único', '#F04 03 - Presença notável'])
  assert.ok(m.aulas.every((a) => a.modulo === 'A Ordem'))
  assert.equal(m.aulas[1].corpo, '- Carisma é autenticidade.\n  - Postura ereta e aberta')
  assert.equal(C.ondeParei(m).titulo, '#F04 03 - Presença notável')
  // As seções do modelo não viram aula
  assert.ok(!m.aulas.some((a) => /Links|Materiais|Modelagem|Conteúdo/.test(a.titulo)))
})

test('mapa do curso: ações para praticar e o bloco da Modelagem', () => {
  const m = C.analisarCurso(ORDEM)
  assert.deepEqual(
    m.praticas.map((p) => [p.texto, p.feito]),
    [
      ['Toda semana liste 3 pontos fortes e qualidades que você possui.', false],
      ['Identifique situações que você tem medo de fazer e se expor e faça.', true],
      ['Construa autoconfiança #F05', false],
    ],
  )
  const linhas = C.dividir(ORDEM)
  assert.match(linhas[m.blocoPratica.linha], /Modelagem/)
  assert.match(linhas[m.blocoPratica.fim], /Conteúdo/)
})

test('mapa do curso: aulas sem módulo, em negrito ou num texto sem estrutura', () => {
  const soAulas = C.analisarCurso('## Aula 1 - Como a prova é montada\n\n- Ler o edital.\n\n## Aula 2 - Revisão espaçada\n\n### Dica\n\n- Revisar em 1, 7 e 30 dias.\n')
  assert.equal(soAulas.nivelModulo, null)
  assert.deepEqual(soAulas.aulas.map((a) => a.titulo), ['Aula 1 - Como a prova é montada', 'Aula 2 - Revisão espaçada'])
  // O subtítulo dentro da aula faz parte dela
  assert.match(soAulas.aulas[1].corpo, /### Dica/)

  // Aulas numeradas em ## com tópicos em ###: os ## são as aulas, não módulos
  const topicos = C.analisarCurso('## 01 - Abertura\n### Ideia A\n### Ideia B\n## 02 - Meio\n### Ideia C\n### Ideia D\n')
  assert.equal(topicos.nivelModulo, null)
  assert.equal(topicos.aulas.length, 2)

  // Toggles que viraram linhas em negrito
  const negrito = C.analisarCurso('**Aula 1 - Introdução**\n\n- ponto\n\n**Aula 2 - Prática**\n\n- outro\n')
  assert.equal(negrito.nivelAula, C.NIVEL_NEGRITO)
  assert.deepEqual(negrito.aulas.map((a) => a.corpo), ['- ponto', '- outro'])

  // Sem títulos: nenhuma aula
  const solto = C.analisarCurso('- Voz é instrumento.\n- Respiração todo dia.\n')
  assert.equal(solto.aulas.length, 0)
  assert.equal(C.ondeParei(solto), null)

  // Código não vira título nem ação
  const codigo = C.analisarCurso('```\n# não é título\n- [ ] não é ação\n```\n## Aula 1\n')
  assert.deepEqual(codigo.aulas.map((a) => a.titulo), ['Aula 1'])
  assert.equal(codigo.praticas.length, 0)

  // Vazio
  assert.deepEqual(C.analisarCurso(null).aulas, [])
})

test('título da aula: marcador, número e nome; e a sugestão da próxima', () => {
  assert.deepEqual(C.partesDoTitulo('#F02 01 - Mentalidade do foda-se'), { tag: '#F02', numero: '01', nome: 'Mentalidade do foda-se' })
  assert.deepEqual(C.partesDoTitulo('Aula 3 - Sequência de stories'), { tag: null, numero: '3', nome: 'Sequência de stories' })
  assert.deepEqual(C.partesDoTitulo('**Introdução**'), { tag: null, numero: null, nome: 'Introdução' })
  assert.equal(C.proximoTitulo(C.analisarCurso(ORDEM)), '#F05 04 - ')
  assert.equal(C.proximoTitulo(C.analisarCurso('## Aula 9 - Fim\n')), 'Aula 10 - ')
  assert.equal(C.proximoTitulo(C.analisarCurso('## Introdução\n')), '')
  assert.equal(C.proximoTitulo(C.analisarCurso('')), '')
})

test('marcar, tirar e acrescentar ações sem mexer no resto', () => {
  const m = C.analisarCurso(ORDEM)
  const marcado = C.marcarPratica(ORDEM, m.praticas[0].linha, true)
  assert.match(C.dividir(marcado)[m.praticas[0].linha], /^- \[x\] Toda semana/)
  assert.equal(C.marcarPratica(marcado, m.praticas[0].linha, false), ORDEM)
  // Linha que não é mais ação: o texto volta igual
  assert.equal(C.marcarPratica(ORDEM, 0, true), ORDEM)

  // Novas ações entram no fim do bloco da Modelagem
  const mais = C.adicionarPraticas(ORDEM, ['Treinar contato visual', '  '])
  const m2 = C.analisarCurso(mais)
  assert.deepEqual(m2.praticas.map((p) => p.texto).slice(-1), ['Treinar contato visual'])
  assert.equal(m2.praticas[3].linha, m.praticas[2].linha + 1)
  assert.equal(m2.aulas.length, 3)

  const sem = C.removerPratica(mais, m2.praticas[3].linha)
  assert.equal(sem, ORDEM)

  // Sem bloco: "Para praticar" no começo, antes das aulas
  const novo = C.adicionarPraticas('## Aula 1 - Começo\n\n- nota\n', ['Fazer o exercício'])
  assert.equal(novo, '### Para praticar\n\n- [ ] Fazer o exercício\n\n## Aula 1 - Começo\n\n- nota\n')
  assert.equal(C.analisarCurso(novo).aulas.length, 1)
  assert.equal(C.adicionarPraticas('', ['A']), '### Para praticar\n\n- [ ] A\n')
  // Bloco vazio: a ação entra logo depois do rótulo
  assert.equal(C.adicionarPraticas('**Modelagem**\n\n# Conteúdo\n', ['B']), '**Modelagem**\n\n- [ ] B\n\n# Conteúdo\n')
})

test('anotar, editar e tirar aulas', () => {
  // Depois da última aula, no mesmo nível
  const nova = C.adicionarAula(ORDEM, { titulo: '#F05 04 - Autoconfiança poderosa', corpo: '- CCR: Competência, Convicção e Resultado' })
  const m = C.analisarCurso(nova)
  assert.equal(m.aulas.length, 4)
  assert.equal(C.ondeParei(m).titulo, '#F05 04 - Autoconfiança poderosa')
  assert.equal(C.ondeParei(m).modulo, 'A Ordem')
  assert.equal(C.ondeParei(m).corpo, '- CCR: Competência, Convicção e Resultado')
  assert.ok(nova.startsWith(ORDEM.trimEnd()))
  assert.ok(nova.endsWith('## #F05 04 - Autoconfiança poderosa\n\n- CCR: Competência, Convicção e Resultado\n'))

  // Num módulo novo
  const modulo = C.adicionarAula(ORDEM, { titulo: 'Aula extra', novoModulo: 'Bônus' })
  const mm = C.analisarCurso(modulo)
  assert.deepEqual(mm.modulos.map((x) => x.titulo), ['A Ordem', 'Bônus'])
  assert.equal(C.ondeParei(mm).modulo, 'Bônus')

  // No meio de um módulo que não é o último
  const dois = '# M1\n\n## 01 - a\n\n# M2\n\n## 02 - b\n\n## 03 - c\n'
  const noPrimeiro = C.adicionarAula(dois, { titulo: '01b - meio', modulo: 'M1' })
  assert.deepEqual(C.analisarCurso(noPrimeiro).aulas.map((a) => `${a.modulo}:${a.titulo}`), ['M1:01 - a', 'M1:01b - meio', 'M2:02 - b', 'M2:03 - c'])

  // Texto vazio
  assert.equal(C.adicionarAula('', { titulo: 'Aula 1 - Começo', corpo: 'oi' }), '## Aula 1 - Começo\n\noi\n')
  assert.equal(C.adicionarAula('x', { titulo: '   ' }), 'x')

  // Editar mantém o nível e o lugar
  const m0 = C.analisarCurso(ORDEM)
  const editado = C.editarAula(ORDEM, m0.aulas[1], { titulo: '#F03 02 - Carisma', corpo: '- novo texto' })
  const me = C.analisarCurso(editado)
  assert.deepEqual(me.aulas.map((a) => a.titulo), ['#F02 01 - Mentalidade do foda-se', '#F03 02 - Carisma', '#F04 03 - Presença notável'])
  assert.equal(me.aulas[1].corpo, '- novo texto')
  assert.equal(me.aulas[1].nivel, 2)

  // Tirar
  const tirado = C.removerAula(ORDEM, m0.aulas[0])
  assert.deepEqual(C.analisarCurso(tirado).aulas.map((a) => a.titulo), ['#F03 02 - Carisma único', '#F04 03 - Presença notável'])
  // A aula achada pelo título quando o texto mudou antes dela
  const deslocada = C.removerAula('nota nova\n\n' + ORDEM, m0.aulas[0])
  assert.equal(C.analisarCurso(deslocada).aulas.length, 2)
})

test('link e plataforma do curso', () => {
  assert.equal(C.linkDoCurso('Link:https://terabox.com/s/abc'), 'https://terabox.com/s/abc')
  assert.equal(C.linkDoCurso('www.terabox.com'), 'https://www.terabox.com')
  assert.equal(C.linkDoCurso('  '), null)
  assert.equal(C.linkDoCurso('senha 123'), null)
  assert.equal(C.plataformaDoLink('https://t.me/+abc').nome, 'Telegram')
  assert.equal(C.plataformaDoLink('https://t.me/+abc').acao, 'Abrir no Telegram')
  assert.equal(C.plataformaDoLink('https://fuiaprovado.club.hotmart.com/lesson/x').nome, 'Hotmart')
  assert.equal(C.plataformaDoLink('https://dashboard.kiwify.com.br/courses').nome, 'Kiwify')
  assert.equal(C.plataformaDoLink('https://drive.google.com/drive/folders/1').nome, 'Google Drive')
  assert.equal(C.plataformaDoLink('https://bit.ly/x').id, 'link')
  assert.equal(C.plataformaDoLink('https://x.club.hotmart.com/a').em, 'na Hotmart')
  assert.deepEqual(C.plataformaDoLink('https://www.escola.com.br/curso'), { id: 'site', nome: 'escola.com.br', em: null, acao: 'Abrir o curso' })
  assert.equal(C.plataformaDoLink(null), null)
})

test('capa gerada: iniciais e tons da categoria', () => {
  assert.equal(C.iniciais('Venda Todo Santo Dia'), 'VT')
  assert.equal(C.iniciais('A ordem'), 'O')
  assert.equal(C.iniciais('Do Mil ao Milhão'), 'MM')
  assert.equal(C.iniciais('Projeto 60 dias'), 'PD')
  assert.equal(C.iniciais('60'), '6')
  const a = C.tonsDoCurso({ name: 'Do Mil ao Milhão', categories: ['Finanças e Investimentos'] })
  const b = C.tonsDoCurso({ name: 'Viver de Renda', categories: ['Finanças e Investimentos'] })
  assert.equal(a.h1, b.h1)
  for (const t of [a, b]) {
    assert.ok(t.h1 >= 200 && t.h1 < 320)
    assert.ok(t.h2 >= 180 && t.h2 < 340)
  }
})

const curso = (nome, status, extra = {}) => ({
  id: nome,
  name: nome,
  status,
  categories: [],
  notes: null,
  progress: null,
  url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...extra,
})

test('a tela: grupos por situação, busca, categorias, competências e ações por fazer', () => {
  const lista = [
    curso('A', 'em_andamento', { updated_at: '2026-10-01T00:00:00Z', categories: ['Vendas'], notes: '- [ ] Postar stories\n- [x] Feito' }),
    curso('B', 'em_andamento', { updated_at: '2026-10-20T00:00:00Z', categories: ['Vendas', 'Oratória'], notes: '- [ ] Treinar pitch' }),
    curso('C', 'concluido', { categories: ['Vendas'] }),
    curso('D', 'nao_comecou', { created_at: '2026-05-01T00:00:00Z', notes: 'fala sobre negociação' }),
    curso('E', 'nao_comecou', { created_at: '2026-06-01T00:00:00Z' }),
    curso('F', 'esquisito'),
  ]
  const g = C.porStatus(lista)
  assert.deepEqual(g.em_andamento.map((c) => c.name), ['B', 'A'])
  assert.deepEqual(g.nao_comecou.map((c) => c.name), ['E', 'D', 'F'])
  assert.deepEqual(C.buscarCursos(lista, 'NEGOCIAÇÃO').map((c) => c.name), ['D'])
  assert.deepEqual(C.buscarCursos(lista, 'vendas orat').map((c) => c.name), ['B'])
  assert.deepEqual(C.categoriasDos(lista), [{ nome: 'Vendas', total: 3 }, { nome: 'Oratória', total: 1 }])
  assert.deepEqual(C.competencias(lista), [
    { nome: 'Vendas', concluidos: 1, estudando: 2 },
    { nome: 'Oratória', concluidos: 0, estudando: 1 },
  ])
  assert.deepEqual(
    C.praticasPendentes(lista).map((x) => `${x.curso.name}:${x.pratica.texto}`),
    ['B:Treinar pitch', 'A:Postar stories'],
  )
  assert.equal(C.progressoDo({ progress: null, status: 'concluido' }), 100)
  assert.equal(C.progressoDo({ progress: 42.4, status: 'em_andamento' }), 42)
  assert.equal(C.progressoDo({ progress: null, status: 'em_andamento' }), null)
  assert.deepEqual(C.camposDoStatus({ progress: 30 }, 'concluido'), { status: 'concluido', progress: 100 })
  assert.deepEqual(C.camposDoStatus({ progress: 30 }, 'pausado'), { status: 'pausado' })
})
