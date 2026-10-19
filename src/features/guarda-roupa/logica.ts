/*
 * Guarda Roupa: a lógica sem tela. Cada peça (e cada desejo, com Comprado desmarcado) é um item da coleção
 * "Guarda Roupa"; cada outfit é um item da coleção "Outfit", com as peças pelo id em `_pecas` (e pelo nome em
 * `Peças`, que é o que o Notion trouxe) e os dias de uso em `_usos`. Nada aqui fala com o banco, com o React
 * ou com a internet.
 */
import type { ItemColecao } from "@/features/colecoes/visao-colecao"
import { lerDiaFlex, lerLista, texto, valorPorNome } from "@/features/pessoal/logica"
import { lerValor, lerValorDigitado, reais } from "@/features/viagens/logica"
import type { Json } from "@/lib/supabase/database.types"
import { formatar, normalizar, plural, somarDias, urlValida } from "@/lib/utils"

export const ROTA_GUARDA_ROUPA = "/vida/guarda-roupa"
export const TIPOS_PECA = ["Touca", "Boné", "Jaqueta", "Moletom", "Camisa", "Calça", "Shorts", "Meia", "Tênis", "Chinelo", "Sapato", "Relógio"] as const
export const CORES = ["Preta", "Branca", "Azul", "Azul claro", "Marrom", "Jeans escuro", "Vermelho", "Bege", "Areia", "Azul Marinho"] as const
export const CONSERVACOES = ["Nunca Usada", "Nova", "Usada", "Velha"] as const
export const LUGARES = ["Casual", "Evento", "Academia", "Trabalho"] as const
export const HORAS = ["Manhã", "Tarde", "Noite"] as const
export const CLIMAS = ["Inverno", "Verão"] as const

/** Nomes das colunas no banco (os do Notion). */
export const COL = {
  tipo: "Tipo",
  cor: "Cor",
  marca: "Marca",
  tamanho: "Tamanho",
  conservacao: "Conservação",
  comprado: "Comprado",
  valor: "Valor",
  site: "Site",
  foto: "Foto/Imagem",
  pecas: "Peças",
  utilizado: "Utilizado",
  lugar: "Lugar",
  hora: "Hora",
  clima: "Clima",
} as const

export type Aba = "pecas" | "outfits" | "desejos"
export type OrdemPecas = "recentes" | "menos-usadas" | "nome"
export type OrdemDesejos = "recentes" | "menor-preco" | "maior-preco"

/** Uma peça ou um desejo (com `comprado` falso), já lido das colunas do Notion. */
export type Peca = {
  item: ItemColecao
  id: string
  nome: string
  tipos: string[]
  /** O primeiro tipo: é o que aparece no cartão e no rótulo. */
  tipo: string | null
  cores: string[]
  marca: string | null
  tamanho: string | null
  conservacao: string | null
  comprado: boolean
  valor: number | null
  site: string | null
  /** Caminho da foto no storage. */
  foto: string | null
  /** Foto por endereço da internet, quando não há foto no storage. */
  fotoUrl: string | null
}

/** Um outfit: as peças que ele tem (só as que ainda existem) e o registro de uso. */
export type Outfit = {
  item: ItemColecao
  id: string
  nome: string
  pecas: Peca[]
  lugares: string[]
  horas: string[]
  climas: string[]
  /** Dias de uso (AAAA-MM-DD), sem repetir, do mais antigo ao mais novo. */
  usos: string[]
  ultimoUso: string | null
}

/** Valores gravados de um item (as colunas do Notion e as chaves que o app usa com `_`). */
type Valores = Record<string, Json>

const valoresDe = (item: Pick<ItemColecao, "props">): Valores => (item.props ?? {}) as Valores

/** Grava o valor; vazio (null, "" ou ausente) apaga a coluna, para o valor antigo não voltar. */
function gravarOuApagar(props: Valores, chave: string, valor: Json | undefined) {
  if (valor === undefined || valor === null || valor === "") delete props[chave]
  else props[chave] = valor
}

/* ------------------------------------------------------------------ */
/* Leitura de uma peça                                                 */
/* ------------------------------------------------------------------ */

/** O nome sem espaços nas pontas e sem o negrito do Notion ("**Suéter**" vira "Suéter"). */
export function limparNome(t: string): string {
  const aparado = t.trim()
  const negrito = aparado.match(/^(\*\*|__)([\s\S]*)\1$/)
  return (negrito ? negrito[2] : aparado).trim()
}

