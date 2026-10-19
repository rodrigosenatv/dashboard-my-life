/*
 * Pessoal: a lógica sem tela. O diário, os aniversários, os contatos e a wiki são itens de quatro
 * coleções (criadas pelo import do Notion ou pela própria tela); as frases do dia vêm do texto da
 * página "Pessoal". Nada aqui fala com o banco nem com o React.
 */
import { differenceInCalendarDays, startOfYear } from "date-fns"
import type { Colecao, ItemColecao } from "@/features/colecoes/visao-colecao"
import { lerIntervalo } from "@/features/importar/valores"
import type { Json } from "@/lib/supabase/database.types"
import { formatar, isoDia, lerData, normalizar, plural, primeiroNome } from "@/lib/utils"

export const TAG_DIARIO = "Diário"
export const TAG_ESPECIAL = "Ocasiões Especiais"
export const CATEGORIAS_WIKI = ["Informações Pessoais", "Saúde", "Minha História", "Aprendizados", "Profissional", "Social"] as const
export const SEM_CATEGORIA = "Sem categoria"
export const ROTA_PESSOAL = "/vida/pessoal"

const valores = (i: Pick<ItemColecao, "props">) => (i.props ?? {}) as Record<string, Json>

/* ------------------------------------------------------------------ */
/* Valores gravados                                                    */
/* ------------------------------------------------------------------ */

/** Texto de um valor gravado: sem espaços das pontas; número vira texto; o resto vira vazio. */
export function texto(v: Json | undefined): string {
  if (typeof v === "string") return v.trim()
  if (typeof v === "number") return String(v)
  return ""
}

/**
 * O valor da primeira coluna que existir entre os nomes: a chave exata, ou a que tem o mesmo nome
 * sem acento e sem maiúscula (o Notion exporta "E-mail" ou "Email", conforme a versão).
 */
export function valorPorNome(props: Record<string, Json>, nomes: string[]): Json | undefined {
  for (const nome of nomes) {
    // hasOwn: sem isso, "toString" e outros nomes do protótipo "achariam" uma coluna
    if (Object.hasOwn(props, nome)) return props[nome]
    const chave = Object.keys(props).find((k) => normalizar(k) === normalizar(nome))
    if (chave !== undefined) return props[chave]
  }
  return undefined
}

/** Lista gravada como array ou como texto separado por vírgula ("Família, Amigo(a)"). */
export function lerLista(v: Json | undefined): string[] {
  if (Array.isArray(v)) return v.map(texto).filter(Boolean)
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean)
  return []
}

/** Data AAAA-MM-DD de um valor gravado: ISO (com ou sem hora), dd/mm/aaaa ou texto do Notion. */
export function lerDiaFlex(v: Json | undefined): string | null {
  const t = texto(v).replace(/^@/, "").trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(t) && lerData(t.slice(0, 10))) return t.slice(0, 10)
  return lerIntervalo(t).inicio?.data ?? null
}

/**
 * Grava um campo na coluna que o item já usa entre estes nomes (o Notion pode ter "Telefone" no
 * lugar de "Celular"), ou no primeiro nome. As outras grafias saem, para um valor apagado não voltar
 * pela coluna antiga. Vazio apaga.
 */
export function gravarCampo(props: Record<string, Json>, nomes: string[], valor: string) {
  const existentes = Object.keys(props).filter((k) => nomes.some((n) => normalizar(n) === normalizar(k)))
  const chave = nomes.map((n) => existentes.find((k) => normalizar(k) === normalizar(n))).find((k) => k !== undefined) ?? nomes[0]
  for (const k of existentes) delete props[k]
  if (valor) props[chave] = valor
}

/** Primeira letra em maiúscula. */
export function capitalizar(t: string): string {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t
}

/* ------------------------------------------------------------------ */
/* Texto curto de um markdown                                          */
/* ------------------------------------------------------------------ */

