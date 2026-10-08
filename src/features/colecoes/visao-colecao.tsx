"use client"

import Link from "next/link"
import * as React from "react"
import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Check, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Etiqueta, Segmentos } from "@/components/ui/basicos"
import { useUrlArquivo } from "@/components/markdown"
import { novoId, useAtualizar, useCriar, useLista } from "@/lib/data"
import type { Json, Tables } from "@/lib/supabase/database.types"
import { cn, contem, formatar, isoDia, normalizar, numero, urlValida } from "@/lib/utils"

export type Colecao = Tables<"collections">
export type ItemColecao = Tables<"collection_items">
export type Propriedade = { name: string; type: string; options?: string[] }
export type VisaoColecao = "galeria" | "tabela" | "calendario" | "quadro"

const OCULTAS = ["title", "relation", "rollup", "formula", "created_time", "last_edited_time", "button"]

export function esquema(c: Colecao | null | undefined): Propriedade[] {
  return Array.isArray(c?.schema) ? (c!.schema as unknown as Propriedade[]) : []
}

export function valorTexto(v: Json | undefined): string {
  if (v === null || v === undefined) return ""
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ")
  if (typeof v === "boolean") return v ? "Sim" : "Não"
  return String(v)
}

const ehDinheiro = (nome: string) => /or[cç]amento|valor|pre[cç]o|custo|gasto|r\$/i.test(nome)
const somavel = (nome: string) => !/temporada|epis[oó]dio|ano|nota|ordem|n[ºo°]|idade|altura|s[ée]ries|repeti/i.test(nome)
const dinheiro = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const vazio = (v: Json | undefined) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)

export function Valor({ prop, valor }: { prop: Propriedade; valor: Json | undefined }) {
  if (vazio(valor)) return <span className="text-ink-3">–</span>
  if (prop.type === "checkbox") return <span>{valor ? "Sim" : "Não"}</span>
  if (prop.type === "date" && typeof valor === "string") return <span className="whitespace-nowrap">{formatar(valor, "d MMM yyyy") || valor}</span>
  if (Array.isArray(valor))
    return (
      <span className="flex flex-wrap gap-1">
        {valor.map((x) => (
          <Etiqueta key={String(x)}>{String(x)}</Etiqueta>
        ))}
      </span>
    )
  if (prop.type === "select") return <Etiqueta>{String(valor)}</Etiqueta>
  if (prop.type === "number" && typeof valor === "number")
    return <span className="tabular">{ehDinheiro(prop.name) ? dinheiro(valor) : numero(valor, Number.isInteger(valor) ? 0 : 2)}</span>
  if (prop.type === "url") {
    const u = urlValida(String(valor))
    return u ? (
      <a href={u} target="_blank" rel="noreferrer" className="text-pen hover:underline" onClick={(e) => e.stopPropagation()}>
        {u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
      </a>
    ) : (
      <span>{String(valor)}</span>
    )
  }
  if (typeof valor === "string" && valor.startsWith("arquivo://")) return <span className="text-ink-2">arquivo</span>
  return <span className="line-clamp-2">{valorTexto(valor)}</span>
}

export function Capa({ caminho, className }: { caminho: string; className?: string }) {
  const { data } = useUrlArquivo(caminho)
  return data ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={data} alt="" className={cn("aspect-[4/3] w-full object-cover", className)} />
  ) : (
    <div className={cn("aspect-[4/3] animate-pulse bg-surface-2", className)} />
  )
}

/** Valores possíveis de uma propriedade de seleção, na ordem do esquema ou de aparição. */
export function opcoesDe(prop: Propriedade | undefined, itens: ItemColecao[]): string[] {
  if (!prop) return []
  const vistos = new Set<string>(prop.options ?? [])
  for (const i of itens) {
    const v = ((i.props ?? {}) as Record<string, Json>)[prop.name]
    if (Array.isArray(v)) v.forEach((x) => vistos.add(String(x)))
    else if (!vazio(v) && typeof v !== "boolean") vistos.add(String(v))
  }
  return [...vistos]
}

/** Propriedade usada como abas quando nada é informado: Status, Tipo… ou a primeira seleção curta. */
export function abasPadrao(props: Propriedade[], itens: ItemColecao[]): string | undefined {
  const selecoes = props.filter((p) => p.type === "select")
  const pref = ["status", "filme/serie", "tipo", "situacao", "categoria"]
  for (const nome of pref) {
    const p = selecoes.find((x) => normalizar(x.name) === nome)
    if (p && opcoesDe(p, itens).length <= 7) return p.name
  }
  return selecoes.find((p) => {
    const n = opcoesDe(p, itens).length
    return n >= 2 && n <= 6
  })?.name
}

