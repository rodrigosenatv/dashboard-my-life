import { normalizar, numeroFlexivel } from "@/lib/utils"
import { ingredientesDaReceita, limparMarkdown } from "./texto"
import { TACO } from "./taco-dados"

/*
 * Calorias e macronutrientes do que está escrito no plano e nas receitas. Cada item
 * ("250 g de arroz branco cozido") vira um alimento da TACO e uma quantidade; os valores por
 * 100 g da tabela fazem o resto. A pessoa pode corrigir qualquer item (outro alimento, outra
 * quantidade, não contar ou os valores do rótulo), e a correção fica guardada no próprio item.
 * Sem React nem banco: tudo aqui é função pura.
 */

/* ------------------------------------------------------------------ */
/* Nutrientes                                                          */
/* ------------------------------------------------------------------ */

export type Nutrientes = { kcal: number; p: number; c: number; g: number }

export const NADA: Nutrientes = { kcal: 0, p: 0, c: 0, g: 0 }

export const somar = (...lista: Nutrientes[]): Nutrientes =>
  lista.reduce((t, n) => ({ kcal: t.kcal + n.kcal, p: t.p + n.p, c: t.c + n.c, g: t.g + n.g }), NADA)

export const vezes = (n: Nutrientes, f: number): Nutrientes => ({ kcal: n.kcal * f, p: n.p * f, c: n.c * f, g: n.g * f })

/* ------------------------------------------------------------------ */
/* Alimentos: a TACO e alguns valores típicos de rótulo                */
/* ------------------------------------------------------------------ */

export type Alimento = {
  id: string
  nome: string
  /** "taco" ou "tipico" (valor típico de rótulo, para o que a TACO não tem). */
  fonte: "taco" | "tipico"
  /** Por 100 g (ou 100 ml, nos líquidos de rótulo). */
  por100: Nutrientes
  /** Grupo da TACO (0 = cereais… 14 = nozes); -1 nos suplementos. */
  grupo: number
  /** Os valores são por 100 ml (leite de rótulo). */
  porMl?: boolean
}

/** Bebida: a quantidade costuma ser em ml. */
export const ehBebida = (a: Alimento) => Boolean(a.porMl) || a.grupo === 7 || /\bsuco\b/i.test(a.nome)

/**
 * O que a TACO não traz (o leite líquido está "em reavaliação" na 4ª edição; whey e geleia de
 * frutas não existem nela): médias de rótulos comuns no Brasil, marcadas como valor típico.
 */
const TIPICOS: Alimento[] = [
  { id: "x-leite-integral", nome: "Leite integral (UHT)", fonte: "tipico", por100: { kcal: 60, p: 3, c: 4.6, g: 3.2 }, grupo: 6, porMl: true },
  { id: "x-leite-semidesnatado", nome: "Leite semidesnatado (UHT)", fonte: "tipico", por100: { kcal: 44, p: 3, c: 4.8, g: 1.3 }, grupo: 6, porMl: true },
  { id: "x-leite-desnatado", nome: "Leite desnatado (UHT)", fonte: "tipico", por100: { kcal: 34, p: 3.1, c: 4.8, g: 0.2 }, grupo: 6, porMl: true },
  { id: "x-whey", nome: "Whey protein concentrado", fonte: "tipico", por100: { kcal: 400, p: 78, c: 9, g: 6 }, grupo: -1 },
  { id: "x-albumina", nome: "Albumina (clara de ovo em pó)", fonte: "tipico", por100: { kcal: 350, p: 82, c: 5, g: 0.3 }, grupo: -1 },
  { id: "x-geleia", nome: "Geleia de frutas", fonte: "tipico", por100: { kcal: 260, p: 0.4, c: 65, g: 0.1 }, grupo: 9 },
]

let porId: Map<string, Alimento> | null = null
function tabela(): Map<string, Alimento> {
  if (porId) return porId
  porId = new Map()
  for (const [id, nome, kcal, p, c, g, grupo] of TACO) porId.set(String(id), { id: String(id), nome, fonte: "taco", por100: { kcal, p, c, g }, grupo })
  for (const t of TIPICOS) porId.set(t.id, t)
  return porId
}

export const alimentoPorId = (id: string): Alimento | undefined => tabela().get(id)

/* ------------------------------------------------------------------ */
/* Texto: normalizar, achar palavras                                   */
/* ------------------------------------------------------------------ */

/** Minúsculas e sem acento, mantendo a pontuação (para ler números e medidas). */
const base = (t: string) => normalizar(t).replace(/\s+/g, " ")

/** Só letras e números separados por um espaço (para achar nomes de alimentos). */
const palavras = (t: string) =>
  base(t)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/** Tira o que está entre parênteses (alternativas, observações). */
const semParenteses = (t: string) => t.replace(/\([^()]*\)/g, " ").replace(/\([^()]*\)/g, " ").replace(/[()]/g, " ")

/** Divide no separador só fora de parênteses. */
function dividirFora(t: string, separador: RegExp): string[] {
  const partes: string[] = []
  let nivel = 0
  let atual = ""
  let i = 0
  while (i < t.length) {
    const ch = t[i]
    if (ch === "(") nivel++
    if (ch === ")") nivel = Math.max(0, nivel - 1)
    if (nivel === 0) {
      separador.lastIndex = i
      const m = separador.exec(t)
      if (m && m.index === i && m[0].length > 0) {
        partes.push(atual)
        atual = ""
        i += m[0].length
        continue
      }
    }
    atual += ch
    i++
  }
  partes.push(atual)
  return partes.map((p) => p.trim()).filter(Boolean)
}

/** Plural e gênero simples de uma palavra, para "banana" achar "bananas" e "cozido" achar "cozida". */
function variacoes(w: string): string {
  if (/^(de|da|do|em|com|e|a|o|ao|na|no)$/.test(w)) return w
  if (w.endsWith("ao")) return `${w.slice(0, -2)}(?:ao|oes|aes|aos)`
  if (/(?:d|t)[oa]$/.test(w) && w.length > 4) return `${w.slice(0, -1)}[oa]s?`
  if (w.endsWith("l") && w.length > 3) return `${w.slice(0, -1)}(?:l|is)`
  if (/[rzs]$/.test(w)) return `${w}(?:es)?`
  if (w.endsWith("m")) return `${w.slice(0, -1)}(?:m|ns)`
  return `${w}s?`
}

const regexDoTermo = (termo: string) => new RegExp(`(?:^| )${termo.split(" ").map(variacoes).join(" ")}(?= |$)`)

/* ------------------------------------------------------------------ */
/* Alimentos conhecidos: nomes do dia a dia e medidas caseiras         */
/* ------------------------------------------------------------------ */

export type Medida =
  | "colher_sopa"
  | "colher_sobremesa"
  | "colher_cha"
  | "colher_cafe"
  | "xicara"
  | "copo"
  | "concha"
  | "fatia"
  | "file"
  | "unidade"
  | "scoop"
  | "lata"
  | "pote"
  | "dente"
  | "pitada"
  | "punhado"
  | "porcao"
  | "pedaco"
  | "folha"
  | "caixa"
  | "fio"
  | "maco"
  | "prato"

/** Peso (g) ou volume (ml) de cada medida quando o alimento não tem a sua. */
const MEDIDA_PADRAO: Partial<Record<Medida, number>> = {
  colher_sopa: 15,
  colher_sobremesa: 10,
  colher_cha: 5,
  colher_cafe: 2,
  xicara: 240,
  copo: 200,
  concha: 100,
  fatia: 25,
  file: 100,
  scoop: 30,
  lata: 350,
  pote: 170,
  dente: 4,
  pitada: 0.5,
  punhado: 30,
  porcao: 100,
  pedaco: 50,
  folha: 10,
  caixa: 200,
  fio: 5,
  maco: 150,
  prato: 300,
}

/** Medidas que se medem por volume num alimento líquido (ficam em ml). */
const VOLUMETRICAS = new Set<Medida>(["colher_sopa", "colher_sobremesa", "colher_cha", "colher_cafe", "xicara", "copo", "concha", "lata", "caixa", "fio"])
/** Medidas que se contam (ovos, fatias de pão): a lista de compras mostra a contagem. */
const CONTAVEIS = new Set<Medida>(["unidade", "fatia", "file", "lata", "pote", "caixa"])

export type MotivoIgnorado = "opcional" | "agua" | "tempero" | "salada" | "sem-calorias" | "voce"

type Conhecido = {
  termos: string[]
  /** Alimento num prato pronto (o plano costuma pesar o arroz cozido). */
  id?: string
  /** Alimento numa receita (que costuma listar o arroz cru). */
  receita?: string
  ignorar?: Exclude<MotivoIgnorado, "opcional" | "voce">
  /** Medido em ml nas medidas caseiras (copo, xícara, colher). */
  liquido?: boolean
  /** g por ml (azeite 0,92; mel 1,4). */
  densidade?: number
  medidas?: Partial<Record<Medida, number>>
  /** Porção típica, quando o texto não diz quanto (g, ou ml se líquido). */
  porcao?: number
  /** Para alimentos que a TACO só tem crus: gramas do alimento cru por grama do item. */
  equivale?: number
  /** Nome na lista de compras. */
  compra?: string
  /** Explica uma aproximação (o que a TACO não tem). */
  nota?: string
}

