/*
 * Flow: as regras, sem tela. Nada aqui fala com o banco, com o React, com a internet ou com `window`:
 * o relógio que guarda a sessão fica em `relogio.ts`, e as leituras no banco ficam em `dados.ts`.
 * Cada função devolve um objeto novo (o recebido nunca muda), para a tela poder comparar e desfazer.
 */
import { format } from "date-fns"
import { contem, formatar, isoDia, normalizar, plural, urlValida, dominio } from "@/lib/utils"
import { lerYoutube, linkYoutube, type VideoYoutube } from "@/lib/youtube"
import { lerMidia } from "@/lib/videos"
import { extrairVideos, inserirVideo, linhaDoVideo, partesDoTexto } from "@/features/videos/logica"
import type { Tables } from "@/lib/supabase/database.types"

export const ROTA_FLOW = "/vida/flow"
export type Tarefa = Tables<"tasks">
export type Evento = Tables<"events">
export type LinkSalvo = Tables<"bookmarks">

/* ------------------------------------------------------------------ */
/* 4.1 Sessão de foco                                                  */
/* ------------------------------------------------------------------ */

export type Fase = "foco" | "pausa" | "longa"
export type RitmoId = "classico" | "longo" | "profundo"
/** Minutos de cada fase de um ritmo. */
export type Ritmo = { id: RitmoId; nome: string; foco: number; pausa: number; longa: number }
export type TarefaEmFoco = { id: string; titulo: string }

export type Sessao = {
  ritmo: RitmoId
  fase: Fase
  /** Momento (ms, Date.now) em que a fase acaba, enquanto conta; null quando parado ou pausado. */
  fim: number | null
  /** Segundos que faltam quando parado ou pausado. */
  restante: number
  tarefa: TarefaEmFoco | null
  /** AAAA-MM-DD das contagens abaixo: num dia novo elas voltam a zero. */
  dia: string
  /** Focos concluídos no dia. */
  ciclos: number
  /** Minutos de foco concluídos no dia. */
  minutos: number
  /** Focos concluídos no dia, por id de tarefa. */
  porTarefa: Record<string, number>
}

export const RITMOS: Ritmo[] = [
  { id: "classico", nome: "Clássico · 25/5 min", foco: 25, pausa: 5, longa: 15 },
  { id: "longo", nome: "Longo · 50/10 min", foco: 50, pausa: 10, longa: 20 },
  { id: "profundo", nome: "Profundo · 90/20 min", foco: 90, pausa: 20, longa: 30 },
]

/** Depois de quantos focos vem a pausa longa. */
export const CICLOS_ATE_LONGA = 4

export const ROTULO_FASE: Record<Fase, string> = { foco: "Foco", pausa: "Pausa", longa: "Pausa longa" }

const ID_RITMOS = new Set<string>(RITMOS.map((r) => r.id))
const FASES = new Set<string>(["foco", "pausa", "longa"])

/** O ritmo do id dado, ou o clássico quando o id não existe (dado guardado de versão antiga). */
export function ritmoPorId(id: unknown): Ritmo {
  return RITMOS.find((r) => r.id === id) ?? RITMOS[0]
}

/** Duração da fase, em segundos. */
export function duracao(ritmo: RitmoId, fase: Fase): number {
  const r = ritmoPorId(ritmo)
  const minutos = fase === "foco" ? r.foco : fase === "pausa" ? r.pausa : r.longa
  return minutos * 60
}

/** Sessão parada, na fase de foco, sem tarefa e sem contagens, para o dia dado. */
export function sessaoInicial(dia: string): Sessao {
  return { ritmo: "classico", fase: "foco", fim: null, restante: duracao("classico", "foco"), tarefa: null, dia, ciclos: 0, minutos: 0, porTarefa: {} }
}

/** Zera as contagens quando o dia muda; no mesmo dia devolve o próprio objeto. */
export function doDia(s: Sessao, dia: string): Sessao {
  if (s.dia === dia) return s
  return { ...s, dia, ciclos: 0, minutos: 0, porTarefa: {} }
}

const DIA = /^\d{4}-\d{2}-\d{2}$/

