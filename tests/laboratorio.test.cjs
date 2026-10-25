const test = require('node:test')
const assert = require('node:assert/strict')
const L = require('./carregar-ts.cjs')('src/features/laboratorio/logica.ts')

test('andamento: em que dia do teste a pessoa está', () => {
  const e = { starts_on: '2026-10-21', ends_on: '2026-10-27' }
  assert.deepEqual(L.andamento(e, '2026-10-25'), { dia: 5, total: 7, restam: 2, passou: false, antes: false })
  assert.deepEqual(L.andamento(e, '2026-10-21'), { dia: 1, total: 7, restam: 6, passou: false, antes: false })
  assert.deepEqual(L.andamento(e, '2026-10-27'), { dia: 7, total: 7, restam: 0, passou: false, antes: false })
  // Depois do fim: fica no último dia e avisa que o prazo passou
  assert.deepEqual(L.andamento(e, '2026-10-30'), { dia: 7, total: 7, restam: 0, passou: true, antes: false })
  // Antes de começar
  assert.equal(L.andamento(e, '2026-10-20').antes, true)
  assert.equal(L.andamento(e, '2026-10-20').dia, 0)
  // Sem fim: conta os dias sem total
  assert.deepEqual(L.andamento({ starts_on: '2026-10-01', ends_on: null }, '2026-10-10'), { dia: 10, total: null, restam: null, passou: false, antes: false })
  // Sem início
  assert.equal(L.andamento({ starts_on: null, ends_on: null }, '2026-10-10').antes, true)
  // Virada de mês e horário de verão não atrapalham a conta
  assert.equal(L.andamento({ starts_on: '2026-02-27', ends_on: '2026-03-05' }, '2026-03-01').dia, 3)
  assert.equal(L.duracaoDe({ starts_on: '2025-11-26', ends_on: '2025-12-01' }), 6)
  assert.equal(L.somarDias('2026-12-30', 3), '2027-01-02')
})

