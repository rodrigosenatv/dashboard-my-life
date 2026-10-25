/*
 * As regras do Laboratório, sem React (testadas em tests/laboratorio.test.cjs): em que dia do teste a
 * pessoa está, os grupos da tela, o protocolo escrito nas anotações (objetivo, procedimento, resultado,
 * aprendizados e conclusão, como no modelo do Notion) e a conclusão gravada nele.
 */

import type { Tables } from "@/lib/supabase/database.types"

export type Experimento = Tables<"experiments">
export type Insight = Tables<"insights">
export type StatusExp = "a_iniciar" | "em_teste" | "pausado" | "concluido" | "abandonado"
export type ResultadoExp = "indefinido" | "funcionou" | "parcial" | "nao_funcionou"

export const STATUS_EXP: Record<StatusExp, string> = {
  a_iniciar: "A iniciar",
  em_teste: "Em teste",
  pausado: "Pausado",
  concluido: "Concluído",
  abandonado: "Abandonado",
}
export const RESULTADOS: Record<ResultadoExp, string> = {
  indefinido: "Indefinido",
  funcionou: "Funcionou",
  parcial: "Parcial",
  nao_funcionou: "Não funcionou",
}
export const TIPOS = ["Hábito", "Técnica", "Ferramenta", "Processo", "Metodologia", "Ideia", "Projeto curto"]
export const DURACOES = [3, 7, 14, 21, 30]

export function statusDo(e: Pick<Experimento, "status">): StatusExp {
  return (e.status in STATUS_EXP ? e.status : "a_iniciar") as StatusExp
}
export function resultadoDo(e: Pick<Experimento, "result">): ResultadoExp {
  return (e.result && e.result in RESULTADOS ? e.result : "indefinido") as ResultadoExp
}

/* ------------------------------------------------------------------ */
/* Datas                                                               */
/* ------------------------------------------------------------------ */

