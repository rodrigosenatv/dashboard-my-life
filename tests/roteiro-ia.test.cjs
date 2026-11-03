const test = require('node:test')
const assert = require('node:assert/strict')
const R = require('./carregar-ts.cjs')('src/features/conteudo/roteiro-ia.ts')

const parte = (id, nome, texto = '', tipo = 'ia', ativa = true) => ({ id, nome, tipo, texto, ativa })

test('o modelo de cada formato: Carrossel e Imagem no de Carrossel, o resto no de Reels', () => {
  assert.equal(R.modeloDoFormato('Carrossel'), 'carrossel')
  assert.equal(R.modeloDoFormato('Imagem'), 'carrossel')
  assert.equal(R.modeloDoFormato('Reels/Shorts'), 'reels')
  assert.equal(R.modeloDoFormato('Vídeo'), 'reels')
  assert.equal(R.modeloDoFormato(''), 'reels')
  assert.equal(R.modeloDoFormato(null), 'reels')
})

test('configuração: vazia ou quebrada volta ao padrão', () => {
  for (const v of [undefined, null, 'x', 3, { modelos: 'x' }, { modelos: { reels: [] } }, { modelos: { reels: [null, 2, {}] } }]) {
    const c = R.lerConfigRoteiro(v)
    assert.deepEqual(c.modelos.reels, R.partesPadrao('reels'))
    assert.deepEqual(c.modelos.carrossel, R.partesPadrao('carrossel'))
    assert.equal(c.instrucoes, '')
    assert.deepEqual(c.lacunas, {})
  }
})

test('configuração: o modelo mudado fica, com as partes limpas e sem ids repetidos', () => {
  const c = R.lerConfigRoteiro({
    modelos: {
      reels: [
        { id: 'a', nome: '  Título   do vídeo ', tipo: 'ia', texto: 'Crie sobre [TÓPICO]', ativa: true },
        { id: 'a', nome: '', tipo: 'outro', texto: 'Sem nome', ativa: false },
        { nome: 'Fixa', tipo: 'fixo', texto: '- [ ] item' },
        { id: 'vazia', nome: '', texto: '   ' },
      ],
    },
    instrucoes: 'Tom direto',
    lacunas: { '[NICHO]': ' concursos ', 'NICHO': 'sem colchetes', '[VAZIA]': '  ', '[NUM]': 3 },
  })
  assert.deepEqual(c.modelos.reels, [
    { id: 'a', nome: 'Título do vídeo', tipo: 'ia', texto: 'Crie sobre [TÓPICO]', ativa: true },
    { id: 'a-2', nome: 'Parte 2', tipo: 'ia', texto: 'Sem nome', ativa: false },
    { id: 'parte-3', nome: 'Fixa', tipo: 'fixo', texto: '- [ ] item', ativa: true },
  ])
  assert.deepEqual(c.modelos.carrossel, R.partesPadrao('carrossel'))
  assert.equal(c.instrucoes, 'Tom direto')
  assert.deepEqual(c.lacunas, { '[NICHO]': 'concursos' })
})

test('para gravar: o modelo igual ao padrão não vai (acompanha as melhorias do padrão)', () => {
  const padrao = R.lerConfigRoteiro(null)
  assert.deepEqual(R.configParaSalvar(padrao), { modelos: {}, instrucoes: '', lacunas: {} })
  const mudado = { ...padrao, modelos: { ...padrao.modelos, reels: padrao.modelos.reels.map((p, i) => (i === 0 ? { ...p, ativa: false } : p)) } }
  const salvo = R.configParaSalvar(mudado)
  assert.deepEqual(Object.keys(salvo.modelos), ['reels'])
  assert.equal(salvo.modelos.reels[0].ativa, false)
  assert.ok(R.mesmaConfig(R.lerConfigRoteiro(salvo), mudado))
  assert.ok(!R.mesmaConfig(padrao, mudado))
  assert.ok(R.igualAoPadrao('carrossel', R.partesPadrao('carrossel')))
})

