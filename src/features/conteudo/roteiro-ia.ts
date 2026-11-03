// O roteiro com IA do Planner (testado em tests/roteiro-ia.test.cjs): as partes do roteiro e o prompt de cada
// uma (configuráveis em Configurações), as lacunas a preencher, o pedido único que vai para a IA e a leitura da
// resposta, parte por parte, de volta para o roteiro. Sem dependências: roda igual no app e nos testes.

export type IdModeloRoteiro = "reels" | "carrossel"
/** "ia": o texto é o prompt que a IA segue; "fixo": o texto entra no roteiro como está (ex.: o checklist de revisão). */
export type TipoParte = "ia" | "fixo"
export type ParteRoteiro = { id: string; nome: string; tipo: TipoParte; texto: string; ativa: boolean }
export type ConfigRoteiroIA = {
  modelos: Record<IdModeloRoteiro, ParteRoteiro[]>
  /** Vale para todo pedido (o perfil, o tom de voz). */
  instrucoes: string
  /** Os últimos valores usados nas lacunas que não mudam a cada conteúdo ([NICHO], [PÚBLICO-ALVO]…). */
  lacunas: Record<string, string>
}

export const MODELOS_ROTEIRO: { id: IdModeloRoteiro; rotulo: string; formato: string }[] = [
  { id: "reels", rotulo: "Reels", formato: "Reels/Shorts" },
  { id: "carrossel", rotulo: "Carrossel", formato: "Carrossel" },
]

/** Carrossel e Imagem seguem o modelo de Carrossel; o resto (Reels, Vídeo, Stories, Texto), o de Reels. */
export function modeloDoFormato(formato: string | null | undefined): IdModeloRoteiro {
  const f = normal(formato ?? "")
  return f === "carrossel" || f === "imagem" ? "carrossel" : "reels"
}

/* ------------------------------------------------------------------ */
/* Os prompts padrão (dos modelos "[Reels] Viral Canva" e "[Carrossel] */
/* Viral Canva" do Notion, ajustados para virar o texto final)         */
/* ------------------------------------------------------------------ */

const ESTILOS_TITULO = "headline provocativa, manchete de capa de revista, com números ou estatísticas, com promessa e com pergunta"

const LEGENDA = `Escreva a legenda do post: 220 palavras de um artigo explicativo sobre o tópico [TÓPICO].

Use um estilo informal e direto, com frases e parágrafos curtos e alguns emojis. Prenda a atenção do início ao fim com perguntas e frases de ligação em cada parágrafo. Comece mergulhando direto no assunto, sem introdução.

No final, faça um CTA para deixar um comentário com a palavra [PALAVRA-CHAVE].`

const HASHTAGS = "Liste 25 hashtags de alta qualidade e em alta no Instagram para a legenda acima, numa linha só, separadas por espaço."

const REVISAO = `> Use o máximo possível de leis do Código Viral para aumentar o potencial do conteúdo.

**Qualitativo**

- [ ] O Homem
- [ ] O Nicho
- [ ] O Funil
- [ ] O Tempo
- [ ] O Timing

**Otimização**

- [ ] O Gancho
- [ ] O CTA
- [ ] O Áudio em alta
- [ ] O Algoritmo
- [ ] O Título
- [ ] O 3 em 1`

const ia = (id: string, nome: string, texto: string): ParteRoteiro => ({ id, nome, tipo: "ia", texto, ativa: true })