const COMPRADO_SIM = ["yes", "sim", "true", "✓"]

/** Caixa marcada: true, "Yes", "__YES__", "Sim", "true" ou "✓". Qualquer outra coisa é desmarcada. */
export function lerComprado(v: Json | undefined): boolean {
  if (v === true) return true
  if (typeof v !== "string") return false
  return COMPRADO_SIM.includes(v.trim().replace(/^_+|_+$/g, "").toLowerCase())
}

/** Texto de uma coluna em que o traço do Notion ("-" ou "—") quer dizer "nenhum": null. */
export function semTraco(v: Json | undefined): string | null {
  const t = texto(v)
  return t && t !== "-" && t !== "—" ? t : null
}

const PREFIXO_ARQUIVO = "arquivo://"
const FOTO_DE_IMAGEM = /\.(png|jpe?g|webp|gif|avif|heic|heif)$/i

function decodificar(t: string): string | null {
  try {
    return decodeURIComponent(t)
  } catch {
    // Um endereço com "%" solto não é um caminho: sem foto, sem erro
    return null
  }
}

/**
 * A foto de uma peça: a do storage (cover_path) vale mais. Senão, a coluna Foto/Imagem: um arquivo do
 * Notion ("arquivo://…", só se for imagem) ou um endereço da internet.
 */
