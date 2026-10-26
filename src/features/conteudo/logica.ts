// As contas de Conteúdo e IA (testadas em tests/conteudo.test.cjs): prompts e seus campos, os módulos de um
// curso da Biblioteca (como "Dominando a IA") e os números do Planner.

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

/** Tira os blocos de código (os prompts) do markdown, com o título mais próximo acima de cada um. */
export function extrairPrompts(conteudo: string): { titulo: string; texto: string }[] {
  const saida: { titulo: string; texto: string }[] = []
  let titulo = ""
  let bloco: string[] | null = null
  let cerca = ""
  for (const linha of conteudo.split("\n")) {
    const crua = linha.trim()
    if (bloco) {
      if (crua.startsWith(cerca)) {
        const texto = bloco.join("\n").trim()
        if (texto.length >= 30) saida.push({ titulo, texto })
        bloco = null
      } else bloco.push(linha)
      continue
    }
    const abre = /^(`{3,}|~{3,})/.exec(crua)
    if (abre) {
      cerca = abre[1]
      bloco = []
      continue
    }
    const cab = /^#{1,6}\s+(.+)$/.exec(crua) ?? /^<summary>(.+)<\/summary>$/.exec(crua) ?? /^\*\*(.+)\*\*:?$/.exec(crua)
    if (cab) titulo = cab[1].replace(/<[^>]+>/g, "").replace(/\*\*/g, "").trim()
  }
  return saida
}

/** Um campo a preencher: [TÓPICO], [PÚBLICO-ALVO], {número}… (um link em markdown, [texto](url), não conta). */
const CAMPO = /\[([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 _\-/]{1,40})\](?!\()|\{([a-zà-ÿ][a-zà-ÿ0-9 _\-/]{1,40})\}/g

/** Os campos a preencher de um prompt, sem repetir, na ordem em que aparecem. */
export function camposDoPrompt(texto: string): string[] {
  return [...new Set([...texto.matchAll(new RegExp(CAMPO.source, "g"))].map((m) => m[0]))]
}

export function preencherPrompt(texto: string, valores: Record<string, string>): string {
  let saida = texto
  for (const [campo, valor] of Object.entries(valores)) if (valor.trim()) saida = saida.split(campo).join(valor.trim())
  return saida
}

/** O texto do prompt em pedaços, marcando os campos a preencher (para destacá-los na tela). */
export function partesDoPrompt(texto: string): { texto: string; campo: boolean }[] {
  const partes: { texto: string; campo: boolean }[] = []
  let ultimo = 0
  for (const m of texto.matchAll(new RegExp(CAMPO.source, "g"))) {
    const i = m.index ?? 0
    if (i > ultimo) partes.push({ texto: texto.slice(ultimo, i), campo: false })
    partes.push({ texto: m[0], campo: true })
    ultimo = i + m[0].length
  }
  if (ultimo < texto.length) partes.push({ texto: texto.slice(ultimo), campo: false })
  return partes
}

/* ------------------------------------------------------------------ */
/* Os módulos de um curso da Biblioteca                                */
/* ------------------------------------------------------------------ */

export type GrupoModulo = { titulo: string | null; ids: string[] }
export type Modulo = { titulo: string; numero: string | null; nome: string; grupos: GrupoModulo[]; ids: string[] }

const LINK_PAGINA = /\]\(\/paginas\/([0-9a-f-]{36})\)/gi

/** "MÓDULO 02 - COMO TIRAR O MÁXIMO DA IA" → número "02" e nome "COMO TIRAR O MÁXIMO DA IA". */
export function partesDoModulo(titulo: string): { numero: string | null; nome: string } {
  const m = /^m[óo]dulo\s*(\d+)\s*[-–—:.]?\s*(.*)$/i.exec(titulo.trim())
  return m ? { numero: m[1].padStart(2, "0"), nome: m[2].trim() || titulo.trim() } : { numero: null, nome: titulo.trim() }
}

/**
 * Os módulos de um curso, lidos do texto da página dele, como no Notion: cada callout (vira citação na
 * importação) tem um título em negrito com ícone ("> 🚀 **MÓDULO 01 - …**") e os links das aulas; dentro
 * dele, um título em negrito sem ícone ("> **VÍDEOS**") abre um grupo. As páginas citadas antes do
 * primeiro módulo ficam em `soltas`.
 */
export function modulosDoCurso(conteudo: string): { soltas: string[]; modulos: Modulo[] } {
  const soltas: string[] = []
  const modulos: Modulo[] = []
  const vistos = new Set<string>()
  let grupo: GrupoModulo | null = null
  for (const linha of conteudo.split("\n")) {
    const ids = [...linha.matchAll(new RegExp(LINK_PAGINA.source, "gi"))].map((m) => m[1].toLowerCase())
    if (ids.length) {
      for (const id of ids) {
        if (vistos.has(id)) continue
        vistos.add(id)
        if (grupo) {
          grupo.ids.push(id)
          modulos[modulos.length - 1].ids.push(id)
        } else soltas.push(id)
      }
      continue
    }
    const semCitacao = linha.replace(/^(\s*>\s?)+/, "").trim()
    const semImagem = semCitacao.replace(/<img\b[^>]*>/gi, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim()
    const comIcone = semImagem !== semCitacao || /^\p{Extended_Pictographic}/u.test(semImagem)
    const limpo = semImagem.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, "").trim()
    const titulo = /^#{1,6}\s+(.+)$/.exec(limpo)?.[1] ?? /^\*\*([^*]+)\*\*:?$/.exec(limpo)?.[1]
    if (!titulo) continue
    const texto = titulo.replace(/\*\*/g, "").replace(/<[^>]+>/g, "").trim()
    if (!texto) continue
    const ehCabecalho = /^#{1,6}\s/.test(limpo)
    if (ehCabecalho || comIcone || !modulos.length) {
      grupo = { titulo: null, ids: [] }
      modulos.push({ titulo: texto, ...partesDoModulo(texto), grupos: [grupo], ids: [] })
    } else {
      // Um título sem ícone dentro de um módulo: um grupo de aulas (ex.: VÍDEOS, SHORTS)
      grupo = { titulo: texto, ids: [] }
      modulos[modulos.length - 1].grupos.push(grupo)
    }
  }
  for (const m of modulos) m.grupos = m.grupos.filter((g) => g.ids.length)
  return { soltas, modulos: modulos.filter((m) => m.ids.length) }
}

/* ------------------------------------------------------------------ */
/* Planner                                                             */
/* ------------------------------------------------------------------ */

type ItemPlanner = { status: string; publish_date: string | null; views: number | null; likes: number | null; comments: number | null; shares: number | null }

/** As etapas do quadro de produção, depois do banco de ideias. */
export const ETAPAS_PRODUCAO = ["idealizando", "gravando", "editando", "finalizado", "publicado"] as const

function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number)
  const data = new Date(Date.UTC(a, m - 1, d + n))
  return data.toISOString().slice(0, 10)
}

/** Os números do planner: ideias, em produção, prontos, agendados para os próximos 7 dias, atrasados e publicados no mês. */
export function resumoDoPlanner(itens: ItemPlanner[], hoje: string) {
  const fimSemana = somarDias(hoje, 6)
  const mes = hoje.slice(0, 7)
  const ativo = (i: ItemPlanner) => i.status !== "ideia" && i.status !== "publicado"
  return {
    ideias: itens.filter((i) => i.status === "ideia").length,
    producao: itens.filter((i) => ["idealizando", "gravando", "editando"].includes(i.status)).length,
    prontos: itens.filter((i) => i.status === "finalizado").length,
    semana: itens.filter((i) => ativo(i) && i.publish_date && i.publish_date >= hoje && i.publish_date <= fimSemana).length,
    atrasados: itens.filter((i) => ativo(i) && i.publish_date && i.publish_date < hoje).length,
    publicadosMes: itens.filter((i) => i.status === "publicado" && i.publish_date?.startsWith(mes)).length,
  }
}

/** A situação da data de publicação de um conteúdo ainda não publicado. */
export function prazoDoConteudo(item: Pick<ItemPlanner, "status" | "publish_date">, hoje: string): "atrasado" | "hoje" | "breve" | null {
  if (!item.publish_date || item.status === "publicado" || item.status === "ideia") return null
  if (item.publish_date < hoje) return "atrasado"
  if (item.publish_date === hoje) return "hoje"
  return item.publish_date <= somarDias(hoje, 2) ? "breve" : null
}

/** Engajamento em %: curtidas, comentários e compartilhamentos sobre as visualizações. */
export function engajamento(i: ItemPlanner): number | null {
  if (!i.views) return null
  return (((i.likes ?? 0) + (i.comments ?? 0) + (i.shares ?? 0)) / i.views) * 100
}

/** O desempenho dos publicados: a lista (mais vistos primeiro), os totais, a média de engajamento e o melhor. */
export function desempenho<T extends ItemPlanner>(itens: T[]) {
  const lista = itens.filter((i) => i.status === "publicado" && (i.views || i.likes)).sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
  const engs = lista.map(engajamento).filter((e): e is number => e !== null)
  return {
    lista,
    visualizacoes: lista.reduce((s, i) => s + (i.views ?? 0), 0),
    curtidas: lista.reduce((s, i) => s + (i.likes ?? 0), 0),
    mediaEngajamento: engs.length ? engs.reduce((s, e) => s + e, 0) / engs.length : null,
    melhor: lista[0] ?? null,
    maximo: Math.max(1, ...lista.map((i) => i.views ?? 0)),
  }
}