test('os prompts padrão: só lacunas de verdade entre colchetes', () => {
  const reels = R.lacunasDoModelo(R.partesPadrao('reels'))
  assert.deepEqual(reels, ['[TÓPICO]', '[NICHO]', '[PALAVRA-CHAVE]'])
  assert.deepEqual(R.lacunasDoModelo(R.partesPadrao('carrossel')), ['[TÓPICO]', '[PALAVRA-CHAVE]'])
  // O checklist de revisão fica no fim, fixo
  const ultimo = R.partesPadrao('reels').at(-1)
  assert.equal(ultimo.tipo, 'fixo')
  assert.match(ultimo.texto, /- \[ \] O 3 em 1/)
})

test('lacunas: colchetes sem links, sem {chaves} (essas a IA completa) e sem caixas de marcar', () => {
  assert.deepEqual(R.lacunasDe(['Sobre [TÓPICO] para [PÚBLICO-ALVO], de novo [TÓPICO]', 'Veja [o site](https://x.com), {número} ideias', '- [ ] item\n- [x] feito']), [
    '[TÓPICO]',
    '[PÚBLICO-ALVO]',
  ])
  const partes = [parte('a', 'A', 'Fale de [TEMA]'), parte('b', 'B', 'Para [NICHO]', 'ia', false), parte('c', 'C', 'Com [CTA]', 'fixo')]
  assert.deepEqual(R.lacunasDoModelo(partes, 'Perfil de [NICHO2]'), ['[NICHO2]', '[TEMA]', '[CTA]'])
  assert.ok(R.ehLacunaDoTopico('[TÓPICO]') && R.ehLacunaDoTopico('[Assunto]') && R.ehLacunaDoTopico('[TEMA]'))
  assert.ok(!R.ehLacunaDoTopico('[NICHO]'))
  assert.equal(R.rotuloDaLacuna('[PÚBLICO-ALVO]'), 'Público-alvo')
  assert.equal(R.rotuloDaLacuna('[ELEMENTO OU OBJETO PRINCIPAL]'), 'Elemento ou objeto principal')
  assert.equal(R.preencherLacunas('[A1] e [A1] e [B2]', { '[A1]': ' x ', '[B2]': '  ' }), 'x e x e [B2]')
})