/** Número finito, senão null. */
function numeroFinito(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

/** Contagem inteira e não negativa (negativo ou inválido vira 0). */
function contagem(v: unknown): number {
  const n = numeroFinito(v)
  return n === null || n < 0 ? 0 : Math.floor(n)
}

/**
 * Lê a sessão guardada (texto JSON ou objeto). Cada campo inválido vira o padrão, para uma gravação
 * antiga ou mexida à mão nunca quebrar a tela.
 */
export function lerSessao(bruto: unknown, dia: string): Sessao {
  let v: unknown = bruto
  if (typeof v === "string") {
    try {
      v = JSON.parse(v)
    } catch {
      return sessaoInicial(dia)
    }
  }
  if (!v || typeof v !== "object") return sessaoInicial(dia)
  const o = v as Record<string, unknown>

  const ritmo = ID_RITMOS.has(String(o.ritmo)) ? (o.ritmo as RitmoId) : "classico"
  const fase = FASES.has(String(o.fase)) ? (o.fase as Fase) : "foco"

  const fimLido = numeroFinito(o.fim)
  const fim = fimLido !== null && fimLido > 0 ? fimLido : null

  const restanteLido = numeroFinito(o.restante)
  const maximo = duracao(ritmo, fase)
  const restante = restanteLido !== null && restanteLido >= 0 && restanteLido <= maximo ? Math.round(restanteLido) : maximo

  const t = o.tarefa as { id?: unknown; titulo?: unknown } | null | undefined
  const tarefa: TarefaEmFoco | null =
    t && typeof t.id === "string" && t.id.trim() !== "" && typeof t.titulo === "string" ? { id: t.id, titulo: t.titulo } : null

  const diaLido = typeof o.dia === "string" && DIA.test(o.dia) ? o.dia : dia

  const porTarefa: Record<string, number> = {}
  if (o.porTarefa && typeof o.porTarefa === "object") {
    for (const [id, n] of Object.entries(o.porTarefa as Record<string, unknown>)) {
      const f = numeroFinito(n)
      if (f !== null && Math.floor(f) >= 1) porTarefa[id] = Math.floor(f)
    }
  }

  return doDia({ ritmo, fase, fim, restante, tarefa, dia: diaLido, ciclos: contagem(o.ciclos), minutos: contagem(o.minutos), porTarefa }, dia)
}

/** Segundos que faltam agora: parado, o guardado; contando, o que sobra até o fim. */
export function restanteEm(s: Sessao, agora: number): number {
  if (s.fim === null) return s.restante
  return Math.max(0, Math.ceil((s.fim - agora) / 1000))
}

export const rodando = (s: Sessao): boolean => s.fim !== null

export const faseAcabou = (s: Sessao, agora: number): boolean => s.fim !== null && s.fim <= agora

/** Começa (ou continua) a fase. Já contando, devolve o próprio objeto. */
export function comecar(s: Sessao, agora: number): Sessao {
  if (rodando(s)) return s
  const r = s.restante > 0 ? s.restante : duracao(s.ritmo, s.fase)
  return { ...s, restante: r, fim: agora + r * 1000 }
}

/** Pausa a contagem, guardando o que faltava. Parado, devolve o próprio objeto. */
export function pausar(s: Sessao, agora: number): Sessao {
  if (!rodando(s)) return s
  return { ...s, fim: null, restante: restanteEm(s, agora) }
}

/** Volta a fase para a duração cheia, parada. */
export function reiniciar(s: Sessao): Sessao {
  return { ...s, fim: null, restante: duracao(s.ritmo, s.fase) }
}

export function escolherFase(s: Sessao, fase: Fase): Sessao {
  return { ...s, fase, fim: null, restante: duracao(s.ritmo, fase) }
}

export function trocarRitmo(s: Sessao, ritmo: RitmoId): Sessao {
  return { ...s, ritmo, fim: null, restante: duracao(ritmo, s.fase) }
}

/** Depois de um foco: pausa longa a cada quatro focos, senão pausa curta. Depois de uma pausa: foco. */
export function proximaFase(fase: Fase, ciclosDepois: number): Fase {
  if (fase !== "foco") return "foco"
  return ciclosDepois > 0 && ciclosDepois % CICLOS_ATE_LONGA === 0 ? "longa" : "pausa"
}

/** Termina a fase que acabou: conta o foco (se foi foco) e deixa a próxima parada, com a duração cheia. */
export function concluirFase(s: Sessao, dia: string): Sessao {
  const base = doDia(s, dia)
  if (base.fase !== "foco") {
    const prox = proximaFase(base.fase, base.ciclos)
    return { ...base, fase: prox, fim: null, restante: duracao(base.ritmo, prox) }
  }
  const ciclos = base.ciclos + 1
  const porTarefa = { ...base.porTarefa }
  if (base.tarefa) porTarefa[base.tarefa.id] = (porTarefa[base.tarefa.id] ?? 0) + 1
  const prox = proximaFase("foco", ciclos)
  return {
    ...base,
    fase: prox,
    fim: null,
    restante: duracao(base.ritmo, prox),
    ciclos,
    minutos: base.minutos + ritmoPorId(base.ritmo).foco,
    porTarefa,
  }
}

/** Pula a fase sem contar nada: foco vai para a pausa; pausa vai para o foco. */
export function pular(s: Sessao, dia: string): Sessao {
  const base = doDia(s, dia)
  const prox: Fase = base.fase === "foco" ? "pausa" : "foco"
  return { ...base, fase: prox, fim: null, restante: duracao(base.ritmo, prox) }
}

export function escolherTarefa(s: Sessao, tarefa: TarefaEmFoco | null): Sessao {
  return { ...s, tarefa }
}

/* Textos da sessão */

/** "25:00" a partir de segundos; os minutos podem passar de 59 ("90:00"). */
export function mmss(seg: number): string {
  const total = Math.max(0, Math.floor(seg))
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

/** "0 min", "25 min", "1 h", "1 h 15 min", "2 h 30 min". */
export function textoMinutos(min: number): string {
  const m = Math.max(0, Math.floor(min))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const resto = m % 60
  return resto ? `${h} h ${resto} min` : `${h} h`
}

/** Quantos ciclos e minutos de foco hoje; dia diferente do de hoje conta como nenhum. */
export function resumoDoDia(s: Sessao, dia: string): string {
  if (s.dia !== dia || s.ciclos === 0) return "Nenhum ciclo de foco hoje"
  const ciclos = plural(s.ciclos, "ciclo de foco", "ciclos de foco")
  return `${ciclos} hoje · ${textoMinutos(s.minutos)}`
}

/** As bolinhas de ciclo (0 a 4). Na pausa longa, depois do quarto foco, a quarta fica cheia. */
export function bolinhas(s: Sessao): number {
  if (s.fase === "longa" && s.ciclos > 0 && s.ciclos % CICLOS_ATE_LONGA === 0) return CICLOS_ATE_LONGA
  return s.ciclos % CICLOS_ATE_LONGA
}

export function textoBolinhas(n: number): string {
  return `${n} de ${CICLOS_ATE_LONGA} ciclos até a pausa longa`
}

/** O aviso quando uma fase acaba (só texto; quem avisa é a tela). */
export function avisoDoFim(acabou: Fase, proxima: Fase): string {
  if (acabou === "foco") return proxima === "longa" ? "Foco concluído. Hora da pausa longa." : "Foco concluído. Hora da pausa."
  return "Pausa encerrada. De volta ao foco."
}

/** O botão do aviso: começa a próxima fase. */
export function rotuloAcaoDoFim(proxima: Fase): string {
  return proxima === "foco" ? "Começar foco" : "Começar pausa"
}

/** O texto do botão principal: "Começar", "Pausar" ou "Continuar" (parado, mas com tempo já gasto). */
export function rotuloBotao(s: Sessao): string {
  if (rodando(s)) return "Pausar"
  return s.restante < duracao(s.ritmo, s.fase) ? "Continuar" : "Começar"
}

/** O título da aba enquanto conta ("24:59 · Foco"); parado, null (a aba volta ao normal). */
export function tituloDaAba(s: Sessao, agora: number): string | null {
  if (!rodando(s)) return null
  return `${mmss(restanteEm(s, agora))} · ${ROTULO_FASE[s.fase]}`
}

/** Quantos focos de hoje foram nesta tarefa. */
export function ciclosDaTarefa(s: Sessao, id: string, dia: string): number {
  if (s.dia !== dia) return 0
  return s.porTarefa[id] ?? 0
}

export function textoCiclosTarefa(n: number): string | null {
  if (n <= 0) return null
  return n === 1 ? "1 ciclo nesta tarefa hoje" : `${n} ciclos nesta tarefa hoje`
}

/** Tem progresso que se perderia ao reiniciar ou pular: contando, ou parado com tempo já gasto. */
export function perdeProgresso(s: Sessao, agora: number): boolean {
  return rodando(s) || restanteEm(s, agora) < duracao(s.ritmo, s.fase)
}

/* ------------------------------------------------------------------ */
/* 4.2 Tarefas                                                         */
/* ------------------------------------------------------------------ */

/** Diferença em dias entre dois AAAA-MM-DD (a menos b), sem passar pelo fuso do aparelho. */
function diasEntre(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number)
  const [yb, mb, db] = b.split("-").map(Number)
  return Math.round((Date.UTC(ya, ma - 1, da) - Date.UTC(yb, mb - 1, db)) / 86400000)
}

/**
 * As tarefas de hoje, na ordem de `TarefasHoje`: primeiro as com data até hoje (a mais antiga antes, depois
 * a hora, depois a posição), depois as em andamento sem data. Concluídas ficam de fora.
 */
export function tarefasDeHoje(tarefas: Tarefa[], hoje: string): Tarefa[] {
  const comData = tarefas
    .filter((t) => t.status !== "done" && t.due_date && t.due_date <= hoje)
    .sort((a, b) => {
      const da = a.due_date ?? ""
      const db = b.due_date ?? ""
      if (da !== db) return da < db ? -1 : 1
      // Sem hora vai para o fim do dia ("99" é maior que qualquer hora)
      const ha = a.due_time ?? "99"
      const hb = b.due_time ?? "99"
      if (ha !== hb) return ha < hb ? -1 : 1
      return a.position - b.position
    })
  const semData = tarefas.filter((t) => t.status === "doing" && !t.due_date).sort((a, b) => a.position - b.position)
  return [...comData, ...semData]
}

/** Quantas tarefas foram concluídas hoje (pelo dia local de `done_at`). */
export function concluidasHoje(tarefas: Tarefa[], hoje: string): number {
  return tarefas.filter((t) => t.status === "done" && t.done_at && isoDia(new Date(t.done_at)) === hoje).length
}

/** A próxima da lista para focar: a primeira que não é a tarefa em foco agora. */
export function proximaSugestao(lista: Tarefa[], focoId: string | null): Tarefa | null {
  return lista.find((t) => t.id !== focoId) ?? null
}

/** O prazo da tarefa como texto: "para hoje às 09:00", "atrasada há 2 dias", "para 21 de out"… */
export function textoPrazo(t: Tarefa, hoje: string): string {
  if (!t.due_date) return t.status === "doing" ? "em andamento" : "sem data"
  const dias = diasEntre(hoje, t.due_date)
  if (dias > 0) return dias === 1 ? "atrasada desde ontem" : `atrasada há ${dias} dias`
  if (dias === 0) return t.due_time ? `para hoje às ${t.due_time.slice(0, 5)}` : "para hoje"
  return `para ${formatar(t.due_date, "d 'de' MMM")}`
}

/* ------------------------------------------------------------------ */
/* 4.3 Agenda                                                          */
/* ------------------------------------------------------------------ */

const ms = (iso: string): number => new Date(iso).getTime()

/** O fim do compromisso; sem fim, é o próprio início. */
const fimDoEvento = (e: Evento): string => e.ends_at ?? e.starts_at

/** Um compromisso que ainda importa agora, com quantos minutos faltam (ou para acabar, se está em andamento). */
export type Proximo = { evento: Evento; agora: boolean; minutos: number }

/**
 * O que ainda falta na agenda do dia de `agora`, sem os feitos. Dia todo entra o dia inteiro, na frente;
 * com hora, entra enquanto não acabou (um compromisso sem fim some quando a hora dele passa).
 */
export function agendaDoDia(eventos: Evento[], agora: Date): Evento[] {
  const hoje = isoDia(agora)
  const pendentes = eventos.filter((e) => !e.done)
  const diaTodo = pendentes
    .filter((e) => e.all_day && isoDia(new Date(e.starts_at)) <= hoje && hoje <= isoDia(new Date(fimDoEvento(e))))
    .sort((a, b) => ms(a.starts_at) - ms(b.starts_at) || a.title.localeCompare(b.title, "pt-BR"))
  const comHora = pendentes
    .filter((e) => !e.all_day && isoDia(new Date(e.starts_at)) <= hoje && ms(fimDoEvento(e)) > agora.getTime())
    .sort((a, b) => ms(a.starts_at) - ms(b.starts_at))
  return [...diaTodo, ...comHora]
}

/** Com hora, com fim, e `início <= agora < fim`. */
export function emAndamento(e: Evento, agora: Date): boolean {
  if (e.all_day || !e.ends_at) return false
  const momento = agora.getTime()
  return ms(e.starts_at) <= momento && momento < ms(e.ends_at)
}

/** O compromisso com hora que importa agora: o que está acontecendo, senão o próximo do mesmo dia. */
export function proximoCompromisso(eventos: Evento[], agora: Date): Proximo | null {
  const hoje = isoDia(agora)
  const momento = agora.getTime()
  const comHora = agendaDoDia(eventos, agora).filter((e) => !e.all_day)
  const acontecendo = comHora.find((e) => emAndamento(e, agora))
  if (acontecendo) return { evento: acontecendo, agora: true, minutos: Math.ceil((ms(fimDoEvento(acontecendo)) - momento) / 60000) }
  const proximo = comHora.find((e) => ms(e.starts_at) > momento && isoDia(new Date(e.starts_at)) === hoje)
  if (!proximo) return null
  return { evento: proximo, agora: false, minutos: Math.ceil((ms(proximo.starts_at) - momento) / 60000) }
}

/** A frase da agenda: "Reunião com a equipe às 15:30 · em 1 h 30 min", "Agora: … · até 16:30". */
export function textoProximo(p: Proximo | null): string {
  if (!p) return "Nada na agenda pelo resto do dia."
  if (p.agora) return `Agora: ${p.evento.title} · até ${format(new Date(fimDoEvento(p.evento)), "HH:mm")}`
  return `${p.evento.title} às ${format(new Date(p.evento.starts_at), "HH:mm")} · em ${textoMinutos(p.minutos)}`
}

/**
 * O próximo compromisso começa antes de o ciclo de foco acabar. Só vale quando ele ainda não começou
 * e a sessão está no foco (pausa não tem o que atrapalhar).
 */
export function conflitaComFoco(p: Proximo | null, s: Sessao, agoraMs: number): boolean {
  if (!p || p.agora || s.fase !== "foco") return false
  const fimDoCiclo = s.fim ?? agoraMs + s.restante * 1000
  return fimDoCiclo > ms(p.evento.starts_at)
}

/** "Dia todo", "15:30–16:30" (travessão curto) ou "18:00" (sem fim). */
export function horarioDoEvento(e: Evento): string {
  if (e.all_day) return "Dia todo"
  const inicio = format(new Date(e.starts_at), "HH:mm")
  return e.ends_at ? `${inicio}–${format(new Date(e.ends_at), "HH:mm")}` : inicio
}

/* ------------------------------------------------------------------ */
/* 4.4 Ferramentas                                                     */
/* ------------------------------------------------------------------ */

/** Quantas ferramentas aparecem antes do "Mostrar todas". */
export const LIMITE_FERRAMENTAS = 9

/** As palavras de preço (sem acento e em minúscula) e o rótulo que a tela mostra. */
export const PRECOS = new Map<string, string>([
  ["gratuito", "Grátis"],
  ["gratis", "Grátis"],
  ["free", "Grátis"],
  ["plano gratuito", "Plano grátis"],
  ["freemium", "Plano grátis"],
  ["pago", "Pago"],
  ["beta", "Beta"],
])

/** O rótulo do preço, se a palavra for um preço; senão null. */
function rotuloDoPreco(t: string): string | null {
  return PRECOS.get(normalizar(t)) ?? null
}

/** É uma palavra de preço ("Gratuito", "Plano Gratuito", "Pago", "Beta")? */
export function ehPreco(t: string): boolean {
  return rotuloDoPreco(t) !== null
}

/**
 * Separa "Nome - Descrição" (com hífen, "–" ou "—", sempre com espaço dos dois lados). Quebras de linha e
 * espaços repetidos viram um espaço só; o nome é o que vem antes do PRIMEIRO separador.
 */
export function separarTitulo(titulo: string): { nome: string; descricao: string | null } {
  const limpo = titulo.replace(/\s+/g, " ").trim()
  const m = limpo.match(/^(.*?) [-–—] (.*)$/)
  if (!m) return { nome: limpo, descricao: null }
  return { nome: m[1].trim(), descricao: m[2].trim() || null }
}

/** Uma ferramenta (um cartão). Ferramentas com o mesmo nome são juntadas por `juntarFerramentas`. */
export type Ferramenta = {
  id: string
  /** Os ids de todos os links juntados nesta ferramenta. */
  ids: string[]
  /** O primeiro link (é o que "Editar" abre) e os que foram juntados depois. */
  link: LinkSalvo
  nome: string
  descricao: string | null
  url: string | null
  dominio: string
  /** As tags, sem as de preço. */
  tags: string[]
  preco: string | null
  /** O tipo (o kind), quando não é um preço. */
  categoria: string | null
  /** Tudo que a busca olha, num texto só. */
  textoBusca: string
}

/** Uma ferramenta a partir de um link salvo, sem juntar com as repetidas. */
export function lerFerramenta(l: LinkSalvo): Ferramenta {
  const titulo = separarTitulo(l.title)
  // Sem descrição no título, vale a primeira linha da descrição guardada (curta na tela)
  const primeiraLinha =
    (l.description ?? "")
      .split("\n")
      .map((x) => x.replace(/\s+/g, " ").trim())
      .find((x) => x !== "") ?? null
  const descricaoDoCampo = primeiraLinha === null ? null : primeiraLinha.length > 160 ? `${primeiraLinha.slice(0, 159)}…` : primeiraLinha

  const tags: string[] = []
  const vistas = new Set<string>()
  for (const bruta of l.tags) {
    const t = bruta.trim()
    const chave = normalizar(t)
    if (!t || ehPreco(t) || vistas.has(chave)) continue
    vistas.add(chave)
    tags.push(t)
  }

  const precoDaTag = l.tags.map((t) => rotuloDoPreco(t)).find((p): p is string => p !== null) ?? null
  const kind = l.kind?.trim() || null
  const precoDoKind = kind ? rotuloDoPreco(kind) : null
  const preco = precoDaTag ?? precoDoKind
  const categoria = kind && !ehPreco(kind) ? kind : null

  const dominioDoLink = dominio(l.url)
  const nome = titulo.nome || dominioDoLink || "Sem nome"
  const descricao = titulo.descricao ?? descricaoDoCampo

  const textoBusca = [nome, descricao, dominioDoLink, ...tags, preco, categoria, ...l.tags, kind]
    .filter((x): x is string => Boolean(x))
    .join(" ")

  return { id: l.id, ids: [l.id], link: l, nome, descricao, url: urlValida(l.url), dominio: dominioDoLink, tags, preco, categoria, textoBusca }
}

/**
 * Junta as ferramentas repetidas (o import dos dois bancos "Tools" trouxe algumas duas vezes). A primeira na
 * ordem recebida é a base; o que falta nela vem da repetida. Ordena por nome.
 */
export function juntarFerramentas(links: LinkSalvo[]): Ferramenta[] {
  const porNome = new Map<string, Ferramenta>()
  for (const l of links) {
    const f = lerFerramenta(l)
    const chave = normalizar(f.nome)
    const base = porNome.get(chave)
    if (!base) {
      porNome.set(chave, f)
      continue
    }
    const tags = [...base.tags]
    const vistas = new Set(base.tags.map((t) => normalizar(t)))
    for (const t of f.tags) {
      if (vistas.has(normalizar(t))) continue
      vistas.add(normalizar(t))
      tags.push(t)
    }
    porNome.set(chave, {
      ...base,
      ids: [...base.ids, ...f.ids],
      url: base.url ?? f.url,
      dominio: base.dominio || f.dominio,
      descricao: base.descricao ?? f.descricao,
      preco: base.preco ?? f.preco,
      categoria: base.categoria ?? f.categoria,
      tags,
      textoBusca: `${base.textoBusca} ${f.textoBusca}`,
    })
  }
  return [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))
}