// prettier-ignore
const CONHECIDOS_BRUTOS: Conhecido[] = [
  // Sem calorias que contem
  { termos: ["agua", "agua mineral", "agua com gas", "agua gelada", "agua natural"], ignorar: "agua" },
  { termos: ["sal", "sal grosso", "sal rosa", "pimenta", "pimenta do reino", "tempero", "tempero pronto", "cheiro verde", "salsinha", "salsa", "cebolinha", "coentro", "oregano", "manjericao", "alecrim", "tomilho", "louro", "folha de louro", "acafrao", "curcuma", "colorau", "paprica", "canela", "cominho", "noz moscada", "gengibre", "vinagre", "shoyu", "molho de soja", "mostarda", "ervas", "ervas finas", "limao espremido", "suco de limao"], ignorar: "tempero" },
  { termos: ["gelo", "adocante", "creatina", "fermento", "fermento em po", "fermento biologico", "bicarbonato", "cafeina", "multivitaminico", "vitamina c"], ignorar: "sem-calorias" },
  { termos: ["salada", "salada verde", "salada crua", "salada simples", "legumes", "legume", "verduras", "folhas", "folhas verdes", "vegetais", "hortalicas", "mix de folhas"], ignorar: "salada" },

  // Cereais, pães, massas
  { termos: ["arroz", "arroz branco", "arroz cozido", "arroz branco cozido", "arroz tipo 1", "arroz soltinho"], id: "3", receita: "4", medidas: { colher_sopa: 25, xicara: 160, concha: 100 }, porcao: 150, compra: "Arroz branco" },
  { termos: ["arroz cru", "arroz branco cru"], id: "4", medidas: { xicara: 185, colher_sopa: 15 }, compra: "Arroz branco" },
  { termos: ["arroz integral", "arroz integral cozido"], id: "1", receita: "2", medidas: { colher_sopa: 25, xicara: 160, concha: 100 }, porcao: 150, compra: "Arroz integral" },
  { termos: ["arroz integral cru"], id: "2", medidas: { xicara: 185 }, compra: "Arroz integral" },
  { termos: ["aveia", "aveia em flocos", "flocos de aveia", "aveia flocos", "farelo de aveia", "farinha de aveia"], id: "7", medidas: { colher_sopa: 15, colher_cha: 5, xicara: 80 }, porcao: 30, compra: "Aveia em flocos" },
  { termos: ["pao", "pao frances", "pao de sal", "pao careca", "paozinho"], id: "53", medidas: { unidade: 50, fatia: 25 }, porcao: 50, compra: "Pão francês" },
  { termos: ["pao de forma", "pao de forma integral", "pao integral", "pao de forma tradicional", "pao de forma branco", "pao de sanduiche"], id: "52", medidas: { fatia: 25 }, porcao: 50, compra: "Pão de forma", nota: "A TACO só tem o pão de forma integral; o tradicional tem valores parecidos." },
  { termos: ["torrada", "torradinha"], id: "63", medidas: { unidade: 10, fatia: 10 }, porcao: 30 },
  { termos: ["pao de queijo"], id: "140", medidas: { unidade: 30 }, porcao: 60 },
  { termos: ["macarrao", "espaguete", "penne", "talharim", "macarrao integral", "macarrao parafuso", "fusilli"], id: "40", equivale: 0.4, receita: "40", medidas: { xicara: 140 }, porcao: 150, compra: "Macarrão", nota: "A TACO só tem o macarrão cru: o cozido conta como 40% do peso." },
  { termos: ["macarrao cru", "espaguete cru"], id: "40", medidas: { xicara: 100 }, compra: "Macarrão" },
  { termos: ["cuscuz", "cuscuz de milho", "cuscuz nordestino"], id: "533", medidas: { fatia: 80 }, porcao: 150, compra: "Flocão de milho (cuscuz)" },
  { termos: ["tapioca"], id: "551", medidas: { unidade: 70 }, porcao: 70, compra: "Goma de tapioca", nota: "A TACO só tem a tapioca com manteiga." },
  { termos: ["farinha de mandioca"], id: "121", medidas: { colher_sopa: 12 }, porcao: 20 },
  { termos: ["farofa"], id: "131", medidas: { colher_sopa: 10 }, porcao: 20 },
  { termos: ["farinha de trigo"], id: "35", medidas: { xicara: 120, colher_sopa: 8 } },
  { termos: ["fuba"], id: "43", medidas: { xicara: 120, colher_sopa: 8 } },
  { termos: ["amido de milho", "maisena"], id: "42", medidas: { colher_sopa: 8 } },
  { termos: ["milho", "milho verde", "milho em conserva"], id: "45", medidas: { colher_sopa: 20, lata: 200 }, porcao: 50 },
  { termos: ["pipoca"], id: "61", medidas: { xicara: 10 }, porcao: 25 },
  { termos: ["biscoito cream cracker", "cream cracker", "bolacha agua e sal", "biscoito agua e sal", "biscoito de agua e sal", "biscoito de sal", "bolacha de sal", "biscoito salgado"], id: "13", medidas: { unidade: 6 }, porcao: 30 },
  { termos: ["bolo", "bolo caseiro", "bolo simples", "bolo de milho", "bolo de fuba", "bolo de cenoura", "bolo de laranja"], id: "18", medidas: { fatia: 60, pedaco: 60 }, porcao: 60, nota: "Bolo sem receita na TACO: usei o bolo de milho pronto, um bolo simples." },
  { termos: ["bolo de chocolate"], id: "16", medidas: { fatia: 60, pedaco: 60 }, porcao: 60 },
  { termos: ["biscoito maisena", "bolacha maisena"], id: "8", medidas: { unidade: 5 }, porcao: 30 },

  // Leguminosas
  { termos: ["feijao", "feijao carioca", "feijao cozido", "feijao carioca cozido", "caldo de feijao"], id: "561", receita: "562", medidas: { concha: 100, colher_sopa: 20, xicara: 160 }, porcao: 100, compra: "Feijão carioca" },
  { termos: ["feijao preto", "feijao preto cozido"], id: "567", receita: "568", medidas: { concha: 100, colher_sopa: 20, xicara: 160 }, porcao: 100, compra: "Feijão preto" },
  { termos: ["feijao cru", "feijao carioca cru"], id: "562", medidas: { xicara: 180 }, compra: "Feijão carioca" },
  { termos: ["feijao preto cru"], id: "568", medidas: { xicara: 180 }, compra: "Feijão preto" },
  { termos: ["lentilha", "lentilha cozida"], id: "577", receita: "578", medidas: { concha: 100, colher_sopa: 20, xicara: 160 }, porcao: 100, compra: "Lentilha" },
  { termos: ["lentilha crua"], id: "578", medidas: { xicara: 190 }, compra: "Lentilha" },
  { termos: ["grao de bico", "grao de bico cozido"], id: "575", equivale: 0.46, receita: "575", medidas: { xicara: 160, colher_sopa: 20 }, porcao: 100, compra: "Grão-de-bico", nota: "A TACO só tem o grão-de-bico cru: o cozido conta como 46% do peso." },
  { termos: ["ervilha", "ervilha em lata"], id: "560", medidas: { colher_sopa: 20, lata: 200 }, porcao: 50 },

  // Aves, carnes, peixes, ovos
  { termos: ["frango", "peito de frango", "file de frango", "frango grelhado", "peito de frango grelhado", "file de frango grelhado", "sassami"], id: "410", receita: "409", medidas: { file: 100, unidade: 100, pedaco: 50 }, porcao: 120, compra: "Peito de frango" },
  { termos: ["frango cozido", "peito de frango cozido", "frango desfiado", "peito de frango desfiado", "frango desfiado cozido"], id: "408", medidas: { file: 100, colher_sopa: 25 }, porcao: 120, compra: "Peito de frango" },
  { termos: ["frango cru", "peito de frango cru", "file de frango cru"], id: "409", medidas: { file: 120 }, compra: "Peito de frango" },
  { termos: ["coxa de frango", "coxa"], id: "398", receita: "399", medidas: { unidade: 90 }, porcao: 90, compra: "Coxa de frango" },
  { termos: ["sobrecoxa", "sobrecoxa de frango"], id: "413", receita: "414", medidas: { unidade: 100 }, porcao: 100, compra: "Sobrecoxa de frango" },
  { termos: ["carne moida", "carne moida magra", "patinho moido", "acem moido", "musculo moido"], id: "326", receita: "327", medidas: { colher_sopa: 25 }, porcao: 120, compra: "Carne moída" },
  { termos: ["carne", "bife", "patinho", "bife de patinho", "carne bovina", "carne vermelha", "carne magra"], id: "377", receita: "376", medidas: { file: 100, unidade: 100, pedaco: 50 }, porcao: 120, compra: "Patinho" },
  { termos: ["musculo"], id: "371", receita: "372", porcao: 120, compra: "Músculo" },
  { termos: ["alcatra", "miolo de alcatra"], id: "370", receita: "369", medidas: { file: 100 }, porcao: 120, compra: "Alcatra" },
  { termos: ["picanha"], id: "383", receita: "382", porcao: 120, compra: "Picanha" },
  { termos: ["contra file", "contrafile"], id: "346", receita: "345", medidas: { file: 100 }, porcao: 120, compra: "Contrafilé" },
  { termos: ["file mignon"], id: "358", receita: "357", porcao: 120, compra: "Filé mignon" },
  { termos: ["maminha"], id: "368", receita: "367", porcao: 120, compra: "Maminha" },
  { termos: ["lagarto"], id: "363", receita: "364", porcao: 120, compra: "Lagarto" },
  { termos: ["coxao mole"], id: "351", receita: "352", porcao: 120, compra: "Coxão mole" },
  { termos: ["coxao duro"], id: "349", receita: "350", porcao: 120, compra: "Coxão duro" },
  { termos: ["acem"], id: "328", receita: "329", porcao: 120, compra: "Acém" },
  { termos: ["figado", "bife de figado"], id: "356", receita: "355", porcao: 100, compra: "Fígado" },
  { termos: ["carne seca"], id: "384", receita: "385", porcao: 80, compra: "Carne seca" },
  { termos: ["lombo", "lombo de porco", "lombo suino"], id: "432", receita: "433", porcao: 120, compra: "Lombo de porco" },
  { termos: ["bisteca", "bisteca de porco"], id: "429", receita: "427", medidas: { unidade: 120 }, porcao: 120, compra: "Bisteca de porco" },
  { termos: ["pernil", "pernil de porco"], id: "435", receita: "436", porcao: 120, compra: "Pernil" },
  { termos: ["linguica", "linguica de porco", "linguica toscana"], id: "423", receita: "421", medidas: { unidade: 80 }, porcao: 80, compra: "Linguiça" },
  { termos: ["linguica de frango"], id: "420", receita: "418", medidas: { unidade: 80 }, porcao: 80, compra: "Linguiça de frango" },
  { termos: ["bacon", "toucinho"], id: "445", receita: "444", medidas: { fatia: 10 }, porcao: 20, compra: "Bacon" },
  { termos: ["hamburguer", "hamburguer bovino", "hamburguer caseiro"], id: "417", receita: "415", medidas: { unidade: 90 }, porcao: 90, compra: "Hambúrguer" },
  { termos: ["presunto"], id: "439", medidas: { fatia: 15 }, porcao: 30, compra: "Presunto" },
  { termos: ["mortadela"], id: "424", medidas: { fatia: 15 }, porcao: 30, compra: "Mortadela" },
  { termos: ["salame"], id: "443", medidas: { fatia: 5 }, porcao: 20, compra: "Salame" },
  { termos: ["peixe", "file de peixe", "tilapia", "file de tilapia", "merluza", "file de merluza"], id: "301", receita: "302", medidas: { file: 120, unidade: 120 }, porcao: 120, compra: "Filé de peixe", nota: "Peixe sem espécie na TACO (como a tilápia): usei filé de merluza, um peixe branco parecido." },
  { termos: ["salmao", "file de salmao"], id: "317", receita: "316", medidas: { file: 120 }, porcao: 120, compra: "Salmão" },
  { termos: ["atum", "atum em lata", "atum solido", "atum ralado", "atum em agua", "atum em oleo"], id: "277", medidas: { lata: 120, colher_sopa: 20 }, porcao: 60, compra: "Atum em lata" },
  { termos: ["sardinha", "sardinha em lata", "sardinha em oleo"], id: "319", medidas: { lata: 84, unidade: 30 }, porcao: 84, compra: "Sardinha em lata" },
  { termos: ["camarao"], id: "284", receita: "285", porcao: 100, compra: "Camarão" },
  { termos: ["bacalhau"], id: "280", receita: "279", porcao: 100, compra: "Bacalhau" },
  { termos: ["ovo", "ovo cozido", "ovo mexido", "ovo inteiro", "ovos inteiros", "ovo de galinha"], id: "488", receita: "489", medidas: { unidade: 50 }, porcao: 50, compra: "Ovos" },
  { termos: ["ovo frito"], id: "490", medidas: { unidade: 50 }, porcao: 50, compra: "Ovos" },
  { termos: ["clara", "clara de ovo"], id: "486", receita: "486", medidas: { unidade: 30 }, porcao: 30, compra: "Ovos" },
  { termos: ["gema", "gema de ovo"], id: "487", medidas: { unidade: 17 }, porcao: 17, compra: "Ovos" },

  // Leite e derivados
  { termos: ["leite", "leite integral", "leite de vaca", "leite uht", "leite integral uht", "leite gelado", "leite morno"], id: "x-leite-integral", liquido: true, medidas: { copo: 200, xicara: 240, caixa: 1000 }, porcao: 200, compra: "Leite integral" },
  { termos: ["leite semidesnatado"], id: "x-leite-semidesnatado", liquido: true, medidas: { copo: 200, xicara: 240, caixa: 1000 }, porcao: 200, compra: "Leite semidesnatado" },
  { termos: ["leite desnatado"], id: "x-leite-desnatado", liquido: true, medidas: { copo: 200, xicara: 240, caixa: 1000 }, porcao: 200, compra: "Leite desnatado" },
  { termos: ["leite em po", "leite em po integral", "leite po"], id: "459", medidas: { colher_sopa: 15, colher_cha: 5 }, porcao: 30, compra: "Leite em pó integral" },
  { termos: ["leite em po desnatado"], id: "456", medidas: { colher_sopa: 15, colher_cha: 5 }, porcao: 30, compra: "Leite em pó desnatado" },
  { termos: ["leite condensado"], id: "453", medidas: { lata: 395, caixa: 395, colher_sopa: 20 }, porcao: 20 },
  { termos: ["creme de leite"], id: "447", medidas: { caixa: 200, lata: 300, colher_sopa: 15 }, porcao: 15 },
  { termos: ["iogurte", "iogurte natural", "iogurte integral", "iogurte natural integral"], id: "448", medidas: { pote: 170, copo: 200, unidade: 170 }, porcao: 170, compra: "Iogurte natural" },
  { termos: ["iogurte desnatado", "iogurte natural desnatado"], id: "449", medidas: { pote: 170, copo: 200, unidade: 170 }, porcao: 170, compra: "Iogurte natural desnatado" },
  { termos: ["iogurte de morango", "iogurte com sabor", "iogurte de frutas"], id: "451", medidas: { pote: 100, copo: 200, unidade: 100 }, porcao: 100 },
  { termos: ["queijo", "queijo minas", "queijo branco", "queijo minas frescal", "minas frescal", "queijo fresco"], id: "461", medidas: { fatia: 30, colher_sopa: 15 }, porcao: 30, compra: "Queijo minas frescal" },
  { termos: ["queijo minas padrao", "queijo minas meia cura", "queijo meia cura"], id: "462", medidas: { fatia: 30 }, porcao: 30, compra: "Queijo minas padrão" },
  { termos: ["mussarela", "mucarela", "mozarela", "mozzarella", "queijo mussarela", "queijo mucarela", "queijo mozarela"], id: "463", medidas: { fatia: 20, colher_sopa: 10 }, porcao: 30, compra: "Muçarela" },
  { termos: ["queijo prato"], id: "467", medidas: { fatia: 20 }, porcao: 30, compra: "Queijo prato" },
  { termos: ["parmesao", "queijo parmesao", "queijo ralado"], id: "464", medidas: { colher_sopa: 8 }, porcao: 10, compra: "Parmesão" },
  { termos: ["ricota"], id: "469", medidas: { fatia: 30, colher_sopa: 20 }, porcao: 30, compra: "Ricota" },
  { termos: ["requeijao", "requeijao cremoso", "requeijao light"], id: "468", medidas: { colher_sopa: 30, colher_cha: 10 }, porcao: 30, compra: "Requeijão" },
  { termos: ["manteiga", "manteiga com sal"], id: "261", medidas: { colher_sopa: 12, colher_cha: 5 }, porcao: 10, compra: "Manteiga" },
  { termos: ["manteiga sem sal"], id: "262", medidas: { colher_sopa: 12, colher_cha: 5 }, porcao: 10, compra: "Manteiga sem sal" },
  { termos: ["margarina"], id: "265", medidas: { colher_sopa: 12, colher_cha: 5 }, porcao: 10, compra: "Margarina" },

  // Frutas (peso da parte que se come)
  { termos: ["banana", "banana prata"], id: "182", medidas: { unidade: 70 }, porcao: 70, compra: "Banana prata" },
  { termos: ["banana nanica", "banana d agua", "banana dagua"], id: "179", medidas: { unidade: 100 }, porcao: 100, compra: "Banana nanica" },
  { termos: ["banana da terra"], id: "175", medidas: { unidade: 150 }, porcao: 150, compra: "Banana-da-terra" },
  { termos: ["banana maca"], id: "178", medidas: { unidade: 60 }, porcao: 60, compra: "Banana-maçã" },
  { termos: ["maca", "maca fuji", "maca gala"], id: "222", medidas: { unidade: 130 }, porcao: 130, compra: "Maçã" },
  { termos: ["mamao", "mamao papaia", "papaia"], id: "226", medidas: { unidade: 270, fatia: 100 }, porcao: 150, compra: "Mamão papaia" },
  { termos: ["mamao formosa"], id: "225", medidas: { fatia: 150 }, porcao: 150, compra: "Mamão formosa" },
  { termos: ["laranja", "laranja pera"], id: "214", medidas: { unidade: 130 }, porcao: 130, compra: "Laranja" },
  { termos: ["suco", "suco de laranja", "suco de fruta", "suco de frutas", "suco natural", "suco de laranja natural", "suco integral"], id: "215", liquido: true, medidas: { copo: 200, xicara: 240 }, porcao: 200, compra: "Suco de laranja" },
  { termos: ["suco de uva", "suco de uva integral"], id: "258", liquido: true, medidas: { copo: 200, xicara: 240 }, porcao: 200, compra: "Suco de uva integral" },
  { termos: ["abacaxi"], id: "164", medidas: { fatia: 80, unidade: 900 }, porcao: 80, compra: "Abacaxi" },
  { termos: ["melancia"], id: "235", medidas: { fatia: 200 }, porcao: 200, compra: "Melancia" },
  { termos: ["melao"], id: "236", medidas: { fatia: 100 }, porcao: 100, compra: "Melão" },
  { termos: ["morango"], id: "239", medidas: { unidade: 12, xicara: 150 }, porcao: 100, compra: "Morango" },
  { termos: ["uva", "uva italia"], id: "256", medidas: { unidade: 8, xicara: 150 }, porcao: 100, compra: "Uva" },
  { termos: ["abacate"], id: "163", medidas: { colher_sopa: 30, unidade: 400 }, porcao: 100, compra: "Abacate" },
  { termos: ["manga"], id: "231", medidas: { unidade: 250 }, porcao: 150, compra: "Manga" },
  { termos: ["pera"], id: "243", medidas: { unidade: 130 }, porcao: 130, compra: "Pera" },
  { termos: ["kiwi"], id: "207", medidas: { unidade: 75 }, porcao: 75, compra: "Kiwi" },
  { termos: ["goiaba"], id: "200", medidas: { unidade: 170 }, porcao: 170, compra: "Goiaba" },
  { termos: ["tangerina", "mexerica", "ponca", "bergamota"], id: "251", medidas: { unidade: 120 }, porcao: 120, compra: "Tangerina" },
  { termos: ["acai", "acai na tigela"], id: "167", medidas: { copo: 200 }, porcao: 200, compra: "Açaí" },
  { termos: ["polpa de acai"], id: "168", medidas: { unidade: 100 }, porcao: 100, compra: "Polpa de açaí" },
  { termos: ["limao", "limao tahiti"], id: "220", medidas: { unidade: 60 }, porcao: 60, compra: "Limão" },
  { termos: ["maracuja"], id: "232", medidas: { unidade: 50 }, porcao: 50, compra: "Maracujá" },
  { termos: ["ameixa"], id: "172", medidas: { unidade: 40 }, porcao: 80, compra: "Ameixa" },
  { termos: ["pessego"], id: "244", medidas: { unidade: 110 }, porcao: 110, compra: "Pêssego" },
  { termos: ["coco", "coco ralado"], id: "590", medidas: { colher_sopa: 10 }, porcao: 20, compra: "Coco" },
  { termos: ["agua de coco"], id: "478", liquido: true, medidas: { copo: 200, caixa: 1000 }, porcao: 300, compra: "Água de coco" },

  // Raízes, legumes, verduras
  { termos: ["batata", "batata inglesa", "batata cozida", "batata inglesa cozida"], id: "91", receita: "92", medidas: { unidade: 150 }, porcao: 150, compra: "Batata" },
  { termos: ["batata crua", "batata inglesa crua"], id: "92", medidas: { unidade: 150 }, compra: "Batata" },
  { termos: ["batata doce", "batata doce cozida"], id: "88", receita: "89", medidas: { unidade: 150 }, porcao: 150, compra: "Batata-doce" },
  { termos: ["batata doce crua"], id: "89", medidas: { unidade: 150 }, compra: "Batata-doce" },
  { termos: ["batata frita"], id: "93", porcao: 100 },
  { termos: ["mandioca", "aipim", "macaxeira", "mandioca cozida", "aipim cozido", "macaxeira cozida"], id: "129", receita: "130", medidas: { pedaco: 80 }, porcao: 150, compra: "Mandioca" },
  { termos: ["mandioca frita", "aipim frito"], id: "132", porcao: 100 },
  { termos: ["inhame"], id: "126", medidas: { unidade: 100 }, porcao: 100, compra: "Inhame" },
  { termos: ["abobora", "abobora cabotia", "abobora japonesa", "abobora cabotian"], id: "64", receita: "65", porcao: 100, compra: "Abóbora" },
  { termos: ["brocolis", "brocolis cozido"], id: "100", receita: "101", porcao: 80, compra: "Brócolis" },
  { termos: ["couve flor"], id: "118", receita: "117", porcao: 80, compra: "Couve-flor" },
  { termos: ["cenoura", "cenoura ralada"], id: "110", medidas: { unidade: 100 }, porcao: 50, compra: "Cenoura" },
  { termos: ["cenoura cozida"], id: "109", medidas: { unidade: 100 }, porcao: 50, compra: "Cenoura" },
  { termos: ["tomate"], id: "157", medidas: { unidade: 100, fatia: 15 }, porcao: 60, compra: "Tomate" },
  { termos: ["tomate cereja"], id: "157", medidas: { unidade: 10 }, porcao: 60, compra: "Tomate-cereja" },
  { termos: ["alface"], id: "78", medidas: { folha: 10 }, porcao: 30, compra: "Alface" },
  { termos: ["pepino"], id: "142", medidas: { unidade: 200 }, porcao: 50, compra: "Pepino" },
  { termos: ["cebola"], id: "107", medidas: { unidade: 100 }, porcao: 30, compra: "Cebola" },
  { termos: ["alho", "alho picado", "alho amassado"], id: "82", medidas: { dente: 4, colher_cha: 4, colher_sopa: 10, unidade: 40 }, porcao: 4, compra: "Alho" },
  { termos: ["beterraba", "beterraba ralada"], id: "98", medidas: { unidade: 120 }, porcao: 50, compra: "Beterraba" },
  { termos: ["beterraba cozida"], id: "97", medidas: { unidade: 120 }, porcao: 50, compra: "Beterraba" },
  { termos: ["abobrinha"], id: "71", medidas: { unidade: 200 }, porcao: 80, compra: "Abobrinha" },
  { termos: ["abobrinha refogada"], id: "72", porcao: 80, compra: "Abobrinha" },
  { termos: ["chuchu"], id: "112", receita: "113", medidas: { unidade: 200 }, porcao: 80, compra: "Chuchu" },
  { termos: ["couve", "couve manteiga", "couve refogada"], id: "116", receita: "115", medidas: { folha: 15 }, porcao: 50, compra: "Couve" },
  { termos: ["espinafre"], id: "120", receita: "119", porcao: 50, compra: "Espinafre" },
  { termos: ["vagem"], id: "162", porcao: 60, compra: "Vagem" },
  { termos: ["repolho"], id: "149", porcao: 50, compra: "Repolho" },
  { termos: ["quiabo"], id: "147", porcao: 60, compra: "Quiabo" },
  { termos: ["berinjela"], id: "95", receita: "96", medidas: { unidade: 250 }, porcao: 80, compra: "Berinjela" },
  { termos: ["pimentao"], id: "144", medidas: { unidade: 150 }, porcao: 30, compra: "Pimentão" },
  { termos: ["palmito"], id: "138", porcao: 50, compra: "Palmito" },

  // Óleos, oleaginosas, açúcares
  { termos: ["azeite", "azeite de oliva", "azeite extra virgem", "azeite de oliva extra virgem"], id: "260", liquido: true, densidade: 0.92, porcao: 10, compra: "Azeite de oliva" },
  { termos: ["oleo", "oleo de soja", "oleo vegetal"], id: "272", liquido: true, densidade: 0.92, porcao: 10, compra: "Óleo de soja" },
  { termos: ["amendoim", "amendoim torrado"], id: "558", medidas: { punhado: 30, colher_sopa: 15 }, porcao: 30, compra: "Amendoim" },
  { termos: ["amendoim cru"], id: "557", medidas: { punhado: 30, xicara: 140 }, porcao: 30, compra: "Amendoim" },
  { termos: ["pasta de amendoim", "pasta de amendoim integral", "creme de amendoim", "manteiga de amendoim"], id: "558", medidas: { colher_sopa: 15, colher_cha: 5 }, porcao: 15, compra: "Pasta de amendoim", nota: "A TACO não tem pasta de amendoim: vale o amendoim torrado, quase igual." },
  { termos: ["castanha de caju"], id: "588", medidas: { unidade: 2.5, punhado: 30 }, porcao: 30, compra: "Castanha-de-caju" },
  { termos: ["castanha", "castanha do para", "castanha do brasil"], id: "589", medidas: { unidade: 4, punhado: 30 }, porcao: 20, compra: "Castanha-do-pará" },
  { termos: ["amendoa"], id: "587", medidas: { unidade: 1.2, punhado: 30 }, porcao: 30, compra: "Amêndoas" },
  { termos: ["noz", "nozes"], id: "597", medidas: { unidade: 5, punhado: 30 }, porcao: 20, compra: "Nozes" },
  { termos: ["linhaca", "semente de linhaca", "farinha de linhaca"], id: "594", medidas: { colher_sopa: 10, colher_cha: 3 }, porcao: 10, compra: "Linhaça" },
  { termos: ["gergelim"], id: "593", medidas: { colher_sopa: 9 }, porcao: 9, compra: "Gergelim" },
  { termos: ["mel", "mel de abelha"], id: "507", densidade: 1.4, medidas: { colher_sopa: 20, colher_sobremesa: 14, colher_cha: 7, fio: 7 }, porcao: 20, compra: "Mel" },
  { termos: ["acucar", "acucar refinado"], id: "494", medidas: { colher_sopa: 12, colher_cha: 4, xicara: 180 }, porcao: 8, compra: "Açúcar" },
  { termos: ["acucar cristal"], id: "492", medidas: { colher_sopa: 12, colher_cha: 4, xicara: 180 }, porcao: 8, compra: "Açúcar cristal" },
  { termos: ["acucar mascavo"], id: "493", medidas: { colher_sopa: 10, colher_cha: 4, xicara: 150 }, porcao: 8, compra: "Açúcar mascavo" },
  { termos: ["achocolatado", "achocolatado em po"], id: "491", medidas: { colher_sopa: 10, colher_cha: 4 }, porcao: 20, compra: "Achocolatado em pó" },
  { termos: ["chocolate", "chocolate ao leite"], id: "495", medidas: { pedaco: 10 }, porcao: 25, compra: "Chocolate ao leite" },
  { termos: ["chocolate amargo", "chocolate meio amargo"], id: "498", medidas: { pedaco: 10 }, porcao: 25, compra: "Chocolate meio amargo" },
  { termos: ["geleia", "geleia de fruta", "geleia de frutas", "geleia de morango", "geleia de uva"], id: "x-geleia", medidas: { colher_sopa: 20, colher_cha: 7 }, porcao: 20, compra: "Geleia" },
  { termos: ["doce de leite"], id: "501", medidas: { colher_sopa: 20 }, porcao: 20, compra: "Doce de leite" },
  { termos: ["pacoca"], id: "579", medidas: { unidade: 20 }, porcao: 20, compra: "Paçoca" },

  // Bebidas e suplementos
  { termos: ["cafe", "cafe preto", "cafe sem acucar", "cafezinho", "cafe coado", "cafe puro"], id: "471", liquido: true, medidas: { xicara: 100, copo: 200 }, porcao: 50, compra: "Café em pó" },
  { termos: ["cha", "cha preto", "cha verde", "cha de camomila", "cha de hortela"], id: "477", liquido: true, medidas: { xicara: 200, copo: 200 }, porcao: 200, compra: "Chá" },
  { termos: ["cha mate", "mate"], id: "476", liquido: true, medidas: { xicara: 200, copo: 200 }, porcao: 200, compra: "Chá-mate" },
  { termos: ["refrigerante", "refrigerante de cola"], id: "480", liquido: true, medidas: { lata: 350, copo: 200 }, porcao: 350, compra: "Refrigerante" },
  { termos: ["cerveja"], id: "474", liquido: true, medidas: { lata: 350, copo: 200 }, porcao: 350, compra: "Cerveja" },
  { termos: ["leite de coco"], id: "523", liquido: true, medidas: { colher_sopa: 15, caixa: 200 }, porcao: 50, compra: "Leite de coco" },
  { termos: ["leite de soja", "bebida de soja", "extrato de soja"], id: "582", liquido: true, medidas: { copo: 200, xicara: 240, caixa: 1000 }, porcao: 200, compra: "Bebida de soja" },
  { termos: ["whey", "whey protein", "whey concentrado", "proteina", "proteina em po", "whey isolado"], id: "x-whey", medidas: { scoop: 30, colher_sopa: 10 }, porcao: 30, compra: "Whey protein" },
  { termos: ["albumina"], id: "x-albumina", medidas: { scoop: 30, colher_sopa: 10 }, porcao: 30, compra: "Albumina" },
]

