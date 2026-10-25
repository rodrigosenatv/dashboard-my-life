"use client"

/*
 * A folha que vira: o efeito de página de livro do leitor, feito com a transição de telas do próprio
 * navegador (View Transitions). O navegador tira uma foto da página atual, o livro vai para a página
 * seguinte sem animação e o CSS gira a foto em 3D pela lombada, com sombra, por cima da página nova
 * (ou traz a página de antes de volta por cima, ao voltar). As regras de animação estão no fim do
 * globals.css ("Leitor: a folha que vira").
 *
 * Dois jeitos de virar:
 * - sozinha (toque na borda, setas, roda do mouse): a animação corre do começo ao fim;
 * - acompanhando o dedo (arrastar): a animação fica parada e o dedo diz em que ponto ela está. Ao soltar,
 *   a folha termina de virar ou volta para o lugar (e o livro volta para a página de antes, por baixo dela).
 *
 * Com duas páginas lado a lado (tela larga), vira a página da direita (ou a da esquerda, ao voltar)
 * pela lombada no meio.
 */

export type Sentido = "proxima" | "anterior"

/** Nome da transição dado à caixa do livro só enquanto a folha vira. */
const NOME = "folha-livro"
/** Até onde a folha gira no CSS (graus): de lado ela some. */
const GIRO = 92

type TransicaoVista = { finished: Promise<void>; ready: Promise<void>; updateCallbackDone: Promise<void>; skipTransition: () => void }
type DocumentoComTransicao = Document & { startViewTransition?: (atualizar: () => Promise<void>) => TransicaoVista }
/** O que o paginador conta quando muda de lugar. */
type Mudanca = { index?: number; reason?: string }

export type OpcoesFolha = {
  caixa: HTMLElement
  sentido: Sentido
  /** Muda a página no livro, sem animação. */
  ir: () => Promise<unknown> | unknown
  /** Quem avisa que a página mudou (o paginador do livro). */
  avisos: EventTarget
  /** Duas páginas lado a lado. */
  espalhado: boolean
  /** Tema escuro do leitor: a borda da folha fica clara e a sombra, mais forte. */
  escuro: boolean
  /** A página nova é de outro capítulo: a foto espera o capítulo abrir. */
  outroCapitulo: boolean
  /** O capítulo de agora (para reconhecer o aviso do capítulo novo). */
  capitulo?: number
}

/** O navegador sabe fazer a transição, e a pessoa não pediu menos movimento no aparelho. */
export function folhaDisponivel(): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false
  if (!("startViewTransition" in document)) return false
  return !movimentoReduzido()
}

