// Preferências de aparência do leitor e o CSS que elas aplicam dentro do livro.

export type TemaLeitura = "claro" | "sepia" | "escuro" | "preto"
export type FonteLeitura = "livro" | "serifa" | "sem-serifa"
export type MargemLeitura = "estreita" | "media" | "larga"
/** Como a página vira: como folha de papel, deslizando para o lado ou sem animação. */
export type ViradaPagina = "folha" | "deslizar" | "nenhuma"

export type Aparencia = {
  /** Tamanho da letra em porcentagem do padrão (100). */
  tamanho: number
  fonte: FonteLeitura
  entrelinhas: number
  margem: MargemLeitura
  justificado: boolean
  hifenizar: boolean
  tema: TemaLeitura
  modo: "paginas" | "rolagem"
  paragrafos: "livro" | "espaco" | "recuo"
  virada: ViradaPagina
  /** Não deixa o celular apagar a tela enquanto a pessoa lê. */
  telaAcesa: boolean
}

export const APARENCIA_PADRAO: Aparencia = {
  tamanho: 100,
  fonte: "serifa",
  entrelinhas: 1.55,
  margem: "media",
  justificado: true,
  hifenizar: true,
  tema: "claro",
  modo: "paginas",
  paragrafos: "livro",
  virada: "folha",
  telaAcesa: true,
}

export const TAMANHO_MIN = 70
export const TAMANHO_MAX = 220

export const TEMAS: Record<TemaLeitura, { nome: string; fundo: string; texto: string; suave: string; link: string; escuro: boolean }> = {
  claro: { nome: "Claro", fundo: "#fbfaf7", texto: "#1d1d1b", suave: "#6b6a66", link: "#1f6079", escuro: false },
  sepia: { nome: "Sépia", fundo: "#f3ead6", texto: "#4a3a2a", suave: "#8a7660", link: "#8a4b14", escuro: false },
  escuro: { nome: "Escuro", fundo: "#1b1e20", texto: "#d9d5ce", suave: "#8f8b85", link: "#7cc0d8", escuro: true },
  preto: { nome: "Preto", fundo: "#000000", texto: "#c8c6c2", suave: "#7a7874", link: "#6fb3cc", escuro: true },
}

export const FONTES: Record<FonteLeitura, { nome: string; pilha: string | null }> = {
  livro: { nome: "Do livro", pilha: null },
  serifa: {
    nome: "Serifa",
    pilha: `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Noto Serif", "Times New Roman", serif`,
  },
  "sem-serifa": {
    nome: "Sem serifa",
    pilha: `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif`,
  },
}

/** Espaço entre o texto e a borda da tela (o paginador usa porcentagem). */
export const MARGENS: Record<MargemLeitura, { nome: string; gap: string }> = {
  estreita: { nome: "Estreita", gap: "4%" },
  media: { nome: "Média", gap: "7%" },
  larga: { nome: "Larga", gap: "11%" },
}

const CHAVE = "dml:leitor:aparencia"

export function aparenciaGuardada(): Aparencia {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (bruto) return normalizarAparencia(JSON.parse(bruto))
  } catch {
    // armazenamento indisponível: segue com o padrão
  }
  // Primeira vez: acompanha o tema do app
  const escuro = typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  return { ...APARENCIA_PADRAO, tema: escuro ? "escuro" : "claro" }
}

export function guardarAparencia(a: Aparencia) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(a))
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

export const VIRADAS: Record<ViradaPagina, string> = { folha: "Folha", deslizar: "Deslizar", nenhuma: "Nenhum" }

