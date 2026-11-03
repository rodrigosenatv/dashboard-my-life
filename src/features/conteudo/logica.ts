// As contas de Conteúdo e IA (testadas em tests/conteudo.test.cjs): prompts e seus campos, os módulos de um
// curso da Biblioteca (como "Dominando a IA") e as regras do Planner (a esteira, o ritmo da semana, a reserva,
// os próximos passos, o desempenho por grupo e as novas versões de um conteúdo).

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

/* ------------------------------------------------------------------ */
/* Planner: a esteira, o ritmo da semana, a reserva e os próximos passos */
/* ------------------------------------------------------------------ */

/**
 * A meta de publicações por semana enquanto a pessoa não escolhe outra. No Instagram, o crescimento
 * aparece a partir de 3 a 5 posts por semana (Buffer, 2026); a constância pesa mais que o volume.
 */
export const META_SEMANAL_PADRAO = 3

/** A esteira, na ordem: do banco de ideias à publicação. */
export const ORDEM_ETAPAS = ["ideia", "idealizando", "gravando", "editando", "finalizado", "publicado"] as const
export type Etapa = (typeof ORDEM_ETAPAS)[number]

const EM_PRODUCAO = ["idealizando", "gravando", "editando"]

function semAcento(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

/** Formatos que não se gravam: carrossel, imagem e texto vão de Idealizando direto para Editando. */
const SEM_GRAVACAO = ["carrossel", "imagem", "texto"]

/** A etapa seguinte da esteira (null depois de publicado). */
export function proximaEtapa(status: string, formato?: string | null): Etapa | null {
  const i = ORDEM_ETAPAS.indexOf(status as Etapa)
  if (i < 0 || i === ORDEM_ETAPAS.length - 1) return null
  const proxima = ORDEM_ETAPAS[i + 1]
  if (proxima === "gravando" && formato && SEM_GRAVACAO.includes(semAcento(formato))) return "editando"
  return proxima
}

/**
 * Os campos ao marcar como publicado: sem data, ou com data no futuro (publicou antes do previsto),
 * a publicação fica com a data de hoje; com data passada, fica a data marcada.
 */
export function camposAoPublicar(item: { publish_date: string | null }, hoje: string) {
  return { status: "publicado" as const, publish_date: !item.publish_date || item.publish_date > hoje ? hoje : item.publish_date }
}

function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.split("-").map(Number)
  const [a2, m2, d2] = ate.split("-").map(Number)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000)
}

/** A segunda-feira da semana de um dia (AAAA-MM-DD). */
export function inicioDaSemana(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number)
  const semana = new Date(Date.UTC(a, m - 1, d)).getUTCDay()
  return somarDias(dia, -((semana + 6) % 7))
}

type ItemComId = ItemPlanner & { id: string }

/**
 * A semana de `hoje` (de segunda a domingo) contra a meta: quantos já saíram, quantos estão agendados
 * para os dias que faltam e o que cai em cada dia (as ideias não entram).
 */
export function ritmoDaSemana<T extends ItemComId>(itens: T[], hoje: string, meta: number) {
  const inicio = inicioDaSemana(hoje)
  const fim = somarDias(inicio, 6)
  const publicados = itens.filter((i) => i.status === "publicado" && i.publish_date && i.publish_date >= inicio && i.publish_date <= fim).length
  const agendados = itens.filter((i) => i.status !== "publicado" && i.status !== "ideia" && i.publish_date && i.publish_date >= hoje && i.publish_date <= fim).length
  const dias = Array.from({ length: 7 }, (_, n) => {
    const dia = somarDias(inicio, n)
    const doDia = itens
      .filter((i) => i.publish_date === dia && i.status !== "ideia")
      .sort((a, b) => ORDEM_ETAPAS.indexOf(b.status as Etapa) - ORDEM_ETAPAS.indexOf(a.status as Etapa))
    return { dia, hoje: dia === hoje, passou: dia < hoje, itens: doDia }
  })
  return { inicio, fim, meta, publicados, agendados, faltam: Math.max(0, meta - publicados - agendados), naMeta: publicados >= meta, dias }
}

/** Quantos saíram em cada uma das últimas `n` semanas (a última é a atual, ainda em andamento). */
export function historicoSemanas<T extends ItemPlanner>(itens: T[], hoje: string, n = 12): { inicio: string; publicados: number }[] {
  const atual = inicioDaSemana(hoje)
  const semanas = Array.from({ length: n }, (_, k) => ({ inicio: somarDias(atual, -7 * (n - 1 - k)), publicados: 0 }))
  const indice = new Map(semanas.map((s, k) => [s.inicio, k]))
  for (const i of itens) {
    if (i.status !== "publicado" || !i.publish_date) continue
    const k = indice.get(inicioDaSemana(i.publish_date))
    if (k !== undefined) semanas[k].publicados++
  }
  return semanas
}