/** O movimento reduzido está ligado no aparelho. */
export function movimentoReduzido(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

/** Espera o livro dizer que mudou de lugar (true) ou desiste depois de um tempo (false). */
function esperarMudanca(alvo: EventTarget, prazo: number, aceitar?: (m: Mudanca) => boolean): Promise<boolean> {
  return new Promise((pronto) => {
    let feito = false
    const terminar = (mudou: boolean) => {
      if (feito) return
      feito = true
      clearTimeout(tempo)
      alvo.removeEventListener("relocate", aoMudar)
      // Sem esperar um quadro: durante a troca o navegador não desenha (requestAnimationFrame não roda);
      // a foto da página nova é tirada logo que esta promessa termina
      pronto(mudou)
    }
    const aoMudar = (e: Event) => {
      if (aceitar && !aceitar((e as CustomEvent<Mudanca>).detail ?? {})) return
      terminar(true)
    }
    const tempo = setTimeout(() => terminar(false), prazo)
    alvo.addEventListener("relocate", aoMudar)
  })
}

/* ------------------------------------------------------------------ */
/* Uma virada de cada vez                                               */
/* ------------------------------------------------------------------ */

/** A transição na tela agora. */
let atual: TransicaoVista | null = null
/** A troca de página em andamento: o livro ignora outra virada até ela terminar. */
let trocando: Promise<void> | null = null
/** Viradas esperando a vez (toques rápidos seguidos). */
let naFila = 0
/** A folha que o dedo está segurando. */
let segurando: { parar: () => void } | null = null

/** Marca o livro como ocupado; a função devolvida diz qual troca de página libera. */
function reservar(): { troca: Promise<void>; liberarQuando: (p: Promise<unknown>) => void } {
  let liberar: () => void = () => {}
  const troca = new Promise<void>((pronto) => {
    liberar = pronto
  })
  // Segurança: se o livro não responder, não trava as próximas viradas
  const tempo = setTimeout(liberar, 3000)
  trocando = troca
  void troca.then(() => {
    clearTimeout(tempo)
    if (trocando === troca) trocando = null
  })
  return { troca, liberarQuando: (p) => void p.then(liberar, liberar) }
}

type Virada = { transicao: TransicaoVista; sombra: () => HTMLElement | null; trocou: Promise<void> }

/** Começa a transição: marca a tela, dá o nome à caixa e troca a página dentro da transição. */
function iniciar(o: OpcoesFolha): Virada | null {
  const doc = document as DocumentoComTransicao
  if (typeof doc.startViewTransition !== "function") return null
  // Toques seguidos: a folha anterior termina na hora e a próxima já começa
  atual?.skipTransition()

  const raiz = document.documentElement
  raiz.dataset.virada = o.sentido
  raiz.dataset.viradaLayout = o.espalhado ? "duas" : "uma"
  raiz.dataset.viradaTema = o.escuro ? "escuro" : "claro"
  o.caixa.style.setProperty("view-transition-name", NOME)

  const { troca, liberarQuando } = reservar()
  // Mudando de capítulo, o livro passa antes pela página em branco do fim do capítulo: só vale o aviso do novo
  const aceitar = o.outroCapitulo && o.capitulo !== undefined ? (m: Mudanca) => m.index !== undefined && m.index !== o.capitulo : undefined
  let sombra: HTMLDivElement | null = null
  const transicao = doc.startViewTransition(async () => {
    const mudou = esperarMudanca(o.avisos, o.outroCapitulo ? 2000 : 700, aceitar)
    liberarQuando(Promise.resolve().then(o.ir))
    await mudou
    // A sombra que a folha joga na página de baixo faz parte da página nova
    const s = document.createElement("div")
    s.className = "folha-sombra"
    s.setAttribute("aria-hidden", "true")
    o.caixa.append(s)
    sombra = s
  })
  atual = transicao
  // Uma transição pulada (outro toque) rejeita estas promessas: não é erro
  transicao.ready.catch(() => {})
  transicao.updateCallbackDone.catch(() => {})
  void transicao.finished
    .catch(() => {})
    .then(() => {
      sombra?.remove()
      if (atual !== transicao) return
      atual = null
      delete raiz.dataset.virada
      delete raiz.dataset.viradaLayout
      delete raiz.dataset.viradaTema
      o.caixa.style.removeProperty("view-transition-name")
    })
  return { transicao, sombra: () => sombra, trocou: troca }
}

/**
 * Vira a página sozinha (toque na borda, setas, roda do mouse). Uma virada de cada vez: o livro ignora
 * uma virada no meio da outra, então toques rápidos esperam a vez. `montar` é chamada na vez desta
 * virada e devolve null quando não há mais para onde virar. Termina quando a folha para.
 */
export async function virarFolha(montar: () => OpcoesFolha | null): Promise<void> {
  if (segurando || naFila >= 3) return
  naFila++
  try {
    while (trocando) await trocando
  } finally {
    naFila--
  }
  if (segurando) return
  const o = montar()
  if (!o) return
  const v = iniciar(o)
  if (!v) {
    await o.ir()
    return
  }
  await v.transicao.finished.catch(() => {})
}

/** Para tudo (o leitor está fechando): a folha na mão e a transição na tela. */
export function pararFolha() {
  segurando?.parar()
  segurando = null
  atual?.skipTransition()
}

/* ------------------------------------------------------------------ */
/* Arrastar: a folha acompanha o dedo                                  */
/* ------------------------------------------------------------------ */

export type GeometriaArrasto = {
  sentido: Sentido
  espalhado: boolean
  /** Borda esquerda e largura da caixa do livro (px, na janela). */
  esquerda: number
  largura: number
  /** Onde o dedo tocou (px, na janela). */
  xInicial: number
}

/**
 * Quanto a folha virou com o dedo em `x`. `feito` é quanto do gesto já foi feito (passa de 1 se o dedo for
 * além); `progresso`, em que ponto do giro a folha está (0 = começo da animação, 1 = fim). A folha gira de
 * modo que o ponto que o dedo pegou fique embaixo dele, como numa folha de papel.
 */
export function giroDoArrasto(g: GeometriaArrasto, x: number): { feito: number; progresso: number } {
  const pagina = g.espalhado ? g.largura / 2 : g.largura
  const lombada = g.espalhado ? g.esquerda + g.largura / 2 : g.esquerda
  // Uma página só, voltando: a folha de antes vem de trás da lombada e pousa (a borda dela vem com o dedo)
  const pousa = g.sentido === "anterior" && !g.espalhado
  const paraEsquerda = g.sentido === "proxima"
  const distancia = Math.max(pagina * 0.45, pousa ? lombada + pagina - g.xInicial : paraEsquerda ? g.xInicial - lombada : lombada - g.xInicial)
  const andado = Math.max(0, paraEsquerda ? g.xInicial - x : x - g.xInicial)
  const feito = andado / distancia
  const graus = (r: number) => (Math.acos(Math.max(-1, Math.min(1, r))) * 180) / Math.PI
  const progresso = pousa ? 1 - graus(feito) / GIRO : graus(1 - feito) / GIRO
  return { feito, progresso: Math.max(0, Math.min(1, progresso)) }
}

const CURVAS: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
}