test('a faixa de dias do teste', () => {
  assert.deepEqual(L.diasDoTeste({ starts_on: '2026-10-21', ends_on: '2026-10-24' }, '2026-10-22'), ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'])
  assert.deepEqual(L.diasDoTeste({ starts_on: '2026-10-21', ends_on: null }, '2026-10-23'), ['2026-10-21', '2026-10-22', '2026-10-23'])
  assert.equal(L.diasDoTeste({ starts_on: '2026-01-01', ends_on: '2026-12-31' }, '2026-06-01').length, 31)
  assert.deepEqual(L.diasDoTeste({ starts_on: null, ends_on: null }, '2026-10-23'), [])
})

const exp = (nome, status, extra = {}) => ({ id: nome, name: nome, status, result: 'indefinido', starts_on: null, ends_on: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...extra })

test('grupos da tela, diário e placar', () => {
  const lista = [
    exp('A', 'em_teste', { starts_on: '2026-10-01', ends_on: '2026-10-30' }),
    exp('B', 'em_teste', { starts_on: '2026-10-20', ends_on: '2026-10-26' }),
    exp('C', 'a_iniciar', { created_at: '2026-10-10T00:00:00Z' }),
    exp('D', 'a_iniciar', { starts_on: '2026-10-26' }),
    exp('E', 'concluido', { result: 'funcionou', ends_on: '2025-12-01' }),
    exp('F', 'concluido', { result: 'parcial', ends_on: '2026-09-14' }),
    exp('G', 'outro'),
  ]
  const g = L.porStatus(lista)
  assert.deepEqual(g.em_teste.map((e) => e.name), ['B', 'A'])
  assert.deepEqual(g.a_iniciar.map((e) => e.name), ['D', 'C', 'G'])
  assert.deepEqual(g.concluido.map((e) => e.name), ['F', 'E'])
  assert.deepEqual(L.placar(lista), { concluidos: 2, funcionou: 1, parcial: 1, naoFuncionou: 0 })

  const insights = [
    { id: 1, experiment_id: 'B', noted_on: '2026-10-21', created_at: '2026-10-21T20:00:00Z' },
    { id: 2, experiment_id: 'B', noted_on: '2026-10-24', created_at: '2026-10-24T20:00:00Z' },
    { id: 3, experiment_id: 'A', noted_on: '2026-10-22', created_at: '2026-10-22T20:00:00Z' },
    { id: 4, experiment_id: 'B', noted_on: null, created_at: '2026-10-25T10:00:00Z' },
  ]
  const d = L.diarioDo(insights, 'B')
  assert.deepEqual(d.map((i) => i.id), [4, 2, 1])
  assert.deepEqual([...L.diasComRegistro(d)].sort(), ['2026-10-21', '2026-10-24', '2026-10-25'])
})

// O experimento do Notion do usuário (com o modelo: objetivo, procedimento, resultado, aprendizados e conclusão)
const ESPELHO = `### 🧪 Nome do Experimento

**Objetivo:**

✔ Criar rapidamente rapport

**Hipótese:**

- Se a pessoa **relaxa mais** → houve sintonia.

---

### **📋 Procedimento**

1. Observe a postura da pessoa.
2. Replique suavemente um detalhe.

---

### 📁 Evidências

> Adicione prints, links ou observações diárias

---

### **📊 Resultado**

- **Status:** {{Realizado}}
- **Funcionou?** {{Conversa flui}}
- **Nota:** \\{\\{9,0\\}\\}

---

### 📚 Aprendizados-Chave

- Não é tão simples conseguir detectar, mas realmente acontece.
- Tópico 2
- Tópico 3

---

### 📌 Conclusão Final

Texto livre.
`

test('protocolo: as seções do modelo e a nota', () => {
  const p = L.protocolo(ESPELHO)
  assert.equal(p.objetivo, '✔ Criar rapidamente rapport')
  assert.match(p.hipotese, /relaxa mais/)
  assert.equal(p.procedimento, '1. Observe a postura da pessoa.\n2. Replique suavemente um detalhe.')
  assert.deepEqual(L.itensDe(p.aprendizados), ['Não é tão simples conseguir detectar, mas realmente acontece.'])
  assert.equal(p.conclusao, 'Texto livre.')
  assert.equal(L.notaDo(ESPELHO), 9)
  assert.equal(L.notaDo('- **Nota:** 7,5'), 7.5)
  assert.equal(L.notaDo('Nota: {{8}}'), 8)
  assert.equal(L.notaDo('anotação: 3 vezes'), null)
  assert.equal(L.notaDo(null), null)
  assert.deepEqual(L.protocolo(''), {})
})

test('concluir: troca resultado, aprendizados e conclusão sem mexer no resto', () => {
  const novo = L.escreverConclusao(ESPELHO, {
    resultado: 'funcionou',
    nota: 9.5,
    aprendizados: ['Espelhar só um detalhe por vez', '  '],
    conclusao: 'Vale usar em reuniões.',
    proximo: 'manter',
  })
  const p = L.protocolo(novo)
  assert.equal(p.resultado, '- **Funcionou?** Funcionou\n- **Nota:** 9,5\n- **Próximo passo:** Manter: vira rotina')
  assert.deepEqual(L.itensDe(p.aprendizados), ['Espelhar só um detalhe por vez'])
  assert.equal(p.conclusao, 'Vale usar em reuniões.')
  assert.equal(L.notaDo(novo), 9.5)
  // O começo do protocolo fica igual
  assert.ok(novo.startsWith(ESPELHO.split('### **📊 Resultado**')[0].replace(/\n{3,}/g, '\n\n').trimEnd()))
  // Os separadores entre as seções continuam
  assert.match(novo, /Próximo passo:\*\* Manter: vira rotina\n\n---\n\n### 📚 Aprendizados-Chave/)

  // Sem as seções: cria no fim
  const simples = L.escreverConclusao('### 🎯 Objetivo\n\nDormir melhor\n', { resultado: 'parcial', nota: null, aprendizados: ['Cafeína depois das 16h atrapalha'], conclusao: '', proximo: null })
  assert.equal(
    simples,
    '### 🎯 Objetivo\n\nDormir melhor\n\n### 📊 Resultado\n\n- **Funcionou?** Parcial\n\n### 📚 Aprendizados-chave\n\n- Cafeína depois das 16h atrapalha\n',
  )
  // Texto vazio
  assert.equal(L.escreverConclusao(null, { resultado: 'nao_funcionou', nota: 3, aprendizados: [], conclusao: 'Não serve para mim.', proximo: 'parar' }), '### 📊 Resultado\n\n- **Funcionou?** Não funcionou\n- **Nota:** 3\n- **Próximo passo:** Deixar de lado\n\n### 📌 Conclusão final\n\nNão serve para mim.\n')
})

test('protocolo inicial só com o que foi preenchido', () => {
  assert.equal(L.protocoloInicial({}), null)
  assert.equal(L.protocoloInicial({ procedimento: '1. Ler 20 min' }), '### 📋 Procedimento\n\n1. Ler 20 min\n')
  assert.equal(L.protocoloInicial({ objetivo: 'Foco', procedimento: 'Ler' }), '### 🎯 Objetivo\n\nFoco\n\n### 📋 Procedimento\n\nLer\n')
})
