"use client"

import Link from "next/link"
import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowDown, ArrowUp, ChevronRight, Lightbulb, Plus, Target } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Esqueleto, Secao, Vazio } from "@/components/ui/basicos"
import { AreaTexto, Campo, Entrada } from "@/components/ui/campos"
import { Confirmar, Janela } from "@/components/ui/janela"
import { novoId, useAtualizar, useCriar, useExcluir, useRegistro } from "@/lib/data"
import { normalizar, numero, plural } from "@/lib/utils"
import type { Colecao } from "@/features/colecoes/visao-colecao"
import { useArvorePaginas } from "@/features/paginas/dados"
import {
  itensDoTexto,
  itensParaTexto,
  lerNumeroDigitadoBr,
  lerPlanoDoTexto,
  litros,
  montarPlano,
  propsDaRefeicao,
  type ConfigAlimentacao,
  type Refeicao,
} from "./dados"

/* ------------------------------------------------------------------ */
/* Montar o plano (primeira vez)                                       */
/* ------------------------------------------------------------------ */

/** A página com o plano escrito em texto ("Plano alimentar diário"), se existir. */
function usePaginaDoPlano() {
  const { data: paginas = [] } = useArvorePaginas()
  const pagina = React.useMemo(
    () => paginas.find((p) => normalizar(p.title) === "plano alimentar diario") ?? paginas.find((p) => normalizar(p.title).startsWith("plano alimentar")),
    [paginas],
  )
  const { data: completa, isLoading } = useRegistro("pages", pagina?.id)
  return { pagina: completa ?? null, carregando: Boolean(pagina) && isLoading }
}