type ConhecidoPronto = Conhecido & { regexes: [string, RegExp][] }
let conhecidos: ConhecidoPronto[] | null = null
function listaConhecidos(): ConhecidoPronto[] {
  conhecidos ??= CONHECIDOS_BRUTOS.map((k) => ({ ...k, regexes: k.termos.map((t) => [t, regexDoTermo(t)] as [string, RegExp]) }))
  return conhecidos
}

/** O alimento citado mais cedo na frase (e, empatando, o nome mais longo: "pasta de amendoim" antes de "amendoim"). */
function acharConhecido(frase: string): { k: ConhecidoPronto; pos: number } | null {
  let melhor: { k: ConhecidoPronto; pos: number; tam: number } | null = null
  for (const k of listaConhecidos()) {
    for (const [, re] of k.regexes) {
      const m = re.exec(frase)
      if (!m) continue
      const pos = m.index + (m[0].startsWith(" ") ? 1 : 0)
      const tam = m[0].trim().length
      // Tempero ou salada só valem como o assunto do item ("sal a gosto"), não no meio dele ("biscoito de sal")
      if (k.ignorar && k.ignorar !== "agua" && pos > 0) continue
      if (!melhor || pos < melhor.pos || (pos === melhor.pos && tam > melhor.tam)) melhor = { k, pos, tam }
    }
  }
  return melhor
}

