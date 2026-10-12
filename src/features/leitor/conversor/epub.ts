// Monta o arquivo EPUB 3 (um zip com XHTML, sumário e lista de páginas) a partir dos blocos.
import { strToU8, zipSync, type Zippable } from "fflate"
import type { Bloco, ImagemExtraida, Inline, Marca } from "./tipos"
import { ehMarca } from "./tipos"
import { escaparXml } from "./texto"
import { textoDoBloco } from "./blocos"

export const ESTILO_LIVRO = `@namespace epub "http://www.idpf.org/2007/ops";
body { margin: 0; }
p { margin: 0 0 0.75em; }
h1, h2, h3 { font-weight: 700; line-height: 1.25; margin: 1.4em 0 0.7em; text-indent: 0; text-align: left; hyphens: none; -webkit-hyphens: none; break-after: avoid; }
h1 { font-size: 1.45em; }
h2 { font-size: 1.2em; }
h3 { font-size: 1.05em; }
h1.parte { text-align: center; margin: 3em 0 2em; }
p.centro { text-align: center; text-indent: 0; }
p.destaque { text-align: left; hyphens: manual; -webkit-hyphens: manual; }
p.item { padding-left: 1.3em; text-indent: -1.3em; }
p.nota { font-size: 0.85em; }
p.recuo { margin-left: 1.5em; margin-right: 1.5em; }
figure.figura { margin: 1em 0; text-align: center; break-inside: avoid; }
figure.figura img { max-width: 100%; height: auto; }
div.tabela { margin: 1em 0; overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 0.88em; line-height: 1.35; }
td { border: 1px solid currentColor; padding: 0.3em 0.45em; vertical-align: top; text-align: left; text-indent: 0; hyphens: auto; -webkit-hyphens: auto; }
div.capa { text-align: center; }
div.capa img { max-width: 100%; height: auto; }
`

