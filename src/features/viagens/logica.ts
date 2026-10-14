/*
 * Viagens: a lógica sem tela. Uma viagem é um item da coleção Viagens; o roteiro e os gastos
 * são itens das suas coleções, ligados à viagem pelo id em `_viagem`. A mala fica na própria
 * viagem, em `_mala`, e o modelo da mala nas preferências da pessoa.
 */
import { differenceInCalendarDays } from "date-fns"
import type { ItemColecao } from "@/features/colecoes/visao-colecao"
import { lerIntervalo } from "@/features/importar/valores"
import type { Json } from "@/lib/supabase/database.types"
import { formatar, isoDia, lerData, normalizar, somarDias } from "@/lib/utils"

const valores = (i: Pick<ItemColecao, "props">) => (i.props ?? {}) as Record<string, Json>
const texto = (v: Json | undefined) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "")
const PREFIXO_ARQUIVO = "arquivo://"

/* ------------------------------------------------------------------ */
/* Valores gravados                                                    */
/* ------------------------------------------------------------------ */

/** Data AAAA-MM-DD de um valor gravado: data, data com hora ou texto exportado do Notion. */
export function lerDia(v: Json | undefined): string | null {
  const t = texto(v)
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return lerData(t.slice(0, 10)) ? t.slice(0, 10) : null
  return lerIntervalo(t).inicio?.data ?? null
}

/** Hora HH:MM ("9h", "9:30", "21:05"). */
export function lerHora(v: Json | undefined): string | null {
  const m = texto(v).match(/^(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?\s*$/i)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

/** Valor em reais gravado como número ou texto: "R$ 1.234,56", "25,00", "25.5", "2.700". */
export function lerValor(v: Json | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v !== "string") return null
  let t = v.replace(/r\$|\s/gi, "")
  if (!t) return null
  if (t.includes(",") && t.includes(".")) t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "")
  else if (t.includes(",")) t = t.replace(",", ".")
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "")
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Valor digitado num campo de reais (vazio ou inválido = null; negativo não vale). */
export function lerValorDigitado(t: string): number | null {
  const n = lerValor(t)
  return n !== null && n >= 0 ? Math.round(n * 100) / 100 : null
}