/* ------------------------------------------------------------------ */
/* Busca na TACO (para o que não está na lista acima)                  */
/* ------------------------------------------------------------------ */

const PARADAS = new Set(
  "de da do das dos com sem em e a o as os para ao aos na no nas nos um uma ou por cima prato bem tipo picado picada picados picadas ralado ralada amassado amassada amassadas fatiado fatiada cortado cortada maduro madura maduras fresco fresca temperado temperada caseiro caseira pronto pronta inteiro inteira inteiros inteiras pequeno pequena pequenos pequenas medio media medios medias grande grandes cheio cheia cheias raso rasa rasas gosto vontade levemente quente gelado gelada morno morna mais cerca aprox aproximadamente".split(
    " ",
  ),
)

const ESTADO_PRATO = /^(cozid|grelhad|assad|refogad|frit)/
const ESTADO_RECEITA = /^(cru|crua|crus|cruas)$/

const singular = (w: string) => w.replace(/(oes|aes)$/, "ao").replace(/(is)$/, "l").replace(/(es|s)$/, "")
const mesmaPalavra = (a: string, b: string) => a === b || singular(a) === singular(b) || (a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a)))

let indice: { id: string; nome: string; cabeca: string[]; todos: string[] }[] | null = null
function indiceTaco() {
  indice ??= TACO.map(([id, nome]) => ({ id: String(id), nome, cabeca: palavras(nome.split(",")[0]).split(" "), todos: palavras(nome).split(" ") }))
  return indice
}

