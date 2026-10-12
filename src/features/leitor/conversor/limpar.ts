// Remove o que é do papel e não do texto: cabeçalhos, rodapés, números de página e sumários.
import type { Linha, PaginaBruta } from "./tipos"
import { assinatura, ehNumeroDePagina, moda, pareceTituloPorPadrao } from "./texto"

const ZONA = 0.12

function naZona(l: Linha, p: PaginaBruta): "topo" | "rodape" | null {
  if (l.y < p.altura * ZONA) return "topo"
  if (l.y > p.altura * (1 - ZONA)) return "rodape"
  return null
}

/** Uma das primeiras linhas desenhadas na faixa do alto, ou das últimas na faixa do pé (onde ficam os cabeçalhos). */
function naPonta(p: PaginaBruta, i: number, zona: "topo" | "rodape"): boolean {
  return zona === "topo" ? i < 3 : i >= p.linhas.length - 3
}

/**
 * Pode ser cabeçalho corrido: não é fala de diálogo nem frase terminada. Número de página fica de fora:
 * tem regras próprias (e serve de referência para achar o cabeçalho ao lado dele, em removerNumerosNoTexto).
 */
function podeSerCabecalho(texto: string): boolean {
  const t = texto.trim()
  return t.length >= 2 && !ehNumeroDePagina(t) && !/^[–—-]/.test(t) && !/[.!?…]["”»)]*$/.test(t)
}

/**
 * Cabeçalhos e rodapés: textos que se repetem no alto ou no pé de muitas páginas (título do livro), ou de
 * algumas páginas próximas (o nome do capítulo no alto das páginas daquele capítulo).
 */
function removerCabecalhos(paginas: PaginaBruta[]): { removidas: number; assinaturas: Set<string> } {
  const assinaturas = new Set<string>()
  const comTexto = paginas.filter((p) => p.linhas.length > 0)
  if (comTexto.length < 2) return { removidas: 0, assinaturas }
  const minimo = comTexto.length < 8 ? Math.max(2, Math.ceil(comTexto.length * 0.5)) : Math.max(3, Math.ceil(comTexto.length * 0.2))
  const contagem = new Map<string, number>()
  // Páginas em que cada texto aparece numa das pontas, para achar o cabeçalho que muda a cada capítulo
  const nasPontas = new Map<string, number[]>()
  let comNumero = 0
  for (const p of comTexto) {
    const vistas = new Set<string>()
    let temNumero = false
    p.linhas.forEach((l, i) => {
      const zona = naZona(l, p)
      if (!zona) return
      if (ehNumeroDePagina(l.texto)) temNumero = true
      const chave = `${zona}:${assinatura(l.texto)}`
      if (vistas.has(chave)) return
      vistas.add(chave)
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
      if (naPonta(p, i, zona) && podeSerCabecalho(l.texto)) nasPontas.set(chave, [...(nasPontas.get(chave) ?? []), p.numero])
    })
    if (temNumero) comNumero++
  }
  // O mesmo texto na ponta de duas páginas próximas (a 3 páginas ou menos uma da outra)
  const corrido = (chave: string) => (nasPontas.get(chave) ?? []).some((n, k, ps) => k > 0 && n - ps[k - 1] <= 3)
  // Ou o nome de um título do livro (escrito em letra bem maior em outro lugar) em letra comum no alto da página:
  // é o cabeçalho com o nome do capítulo ("Capítulo 3. O Encontro" no alto das páginas do capítulo 3)
  const todas = comTexto.flatMap((p) => p.linhas)
  const corpo = moda(todas.map((l) => [l.tamanho, l.texto.length] as [number, number])) || 11
  const titulos = [
    ...new Set(
      todas
        .filter((l) => l.tamanho >= corpo * 1.3 && l.texto.trim().split(/\s+/).length >= 2)
        .map((l) => assinatura(l.texto))
        .filter((a) => a.length >= 12),
    ),
  ]
  const nomeDeTitulo = (l: Linha) => {
    if (l.tamanho > corpo * 1.05) return false
    const a = assinatura(l.texto)
    return titulos.some((t) => a === t || a.endsWith(` ${t}`))
  }
  const numerosRepetem = comNumero >= minimo
  let removidas = 0
  for (const p of comTexto) {
    p.linhas = p.linhas.filter((l, i) => {
      const zona = naZona(l, p)
      if (!zona) return true
      const chave = `${zona}:${assinatura(l.texto)}`
      const repetida = (contagem.get(chave) ?? 0) >= minimo
      const numero = numerosRepetem && ehNumeroDePagina(l.texto)
      const doCapitulo = naPonta(p, i, zona) && podeSerCabecalho(l.texto) && (corrido(chave) || (zona === "topo" && nomeDeTitulo(l)))
      if (repetida || numero || doCapitulo) {
        removidas++
        if (!ehNumeroDePagina(l.texto)) assinaturas.add(assinatura(l.texto))
        return false
      }
      return true
    })
  }
  return { removidas, assinaturas }
}

/**
 * Números de página soltos no meio do texto, com o cabeçalho corrido ao lado.
 * Acontece em PDFs refeitos a partir de outro PDF (cada linha virou um parágrafo).
 */
function removerNumerosNoTexto(paginas: PaginaBruta[], conhecidos: Set<string>): number {
  const comTexto = paginas.filter((p) => p.linhas.length > 0)
  let paginasComNumero = 0
  for (const p of comTexto) if (p.linhas.some((l) => ehNumeroDePagina(l.texto) && !naZona(l, p))) paginasComNumero++
  if (paginasComNumero < Math.max(3, comTexto.length * 0.15)) return 0

  // Todas as linhas em sequência: o número de uma página e o cabeçalho corrido que vem junto
  // podem cair em páginas diferentes do PDF (o número no pé de uma, o cabeçalho no alto da outra)
  const todas = comTexto.flatMap((p) => p.linhas)
  const perto = (i: number) => [i - 2, i - 1, i + 1, i + 2].filter((j) => j >= 0 && j < todas.length)

  // Linhas vizinhas dos números que se repetem são o cabeçalho corrido (nome do autor, título)
  const vizinhas = new Map<string, number>()
  todas.forEach((l, i) => {
    if (!ehNumeroDePagina(l.texto)) return
    for (const j of [i - 1, i + 1]) {
      const v = todas[j]
      if (!v || ehNumeroDePagina(v.texto) || v.texto.length > 80) continue
      const a = assinatura(v.texto)
      vizinhas.set(a, (vizinhas.get(a) ?? 0) + 1)
    }
  })
  const cabecalhos = new Set([...vizinhas].filter(([, n]) => n >= Math.max(3, paginasComNumero * 0.05)).map(([a]) => a))
  // Os cabeçalhos já achados no alto e no pé das páginas também valem aqui
  for (const a of conhecidos) if (a.length >= 4) cabecalhos.add(a)

  const prefixos = [...cabecalhos].filter((c) => c.length >= 12)
  const remover = new Set<Linha>()
  todas.forEach((l, i) => {
    if (!ehNumeroDePagina(l.texto)) return
    remover.add(l)
    // Até duas linhas antes e depois do número (às vezes o cabeçalho e o número trocam de lugar)
    for (const j of perto(i)) {
      const v = todas[j]
      if (remover.has(v)) continue
      const a = assinatura(v.texto)
      if (cabecalhos.has(a)) remover.add(v)
      else if (Math.abs(j - i) === 1) {
        // Cabeçalho grudado no começo da linha seguinte ("Título do Livro O texto continua...")
        const h = prefixos.find((c) => a.startsWith(c + " "))
        if (h) cortarInicio(v, h)
      }
    }
  })
  // Cabeçalho corrido sozinho na primeira ou na última linha de uma página também sai
  // (só depois da primeira página numerada: antes disso, a mesma frase costuma ser o título na folha de rosto)
  const primeiraNumerada = comTexto.findIndex((p) => p.linhas.some((l) => ehNumeroDePagina(l.texto)))
  for (const p of comTexto.slice(Math.max(0, primeiraNumerada))) {
    for (const l of [p.linhas[0], p.linhas.at(-1)]) if (l && cabecalhos.has(assinatura(l.texto))) remover.add(l)
  }
  if (!remover.size) return 0
  for (const p of comTexto) {
    // O espaço deixado pelas linhas retiradas não indica troca de parágrafo
    p.linhas.forEach((l, i) => {
      if (!remover.has(l) && i > 0 && remover.has(p.linhas[i - 1])) l.semVao = true
    })
    p.linhas = p.linhas.filter((l) => !remover.has(l))
  }
  return remover.size
}

/** Tira do começo da linha o trecho cuja assinatura é `alvo`. */
function cortarInicio(l: Linha, alvo: string) {
  let corte = -1
  for (let k = alvo.length; k <= l.texto.length; k++) {
    if (assinatura(l.texto.slice(0, k)) === alvo && /[\s.,;:–—-]/.test(l.texto[k] ?? " ")) {
      corte = k
      break
    }
  }
  if (corte < 0) return
  let falta = corte
  const trechos = []
  for (const t of l.trechos) {
    if (falta >= t.texto.length) {
      falta -= t.texto.length
      continue
    }
    trechos.push({ ...t, texto: t.texto.slice(falta) })
    falta = 0
  }
  if (!trechos.length) return
  trechos[0].texto = trechos[0].texto.replace(/^[\s.,;:–—-]+/, "")
  l.trechos = trechos.filter((t) => t.texto)
  l.texto = l.trechos.map((t) => t.texto).join("")
  l.semVao = true
}

const PONTILHADO = /(?:\.{4,}|…{2,}|(?:\.\s){3,}|_{4,}|-{4,})\s*\d{1,4}\s*$/

/** Páginas de sumário com pontilhado ("Introdução ........ 5"): o livro fluido tem sumário próprio. */
function removerPaginasDeSumario(paginas: PaginaBruta[]): number[] {
  const removidas: number[] = []
  for (const p of paginas) {
    if (p.linhas.length < 5) continue
    const comPontilhado = p.linhas.filter((l) => PONTILHADO.test(l.texto)).length
    if (comPontilhado >= 5 && comPontilhado >= p.linhas.length * 0.35) {
      p.linhas = []
      removidas.push(p.numero)
    }
  }
  return removidas
}

function pareceEntradaDeSumario(linhas: Linha[], j: number): boolean {
  const t = linhas[j].texto.trim()
  if (ehNumeroDePagina(t) || /\s\d{1,4}$/.test(t) || PONTILHADO.test(t)) return true
  // Título com cara de capítulo só conta se tiver um número de página por perto
  const numeroPerto = [1, 2].some((d) => {
    const v = linhas[j + d]?.texto.trim() ?? ""
    return ehNumeroDePagina(v) || /\s\d{1,4}$/.test(v)
  })
  if ((pareceTituloPorPadrao(t) || /^[IVXLC]{1,5}\s+\S/.test(t)) && numeroPerto) return true
  const letras = t.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "")
  return letras.length >= 3 && letras === letras.toUpperCase()
}