export function fotoDaPeca(item: Pick<ItemColecao, "cover_path" | "props">): { foto: string | null; fotoUrl: string | null } {
  if (item.cover_path) return { foto: item.cover_path, fotoUrl: null }
  const bruto = valorPorNome(valoresDe(item), [COL.foto, "Foto", "Imagem"])
  const valor = Array.isArray(bruto) ? (bruto.map((v) => texto(v)).find(Boolean) ?? "") : texto(bruto)
  if (valor.startsWith(PREFIXO_ARQUIVO)) {
    const caminho = decodificar(valor.slice(PREFIXO_ARQUIVO.length))
    return { foto: caminho && FOTO_DE_IMAGEM.test(caminho) ? caminho : null, fotoUrl: null }
  }
  return { foto: null, fotoUrl: /^https?:\/\//i.test(valor) ? valor : null }
}

/** Uma peça (ou desejo) lida do item. Aceita a grafia sem acento e sem maiúscula das colunas. */
export function lerPeca(item: ItemColecao): Peca {
  const props = valoresDe(item)
  const tipos = lerLista(valorPorNome(props, [COL.tipo]))
  return {
    item,
    id: item.id,
    nome: limparNome(item.title) || "Sem nome",
    tipos,
    tipo: tipos[0] ?? null,
    cores: lerLista(valorPorNome(props, [COL.cor])),
    marca: semTraco(valorPorNome(props, [COL.marca])),
    tamanho: semTraco(valorPorNome(props, [COL.tamanho])),
    conservacao: texto(valorPorNome(props, [COL.conservacao])) || null,
    comprado: lerComprado(valorPorNome(props, [COL.comprado])),
    valor: lerValor(valorPorNome(props, [COL.valor])),
    site: urlValida(texto(valorPorNome(props, [COL.site]))),
    ...fotoDaPeca(item),
  }
}

/* ------------------------------------------------------------------ */
/* Leitura de um outfit                                                */
/* ------------------------------------------------------------------ */

/**
 * Os dias de uso: a lista `_usos` mais o `Utilizado` (o último). Sem repetir, do mais antigo ao mais novo;
 * o que não for data sai.
 */
export function lerUsos(props: Valores | null | undefined): string[] {
  const p = props ?? {}
  const lista = Array.isArray(p._usos) ? p._usos : []
  const datas = [...lista, valorPorNome(p, [COL.utilizado])].map((v) => lerDiaFlex(v)).filter((d): d is string => d !== null)
  return [...new Set(datas)].sort()
}

/**
 * Um outfit lido do item. As peças vêm dos ids em `_pecas` (quando a lista existe, vale só ela) ou, para o
 * que veio do Notion, dos nomes em `Peças`. Peça que não existe mais sai.
 */
export function lerOutfit(item: ItemColecao, pecas: Peca[]): Outfit {
  const props = valoresDe(item)
  const escolhidas: Peca[] = []
  const incluir = (p: Peca | undefined) => {
    if (p && !escolhidas.includes(p)) escolhidas.push(p)
  }
  if (Array.isArray(props._pecas)) {
    for (const id of props._pecas.map((v) => texto(v))) incluir(pecas.find((p) => p.id === id))
  } else {
    for (const nome of lerLista(valorPorNome(props, [COL.pecas]))) {
      const chave = normalizar(limparNome(nome))
      incluir(pecas.find((p) => normalizar(p.nome) === chave))
    }
  }
  const usos = lerUsos(props)
  return {
    item,
    id: item.id,
    nome: limparNome(item.title) || "Sem nome",
    pecas: escolhidas,
    lugares: lerLista(valorPorNome(props, [COL.lugar])),
    horas: lerLista(valorPorNome(props, [COL.hora])),
    climas: lerLista(valorPorNome(props, [COL.clima])),
    usos,
    ultimoUso: usos.at(-1) ?? null,
  }
}

/* ------------------------------------------------------------------ */
/* Contagens, filtros e ordem                                          */
/* ------------------------------------------------------------------ */

/**
 * Conta os valores (tipos ou lugares) de cada item: um item conta uma vez por valor. O rótulo é o da lista
 * base quando a grafia bate (sem acento e sem maiúscula); senão, a primeira grafia vista. Os da base vêm
 * primeiro, na ordem dela; os outros, em ordem alfabética.
 */
function contarValores(listas: string[][], base: readonly string[]): { valor: string; n: number }[] {
  const contagens = new Map<string, { chave: string; valor: string; n: number }>()
  for (const lista of listas) {
    const vistos = new Set<string>()
    for (const bruto of lista) {
      const chave = normalizar(bruto)
      if (!chave || vistos.has(chave)) continue
      vistos.add(chave)
      const atual = contagens.get(chave)
      if (atual) atual.n++
      else contagens.set(chave, { chave, valor: base.find((b) => normalizar(b) === chave) ?? bruto.trim(), n: 1 })
    }
  }
  const posicao = (c: { chave: string }) => base.findIndex((b) => normalizar(b) === c.chave)
  return [...contagens.values()]
    .sort((a, b) => {
      const pa = posicao(a)
      const pb = posicao(b)
      if (pa >= 0 && pb >= 0) return pa - pb
      if (pa >= 0) return -1
      if (pb >= 0) return 1
      return a.valor.localeCompare(b.valor, "pt-BR")
    })
    .map(({ valor, n }) => ({ valor, n }))
}

/** Quantas peças de cada tipo (uma peça com dois tipos conta nos dois). Só os tipos que aparecem. */
export function contarPorTipo(pecas: Peca[]): { tipo: string; n: number }[] {
  return contarValores(pecas.map((p) => p.tipos), TIPOS_PECA).map(({ valor, n }) => ({ tipo: valor, n }))
}

/** As peças de um tipo (null = todas), na ordem recebida. */
export function filtrarPorTipo(pecas: Peca[], tipo: string | null): Peca[] {
  if (tipo === null) return pecas
  return pecas.filter((p) => p.tipos.some((t) => normalizar(t) === normalizar(tipo)))
}

/** Quantos outfits de cada lugar. Só os lugares que aparecem. */
export function contarPorLugar(outfits: Outfit[]): { lugar: string; n: number }[] {
  return contarValores(outfits.map((o) => o.lugares), LUGARES).map(({ valor, n }) => ({ lugar: valor, n }))
}

/** Os outfits de um lugar (null = todos), na ordem recebida. */
export function filtrarPorLugar(outfits: Outfit[], lugar: string | null): Outfit[] {
  if (lugar === null) return outfits
  return outfits.filter((o) => o.lugares.some((l) => normalizar(l) === normalizar(lugar)))
}

/** A última vez (AAAA-MM-DD) que a peça foi usada em algum outfit, ou null. */
export function ultimoUsoDaPeca(pecaId: string, outfits: Outfit[]): string | null {
  let ultimo: string | null = null
  for (const o of outfits) {
    if (!o.ultimoUso || !o.pecas.some((p) => p.id === pecaId)) continue
    if (!ultimo || o.ultimoUso > ultimo) ultimo = o.ultimoUso
  }
  return ultimo
}

/** Do uso mais recente ao mais antigo; sem uso ("" aqui) vai para o fim. */
const porUsoRecente = (a: Outfit, b: Outfit) => {
  const ua = a.ultimoUso ?? ""
  const ub = b.ultimoUso ?? ""
  if (ua === ub) return 0
  return ua < ub ? 1 : -1
}

/** Os outfits que têm a peça: do uso mais recente ao mais antigo; sem uso no fim; empate por nome. */
export function outfitsDaPeca(pecaId: string, outfits: Outfit[]): Outfit[] {
  return outfits
    .filter((o) => o.pecas.some((p) => p.id === pecaId))
    .sort((a, b) => porUsoRecente(a, b) || a.nome.localeCompare(b.nome, "pt-BR"))
}

/** Mais recentes primeiro (a posição cresce a cada gravação); empate por nome. */
const porPosicao = (a: Peca, b: Peca) => (b.item.position ?? 0) - (a.item.position ?? 0) || a.nome.localeCompare(b.nome, "pt-BR")

/** As peças na ordem escolhida (uma lista nova). */
export function ordenarPecas(pecas: Peca[], ordem: OrdemPecas, outfits: Outfit[]): Peca[] {
  if (ordem === "nome") return [...pecas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))
  if (ordem === "menos-usadas") {
    // Nunca usada ("") vem primeiro; depois, a que foi usada há mais tempo
    const usos = new Map(pecas.map((p) => [p.id, ultimoUsoDaPeca(p.id, outfits) ?? ""]))
    return [...pecas].sort((a, b) => {
      const ua = usos.get(a.id) ?? ""
      const ub = usos.get(b.id) ?? ""
      if (ua !== ub) return ua < ub ? -1 : 1
      return a.nome.localeCompare(b.nome, "pt-BR")
    })
  }
  return [...pecas].sort(porPosicao)
}