function buscarParecido(frase: string, contexto: Contexto, soPrimeira = false): string | undefined {
  const q = frase.split(" ").filter((t) => t.length >= 3 && !PARADAS.has(t) && !/^\d/.test(t))
  for (let h = 0; h < Math.min(soPrimeira ? 1 : 2, q.length); h++) {
    const cab = q[h]
    let melhor: { id: string; nome: string; pts: number } | null = null
    for (const e of indiceTaco()) {
      if (!e.cabeca.some((t) => mesmaPalavra(t, cab))) continue
      let pts = 0
      for (const t of q) if (t !== cab && e.todos.some((x) => x.startsWith(t) || mesmaPalavra(x, t))) pts++
      if (e.todos.some((x) => (contexto === "receita" ? ESTADO_RECEITA.test(x) : ESTADO_PRATO.test(x)))) pts += 0.5
      if (!melhor || pts > melhor.pts || (pts === melhor.pts && e.nome.length < melhor.nome.length)) melhor = { id: e.id, nome: e.nome, pts }
    }
    if (melhor) return melhor.id
  }
  return undefined
}

/** Busca por nome para a pessoa escolher o alimento (TACO e valores típicos). */
export function buscarAlimentos(busca: string, limite = 30): Alimento[] {
  const frase = palavras(busca)
  const q = frase.split(" ").filter((t) => t && !PARADAS.has(t))
  if (!q.length) return []
  const todos = [...tabela().values()]
  const achados: { a: Alimento; pts: number }[] = []
  // Nomes do dia a dia ("leite", "tilápia", "whey") primeiro, apontando para o alimento da tabela
  const sinonimos = new Set<string>()
  const curta = q.join(" ")
  for (const k of listaConhecidos()) {
    const termos = k.termos.map((t) => t.split(" ").filter((w) => !PARADAS.has(w)).join(" "))
    if (k.ignorar || !termos.some((t) => t.startsWith(curta) || (curta.length >= 4 && t.includes(curta)))) continue
    for (const id of [k.id, k.receita]) if (id && !sinonimos.has(id) && alimentoPorId(id)) sinonimos.add(id)
  }
  ;[...sinonimos].forEach((id, i) => achados.push({ a: alimentoPorId(id)!, pts: -100 + i }))
  for (const a of todos) {
    if (sinonimos.has(a.id)) continue
    const nome = palavras(a.nome).split(" ")
    if (!q.every((t) => nome.some((x) => x.startsWith(t) || mesmaPalavra(x, t)))) continue
    const primeira = palavras(a.nome.split(",")[0]).split(" ")
    const pts = (primeira.some((x) => x.startsWith(q[0])) ? 0 : 10) + a.nome.length / 100
    achados.push({ a, pts })
  }
  return achados
    .sort((x, y) => x.pts - y.pts)
    .slice(0, limite)
    .map((x) => x.a)
}

