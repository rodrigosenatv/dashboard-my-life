/* eslint-disable @typescript-eslint/no-explicit-any */
import Papa from "papaparse"
import { texto } from "./zip"
import {
  ehBool,
  estrelas,
  lerBool,
  lerDataNotion,
  lerIntervalo,
  lerLista,
  lerNumero,
  lerRelacao,
  normalizarNome,
  paraTimestamp,
  type Relacao,
} from "./valores"

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

type Linha = Record<string, any>

export type ArquivoPlano = { origem: string; destino: string; mime: string; tamanho: number; nome: string }

export type Plano = {
  linhas: Record<string, Linha[]>
  arquivos: ArquivoPlano[]
  avisos: string[]
}

export const ORDEM_TABELAS = [
  "areas",
  "projects",
  "captures",
  "capture_projects",
  "habits",
  "habit_logs",
  "day_notes",
  "goals",
  "goal_months",
  "tasks",
  "events",
  "bookmarks",
  "books",
  "courses",
  "exam_subjects",
  "exam_topics",
  "experiments",
  "insights",
  "editorial_lines",
  "content_items",
  "pages",
  "collections",
  "collection_items",
] as const

const NOMES_TABELAS: Record<string, string> = {
  areas: "Áreas",
  projects: "Projetos e etapas",
  captures: "Capturas",
  capture_projects: "Ligações captura e projeto",
  habits: "Hábitos",
  habit_logs: "Marcações de hábitos",
  day_notes: "Observações do dia",
  goals: "Metas",
  goal_months: "Resultados mensais",
  tasks: "Tarefas",
  events: "Compromissos",
  bookmarks: "Links",
  books: "Livros",
  courses: "Cursos",
  exam_subjects: "Disciplinas",
  exam_topics: "Assuntos",
  experiments: "Experimentos",
  insights: "Insights",
  editorial_lines: "Linhas editoriais",
  content_items: "Conteúdos",
  pages: "Páginas",
  collections: "Coleções",
  collection_items: "Itens de coleções",
}
export const nomeTabela = (t: string) => NOMES_TABELAS[t] ?? t

/* ------------------------------------------------------------------ */
/* Caminhos                                                            */
/* ------------------------------------------------------------------ */

const ID_RE = /\s([0-9a-f]{32})(?:_all)?(?:\.(md|csv))?$/i

function dirname(p: string) {
  const i = p.lastIndexOf("/")
  return i === -1 ? "" : p.slice(0, i)
}

function basename(p: string) {
  return p.slice(p.lastIndexOf("/") + 1)
}

function juntar(dir: string, relativo: string): string {
  const partes = (dir ? dir.split("/") : []).concat(relativo.split("/"))
  const saida: string[] = []
  for (const parte of partes) {
    if (!parte || parte === ".") continue
    if (parte === "..") saida.pop()
    else saida.push(parte)
  }
  return saida.join("/")
}

function semExtensao(p: string) {
  return p.replace(/(_all)?\.(md|csv)$/i, "")
}

function idDoNome(nome: string): string | null {
  return nome.match(ID_RE)?.[1]?.toLowerCase() ?? null
}

function tituloDoNome(nome: string): string {
  return semExtensao(nome).replace(/\s[0-9a-f]{32}$/i, "").trim()
}

function semId(p: string) {
  return p
    .split("/")
    .map((s) => s.replace(/\s[0-9a-f]{32}$/i, ""))
    .join("/")
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
}

function extensao(p: string) {
  return p.split(".").pop()?.toLowerCase() ?? ""
}

export function ehImagem(p: string) {
  return ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extensao(p))
}

/* ------------------------------------------------------------------ */
/* Markdown das páginas                                                */
/* ------------------------------------------------------------------ */

type PaginaMd = {
  caminho: string
  id: string
  titulo: string
  props: Record<string, string>
  corpo: string
}

function lerMarkdown(caminho: string, bruto: string, comPropriedades: boolean): PaginaMd {
  const linhas = bruto.replace(/\r\n/g, "\n").split("\n")
  let titulo = tituloDoNome(basename(caminho))
  let i = 0
  while (i < linhas.length && !linhas[i].trim()) i++
  if (linhas[i]?.startsWith("# ")) {
    titulo = linhas[i].slice(2).trim() || titulo
    i++
  }
  const props: Record<string, string> = {}
  if (comPropriedades) {
    while (i < linhas.length && !linhas[i].trim()) i++
    while (i < linhas.length && linhas[i].trim()) {
      const m = linhas[i].match(/^([^:]{1,80}):\s?(.*)$/)
      if (!m) break
      props[m[1].trim()] = m[2].trim()
      i++
    }
  }
  return {
    caminho,
    id: idDoNome(basename(caminho)) ?? `p:${caminho}`,
    titulo,
    props,
    corpo: linhas.slice(i).join("\n").trim(),
  }
}