/** Os desejos na ordem escolhida (uma lista nova). Sem preço fica no fim, nos dois sentidos. */
export function ordenarDesejos(pecas: Peca[], ordem: OrdemDesejos): Peca[] {
  if (ordem === "recentes") return [...pecas].sort(porPosicao)
  const sentido = ordem === "menor-preco" ? 1 : -1
  return [...pecas].sort((a, b) => {
    if (a.valor === null || b.valor === null) {
      return Number(a.valor === null) - Number(b.valor === null) || a.nome.localeCompare(b.nome, "pt-BR")
    }
    return sentido * (a.valor - b.valor) || a.nome.localeCompare(b.nome, "pt-BR")
  })
}

/** Os outfits: o uso mais recente primeiro; sem uso no fim; empate pela posição e pelo nome. */
export function ordenarOutfits(outfits: Outfit[]): Outfit[] {
  return [...outfits].sort((a, b) => porUsoRecente(a, b) || a.item.position - b.item.position || a.nome.localeCompare(b.nome, "pt-BR"))
}

const ehAba = (v: string | null): v is Aba => v === "pecas" || v === "outfits" || v === "desejos"

/**
 * A aba que abre: a última que a pessoa escolheu (se ainda é uma aba); senão, Peças se tem peça, Desejos se
 * tem desejo; senão, Peças.
 */
export function abaInicial(lembrada: string | null, nPecas: number, nDesejos: number): Aba {
  if (ehAba(lembrada)) return lembrada
  if (nPecas > 0) return "pecas"
  if (nDesejos > 0) return "desejos"
  return "pecas"
}

/* ------------------------------------------------------------------ */
/* Textos                                                              */
/* ------------------------------------------------------------------ */

export type ResumoDesejos = { quantidade: number; total: number; semPreco: number }

/** Quantos desejos, quanto custam juntos (em centavos) e quantos ainda não têm preço. */
export function resumoDesejos(pecas: Peca[]): ResumoDesejos {
  const comPreco = pecas.filter((p) => p.valor !== null)
  const soma = comPreco.reduce((s, p) => s + (p.valor ?? 0), 0)
  return { quantidade: pecas.length, total: Math.round(soma * 100) / 100, semPreco: pecas.length - comPreco.length }
}

/** "6 desejos · R$ 344,54 · 1 sem preço". */
export function textoResumoDesejos(r: ResumoDesejos): string {
  if (r.quantidade === 0) return "Nenhum desejo"
  return plural(r.quantidade, "desejo") + (r.total > 0 ? ` · ${reais(r.total)}` : "") + (r.semPreco ? ` · ${r.semPreco} sem preço` : "")
}

/** Marca, tamanho e, se já comprada, a conservação: o que o cartão mostra embaixo do nome. */
export function metaDaPeca(p: Peca): string {
  return [p.marca, p.tamanho, p.comprado ? p.conservacao : null].filter(Boolean).join(" · ")
}

/** A linha de um desejo: o preço, marca e tamanho ("R$ 69,48 · Adidas · 39"). */
export function linhaDoDesejo(p: Peca): string {
  return [p.valor !== null ? reais(p.valor) : "sem preço", metaDaPeca(p)].filter(Boolean).join(" · ")
}