export function normalizarAparencia(x: (Partial<Aparencia> & { animacao?: boolean }) | null | undefined): Aparencia {
  const { animacao, ...resto } = x ?? {}
  const a = { ...APARENCIA_PADRAO, ...resto }
  // Antes era só "animação ligada ou desligada": desligada continua sem animação
  if (!(a.virada in VIRADAS)) a.virada = animacao === false ? "nenhuma" : "folha"
  a.tamanho = Math.min(TAMANHO_MAX, Math.max(TAMANHO_MIN, Number(a.tamanho) || 100))
  a.entrelinhas = Math.min(2.2, Math.max(1.1, Number(a.entrelinhas) || APARENCIA_PADRAO.entrelinhas))
  if (!(a.tema in TEMAS)) a.tema = APARENCIA_PADRAO.tema
  if (!(a.fonte in FONTES)) a.fonte = APARENCIA_PADRAO.fonte
  if (!(a.margem in MARGENS)) a.margem = APARENCIA_PADRAO.margem
  if (a.modo !== "paginas" && a.modo !== "rolagem") a.modo = "paginas"
  if (!["livro", "espaco", "recuo"].includes(a.paragrafos)) a.paragrafos = "livro"
  a.telaAcesa = a.telaAcesa !== false
  return a
}

/** CSS colocado depois do CSS do livro, para valer por cima dele. */
export function cssDoLivro(a: Aparencia): string {
  const t = TEMAS[a.tema]
  const fonte = FONTES[a.fonte].pilha
  const blocos = "p, li, blockquote, dd, dt"
  const partes: string[] = [
    `html { color-scheme: ${t.escuro ? "dark" : "light"} !important; font-size: ${(16 * a.tamanho) / 100}px !important; }`,
    `html, body { background: ${t.fundo} !important; color: ${t.texto} !important; }`,
    `body { font-size: 1rem !important; }`,
    // Cores do livro somem para o texto ficar legível em qualquer tema
    `body *:not(img):not(svg):not(svg *):not(video) { color: inherit !important; background-color: transparent !important; border-color: ${t.suave} !important; }`,
    `a, a * { color: ${t.link} !important; }`,
    `${blocos}, div, td, th { line-height: ${a.entrelinhas} !important; }`,
    `${blocos} { text-align: ${a.justificado ? "justify" : "start"} !important; -webkit-hyphens: ${a.hifenizar ? "auto" : "manual"} !important; hyphens: ${a.hifenizar ? "auto" : "manual"} !important; hanging-punctuation: allow-end last; widows: 2; orphans: 2; }`,
    // O que o livro centraliza continua centralizado; destaque curto em negrito não é justificado
    `p.centro, [align="center"], .center, .centered, .centralizado, .text-center { text-align: center !important; }`,
    `p.destaque { text-align: start !important; -webkit-hyphens: manual !important; hyphens: manual !important; }`,
    `h1, h2, h3, h4, h5, h6 { line-height: 1.25 !important; -webkit-hyphens: manual !important; hyphens: manual !important; }`,
    `img, svg, video { max-width: 100%; height: auto; }`,
    `sup, sub { line-height: 0 !important; }`,
    `::selection { background: ${t.escuro ? "rgba(124, 192, 216, 0.35)" : "rgba(31, 96, 121, 0.22)"}; }`,
  ]
  if (t.escuro) partes.push(`img { filter: brightness(0.9) contrast(1.05); }`)
  if (fonte) partes.push(`body, body *:not(code):not(pre):not(kbd):not(samp):not(tt):not(svg):not(svg *) { font-family: ${fonte} !important; }`)
  if (a.paragrafos === "espaco") partes.push(`p:not(.item) { margin: 0 0 0.85em !important; text-indent: 0 !important; }`)
  if (a.paragrafos === "recuo")
    partes.push(
      `p:not(.item) { margin: 0 !important; text-indent: 1.4em !important; }`,
      `:is(h1, h2, h3, h4, h5, h6, figure, table, div.tabela, hr, blockquote) + p:not(.item), p:first-child, p.centro { text-indent: 0 !important; }`,
      `:is(h1, h2, h3, h4, h5, h6) + p, figure + p { margin-top: 0.4em !important; }`,
    )
  return partes.join("\n")
}