/**
 * As tags para o filtro: se há três ou mais com pelo menos duas ferramentas, só essas (até oito); senão, as
 * oito primeiras por uso. Com menos de duas tags diferentes, nenhum filtro (lista vazia).
 */
export function tagsMaisUsadas(fs: Ferramenta[]): { valor: string; n: number }[] {
  const contagem = new Map<string, { valor: string; n: number }>()
  for (const f of fs) {
    const vistas = new Set<string>()
    for (const t of f.tags) {
      const chave = normalizar(t)
      if (vistas.has(chave)) continue
      vistas.add(chave)
      const atual = contagem.get(chave)
      if (atual) atual.n++
      else contagem.set(chave, { valor: t, n: 1 })
    }
  }
  if (contagem.size < 2) return []
  const ordenadas = [...contagem.values()].sort((a, b) => b.n - a.n || a.valor.localeCompare(b.valor, "pt-BR"))
  const frequentes = ordenadas.filter((t) => t.n >= 2)
  return (frequentes.length >= 3 ? frequentes : ordenadas).slice(0, 8)
}

/** As ferramentas de uma tag (null = todas) e que batem com a busca, na ordem recebida. */
export function filtrarFerramentas(fs: Ferramenta[], filtro: { tag: string | null; busca: string }): Ferramenta[] {
  const tag = filtro.tag === null ? null : normalizar(filtro.tag)
  return fs.filter((f) => (tag === null || f.tags.some((t) => normalizar(t) === tag)) && contem(f.textoBusca, filtro.busca))
}