/* ------------------------------------------------------------------ */
/* Quantidades                                                         */
/* ------------------------------------------------------------------ */

const NUM = String.raw`\d+(?:[.,]\d+)?`
const EXPLICITA = new RegExp(String.raw`(${NUM})(?:\s*(?:a|-|–|ou)\s*(${NUM}))?\s*(kg|quilos?|kilos?|gramas?|grs?|g|mg|ml|litros?|lt|l)(?![a-z])`)
const EXPLICITA_NO_COMECO = new RegExp(String.raw`^\s*${EXPLICITA.source}\.?\s*(?:de |da |do |das |dos )?`)

const FRACOES: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 }
const PALAVRAS_NUM: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, meia: 0.5, meio: 0.5 }
const QTD = String.raw`(?:\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?(?:\s+\d\s*\/\s*\d|\s*[½¼¾⅓⅔])?|[½¼¾⅓⅔]|(?:uma?|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|meia|meio)(?![a-z]))`

const UNIDADES: [Medida, string][] = [
  ["colher_sopa", String.raw`colher(?:es)?(?: de)? sopa`],
  ["colher_sobremesa", String.raw`colher(?:es)?(?: de)? sobremesa`],
  ["colher_cha", String.raw`colher(?:es)?(?: de)? cha`],
  ["colher_cafe", String.raw`colher(?:es)?(?: de)? cafe`],
  ["colher_sopa", String.raw`colher(?:es)?`],
  ["xicara", String.raw`xicaras?(?: de cha)?`],
  ["copo", String.raw`copos?(?: americanos?| duplos?)?`],
  ["concha", String.raw`conchas?`],
  ["fatia", String.raw`fatias?|rodelas?`],
  ["file", String.raw`files?|bifes?|postas?`],
  ["unidade", String.raw`unidades?|un\.?`],
  ["scoop", String.raw`scoops?|dosador(?:es)?|medidas?`],
  ["lata", String.raw`latas?|latinhas?`],
  ["pote", String.raw`potes?|potinhos?`],
  ["dente", String.raw`dentes?`],
  ["pitada", String.raw`pitadas?`],
  ["punhado", String.raw`punhados?`],
  ["porcao", String.raw`porc(?:ao|oes)`],
  ["pedaco", String.raw`pedacos?`],
  ["folha", String.raw`folhas?`],
  ["caixa", String.raw`caixas?|caixinhas?`],
  ["fio", String.raw`fios?`],
  ["maco", String.raw`macos?`],
  ["prato", String.raw`pratos?(?: fundos?| rasos?| cheios?)?`],
]
const TAMANHO = String.raw`(?:bem cheias?|cheias?|rasas?|pequen[oa]s?|medi[oa]s?|grandes?)`
const CONTAGEM = new RegExp(
  String.raw`^\s*(${QTD})(?:\s*(?:a|-|–|ou)\s*(${QTD}))?\s*(?:(${UNIDADES.map(([, r]) => `(?:${r})`).join("|")})(?![a-z]))?(?:\s+${TAMANHO})?(\s+e\s+mei[oa])?\s*(?:de |da |do |das |dos )?`,
)

function lerQtd(t: string): number {
  const s = t.trim()
  if (PALAVRAS_NUM[s] !== undefined) return PALAVRAS_NUM[s]
  if (FRACOES[s] !== undefined) return FRACOES[s]
  const fr = s.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (fr) return Number(fr[1]) / Number(fr[2]) || 0
  const misto = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:(\d)\s*\/\s*(\d)|([½¼¾⅓⅔]))?$/)
  if (!misto) return 0
  let n = Number(misto[1].replace(",", "."))
  if (misto[2]) n += Number(misto[2]) / Number(misto[3])
  if (misto[4]) n += FRACOES[misto[4]]
  return n
}

const medidaDe = (u: string): Medida | null => {
  for (const [m, r] of UNIDADES) if (new RegExp(`^(?:${r})$`).test(u.trim())) return m
  return null
}

function fatorTamanho(t: string): number {
  if (/\bbem cheias?\b/.test(t)) return 1.5
  if (/\bcheias?\b/.test(t)) return 1.3
  if (/\brasas?\b/.test(t)) return 0.7
  if (/\bpequen[oa]s?\b/.test(t)) return 0.7
  if (/\bgrandes?\b/.test(t)) return 1.4
  return 1
}

type Explicita = { qtd: number; un: "g" | "ml" }
function lerExplicita(t: string): Explicita | null {
  const m = base(t).match(EXPLICITA)
  if (!m) return null
  const a = Number(m[1].replace(",", "."))
  const b = m[2] ? Number(m[2].replace(",", ".")) : a
  const n = (a + b) / 2
  const u = m[3]
  if (/^(kg|quilos?|kilos?)$/.test(u)) return { qtd: n * 1000, un: "g" }
  if (u === "mg") return { qtd: n / 1000, un: "g" }
  if (/^(l|lt|litros?)$/.test(u)) return { qtd: n * 1000, un: "ml" }
  if (u === "ml") return { qtd: n, un: "ml" }
  return { qtd: n, un: "g" }
}

/* ------------------------------------------------------------------ */
/* Estimativa de um item                                               */
/* ------------------------------------------------------------------ */

/** "prato": o plano e as anotações (pesos de comida pronta). "receita": ingredientes crus. */
export type Contexto = "prato" | "receita" | "anotacao"

export type Contagem = { n: number; medida: Medida }

export type Parte =
  | {
      tipo: "alimento"
      trecho: string
      alimento: Alimento
      qtd: number
      un: "g" | "ml"
      /** Gramas do alimento da tabela (já com densidade e equivalência). */
      gramas: number
      contagem?: Contagem
      /** A quantidade não estava escrita: usei uma porção típica. */
      porcaoTipica?: boolean
      /** Explica uma aproximação ("a TACO só tem o macarrão cru"). */
      nota?: string
      compra: { nome: string; fator: number }
      nutrientes: Nutrientes
    }
  | { tipo: "ignorado"; trecho: string; motivo: MotivoIgnorado }
  | { tipo: "valores"; trecho: string; nutrientes: Nutrientes }
  | { tipo: "desconhecido"; trecho: string; motivo: "alimento" | "quantidade"; alimento?: Alimento }

/** De cozido para cru, para a lista de compras (pela própria TACO: o cozimento muda a água, não a energia). */
const PARA_CRU: Record<string, number> = {
  "3": 0.4,
  "1": 0.4,
  "561": 0.4,
  "567": 0.4,
  "577": 0.4,
  "408": 1.35,
  "410": 1.35,
  "398": 1.35,
  "413": 1.35,
  "326": 1.5,
  "377": 1.5,
  "371": 1.4,
  "370": 1.5,
  "383": 1.5,
  "346": 1.5,
  "358": 1.5,
  "368": 1.3,
  "363": 1.5,
  "351": 1.5,
  "349": 1.5,
  "328": 1.5,
  "432": 1.4,
  "429": 1.4,
  "435": 1.4,
  "301": 1.3,
  "317": 1.3,
  "88": 1.1,
  "91": 1.1,
  "129": 1.2,
  "64": 1.1,
}

/** Nome curto para a lista de compras: "Abacaxi, cru" vira "Abacaxi". */
export function nomeCurto(a: Alimento): string {
  if (a.fonte === "tipico") return a.nome.replace(/\s*\(.*\)$/, "")
  const partes = a.nome.split(",").map((p) => p.trim())
  const uteis = partes.filter((p, i) => i === 0 || !/^(cru|crua|crus|cruas|cozid[oa]s?|grelhad[oa]s?|assad[oa]s?|refogad[oa]s?)$/i.test(p))
  return uteis.join(", ")
}

function nutrientesDe(a: Alimento, gramas: number): Nutrientes {
  return vezes(a.por100, gramas / 100)
}