/** Um trecho de uma linha só, sem marcas de markdown ou HTML, com "…" quando corta. */
export function resumoDoTexto(md: string | null | undefined, max = 140): string {
  const limpo = (md ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Um título vira o começo da frase: com ponto no fim, para não grudar no texto que vem depois
    .replace(/^#{1,6}[ \t]*(.*?)[ \t]*$/gm, (_, t: string) => (!t || /[.!?:…]$/.test(t) ? t : `${t}.`))
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/gm, "")
    .replace(/[*_~`]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (limpo.length <= max) return limpo
  let corte = limpo.slice(0, max - 1)
  const espaco = corte.lastIndexOf(" ")
  // Só volta até o último espaço se ele não cair logo no começo do trecho
  if (espaco > max / 2) corte = corte.slice(0, espaco)
  return corte.replace(/[\s.,;:!?\-–—]+$/, "") + "…"
}

/* ------------------------------------------------------------------ */
/* Diário                                                              */
/* ------------------------------------------------------------------ */

export type EntradaDiario = { item: ItemColecao; id: string; data: string /* AAAA-MM-DD */; titulo: string | null; texto: string; especial: boolean }

/** Compara textos que são datas ou marcas de tempo ISO (a ordem alfabética é a da data). */
const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Uma linha do diário: a data (ou o título, ou a criação), o título só se for um título de verdade. */
export function lerEntradaDiario(item: ItemColecao): EntradaDiario {
  const props = valores(item)
  // Sem data nenhuma, vale o dia em que foi criada, no fuso de quem usa (o banco guarda em UTC)
  const criada = lerData(item.created_at)
  const data = lerDiaFlex(valorPorNome(props, ["Data", "Dia"])) ?? lerDiaFlex(item.title) ?? (criada ? isoDia(criada) : item.created_at.slice(0, 10))
  const titulo = item.title.replace(/^@/, "").trim()
  // O Notion põe a data no título quando a entrada não tinha um: isso não é um título
  const tituloVisivel = titulo && !lerDiaFlex(titulo) && !["hoje", "sem titulo"].includes(normalizar(titulo)) ? titulo : null
  const especial = lerLista(valorPorNome(props, ["Tags", "Tag", "Tipo"])).some((t) => normalizar(t).startsWith("ocasi"))
  return { item, id: item.id, data, titulo: tituloVisivel, texto: item.content ?? "", especial }
}

/** Da data mais recente para a mais antiga; no mesmo dia, a criada por último primeiro. */
export function ordenarDiario(lista: EntradaDiario[]): EntradaDiario[] {
  return [...lista].sort((a, b) => comparar(b.data, a.data) || comparar(b.item.created_at, a.item.created_at))
}

/** A entrada de hoje (se houver mais de uma, a criada por último). */
export function entradaDeHoje(lista: EntradaDiario[], hoje: string): EntradaDiario | null {
  let achada: EntradaDiario | null = null
  for (const e of lista) {
    if (e.data !== hoje) continue
    if (!achada || comparar(e.item.created_at, achada.item.created_at) > 0) achada = e
  }
  return achada
}

/** As entradas deste mesmo dia (dia e mês) em anos anteriores, do mais recente para o mais antigo. */
export function nesteDia(lista: EntradaDiario[], hoje: string): { entrada: EntradaDiario; anos: number }[] {
  return lista
    .filter((e) => e.data.slice(5) === hoje.slice(5) && Number(e.data.slice(0, 4)) < Number(hoje.slice(0, 4)))
    .map((entrada) => ({ entrada, anos: Number(hoje.slice(0, 4)) - Number(entrada.data.slice(0, 4)) }))
    .sort((a, b) => a.anos - b.anos)
}

export const textoHaAnos = (anos: number) => `Há ${plural(anos, "ano")}`

export const tituloDoDia = (hoje: string) => formatar(hoje, "d 'de' MMMM 'de' yyyy")

export const cabecalhoDoDia = (hoje: string) => capitalizar(formatar(hoje, "EEEE, d 'de' MMMM"))

/** "Hoje", "Ontem", "Quinta, 15 out" (mesmo ano) ou "18 out 2025" (outro ano). */
export function rotuloDoDia(data: string, hoje: string): string {
  const d = differenceInCalendarDays(lerData(data)!, lerData(hoje)!)
  if (d === 0) return "Hoje"
  if (d === -1) return "Ontem"
  if (data.slice(0, 4) === hoje.slice(0, 4)) return capitalizar(formatar(data, "EEE, d MMM"))
  return formatar(data, "d MMM yyyy")
}

/* ------------------------------------------------------------------ */
/* Aniversários                                                        */
/* ------------------------------------------------------------------ */

export type Aniversario = { item: ItemColecao; id: string; nome: string; nascimento: string | null; celular: string; contatos: string[] }
export type ProximoAniversario = { aniversario: Aniversario; data: string; dias: number; idade: number | null }

export function lerAniversario(item: ItemColecao): Aniversario {
  const props = valores(item)
  // Um celular digitado como número chega sem o texto: lerLista só lê texto e lista
  const celular = valorPorNome(props, ["Celular", "Telefone", "WhatsApp"])
  return {
    item,
    id: item.id,
    nome: item.title.trim() || "Sem nome",
    nascimento: lerDiaFlex(valorPorNome(props, ["Data de nascimento", "Nascimento", "Aniversário", "Data"])),
    celular: lerLista(typeof celular === "number" ? String(celular) : celular)[0] ?? "",
    contatos: lerLista(valorPorNome(props, ["Contato", "Contatos"])),
  }
}

const ehBissexto = (ano: number) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0

/**
 * O ano gravado quando a pessoa não sabe o ano de nascimento: qualquer ano antes de 1901 vale como
 * "desconhecido". 1900 não é bissexto, então quem faz anos em 29/02 fica em 1896.
 */
export const anoDesconhecido = (mesDia: string) => (mesDia === "02-29" ? "1896" : "1900")

/** A data de nascimento foi gravada sem o ano. */
export const nascimentoSemAno = (nascimento: string | null | undefined) => Boolean(nascimento) && Number(nascimento!.slice(0, 4)) < 1901

/** Ano para mostrar uma data sem ano num campo de data: o atual, ou o último bissexto para 29/02. */
export function anoParaMostrar(mesDia: string, anoAtual: number): number {
  if (mesDia !== "02-29") return anoAtual
  let ano = anoAtual
  while (!ehBissexto(ano)) ano--
  return ano
}

/** A data do aniversário num ano; 29/02 em ano que não é bissexto vira 28/02. */
function dataNoAno(nascimento: string, ano: number): string {
  const mes = nascimento.slice(5, 7)
  const dia = nascimento.slice(8, 10)
  if (mes === "02" && dia === "29" && !ehBissexto(ano)) return `${ano}-02-28`
  return `${String(ano).padStart(4, "0")}-${mes}-${dia}`
}

/** Quando é o próximo aniversário (hoje conta) e quantos anos a pessoa faz. 1900 = ano desconhecido. */
export function proximoAniversario(a: Aniversario, hoje: string): ProximoAniversario | null {
  if (!a.nascimento) return null
  const anoHoje = Number(hoje.slice(0, 4))
  let data = dataNoAno(a.nascimento, anoHoje)
  if (data < hoje) data = dataNoAno(a.nascimento, anoHoje + 1)
  const dias = differenceInCalendarDays(lerData(data)!, lerData(hoje)!)
  const anoData = Number(data.slice(0, 4))
  const anoNascimento = Number(a.nascimento.slice(0, 4))
  const idade = anoNascimento >= 1901 && anoNascimento < anoData ? anoData - anoNascimento : null
  return { aniversario: a, data, dias, idade }
}

/** Os próximos aniversários, do mais perto para o mais longe (o nome desempata). */
export function proximosAniversarios(lista: Aniversario[], hoje: string): ProximoAniversario[] {
  return lista
    .map((a) => proximoAniversario(a, hoje))
    .filter((p): p is ProximoAniversario => p !== null)
    .sort((a, b) => a.dias - b.dias || a.aniversario.nome.localeCompare(b.aniversario.nome, "pt-BR"))
}

/** "Hoje · 31 anos", "Amanhã · 45 anos", "Em 4 dias · quinta, 22 out · 28 anos", "Sábado, 7 nov". */
export function linhaDoAniversario(p: ProximoAniversario): string {
  const partes: string[] = []
  if (p.dias === 0) partes.push("Hoje")
  else if (p.dias === 1) partes.push("Amanhã")
  else if (p.dias <= 6) partes.push(`Em ${p.dias} dias`, formatar(p.data, "EEE, d MMM"))
  else partes.push(formatar(p.data, "EEE, d MMM"))
  if (p.idade !== null) partes.push(plural(p.idade, "ano"))
  return capitalizar(partes.join(" · "))
}

/** O celular do aniversariante ou, na falta, o de um contato com o mesmo nome. */
export function celularDoAniversario(a: Aniversario, contatos: Contato[]): string {
  if (a.celular) return a.celular
  const nomes = new Set([normalizar(a.nome), ...a.contatos.map(normalizar)])
  return contatos.find((c) => c.celular && nomes.has(normalizar(c.nome)))?.celular ?? ""
}

export const mensagemParabens = (nome: string) => `Feliz aniversário, ${primeiroNome(nome)}! 🎉`

/* ------------------------------------------------------------------ */
/* Contatos e telefones                                                */
/* ------------------------------------------------------------------ */

export type Contato = { item: ItemColecao; id: string; nome: string; celular: string; email: string; endereco: string; categorias: string[] }

export function lerContato(item: ItemColecao): Contato {
  const props = valores(item)
  return {
    item,
    id: item.id,
    nome: item.title.trim() || "Sem nome",
    celular: texto(valorPorNome(props, ["Celular", "Telefone", "WhatsApp", "Fone"])),
    email: texto(valorPorNome(props, ["E-mail", "Email"])),
    endereco: texto(valorPorNome(props, ["Endereço", "Endereco"])),
    categorias: lerLista(valorPorNome(props, ["Categoria", "Categorias", "Tags"])),
  }
}

export const ordenarContatos = (lista: Contato[]) => [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))

/** Quantos contatos há em cada categoria (a grafia de quem aparece primeiro), das mais usadas para as menos. */
export function categoriasDosContatos(lista: Contato[]): { nome: string; total: number }[] {
  const porChave = new Map<string, { nome: string; total: number }>()
  for (const c of lista) {
    const vistas = new Set<string>()
    for (const cat of c.categorias) {
      const chave = normalizar(cat)
      if (vistas.has(chave)) continue
      vistas.add(chave)
      const atual = porChave.get(chave)
      if (atual) atual.total++
      else porChave.set(chave, { nome: cat, total: 1 })
    }
  }
  return [...porChave.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"))
}

/** Só os dígitos de um texto. */
export const digitos = (t: string) => t.replace(/\D/g, "")

/**
 * Busca por nome, e-mail ou categoria; com 3 ou mais dígitos, também pelo celular. A categoria,
 * quando escolhida, é um filtro à parte.
 */
export function buscarContatos(lista: Contato[], busca: string | null, categoria: string | null): Contato[] {
  const cat = categoria ? normalizar(categoria) : null
  const termo = normalizar(busca)
  const numero = digitos(busca ?? "")
  return lista.filter((c) => {
    if (cat && !c.categorias.some((x) => normalizar(x) === cat)) return false
    if (!termo) return true
    if (normalizar(c.nome).includes(termo) || normalizar(c.email).includes(termo)) return true
    if (c.categorias.some((x) => normalizar(x).includes(termo))) return true
    return numero.length >= 3 && digitos(c.celular).includes(numero)
  })
}

/** Até duas letras: a 1ª da primeira palavra e a da última (sem "de", "da", "do"…). */
export function iniciais(nome: string): string {
  const particulas = ["de", "da", "do", "dos", "das", "e"]
  const palavras = nome.trim().split(/\s+/).filter((p) => p && !particulas.includes(normalizar(p)))
  if (!palavras.length) return "?"
  const primeira = palavras[0].charAt(0)
  const ultima = palavras.length > 1 ? palavras[palavras.length - 1].charAt(0) : ""
  return (primeira + ultima).toUpperCase()
}

/**
 * O número em formato internacional, sem o "+" (ex.: "5571988881111"). Sem DDI, põe o do Brasil
 * (55) em número de 10 ou 11 dígitos. Devolve null quando não dá para saber.
 */
export function numeroInternacional(t: string): string | null {
  let d = digitos(t)
  if (t.trim().startsWith("+")) return d.length >= 10 && d.length <= 15 ? d : null
  if (d.startsWith("00")) {
    const semPrefixo = d.slice(2)
    return semPrefixo.length >= 10 && semPrefixo.length <= 15 ? semPrefixo : null
  }
  d = d.replace(/^0+/, "")
  if (d.length === 10 || d.length === 11) return `55${d}`
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d
  return null
}

/** Link para ligar: com DDI, o número internacional; sem, os dígitos como estão. */
export function linkLigar(t: string): string | null {
  const n = numeroInternacional(t)
  if (n) return `tel:+${n}`
  const d = digitos(t)
  return d.length >= 3 ? `tel:${d}` : null
}

/** Link do WhatsApp (só com número internacional), com a mensagem pronta quando há uma. */
export function linkWhatsApp(t: string, mensagem?: string): string | null {
  const n = numeroInternacional(t)
  if (!n) return null
  return `https://wa.me/${n}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""}`
}

export const linkEmail = (t: string) => (t.includes("@") ? `mailto:${t.trim()}` : null)

export function linkMapa(endereco: string): string | null {
  const t = endereco.trim()
  return t ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}` : null
}

/** "Família , amigo(a),Família" → "Família, amigo(a)" (sem vazios e sem repetir). */
export function juntarCategorias(t: string): string {
  const vistas = new Set<string>()
  const lista: string[] = []
  for (const parte of t.split(",")) {
    const nome = parte.trim()
    if (!nome || vistas.has(normalizar(nome))) continue
    vistas.add(normalizar(nome))
    lista.push(nome)
  }
  return lista.join(", ")
}

/* ------------------------------------------------------------------ */
/* Wiki                                                                */
/* ------------------------------------------------------------------ */

export type PaginaWiki = { item: ItemColecao; id: string; titulo: string; categoria: string | null }

export function lerPaginaWiki(item: ItemColecao): PaginaWiki {
  return {
    item,
    id: item.id,
    titulo: item.title.trim() || "Sem título",
    categoria: lerLista(valorPorNome(valores(item), ["Tags", "Categoria", "Tag"]))[0] ?? null,
  }
}

/** Ordem dos grupos: as categorias da wiki, depois as outras (alfabética), por último as sem categoria. */
function posicaoDoGrupo(nome: string): [number, number] {
  const i = CATEGORIAS_WIKI.findIndex((c) => normalizar(c) === normalizar(nome))
  if (i >= 0) return [0, i]
  return normalizar(nome) === normalizar(SEM_CATEGORIA) ? [2, 0] : [1, 0]
}

export function agruparWiki(lista: PaginaWiki[]): { categoria: string; paginas: PaginaWiki[] }[] {
  const porChave = new Map<string, { categoria: string; paginas: PaginaWiki[] }>()
  for (const p of lista) {
    const rotulo = p.categoria ?? SEM_CATEGORIA
    // Uma categoria conhecida usa o nome escrito na lista (sem depender de acento ou maiúscula)
    const nome = CATEGORIAS_WIKI.find((c) => normalizar(c) === normalizar(rotulo)) ?? rotulo
    const chave = normalizar(nome)
    const grupo = porChave.get(chave) ?? { categoria: nome, paginas: [] }
    grupo.paginas.push(p)
    porChave.set(chave, grupo)
  }
  return [...porChave.values()]
    .map((g) => ({ ...g, paginas: [...g.paginas].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR")) }))
    .sort((a, b) => {
      const [ga, ia] = posicaoDoGrupo(a.categoria)
      const [gb, ib] = posicaoDoGrupo(b.categoria)
      return ga - gb || ia - ib || a.categoria.localeCompare(b.categoria, "pt-BR")
    })
}

/* ------------------------------------------------------------------ */
/* Frase do dia                                                        */
/* ------------------------------------------------------------------ */

/** Títulos e avisos que o Notion deixou no texto da página "Pessoal" (não são frases). */
const TITULOS_DA_PAGINA = ["insights", "diario", "sites favoritos", "meus sites compartilhados", "banco de dados", "impressao", "i m p r e s s a o", "wiki pessoal"]

/**
 * As frases da página "Pessoal": as citações (linhas com ">") que são frases de verdade. Sem
 * títulos, avisos do Notion, links nem repetições, na ordem do texto.
 */
export function frasesDaPagina(md: string | null | undefined): string[] {
  const frases: string[] = []
  const vistas = new Set<string>()
  for (const linha of (md ?? "").split("\n")) {
    if (!/^\s*>/.test(linha)) continue
    const t = linha
      .replace(/^\s*>/, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .replace(/^[^\p{L}\p{N}"“]+/u, "")
      .trim()
      .replace(/^["“”'«»]+|["“”'«»]+$/g, "")
      .trim()
    if (t.length < 8 || t.length > 160) continue
    if (t.endsWith(":")) continue
    if (t.split(/\s+/).filter((p) => /\p{L}/u.test(p)).length < 3) continue
    const n = normalizar(t)
    if (n.includes("http") || n.includes("notion")) continue
    if (TITULOS_DA_PAGINA.includes(n) || vistas.has(n)) continue
    vistas.add(n)
    frases.push(t)
  }
  return frases
}

/** A frase de hoje: muda a cada dia (no ano, em ordem); `deslocamento` troca para outra. */
export function fraseDoDia(frases: string[], hoje: string, deslocamento = 0): string | null {
  if (!frases.length) return null
  const d = lerData(hoje) ?? new Date()
  const n = frases.length
  return frases[(((differenceInCalendarDays(d, startOfYear(d)) + deslocamento) % n) + n) % n]
}

/* ------------------------------------------------------------------ */
/* Coleções de Pessoal e links                                         */
/* ------------------------------------------------------------------ */

/** Coleção que mora numa página "Pessoal" (no Notion ou criada por esta tela). */
export function daPessoal(c: { description?: string | null }): boolean {
  return (c.description ?? "").split("›").some((parte) => normalizar(parte) === "pessoal")
}

/** A coleção de um dos nomes: a que está na página Pessoal, senão a primeira que tiver o nome. */
export function acharDoPessoal(colecoes: Colecao[], nomes: string[]): Colecao | undefined {
  const alvos = nomes.map(normalizar)
  const candidatas = colecoes.filter((c) => alvos.includes(normalizar(c.name.replace(/^database:?\s*/i, ""))))
  return candidatas.find((c) => daPessoal(c)) ?? candidatas[0]
}

/** As coleções da página Pessoal que a tela não usa em nenhum cartão. */
export function colecoesExtras(colecoes: Colecao[], usadas: (string | undefined)[]): Colecao[] {
  return colecoes.filter((c) => daPessoal(c) && !usadas.includes(c.id))
}

/** Link para o item, com o botão "voltar" levando de volta a esta página. */
export function linkDoItem(id: string, editar = false): string {
  return `/colecoes/item/${encodeURIComponent(id)}?${editar ? "editar=1&" : ""}voltar=${encodeURIComponent(ROTA_PESSOAL)}`
}