export function MontarPlano({
  colecao,
  config,
  aoSalvarConfig,
  aoComecarDoZero,
}: {
  colecao: Colecao | undefined
  config: ConfigAlimentacao
  aoSalvarConfig: (c: Partial<ConfigAlimentacao>) => void
  aoComecarDoZero: () => void
}) {
  const qc = useQueryClient()
  const { pagina, carregando } = usePaginaDoPlano()
  const [montando, setMontando] = React.useState(false)
  const lido = React.useMemo(() => (pagina?.content ? lerPlanoDoTexto(pagina.content) : null), [pagina])
  const temTexto = Boolean(lido?.refeicoes.length)

  const montar = async () => {
    if (!lido || !pagina) return
    setMontando(true)
    try {
      await montarPlano(qc, lido.refeicoes, colecao)
      aoSalvarConfig({
        metas: lido.metas,
        aguaMeta: lido.agua?.meta ?? config.aguaMeta,
        marcos: lido.agua?.marcos.length ? lido.agua.marcos : config.marcos,
        dicas: pagina.id,
      })
      toast.success("Plano montado", { description: `${plural(lido.refeicoes.length, "refeição", "refeições")} do “${pagina.title}”` })
    } catch (e) {
      toast.error("Não foi possível montar o plano.", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setMontando(false)
    }
  }

  const comecar = async () => {
    if (!colecao) {
      setMontando(true)
      try {
        await montarPlano(qc, [])
      } catch (e) {
        toast.error("Não foi possível criar o plano.", { description: e instanceof Error ? e.message : undefined })
        return
      } finally {
        setMontando(false)
      }
    }
    aoComecarDoZero()
  }

  if (carregando) return <Esqueleto className="h-48 rounded-xl" />
  return (
    <Secao titulo="Hoje">
      <Vazio
        titulo={temTexto ? "Transforme o seu plano em refeições para marcar" : "Monte o seu plano alimentar"}
        descricao={
          temTexto
            ? `Encontrei ${plural(lido!.refeicoes.length, "refeição", "refeições")} no “${pagina!.title}”: ${lido!.refeicoes.map((r) => r.nome).join(", ")}. Elas viram a sua lista do dia, e você pode ajustar depois.`
            : "Cadastre as refeições do dia (com o que comer em cada uma) para marcar o que já fez."
        }
        acao={
          <div className="flex flex-wrap gap-2">
            {temTexto ? (
              <Botao variante="primario" disabled={montando} onClick={montar}>
                {montando ? "Montando…" : "Montar o plano"}
              </Botao>
            ) : null}
            <Botao variante={temTexto ? "fantasma" : "primario"} disabled={montando} onClick={comecar}>
              <Plus /> Começar do zero
            </Botao>
          </div>
        }
      />
    </Secao>
  )
}

/* ------------------------------------------------------------------ */
/* Resumo: metas, editar, dicas                                        */
/* ------------------------------------------------------------------ */

export function ResumoPlano({
  refeicoes,
  config,
  aoEditar,
  aoMetas,
}: {
  refeicoes: Refeicao[]
  config: ConfigAlimentacao
  aoEditar: () => void
  aoMetas: () => void
}) {
  const metas = [
    ["Calorias", config.metas.kcal, "kcal"],
    ["Proteína", config.metas.proteina, "g"],
    ["Carboidrato", config.metas.carboidrato, "g"],
    ["Gordura", config.metas.gordura, "g"],
  ] as const
  const temMetas = metas.some(([, v]) => v)
  return (
    <Secao
      titulo="Plano"
      acao={
        <Botao variante="fantasma" tamanho="sm" onClick={aoEditar}>
          Editar refeições
        </Botao>
      }
    >
      <div className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <p className="text-sm text-ink-2">
          {plural(refeicoes.length, "refeição", "refeições")} por dia
          {refeicoes.length ? `, de ${refeicoes[0].nome.toLowerCase()} a ${refeicoes.at(-1)!.nome.toLowerCase()}` : ""}.
        </p>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Metas do dia</h3>
            <button type="button" onClick={aoMetas} className="text-sm text-ink-2 hover:text-ink">
              Ajustar
            </button>
          </div>
          {temMetas ? (
            <dl className="grid grid-cols-2 gap-2">
              {metas.map(([rotulo, valor, unidade]) =>
                valor ? (
                  <div key={rotulo} className="rounded-lg bg-surface-2 px-3 py-2">
                    <dt className="text-xs text-ink-3">{rotulo}</dt>
                    <dd className="font-semibold">
                      {numero(valor)} <span className="text-sm font-normal text-ink-2">{unidade}</span>
                    </dd>
                  </div>
                ) : null,
              )}
            </dl>
          ) : (
            <button type="button" onClick={aoMetas} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-left text-sm text-ink-2 hover:border-pen hover:text-ink">
              <Target className="size-4 shrink-0" /> Definir calorias e proteína do dia
            </button>
          )}
          <p className="mt-2 text-sm text-ink-2">
            Água: {litros(config.aguaMeta)} por dia
            {config.marcos.length ? ` (${config.marcos.map((m) => `${litros(m.ml)} até ${m.hora}h`).join(", ")})` : ""}.
          </p>
        </div>
        {config.dicas ? (
          <Link href={`/paginas/${config.dicas}`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm hover:border-line-strong">
            <Lightbulb className="size-4 shrink-0 text-ink-3" />
            <span className="flex-1">Dicas do plano: marmita, shake portátil, água</span>
            <ChevronRight className="size-4 text-ink-3" />
          </Link>
        ) : null}
      </div>
    </Secao>
  )
}

/* ------------------------------------------------------------------ */
/* Metas                                                               */
/* ------------------------------------------------------------------ */

export function DialogoMetas({ aberta, aoMudar, config, aoSalvar }: { aberta: boolean; aoMudar: (v: boolean) => void; config: ConfigAlimentacao; aoSalvar: (c: Partial<ConfigAlimentacao>) => void }) {
  const [valores, setValores] = React.useState({ kcal: "", proteina: "", carboidrato: "", gordura: "", agua: "" })
  React.useEffect(() => {
    if (!aberta) return
    const t = (n?: number) => (n ? String(n).replace(".", ",") : "")
    setValores({ kcal: t(config.metas.kcal), proteina: t(config.metas.proteina), carboidrato: t(config.metas.carboidrato), gordura: t(config.metas.gordura), agua: t(config.aguaMeta / 1000) })
  }, [aberta, config])

  const campos = [
    ["kcal", "Calorias (kcal)", "Ex.: 2700"],
    ["proteina", "Proteína (g)", "Ex.: 155"],
    ["carboidrato", "Carboidrato (g)", "Ex.: 360"],
    ["gordura", "Gordura (g)", "Ex.: 70"],
  ] as const
  const lidos = Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v.trim() ? lerNumeroDigitadoBr(v) : undefined])) as Record<keyof typeof valores, number | null | undefined>
  const invalido = Object.values(lidos).some((v) => v === null || (typeof v === "number" && v < 0)) || !lidos.agua

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (invalido) return
    aoSalvar({
      metas: { kcal: lidos.kcal ?? undefined, proteina: lidos.proteina ?? undefined, carboidrato: lidos.carboidrato ?? undefined, gordura: lidos.gordura ?? undefined },
      aguaMeta: Math.round((lidos.agua ?? 3) * 1000),
    })
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo="Metas do dia"
      descricao="Valores de referência do seu plano. Deixe em branco o que não quiser acompanhar."
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form="form-metas" disabled={invalido}>
            Salvar
          </Botao>
        </>
      }
    >
      <form id="form-metas" onSubmit={salvar} className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          {campos.map(([chave, rotulo, exemplo]) => (
            <Campo key={chave} rotulo={rotulo} htmlFor={`meta-${chave}`}>
              <Entrada id={`meta-${chave}`} inputMode="decimal" autoComplete="off" value={valores[chave]} placeholder={exemplo} onChange={(e) => setValores((v) => ({ ...v, [chave]: e.target.value }))} />
            </Campo>
          ))}
        </div>
        <Campo rotulo="Água por dia (litros)" htmlFor="meta-agua" dica={config.marcos.length ? `Marcos do plano: ${config.marcos.map((m) => `${litros(m.ml)} até ${m.hora}h`).join(", ")}.` : undefined}>
          <Entrada id="meta-agua" inputMode="decimal" autoComplete="off" value={valores.agua} placeholder="Ex.: 3,5" onChange={(e) => setValores((v) => ({ ...v, agua: e.target.value }))} className="max-w-32" />
        </Campo>
        {invalido ? <p className="text-sm text-danger">Use só números, como 2700 ou 3,5. A água é obrigatória.</p> : null}
      </form>
    </Janela>
  )
}

