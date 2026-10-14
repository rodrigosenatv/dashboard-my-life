"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { Calculator, ChevronRight, CookingPot, Plus } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Esqueleto, Secao, Vazio } from "@/components/ui/basicos"
import { Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { Markdown } from "@/components/markdown"
import { novoId, useCriar } from "@/lib/data"
import type { Json } from "@/lib/supabase/database.types"
import { useTelaAcesa } from "@/lib/tela-acesa"
import { cn, normalizar } from "@/lib/utils"
import { esquema, type Colecao, type ItemColecao } from "@/features/colecoes/visao-colecao"
import { lista, useItensDe, valores } from "@/features/treino/dados"
import { DetalheCalculo, gramas, gravarPorcao, kcal, useMudarProps } from "./calculo"
import { MODELO_RECEITA, capitalizar, ingredientesDaReceita, nomeDoIngrediente, receitaParaCozinhar } from "./dados"
import { calcularReceita, type CalculoReceita } from "./nutricao"

const TODAS = "__todas"

/** A propriedade que diz para qual refeição é a receita (no Notion: "Tags"). */
export function propriedadeRefeicao(c: Colecao | undefined): string {
  const props = esquema(c)
  const nomes = ["tags", "refeicao", "refeição", "categoria", "tipo"]
  return props.find((p) => ["select", "multi_select"].includes(p.type) && nomes.includes(normalizar(p.name)))?.name ?? props.find((p) => p.type === "multi_select")?.name ?? "Tags"
}

/** "janta\n" e "Janta" contam como a mesma refeição. */
const rotuloRefeicao = (t: string) => capitalizar(t.trim().toLocaleLowerCase("pt-BR"))

export type Receita = { item: ItemColecao; nome: string; refeicoes: string[]; ingredientes: string[]; calc: CalculoReceita }

function lerReceita(item: ItemColecao, prop: string): Receita {
  return {
    item,
    nome: item.title.trim() || "Receita sem nome",
    refeicoes: [...new Set(lista(valores(item)[prop]).map(rotuloRefeicao).filter(Boolean))],
    ingredientes: ingredientesDaReceita(item.content).map(nomeDoIngrediente),
    calc: calcularReceita(valores(item), item.content),
  }
}

/** As receitas da coleção, em ordem alfabética, já com as calorias. */
export function useReceitas(colecao: Colecao | undefined) {
  const { data: itens = [], isLoading } = useItensDe(colecao)
  const prop = propriedadeRefeicao(colecao)
  const receitas = React.useMemo(() => itens.map((i) => lerReceita(i, prop)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [itens, prop])
  return { receitas, itens, prop, isLoading }
}

/** "lanche" combina com "Lanche da tarde"; "café da manhã" com "Pós-treino / Café da manhã". */
export function combinaComRefeicao(r: Receita, refeicao: string): boolean {
  const alvo = normalizar(refeicao).replace(/[^a-z0-9]+/g, " ")
  return r.refeicoes.some((g) => {
    const t = normalizar(g).replace(/[^a-z0-9]+/g, " ").trim()
    return t.length >= 3 && (alvo.includes(t) || t.includes(alvo))
  })
}

/** "≈ 406 kcal por porção" ou "1.218 kcal a receita toda". */
export function valorDaReceita(r: Receita): string {
  if (!r.calc.itens.length || r.calc.total.kcal <= 0) return "Sem ingredientes para calcular"
  const n = r.calc.rendeConhecido ? r.calc.porPorcao : r.calc.total
  return `${kcal(n.kcal)} kcal · ${gramas(n.p)} g de proteína ${r.calc.rendeConhecido ? "por porção" : "a receita toda"}`
}

/** Receitas separadas por refeição, com os ingredientes à vista; abrir uma mostra o modo cozinha. */
export function ReceitasAlimentacao({ colecao }: { colecao: Colecao | undefined }) {
  const { receitas, itens, prop, isLoading } = useReceitas(colecao)
  const grupos = React.useMemo(() => {
    const conta = new Map<string, number>()
    for (const r of receitas) for (const g of r.refeicoes) conta.set(g, (conta.get(g) ?? 0) + 1)
    return [...conta].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
  }, [receitas])
  const [filtro, setFiltro] = React.useState(TODAS)
  const [abertaId, setAbertaId] = React.useState<string | null>(null)
  const [nova, setNova] = React.useState(false)
  // A receita aberta vem sempre da lista atual: corrigir o cálculo atualiza a janela na hora
  const aberta = receitas.find((r) => r.item.id === abertaId) ?? null

  if (!colecao) return null
  const visiveis = filtro === TODAS ? receitas : receitas.filter((r) => r.refeicoes.includes(filtro))

  return (
    <Secao
      titulo="Receitas"
      acao={
        <Botao variante="contorno" tamanho="sm" onClick={() => setNova(true)}>
          <Plus /> Nova receita
        </Botao>
      }
    >
      {isLoading ? (
        <Esqueleto className="h-40 rounded-xl" />
      ) : receitas.length === 0 ? (
        <Vazio titulo="Nenhuma receita ainda." descricao="Guarde as receitas que cabem no seu plano, com ingredientes e modo de preparo." />
      ) : (
        <>
          {grupos.length > 1 ? (
            <div role="group" aria-label="Filtrar receitas por refeição" className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
              {[[TODAS, receitas.length] as [string, number], ...grupos].map(([g, n]) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={filtro === g}
                  onClick={() => setFiltro(g)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors toque:min-h-10",
                    filtro === g ? "border-pen bg-pen/15 font-medium text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
                  )}
                >
                  {g === TODAS ? "Todas" : g} <span className="tabular text-xs text-ink-3">{n}</span>
                </button>
              ))}
            </div>
          ) : null}
          <ul className="grid gap-2 sm:grid-cols-2">
            {visiveis.map((r) => (
              <li key={r.item.id}>
                <button
                  type="button"
                  onClick={() => setAbertaId(r.item.id)}
                  className="flex h-full w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong toque:min-h-16"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-snug">{r.nome}</span>
                    <span className="mt-0.5 line-clamp-1 text-xs text-ink-3">
                      {[filtro === TODAS ? r.refeicoes.join(", ") : "", r.ingredientes.slice(0, 4).join(" · ")].filter(Boolean).join(" — ")}
                    </span>
                  </span>
                  {r.calc.total.kcal > 0 ? (
                    <span className="shrink-0 text-right text-xs text-ink-3 tabular">
                      <span className="block text-sm font-medium text-ink-2">{kcal((r.calc.rendeConhecido ? r.calc.porPorcao : r.calc.total).kcal)} kcal</span>
                      {r.calc.rendeConhecido ? "porção" : "receita"}
                    </span>
                  ) : null}
                  <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <ModoCozinha receita={aberta} aoFechar={() => setAbertaId(null)} />
      <NovaReceita aberta={nova} aoMudar={setNova} colecao={colecao} prop={prop} refeicoes={grupos.map(([g]) => g)} sugestao={filtro === TODAS ? "" : filtro} posicao={Math.max(0, ...itens.map((i) => i.position)) + 1} />
    </Secao>
  )
}

/** A receita aberta para cozinhar: ingredientes para ir marcando e a tela acesa. */
function ModoCozinha({ receita, aoFechar }: { receita: Receita | null; aoFechar: () => void }) {
  const [texto, setTexto] = React.useState("")
  const [calculo, setCalculo] = React.useState(false)
  const id = receita?.item.id
  const conteudo = receita?.item.content
  React.useEffect(() => {
    if (id) setTexto(receitaParaCozinhar(conteudo ?? ""))
  }, [id, conteudo])
  useTelaAcesa(Boolean(receita))
  const mudarProps = useMudarProps()

  return (
    <Janela
      aberta={Boolean(receita)}
      aoMudar={(v) => !v && aoFechar()}
      titulo={receita?.nome ?? "Receita"}
      descricao={receita?.refeicoes.length ? `${receita.refeicoes.join(", ")} · a tela fica acesa enquanto a receita estiver aberta` : "A tela fica acesa enquanto a receita estiver aberta"}
      largura="lg"
      rodape={
        <>
          {receita ? (
            <Botao asChild variante="fantasma" className="mr-auto">
              <Link href={`/colecoes/item/${receita.item.id}?editar=1`}>Editar receita</Link>
            </Botao>
          ) : null}
          <Botao variante="primario" onClick={aoFechar}>
            Fechar
          </Botao>
        </>
      }
    >
      {receita && receita.calc.itens.length ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
          <p>
            <span className="font-semibold tabular">{kcal((receita.calc.rendeConhecido ? receita.calc.porPorcao : receita.calc.total).kcal)} kcal</span> ·{" "}
            {gramas((receita.calc.rendeConhecido ? receita.calc.porPorcao : receita.calc.total).p)} g de proteína{" "}
            <span className="text-ink-2">{receita.calc.rendeConhecido ? `por porção (rende ${receita.calc.rende})` : "a receita toda"}</span>
          </p>
          <Botao variante="fantasma" tamanho="sm" className="-my-1 -mr-2" onClick={() => setCalculo(true)}>
            <Calculator /> Ver cálculo
          </Botao>
        </div>
      ) : null}
      {texto.trim() ? (
        <Markdown texto={texto} aoMudar={setTexto} className="text-[15px]" />
      ) : (
        <div className="grid justify-items-start gap-2 text-sm text-ink-2">
          <CookingPot className="size-5 text-ink-3" />
          <p>Esta receita ainda não tem ingredientes nem modo de preparo.</p>
        </div>
      )}
      {receita ? (
        <DetalheCalculo
          aberta={calculo}
          aoMudar={setCalculo}
          titulo={`Cálculo: ${receita.nome}`}
          descricao="Cada ingrediente virou um alimento da TACO. Toque num ingrediente para corrigir."
          secoes={[
            {
              id: receita.item.id,
              calculo: receita.calc,
              rende: { n: receita.calc.rende, conhecido: receita.calc.rendeConhecido, aoMudar: (n) => mudarProps(receita.item, (p) => void (p._rende = n)) },
              aoAjustar: (chave, porcao) => mudarProps(receita.item, (p) => gravarPorcao(p, chave, porcao)),
            },
          ]}
        />
      ) : null}
    </Janela>
  )
}

function NovaReceita({
  aberta,
  aoMudar,
  colecao,
  prop,
  refeicoes,
  sugestao,
  posicao,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  colecao: Colecao
  prop: string
  refeicoes: string[]
  sugestao: string
  posicao: number
}) {
  const router = useRouter()
  const criar = useCriar("collection_items")
  const [nome, setNome] = React.useState("")
  const [refeicao, setRefeicao] = React.useState("")
  const [outra, setOutra] = React.useState("")
  const opcoes = [...new Set([...refeicoes, "Café da manhã", "Almoço", "Lanche", "Jantar"])]
  React.useEffect(() => {
    if (!aberta) return
    setNome("")
    setRefeicao(sugestao)
    setOutra("")
  }, [aberta, sugestao])

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return
    const escolhida = refeicao === "__outra" ? outra.trim() : refeicao
    const id = novoId()
    // Mantém o jeito que as etiquetas já estão escritas (o Notion usava minúsculas)
    const existente = escolhida ? refeicoes.find((r) => normalizar(r) === normalizar(escolhida)) : undefined
    const props: Record<string, Json> = escolhida ? { [prop]: [(existente ?? escolhida).toLocaleLowerCase("pt-BR")] } : {}
    try {
      await criar.mutateAsync({ id, collection_id: colecao.id, title: nome.trim(), props, content: MODELO_RECEITA, position: posicao })
    } catch {
      return
    }
    aoMudar(false)
    router.push(`/colecoes/item/${id}?editar=1`)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo="Nova receita"
      descricao="Depois você escreve os ingredientes e o modo de preparo."
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form="form-receita" disabled={!nome.trim() || criar.isPending}>
            Criar e escrever
          </Botao>
        </>
      }
    >
      <form id="form-receita" onSubmit={salvar} className="grid gap-4">
        <Campo rotulo="Nome" htmlFor="rec-nome">
          <Entrada id="rec-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Omelete de forno" />
        </Campo>
        <Campo rotulo="Refeição" htmlFor="rec-refeicao">
          <Seletor id="rec-refeicao" value={refeicao} onChange={(e) => setRefeicao(e.target.value)}>
            <option value="">Nenhuma</option>
            {opcoes.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
            <option value="__outra">Outra…</option>
          </Seletor>
        </Campo>
        {refeicao === "__outra" ? (
          <Campo rotulo="Qual?" htmlFor="rec-outra">
            <Entrada id="rec-outra" value={outra} onChange={(e) => setOutra(e.target.value)} placeholder="Ex.: Pré-treino" />
          </Campo>
        ) : null}
      </form>
    </Janela>
  )
}