/** O rótulo do cartão para leitor de tela. */
export function rotuloDaPeca(p: Peca): string {
  if (!p.comprado) return `${p.nome}, ${p.valor !== null ? reais(p.valor) : "sem preço"}`
  return `${p.nome}${p.tipo ? `, ${p.tipo}` : ""}`
}

/** "Usado em 15 de out", "Usada hoje", "Nunca usado"… O genero diz se a palavra fica no masculino ("o") ou no feminino ("a"). */
export function textoUltimoUso(data: string | null, hoje: string, genero: "o" | "a"): string {
  const usado = genero === "o" ? "Usado" : "Usada"
  if (!data) return genero === "o" ? "Nunca usado" : "Nunca usada"
  if (data === hoje) return `${usado} hoje`
  if (data === somarDias(hoje, -1)) return `${usado} ontem`
  // Dia e mês; o ano só quando não é o atual
  const padrao = data.slice(0, 4) === hoje.slice(0, 4) ? "d 'de' MMM" : "d MMM yyyy"
  return `${usado} em ${formatar(data, padrao)}`
}

export function textoVezes(n: number): string {
  if (n === 0) return ""
  return n === 1 ? "1 vez" : `${n} vezes`
}

/** "Trabalho · Inverno, Verão · Manhã": o lugar, o clima e a hora. */
export function metaDoOutfit(o: Outfit): string {
  return [o.lugares.join(", "), o.climas.join(", "), o.horas.join(", ")].filter(Boolean).join(" · ")
}

/** O último uso e, se foi mais de uma vez, quantas vezes ("Usado em 15 de out · 2 vezes"). */
export function usoDoOutfit(o: Outfit, hoje: string): string {
  const base = textoUltimoUso(o.ultimoUso, hoje, "o")
  return o.usos.length > 1 ? `${base} · ${textoVezes(o.usos.length)}` : base
}

/** O rótulo do cartão do outfit para leitor de tela. */
export function rotuloDoOutfit(o: Outfit, hoje: string): string {
  const uso = textoUltimoUso(o.ultimoUso, hoje, "o")
  return `${o.nome}, ${plural(o.pecas.length, "peça")}, ${uso.charAt(0).toLowerCase()}${uso.slice(1)}`
}

/** "Outfit 4" para um outfit novo: o número seguinte, pulando nomes que já existem. */
export function nomePadraoOutfit(outfits: Outfit[]): string {
  const usados = new Set(outfits.map((o) => normalizar(o.nome)))
  let n = outfits.length + 1
  while (usados.has(normalizar(`Outfit ${n}`))) n++
  return `Outfit ${n}`
}

/** A cor da bolinha de cada nome de cor do app. A chave é o nome sem acento e em minúscula. */
const HEX_DAS_CORES = new Map<string, string>([
  ["preta", "#18181b"],
  ["preto", "#18181b"],
  ["branca", "#ffffff"],
  ["branco", "#ffffff"],
  ["azul", "#2563eb"],
  ["azul claro", "#7dd3fc"],
  ["azul marinho", "#1e3a8a"],
  ["marrom", "#78350f"],
  ["jeans escuro", "#27405e"],
  ["jeans", "#3b5b85"],
  ["vermelho", "#dc2626"],
  ["vermelha", "#dc2626"],
  ["bege", "#d6c4a8"],
  ["areia", "#c9b48a"],
  ["cinza", "#9ca3af"],
  ["verde", "#16a34a"],
  ["amarelo", "#facc15"],
  ["amarela", "#facc15"],
  ["rosa", "#f472b6"],
  ["roxo", "#9333ea"],
  ["roxa", "#9333ea"],
  ["laranja", "#f97316"],
  ["vinho", "#7f1d1d"],
  ["caramelo", "#b45309"],
  ["off white", "#f5f5f0"],
  ["off-white", "#f5f5f0"],
  ["dourado", "#ca8a04"],
  ["dourada", "#ca8a04"],
  ["prata", "#cbd5e1"],
  ["prateado", "#cbd5e1"],
  ["prateada", "#cbd5e1"],
])

/** A cor em hex de um nome de cor (aceita masculino e feminino); null se não conhece. */
export function corDaCor(nome: string): string | null {
  return HEX_DAS_CORES.get(normalizar(nome)) ?? null
}