const PADRAO: Record<IdModeloRoteiro, ParteRoteiro[]> = {
  reels: [
    ia(
      "titulo",
      "Título",
      `Crie o título que vai escrito no vídeo sobre o tópico [TÓPICO]: curto (menos de 10 palavras), provocativo e intrigante, que desperte curiosidade, interesse e desejo. Escreva o melhor título na primeira linha. Depois, em lista, mais 5 opções, uma em cada estilo: ${ESTILOS_TITULO}.`,
    ),
    ia(
      "gancho",
      "Gancho",
      `Escreva o gancho dos 2 primeiros segundos do vídeo, a frase que hipnotiza a audiência, para um perfil sobre [NICHO]. Use como base estes modelos, preenchendo o que está entre chaves e adaptando ao tópico:

1. {número} estratégias comprovadas para {objetivo} que todos podem usar.
2. Como {ação ou habilidade} pode transformar sua {área da vida}.
3. A verdade surpreendente sobre {tópico} revelada.
4. {número} mitos comuns sobre {tópico} desmascarados.
5. Por que {ação ou estratégia} é a chave para {resultado}.

Entregue o melhor gancho primeiro e, abaixo, mais 2 opções.`,
    ),
    ia(
      "desenvolvimento",
      "Desenvolvimento",
      "Escreva o roteiro falado de um vídeo tutorial sobre [TÓPICO], com cerca de 300 palavras. Faça o início muito impactante: não se apresente e mergulhe direto no conteúdo com uma afirmação ousada e provocativa. Tom informal, estilo intelectual, direto e prático. Direto ao ponto: uma frase do vídeo em cada linha.",
    ),
    ia(
      "cta",
      "Call to action",
      "Escreva a chamada para ação do fim do vídeo. Não faça a audiência raciocinar: entregue duas opções ou peça um comentário com a palavra [PALAVRA-CHAVE].",
    ),
    ia("legenda", "Legenda", LEGENDA),
    ia("hashtags", "Hashtags", HASHTAGS),
    ia("elementos", "Elementos e cenas", "Crie uma lista de ideias de elementos, cenas e takes que sejam relevantes para este vídeo."),
    ia(
      "capa",
      "Capa no Ideogram",
      "Escreva, em inglês, o prompt para criar a capa no Ideogram (ideogram.ai): uma ilustração 3D em estilo fotorrealista, visualmente cativante, do elemento ou objeto principal deste conteúdo, com um toque minimalista e atmosfera futurista.",
    ),
    ia(
      "checklist",
      "Checklist",
      'Monte o checklist de produção deste vídeo, do que preparar até publicar (roteiro, gravação, edição e publicação), em itens curtos e específicos deste conteúdo, no formato "- [ ] item".',
    ),
    { id: "revisao", nome: "Checklist de revisão", tipo: "fixo", texto: REVISAO, ativa: true },
  ],
  carrossel: [
    ia(
      "titulo",
      "Título para a capa",
      `Crie o título da capa do carrossel sobre o tópico [TÓPICO]: curto (menos de 10 palavras), provocativo e intrigante, que desperte curiosidade, interesse e desejo. Escreva o melhor título na primeira linha. Depois, em lista, mais 5 opções, uma em cada estilo: ${ESTILOS_TITULO}.`,
    ),
    ia(
      "slides",
      "Slides",
      "Escreva o texto de um carrossel de 7 slides para Instagram sobre [TÓPICO]. O slide 1 é a capa com o título; os slides 2 a 6 desenvolvem um ponto cada, com no máximo 30 palavras por slide; o slide 7 traz a conclusão e o CTA. Linguagem simples, direta e envolvente. Comece cada slide por **Slide N:**, numa linha nova.",
    ),
    ia(
      "cta",
      "Call to action",
      "Escreva a chamada para ação do último slide. Não faça a audiência raciocinar: entregue duas opções (como salvar ou enviar para alguém) ou peça um comentário com a palavra [PALAVRA-CHAVE].",
    ),
    ia("elementos", "Elementos e imagens", "Sugira elementos visuais, ícones e imagens para cada slide do carrossel acima, mantendo uma identidade visual coesa."),
    ia("legenda", "Legenda", LEGENDA),
    ia("hashtags", "Hashtags", HASHTAGS),
    ia(
      "capa",
      "Imagens no Ideogram",
      "Escreva, em inglês, o prompt para criar as imagens no Ideogram (ideogram.ai): uma ilustração 3D em estilo fotorrealista, visualmente cativante, do elemento ou objeto principal deste conteúdo, com um toque minimalista e atmosfera futurista.",
    ),
    ia(
      "checklist",
      "Checklist",
      'Monte o checklist de produção deste carrossel, do que preparar até publicar (texto, artes, revisão e publicação), em itens curtos e específicos deste conteúdo, no formato "- [ ] item".',
    ),
    { id: "revisao", nome: "Checklist de revisão", tipo: "fixo", texto: REVISAO, ativa: true },
  ],
}