/* ------------------------------------------------------------------ */
/* 4.5 Playlist                                                        */
/* ------------------------------------------------------------------ */

/** Uma música da playlist: o vídeo, o endereço como está no texto e a legenda que a pessoa deu, se deu. */
export type FaixaPlaylist = { chave: string; id: string; video: VideoYoutube; endereco: string; legenda: string | null; sozinho: boolean }

/** As músicas da página: só os vídeos do YouTube, na ordem do texto, sem repetir. */
export function faixasDaPagina(conteudo: string | null | undefined): FaixaPlaylist[] {
  const vistos = new Set<string>()
  const faixas: FaixaPlaylist[] = []
  for (const v of extrairVideos(conteudo)) {
    if (v.midia.fonte !== "youtube" || vistos.has(v.chave)) continue
    vistos.add(v.chave)
    faixas.push({ chave: v.chave, id: v.midia.youtube.id, video: v.midia.youtube, endereco: v.endereco, legenda: v.legenda, sozinho: v.sozinho })
  }
  return faixas
}

/**
 * O vídeo de um link colado: o primeiro endereço do texto (sem pontuação no fim) ou, sem endereço, o texto
 * todo (aceita "youtu.be/…" sem https). Não é um vídeo do YouTube: null.
 */
export function linkYoutubeColado(texto: string | null | undefined): VideoYoutube | null {
  const t = (texto ?? "").trim()
  const achado = t.match(/https?:\/\/\S+/i)?.[0]
  return lerYoutube(achado ? achado.replace(/[.,;:!?)\]]+$/, "") : t)
}