/**
 * Em que fração do tempo uma animação com esta curva (`cubic-bezier(...)`, `ease`...) chega a esse
 * progresso. Assim a folha anda junto com o dedo, e não no ritmo da curva.
 */
export function tempoDoProgresso(curva: string | undefined, progresso: number): number {
  const alvo = Math.max(0, Math.min(1, progresso))
  const texto = (curva ?? "linear").trim().toLowerCase()
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(texto)
  const p = m ? m[1].split(",").map(Number) : CURVAS[texto]
  if (!p || p.length !== 4 || p.some((n) => !Number.isFinite(n))) return alvo
  const [x1, y1, x2, y2] = p
  const ponto = (s: number, a: number, b: number) => 3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s
  // A curva sobe de 0 a 1: busca binária pelo ponto da curva com esse progresso
  let baixo = 0
  let alto = 1
  for (let i = 0; i < 40; i++) {
    const s = (baixo + alto) / 2
    if (ponto(s, y1, y2) < alvo) baixo = s
    else alto = s
  }
  return Math.max(0, Math.min(1, ponto((baixo + alto) / 2, x1, x2)))
}

const duracaoDe = (a: Animation) => {
  const d = a.effect?.getComputedTiming().duration
  return typeof d === "number" && d > 0 ? d : 520
}

export type ArrastoFolha = {
  /** O dedo está em `x` (px, na janela). */
  mover: (x: number) => void
  /** Soltou, com essa velocidade (px/ms; positiva para a direita). */
  soltar: (velocidade: number) => void
  /** Desistiu (outro dedo, gesto cancelado pelo sistema): a folha volta. */
  cancelar: () => void
}

/**
 * Começa a virar a página acompanhando o dedo. Devolve null quando não dá (outra virada em andamento,
 * mudança de capítulo, navegador sem a transição): aí a página vira quando o dedo soltar.
 * `voltar` desfaz a troca de página (sem animação) quando a pessoa desiste no meio.
 */