/* ------------------------------------------------------------------ */
/* Editar as refeições                                                 */
/* ------------------------------------------------------------------ */

/** Lista das refeições (ordem do dia) e, ao tocar numa, o formulário dela, na mesma janela. */
export function EditorPlano({
  aberto,
  inicial,
  aoFechar,
  colecao,
  refeicoes,
}: {
  aberto: boolean
  /** "lista", "nova" ou o id da refeição para abrir direto no formulário. */
  inicial: string
  aoFechar: () => void
  colecao: Colecao | undefined
  refeicoes: Refeicao[]
}) {
  // A janela monta de novo a cada abertura (a página troca a key), então começa no modo pedido
  const [modo, setModo] = React.useState(inicial)
  const [veioDaLista, setVeioDaLista] = React.useState(false)
  const atualizar = useAtualizar("collection_items")

  const mover = (i: number, d: -1 | 1) => {
    const ordem = [...refeicoes]
    const [r] = ordem.splice(i, 1)
    ordem.splice(i + d, 0, r)
    ordem.forEach((x, j) => {
      if (x.item.position !== j + 1) atualizar.mutate({ id: x.item.id, position: j + 1 })
    })
  }

  if (modo !== "lista")
    return (
      <FormRefeicao
        key={modo}
        aberto={aberto}
        aoFechar={aoFechar}
        aoVoltar={veioDaLista ? () => setModo("lista") : undefined}
        colecao={colecao}
        refeicao={modo === "nova" ? null : (refeicoes.find((r) => r.item.id === modo) ?? null)}
        proximaPosicao={Math.max(0, ...refeicoes.map((r) => r.item.position)) + 1}
      />
    )

  return (
    <Janela
      aberta={aberto}
      aoMudar={(v) => !v && aoFechar()}
      titulo="Refeições do plano"
      descricao="Na ordem do dia. Toque numa refeição para editar."
      rodape={
        <>
          <Botao
            variante="secundario"
            className="mr-auto"
            onClick={() => {
              setVeioDaLista(true)
              setModo("nova")
            }}
          >
            <Plus /> Adicionar refeição
          </Botao>
          <Botao variante="primario" onClick={aoFechar}>
            Pronto
          </Botao>
        </>
      }
    >
      {refeicoes.length ? (
        <ol className="-mx-1 grid gap-1">
          {refeicoes.map((r, i) => (
            <li key={r.item.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setVeioDaLista(true)
                  setModo(r.item.id)
                }}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-2 toque:min-h-12"
              >
                <span className="w-5 shrink-0 text-right text-sm text-ink-3 tabular">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.nome}</span>
                  <span className="block truncate text-xs text-ink-3">{[r.quando, plural(r.itens.length, "item", "itens")].filter(Boolean).join(" · ")}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
              </button>
              <Botao variante="fantasma" tamanho="icone-sm" aria-label={`Subir ${r.nome}`} disabled={i === 0} onClick={() => mover(i, -1)}>
                <ArrowUp />
              </Botao>
              <Botao variante="fantasma" tamanho="icone-sm" aria-label={`Descer ${r.nome}`} disabled={i === refeicoes.length - 1} onClick={() => mover(i, 1)}>
                <ArrowDown />
              </Botao>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-ink-2">Nenhuma refeição ainda. Adicione a primeira.</p>
      )}
    </Janela>
  )
}

function FormRefeicao({
  aberto,
  aoFechar,
  aoVoltar,
  colecao,
  refeicao,
  proximaPosicao,
}: {
  aberto: boolean
  aoFechar: () => void
  aoVoltar?: () => void
  colecao: Colecao | undefined
  refeicao: Refeicao | null
  proximaPosicao: number
}) {
  const criar = useCriar("collection_items")
  const atualizar = useAtualizar("collection_items")
  const excluir = useExcluir("collection_items")
  // O formulário monta de novo a cada refeição aberta, então começa com os valores dela
  const [nome, setNome] = React.useState(refeicao?.nome ?? "")
  const [quando, setQuando] = React.useState(refeicao?.quando ?? "")
  const [objetivo, setObjetivo] = React.useState(refeicao?.objetivo ?? "")
  const [nota, setNota] = React.useState(refeicao?.nota ?? "")
  const [itens, setItens] = React.useState((refeicao?.itens ?? []).join("\n"))
  const [apagar, setApagar] = React.useState(false)

  const voltar = aoVoltar ?? aoFechar

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !colecao) return
    const lista = itens
      .split("\n")
      .map((l) => l.replace(/^\s*(?:[-*•+]|\d+[.)])\s+/, "").trim())
      .filter(Boolean)
    const props = { ...((refeicao?.item.props ?? {}) as Record<string, unknown>) }
    for (const k of ["Quando", "Objetivo", "Nota"]) delete props[k]
    const novos = { ...props, ...propsDaRefeicao({ quando, objetivo, nota }) }
    // O texto do item guarda a lista; se havia outras anotações além da lista, elas ficam
    const extra = (refeicao?.item.content ?? "")
      .split("\n")
      .filter((l) => l.trim() && !/^\s*(?:[-*•+]|\d+[.)])\s+/.test(l))
      .join("\n")
    const conteudo = [itensParaTexto(lista), extra].filter(Boolean).join("\n\n") || null
    if (refeicao) atualizar.mutate({ id: refeicao.item.id, title: nome.trim(), props: novos as never, content: conteudo })
    else criar.mutate({ id: novoId(), collection_id: colecao.id, title: nome.trim(), position: proximaPosicao, props: novos as never, content: conteudo })
    voltar()
  }

  const contagem = itensDoTexto(
    itens
      .split("\n")
      .map((l) => (l.trim() ? `- ${l}` : ""))
      .join("\n"),
  ).length

  return (
    <>
      <Janela
        aberta={aberto}
        aoMudar={(v) => !v && aoFechar()}
        titulo={refeicao ? "Editar refeição" : "Nova refeição"}
        rodape={
          <>
            {refeicao ? (
              <Botao variante="fantasma" className="mr-auto text-danger hover:text-danger" onClick={() => setApagar(true)}>
                Excluir
              </Botao>
            ) : null}
            <Botao variante="fantasma" onClick={voltar}>
              {aoVoltar ? "Voltar" : "Cancelar"}
            </Botao>
            <Botao variante="primario" type="submit" form="form-refeicao" disabled={!nome.trim() || !colecao}>
              {refeicao ? "Salvar" : "Adicionar"}
            </Botao>
          </>
        }
      >
        <form id="form-refeicao" onSubmit={salvar} className="grid gap-4">
          <Campo rotulo="Nome" htmlFor="ref-nome">
            <Entrada id="ref-nome" autoFocus={!refeicao} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Almoço" />
          </Campo>
          <Campo rotulo="Quando" htmlFor="ref-quando" dica="Horário ou momento do dia.">
            <Entrada id="ref-quando" value={quando} onChange={(e) => setQuando(e.target.value)} placeholder="Ex.: 12:00, ao acordar, depois do treino" />
          </Campo>
          <Campo rotulo="Objetivo" htmlFor="ref-objetivo">
            <Entrada id="ref-objetivo" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Opcional" />
          </Campo>
          <Campo rotulo="O que comer" htmlFor="ref-itens" dica={`Um item por linha${contagem ? ` · ${plural(contagem, "item", "itens")}` : ""}.`}>
            <AreaTexto id="ref-itens" value={itens} onChange={(e) => setItens(e.target.value)} rows={6} placeholder={"250 g de arroz\n100 g de feijão\n150 g de frango"} />
          </Campo>
          <Campo rotulo="Observação" htmlFor="ref-nota">
            <Entrada id="ref-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: levar na garrafa térmica" />
          </Campo>
        </form>
      </Janela>
      <Confirmar
        aberta={apagar}
        aoMudar={setApagar}
        titulo={`Excluir “${refeicao?.nome ?? ""}”?`}
        descricao="A refeição sai do plano. As marcações de dias anteriores continuam no diário."
        aoConfirmar={() => {
          if (refeicao) excluir.mutate(refeicao.item.id)
          voltar()
        }}
      />
    </>
  )
}