/** As partes padrão de um modelo (uma cópia: pode ser mudada à vontade). */
export function partesPadrao(modelo: IdModeloRoteiro): ParteRoteiro[] {
  return PADRAO[modelo].map((p) => ({ ...p }))
}

/* ------------------------------------------------------------------ */
/* A configuração guardada (settings.prefs.roteiroIA)                  */
/* ------------------------------------------------------------------ */

export const LIMITE_PARTES = 20
const LIMITE_TEXTO = 4000
const LIMITE_NOME = 60
const LIMITE_VALOR = 300

function lerParte(v: unknown, i: number): ParteRoteiro | null {
  if (!v || typeof v !== "object") return null
  const o = v as Record<string, unknown>
  const texto = typeof o.texto === "string" ? o.texto.slice(0, LIMITE_TEXTO) : ""
  const nome = typeof o.nome === "string" ? o.nome.replace(/\s+/g, " ").trim().slice(0, LIMITE_NOME) : ""
  if (!nome && !texto.trim()) return null
  return {
    id: typeof o.id === "string" && o.id.trim() ? o.id.trim().slice(0, 40) : `parte-${i + 1}`,
    nome: nome || `Parte ${i + 1}`,
    tipo: o.tipo === "fixo" ? "fixo" : "ia",
    texto,
    ativa: o.ativa !== false,
  }
}

function semIdsRepetidos(partes: ParteRoteiro[]): ParteRoteiro[] {
  const vistos = new Set<string>()
  return partes.map((p) => {
    let id = p.id
    for (let n = 2; vistos.has(id); n++) id = `${p.id}-${n}`
    vistos.add(id)
    return id === p.id ? p : { ...p, id }
  })
}

/** Lê o que está guardado; o que faltar ou vier quebrado volta ao padrão. */
export function lerConfigRoteiro(v: unknown): ConfigRoteiroIA {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {}
  const salvos = o.modelos && typeof o.modelos === "object" ? (o.modelos as Record<string, unknown>) : {}
  const modelos = {} as Record<IdModeloRoteiro, ParteRoteiro[]>
  for (const m of MODELOS_ROTEIRO) {
    const lista = Array.isArray(salvos[m.id])
      ? (salvos[m.id] as unknown[])
          .slice(0, LIMITE_PARTES)
          .map(lerParte)
          .filter((p): p is ParteRoteiro => p !== null)
      : []
    modelos[m.id] = lista.length ? semIdsRepetidos(lista) : partesPadrao(m.id)
  }
  const lacunas: Record<string, string> = {}
  if (o.lacunas && typeof o.lacunas === "object") {
    for (const [k, valor] of Object.entries(o.lacunas as Record<string, unknown>)) {
      if (LACUNA_INTEIRA.test(k) && typeof valor === "string" && valor.trim()) lacunas[k] = valor.trim().slice(0, LIMITE_VALOR)
    }
  }
  return { modelos, instrucoes: typeof o.instrucoes === "string" ? o.instrucoes.slice(0, LIMITE_TEXTO) : "", lacunas }
}

const chaveDasPartes = (partes: ParteRoteiro[]) => JSON.stringify(partes.map((p) => [p.id, p.nome.trim(), p.tipo, p.texto.trim(), p.ativa]))

export function igualAoPadrao(modelo: IdModeloRoteiro, partes: ParteRoteiro[]): boolean {
  return chaveDasPartes(partes) === chaveDasPartes(PADRAO[modelo])
}