/** A linha que vai para o texto da página para uma música nova (com o nome, se a pessoa deu um). */
export function linhaNovaDaPlaylist(video: VideoYoutube, titulo: string | null): string {
  return linhaDoVideo(linkYoutube(video), titulo)
}

/** O título da primeira parte "Playlist…" da página, ou null se a página não tem uma. */
export function parteDaPlaylist(texto: string | null | undefined): string | null {
  return partesDoTexto(texto).find((p) => normalizar(p.titulo).startsWith("playlist"))?.titulo ?? null
}

/**
 * Põe a linha de uma música no texto da página. Com a parte "Playlist", vai para o fim dela. Sem ela, logo
 * depois do último vídeo que está sozinho numa linha (com linha em branco antes e depois). Sem nada disso,
 * no fim da página.
 */
export function inserirNaPlaylist(texto: string | null | undefined, linha: string): string {
  const parte = parteDaPlaylist(texto)
  if (parte !== null) return inserirVideo(texto, linha, parte)
  const ls = (texto ?? "").replace(/\r\n?/g, "\n").split("\n")
  let ultimo = -1
  ls.forEach((l, i) => {
    const videos = extrairVideos(l)
    if (videos.length === 1 && videos[0].midia.fonte === "youtube" && videos[0].sozinho) ultimo = i
  })
  if (ultimo < 0) return inserirVideo(texto, linha, null)
  const blocos = [...ls.slice(0, ultimo + 1), "", linha]
  const seguinte = ls.slice(ultimo + 1)
  if (seguinte.length) {
    // Se a linha seguinte já é em branco, ela faz o espaço: não acrescenta outra
    if (seguinte[0].trim()) blocos.push("")
    blocos.push(...seguinte)
  }
  return blocos.join("\n")
}