/** Limpa o HTML que o Notion coloca no markdown (callouts, toggles). */
function limparHtml(md: string): string {
  return md
    .replace(/<aside>\s*/g, "\n> ")
    .replace(/\s*<\/aside>/g, "\n")
    .replace(/<details>\s*<summary>(.*?)<\/summary>/g, "\n**$1**\n")
    .replace(/<\/?details>/g, "")
    .replace(/<\/?(span|div|p|br|figure|figcaption)[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/* ------------------------------------------------------------------ */
/* Bancos de dados (CSV)                                               */
/* ------------------------------------------------------------------ */

type Banco = {
  caminho: string
  id: string
  nome: string
  chave: string
  colunas: string[]
  linhas: Record<string, string>[]
  pastaLinhas: string
}

function lerCsv(caminho: string, bruto: string): Banco {
  const r = Papa.parse<Record<string, string>>(bruto, { header: true, skipEmptyLines: true })
  const colunas = (r.meta.fields ?? []).map((c) => c.replace(/^﻿/, ""))
  const linhas = (r.data ?? []).map((l) => {
    const o: Record<string, string> = {}
    for (const [k, v] of Object.entries(l)) o[k.replace(/^﻿/, "")] = typeof v === "string" ? v : ""
    return o
  })
  const nome = tituloDoNome(basename(caminho))
  return {
    caminho,
    id: idDoNome(basename(caminho)) ?? `csv:${caminho}`,
    nome,
    chave: normalizarNome(nome),
    colunas,
    linhas,
    pastaLinhas: semExtensao(caminho),
  }
}

type Destino =
  | "habits"
  | "habit_logs"
  | "goals"
  | "goal_months"
  | "tasks"
  | "events"
  | "bookmarks:ferramentas"
  | "bookmarks:favoritos"
  | "bookmarks:links"
  | "projects"
  | "captures"
  | "areas"
  | "books"
  | "insights_livro"
  | "courses"
  | "exam_subjects"
  | "exam_topics"
  | "experiments"
  | "insights_lab"
  | "editorial_lines"
  | "content"
  | "ideias"
  | "plataformas"
  | "pages_concursos"
  | "ignorar"
  | "colecao"

function destinoDoBanco(chave: string, colunas: string[]): Destino {
  const tem = (c: string) => colunas.some((x) => normalizarNome(x) === normalizarNome(c))
  if (chave === "cadastro de habitos") return "habits"
  if (chave === "habitos" && tem("Data")) return "habit_logs"
  if (chave === "metas" && tem("Qtd. Meta")) return "goals"
  if (chave === "resultado mensal") return "goal_months"
  if (chave === "atividades" && tem("Descrição")) return "tasks"
  if (chave.startsWith("compromissos")) return "events"
  if (chave === "tools") return "bookmarks:ferramentas"
  if (chave === "sites favoritos") return "bookmarks:favoritos"
  if (chave === "links trackker" || chave === "links tracker") return "bookmarks:links"
  if (chave === "projetos_sb" || (tem("Sub-tarefa") && tem("Finalizado"))) return "projects"
  if (chave === "captura_sb" || (tem("f_Caixa_Entrada") && tem("Tipo"))) return "captures"
  if (chave === "areas_sb") return "areas"
  if (chave === "livros" || tem("Nome do Livro")) return "books"
  if (chave === "insights" && tem("Frase")) return "insights_livro"
  if (chave === "cursos" || tem("Nome do Curso")) return "courses"
  if (chave === "disciplinasdb") return "exam_subjects"
  if (chave === "assuntosdb") return "exam_topics"
  if (chave === "dbexperimentos") return "experiments"
  if (chave === "dbinsights") return "insights_lab"
  if (chave === "content planner") return "content"
  if (chave === "registro de ideias") return "ideias"
  if (chave === "linhas editoriais") return "editorial_lines"
  if (chave === "plataformas") return "plataformas"
  if (chave === "menu - passo" || chave === "menu passo") return "pages_concursos"
  if (["menu", "home", "visualizacoes da pagina inicial", "home views"].includes(chave)) return "ignorar"
  return "colecao"
}

/* ------------------------------------------------------------------ */
/* Plano                                                               */
/* ------------------------------------------------------------------ */

const STATUS_TAREFA: Record<string, string> = { "nao iniciada": "todo", "em andamento": "doing", concluido: "done", concluida: "done", feito: "done", done: "done" }
const PRIORIDADE: Record<string, string> = { urgente: "urgente", necessario: "necessario", "bom fazer": "bom_fazer" }
const STATUS_CURSO: Record<string, string> = { "nao comecou": "nao_comecou", "em andamento": "em_andamento", pausado: "pausado", feito: "concluido", concluido: "concluido" }
const STATUS_EXP: Record<string, string> = { abandonado: "abandonado", concluido: "concluido", pausado: "pausado", "em teste": "em_teste", "a iniciar": "a_iniciar" }
const RESULTADO_EXP: Record<string, string> = { indefinido: "indefinido", "nao funcionou": "nao_funcionou", parcial: "parcial", funcionou: "funcionou" }
const STATUS_CONT: Record<string, string> = { idealizando: "idealizando", gravando: "gravando", editando: "editando", finalizado: "finalizado", publicado: "publicado" }
const STATUS_AREA: Record<string, string> = { "nao iniciado": "nao_iniciada", acontecendo: "ativa", arquivado: "arquivada" }
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

const PAGINAS_SENSIVEIS = ["senhas", "senha", "passwords"]

function n(t: string | undefined) {
  return normalizarNome(t ?? "")
}

export type OpcoesPlano = {
  usuarioId: string
  novoId: () => string
}

/** Colunas de texto que repetem o mesmo valor em quase todas as linhas (cabeçalhos do modelo, como "☀️ R. Matutino"). */
const cacheConstantes = new WeakMap<Banco, Set<string>>()
function colunasConstantes(b: Banco): Set<string> {
  const salvo = cacheConstantes.get(b)
  if (salvo) return salvo
  const saida = new Set<string>()
  if (b.linhas.length >= 5) {
    for (const c of b.colunas) {
      const cont = new Map<string, number>()
      for (const l of b.linhas) {
        const v = (l[c] ?? "").trim()
        if (v) cont.set(v, (cont.get(v) ?? 0) + 1)
      }
      const maior = Math.max(0, ...cont.values())
      if (maior >= b.linhas.length * 0.8) saida.add(c)
    }
  }
  cacheConstantes.set(b, saida)
  return saida
}

export function montarPlano(arquivos: Map<string, Uint8Array>, opcoes: OpcoesPlano): Plano {
  const { usuarioId, novoId } = opcoes
  const avisos: string[] = []
  const linhas: Record<string, Linha[]> = {}
  for (const t of ORDEM_TABELAS) linhas[t] = []
  const add = (t: string, l: Linha) => linhas[t].push(l)

  /* ---------- inventário ---------- */
  const caminhosMd = [...arquivos.keys()].filter((p) => p.toLowerCase().endsWith(".md"))
  const caminhosCsv = [...arquivos.keys()].filter((p) => p.toLowerCase().endsWith(".csv"))

  // Prefere o "_all.csv" (todas as linhas) quando existir.
  const csvPorBase = new Map<string, string>()
  for (const c of caminhosCsv) {
    const base = semExtensao(c)
    const atual = csvPorBase.get(base)
    if (!atual || c.endsWith("_all.csv")) csvPorBase.set(base, c)
  }
  const bancos = [...csvPorBase.values()].map((c) => lerCsv(c, texto(arquivos.get(c)!)))

  // Pastas de linhas: com e sem id no nome
  const bancoDaPasta = new Map<string, Banco>()
  for (const b of bancos) {
    bancoDaPasta.set(b.pastaLinhas, b)
    bancoDaPasta.set(semId(b.pastaLinhas), b)
  }

  // Markdown: separa linhas de banco e páginas soltas
  const linhasMd = new Map<Banco, PaginaMd[]>()
  const paginasSoltas: PaginaMd[] = []
  for (const p of caminhosMd) {
    const dir = dirname(p)
    const banco = bancoDaPasta.get(dir) ?? bancoDaPasta.get(semId(dir))
    const md = lerMarkdown(p, texto(arquivos.get(p)!), Boolean(banco))
    // Linhas do banco "Menu"/"Home" são as páginas do menu (Treino, Viagens…): viram páginas comuns.
    if (banco && destinoDoBanco(banco.chave, banco.colunas) !== "ignorar") linhasMd.set(banco, [...(linhasMd.get(banco) ?? []), md])
    else paginasSoltas.push(md)
  }

  /* ---------- ids do app para cada página / linha do Notion ---------- */
  const appId = new Map<string, string>() // id notion -> id no app
  const rotaDoMd = new Map<string, string>() // caminho .md -> rota no app
  const rotaDoCsv = new Map<string, string>() // caminho .csv -> rota no app
  const idPorTitulo = new Map<string, string>() // destino|titulo -> id app

  const lembrar = (destino: string, titulo: string, id: string) => {
    const k = `${destino}|${n(titulo)}`
    if (!idPorTitulo.has(k)) idPorTitulo.set(k, id)
  }
  const resolver = (destino: string, rels: Relacao[]): string[] =>
    rels
      .map((r) => (r.id && appId.get(r.id)) || idPorTitulo.get(`${destino}|${n(r.titulo)}`))
      .filter((x): x is string => Boolean(x))

  /* ---------- arquivos referenciados ---------- */
  const arquivosPlano = new Map<string, ArquivoPlano>()
  const registrarArquivo = (origem: string): string | null => {
    const bytes = arquivos.get(origem)
    if (!bytes) return null
    const existente = arquivosPlano.get(origem)
    if (existente) return existente.destino
    const limpo = semId(origem)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w./-]+/g, "_")
      .slice(-140)
    const destino = `${usuarioId}/notion/${arquivosPlano.size.toString(36)}-${limpo.split("/").slice(-2).join("_")}`
    arquivosPlano.set(origem, { origem, destino, mime: MIME[extensao(origem)] ?? "application/octet-stream", tamanho: bytes.length, nome: basename(origem) })
    return destino
  }

  /** Reescreve links e imagens do markdown para o app. Rodar depois de todos os ids existirem. */
  const reescrever = (md: string, caminho: string): string => {
    const dir = dirname(caminho)
    const corpo = limparHtml(md)
    return corpo.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (todo, img, rotulo, href) => {
      if (/^(https?:|mailto:|tel:|#)/i.test(href)) return todo
      let alvo: string
      try {
        alvo = juntar(dir, decodeURIComponent(href))
      } catch {
        return todo
      }
      if (alvo.toLowerCase().endsWith(".md")) {
        const rota = rotaDoMd.get(alvo)
        return rota ? `[${rotulo}](${rota})` : rotulo
      }
      if (alvo.toLowerCase().endsWith(".csv")) {
        const rota = rotaDoCsv.get(alvo) ?? rotaDoCsv.get(semExtensao(alvo) + ".csv")
        return rota ? `[${rotulo}](${rota})` : rotulo
      }
      const destino = registrarArquivo(alvo)
      if (!destino) return rotulo
      const ref = `arquivo://${encodeURIComponent(destino)}`
      return img || ehImagem(alvo) ? `![${rotulo}](${ref})` : `[${rotulo || basename(alvo)}](${ref})`
    })
  }

  /* ---------- classificar bancos e dar ids ---------- */
  type Registro = { banco: Banco; destino: Destino; valores: Record<string, string>; md: PaginaMd | null; id: string; notion: string }
  const registros: Registro[] = []
  const vistos = new Set<string>()
  const colecoesPorBanco = new Map<Banco, string>()

  const tituloCol = (b: Banco) => b.colunas[0] ?? "Name"
  const datas = (b: Banco, v: Record<string, string>) =>
    b.colunas
      .filter((c) => lerDataNotion(v[c]))
      .map((c) => v[c])
      .join("|")

  // Bancos com pasta de linhas primeiro (os originais); visões ligadas depois.
  const ordenados = [...bancos].sort((a, b) => Number(linhasMd.has(b)) - Number(linhasMd.has(a)))

  for (const b of ordenados) {
    const destino = destinoDoBanco(b.chave, b.colunas)
    if (destino === "ignorar") continue
    const mds = [...(linhasMd.get(b) ?? [])]
    const tc = tituloCol(b)
    for (const v of b.linhas) {
      const titulo = (v[tc] ?? "").trim()
      const idx = mds.findIndex((m) => n(m.titulo) === n(titulo))
      const md = idx >= 0 ? mds.splice(idx, 1)[0] : null
      const chaveConteudo = `${destino}|${n(titulo)}|${datas(b, v)}`
      const notion = md?.id ?? `${b.id}:${chaveConteudo}`
      if (vistos.has(notion) || (!md && vistos.has(chaveConteudo))) continue
      vistos.add(notion)
      vistos.add(chaveConteudo)
      const id = novoId()
      if (md) {
        appId.set(md.id, id)
      }
      const r: Registro = { banco: b, destino, valores: v, md, id, notion }
      registros.push(r)
      lembrar(destino.startsWith("bookmarks") ? "bookmarks" : destino, titulo, id)
    }
    if (destino === "colecao" && b.linhas.length) {
      // Uma coleção por nome de banco (visões ligadas caem na mesma)
      const existente = [...colecoesPorBanco.entries()].find(([x]) => x.chave === b.chave)
      colecoesPorBanco.set(b, existente ? existente[1] : novoId())
    }
  }

  // Rotas para links internos
  for (const r of registros) {
    if (!r.md) continue
    const rota =
      r.destino === "projects" ? `/projetos/${r.id}`
      : r.destino === "books" ? `/estudos/leitura/${r.id}`
      : r.destino === "captures" ? `/projetos/capturas?abrir=${r.id}`
      : r.destino === "tasks" ? `/rotina/tarefas?abrir=${r.id}`
      : r.destino === "events" ? `/rotina/agenda?abrir=${r.id}`
      : r.destino === "courses" ? `/estudos/cursos?abrir=${r.id}`
      : r.destino === "experiments" ? `/estudos/laboratorio?abrir=${r.id}`
      : r.destino === "content" || r.destino === "ideias" ? `/conteudo/planner?abrir=${r.id}`
      : r.destino === "pages_concursos" ? `/paginas/${r.id}`
      : r.destino === "colecao" ? `/colecoes/item/${r.id}`
      : null
    if (rota) rotaDoMd.set(r.md.caminho, rota)
  }
  const rotaPorDestino: Partial<Record<Destino, string>> = {
    habits: "/rotina/habitos", habit_logs: "/rotina/habitos", goals: "/rotina/metas", goal_months: "/rotina/metas",
    tasks: "/rotina/tarefas", events: "/rotina/agenda", projects: "/projetos", captures: "/projetos/capturas", areas: "/projetos",
    books: "/estudos/leitura", insights_livro: "/estudos/leitura?aba=insights", courses: "/estudos/cursos", exam_subjects: "/estudos/concursos",
    exam_topics: "/estudos/concursos", experiments: "/estudos/laboratorio", insights_lab: "/estudos/laboratorio", content: "/conteudo/planner",
    ideias: "/conteudo/planner", editorial_lines: "/conteudo/planner", "bookmarks:ferramentas": "/links", "bookmarks:favoritos": "/links", "bookmarks:links": "/links",
  }
  for (const b of bancos) {
    const destino = destinoDoBanco(b.chave, b.colunas)
    const rota = destino === "colecao" ? (colecoesPorBanco.get(b) ? `/colecoes/${colecoesPorBanco.get(b)}` : null) : rotaPorDestino[destino]
    if (rota) {
      rotaDoCsv.set(b.caminho, rota)
      rotaDoCsv.set(semExtensao(b.caminho) + ".csv", rota)
    }
  }

  // Páginas soltas: ids e rotas
  const senhaIgnorada: string[] = []
  const paginasValidas = paginasSoltas.filter((p) => {
    if (PAGINAS_SENSIVEIS.includes(n(p.titulo))) {
      senhaIgnorada.push(p.caminho)
      return false
    }
    return true
  })
  const idPagina = new Map<string, string>()
  for (const p of paginasValidas) {
    const id = novoId()
    idPagina.set(p.caminho, id)
    appId.set(p.id, id)
    rotaDoMd.set(p.caminho, `/paginas/${id}`)
  }
  if (senhaIgnorada.length) avisos.push("A página “Senhas” (e suas subpáginas) não foi importada, por segurança.")

  /* ---------- converter cada registro ---------- */
  const corpo = (r: Registro) => (r.md ? reescrever(r.md.corpo, r.md.caminho) : "")
  const get = (r: Registro, ...nomes: string[]) => {
    for (const nome of nomes) {
      const k = r.banco.colunas.find((c) => n(c) === n(nome))
      if (k !== undefined && r.valores[k] !== undefined && r.valores[k] !== "") return r.valores[k]
      const kp = r.md ? Object.keys(r.md.props).find((c) => n(c) === n(nome)) : undefined
      if (kp && r.md!.props[kp]) return r.md!.props[kp]
    }
    return ""
  }
  const titulo = (r: Registro) => (r.valores[tituloCol(r.banco)] ?? r.md?.titulo ?? "").trim()
  const dia = (s: string) => lerDataNotion(s)?.data ?? null

  // Áreas, projetos e hábitos antes (outros apontam para eles)
  const prioridade: Destino[] = ["areas", "projects", "habits", "goals", "books", "exam_subjects", "experiments", "editorial_lines"]
  registros.sort((a, b) => {
    const pa = prioridade.indexOf(a.destino)
    const pb = prioridade.indexOf(b.destino)
    return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb)
  })

  const pais: { tabela: string; id: string; rels: Relacao[]; destino: string; campo: string }[] = []
  const habitoPorNome = new Map<string, string>()
  const marcacoes: Linha[] = []

  for (const r of registros) {
    const t = titulo(r)
    const base = { id: r.id, user_id: usuarioId, notion_id: r.notion }
    switch (r.destino) {
      case "areas":
        add("areas", { ...base, name: t || "Área", status: STATUS_AREA[n(get(r, "Status"))] ?? "ativa", description: corpo(r) || null })
        break
      case "projects": {
        add("projects", {
          ...base,
          name: t || "Projeto",
          done: lerBool(get(r, "Finalizado")),
          archived: lerBool(get(r, "Arquivar")),
          deadline: dia(get(r, "Prazo")),
          publish_date: dia(get(r, "Publicação")),
          description: corpo(r) || null,
          position: linhas.projects.length,
        })
        pais.push({ tabela: "projects", id: r.id, rels: lerRelacao(get(r, "Projeto")), destino: "projects", campo: "parent_id" })
        break
      }
      case "captures": {
        const anexos = lerRelacao(get(r, "Anexos"))
        let conteudo = corpo(r)
        const extras = lerLista(get(r, "Anexos"))
          .map((a) => registrarArquivo(juntar(dirname(r.banco.caminho), a)))
          .filter(Boolean)
          .map((d) => `- [Anexo](arquivo://${encodeURIComponent(d!)})`)
        if (extras.length && !anexos.length) conteudo = [conteudo, "**Anexos**", ...extras].filter(Boolean).join("\n\n")
        const criado = lerDataNotion(get(r, "Data de Criação"))
        add("captures", {
          ...base,
          title: t || get(r, "Link") || "Sem título",
          kind: get(r, "Tipo") || null,
          category: get(r, "Categoria") || null,
          tags: lerLista(get(r, "Tags")),
          url: get(r, "Link") || null,
          content: conteudo || null,
          archived: lerBool(get(r, "Arquivar")),
          captured_at: criado ? paraTimestamp(criado) : new Date().toISOString(),
        })
        pais.push({ tabela: "captures", id: r.id, rels: lerRelacao(get(r, "Área")), destino: "areas", campo: "area_id" })
        pais.push({ tabela: "capture_projects", id: r.id, rels: lerRelacao(get(r, "Projeto")), destino: "projects", campo: "project_id" })
        break
      }
      case "habits":
        add("habits", { ...base, name: t || "Hábito", active: n(get(r, "Status")) !== "inativo", position: linhas.habits.length + 1, description: corpo(r) || null })
        habitoPorNome.set(n(t), r.id)
        break
      case "habit_logs": {
        const d = dia(get(r, "Data")) ?? dia(t)
        if (!d) break
        const constantes = colunasConstantes(r.banco)
        const nota: Record<string, string> = {}
        for (const c of r.banco.colunas) {
          const v = r.valores[c] ?? ""
          if (c === tituloCol(r.banco) || n(c) === "data") continue
          if (ehBool(v)) {
            if (lerBool(v)) marcacoes.push({ nomeHabito: c.trim(), day: d })
          } else if (v.trim() && !["dia da semana", "progresso"].includes(n(c)) && !constantes.has(c) && !/^[\s\-—–_.·•]+$/.test(v)) {
            nota[c.trim()] = v.trim()
          }
        }
        if (t && !lerDataNotion(t) && !constantes.has(tituloCol(r.banco))) nota[tituloCol(r.banco)] = t
        const obs = nota["Observação"] ?? null
        delete nota["Observação"]
        if (obs || Object.keys(nota).length) add("day_notes", { user_id: usuarioId, day: d, note: obs, extra: { ...nota, importado: true } })
        break
      }
      case "goals": {
        const alvo = lerNumero(get(r, "Qtd. Meta"))
        const feito = lerNumero(get(r, "Qtd. Feito")) ?? 0
        add("goals", { ...base, name: t || "Meta", tags: lerLista(get(r, "Tipo")), year: lerNumero(get(r, "Ano")), target: alvo, progress: feito, reward: get(r, "Recompensa") || null, done: Boolean(alvo && feito >= alvo), description: corpo(r) || null, position: linhas.goals.length + 1 })
        break
      }
      case "goal_months": {
        const mes = MESES.indexOf(n(get(r, "Período")).slice(0, 3)) + 1
        if (!mes) break
        const metas = resolver("goals", lerRelacao(get(r, "Meta")))
        const ano = lerNumero(get(r, "Ano")) ?? linhas.goals.find((g) => g.id === metas[0])?.year ?? new Date().getFullYear()
        add("goal_months", { ...base, goal_id: metas[0] ?? null, year: ano, month: mes, target: lerNumero(get(r, "Qtd. Meta")), progress: lerNumero(get(r, "Qnt. Feito", "Qtd. Feito")) ?? 0, note: t || null })
        break
      }
      case "tasks": {
        const venc = lerDataNotion(get(r, "Vencimento"))
        const status = STATUS_TAREFA[n(get(r, "Status"))] ?? "todo"
        const criado = lerDataNotion(get(r, "Tarefa criada em"))
        add("tasks", {
          ...base,
          title: t || "Tarefa",
          status,
          kind: n(get(r, "Tipo")) === "rotina" ? "rotina" : "tarefa",
          priority: PRIORIDADE[n(get(r, "L - Tríade do Tempo"))] ?? null,
          due_date: venc?.data ?? null,
          due_time: venc?.hora ?? null,
          description: corpo(r) || null,
          done_at: status === "done" ? (venc ? paraTimestamp(venc) : criado ? paraTimestamp(criado) : new Date().toISOString()) : null,
          position: linhas.tasks.length + 1,
        })
        pais.push({ tabela: "tasks", id: r.id, rels: lerRelacao(get(r, "Projeto", "Projetos", "Projetos_SB")), destino: "projects", campo: "project_id" })
        break
      }
      case "events": {
        const { inicio, fim } = lerIntervalo(get(r, "Data"))
        if (!inicio) break
        add("events", {
          ...base,
          title: t || "Compromisso",
          starts_at: paraTimestamp(inicio),
          ends_at: fim ? paraTimestamp(fim) : null,
          all_day: !inicio.hora,
          category: get(r, "Categoria") || null,
          done: lerBool(get(r, "Status")),
          description: [get(r, "Observação"), corpo(r)].filter(Boolean).join("\n\n") || null,
        })
        break
      }
      case "bookmarks:ferramentas":
      case "bookmarks:favoritos":
      case "bookmarks:links": {
        const grupo = r.destino.split(":")[1]
        const url = get(r, "URL", "Site", "Link") || null
        add("bookmarks", {
          ...base,
          title: t || url || "Link",
          url,
          collection: grupo,
          tags: grupo === "ferramentas" ? lerLista(get(r, "Tags")) : grupo === "favoritos" ? lerLista(get(r, "Tipo")) : [],
          kind: grupo === "favoritos" ? null : get(r, "Tipo") || null,
          description: corpo(r) || null,
          position: linhas.bookmarks.length + 1,
        })
        break
      }
      case "books": {
        const total = lerNumero(get(r, "Páginas Total"))
        const lidas = lerNumero(get(r, "Páginas Lidas")) ?? 0
        const anos = lerLista(get(r, "Ano de Leitura")).map(Number).filter(Boolean)
        const fimL = dia(get(r, "Data de Término"))
        const adquirido = lerBool(get(r, "Adquirido"))
        let status = "lendo"
        if ((total && lidas >= total) || fimL || (anos.length && !lidas)) status = "finalizado"
        else if (lerBool(get(r, "Pausado"))) status = "pausado"
        else if (!adquirido && !lidas) status = "desejo"
        add("books", {
          ...base,
          title: t || "Livro",
          author: get(r, "Autor 1", "Autor") || null,
          category: get(r, "Categoria") || null,
          status,
          pages_total: total,
          pages_read: status === "finalizado" && total ? Math.max(lidas, total) : lidas,
          rating: estrelas(get(r, "Nota")),
          started_at: dia(get(r, "Data de Início")),
          finished_at: fimL,
          read_years: anos,
          favorite: lerBool(get(r, "Favorito")),
          summary: get(r, "Resumo") || null,
          notes: corpo(r) || null,
        })
        break
      }
      case "insights_livro": {
        const livro = resolver("books", lerRelacao(get(r, "Livro")))[0] ?? null
        add("insights", { ...base, text: t || "Insight", source: livro ? "livro" : "pessoal", book_id: livro, noted_on: dia(get(r, "Data")), details: corpo(r) || null })
        break
      }
      case "courses":
        add("courses", {
          ...base,
          name: t || "Curso",
          categories: lerLista(get(r, "Categoria")),
          status: STATUS_CURSO[n(get(r, "Status"))] ?? "nao_comecou",
          url: get(r, "Link de acesso") || null,
          access_email: get(r, "E-mail de acesso") || null,
          notes: corpo(r) || null,
          position: linhas.courses.length + 1,
        })
        break
      case "exam_subjects":
        add("exam_subjects", { ...base, name: t || "Disciplina", notes: corpo(r) || null, position: linhas.exam_subjects.length + 1 })
        break
      case "exam_topics": {
        const disc = resolver("exam_subjects", lerRelacao(get(r, "Disciplina")))[0] ?? null
        add("exam_topics", { ...base, name: t || "Assunto", subject_id: disc, questions: lerNumero(get(r, "N° Questões", "Nº Questões")) ?? 0, correct: lerNumero(get(r, "Acertos")) ?? 0, notes: corpo(r) || null, position: linhas.exam_topics.length + 1 })
        pais.push({ tabela: "exam_topics", id: r.id, rels: lerRelacao(get(r, "item principal")), destino: "exam_topics", campo: "parent_id" })
        break
      }
      case "experiments":
        add("experiments", {
          ...base,
          name: t || "Experimento",
          kind: get(r, "Tipo de Experimento") || null,
          status: STATUS_EXP[n(get(r, "Status"))] ?? "a_iniciar",
          result: RESULTADO_EXP[n(get(r, "Resultado"))] ?? "indefinido",
          starts_on: dia(get(r, "Início")),
          ends_on: dia(get(r, "Fim")),
          notes: corpo(r) || null,
        })
        break
      case "insights_lab": {
        const exp = resolver("experiments", lerRelacao(get(r, "Origem")))[0] ?? null
        add("insights", { ...base, text: t || "Insight", source: "laboratorio", experiment_id: exp, kind: get(r, "Tipo") || null, potential: get(r, "Potencial") || null, noted_on: dia(get(r, "Data")), details: corpo(r) || null })
        break
      }
      case "editorial_lines":
        add("editorial_lines", { ...base, name: t || "Linha", tags: lerLista(get(r, "Tags")), description: corpo(r) || null, position: linhas.editorial_lines.length + 1 })
        break
      case "content": {
        const linha = resolver("editorial_lines", lerRelacao(get(r, "Linhas Editoriais")))[0] ?? null
        add("content_items", {
          ...base,
          title: t || "Conteúdo",
          status: STATUS_CONT[n(get(r, "Status"))] ?? "idealizando",
          format: get(r, "Tipo") || null,
          editorial_line_id: linha,
          platforms: lerRelacao(get(r, "Plataformas")).map((p) => p.titulo).filter(Boolean),
          publish_date: dia(get(r, "Data de publicação")),
          media_url: get(r, "Mídia URL") || null,
          reference_url: get(r, "Post de referência") || null,
          views: lerNumero(get(r, "Visualizações")),
          likes: lerNumero(get(r, "Curtidas")),
          comments: lerNumero(get(r, "Comentários")),
          shares: lerNumero(get(r, "Compartilhamentos")),
          script: corpo(r) || null,
          position: linhas.content_items.length + 1,
        })
        break
      }
      case "ideias": {
        const linha = resolver("editorial_lines", lerRelacao(get(r, "Linha Editorial")))[0] ?? null
        const link = get(r, "Link da publicação")
        add("content_items", {
          ...base,
          title: t || "Ideia",
          status: link ? "publicado" : "ideia",
          editorial_line_id: linha,
          idea_type: get(r, "Tipo") || null,
          publish_date: dia(get(r, "Data de publicação")),
          published_url: link || null,
          script: corpo(r) || null,
          position: linhas.content_items.length + 1,
        })
        break
      }
      case "pages_concursos":
        add("pages", { ...base, title: t || "Página", section: "concursos", content: corpo(r), parent_id: null, position: linhas.pages.length + 1, source_path: r.md?.caminho ?? null })
        break
      case "plataformas":
        break
      case "colecao": {
        const colecao = colecoesPorBanco.get(r.banco)
        if (!colecao) break
        const props: Record<string, any> = {}
        let capa: string | null = null
        for (const c of r.banco.colunas) {
          if (c === tituloCol(r.banco)) continue
          const v = r.valores[c] ?? ""
          if (!v) continue
          if (ehBool(v)) props[c] = lerBool(v)
          else if (/\.md\)/.test(v)) props[c] = lerRelacao(v).map((x) => x.titulo)
          else if (lerDataNotion(v) && !/^\d+([.,]\d+)?$/.test(v)) props[c] = lerIntervalo(v).inicio?.data ?? v
          else if (/^-?\d+([.,]\d+)?$/.test(v.trim())) props[c] = lerNumero(v)
          else {
            const arq = arquivos.has(juntar(dirname(r.banco.caminho), v)) ? juntar(dirname(r.banco.caminho), v) : null
            if (arq) {
              const destino = registrarArquivo(arq)
              if (destino && ehImagem(arq) && !capa) capa = destino
              props[c] = destino ? `arquivo://${encodeURIComponent(destino)}` : v
            } else props[c] = v
          }
        }
        add("collection_items", { ...base, collection_id: colecao, title: t, props, content: corpo(r) || null, cover_path: capa, position: linhas.collection_items.length + 1 })
        break
      }
    }
  }

  /* ---------- hábitos a partir das colunas do registro diário ---------- */
  // Nomes do cadastro, para casar "Dicção" com "Treino de Dicção" (só palavra inteira, nunca "Yourself" com "Yourself II")
  const nomesCadastro = new Map(habitoPorNome)
  const palavras = (t: string) => t.split(" ").filter(Boolean)
  const acharHabito = (nome: string): string | null => {
    const k = n(nome)
    if (habitoPorNome.has(k)) return habitoPorNome.get(k)!
    const candidatos = [...nomesCadastro].filter(([nomeH]) => {
      const a = palavras(nomeH)
      const b = palavras(k)
      const [menor, maior] = a.length <= b.length ? [a, b] : [b, a]
      return menor.length > 0 && menor.every((w) => maior.includes(w)) && !/\b(ii|iii|2|3)\b/.test(maior.filter((w) => !menor.includes(w)).join(" "))
    })
    return candidatos.length === 1 ? candidatos[0][1] : null
  }
  const ultimoUso = new Map<string, string>()
  const garantirHabito = (nome: string): string => {
    let id = acharHabito(nome)
    if (!id) {
      id = novoId()
      habitoPorNome.set(n(nome), id)
      add("habits", { id, user_id: usuarioId, notion_id: `habito:${n(nome)}`, name: nome, active: false, position: linhas.habits.length + 1 })
    }
    return id
  }
  // Toda coluna de caixa de seleção do registro diário é um hábito, mesmo sem marcações
  for (const b of bancos) {
    if (destinoDoBanco(b.chave, b.colunas) !== "habit_logs" || !b.linhas.length) continue
    for (const c of b.colunas) {
      if (c === tituloCol(b) || n(c) === "data") continue
      if (b.linhas.some((l) => l[c]?.trim()) && b.linhas.every((l) => !l[c]?.trim() || ehBool(l[c]))) garantirHabito(c.trim())
    }
  }
  for (const m of marcacoes) {
    const id = garantirHabito(m.nomeHabito)
    if (!ultimoUso.has(id) || ultimoUso.get(id)! < m.day) ultimoUso.set(id, m.day)
    add("habit_logs", { user_id: usuarioId, habit_id: id, day: m.day })
  }
  // Hábitos criados só pelo registro ficam ativos se usados nos últimos 90 dias
  const corte = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
  for (const h of linhas.habits) if (!h.active && h.notion_id?.startsWith("habito:") && (ultimoUso.get(h.id) ?? "") >= corte) h.active = true
  // remove marcações repetidas
  const chavesLog = new Set<string>()
  linhas.habit_logs = linhas.habit_logs.filter((l) => {
    const k = `${l.habit_id}|${l.day}`
    if (chavesLog.has(k)) return false
    chavesLog.add(k)
    return true
  })
  const chavesDia = new Set<string>()
  linhas.day_notes = linhas.day_notes.filter((l) => (chavesDia.has(l.day) ? false : (chavesDia.add(l.day), true)))

  /* ---------- relações de pai, área e projeto ---------- */
  const porId = (tabela: string) => new Map(linhas[tabela].map((l) => [l.id, l]))
  const mapas: Record<string, Map<string, Linha>> = { projects: porId("projects"), captures: porId("captures"), exam_topics: porId("exam_topics"), tasks: porId("tasks") }
  for (const p of pais) {
    const alvos = resolver(p.destino, p.rels).filter((x) => x !== p.id)
    if (!alvos.length) continue
    if (p.tabela === "capture_projects") {
      for (const projeto of new Set(alvos)) add("capture_projects", { user_id: usuarioId, capture_id: p.id, project_id: projeto })
    } else {
      const linha = mapas[p.tabela]?.get(p.id)
      if (linha) linha[p.campo] = alvos[0]
    }
  }
  // Áreas dos projetos herdadas das capturas não existem no Notion; áreas ficam só nas capturas.

  /* ---------- coleções ---------- */
  const colecoesFeitas = new Set<string>()
  for (const [b, id] of colecoesPorBanco) {
    if (colecoesFeitas.has(id)) continue
    colecoesFeitas.add(id)
    const schema = b.colunas.slice(1).map((c) => {
      const valores = b.linhas.map((l) => l[c]).filter(Boolean)
      let type = "text"
      if (valores.length && valores.every(ehBool)) type = "checkbox"
      else if (valores.some((v) => /\.md\)/.test(v))) type = "multi_select"
      else if (valores.length && valores.every((v) => /^-?\d+([.,]\d+)?$/.test(v.trim()))) type = "number"
      else if (valores.length && valores.every((v) => lerDataNotion(v))) type = "date"
      else if (valores.length && valores.every((v) => /^https?:\/\//.test(v))) type = "url"
      else if (valores.length && new Set(valores).size <= Math.max(3, valores.length / 3) && valores.every((v) => v.length < 40)) type = "select"
      return { name: c, type }
    })
    add("collections", { id, user_id: usuarioId, notion_id: b.id, name: b.nome.replace(/^Database:\s*/i, ""), section: "outros", schema, position: linhas.collections.length + 1 })
  }

  /* ---------- páginas soltas ---------- */
  const paginaDoCaminho = new Map(paginasValidas.map((p) => [semExtensao(p.caminho), p]))
  const paginaPorPastaSemId = new Map(paginasValidas.map((p) => [semId(semExtensao(p.caminho)), p]))
  const paiDe = (p: PaginaMd): PaginaMd | null => {
    const dir = dirname(p.caminho)
    if (!dir) return null
    return paginaDoCaminho.get(dir) ?? paginaPorPastaSemId.get(semId(dir)) ?? null
  }
  const secaoDe = (p: PaginaMd): string => {
    let atual: PaginaMd | null = p
    const titulos: string[] = []
    for (let i = 0; atual && i < 30; i++) {
      titulos.push(n(atual.titulo))
      atual = paiDe(atual)
    }
    const tem = (t: string) => titulos.some((x) => x.includes(t))
    if (tem("dominando a ia") || tem("criacao de conteudo infinito") || tem("gpt prompts") || tem("pack de prompts")) return "biblioteca"
    if (tem("planner de conteudo") || tem("como editar seus reels")) return "planner"
    if (tem("sca - concursos") || tem("sca concursos")) return "concursos"
    if (tem("pessoal") || tem("wiki")) return "wiki"
    if (tem("00 - anotacoes") || tem("anotacoes")) return "notas"
    if (tem("03 - recursos")) return "recursos"
    if (tem("04 - arquivos")) return "arquivo"
    return "geral"
  }
  // senhas: tudo abaixo da página "Senhas" também fica de fora
  const abaixoDeSenha = (p: PaginaMd) => senhaIgnorada.some((c) => p.caminho.startsWith(semExtensao(c) + "/"))
  const ordemPaginas: PaginaMd[] = []
  const visitado = new Set<string>()
  const visitar = (p: PaginaMd) => {
    if (visitado.has(p.caminho)) return
    visitado.add(p.caminho)
    const pai = paiDe(p)
    if (pai) visitar(pai)
    ordemPaginas.push(p)
  }
  paginasValidas.forEach(visitar)
  let pos = 0
  for (const p of ordemPaginas) {
    if (abaixoDeSenha(p)) continue
    const pai = paiDe(p)
    add("pages", {
      id: idPagina.get(p.caminho),
      user_id: usuarioId,
      notion_id: p.id,
      title: p.titulo || "Sem título",
      parent_id: pai && !abaixoDeSenha(pai) ? (idPagina.get(pai.caminho) ?? null) : null,
      section: secaoDe(p),
      content: reescrever(p.corpo, p.caminho),
      position: pos++,
      source_path: p.caminho,
    })
  }

  /* ---------- ordem de inserção para tabelas com pai ---------- */
  for (const t of ["projects", "exam_topics"]) {
    const lista = linhas[t]
    const ids = new Map(lista.map((l) => [l.id, l]))
    const ordenada: Linha[] = []
    const ok = new Set<string>()
    const pôr = (l: Linha, prof = 0) => {
      if (ok.has(l.id) || prof > 50) return
      if (l.parent_id && ids.has(l.parent_id)) pôr(ids.get(l.parent_id)!, prof + 1)
      else if (l.parent_id) l.parent_id = null
      ok.add(l.id)
      ordenada.push(l)
    }
    lista.forEach((l) => pôr(l))
    linhas[t] = ordenada
  }

  const cursoComSenha = bancos.some((b) => destinoDoBanco(b.chave, b.colunas) === "courses" && b.colunas.some((c) => n(c).includes("senha")))
  if (cursoComSenha) avisos.push("As senhas de acesso dos cursos não foram importadas. Guarde-as em um gerenciador de senhas.")
  if (!caminhosMd.length && !caminhosCsv.length) avisos.push("O arquivo não parece ser uma exportação do Notion em Markdown & CSV.")

  return { linhas, arquivos: [...arquivosPlano.values()], avisos }
}

export function resumoPlano(plano: Plano) {
  return ORDEM_TABELAS.map((t) => ({ tabela: t, nome: nomeTabela(t), total: plano.linhas[t]?.length ?? 0 })).filter((x) => x.total > 0)
}