/** As opções de uma escolha: a base, na ordem dela, e depois os valores que faltam, em ordem alfabética. */
export function opcoesCom(base: readonly string[], valores: string[]): string[] {
  const vistos = new Set(base.map((b) => normalizar(b)))
  const extras: string[] = []
  for (const bruto of valores) {
    const v = bruto.trim()
    const chave = normalizar(v)
    if (!chave || vistos.has(chave)) continue
    vistos.add(chave)
    extras.push(v)
  }
  return [...base, ...extras.sort((a, b) => a.localeCompare(b, "pt-BR"))]
}

/** Link para a página do item, com o botão "voltar" levando de volta para o Guarda Roupa. */
export function linkDoItem(id: string): string {
  return `/colecoes/item/${encodeURIComponent(id)}?voltar=${encodeURIComponent(ROTA_GUARDA_ROUPA)}`
}

/* ------------------------------------------------------------------ */
/* Gravação (sempre devolve propriedades novas)                        */
/* ------------------------------------------------------------------ */

export type ErrosPeca = Partial<Record<"nome" | "valor" | "site", string>>

/** Os erros do formulário de peça (sem erro = pode gravar). O valor é digitado em reais, como "59,90". */
export function validarPeca({ nome, valor, site }: { nome: string; valor: string; site: string }): ErrosPeca {
  const erros: ErrosPeca = {}
  if (!nome.trim()) erros.nome = "Escreva o nome da peça."
  if (valor.trim() && lerValorDigitado(valor) === null) erros.valor = "Use só números, como 59,90."
  if (site.trim() && !urlValida(site)) erros.site = "Confira o link da loja."
  return erros
}

export type CamposDaPeca = {
  tipo: string | null
  cores: string[]
  marca: string
  tamanho: string
  conservacao: string | null
  comprado: boolean
  valor: number | null
  site: string
}

/**
 * As propriedades de uma peça, a partir das que ela já tinha (o resto fica como está: Outfit, Usado, a foto).
 * A conservação só existe em peça comprada; campo vazio apaga a coluna.
 */
export function propsDaPeca(atual: Valores | null, c: CamposDaPeca): Valores {
  const props: Valores = { ...(atual ?? {}) }
  gravarOuApagar(props, COL.tipo, c.tipo)
  gravarOuApagar(props, COL.cor, c.cores.join(", "))
  gravarOuApagar(props, COL.marca, c.marca.trim())
  gravarOuApagar(props, COL.tamanho, c.tamanho.trim())
  gravarOuApagar(props, COL.conservacao, c.comprado ? c.conservacao : null)
  props[COL.comprado] = c.comprado
  gravarOuApagar(props, COL.valor, c.valor)
  gravarOuApagar(props, COL.site, urlValida(c.site))
  return props
}

/** Passa um desejo para as peças: comprado, e com a conservação "Nunca Usada" se ainda não tinha. */
export function marcarComprado(atual: Valores | null): Valores {
  const props = atual ?? {}
  return { ...props, [COL.comprado]: true, [COL.conservacao]: props[COL.conservacao] || "Nunca Usada" }
}

/**
 * As propriedades de um outfit: as peças vão nos dois jeitos (nomes em `Peças`, ids em `_pecas`), e os
 * lugares, horas e climas com vírgula. `Utilizado` e `_usos` ficam como estão.
 */
export function propsDoOutfit(
  atual: Valores | null,
  c: { pecas: Peca[]; lugares: string[]; horas: string[]; climas: string[] },
): Valores {
  const props: Valores = { ...(atual ?? {}) }
  props[COL.pecas] = c.pecas.map((p) => p.nome)
  props._pecas = c.pecas.map((p) => p.id)
  gravarOuApagar(props, COL.lugar, c.lugares.join(", "))
  gravarOuApagar(props, COL.hora, c.horas.join(", "))
  gravarOuApagar(props, COL.clima, c.climas.join(", "))
  return props
}

/**
 * Marca ou desmarca o uso de hoje. `_usos` (a lista) e `Utilizado` (o último uso) andam juntos: sem nenhum
 * uso, as duas colunas saem.
 */
export function alternarUsoHoje(atual: Valores | null, hoje: string): Valores {
  const props: Valores = { ...(atual ?? {}) }
  const usos = lerUsos(props)
  const novos = usos.includes(hoje) ? usos.filter((d) => d !== hoje) : [...usos, hoje].sort()
  gravarOuApagar(props, "_usos", novos.length ? novos : undefined)
  gravarOuApagar(props, COL.utilizado, novos.at(-1))
  return props
}