/** Uma parte do item: "2 bananas médias", "100 g de feijão cozido". */
function estimarParte(trecho: string, contexto: Contexto): Parte {
  const explicita = lerExplicita(trecho)
  const semPar = base(semParenteses(trecho))
  let resto = semPar
  let contagem: { n: number; medida: Medida | null } | null = null
  const ex = semPar.match(EXPLICITA_NO_COMECO)
  if (ex) resto = semPar.slice(ex[0].length)
  else {
    const c = semPar.match(CONTAGEM)
    if (c && c[0].trim()) {
      const n1 = lerQtd(c[1])
      const n2 = c[2] ? lerQtd(c[2]) : n1
      const n = (n1 + n2) / 2 + (c[4] ? 0.5 : 0)
      if (n > 0) {
        contagem = { n, medida: c[3] ? medidaDe(c[3]) : null }
        resto = semPar.slice(c[0].length)
      }
    }
  }
  let frase = palavras(resto)
  // "1 xícara de chá" (a bebida): a medida comeu o nome
  if (!frase && contagem?.medida === "xicara" && /cha\s*$/.test(semPar)) frase = "cha"
  if (!frase) frase = palavras(semPar)

  const achado = acharConhecido(frase)
  let k = achado?.k ?? null
  // "Bolo de cenoura" é bolo, não cenoura: se a frase começa por um alimento da TACO, ele vale
  if (k && achado!.pos > 0 && buscarParecido(frase, contexto, true)) k = null
  if (k?.ignorar) return { tipo: "ignorado", trecho, motivo: k.ignorar }
  const id = k ? (contexto === "receita" ? (k.receita ?? k.id) : k.id) : buscarParecido(frase, contexto)
  const alimento = id ? alimentoPorId(id) : undefined
  if (!alimento) return { tipo: "desconhecido", trecho, motivo: "alimento" }

  // O macarrão do prato é pesado cozido, mas a TACO só tem o cru; na receita ele já é cru
  const equivale = !k || (contexto === "receita" && k.receita) ? 1 : (k.equivale ?? 1)
  const densidade = k?.densidade ?? 1
  const tamanho = fatorTamanho(semPar)
  let qtd: number
  let un: "g" | "ml"
  let porcaoTipica = false
  // "3 ovos", "2 fatias": a lista de compras mostra a contagem, mesmo que o peso esteja escrito
  const medidaContada = contagem ? (contagem.medida ?? "unidade") : null
  const cont: Contagem | undefined = contagem && medidaContada && CONTAVEIS.has(medidaContada) ? { n: contagem.n, medida: medidaContada } : undefined

  if (explicita) {
    qtd = explicita.qtd
    un = explicita.un
  } else if (contagem && medidaContada) {
    const peso = k?.medidas?.[medidaContada] ?? (medidaContada === "unidade" ? undefined : MEDIDA_PADRAO[medidaContada])
    if (!peso) return { tipo: "desconhecido", trecho, motivo: "quantidade", alimento }
    qtd = contagem.n * peso * tamanho
    un = k?.liquido && VOLUMETRICAS.has(medidaContada) ? "ml" : "g"
  } else if (k?.porcao) {
    qtd = k.porcao
    un = k.liquido ? "ml" : "g"
    porcaoTipica = true
  } else return { tipo: "desconhecido", trecho, motivo: "quantidade", alimento }

  const gramas = (un === "ml" ? qtd * densidade : qtd) * equivale
  return {
    tipo: "alimento",
    trecho,
    alimento,
    qtd,
    un,
    gramas,
    contagem: cont,
    porcaoTipica: porcaoTipica || undefined,
    nota: k?.nota && (k.equivale === undefined || equivale !== 1) ? k.nota : undefined,
    compra: { nome: k?.compra ?? nomeCurto(alimento), fator: (equivale !== 1 ? equivale : PARA_CRU[alimento.id]) ?? 1 },
    nutrientes: nutrientesDe(alimento, gramas),
  }
}

const OPCIONAL = /\bopcion/

/**
 * Um item do plano ou da receita, do jeito que está escrito. Fica com a primeira alternativa
 * ("250 g de arroz ou 300 g de batata" conta o arroz), ignora o que é opcional, água e
 * temperos, e separa combinações ("pão com ovo") quando o item não diz a quantidade de tudo.
 */
function estimarItem(texto: string, contexto: Contexto): Parte[] {
  let t = limparMarkdown(texto)
  if (!t) return []
  const rotulo = t.match(/^([^:\d()]{2,30}):\s*(.+)$/)
  if (rotulo) {
    if (palavras(rotulo[1]).startsWith("opcional")) return [{ tipo: "ignorado", trecho: t, motivo: "opcional" }]
    t = rotulo[2]
  }
  if (OPCIONAL.test(base(t))) return [{ tipo: "ignorado", trecho: t, motivo: "opcional" }]

  // Alternativas: "A ou B"; "A, B ou C" (a vírgula também separa, quando há um "ou")
  const temOu = dividirFora(t, /\s+ou\s+/giy).length > 1
  const alternativas = dividirFora(t, temOu ? /\s+ou\s+|(?<!\d),(?!\d)\s*/giy : /\s+ou\s+/giy)
  let partes: Parte[] = []
  for (const alt of alternativas.length ? alternativas : [t]) {
    partes = estimarAlternativa(alt, contexto)
    if (partes.some((p) => p.tipo !== "desconhecido" || p.motivo !== "alimento")) break
  }
  return partes
}

function estimarAlternativa(alt: string, contexto: Contexto): Parte[] {
  const componentes = dividirFora(alt, /\s+\+\s+|\s+com\s+|\s+e\s+(?!mei[oa]\b)|(?<!\d),(?!\d)\s*|;\s*/giy)
  if (componentes.length <= 1) return [estimarParte(alt, contexto)]
  const partes = componentes.map((c) => estimarParte(c, contexto))
  // "Feijão, carioca, cozido": pedaços sem alimento e sem quantidade eram só descrição
  const conhecidas = partes.filter((p) => p.tipo !== "desconhecido")
  if (!conhecidas.length) return [estimarParte(alt, contexto)]
  return partes.filter((p) => p.tipo !== "desconhecido" || p.motivo !== "alimento" || /\d/.test(p.trecho))
}

/* ------------------------------------------------------------------ */
/* Correções da pessoa (guardadas no item)                             */
/* ------------------------------------------------------------------ */

export type Porcao =
  | { tipo: "alimento"; id: string; qtd: number; un: "g" | "ml" }
  | { tipo: "valores"; kcal: number; p: number; c: number; g: number }
  | { tipo: "ignorar" }

/** A chave de um item no mapa de correções: o texto, sem diferença de maiúsculas, acentos e espaços. */
export const chaveDoItem = (texto: string) => palavras(limparMarkdown(texto))

export function lerPorcoes(v: unknown): Record<string, Porcao> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {}
  const saida: Record<string, Porcao> = {}
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (!x || typeof x !== "object") continue
    const p = x as Record<string, unknown>
    if (p.tipo === "ignorar") saida[k] = { tipo: "ignorar" }
    else if (p.tipo === "alimento" && typeof p.id === "string" && typeof p.qtd === "number" && p.qtd >= 0) saida[k] = { tipo: "alimento", id: p.id, qtd: p.qtd, un: p.un === "ml" ? "ml" : "g" }
    else if (p.tipo === "valores" && typeof p.kcal === "number")
      saida[k] = { tipo: "valores", kcal: p.kcal, p: typeof p.p === "number" ? p.p : 0, c: typeof p.c === "number" ? p.c : 0, g: typeof p.g === "number" ? p.g : 0 }
  }
  return saida
}

/** Densidade conhecida de um alimento escolhido pela pessoa (azeite, mel). */
function densidadeDe(id: string): number {
  for (const k of CONHECIDOS_BRUTOS) if (k.id === id && k.densidade) return k.densidade
  return 1
}

/** Como fica um item com a correção da pessoa (também serve de prévia no formulário). */
export function parteDaPorcao(texto: string, p: Porcao): Parte {
  if (p.tipo === "ignorar") return { tipo: "ignorado", trecho: texto, motivo: "voce" }
  if (p.tipo === "valores") return { tipo: "valores", trecho: texto, nutrientes: { kcal: p.kcal, p: p.p, c: p.c, g: p.g } }
  const alimento = alimentoPorId(p.id)
  if (!alimento) return { tipo: "desconhecido", trecho: texto, motivo: "alimento" }
  const gramas = p.un === "ml" ? p.qtd * densidadeDe(p.id) : p.qtd
  const nome = CONHECIDOS_BRUTOS.find((k) => (k.id === p.id || k.receita === p.id) && k.compra)?.compra ?? nomeCurto(alimento)
  return { tipo: "alimento", trecho: texto, alimento, qtd: p.qtd, un: p.un, gramas, compra: { nome, fator: PARA_CRU[alimento.id] ?? 1 }, nutrientes: nutrientesDe(alimento, gramas) }
}

/* ------------------------------------------------------------------ */
/* Calcular listas                                                     */
/* ------------------------------------------------------------------ */

export type ItemCalculado = {
  texto: string
  chave: string
  partes: Parte[]
  nutrientes: Nutrientes
  /** A pessoa corrigiu este item. */
  ajustado: boolean
  /** Alguma parte ficou sem cálculo (alimento ou quantidade desconhecidos). */
  semCalculo: boolean
}

export type Calculo = { itens: ItemCalculado[]; total: Nutrientes; semCalculo: number }

const cache = new Map<string, Parte[]>()

export function calcularItem(texto: string, contexto: Contexto, porcoes: Record<string, Porcao> = {}): ItemCalculado {
  const chave = chaveDoItem(texto)
  const salvo = porcoes[chave]
  let partes: Parte[]
  if (salvo) partes = [parteDaPorcao(limparMarkdown(texto), salvo)]
  else {
    const k = `${contexto}|${texto}`
    partes = cache.get(k) ?? estimarItem(texto, contexto)
    if (!cache.has(k)) {
      if (cache.size > 2000) cache.clear()
      cache.set(k, partes)
    }
  }
  const nutrientes = somar(...partes.map((p) => (p.tipo === "alimento" || p.tipo === "valores" ? p.nutrientes : NADA)))
  return { texto: limparMarkdown(texto), chave, partes, nutrientes, ajustado: Boolean(salvo), semCalculo: partes.some((p) => p.tipo === "desconhecido") }
}