const XHTML_INICIO = (titulo: string, idioma: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${idioma}" xml:lang="${idioma}">
<head>
<meta charset="UTF-8"/>
<title>${escaparXml(titulo)}</title>
<link rel="stylesheet" type="text/css" href="estilo.css"/>
</head>
<body>
`

const marcaXhtml = (m: Marca) => `<span epub:type="pagebreak" role="doc-pagebreak" id="pag-${m.pagina}" aria-label="${m.pagina}" title="${m.pagina}"></span>`

function inlinesXhtml(inlines: Inline[], semNegrito = false): string {
  let s = ""
  for (const i of inlines) {
    if (ehMarca(i)) {
      s += marcaXhtml(i)
      continue
    }
    // Espaços nas pontas ficam fora das marcações de estilo
    const [, antes, miolo, depois] = /^(\s*)([\s\S]*?)(\s*)$/.exec(i.texto) ?? ["", "", i.texto, ""]
    let t = escaparXml(miolo)
    if (t) {
      if (i.sobrescrito) t = `<sup>${t}</sup>`
      if (i.italico) t = `<em>${t}</em>`
      if (i.negrito && !semNegrito) t = `<strong>${t}</strong>`
    }
    s += (antes ? " " : "") + t + (depois ? " " : "")
  }
  return s.replace(/ {2,}/g, " ")
}

type Secao = { arquivo: string; blocos: Bloco[] }
type EntradaSumario = { titulo: string; nivel: number; href: string; parte?: boolean }

function tamanhoDoBloco(b: Bloco): number {
  if (b.tipo === "tabela") return b.linhas.flat().join(" ").length
  if (b.tipo === "imagem") return 400
  return textoDoBloco(b).length
}

/** Divide o livro em arquivos: um por capítulo, e capítulos grandes em partes. */
function dividir(blocos: Bloco[]): Bloco[][] {
  const total = blocos.reduce((n, b) => n + tamanhoDoBloco(b), 0)
  const titulos = (n: number) => blocos.filter((b) => b.tipo === "titulo" && b.nivel === n).length
  // Com partes (nível 1), cada capítulo (nível 2) também começa um arquivo
  const temPartes = blocos.some((b) => b.tipo === "titulo" && b.parte)
  const corte = total < 40_000 ? 0 : temPartes && titulos(2) >= 2 ? 2 : titulos(1) >= 2 ? 1 : titulos(2) >= 2 ? 2 : 0
  const grupos: Bloco[][] = [[]]
  for (const b of blocos) {
    const g = grupos.at(-1)!
    if (corte && b.tipo === "titulo" && b.nivel <= corte && g.some((x) => x.tipo !== "marcas")) grupos.push([b])
    else g.push(b)
  }
  // Partes de no máximo ~60 mil letras, para o leitor paginar rápido no celular
  const LIMITE = 60_000
  const final: Bloco[][] = []
  for (const g of grupos) {
    let parte: Bloco[] = []
    let n = 0
    for (const b of g) {
      const t = tamanhoDoBloco(b)
      if (n + t > LIMITE && parte.length) {
        final.push(parte)
        parte = []
        n = 0
      }
      parte.push(b)
      n += t
    }
    if (parte.length) final.push(parte)
  }
  return final.filter((g) => g.length)
}

function blocoXhtml(b: Bloco, idTitulo: (b: Bloco) => string, imagens: Map<string, ImagemExtraida>): string {
  switch (b.tipo) {
    case "titulo":
      return `<h${b.nivel} id="${idTitulo(b)}"${b.parte ? ` class="parte"` : ""}>${inlinesXhtml(b.inlines, true)}</h${b.nivel}>\n`
    case "paragrafo": {
      // Parágrafo curto todo em negrito (subtítulo sem numeração, termo em destaque): sem justificar
      const destaque = b.negrito && b.linhas <= 3 && !b.item
      const classes = [b.centralizado && "centro", b.item && "item", b.nota && "nota", b.recuado && "recuo", destaque && "destaque"].filter(Boolean).join(" ")
      return `<p${classes ? ` class="${classes}"` : ""}>${inlinesXhtml(b.inlines)}</p>\n`
    }
    case "imagem": {
      const img = imagens.get(b.id)
      const marcas = b.marcas.map(marcaXhtml).join("")
      if (!img) return marcas ? `<div>${marcas}</div>\n` : ""
      const ext = img.tipo === "image/png" ? "png" : "jpg"
      return `<figure class="figura">${marcas}<img src="imagens/${b.id}.${ext}" alt="Figura da página ${b.pagina}" width="${img.largura}" height="${img.altura}"/></figure>\n`
    }
    case "tabela": {
      const marcas = b.marcas.map(marcaXhtml).join("")
      const colunas = Math.max(...b.linhas.map((l) => l.length))
      const linhas = b.linhas.map((l) => `<tr>${Array.from({ length: colunas }, (_, i) => `<td>${escaparXml(l[i] ?? "")}</td>`).join("")}</tr>`).join("\n")
      return `<div class="tabela">${marcas}<table><tbody>\n${linhas}\n</tbody></table></div>\n`
    }
    case "marcas":
      return `<div>${b.marcas.map(marcaXhtml).join("")}</div>\n`
  }
}

type No = { entrada: EntradaSumario; filhos: No[] }

/** Lista aninhada pelo nível dos títulos (um nível pulado vira filho direto). */
function sumarioXhtml(entradas: EntradaSumario[]): string {
  const raiz: No[] = []
  const pilha: No[] = []
  for (const entrada of entradas) {
    const no: No = { entrada, filhos: [] }
    while (pilha.length && pilha[pilha.length - 1].entrada.nivel >= entrada.nivel) pilha.pop()
    if (pilha.length) pilha[pilha.length - 1].filhos.push(no)
    else raiz.push(no)
    pilha.push(no)
  }
  const lista = (nos: No[]): string =>
    `<ol>\n${nos.map((n) => `<li><a href="${n.entrada.href}">${escaparXml(n.entrada.titulo)}</a>${n.filhos.length ? `\n${lista(n.filhos)}` : ""}</li>\n`).join("")}</ol>\n`
  return lista(raiz)
}

export type DadosEpub = {
  blocos: Bloco[]
  titulo: string
  autor: string
  idioma: string
  identificador: string
  imagens: Map<string, ImagemExtraida>
  capa: ImagemExtraida | null
  /** Nome do arquivo de origem, guardado nos metadados. */
  origem?: string
}

export function gerarEpub(d: DadosEpub): { epub: Uint8Array; capitulos: number; sumario: { titulo: string; nivel: number; parte?: boolean }[] } {
  const grupos = dividir(d.blocos)
  const secoes: Secao[] = grupos.map((blocos, i) => ({ arquivo: `parte-${String(i + 1).padStart(3, "0")}.xhtml`, blocos }))

  const ids = new Map<Bloco, string>()
  const idTitulo = (b: Bloco) => {
    let id = ids.get(b)
    if (!id) ids.set(b, (id = `titulo-${ids.size + 1}`))
    return id
  }
  const entradas: EntradaSumario[] = []
  const paginas: { pagina: number; href: string }[] = []
  for (const s of secoes) {
    for (const b of s.blocos) {
      if (b.tipo === "titulo")
        entradas.push({ titulo: textoDoBloco(b).replace(/\s+/g, " ").trim(), nivel: b.nivel, href: `${s.arquivo}#${idTitulo(b)}`, parte: b.parte })
      const marcas: Marca[] = b.tipo === "paragrafo" || b.tipo === "titulo" ? b.inlines.filter(ehMarca) : b.marcas
      for (const m of marcas) paginas.push({ pagina: m.pagina, href: `${s.arquivo}#pag-${m.pagina}` })
    }
  }
  if (!entradas.length) secoes.forEach((s, i) => entradas.push({ titulo: secoes.length > 1 ? `Parte ${i + 1}` : d.titulo, nivel: 1, href: s.arquivo }))

  const arquivos: Zippable = {}
  arquivos["mimetype"] = [strToU8("application/epub+zip"), { level: 0 }]
  arquivos["META-INF/container.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`)
  arquivos["OEBPS/estilo.css"] = strToU8(ESTILO_LIVRO)

  const manifesto: string[] = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="estilo" href="estilo.css" media-type="text/css"/>`,
  ]
  const espinha: string[] = []

  if (d.capa) {
    const ext = d.capa.tipo === "image/png" ? "png" : "jpg"
    arquivos[`OEBPS/imagens/capa.${ext}`] = [d.capa.dados, { level: 0 }]
    manifesto.push(`<item id="capa-imagem" href="imagens/capa.${ext}" media-type="${d.capa.tipo}" properties="cover-image"/>`)
    arquivos["OEBPS/capa.xhtml"] = strToU8(
      `${XHTML_INICIO(d.titulo, d.idioma)}<div class="capa"><img src="imagens/capa.${ext}" alt="Capa" width="${d.capa.largura}" height="${d.capa.altura}"/></div>\n</body>\n</html>\n`,
    )
    manifesto.push(`<item id="capa" href="capa.xhtml" media-type="application/xhtml+xml"/>`)
    espinha.push(`<itemref idref="capa"/>`)
  }

  for (const [id, img] of d.imagens) {
    const ext = img.tipo === "image/png" ? "png" : "jpg"
    arquivos[`OEBPS/imagens/${id}.${ext}`] = [img.dados, { level: 0 }]
    manifesto.push(`<item id="img-${id}" href="imagens/${id}.${ext}" media-type="${img.tipo}"/>`)
  }

  secoes.forEach((s, i) => {
    const corpo = s.blocos.map((b) => blocoXhtml(b, idTitulo, d.imagens)).join("")
    arquivos[`OEBPS/${s.arquivo}`] = strToU8(`${XHTML_INICIO(d.titulo, d.idioma)}<section>\n${corpo}</section>\n</body>\n</html>\n`)
    manifesto.push(`<item id="parte-${i + 1}" href="${s.arquivo}" media-type="application/xhtml+xml"/>`)
    espinha.push(`<itemref idref="parte-${i + 1}"/>`)
  })

  const listaPaginas = paginas.map((p) => `<li><a href="${p.href}">${p.pagina}</a></li>`).join("\n")
  arquivos["OEBPS/nav.xhtml"] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${d.idioma}" xml:lang="${d.idioma}">
<head><meta charset="UTF-8"/><title>Sumário</title></head>
<body>
<nav epub:type="toc" id="sumario"><h1>Sumário</h1>
${sumarioXhtml(entradas)}</nav>
<nav epub:type="page-list" id="paginas" hidden=""><h1>Páginas</h1><ol>
${listaPaginas}
</ol></nav>
<nav epub:type="landmarks" id="marcos" hidden=""><ol><li><a epub:type="bodymatter" href="${secoes[0]?.arquivo ?? "nav.xhtml"}">Início</a></li></ol></nav>
</body>
</html>
`)

  const agora = new Date().toISOString().replace(/\.\d+Z$/, "Z")
  arquivos["OEBPS/content.opf"] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="${d.idioma}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">${escaparXml(d.identificador)}</dc:identifier>
<dc:title>${escaparXml(d.titulo)}</dc:title>
${d.autor ? `<dc:creator>${escaparXml(d.autor)}</dc:creator>\n` : ""}<dc:language>${d.idioma}</dc:language>
${d.origem ? `<dc:source>${escaparXml(d.origem)}</dc:source>\n` : ""}<meta property="dcterms:modified">${agora}</meta>
${d.capa ? `<meta name="cover" content="capa-imagem"/>\n` : ""}</metadata>
<manifest>
${manifesto.join("\n")}
</manifest>
<spine>
${espinha.join("\n")}
</spine>
</package>
`)

  return { epub: zipSync(arquivos), capitulos: secoes.length, sumario: entradas.map((e) => ({ titulo: e.titulo, nivel: e.nivel, ...(e.parte ? { parte: true } : {}) })) }
}