/**
 * Semanas seguidas com pelo menos uma publicação: a constância que mais pesa no engajamento (no estudo
 * do Buffer com 100 mil perfis, quem publicou em 20 ou mais de 26 semanas teve cerca de 5x mais engajamento
 * por post do que quem publicou em 4 ou menos).
 * A semana atual só soma depois da primeira publicação; antes disso, ainda não quebra a sequência.
 */
export function semanasSeguidas<T extends ItemPlanner>(itens: T[], hoje: string): number {
  const comPost = new Set(itens.filter((i) => i.status === "publicado" && i.publish_date && i.publish_date <= hoje).map((i) => inicioDaSemana(i.publish_date!)))
  let semana = inicioDaSemana(hoje)
  let n = 0
  if (comPost.has(semana)) n = 1
  semana = somarDias(semana, -7)
  while (comPost.has(semana)) {
    n++
    semana = somarDias(semana, -7)
  }
  return n
}

/**
 * A reserva: os conteúdos prontos (Finalizado) e para quantos dias eles dão no ritmo da meta. Uma semana
 * de reserva (a meta inteira pronta) segura a constância numa semana corrida.
 */
export function reservaDeConteudo<T extends ItemPlanner>(itens: T[], meta: number) {
  const m = Math.max(1, meta)
  const prontos = itens.filter((i) => i.status === "finalizado").length
  const nivel: "vazia" | "baixa" | "boa" = prontos === 0 ? "vazia" : prontos < m ? "baixa" : "boa"
  return { prontos, dias: Math.floor((prontos * 7) / m), faltam: Math.max(0, m - prontos), nivel }
}

/** Há quantos dias um conteúdo em produção não muda (só a partir de 7 dias; `ultimaMudanca` é AAAA-MM-DD). */
export function diasParado(status: string, ultimaMudanca: string | null | undefined, hoje: string): number | null {
  if (!EM_PRODUCAO.includes(status) || !ultimaMudanca) return null
  const dias = diasEntre(ultimaMudanca.slice(0, 10), hoje)
  return dias >= 7 ? dias : null
}

export type Passo =
  /** Pronto, com a data de hoje ou já passada. */
  | { tipo: "publicar"; id: string; dia: string }
  /** Ainda em produção e a data já passou. */
  | { tipo: "atrasado"; id: string; dia: string }
  /** Em produção e sai em até 3 dias: hora de avançar. */
  | { tipo: "prazo"; id: string; dia: string; proxima: Etapa }
  /** Pronto, mas sem data. */
  | { tipo: "agendar"; id: string }
  /** Menos prontos que a meta de uma semana. */
  | { tipo: "reserva"; faltam: number; emProducao: number; ideias: number }
  /** Publicado há 7 a 60 dias sem os números (o mais recente, e quantos são ao todo). */
  | { tipo: "numeros"; id: string; dia: string; total: number }

/** O que fazer agora, do mais urgente ao menos. */
export function proximosPassos<T extends ItemComId & { format?: string | null }>(itens: T[], hoje: string, meta: number): Passo[] {
  const porData = (a: T, b: T) => (a.publish_date ?? "").localeCompare(b.publish_date ?? "")
  const prontos = itens.filter((i) => i.status === "finalizado")
  const producao = itens.filter((i) => EM_PRODUCAO.includes(i.status))
  const passos: Passo[] = []
  for (const i of prontos.filter((i) => i.publish_date && i.publish_date <= hoje).sort(porData)) passos.push({ tipo: "publicar", id: i.id, dia: i.publish_date! })
  for (const i of producao.filter((i) => i.publish_date && i.publish_date < hoje).sort(porData)) passos.push({ tipo: "atrasado", id: i.id, dia: i.publish_date! })
  const limite = somarDias(hoje, 3)
  for (const i of producao.filter((i) => i.publish_date && i.publish_date >= hoje && i.publish_date <= limite).sort(porData)) {
    const proxima = proximaEtapa(i.status, i.format)
    if (proxima) passos.push({ tipo: "prazo", id: i.id, dia: i.publish_date!, proxima })
  }
  for (const i of prontos.filter((i) => !i.publish_date)) passos.push({ tipo: "agendar", id: i.id })
  const reserva = reservaDeConteudo(itens, meta)
  if (reserva.nivel !== "boa") passos.push({ tipo: "reserva", faltam: reserva.faltam, emProducao: producao.length, ideias: itens.filter((i) => i.status === "ideia").length })
  const de = somarDias(hoje, -60)
  const ate = somarDias(hoje, -7)
  const semNumeros = itens
    .filter((i) => i.status === "publicado" && i.publish_date && i.publish_date >= de && i.publish_date <= ate && i.views == null)
    .sort((a, b) => porData(b, a))
  if (semNumeros.length) passos.push({ tipo: "numeros", id: semNumeros[0].id, dia: semNumeros[0].publish_date!, total: semNumeros.length })
  return passos
}