export function calcularItens(itens: string[], contexto: Contexto, porcoes: Record<string, Porcao> = {}): Calculo {
  const calculados = itens.map((i) => calcularItem(i, contexto, porcoes)).filter((i) => i.partes.length)
  return { itens: calculados, total: somar(...calculados.map((i) => i.nutrientes)), semCalculo: calculados.filter((i) => i.semCalculo).length }
}

/** O que a pessoa anotou que comeu ("2 bananas, 1 iogurte"): cada linha ou ";" é um item. */
export function calcularAnotacao(nota: string): Calculo {
  return calcularItens(nota.split(/\n|;/).map((s) => s.trim()).filter(Boolean), "anotacao")
}

/* ------------------------------------------------------------------ */
/* Receitas                                                            */
/* ------------------------------------------------------------------ */

export type CalculoReceita = Calculo & {
  /** Quantas porções a receita rende (1 se ninguém disse). */
  rende: number
  rendeConhecido: boolean
  porPorcao: Nutrientes
}

/** Quantas porções: o que a pessoa escolheu no app, uma coluna "Porções" ou "Rende 4 porções" no texto. */
export function rendeDaReceita(props: Record<string, unknown>, conteudo: string | null | undefined): { n: number; conhecido: boolean } {
  const salvo = numeroFlexivel(props._rende)
  if (salvo && salvo > 0) return { n: salvo, conhecido: true }
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith("_") || !/^(porc|rende|rendimento|serve)/.test(normalizar(k))) continue
    const n = numeroFlexivel(v) ?? numeroFlexivel(String(v ?? "").match(/\d+/)?.[0])
    if (n && n > 0) return { n, conhecido: true }
  }
  const t = base(limparMarkdown(conteudo ?? ""))
  const m = t.match(/\b(?:rende|rendimento|serve|servem)\s*:?\s*(?:cerca de |aprox\w*\.? |ate )?(\d+)/)
  const n = m ? Number(m[1]) : Number(t.match(/\b(\d+)\s*(?:porcoes|pessoas)\b/)?.[1] ?? 0)
  return n > 0 && n <= 50 ? { n, conhecido: true } : { n: 1, conhecido: false }
}

export function calcularReceita(props: Record<string, unknown>, conteudo: string | null | undefined): CalculoReceita {
  const calc = calcularItens(ingredientesDaReceita(conteudo), "receita", lerPorcoes(props._porcoes))
  const { n, conhecido } = rendeDaReceita(props, conteudo)
  return { ...calc, rende: n, rendeConhecido: conhecido, porPorcao: vezes(calc.total, 1 / n) }
}

/* ------------------------------------------------------------------ */
/* Lista de compras                                                    */
/* ------------------------------------------------------------------ */

export type SecaoCompra = "hortifruti" | "carnes" | "laticinios" | "padaria" | "mercearia" | "outros"

export const SECOES_COMPRA: { id: SecaoCompra; nome: string }[] = [
  { id: "hortifruti", nome: "Hortifrúti" },
  { id: "carnes", nome: "Carnes, peixes e ovos" },
  { id: "laticinios", nome: "Laticínios e frios" },
  { id: "padaria", nome: "Padaria" },
  { id: "mercearia", nome: "Mercearia" },
  { id: "outros", nome: "Outros" },
]

function secaoDe(a: Alimento): SecaoCompra {
  if (/^(pao|torrada)/.test(normalizar(a.nome))) return "padaria"
  if ([439, 424, 443].includes(Number(a.id))) return "laticinios"
  switch (a.grupo) {
    case 1:
    case 2:
      return "hortifruti"
    case 4:
    case 5:
    case 8:
      return "carnes"
    case 6:
      return "laticinios"
    case 12:
    case -1:
      return "outros"
    default:
      return "mercearia"
  }
}

export type LinhaCompra = {
  chave: string
  nome: string
  secao: SecaoCompra
  /** Total em g ou ml (já convertido para cru quando o plano pesa cozido). */
  qtd: number
  un: "g" | "ml"
  /** Quando tudo veio contado (ovos, bananas, fatias). */
  contagem?: Contagem
  /** Convertido de cozido para cru. */
  cru: boolean
}

export type ItemAvulso = { texto: string; motivo: "salada" | "opcional" | "tempero" | "sem-calculo" | "valores" }

/**
 * Soma o plano para N dias: o mesmo alimento em refeições diferentes vira uma linha só, o
 * que o plano pesa cozido vira o peso cru, e o que se conta (ovos, bananas) fica contado.
 */
export function listaDeCompras(entradas: { itens: ItemCalculado[]; vezes: number }[]): { linhas: LinhaCompra[]; avulsos: ItemAvulso[] } {
  const mapa = new Map<string, LinhaCompra & { contagens: (Contagem | undefined)[] }>()
  const avulsos: ItemAvulso[] = []
  const vistos = new Set<string>()
  for (const { itens, vezes: n } of entradas) {
    for (const item of itens) {
      for (const p of item.partes) {
        if (p.tipo === "alimento") {
          const chave = normalizar(p.compra.nome)
          const fator = p.compra.fator
          const qtd = p.qtd * fator * n
          const atual = mapa.get(chave)
          const contagem = p.contagem && fator === 1 ? { n: p.contagem.n * n, medida: p.contagem.medida } : undefined
          if (!atual) mapa.set(chave, { chave, nome: p.compra.nome, secao: secaoDe(p.alimento), qtd, un: p.un, cru: fator !== 1, contagens: [contagem] })
          else {
            if (atual.un !== p.un) atual.un = "g"
            atual.qtd += qtd
            atual.cru ||= fator !== 1
            atual.contagens.push(contagem)
          }
          continue
        }
        if (p.tipo === "ignorado" && (p.motivo === "agua" || p.motivo === "sem-calorias" || p.motivo === "voce")) continue
        const motivo: ItemAvulso["motivo"] = p.tipo === "ignorado" ? (p.motivo as ItemAvulso["motivo"]) : p.tipo === "valores" ? "valores" : "sem-calculo"
        const k = normalizar(p.trecho)
        if (vistos.has(k)) continue
        vistos.add(k)
        avulsos.push({ texto: p.trecho, motivo })
      }
    }
  }
  const linhas = [...mapa.values()].map(({ contagens, ...l }) => {
    const medidas = new Set(contagens.map((c) => c?.medida))
    const contagem = contagens.every(Boolean) && medidas.size === 1 ? { n: contagens.reduce((t, c) => t + (c?.n ?? 0), 0), medida: contagens[0]!.medida } : undefined
    return { ...l, contagem }
  })
  const ordem = SECOES_COMPRA.map((s) => s.id)
  linhas.sort((a, b) => ordem.indexOf(a.secao) - ordem.indexOf(b.secao) || a.nome.localeCompare(b.nome, "pt-BR"))
  return { linhas, avulsos }
}

/** "280 g", "1,6 kg", "750 ml", "1,2 L"; arredonda para cima, que na compra falta é pior que sobra. */
export function quantidadeDeCompra(qtd: number, un: "g" | "ml"): string {
  if (qtd >= 1000) {
    const v = Math.ceil(qtd / 100) / 10
    return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${un === "g" ? "kg" : "L"}`
  }
  const v = qtd < 50 ? Math.ceil(qtd / 5) * 5 : Math.ceil(qtd / 10) * 10
  return `${v} ${un}`
}

const NOME_MEDIDA: Partial<Record<Medida, [string, string]>> = {
  unidade: ["unidade", "unidades"],
  fatia: ["fatia", "fatias"],
  file: ["filé", "filés"],
  lata: ["lata", "latas"],
  pote: ["pote", "potes"],
  caixa: ["caixa", "caixas"],
}

export function textoContagem(c: Contagem): string {
  const n = Math.ceil(c.n - 0.001)
  const [um, varios] = NOME_MEDIDA[c.medida] ?? ["unidade", "unidades"]
  return `${n} ${n === 1 ? um : varios}`
}

/* ------------------------------------------------------------------ */
/* Texto para mostrar                                                  */
/* ------------------------------------------------------------------ */

const fmt = (n: number, casas = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: casas })

/** "250 g", "300 ml", "1,5 kg". */
export function textoQuantidade(qtd: number, un: "g" | "ml"): string {
  if (qtd >= 1000) return `${fmt(qtd / 1000, 2)} ${un === "g" ? "kg" : "L"}`
  return `${fmt(qtd, qtd < 10 ? 1 : 0)} ${un}`
}

export const MOTIVOS: Record<MotivoIgnorado, string> = {
  opcional: "Opcional, não conta",
  agua: "Água, sem calorias",
  tempero: "Tempero, quase sem calorias",
  salada: "Salada e legumes à vontade: poucas calorias, não conta",
  "sem-calorias": "Sem calorias que contem",
  voce: "Você tirou da conta",
}
