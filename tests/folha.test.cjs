const test = require('node:test')
const assert = require('node:assert/strict')
const F = require('./carregar-ts.cjs')('src/features/leitor/folha.ts')

const perto = (a, b, folga = 0.01) => assert.ok(Math.abs(a - b) <= folga, `${a} não está perto de ${b}`)

test('curva da folha: o tempo que dá cada progresso', () => {
  // Linear (ou curva desconhecida): o tempo é o próprio progresso
  perto(F.tempoDoProgresso('linear', 0.3), 0.3)
  perto(F.tempoDoProgresso(undefined, 0.7), 0.7)
  perto(F.tempoDoProgresso('steps(4)', 0.5), 0.5)
  // Pontas e valores fora da faixa
  perto(F.tempoDoProgresso('cubic-bezier(0.45, 0.05, 0.5, 0.95)', 0), 0)
  perto(F.tempoDoProgresso('cubic-bezier(0.45, 0.05, 0.5, 0.95)', 1), 1)
  perto(F.tempoDoProgresso('ease-in-out', -2), 0)
  perto(F.tempoDoProgresso('ease-in-out', 5), 1)
  // Curva simétrica: metade do progresso na metade do tempo
  perto(F.tempoDoProgresso('ease-in-out', 0.5), 0.5)
  // Começo lento (entrada suave): para andar 10% precisa de bem mais que 10% do tempo
  assert.ok(F.tempoDoProgresso('cubic-bezier(0.45, 0.05, 0.5, 0.95)', 0.1) > 0.2)
  // Saída suave: o começo é rápido, 60% do progresso chega antes de 60% do tempo
  assert.ok(F.tempoDoProgresso('cubic-bezier(0.25, 0.6, 0.3, 1)', 0.6) < 0.4)
  // Sempre crescente
  let antes = -1
  for (let p = 0; p <= 1.0001; p += 0.05) {
    const t = F.tempoDoProgresso('cubic-bezier(0.45, 0.05, 0.5, 0.95)', p)
    assert.ok(t >= antes)
    antes = t
  }
})

const umaPagina = (sentido, xInicial) => ({ sentido, espalhado: false, esquerda: 0, largura: 400, xInicial })

test('arrastar: avançar levanta a folha pelo ponto que o dedo pegou', () => {
  const g = umaPagina('proxima', 300)
  assert.deepEqual(F.giroDoArrasto(g, 300), { feito: 0, progresso: 0 })
  // Dedo indo para a direita ao avançar: a folha não gira para trás
  assert.equal(F.giroDoArrasto(g, 340).progresso, 0)
  // Na metade do caminho até a lombada, a folha está a 60° (o ponto pego fica embaixo do dedo)
  const meio = F.giroDoArrasto(g, 150)
  perto(meio.feito, 0.5)
  perto(meio.progresso, 60 / 92)
  // Dedo na lombada: de lado (90°)
  perto(F.giroDoArrasto(g, 0).progresso, 90 / 92)
  // Passou da lombada: no fim do giro
  assert.equal(F.giroDoArrasto(g, -100).progresso, 1)
  // Quanto mais o dedo anda, mais a folha gira
  assert.ok(F.giroDoArrasto(g, 200).progresso > F.giroDoArrasto(g, 250).progresso)
})

test('arrastar: perto da lombada o gesto ainda precisa de um caminho mínimo', () => {
  // Tocou a 40 px da lombada: o caminho conta como 45% da página (180 px)
  const g = umaPagina('proxima', 40)
  perto(F.giroDoArrasto(g, -50).feito, 0.5)
})

test('arrastar: voltar traz a folha de trás da lombada com a borda junto do dedo', () => {
  const g = umaPagina('anterior', 100)
  // Parado: a folha ainda está de lado, quase no começo do giro
  const parado = F.giroDoArrasto(g, 100)
  assert.equal(parado.feito, 0)
  perto(parado.progresso, 1 - 90 / 92)
  // Até a borda direita da página: pousada
  perto(F.giroDoArrasto(g, 400).progresso, 1)
  // Na metade do caminho até a borda: a folha está a 60° da página
  perto(F.giroDoArrasto(g, 250).progresso, 1 - 60 / 92)
})

test('arrastar: com duas páginas, a lombada fica no meio', () => {
  // Avançar: pega a página da direita (lombada em 400 numa caixa de 800)
  const avancar = { sentido: 'proxima', espalhado: true, esquerda: 0, largura: 800, xInicial: 700 }
  perto(F.giroDoArrasto(avancar, 550).progresso, 60 / 92)
  perto(F.giroDoArrasto(avancar, 400).progresso, 90 / 92)
  // Voltar: pega a página da esquerda e leva até a lombada
  const voltar = { sentido: 'anterior', espalhado: true, esquerda: 0, largura: 800, xInicial: 100 }
  perto(F.giroDoArrasto(voltar, 250).progresso, 60 / 92)
  perto(F.giroDoArrasto(voltar, 400).progresso, 90 / 92)
  // A caixa pode não começar no zero da janela
  const deslocada = { ...avancar, esquerda: 100, xInicial: 800 }
  perto(F.giroDoArrasto(deslocada, 650).progresso, 60 / 92)
})