/**
 * O que vai para settings.prefs.roteiroIA. Um modelo igual ao padrão não é gravado: assim ele acompanha
 * as melhorias dos prompts padrão, e "Restaurar o padrão" é só deixar de gravar.
 */
export function configParaSalvar(c: ConfigRoteiroIA) {
  const modelos: Partial<Record<IdModeloRoteiro, ParteRoteiro[]>> = {}
  for (const m of MODELOS_ROTEIRO) {
    const partes = c.modelos[m.id]
    if (partes?.length && !igualAoPadrao(m.id, partes)) {
      modelos[m.id] = partes.slice(0, LIMITE_PARTES).map((p, i) => ({
        id: p.id,
        nome: p.nome.replace(/\s+/g, " ").trim().slice(0, LIMITE_NOME) || `Parte ${i + 1}`,
        tipo: p.tipo,
        texto: p.texto.slice(0, LIMITE_TEXTO),
        ativa: p.ativa,
      }))
    }
  }
  const lacunas: Record<string, string> = {}
  for (const [k, v] of Object.entries(c.lacunas)) if (LACUNA_INTEIRA.test(k) && v.trim()) lacunas[k] = v.trim().slice(0, LIMITE_VALOR)
  return { modelos, instrucoes: c.instrucoes.trim().slice(0, LIMITE_TEXTO), lacunas }
}

export function mesmaConfig(a: ConfigRoteiroIA, b: ConfigRoteiroIA): boolean {
  return JSON.stringify(configParaSalvar(a)) === JSON.stringify(configParaSalvar(b))
}

/* ------------------------------------------------------------------ */
/* Lacunas: [TÓPICO], [NICHO]… (o que está entre chaves fica para a IA) */
/* ------------------------------------------------------------------ */

// Colchetes como os campos da biblioteca de prompts; um link em markdown, [texto](url), não conta.
const LACUNA = /\[([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 _\-/]{1,40})\](?!\()/g
const LACUNA_INTEIRA = /^\[[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 _\-/]{1,40}\]$/

/** As lacunas dos textos, sem repetir, na ordem em que aparecem. */
export function lacunasDe(textos: string[]): string[] {
  const vistas = new Set<string>()
  for (const t of textos) for (const m of t.matchAll(new RegExp(LACUNA.source, "g"))) vistas.add(m[0])
  return [...vistas]
}

/** As lacunas a preencher antes de gerar: as das partes ligadas e das instruções gerais. */
export function lacunasDoModelo(partes: ParteRoteiro[], instrucoes = ""): string[] {
  return lacunasDe([instrucoes, ...partes.filter((p) => p.ativa).map((p) => p.texto)])
}

/** A lacuna do assunto do conteúdo: vazia, vale o título. */
export function ehLacunaDoTopico(lacuna: string): boolean {
  return ["topico", "assunto", "tema"].includes(normal(lacuna))
}

/** "[PÚBLICO-ALVO]" → "Público-alvo". */
export function rotuloDaLacuna(lacuna: string): string {
  const t = lacuna.replace(/^\[|\]$/g, "").trim().toLocaleLowerCase("pt-BR")
  return t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1)
}

export function preencherLacunas(texto: string, valores: Record<string, string>): string {
  let saida = texto
  for (const [lacuna, valor] of Object.entries(valores)) if (valor.trim()) saida = saida.split(lacuna).join(valor.trim())
  return saida
}

/* ------------------------------------------------------------------ */
/* O pedido: todas as partes de IA num pedido só                       */
/* ------------------------------------------------------------------ */

export type ContextoConteudo = { titulo?: string; formato?: string; plataformas?: string[]; linha?: string | null }

/** A parte que dá o título do conteúdo: a primeira de IA que se chama "Título…". */
export function ehParteDoTitulo(p: Pick<ParteRoteiro, "nome" | "tipo">): boolean {
  return p.tipo === "ia" && normal(p.nome).startsWith("titulo")
}