function caminhoDoArquivo(v: Json | undefined): string | null {
  if (typeof v !== "string" || !v.startsWith(PREFIXO_ARQUIVO)) return null
  try {
    return decodeURIComponent(v.slice(PREFIXO_ARQUIVO.length))
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Viagem                                                              */
/* ------------------------------------------------------------------ */

/** Em que pé a viagem está, pelas datas: sem data é desejo; depois da volta, realizada. */
export type Situacao = "quero" | "proxima" | "andamento" | "realizada"

/** O que fica gravado em Status, para as tabelas do app e do Notion. */
export const STATUS_SALVO: Record<Situacao, string> = { quero: "Quero ir", proxima: "Planejada", andamento: "Planejada", realizada: "Realizada" }

export type ItemMala = { id: string; texto: string; grupo: string; feito: boolean }

export type Viagem = {
  item: ItemColecao
  id: string
  nome: string
  ida: string | null
  volta: string | null
  orcamento: number | null
  /** Caminho da foto de capa no storage. */
  capa: string | null
  /** A mala desta viagem; null enquanto não foi montada. */
  mala: ItemMala[] | null
  notas: string
  situacao: Situacao
  /** Quantos dias, contando o da ida e o da volta (null sem datas). */
  dias: number | null
}

export function situacaoDaViagem(ida: string | null, volta: string | null, statusSalvo = "", hoje = isoDia()): Situacao {
  // Sem datas, vale o que estiver gravado (uma viagem antiga do Notion pode estar "Realizada")
  if (!ida) return /realiz|feita|conclu/.test(normalizar(statusSalvo)) ? "realizada" : "quero"
  const fim = volta && volta >= ida ? volta : ida
  if (hoje < ida) return "proxima"
  if (hoje <= fim) return "andamento"
  return "realizada"
}

export function lerMala(v: Json | undefined): ItemMala[] | null {
  if (!Array.isArray(v)) return null
  const itens: ItemMala[] = []
  for (const x of v) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue
    const o = x as Record<string, Json>
    const t = texto(o.texto)
    if (!t) continue
    itens.push({ id: texto(o.id) || `m${itens.length}`, texto: t, grupo: texto(o.grupo) || "Outros", feito: o.feito === true })
  }
  return itens
}

/** As datas da viagem: Ida e Volta, ou o campo Data do Notion ("início → fim"). */
function datasDaViagem(v: Record<string, Json>): { ida: string | null; volta: string | null } {
  let ida = lerDia(v.Ida)
  let volta = lerDia(v.Volta)
  if (!ida) {
    const { inicio, fim } = lerIntervalo(texto(v.Data))
    ida = inicio?.data ?? null
    volta = volta ?? fim?.data ?? null
  }
  if (!ida) return { ida: null, volta: null }
  if (volta && volta < ida) volta = null
  return { ida, volta }
}

export function lerViagem(item: ItemColecao, hoje = isoDia()): Viagem {
  const v = valores(item)
  const { ida, volta } = datasDaViagem(v)
  const dias = ida ? differenceInCalendarDays(lerData(volta ?? ida)!, lerData(ida)!) + 1 : null
  return {
    item,
    id: item.id,
    nome: item.title.trim() || "Viagem sem nome",
    ida,
    volta,
    orcamento: lerValor(v["Orçamento Total"] ?? v["Orçamento"] ?? v.Orcamento),
    capa: item.cover_path ?? caminhoDoArquivo(v.Foto),
    mala: lerMala(v._mala),
    notas: item.content ?? "",
    situacao: situacaoDaViagem(ida, volta, texto(v.Status), hoje),
    dias,
  }
}

/** Cada dia da viagem, da ida à volta (no máximo 90). */
export function diasDaViagem(v: Pick<Viagem, "ida" | "volta">): string[] {
  if (!v.ida) return []
  const fim = v.volta && v.volta >= v.ida ? v.volta : v.ida
  const dias: string[] = []
  for (let d = v.ida; d <= fim && dias.length < 90; d = somarDias(d, 1)) dias.push(d)
  return dias
}

/** As viagens separadas como a página mostra: em destaque a que está acontecendo ou a próxima. */
export function separarViagens(viagens: Viagem[]) {
  const porPosicao = (a: Viagem, b: Viagem) => (a.item.position ?? 0) - (b.item.position ?? 0)
  const proximas = viagens.filter((v) => v.situacao === "proxima" || v.situacao === "andamento").sort((a, b) => a.ida!.localeCompare(b.ida!))
  const quero = viagens.filter((v) => v.situacao === "quero").sort(porPosicao)
  const realizadas = viagens.filter((v) => v.situacao === "realizada").sort((a, b) => (b.ida ?? "").localeCompare(a.ida ?? "") || porPosicao(b, a))
  const destaque = proximas.find((v) => v.situacao === "andamento") ?? proximas[0] ?? null
  return { proximas, quero, realizadas, destaque }
}

/* ------------------------------------------------------------------ */
/* Roteiro                                                             */
/* ------------------------------------------------------------------ */

export type TipoParada = "transporte" | "hospedagem" | "passeio" | "restaurante" | "outro"

export const TIPOS_PARADA: { id: TipoParada; rotulo: string }[] = [
  { id: "transporte", rotulo: "Transporte" },
  { id: "hospedagem", rotulo: "Hospedagem" },
  { id: "passeio", rotulo: "Passeio" },
  { id: "restaurante", rotulo: "Restaurante" },
  { id: "outro", rotulo: "Outro" },
]

/** O tipo pela categoria escrita (ou pelo nome do item, quando não tem categoria). */
export function tipoDaParada(t: string): TipoParada {
  const n = normalizar(t)
  if (/\b(transporte|voo|aviao|aeroporto|onibus|rodoviaria|carro|uber|taxi|transfer|trem|metro|barco|balsa|ferry|lancha)\b/.test(n)) return "transporte"
  if (/\b(hospedagem|hotel|pousada|hostel|airbnb|resort|check-?in|check-?out)\b/.test(n)) return "hospedagem"
  if (/\b(restaurante|almoco|jantar|cafe|bar|lanche|comida|pizzaria|churrascaria|padaria|sorveteria)\b/.test(n)) return "restaurante"
  if (/\b(passeio|museu|praia|parque|trilha|cachoeira|mirante|show|ingresso|tour|atracao|igreja|centro historico|feira|mercado)\b/.test(n)) return "passeio"
  return "outro"
}

export type Parada = {
  item: ItemColecao
  id: string
  /** Id da viagem; null quando o item ainda não foi ligado a nenhuma. */
  viagem: string | null
  titulo: string
  data: string | null
  hora: string | null
  /** A categoria como está gravada ("Hospedagem", "Local"…). */
  categoria: string
  tipo: TipoParada
  endereco: string
  obs: string
  feito: boolean
}

/** O campo de "feito" do roteiro: a coleção do Notion o chama de Status (caixa de seleção). */
export function campoFeito(esquema: { name: string; type: string }[]): string {
  const caixas = esquema.filter((p) => p.type === "checkbox")
  return caixas.find((p) => /feito|status|conclu/.test(normalizar(p.name)))?.name ?? caixas[0]?.name ?? "Feito"
}

export function lerParada(item: ItemColecao, feito = "Feito"): Parada {
  const v = valores(item)
  const categoria = texto(v.Categoria) || texto(v.Tipo)
  const bruto = texto(v.Data)
  return {
    item,
    id: item.id,
    viagem: texto(v._viagem) || null,
    titulo: item.title.trim() || "Sem nome",
    data: lerDia(v.Data),
    // Do Notion, a hora pode vir junto da data ("7 de novembro de 2022 14:30")
    hora: lerHora(v.Hora) ?? (bruto && !/^\d{4}-\d{2}-\d{2}$/.test(bruto) ? (lerIntervalo(bruto).inicio?.hora ?? null) : null),
    categoria,
    tipo: tipoDaParada(categoria || item.title),
    endereco: (texto(v["Endereço"]) || texto(v.Endereco) || texto(v.Local)).replace(/^[•·\-*\s]+/, ""),
    obs: texto(v["Observação"]) || texto(v.Observacao) || texto(v["Anotações"]),
    feito: v[feito] === true,
  }
}

export type DiaRoteiro = {
  chave: string
  /** null: os itens ainda sem dia. */
  data: string | null
  /** Dia 1, 2, 3… da viagem; null para datas fora da viagem ou sem dia. */
  numero: number | null
  paradas: Parada[]
}

/** Com hora primeiro, pela hora; os sem hora depois, na ordem em que foram criados. */
function porHora(a: Parada, b: Parada) {
  if (a.hora && b.hora) return a.hora.localeCompare(b.hora)
  if (a.hora) return -1
  if (b.hora) return 1
  return (a.item.position ?? 0) - (b.item.position ?? 0)
}

/** O roteiro dia a dia: todos os dias da viagem (mesmo vazios), depois as datas fora dela e os sem dia. */
export function agruparRoteiro(paradas: Parada[], viagem: Pick<Viagem, "ida" | "volta">): DiaRoteiro[] {
  const grupos = new Map<string, DiaRoteiro>()
  diasDaViagem(viagem).forEach((d, i) => grupos.set(d, { chave: d, data: d, numero: i + 1, paradas: [] }))
  const semDia: Parada[] = []
  for (const p of paradas) {
    if (!p.data) {
      semDia.push(p)
      continue
    }
    if (!grupos.has(p.data)) grupos.set(p.data, { chave: p.data, data: p.data, numero: null, paradas: [] })
    grupos.get(p.data)!.paradas.push(p)
  }
  // Os dias da viagem primeiro; uma data fora deles (a viagem mudou de data, por exemplo) vem depois
  const lista = [...grupos.values()].sort((a, b) => Number(a.numero === null) - Number(b.numero === null) || a.data!.localeCompare(b.data!))
  for (const g of lista) g.paradas.sort(porHora)
  if (semDia.length) lista.push({ chave: "sem-dia", data: null, numero: null, paradas: semDia.sort(porHora) })
  return lista
}

/** Link para abrir o endereço no mapa (ou o próprio link, se já for um). */
export function linkDoMapa(endereco: string): string | null {
  const t = endereco.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  if (/^(www\.|maps\.|goo\.gl\/|g\.page\/|maps\.app\.goo\.gl\/)/i.test(t)) return `https://${t}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}`
}

export const ehLink = (t: string) => /^(https?:\/\/|www\.|maps\.|goo\.gl\/|g\.page\/)/i.test(t.trim())

/* ------------------------------------------------------------------ */
/* Gastos                                                              */
/* ------------------------------------------------------------------ */

export type TipoGasto = "transporte" | "hospedagem" | "alimentacao" | "passeios" | "compras" | "outros"

export const TIPOS_GASTO: { id: TipoGasto; rotulo: string }[] = [
  { id: "transporte", rotulo: "Transporte" },
  { id: "hospedagem", rotulo: "Hospedagem" },
  { id: "alimentacao", rotulo: "Alimentação" },
  { id: "passeios", rotulo: "Passeios" },
  { id: "compras", rotulo: "Compras" },
  { id: "outros", rotulo: "Outros" },
]

export function tipoDoGasto(t: string): TipoGasto {
  const n = normalizar(t)
  if (/\b(transporte|passagem|passagens|voo|aviao|onibus|carro|uber|taxi|combustivel|gasolina|pedagio|estacionamento|aluguel de carro|transfer|metro)\b/.test(n)) return "transporte"
  if (/\b(hospedagem|hotel|pousada|hostel|airbnb|diaria|diarias)\b/.test(n)) return "hospedagem"
  if (/\b(alimentacao|comida|almoco|jantar|cafe|lanche|restaurante|mercado|bebida)\b/.test(n)) return "alimentacao"
  if (/\b(passeio|passeios|ingresso|ingressos|museu|tour|show|entrada|atracao)\b/.test(n)) return "passeios"
  if (/\b(compras|compra|lembranca|lembrancas|presente|presentes|souvenir)\b/.test(n)) return "compras"
  return "outros"
}

export type Gasto = {
  item: ItemColecao
  id: string
  viagem: string | null
  titulo: string
  categoria: string
  tipo: TipoGasto
  previsto: number | null
  /** O que já foi pago. */
  realizado: number | null
  data: string | null
}

export function lerGasto(item: ItemColecao): Gasto {
  const v = valores(item)
  const categoria = texto(v.Tipo) || texto(v.Categoria)
  return {
    item,
    id: item.id,
    viagem: texto(v._viagem) || null,
    titulo: item.title.trim() || "Sem nome",
    categoria,
    tipo: tipoDoGasto(categoria || item.title),
    previsto: lerValor(v.Previsto),
    realizado: lerValor(v.Realizado ?? v.Valor),
    data: lerDia(v.Data),
  }
}

/** Quanto a linha pesa na conta da viagem: o pago, se já pagou; senão, o previsto. */
export const valorDoGasto = (g: Pick<Gasto, "previsto" | "realizado">) => g.realizado ?? g.previsto ?? 0

export type CategoriaResumo = { tipo: TipoGasto; rotulo: string; gasto: number; previsao: number; itens: Gasto[] }

export type ResumoGastos = {
  /** Soma do que já foi pago. */
  gasto: number
  /** Quanto a viagem deve custar: o que já foi pago mais o previsto que falta pagar. */
  previsao: number
  /** O previsto das linhas que ainda não foram pagas. */
  faltaPagar: number
  categorias: CategoriaResumo[]
}

export function resumirGastos(gastos: Gasto[]): ResumoGastos {
  let gasto = 0
  let previsao = 0
  let faltaPagar = 0
  const porTipo = new Map<TipoGasto, CategoriaResumo>()
  const ordenados = [...gastos].sort((a, b) => (a.item.position ?? 0) - (b.item.position ?? 0))
  for (const g of ordenados) {
    const valor = valorDoGasto(g)
    gasto += g.realizado ?? 0
    previsao += valor
    if (g.realizado === null) faltaPagar += g.previsto ?? 0
    const rotulo = TIPOS_GASTO.find((t) => t.id === g.tipo)!.rotulo
    const c = porTipo.get(g.tipo) ?? { tipo: g.tipo, rotulo, gasto: 0, previsao: 0, itens: [] }
    c.gasto += g.realizado ?? 0
    c.previsao += valor
    c.itens.push(g)
    porTipo.set(g.tipo, c)
  }
  const categorias = TIPOS_GASTO.map((t) => porTipo.get(t.id)).filter((c): c is CategoriaResumo => Boolean(c))
  const centavos = (n: number) => Math.round(n * 100) / 100
  return { gasto: centavos(gasto), previsao: centavos(previsao), faltaPagar: centavos(faltaPagar), categorias }
}

/* ------------------------------------------------------------------ */
/* Mala                                                                */
/* ------------------------------------------------------------------ */

export type ModeloMala = { grupo: string; itens: string[] }[]

/** O modelo de quem ainda não montou o seu: uma viagem pelo Brasil. */
export const MODELO_MALA: ModeloMala = [
  { grupo: "Documentos", itens: ["RG ou CNH", "Cartões e dinheiro", "Passagens e reservas", "Carteirinha do plano de saúde"] },
  { grupo: "Roupas", itens: ["Camisetas", "Calças e bermudas", "Roupa íntima", "Meias", "Pijama", "Casaco", "Roupa de banho", "Chinelo", "Tênis extra"] },
  { grupo: "Higiene", itens: ["Escova e pasta de dente", "Desodorante", "Shampoo e condicionador", "Protetor solar", "Repelente", "Remédios de uso contínuo"] },
  { grupo: "Eletrônicos", itens: ["Carregador do celular", "Carregador portátil", "Fone de ouvido"] },
  { grupo: "Outros", itens: ["Garrafa de água", "Óculos de sol", "Guarda-chuva", "Sacola para roupa suja"] },
]

export function lerModelo(v: Json | undefined): ModeloMala | null {
  if (!Array.isArray(v)) return null
  const modelo: ModeloMala = []
  for (const x of v) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue
    const o = x as Record<string, Json>
    const grupo = texto(o.grupo)
    const itens = Array.isArray(o.itens) ? o.itens.map((i) => texto(i)).filter(Boolean) : []
    if (grupo) modelo.push({ grupo, itens })
  }
  return modelo.length ? modelo : null
}