/** AAAA-MM-DD de um dia (no fuso do aparelho). */
export function diaIso(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${dd}`
}

const meioDia = (dia: string) => new Date(`${dia}T12:00:00`)

export function somarDias(dia: string, n: number): string {
  const d = meioDia(dia)
  d.setDate(d.getDate() + n)
  return diaIso(d)
}

/** Dias de `a` até `b` (b - a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((meioDia(b).getTime() - meioDia(a).getTime()) / 86_400_000)
}

export type Andamento = {
  /** Dia do teste (1 = o primeiro); 0 antes de começar. */
  dia: number
  /** Quantos dias o teste dura (null sem data de fim). */
  total: number | null
  /** Dias que faltam depois de hoje (null sem fim). */
  restam: number | null
  /** O prazo já passou (e o experimento ainda não foi concluído). */
  passou: boolean
  /** Ainda não começou (começa num dia futuro). */
  antes: boolean
}

/** Em que dia do teste a pessoa está. */
export function andamento(e: Pick<Experimento, "starts_on" | "ends_on">, hoje: string): Andamento {
  const inicio = e.starts_on
  const total = inicio && e.ends_on ? Math.max(1, diasEntre(inicio, e.ends_on) + 1) : null
  if (!inicio) return { dia: 0, total, restam: null, passou: false, antes: true }
  const dia = diasEntre(inicio, hoje) + 1
  if (dia < 1) return { dia: 0, total, restam: total, passou: false, antes: true }
  const restam = e.ends_on ? Math.max(0, diasEntre(hoje, e.ends_on)) : null
  const passou = Boolean(e.ends_on && hoje > e.ends_on)
  return { dia: total ? Math.min(dia, total) : dia, total, restam, passou, antes: false }
}

/** Quantos dias o experimento durou (do início ao fim). */
export function duracaoDe(e: Pick<Experimento, "starts_on" | "ends_on">): number | null {
  return e.starts_on && e.ends_on ? Math.max(1, diasEntre(e.starts_on, e.ends_on) + 1) : null
}

/** Os dias do teste até hoje (ou até o fim), para a faixa de dias. */
export function diasDoTeste(e: Pick<Experimento, "starts_on" | "ends_on">, hoje: string, maximo = 31): string[] {
  if (!e.starts_on) return []
  // Com data de fim, todos os dias do teste (os que ainda vêm ficam apagados); sem ela, até hoje
  const ultimo = e.ends_on ?? hoje
  const n = Math.min(maximo, Math.max(0, diasEntre(e.starts_on, ultimo) + 1))
  return Array.from({ length: n }, (_, i) => somarDias(e.starts_on!, i))
}

/* ------------------------------------------------------------------ */
/* A tela                                                              */
/* ------------------------------------------------------------------ */

const recente = (a: Pick<Experimento, "updated_at">, b: Pick<Experimento, "updated_at">) => b.updated_at.localeCompare(a.updated_at)

/** Os experimentos de cada situação, na ordem da tela. */
export function porStatus<E extends Pick<Experimento, "status" | "starts_on" | "ends_on" | "updated_at" | "created_at">>(lista: E[]): Record<StatusExp, E[]> {
  const g: Record<StatusExp, E[]> = { a_iniciar: [], em_teste: [], pausado: [], concluido: [], abandonado: [] }
  for (const e of lista) g[statusDo(e)].push(e)
  // Em teste: o que termina antes primeiro; próximos: os com data primeiro, depois as ideias mais novas
  g.em_teste.sort((a, b) => (a.ends_on ?? "9999").localeCompare(b.ends_on ?? "9999") || recente(a, b))
  g.a_iniciar.sort((a, b) => (a.starts_on ?? "9999").localeCompare(b.starts_on ?? "9999") || b.created_at.localeCompare(a.created_at))
  g.pausado.sort(recente)
  g.concluido.sort((a, b) => (b.ends_on ?? b.updated_at).localeCompare(a.ends_on ?? a.updated_at))
  g.abandonado.sort(recente)
  return g
}

/** As observações do diário de um experimento, por dia (as mais novas primeiro). */
export function diarioDo<I extends Pick<Insight, "experiment_id" | "noted_on" | "created_at">>(insights: I[], expId: string): I[] {
  return insights
    .filter((i) => i.experiment_id === expId)
    .sort((a, b) => (b.noted_on ?? b.created_at.slice(0, 10)).localeCompare(a.noted_on ?? a.created_at.slice(0, 10)) || b.created_at.localeCompare(a.created_at))
}

/** Os dias com registro no diário. */
export function diasComRegistro(insights: Pick<Insight, "noted_on" | "created_at">[]): Set<string> {
  return new Set(insights.map((i) => i.noted_on ?? i.created_at.slice(0, 10)))
}

/** Quantos funcionaram entre os concluídos (com resultado). */
export function placar(lista: Pick<Experimento, "status" | "result">[]): { concluidos: number; funcionou: number; parcial: number; naoFuncionou: number } {
  const concluidos = lista.filter((e) => statusDo(e) === "concluido")
  return {
    concluidos: concluidos.length,
    funcionou: concluidos.filter((e) => resultadoDo(e) === "funcionou").length,
    parcial: concluidos.filter((e) => resultadoDo(e) === "parcial").length,
    naoFuncionou: concluidos.filter((e) => resultadoDo(e) === "nao_funcionou").length,
  }
}

/* ------------------------------------------------------------------ */
/* O protocolo nas anotações                                           */
/* ------------------------------------------------------------------ */

const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

/** Uma linha sem a marcação de markdown e sem emoji nas pontas. */
function limpar(t: string): string {
  return t
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/<[^>]+>/g, "")
    .replace(/^[\s\p{Extended_Pictographic}️‍#>]+/gu, "")
    .replace(/[\s\p{Extended_Pictographic}️‍:]+$/gu, "")
    .trim()
}

export type ChaveSecao = "objetivo" | "hipotese" | "procedimento" | "evidencias" | "resultado" | "aprendizados" | "conclusao"

const SECOES: { chave: ChaveSecao; padrao: RegExp; titulo: string }[] = [
  { chave: "objetivo", padrao: /^objetivos?$/, titulo: "🎯 Objetivo" },
  { chave: "hipotese", padrao: /^hipoteses?$/, titulo: "💡 Hipótese" },
  { chave: "procedimento", padrao: /^(procedimento|como fazer|roteiro|metodo)$/, titulo: "📋 Procedimento" },
  { chave: "evidencias", padrao: /^evidencias?$/, titulo: "📁 Evidências" },
  { chave: "resultado", padrao: /^resultados?$/, titulo: "📊 Resultado" },
  { chave: "aprendizados", padrao: /^aprendizados?(-| )?(chaves?)?$/, titulo: "📚 Aprendizados-chave" },
  { chave: "conclusao", padrao: /^conclusao( final)?$/, titulo: "📌 Conclusão final" },
]

type Secao = { chave: ChaveSecao; linha: number; fim: number; nivel: number }

const TITULO = /^(#{1,6})[ \t]+(.+?)[ \t]*$/
const ROTULO = /^[ \t]*(?:\*\*|__)(.+?)(?:\*\*|__)[ \t]*:?[ \t]*$/

/** As seções do protocolo achadas no texto (por título de markdown ou linha em negrito). */
function secoes(linhas: string[]): Secao[] {
  const achadas: { chave: ChaveSecao | null; linha: number; nivel: number }[] = []
  linhas.forEach((l, i) => {
    const t = TITULO.exec(l)
    const r = t ? null : ROTULO.exec(l)
    const texto = t ? t[2] : r ? r[1] : null
    if (texto === null) return
    const k = semAcento(limpar(texto))
    const s = SECOES.find((x) => x.padrao.test(k))
    achadas.push({ chave: s?.chave ?? null, linha: i, nivel: t ? t[1].length : 7 })
  })
  const resultado: Secao[] = []
  achadas.forEach((a, n) => {
    if (!a.chave) return
    // A seção vai até o próximo título do mesmo nível ou acima (ou a próxima seção do protocolo)
    let fim = linhas.length
    for (const b of achadas.slice(n + 1)) {
      if (b.nivel <= a.nivel || b.chave) {
        fim = b.linha
        break
      }
    }
    if (!resultado.some((r) => r.chave === a.chave)) resultado.push({ chave: a.chave, linha: a.linha, fim, nivel: a.nivel })
  })
  return resultado
}

const dividir = (texto: string | null | undefined) => (texto ?? "").replace(/\r\n?/g, "\n").split("\n")

/** O texto de cada seção do protocolo (sem o título e sem os separadores). */
export function protocolo(texto: string | null | undefined): Partial<Record<ChaveSecao, string>> {
  const linhas = dividir(texto)
  const out: Partial<Record<ChaveSecao, string>> = {}
  for (const s of secoes(linhas)) {
    out[s.chave] = linhas
      .slice(s.linha + 1, s.fim)
      .filter((l) => !/^\s*(---+|\*\*\*+|___+)\s*$/.test(l))
      .join("\n")
      .trim()
  }
  return out
}

/** Itens de lista de uma seção, sem os que ficaram do modelo ("Tópico 2", vazios). */
export function itensDe(texto: string | undefined): string[] {
  return (texto ?? "")
    .split("\n")
    .map((l) => /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(l)?.[1]?.trim() ?? "")
    .map((l) => l.replace(/^\[[ xX]\]\s*/, ""))
    .filter((l) => l && !/^t[oó]pico \d+$/i.test(l) && !/^\{\{.*\}\}$/.test(l))
}

/** A nota dada no resultado ("Nota: 9,0", "**Nota:** {{9,0}}"), de 0 a 10. */
export function notaDo(texto: string | null | undefined): number | null {
  const m = /nota\s*:?\s*\**\s*:?\s*\\?\{?\\?\{?\s*(\d{1,2}(?:[.,]\d+)?)/i.exec(texto ?? "")
  if (!m) return null
  const n = Number(m[1].replace(",", "."))
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null
}

export type ProximoPasso = "manter" | "ajustar" | "parar"
export const PROXIMOS: Record<ProximoPasso, string> = {
  manter: "Manter: vira rotina",
  ajustar: "Ajustar e testar de novo",
  parar: "Deixar de lado",
}

export type Conclusao = {
  resultado: Exclude<ResultadoExp, "indefinido">
  nota: number | null
  aprendizados: string[]
  conclusao: string
  proximo: ProximoPasso | null
}

/**
 * Grava a conclusão no protocolo: troca o conteúdo das seções Resultado, Aprendizados-chave e Conclusão
 * final (ou cria as que faltam, no fim). O resto do texto fica como está.
 */
export function escreverConclusao(texto: string | null | undefined, c: Conclusao): string {
  const linhas = dividir(texto)
  const nota = c.nota === null ? null : Number.isInteger(c.nota) ? String(c.nota) : String(c.nota).replace(".", ",")
  const conteudo: Partial<Record<ChaveSecao, string[]>> = {
    resultado: [
      `- **Funcionou?** ${RESULTADOS[c.resultado]}`,
      ...(nota !== null ? [`- **Nota:** ${nota}`] : []),
      ...(c.proximo ? [`- **Próximo passo:** ${PROXIMOS[c.proximo]}`] : []),
    ],
    aprendizados: c.aprendizados.map((a) => a.replace(/\s+/g, " ").trim()).filter(Boolean).map((a) => `- ${a}`),
    conclusao: c.conclusao.trim() ? c.conclusao.trim().split("\n") : [],
  }
  let atual = [...linhas]
  // De trás para frente, para as linhas das seções de cima não mudarem de lugar
  const achadas = secoes(atual).filter((s) => s.chave in conteudo).sort((a, b) => b.linha - a.linha)
  const feitas = new Set<ChaveSecao>()
  for (const s of achadas) {
    const novo = conteudo[s.chave]!
    if (!novo.length && s.chave !== "resultado") {
      feitas.add(s.chave)
      continue
    }
    // O separador "---" que fechava a seção continua lá
    const velho = atual.slice(s.linha + 1, s.fim)
    let k = velho.length
    while (k > 0 && (!velho[k - 1].trim() || /^\s*(---+|\*\*\*+|___+)\s*$/.test(velho[k - 1]))) k--
    const separador = velho.slice(k).some((l) => l.trim()) ? ["", "---"] : []
    atual = [...atual.slice(0, s.linha + 1), "", ...novo, ...separador, "", ...atual.slice(s.fim)]
    feitas.add(s.chave)
  }
  const faltam = (["resultado", "aprendizados", "conclusao"] as const).filter((k) => !feitas.has(k) && conteudo[k]!.length)
  if (faltam.length) {
    while (atual.length && !atual[atual.length - 1].trim()) atual.pop()
    for (const k of faltam) {
      const titulo = SECOES.find((s) => s.chave === k)!.titulo
      atual.push(...(atual.length ? [""] : []), `### ${titulo}`, "", ...conteudo[k]!)
    }
  }
  return (
    atual
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  )
}