/**
 * Um pedido só, com todas as partes de IA ligadas, na ordem: a IA escreve tudo de uma vez, coerente do título ao
 * checklist (e o "acima" de um prompt, como nas hashtags, encontra a legenda que ela acabou de escrever). Gasta um
 * pedido da cota, não um por parte.
 */
export function montarPedido(
  partes: ParteRoteiro[],
  valores: Record<string, string>,
  contexto: ContextoConteudo = {},
  instrucoes = "",
): { texto: string; partesIA: ParteRoteiro[] } {
  const partesIA = partes.filter((p) => p.ativa && p.tipo === "ia")
  if (!partesIA.length) return { texto: "", partesIA }
  const sobre = [
    contexto.formato ? `- Formato: ${contexto.formato}` : null,
    contexto.plataformas?.length ? `- Plataformas: ${contexto.plataformas.join(", ")}` : null,
    contexto.linha ? `- Linha editorial: ${contexto.linha}` : null,
    contexto.titulo?.trim() ? `- Título provisório: ${contexto.titulo.trim()}` : null,
  ].filter(Boolean)
  const gerais = preencherLacunas(instrucoes, valores).trim()
  const pedidos = partesIA.map((p, i) => {
    const texto = preencherLacunas(p.texto, valores).trim() || `Escreva a parte "${p.nome}" do roteiro.`
    return `<parte numero="${i + 1}" nome="${p.nome.replace(/"/g, "'")}">\n${texto}\n</parte>`
  })
  const titulo = partesIA.findIndex(ehParteDoTitulo)
  const regras = [
    "- Responda em português do Brasil, a não ser que um pedido indique outro idioma.",
    `- Responda às ${partesIA.length} partes, na ordem, e só a elas. Comece cada parte com uma linha só com "### ", o número e o nome dela, assim: "### 1. ${partesIA[0].nome}". Não use "###" em nenhum outro lugar.`,
    "- Escreva direto o texto final de cada parte, pronto para usar: sem introdução, sem comentar o pedido e sem repeti-lo.",
    '- Mantenha tudo coerente: o mesmo assunto, a mesma promessa e o mesmo tom em todas as partes. Quando um pedido falar no que está "acima", use o que você escreveu nas partes anteriores.',
    "- Se sobrou alguma lacuna entre colchetes sem preencher (como [NICHO]), deduza pelo contexto.",
    titulo >= 0 ? `- Na parte ${titulo + 1} (${partesIA[titulo].nome}), a primeira linha é só o título escolhido: sem aspas, sem numeração e sem negrito.` : null,
  ].filter(Boolean)
  const texto = [
    `Escreva o roteiro de um conteúdo para redes sociais, em ${partesIA.length} ${partesIA.length === 1 ? "parte" : "partes"}, seguindo o pedido de cada uma.`,
    sobre.length ? `## O conteúdo\n${sobre.join("\n")}` : null,
    gerais ? `## Instruções gerais\n${gerais}` : null,
    `## Os pedidos\n\n${pedidos.join("\n\n")}`,
    `## Como responder\n${regras.join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n")
  return { texto, partesIA }
}

/* ------------------------------------------------------------------ */
/* A resposta: de volta, parte por parte (também enquanto ela chega)   */
/* ------------------------------------------------------------------ */

const MARCA_ERRO = "[Não foi possível concluir a resposta:"

/** O servidor avisa no fim do texto quando a resposta para no meio; separa o aviso do que chegou. */
export function separarErro(texto: string): { texto: string; erro: string | null } {
  const i = texto.lastIndexOf(MARCA_ERRO)
  if (i < 0) return { texto, erro: null }
  const erro = texto.slice(i + MARCA_ERRO.length).replace(/\]\s*$/, "").trim()
  return { texto: texto.slice(0, i).trimEnd(), erro: erro || "a resposta parou no meio." }
}

/**
 * Enquanto a resposta chega, a última linha pode ser um título pela metade ("### 4. Le"): até a quebra de linha,
 * ela fica de fora, para o texto não piscar na parte anterior.
 */
export function semLinhaIncompleta(texto: string): string {
  const i = texto.lastIndexOf("\n")
  const ultima = texto.slice(i + 1)
  return /^\s*[#*]/.test(ultima) ? texto.slice(0, Math.max(0, i)) : texto
}

export type Leitura = {
  /** O texto de cada parte pedida à IA, na ordem do pedido (null: não chegou). */
  conteudos: (string | null)[]
  /** A parte que está sendo escrita (-1: nenhuma começou). */
  atual: number
}

function normal(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** "Capa (prompt para o Ideogram)" parece "Capa no Ideogram"; "Checklist" parece "Checklist de produção". */
function pareceNome(cabecalho: string, nome: string): boolean {
  const a = normal(cabecalho)
  const b = normal(nome)
  if (!a || !b) return false
  if (a === b || (b.length >= 4 && a.startsWith(b)) || (a.length >= 4 && b.startsWith(a))) return true
  const primeira = b.split(" ").find((w) => w.length >= 4)
  return primeira ? a.split(" ").includes(primeira) : false
}

const CABECALHO = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/
const NEGRITO_NUMERADO = /^\s*\*\*\s*(\d{1,2})\s*[.)\-–—:]\s*(.+?)\s*:?\s*\*\*\s*:?\s*$/
const NUMERO = /^(\d{1,2})(?:\s*[.)\-–—:]\s*|\s+|$)(.*)$/

type Cabecalho = { nivel: number; numero: number | null; nome: string; negrito: boolean }

/** Um título ("### 2. Gancho") ou um negrito numerado ("**2. Gancho**") na linha. */
function lerCabecalho(linha: string): Cabecalho | null {
  const cab = CABECALHO.exec(linha)
  if (cab) {
    const texto = cab[2].replace(/\*\*|__/g, "").replace(/^parte\s+/i, "").trim()
    const n = NUMERO.exec(texto)
    return n ? { nivel: cab[1].length, numero: Number(n[1]), nome: n[2].trim(), negrito: false } : { nivel: cab[1].length, numero: null, nome: texto, negrito: false }
  }
  const b = NEGRITO_NUMERADO.exec(linha)
  return b ? { nivel: 0, numero: Number(b[1]), nome: b[2].trim(), negrito: true } : null
}

/** O título nomeia a parte k (pelo número com o nome dela, ou só pelo nome). */
function nomeiaParte(c: Cabecalho, k: number, partes: { nome: string }[]): boolean {
  if (c.numero !== null) return c.numero - 1 === k && ((!c.nome && !c.negrito) || pareceNome(c.nome, partes[k].nome))
  return !c.negrito && pareceNome(c.nome, partes[k].nome)
}

/**
 * Se a linha abre uma parte, qual. As partes vêm em ordem, então só vale uma parte depois da atual: um "1." dentro
 * dos slides não volta para o título. `nomeadas` são as partes que têm um título com o nome delas em algum lugar.
 */
function parteDaLinha(linha: string, partes: { nome: string }[], atual: number, nomeadas: Set<number>): number | null {
  const c = lerCabecalho(linha)
  if (!c) return null
  if (c.numero === null) {
    for (let k = atual + 1; k < partes.length; k++) if (nomeiaParte(c, k, partes)) return k
    return null
  }
  const k = c.numero - 1
  if (k <= atual || k >= partes.length) return null
  if (nomeiaParte(c, k, partes)) return k
  // A IA mudou o nome ("### 4. CTA"): vale se é a próxima, veio no formato pedido e a parte não aparece com o
  // nome dela mais adiante (aí este era só um título dentro da parte atual)
  return !c.negrito && c.nivel === 3 && k === atual + 1 && !nomeadas.has(k) ? k : null
}

/** As linhas fora dos blocos de código (dentro deles, nada vira parte nova). */
function* linhasForaDeBlocos(linhas: string[]): Generator<{ linha: string; fora: boolean }> {
  let cerca: string | null = null
  for (const linha of linhas) {
    const crua = linha.trim()
    if (cerca) {
      if (crua.startsWith(cerca)) cerca = null
      yield { linha, fora: false }
      continue
    }
    const abre = /^(`{3,}|~{3,})/.exec(crua)
    if (abre) {
      cerca = abre[1]
      yield { linha, fora: false }
      continue
    }
    yield { linha, fora: true }
  }
}