/** O desempenho dos publicados em grupos (por formato ou por linha editorial): os de mais visualizações primeiro. */
export function desempenhoPorGrupo<T extends ItemPlanner>(itens: T[], grupo: (i: T) => string | null | undefined) {
  const mapa = new Map<string, T[]>()
  for (const i of itens) {
    if (i.status !== "publicado" || !i.views) continue
    const g = grupo(i)
    if (!g) continue
    mapa.set(g, [...(mapa.get(g) ?? []), i])
  }
  return [...mapa]
    .map(([chave, lista]) => {
      const engs = lista.map(engajamento).filter((e): e is number => e !== null)
      return {
        chave,
        n: lista.length,
        mediaViews: lista.reduce((s, i) => s + (i.views ?? 0), 0) / lista.length,
        mediaEngajamento: engs.length ? engs.reduce((s, e) => s + e, 0) / engs.length : null,
      }
    })
    .sort((a, b) => b.mediaViews - a.mediaViews || b.n - a.n)
}

/**
 * Os que valem uma nova versão: publicados há 30 dias ou mais, com visualizações acima da mediana dos
 * publicados (o assunto já provou que funciona; a nova versão muda o formato, não copia).
 */
export function paraReaproveitar<T extends ItemPlanner>(itens: T[], hoje: string, limite = 3): T[] {
  const comViews = itens.filter((i) => i.status === "publicado" && i.views)
  if (!comViews.length) return []
  const ordenados = comViews.map((i) => i.views!).sort((a, b) => a - b)
  const mediana = ordenados[Math.floor((ordenados.length - 1) / 2)]
  const corte = somarDias(hoje, -30)
  return comViews
    .filter((i) => i.publish_date && i.publish_date <= corte && i.views! >= mediana)
    .sort((a, b) => b.views! - a.views!)
    .slice(0, limite)
}

/** O que muda ao levar o assunto para outro formato (vira uma lista para marcar no roteiro da nova versão). */
export const DICAS_DO_FORMATO: Record<string, string[]> = {
  "Reels/Shorts": ["Gancho nos 2 primeiros segundos, falado e escrito na tela", "Uma ideia só, em frases curtas", "Legenda na tela e a chamada para ação no fim"],
  Carrossel: ["Capa com o gancho em até 10 palavras", "Um ponto por slide, com até 30 palavras", "Último slide com a chamada para ação: salvar ou enviar para alguém"],
  Vídeo: ["Abra com o resultado ou a pergunta principal", "Divida em partes com títulos", "Separe trechos de 30 a 90 segundos para Reels e Shorts"],
  Stories: ["Um ponto por story", "Enquete ou caixa de perguntas para puxar respostas", "Figurinha de link para o post completo"],
  Imagem: ["Uma frase forte que se entende sem a legenda", "O contexto e a chamada para ação na legenda"],
  Texto: ["Gancho na primeira linha", "Parágrafos curtos, uma ideia em cada", "Termine com uma pergunta para puxar comentários"],
}

function dataBr(dia: string): string {
  const [a, m, d] = dia.split("-")
  return `${d}/${m}/${a}`
}

/** O roteiro inicial de uma nova versão: de onde veio, o que adaptar no formato novo e o material do original. */
export function roteiroReaproveitado(
  original: { title: string; format: string | null; publish_date: string | null; script: string | null },
  formato: string,
): string {
  const origem = [original.format, original.publish_date ? `publicado em ${dataBr(original.publish_date)}` : null].filter(Boolean).join(", ")
  const titulo = original.title.replace(/([*_`[\]])/g, "\\$1")
  const dicas = DICAS_DO_FORMATO[formato] ?? ["Adapte o gancho e o tamanho ao formato"]
  return [
    `> Nova versão de **${titulo}**${origem ? ` (${origem})` : ""}. Adapte, não copie: o mesmo assunto com a cara do formato.`,
    "",
    `## Para virar ${formato}`,
    "",
    ...dicas.map((d) => `- [ ] ${d}`),
    ...(original.script?.trim() ? ["", "---", "", "## Material do original", "", original.script.trim()] : []),
    "",
  ].join("\n")
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