/** Sumário sem pontilhado, logo depois de uma linha "Sumário" ou "Índice". */
function removerBlocoDeSumario(paginas: PaginaBruta[]): number {
  const todas = paginas.flatMap((p) => p.linhas)
  for (let i = 0; i < todas.length; i++) {
    if (!/^(sum[áa]rio|[íi]ndice|conte[úu]do|contents)$/i.test(todas[i].texto.trim())) continue
    let fim = i
    let entradas = 0
    let fora = 0
    const base = todas[i + 1]
    for (let j = i + 1; j < todas.length && fora < 3; j++) {
      const l = todas[j]
      // O sumário tem uma aparência só; negrito ou letra de outro tamanho já é o texto do livro
      if (base && (l.negrito !== base.negrito || Math.abs(l.tamanho - base.tamanho) > 1)) break
      if (pareceEntradaDeSumario(todas, j)) {
        entradas++
        fora = 0
        fim = j
      } else fora++
    }
    if (entradas < 4) continue
    const remover = new Set(todas.slice(i, fim + 1))
    for (const p of paginas) p.linhas = p.linhas.filter((l) => !remover.has(l))
    return remover.size
  }
  return 0
}

/**
 * Título de parte repetido antes de cada capítulo ("I Curso de …" antes de "1ª Aula", "2ª Aula"...).
 * Vale para a linha que se repete várias vezes e quase sempre logo antes de um título de capítulo:
 * a primeira vez vira título da parte (um nível acima dos capítulos) e as repetições saem.
 */