// Lista, citação, título, tabela ou bloco de código: linhas que o markdown já separa sozinho
const LINHA_DE_BLOCO = /^\s*(?:[-*+]\s|\d{1,3}[.)]\s|>|#{1,6}\s|\||`{3,}|~{3,})/

/**
 * No markdown, linhas seguidas viram um parágrafo só. O roteiro é escrito "uma frase em cada linha" (e os slides,
 * um por linha): cada linha de texto ganha o próprio parágrafo, para continuar uma por linha ao ler e ao gravar.
 */
function umaLinhaPorParagrafo(linhas: string[]): string[] {
  const comum = (l: string | undefined) => l !== undefined && l.trim() !== "" && !LINHA_DE_BLOCO.test(l) && !/^\s{4,}/.test(l)
  const saida: string[] = []
  let cerca: string | null = null
  linhas.forEach((linha, i) => {
    saida.push(linha)
    const crua = linha.trim()
    if (cerca) {
      if (crua.startsWith(cerca)) cerca = null
      return
    }
    const abre = /^(`{3,}|~{3,})/.exec(crua)
    if (abre) return void (cerca = abre[1])
    // Quem terminou a linha com quebra forçada ("  " ou "\") já escolheu ficar no mesmo parágrafo
    if (comum(linha) && comum(linhas[i + 1]) && !/(?: {2}|\\)$/.test(linha)) saida.push("")
  })
  return saida
}

function limparParte(linhas: string[]): string {
  return umaLinhaPorParagrafo(linhas)
    .join("\n")
    .replace(/(\n\s*(?:-{3,}|\*{3,}|_{3,})\s*)+$/, "")
    .trim()
}

/** Separa a resposta nas partes pedidas (`partes` são as de IA, na ordem do pedido). */
export function lerResposta(texto: string, partes: { nome: string }[]): Leitura {
  const conteudos: (string[] | null)[] = partes.map(() => null)
  let atual = -1
  let linhas = texto.replace(/\r\n?/g, "\n").split("\n")
  // A resposta inteira dentro de um bloco de código (```markdown … ```)
  const primeira = linhas.findIndex((l) => l.trim())
  if (primeira >= 0 && /^(?:`{3,}|~{3,})\s*(?:markdown|md)?\s*$/i.test(linhas[primeira].trim())) {
    linhas = linhas.slice(primeira + 1)
    let ultima = linhas.length - 1
    while (ultima >= 0 && !linhas[ultima].trim()) ultima--
    if (ultima >= 0 && /^(?:`{3,}|~{3,})\s*$/.test(linhas[ultima].trim())) linhas = linhas.slice(0, ultima)
  }
  const nomeadas = new Set<number>()
  for (const { linha, fora } of linhasForaDeBlocos(linhas)) {
    const c = fora ? lerCabecalho(linha) : null
    if (c) partes.forEach((_, k) => nomeiaParte(c, k, partes) && nomeadas.add(k))
  }
  for (const { linha, fora } of linhasForaDeBlocos(linhas)) {
    // Dentro de um bloco de código da parte (ex.: o prompt da capa), a linha é só texto
    if (!fora) {
      if (atual >= 0) conteudos[atual]!.push(linha)
      continue
    }
    const k = parteDaLinha(linha, partes, atual, nomeadas)
    if (k !== null) {
      atual = k
      conteudos[k] = []
      continue
    }
    // Antes da primeira parte: uma introdução que a IA não devia ter escrito
    if (atual < 0) continue
    // No roteiro, cada parte é um "##": um título de nível 1 ou 2 dentro dela desce para o 3
    conteudos[atual]!.push(linha.replace(/^\s{0,3}#{1,2}(?=\s)/, "###"))
  }
  return { conteudos: conteudos.map((l) => (l ? limparParte(l) : null)), atual }
}

/** O título escolhido: a primeira linha da parte do título, sem marcação, aspas nem "Título:". */
export function tituloEscolhido(conteudo: string | null | undefined): string | null {
  if (!conteudo) return null
  const linha = conteudo
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !/^(?:`{3,}|~{3,}|-{3,})/.test(l))
  if (!linha) return null
  let t = linha
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s*/, "")
    .replace(/^(?:[-*+•]\s+|\d{1,2}[.)]\s+)/, "")
    .replace(/\*\*|__/g, "")
    .trim()
  t = t.replace(/^(?:(?:o\s+)?melhor\s+)?t[íi]tulo(?:\s+(?:escolhido|principal|sugerido|final))?\s*:\s*/i, "")
  t = t.replace(/([*_])([^*_\n]+)\1/g, "$2").replace(/^[*_]+|[*_]+$/g, "").trim()
  t = t.replace(/^["“”«»'‘’]+|["“”«»'‘’]+$/g, "").trim()
  if (!t) return null
  return t.length > 160 ? `${t.slice(0, 159).trimEnd()}…` : t
}

export const AVISO_PARTE_VAZIA = "_A IA não escreveu esta parte. Gere de novo ou escreva aqui._"

/**
 * O roteiro: cada parte ligada vira um "## Nome" com o texto da IA ou o texto fixo, na ordem do modelo.
 * Com `parcial` (a resposta ainda chegando), vai só até a parte que está sendo escrita. Sem nenhuma parte
 * reconhecida no fim, o texto inteiro (`bruto`) entra numa parte só, para nada se perder.
 */
export function montarRoteiro(
  partes: ParteRoteiro[],
  leitura: Leitura | null,
  valores: Record<string, string>,
  { parcial = false, bruto = "" }: { parcial?: boolean; bruto?: string } = {},
): string {
  const ativas = partes.filter((p) => p.ativa)
  const partesIA = ativas.filter((p) => p.tipo === "ia")
  const fixa = (p: ParteRoteiro) => {
    const t = preencherLacunas(p.texto, valores).trim()
    return t ? `## ${p.nome}\n\n${t}` : `## ${p.nome}`
  }
  if (!parcial && partesIA.length && (!leitura || leitura.atual < 0)) {
    const t = bruto.trim()
    return [t ? `## Roteiro\n\n${t}` : null, ...ativas.filter((p) => p.tipo === "fixo").map(fixa)].filter(Boolean).join("\n\n") + "\n"
  }
  const atual = leitura && leitura.atual >= 0 ? partesIA[leitura.atual] : null
  const limite = parcial ? (atual ? ativas.indexOf(atual) : -1) : ativas.length - 1
  const blocos: string[] = []
  ativas.forEach((p, i) => {
    if (i > limite) return
    if (p.tipo === "fixo") return void blocos.push(fixa(p))
    const c = leitura?.conteudos[partesIA.indexOf(p)] ?? null
    if (c) blocos.push(`## ${p.nome}\n\n${c}`)
    else if (!parcial) blocos.push(`## ${p.nome}\n\n${AVISO_PARTE_VAZIA}`)
    else if (c === "") blocos.push(`## ${p.nome}`)
  })
  return blocos.length ? `${blocos.join("\n\n")}\n` : ""
}

/** As partes de IA que ficaram sem texto (para avisar no fim). */
export function partesSemResposta(partesIA: ParteRoteiro[], leitura: Leitura | null): string[] {
  return partesIA.filter((_, i) => !leitura?.conteudos[i]).map((p) => p.nome)
}