function useItens(colecaoId: string) {
  return useLista("collection_items", {
    filtro: (q) => q.eq("collection_id", colecaoId),
    ordem: [{ coluna: "position" }, { coluna: "title" }],
    chave: ["de", colecaoId],
  })
}

function Calendario({ itens, prop }: { itens: ItemColecao[]; prop: string }) {
  const comData = itens.filter((i) => typeof (i.props as Record<string, Json>)?.[prop] === "string")
  const [mes, setMes] = React.useState(() => {
    const hoje = isoDia()
    const futuras = comData.map((i) => String((i.props as Record<string, Json>)[prop]).slice(0, 10)).sort()
    const alvo = futuras.find((d) => d >= hoje.slice(0, 7)) ?? futuras.at(-1)
    return startOfMonth(alvo ? new Date(`${alvo.slice(0, 10)}T12:00`) : new Date())
  })
  const hoje = isoDia()
  const dias: Date[] = []
  for (let d = startOfWeek(startOfMonth(mes)); d <= endOfWeek(endOfMonth(mes)); d = addDays(d, 1)) dias.push(d)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-medium first-letter:uppercase">{format(mes, "MMMM 'de' yyyy", { locale: ptBR })}</p>
        <div className="flex gap-1">
          <Botao variante="fantasma" tamanho="icone-sm" aria-label="Mês anterior" onClick={() => setMes((m) => addMonths(m, -1))}>
            <ChevronLeft />
          </Botao>
          <Botao variante="fantasma" tamanho="icone-sm" aria-label="Próximo mês" onClick={() => setMes((m) => addMonths(m, 1))}>
            <ChevronRight />
          </Botao>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => (
          <div key={d} className="bg-surface-2 py-1.5 text-center text-xs font-medium text-ink-3">
            {d}
          </div>
        ))}
        {dias.map((d) => {
          const iso = isoDia(d)
          const doDia = comData.filter((i) => String((i.props as Record<string, Json>)[prop]).slice(0, 10) === iso)
          return (
            <div key={iso} className={cn("min-h-16 bg-surface p-1 sm:min-h-24", d.getMonth() !== mes.getMonth() && "opacity-45")}>
              <span className={cn("tabular inline-grid size-6 place-items-center rounded-full text-xs", iso === hoje && "bg-pen text-pen-ink")}>{d.getDate()}</span>
              <div className="grid gap-0.5">
                {doDia.map((i) => (
                  <Link key={i.id} href={`/colecoes/item/${i.id}`} className="truncate rounded bg-surface-2 px-1 text-[11px] leading-5 hover:bg-surface-3">
                    {i.title || "Sem título"}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Uma coleção como no Notion: abas por uma propriedade de seleção, galeria,
 * tabela, quadro e calendário, caixa de seleção clicável e criação rápida.
 */
export function BlocoColecao({
  colecao,
  titulo,
  abas,
  visaoInicial,
  marcar,
  limite,
  className,
}: {
  colecao: Colecao
  titulo?: string
  /** Nome da propriedade de seleção que vira abas. `false` desliga. */
  abas?: string | false
  visaoInicial?: VisaoColecao
  /** Caixa de seleção que aparece clicável nos cartões e na tabela (ex.: Assistido). */
  marcar?: string
  /** Mostra só os N primeiros, com "ver todos". */
  limite?: number
  className?: string
}) {
  const { data: itens = [], isLoading } = useItens(colecao.id)
  const criar = useCriar("collection_items")
  const atualizar = useAtualizar("collection_items")
  const props = esquema(colecao).filter((p) => !OCULTAS.includes(p.type))
  const propData = props.find((p) => p.type === "date")?.name
  const propAbas = abas === false ? undefined : (abas && props.some((p) => p.name === abas) ? abas : abasPadrao(props, itens))
  const opcoesAbas = opcoesDe(props.find((p) => p.name === propAbas), itens)
  const temCapa = itens.some((i) => i.cover_path)
  const propMarcar = marcar && props.some((p) => p.name === marcar) ? marcar : undefined
  const selecaoQuadro = props.find((p) => p.type === "select" && p.name !== propAbas)?.name ?? propAbas

  const [aba, setAba] = React.useState("")
  const [visao, setVisao] = React.useState<VisaoColecao | null>(visaoInicial ?? null)
  const [busca, setBusca] = React.useState("")
  const [novo, setNovo] = React.useState("")
  const [todos, setTodos] = React.useState(false)
  const visaoAtual: VisaoColecao = visao ?? (temCapa ? "galeria" : "tabela")

  const valores = (i: ItemColecao) => (i.props ?? {}) as Record<string, Json>
  const daAba = (i: ItemColecao) => {
    if (!propAbas || !aba) return true
    const v = valores(i)[propAbas]
    return Array.isArray(v) ? v.map(String).includes(aba) : String(v ?? "") === aba
  }
  const filtrados = itens.filter((i) => daAba(i) && (!busca || contem(`${i.title} ${JSON.stringify(i.props)}`, busca)))
  const visiveis = limite && !todos ? filtrados.slice(0, limite) : filtrados
  const colunas = props.filter((p) => p.name !== propMarcar).slice(0, 5)

  const alternarMarca = (i: ItemColecao) => {
    if (!propMarcar) return
    atualizar.mutate({ id: i.id, props: { ...valores(i), [propMarcar]: !valores(i)[propMarcar] } })
  }

  const adicionar = (e: React.FormEvent) => {
    e.preventDefault()
    const t = novo.trim()
    if (!t) return
    criar.mutate({ id: novoId(), collection_id: colecao.id, title: t, position: Date.now(), props: propAbas && aba ? { [propAbas]: aba } : {} })
    setNovo("")
  }

  const opcoesVisao = [
    { valor: "galeria" as const, rotulo: "Galeria" },
    { valor: "tabela" as const, rotulo: "Tabela" },
    ...(selecaoQuadro ? [{ valor: "quadro" as const, rotulo: "Quadro" }] : []),
    ...(propData ? [{ valor: "calendario" as const, rotulo: "Calendário" }] : []),
  ]

  const Marca = ({ i }: { i: ItemColecao }) =>
    propMarcar ? (
      <button
        type="button"
        role="checkbox"
        aria-checked={Boolean(valores(i)[propMarcar])}
        aria-label={`${propMarcar}: ${i.title}`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          alternarMarca(i)
        }}
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded border transition-colors",
          valores(i)[propMarcar] ? "border-pen bg-pen text-pen-ink" : "border-line-strong bg-surface hover:border-pen",
        )}
      >
        {valores(i)[propMarcar] ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </button>
    ) : null

  return (
    <section className={cn("min-w-0", className)} aria-label={titulo ?? colecao.name}>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="mr-auto font-display text-lg font-semibold">
          <Link href={`/colecoes/${colecao.id}`} className="hover:underline">
            {titulo ?? colecao.name}
          </Link>{" "}
          <span className="tabular text-sm font-normal text-ink-3">{filtrados.length}</span>
        </h2>
        {itens.length > 8 ? (
          <div className="relative w-40">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar"
              aria-label={`Filtrar ${colecao.name}`}
              className="h-8 w-full rounded-md border border-line-strong bg-surface pl-7 pr-2 text-sm placeholder:text-ink-3 focus-visible:border-pen focus-visible:outline-none"
            />
          </div>
        ) : null}
        {opcoesVisao.length > 1 ? <Segmentos rotulo={`Visualização de ${colecao.name}`} valor={visaoAtual} aoMudar={setVisao} opcoes={opcoesVisao} /> : null}
      </div>

      {propAbas && opcoesAbas.length > 1 ? (
        <div role="tablist" aria-label={propAbas} className="mb-3 flex flex-wrap gap-1.5">
          {["", ...opcoesAbas].map((o) => {
            const n = o ? itens.filter((i) => { const v = valores(i)[propAbas]; return Array.isArray(v) ? v.map(String).includes(o) : String(v ?? "") === o }).length : itens.length
            return (
              <button
                key={o || "todos"}
                type="button"
                role="tab"
                aria-selected={aba === o}
                onClick={() => setAba(o)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  aba === o ? "border-pen bg-pen/15 font-medium text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
                )}
              >
                {o || "Todos"} <span className="tabular text-xs text-ink-3">{n}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-lg bg-surface-2" />
      ) : visaoAtual === "calendario" && propData ? (
        <Calendario itens={filtrados} prop={propData} />
      ) : filtrados.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-5 text-center text-sm text-ink-2">{busca ? "Nada com esse texto." : "Nada aqui ainda."}</p>
      ) : visaoAtual === "galeria" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visiveis.map((i) => {
            const vals = valores(i)
            return (
              <li key={i.id}>
                <Link href={`/colecoes/item/${i.id}`} className="block h-full overflow-hidden rounded-lg border border-line bg-surface hover:border-line-strong">
                  {i.cover_path ? <Capa caminho={i.cover_path} /> : null}
                  <div className="p-3">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 font-medium leading-snug">{i.title || "Sem título"}</p>
                      <Marca i={i} />
                    </div>
                    <div className="mt-1.5 grid gap-1 text-xs text-ink-2">
                      {colunas
                        .filter((p) => p.name !== propAbas && !vazio(vals[p.name]))
                        .slice(0, 3)
                        .map((p) =>
                          p.type === "number" ? (
                            <span key={p.name}>
                              <span className="text-ink-3">{p.name}: </span>
                              <Valor prop={p} valor={vals[p.name]} />
                            </span>
                          ) : (
                            <Valor key={p.name} prop={p} valor={vals[p.name]} />
                          ),
                        )}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : visaoAtual === "quadro" && selecaoQuadro ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 scrollbar-thin sm:mx-0 sm:px-0">
          {[...opcoesDe(props.find((p) => p.name === selecaoQuadro), filtrados), ""].map((o) => {
            const daColuna = filtrados.filter((i) => String(valores(i)[selecaoQuadro] ?? "") === o)
            if (!o && !daColuna.length) return null
            return (
              <div key={o || "sem"} className="w-60 shrink-0 rounded-xl bg-surface-2/60 p-2">
                <p className="mb-2 px-1 text-sm font-medium">
                  {o || `Sem ${selecaoQuadro.toLowerCase()}`} <span className="tabular font-normal text-ink-3">{daColuna.length}</span>
                </p>
                <ul className="grid gap-2">
                  {daColuna.map((i) => (
                    <li key={i.id}>
                      <Link href={`/colecoes/item/${i.id}`} className="flex items-start gap-2 rounded-lg border border-line bg-surface p-2.5 text-sm hover:border-line-strong">
                        <span className="min-w-0 flex-1">{i.title || "Sem título"}</span>
                        <Marca i={i} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                {propMarcar ? <th className="w-10 px-3 py-2 font-medium"><span className="sr-only">{propMarcar}</span></th> : null}
                <th className="px-4 py-2 font-medium">Nome</th>
                {colunas.map((p) => (
                  <th key={p.name} className={cn("whitespace-nowrap px-3 py-2 font-medium", p.type === "number" && "text-right")}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((i) => {
                const vals = valores(i)
                return (
                  <tr key={i.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                    {propMarcar ? (
                      <td className="px-3 py-2">
                        <Marca i={i} />
                      </td>
                    ) : null}
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/colecoes/item/${i.id}`} className="hover:underline">
                        {i.title || "Sem título"}
                      </Link>
                    </td>
                    {colunas.map((p) => (
                      <td key={p.name} className={cn("max-w-60 px-3 py-2.5 text-ink-2", p.type === "number" && "text-right")}>
                        <Valor prop={p} valor={vals[p.name]} />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
            {colunas.some((p) => p.type === "number" && somavel(p.name)) && filtrados.length > 1 ? (
              <tfoot>
                <tr className="border-t border-line text-xs text-ink-3">
                  {propMarcar ? <td /> : null}
                  <td className="px-4 py-2">Soma</td>
                  {colunas.map((p) => (
                    <td key={p.name} className="tabular px-3 py-2 text-right">
                      {p.type === "number" && somavel(p.name)
                        ? (() => {
                            const total = filtrados.reduce((s, i) => s + (Number(valores(i)[p.name]) || 0), 0)
                            return ehDinheiro(p.name) ? dinheiro(total) : numero(total, 2)
                          })()
                        : null}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}

      {limite && filtrados.length > limite && !todos ? (
        <button type="button" onClick={() => setTodos(true)} className="mt-2 text-sm font-medium text-pen hover:underline">
          Ver todos os {filtrados.length}
        </button>
      ) : null}

      <form onSubmit={adicionar} className="mt-2 flex items-center gap-1.5">
        <Plus className="size-4 shrink-0 text-ink-3" aria-hidden />
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder={propAbas && aba ? `Novo em ${aba}` : "Novo item"}
          aria-label={`Novo item em ${colecao.name}`}
          className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-sm placeholder:text-ink-3 hover:bg-surface-2 focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pen"
        />
      </form>
    </section>
  )
}