test('o pedido: só as partes de IA ligadas, numeradas, com as lacunas preenchidas e o contexto', () => {
  const partes = [
    parte('t', 'Título', 'Título para [TÓPICO]'),
    parte('f', 'Revisão', '- [ ] [TÓPICO]', 'fixo'),
    parte('g', 'Gancho "forte"', 'Gancho para [NICHO]'),
    parte('d', 'Desligada', 'não vai', 'ia', false),
    parte('v', 'Vazia', ''),
  ]
  const { texto, partesIA } = R.montarPedido(
    partes,
    { '[TÓPICO]': 'estudar cansado', '[NICHO]': '' },
    { titulo: 'Rascunho', formato: 'Reels/Shorts', plataformas: ['Instagram', 'TikTok'], linha: 'Dicas' },
    'Perfil sobre [TÓPICO]',
  )
  assert.deepEqual(partesIA.map((p) => p.id), ['t', 'g', 'v'])
  assert.match(texto, /em 3 partes/)
  assert.match(texto, /<parte numero="1" nome="Título">\nTítulo para estudar cansado\n<\/parte>/)
  assert.match(texto, /<parte numero="2" nome="Gancho 'forte'">\nGancho para \[NICHO\]\n<\/parte>/)
  assert.match(texto, /<parte numero="3" nome="Vazia">\nEscreva a parte "Vazia" do roteiro\.\n<\/parte>/)
  assert.match(texto, /- Formato: Reels\/Shorts\n- Plataformas: Instagram, TikTok\n- Linha editorial: Dicas\n- Título provisório: Rascunho/)
  assert.match(texto, /## Instruções gerais\nPerfil sobre estudar cansado/)
  assert.match(texto, /"### 1\. Título"/)
  assert.match(texto, /Na parte 1 \(Título\), a primeira linha é só o título escolhido/)
  assert.doesNotMatch(texto, /não vai|Revisão/)
  assert.deepEqual(R.montarPedido([parte('f', 'Fixa', 'x', 'fixo')], {}), { texto: '', partesIA: [] })
})

test('a resposta: as partes pelos títulos "### N. Nome", sem a introdução', () => {
  const partes = [{ nome: 'Título' }, { nome: 'Gancho' }, { nome: 'Call to action' }, { nome: 'Capa no Ideogram' }]
  const resposta = [
    'Claro! Aqui está o roteiro:',
    '',
    '### 1. Título',
    '3 erros que reprovam no concurso',
    '- Você comete este erro?',
    '',
    '### **2. Gancho**',
    'Pare de estudar assim.',
    '# Um título grande dentro da parte',
    '',
    '---',
    '',
    '### 3. CTA',
    'Comente CONCURSO.',
    '',
    '### Capa (prompt para o Ideogram)',
    '```',
    '### 1. isto está dentro do bloco',
    '```',
  ].join('\n')
  const l = R.lerResposta(resposta, partes)
  assert.equal(l.atual, 3)
  assert.deepEqual(l.conteudos, [
    '3 erros que reprovam no concurso\n- Você comete este erro?',
    'Pare de estudar assim.\n### Um título grande dentro da parte',
    'Comente CONCURSO.',
    '```\n### 1. isto está dentro do bloco\n```',
  ])
})

test('a resposta: um "1." ou slide no meio de uma parte não volta para outra parte', () => {
  const partes = [{ nome: 'Título para a capa' }, { nome: 'Slides' }, { nome: 'Legenda' }]
  const resposta = '### 1. Título para a capa\nEstude menos\n\n### 2. Slides\n**Slide 1:** capa\n### 1. Capa\n**1. Primeiro ponto**\n### 3. Outra coisa\nainda slides\n#### Legenda\ntexto da legenda'
  const l = R.lerResposta(resposta, partes)
  assert.equal(l.atual, 2)
  assert.deepEqual(l.conteudos, ['Estude menos', '**Slide 1:** capa\n### 1. Capa\n**1. Primeiro ponto**\n### 3. Outra coisa\nainda slides', 'texto da legenda'])
})

test('a resposta: negrito numerado com o nome, cercada por ```markdown, e enquanto chega', () => {
  const partes = [{ nome: 'Título' }, { nome: 'Legenda' }]
  const l = R.lerResposta('```markdown\n**1. Título**\nA\n\n**2. Legenda:**\nB\n```\n', partes)
  assert.deepEqual(l.conteudos, ['A', 'B'])
  // Ainda chegando: só a primeira parte começou, e a segunda nem apareceu
  const parcial = R.lerResposta('### 1. Título\nMeio tít', partes)
  assert.equal(parcial.atual, 0)
  assert.deepEqual(parcial.conteudos, ['Meio tít', null])
  assert.deepEqual(R.lerResposta('Pensando…', partes), { conteudos: [null, null], atual: -1 })
})

test('uma frase por linha continua uma por linha no markdown (listas, citações e blocos ficam como estão)', () => {
  const resposta = [
    '### 1. Desenvolvimento',
    'Estudar muito não aprova.',
    'Estudar certo, sim.',
    '- item um',
    '- item dois',
    '> citação',
    '> continua',
    'Com quebra forçada  ',
    'na mesma frase',
    '```',
    'linha de código',
    'outra linha',
    '```',
    '**Slide 1:** capa',
    '**Slide 2:** ponto',
  ].join('\n')
  assert.equal(
    R.lerResposta(resposta, [{ nome: 'Desenvolvimento' }]).conteudos[0],
    [
      'Estudar muito não aprova.',
      '',
      'Estudar certo, sim.',
      '- item um',
      '- item dois',
      '> citação',
      '> continua',
      'Com quebra forçada  ',
      'na mesma frase',
      '```',
      'linha de código',
      'outra linha',
      '```',
      '**Slide 1:** capa',
      '',
      '**Slide 2:** ponto',
    ].join('\n'),
  )
})

test('enquanto chega: a última linha que pode ser um título pela metade fica de fora', () => {
  assert.equal(R.semLinhaIncompleta('### 1. Título\nA\n### 2. Gan'), '### 1. Título\nA')
  assert.equal(R.semLinhaIncompleta('### 1. Título\nA\n**2. Leg'), '### 1. Título\nA')
  assert.equal(R.semLinhaIncompleta('### 1. Título\nTexto que vem'), '### 1. Título\nTexto que vem')
  assert.equal(R.semLinhaIncompleta('### 1. Tí'), '')
  // Um título pela metade, lido sem esse cuidado, ainda vira a próxima parte (o formato pedido)
  assert.equal(R.lerResposta('### 1. Título\nA\n### 2. Gan', [{ nome: 'Título' }, { nome: 'Gancho' }]).atual, 1)
})

test('o aviso de erro do servidor no fim do texto', () => {
  assert.deepEqual(R.separarErro('### 1. Título\nOk\n\n[Não foi possível concluir a resposta: o OpenRouter está sobrecarregado agora.]'), {
    texto: '### 1. Título\nOk',
    erro: 'o OpenRouter está sobrecarregado agora.',
  })
  assert.deepEqual(R.separarErro('sem erro'), { texto: 'sem erro', erro: null })
})

test('o título escolhido: a primeira linha, sem marcação, aspas nem rótulo', () => {
  assert.equal(R.tituloEscolhido('**Título:** “3 erros que reprovam”\n- outra'), '3 erros que reprovam')
  assert.equal(R.tituloEscolhido('1. "Pare de estudar assim"'), 'Pare de estudar assim')
  assert.equal(R.tituloEscolhido('\n\n## O melhor título: _Estude menos_ 🚀'), 'Estude menos 🚀')
  assert.equal(R.tituloEscolhido('Melhor título: A verdade sobre o edital'), 'A verdade sobre o edital')
  assert.equal(R.tituloEscolhido('3 erros que reprovam no concurso'), '3 erros que reprovam no concurso')
  assert.equal(R.tituloEscolhido(''), null)
  assert.equal(R.tituloEscolhido(null), null)
  assert.equal(R.tituloEscolhido('x'.repeat(200)).length, 160)
  assert.ok(R.ehParteDoTitulo({ nome: 'Título para a capa', tipo: 'ia' }))
  assert.ok(!R.ehParteDoTitulo({ nome: 'Título', tipo: 'fixo' }))
  assert.ok(!R.ehParteDoTitulo({ nome: 'Subtítulo', tipo: 'ia' }))
})

test('o roteiro montado: as partes na ordem do modelo, as fixas com as lacunas e o aviso da que faltou', () => {
  const partes = [
    parte('t', 'Título', 'p1'),
    parte('g', 'Gancho', 'p2'),
    parte('x', 'Desligada', 'p', 'ia', false),
    parte('r', 'Revisão de [TÓPICO]', '- [ ] Gancho de [TÓPICO]', 'fixo'),
    parte('l', 'Legenda', 'p3'),
  ]
  const partesIA = partes.filter((p) => p.ativa && p.tipo === 'ia')
  const leitura = { conteudos: ['Estude menos', null, 'Legenda pronta'], atual: 2 }
  assert.equal(
    R.montarRoteiro(partes, leitura, { '[TÓPICO]': 'foco' }),
    `## Título\n\nEstude menos\n\n## Gancho\n\n${R.AVISO_PARTE_VAZIA}\n\n## Revisão de [TÓPICO]\n\n- [ ] Gancho de foco\n\n## Legenda\n\nLegenda pronta\n`,
  )
  assert.deepEqual(R.partesSemResposta(partesIA, leitura), ['Gancho'])
  // Enquanto chega: até a parte que está sendo escrita (a fixa antes dela entra)
  assert.equal(R.montarRoteiro(partes, { conteudos: ['A', 'B', null], atual: 1 }, {}, { parcial: true }), '## Título\n\nA\n\n## Gancho\n\nB\n')
  assert.equal(R.montarRoteiro(partes, { conteudos: ['A', 'B', ''], atual: 2 }, {}, { parcial: true }), '## Título\n\nA\n\n## Gancho\n\nB\n\n## Revisão de [TÓPICO]\n\n- [ ] Gancho de [TÓPICO]\n\n## Legenda\n')
  assert.equal(R.montarRoteiro(partes, { conteudos: [null, null, null], atual: -1 }, {}, { parcial: true }), '')
})

test('o roteiro montado: sem partes reconhecidas, o texto inteiro não se perde; só fixas, sem IA', () => {
  const partes = [parte('t', 'Título', 'p1'), parte('r', 'Revisão', '- [ ] ok', 'fixo')]
  assert.equal(R.montarRoteiro(partes, { conteudos: [null], atual: -1 }, {}, { bruto: 'Um texto solto\n' }), '## Roteiro\n\nUm texto solto\n\n## Revisão\n\n- [ ] ok\n')
  assert.equal(R.montarRoteiro([parte('r', 'Revisão', '- [ ] ok', 'fixo')], null, {}), '## Revisão\n\n- [ ] ok\n')
})