/* ------------------------------------------------------------------ */
/* 4.6 Anotações                                                       */
/* ------------------------------------------------------------------ */

type TipoLinha = "vazia" | "regua" | "rotulo" | "link" | "texto"
type LinhaAnotacao = { linha: string; tipo: TipoLinha; enderecos: string[] }

const LINK_MD = /!?\[(?:\\.|[^\\\]])*\]\(\s*<?([^\s)>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g
const LINK_SOLTO = /<?(https?:\/\/[^\s<>()[\]"'`]+)>?/g
// Citação ("> ") e marcador de lista ("- ", "1. ") do começo da linha
const MARCADOR_CITACAO = /^\s*(?:>\s?)*/
const MARCADOR_LISTA = /^\s*(?:[-*+]|\d+[.)])\s+/
const EMOJI_E_ESPACO_DO_INICIO = /^(?:\p{Extended_Pictographic}|\uFE0F|\u200D|\s)+/u
const NEGRITO_SOZINHO = /^(\*\*|__)(?:(?!\1).)+\1\s*:?\s*$/
const REGUA = /^(?:-{3,}|\*{3,}|_{3,})$/

/** Os endereços dos links da linha: [rótulo](endereço), <endereço> e endereço solto. */
function enderecosDaLinha(linha: string): string[] {
  const enderecos: string[] = []
  const semMarkdown = linha.replace(LINK_MD, (_todo, endereco: string) => {
    enderecos.push(endereco)
    return " "
  })
  for (const m of semMarkdown.matchAll(LINK_SOLTO)) enderecos.push(m[1].replace(/[.,;:!?]+$/, ""))
  return enderecos
}

/** Classifica uma linha da página: vazia, régua, rótulo (título ou linha só em negrito), link ou texto. */
function classificarLinha(linha: string): { tipo: TipoLinha; enderecos: string[] } {
  const semCitacao = linha.replace(MARCADOR_CITACAO, "")
  if (!semCitacao.trim()) return { tipo: "vazia", enderecos: [] }
  if (REGUA.test(semCitacao.trim())) return { tipo: "regua", enderecos: [] }
  const semEmoji = semCitacao.replace(EMOJI_E_ESPACO_DO_INICIO, "")
  if (/^#{1,6}\s/.test(semEmoji) || NEGRITO_SOZINHO.test(semEmoji)) return { tipo: "rotulo", enderecos: [] }
  const enderecos = enderecosDaLinha(semCitacao)
  // Link é a linha que, sem o marcador de lista e sem os links, não tem mais nada
  const semLinks = semCitacao.replace(MARCADOR_LISTA, "").replace(LINK_MD, " ").replace(LINK_SOLTO, " ")
  if (enderecos.length > 0 && !semLinks.trim()) return { tipo: "link", enderecos }
  return { tipo: "texto", enderecos }
}

/**
 * Um link que não é anotação: leva a um vídeo ou mídia, a um caminho do próprio app ("/…") ou a um banco do
 * Notion (.csv/.md). Só sai a linha em que todos os links são assim.
 */
function linkParaTirar(enderecos: string[]): boolean {
  return enderecos.every((e) => lerMidia(e) !== null || (e.startsWith("/") && !e.startsWith("//")) || /\.(csv|md)$/i.test(e.split(/[?#]/)[0]))
}

/**
 * O texto que vale mostrar como anotação da página Flow, ou null. Página que só tem rótulos, links e vídeos
 * (o que o import do Notion deixa) não tem anotação. Das partes com texto ficam as linhas, menos as réguas e
 * os links para tirar.
 */
export function textoDasAnotacoes(conteudo: string | null | undefined): string | null {
  // Os ícones do Notion (<img>) não são texto; os espaços logo depois deles saem junto (as quebras ficam)
  const semImagens = (conteudo ?? "").replace(/\r\n?/g, "\n").replace(/<img[^>]*>[ \t]*/gi, "")
  // Cada rótulo começa uma parte; o que vem antes do primeiro rótulo é uma parte sem rótulo
  const partes: LinhaAnotacao[][] = [[]]
  for (const linha of semImagens.split("\n")) {
    const { tipo, enderecos } = classificarLinha(linha)
    if (tipo === "rotulo") partes.push([{ linha, tipo, enderecos }])
    else partes[partes.length - 1].push({ linha, tipo, enderecos })
  }
  const ficam = partes
    .filter((p) => p.some((l) => l.tipo === "texto"))
    .flatMap((p) => p.filter((l) => l.tipo !== "regua" && !(l.tipo === "link" && linkParaTirar(l.enderecos))))
  // Rótulo e pontuação sozinhos não viram anotação: conta só o texto que ficou
  const textoDeVerdade = ficam
    .filter((l) => l.tipo === "texto")
    .map((l) => l.linha)
    .join(" ")
  if (textoDeVerdade.replace(/[\s>*_#`~\-[\]()!]/g, "").length < 10) return null
  return ficam
    .map((l) => l.linha)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