/** As anotações iniciais de um experimento novo (só as seções preenchidas). */
export function protocoloInicial(dados: { objetivo?: string; procedimento?: string }): string | null {
  const partes: string[] = []
  if (dados.objetivo?.trim()) partes.push(`### 🎯 Objetivo\n\n${dados.objetivo.trim()}`)
  if (dados.procedimento?.trim()) partes.push(`### 📋 Procedimento\n\n${dados.procedimento.trim()}`)
  return partes.length ? partes.join("\n\n") + "\n" : null
}

/** Ideias de experimentos para quem está começando (preenchem o formulário). */
export const SUGESTOES: { nome: string; tipo: string; hipotese: string; dias: number }[] = [
  { nome: "Sem celular na primeira hora do dia", tipo: "Hábito", hipotese: "Se eu deixar o celular longe na primeira hora, começo o dia com mais foco e calma.", dias: 7 },
  { nome: "Pomodoro de 50 minutos", tipo: "Técnica", hipotese: "Se eu estudar em blocos de 50 minutos com 10 de pausa, rendo mais que em blocos de 25.", dias: 7 },
  { nome: "Revisão de 5 minutos no fim do dia", tipo: "Processo", hipotese: "Se eu revisar o dia em 5 minutos à noite, planejo melhor o dia seguinte.", dias: 14 },
  { nome: "Explicar o que aprendi em voz alta", tipo: "Técnica", hipotese: "Se eu explicar a aula em voz alta logo depois, lembro mais dela na semana seguinte.", dias: 7 },
  { nome: "Treinar logo ao acordar", tipo: "Hábito", hipotese: "Se eu treinar de manhã, faltam menos treinos na semana.", dias: 14 },
]

export function plural(n: number, um: string, varios?: string): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? um : (varios ?? `${um}s`)}`
}