export function arrastarFolha(o: OpcoesFolha & { xInicial: number; voltar: () => Promise<unknown> | unknown }): ArrastoFolha | null {
  if (segurando || trocando || naFila > 0 || o.outroCapitulo) return null
  const r = o.caixa.getBoundingClientRect()
  if (r.width < 50) return null
  const v = iniciar(o)
  if (!v) return null

  const geometria: GeometriaArrasto = { sentido: o.sentido, espalhado: o.espalhado, esquerda: r.left, largura: r.width, xInicial: o.xInicial }
  let animacoes: Animation[] = []
  let curva: string | undefined
  let x = o.xInicial
  /** Fração do tempo da animação em que a folha está (0 a 1). */
  let tempo = 0
  let decisao: "virar" | "voltar" | null = null
  let encerrado = false
  let vigia: ReturnType<typeof setTimeout> | undefined

  const aplicar = () => {
    for (const a of animacoes) a.currentTime = tempo * duracaoDe(a)
  }
  const acompanhar = () => {
    tempo = tempoDoProgresso(curva, giroDoArrasto(geometria, x).progresso)
    aplicar()
  }
  const largar = () => {
    clearTimeout(vigia)
    if (segurando === controle) segurando = null
  }

  const terminar = (virar: boolean) => {
    if (encerrado) return
    encerrado = true
    clearTimeout(vigia)
    if (virar) {
      // Termina o giro do ponto em que o dedo deixou, um pouco mais rápido que a virada sozinha
      largar()
      for (const a of animacoes) {
        a.playbackRate = 1.4
        a.play()
      }
      return
    }
    // Desistiu: a folha volta para o lugar...
    const de = tempo
    const duracao = Math.max(140, de * 380)
    const comeco = performance.now()
    const passo = (agora: number) => {
      const p = Math.min(1, Math.max(0, agora - comeco) / duracao)
      tempo = de * (1 - p) * (1 - p)
      aplicar()
      if (p < 1) {
        requestAnimationFrame(passo)
        return
      }
      // ...e, com ela cobrindo tudo, o livro volta para a página de antes por baixo
      void v.trocou.then(async () => {
        const mudou = esperarMudanca(o.avisos, 700)
        reservar().liberarQuando(Promise.resolve().then(o.voltar))
        await mudou
        v.transicao.skipTransition()
        largar()
      })
    }
    requestAnimationFrame(passo)
  }

  const decidir = (velocidade: number) => {
    if (decisao) return
    const { feito } = giroDoArrasto(geometria, x)
    const aFavor = o.sentido === "proxima" ? -velocidade : velocidade
    // Vira se passou de um terço do caminho, se foi um gesto rápido no sentido certo ou se o dedo ainda ia
    // nesse sentido com um bom pedaço feito. Voltou o dedo rápido ou parou cedo: desiste
    const virar = aFavor >= -0.2 && (feito > 0.3 || (aFavor > 0.35 && feito > 0.03) || (aFavor > 0.1 && feito > 0.18))
    decisao = virar ? "virar" : "voltar"
    if (animacoes.length) terminar(decisao === "virar")
  }

  const vigiar = () => {
    clearTimeout(vigia)
    // Segurança: sem notícia do dedo por muito tempo, a folha decide sozinha
    vigia = setTimeout(() => decidir(0), 10000)
  }

  v.transicao.ready.then(
    () => {
      const sombra = v.sombra()
      animacoes = document.getAnimations().filter((a) => {
        const efeito = a.effect as KeyframeEffect | null
        return Boolean(efeito && (efeito.pseudoElement?.includes("view-transition") || (sombra && efeito.target === sombra)))
      })
      // A curva da folha (a imagem que gira) guia o tempo de todas as animações
      const folha = animacoes.find((a) => {
        const efeito = a.effect as KeyframeEffect
        return efeito.pseudoElement?.includes("view-transition") && efeito.getKeyframes().some((k) => "transform" in k)
      })
      curva = folha ? (folha.effect as KeyframeEffect).getKeyframes()[0]?.easing : undefined
      if (!animacoes.length || encerrado) {
        encerrado = true
        largar()
        return
      }
      for (const a of animacoes) a.pause()
      acompanhar()
      if (decisao) terminar(decisao === "virar")
    },
    () => {
      encerrado = true
      largar()
    },
  )
  void v.transicao.finished.catch(() => {}).then(largar)

  const controle: ArrastoFolha & { parar: () => void } = {
    mover(nx) {
      if (decisao) return
      x = nx
      if (animacoes.length) acompanhar()
      vigiar()
    },
    soltar(velocidade) {
      decidir(velocidade)
    },
    cancelar() {
      if (decisao) return
      decisao = "voltar"
      if (animacoes.length) terminar(false)
    },
    parar() {
      encerrado = true
      clearTimeout(vigia)
      v.transicao.skipTransition()
    },
  }
  segurando = controle
  vigiar()
  return controle
}

/* ------------------------------------------------------------------ */
/* Gesto de deslizar (no lugar do arrasto do paginador)                */
/* ------------------------------------------------------------------ */

export type Deslize = {
  /** `selecao` diz se há texto selecionado no livro agora. */
  inicio: (e: TouchEvent, selecao: () => boolean) => void
  mover: (e: TouchEvent) => void
  fim: (e: TouchEvent) => void
  cancelar: () => void
}

export type AcoesDoDeslize = {
  /** O efeito de folha está ligado agora. */
  ativo: () => boolean
  /** Começa a virar acompanhando o dedo (null quando não dá: aí a página vira ao soltar). */
  arrastar: (sentido: Sentido, xInicial: number) => ArrastoFolha | null
  /** Vira de uma vez. */
  virar: (sentido: Sentido) => void
}

/** Quanto o dedo anda (px) até o gesto contar como deslizar de lado. */
const LIMIAR = 16

/**
 * O deslizar para o lado: a folha acompanha o dedo e, ao soltar, termina de virar ou volta. Dois dedos,
 * zoom, deslizar para cima ou para baixo e seleção de texto não viram a página.
 */