export const novoIdMala = () => Math.random().toString(36).slice(2, 10)

export function malaDoModelo(modelo: ModeloMala): ItemMala[] {
  return modelo.flatMap((g) => g.itens.map((texto) => ({ id: novoIdMala(), texto, grupo: g.grupo, feito: false })))
}

/** Os grupos na ordem em que aparecem (a ordem do modelo). */
export function gruposDaMala(mala: ItemMala[]): { grupo: string; itens: ItemMala[] }[] {
  const grupos = new Map<string, ItemMala[]>()
  for (const i of mala) grupos.set(i.grupo, [...(grupos.get(i.grupo) ?? []), i])
  return [...grupos].map(([grupo, itens]) => ({ grupo, itens }))
}

export function modeloDaMala(mala: ItemMala[]): ModeloMala {
  return gruposDaMala(mala).map((g) => ({ grupo: g.grupo, itens: g.itens.map((i) => i.texto) }))
}

export const contarItensModelo = (m: ModeloMala) => m.reduce((n, g) => n + g.itens.length, 0)

/* ------------------------------------------------------------------ */
/* Textos                                                              */
/* ------------------------------------------------------------------ */

export const reais = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })

/** "7 a 15 de nov", "28 de nov a 3 de dez", "30 de dez de 2026 a 2 de jan de 2027". O ano só quando não é o atual. */
export function textoPeriodo(ida: string | null, volta: string | null, hoje = isoDia()): string {
  if (!ida) return "Sem data"
  const fim = volta && volta >= ida ? volta : ida
  const anoAtual = hoje.slice(0, 4)
  const [a, b] = [ida.slice(0, 4), fim.slice(0, 4)]
  const ano = a !== anoAtual || b !== anoAtual ? ` de ${b}` : ""
  if (fim === ida) return `${formatar(ida, "d 'de' MMM")}${ano}`
  if (a !== b) return `${formatar(ida, "d 'de' MMM 'de' yyyy")} a ${formatar(fim, "d 'de' MMM 'de' yyyy")}`
  if (ida.slice(5, 7) === fim.slice(5, 7)) return `${formatar(ida, "d")} a ${formatar(fim, "d 'de' MMM")}${ano}`
  return `${formatar(ida, "d 'de' MMM")} a ${formatar(fim, "d 'de' MMM")}${ano}`
}

/** "Faltam 24 dias", "É amanhã", "Começa hoje", "Dia 3 de 9", "Último dia", "nov de 2025". */
export function textoContagem(v: Pick<Viagem, "ida" | "volta" | "situacao">, hoje = isoDia()): string {
  if (!v.ida) return v.situacao === "realizada" ? "Realizada" : "Sem data"
  const total = diasDaViagem(v).length
  if (v.situacao === "proxima") {
    const n = differenceInCalendarDays(lerData(v.ida)!, lerData(hoje)!)
    return n === 1 ? "É amanhã" : `Faltam ${n} dias`
  }
  if (v.situacao === "andamento") {
    const dia = differenceInCalendarDays(lerData(hoje)!, lerData(v.ida)!) + 1
    if (total === 1) return "É hoje"
    if (dia === 1) return "Começa hoje"
    if (dia === total) return "Último dia"
    return `Dia ${dia} de ${total}`
  }
  return formatar(v.ida, "MMM 'de' yyyy")
}

export const textoDias = (n: number | null) => (n === null ? "" : n === 1 ? "1 dia" : `${n} dias`)