function tratarTitulosDeParte(paginas: PaginaBruta[]): number {
  const todas = paginas.flatMap((p) => p.linhas)
  const pareceTitulo = (l: Linha | undefined) => Boolean(l && (l.negrito || pareceTituloPorPadrao(l.texto)) && l.texto.length <= 120)
  const ocorrencias = new Map<string, { total: number; antesDeTitulo: number; primeira: Linha | null }>()
  todas.forEach((l, i) => {
    if (l.texto.length < 12 || l.texto.length > 120 || l.negrito) return
    const a = assinatura(l.texto)
    const o = ocorrencias.get(a) ?? { total: 0, antesDeTitulo: 0, primeira: null }
    o.total++
    if ([1, 2, 3].some((d) => pareceTitulo(todas[i + d]))) {
      o.antesDeTitulo++
      o.primeira ??= l
    }
    ocorrencias.set(a, o)
  })
  const grupos = [...ocorrencias].filter(([, o]) => o.total >= 3 && o.antesDeTitulo >= o.total * 0.6)
  if (!grupos.length) return 0
  const repetidas = new Set(grupos.map(([a]) => a))
  const primeiras = new Set(grupos.map(([, o]) => o.primeira).filter((l): l is Linha => l !== null))
  // A mesma linha sem o numeral da parte ("Curso de …" onde o normal é "I Curso de …") também é repetição
  const semNumeral = (a: string) => a.replace(/^(?:[ivxlc]{1,6}|#)\s+/, "")
  const familias = new Set(grupos.map(([a]) => semNumeral(a)).filter((a) => a.length >= 12))

  const remover = new Set<Linha>()
  todas.forEach((l, i) => {
    if (l.negrito || l.parte || remover.has(l)) return
    const ehPrimeira = primeiras.has(l)
    const a = assinatura(l.texto)
    if (!ehPrimeira && !repetidas.has(a) && !familias.has(a)) return
    // O título da parte pode ocupar mais de uma linha (com variações): vai até a linha antes do título do capítulo
    let fim = i
    for (let k = i + 1; k <= i + 3 && k < todas.length; k++) {
      if (pareceTitulo(todas[k])) {
        fim = k - 1
        break
      }
    }
    for (const x of todas.slice(i, fim + 1)) {
      if (ehPrimeira) x.parte = true
      else remover.add(x)
    }
  })
  if (!remover.size) return 0
  for (const p of paginas) p.linhas = p.linhas.filter((l) => !remover.has(l))
  return remover.size
}

export type Limpeza = { cabecalhos: number; numeros: number; paginasDeSumario: number[]; sumario: number; partes: number }

export function limpar(paginas: PaginaBruta[]): Limpeza {
  const paginasDeSumario = removerPaginasDeSumario(paginas)
  const { removidas: cabecalhos, assinaturas } = removerCabecalhos(paginas)
  const sumario = removerBlocoDeSumario(paginas)
  const numeros = removerNumerosNoTexto(paginas, assinaturas)
  const partes = tratarTitulosDeParte(paginas)
  return { cabecalhos, numeros, paginasDeSumario, sumario, partes }
}