export function criarDeslize({ ativo, arrastar, virar }: AcoesDoDeslize): Deslize {
  type Toque = { id: number; x: number; sx: number; sy: number; t: number; selecao: () => boolean }
  let toque: Toque | null = null
  let sentido: Sentido | null = null
  let arrasto: ArrastoFolha | null = null
  let ignorar = false
  let amostras: { t: number; sx: number }[] = []
  const zoom = () => (typeof visualViewport !== "undefined" && visualViewport ? visualViewport.scale : 1)

  const limpar = () => {
    toque = null
    sentido = null
    arrasto = null
    ignorar = false
    amostras = []
  }
  const anotar = (t: number, sx: number) => {
    amostras.push({ t, sx })
    if (amostras.length > 16) amostras.shift()
  }
  /** Velocidade do dedo nos últimos 100 ms em que ele andou (px/ms); parado antes de soltar, zero. */
  const velocidade = (agora: number) => {
    const ultima = amostras.at(-1)
    if (!ultima || agora - ultima.t > 100) return 0
    const base = amostras.find((a) => ultima.t - a.t <= 100) ?? ultima
    return ultima.t > base.t ? (ultima.sx - base.sx) / (ultima.t - base.t) : 0
  }
  const doToque = (lista: TouchList, id: number): Touch | null => {
    for (let i = 0; i < lista.length; i++) if (lista[i].identifier === id) return lista[i]
    return null
  }
  /** Onde o dedo está na janela do app (dentro do livro, o toque conta a partir do quadro dele). */
  const naJanela = (e: TouchEvent, t: Touch) => {
    const no = e.target as Node | null
    const doc = no?.nodeType === 9 ? (no as Document) : no?.ownerDocument
    const quadro = doc?.defaultView?.frameElement as HTMLElement | null | undefined
    return (quadro?.getBoundingClientRect().left ?? 0) + t.clientX
  }

  return {
    inicio(e, selecao) {
      if (toque && e.touches.length > 1) {
        // Outro dedo no meio do gesto (zoom): não vira a página
        arrasto?.cancelar()
        limpar()
        return
      }
      arrasto?.cancelar()
      limpar()
      if (!ativo() || e.touches.length > 1 || zoom() > 1.01) return
      const t = e.changedTouches[0]
      if (!t) return
      toque = { id: t.identifier, x: naJanela(e, t), sx: t.screenX, sy: t.screenY, t: e.timeStamp, selecao }
      anotar(e.timeStamp, t.screenX)
    },
    mover(e) {
      if (!toque || ignorar) return
      if (e.touches.length > 1 || zoom() > 1.01) {
        arrasto?.cancelar()
        limpar()
        return
      }
      const t = doToque(e.changedTouches, toque.id)
      if (!t) return
      const dx = t.screenX - toque.sx
      const dy = t.screenY - toque.sy
      anotar(e.timeStamp, t.screenX)
      if (!sentido) {
        if (Math.abs(dy) > LIMIAR && Math.abs(dy) > Math.abs(dx)) {
          ignorar = true
          return
        }
        if (Math.abs(dx) < LIMIAR || Math.abs(dx) < Math.abs(dy) * 1.2) return
        // Dedo parado muito tempo antes de andar é seleção de texto, não virar de página
        if (e.timeStamp - toque.t > 700 || toque.selecao()) {
          ignorar = true
          return
        }
        sentido = dx < 0 ? "proxima" : "anterior"
        arrasto = arrastar(sentido, toque.x)
      }
      // Deslizar de lado não rola nada por baixo
      if (e.cancelable) e.preventDefault()
      arrasto?.mover(toque.x + dx)
    },
    fim(e) {
      const ini = toque
      if (!ini) return
      const t = doToque(e.changedTouches, ini.id)
      if (!t) return
      // O soltar repete o último lugar do dedo: a velocidade vem só do movimento
      const vel = velocidade(e.timeStamp)
      const s = sentido
      const a = arrasto
      const ignorado = ignorar
      limpar()
      if (ignorado) return
      const dx = t.screenX - ini.sx
      if (a) {
        a.mover(ini.x + dx)
        a.soltar(vel)
        return
      }
      // Sem acompanhar o dedo: vira ao soltar, se o gesto foi de virar página
      if (!s || ini.selecao()) return
      const rapido = Math.abs(vel) > 0.35
      if (Math.abs(dx) < 45 && !(rapido && Math.abs(dx) > 25)) return
      if (e.timeStamp - ini.t > 1500 || (s === "proxima") !== dx < 0) return
      virar(s)
    },
    cancelar() {
      arrasto?.cancelar()
      limpar()
    },
  }
}
