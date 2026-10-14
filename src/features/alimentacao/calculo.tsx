"use client"

import * as React from "react"
import { CircleAlert, Minus, Plus, Search } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Segmentos } from "@/components/ui/basicos"
import { Entrada } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { useAtualizar } from "@/lib/data"
import type { Json } from "@/lib/supabase/database.types"
import { cn, numero } from "@/lib/utils"
import type { ItemColecao } from "@/features/colecoes/visao-colecao"
import { valores } from "@/features/treino/dados"
import { lerNumeroDigitadoBr } from "./texto"
import {
  MOTIVOS,
  buscarAlimentos,
  ehBebida,
  lerPorcoes,
  parteDaPorcao,
  somar,
  textoQuantidade,
  vezes,
  type Alimento,
  type Calculo,
  type ItemCalculado,
  type Nutrientes,
  type Parte,
  type Porcao,
} from "./nutricao"

/* ------------------------------------------------------------------ */
/* Números                                                             */
/* ------------------------------------------------------------------ */

export const kcal = (n: number) => numero(Math.round(n))
export const gramas = (n: number) => numero(Math.round(n))

/** "554 kcal · 34 g de proteína" (e carboidrato e gordura, se pedir). */
export function textoNutrientes(n: Nutrientes, completo = false): string {
  const curto = `${kcal(n.kcal)} kcal · ${gramas(n.p)} g de proteína`
  return completo ? `${curto} · ${gramas(n.c)} g de carboidrato · ${gramas(n.g)} g de gordura` : curto
}

/**
 * Barra do dia: o que já comeu (cheio), o que o resto do plano soma (claro) e a meta (traço).
 */
export function Medidor({ rotulo, unidade, consumido, previsto, meta }: { rotulo: string; unidade: string; consumido: number; previsto: number; meta?: number }) {
  const escala = Math.max(meta ?? 0, previsto, consumido, 1) * 1.04
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / escala) * 100))}%`
  const meio = meta ? ` de ${numero(Math.round(meta))}` : ""
  return (
    <div className="min-w-0">
      <p className="text-xs text-ink-3">{rotulo}</p>
      <p className="mt-0.5 truncate text-sm text-ink-2">
        <span className="text-lg font-semibold text-ink tabular">{numero(Math.round(consumido))}</span>
        {meio} {unidade}
      </p>
      <div
        role="img"
        aria-label={`${rotulo}: ${numero(Math.round(consumido))}${meio} ${unidade}. Previsto no dia: ${numero(Math.round(previsto))} ${unidade}.`}
        className="relative mt-1.5 h-2 rounded-full bg-surface-3"
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-pen/25 transition-[width] duration-300" style={{ width: pct(previsto) }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-pen transition-[width] duration-300" style={{ width: pct(consumido) }} />
        {meta ? <div className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-ink-2" style={{ left: pct(meta) }} /> : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Gravar correções no item                                            */
/* ------------------------------------------------------------------ */

/** Muda as propriedades de um item (refeição do plano ou receita) sem perder as outras. */
export function useMudarProps() {
  const { mutate } = useAtualizar("collection_items")
  return React.useCallback(
    (item: ItemColecao, mudar: (props: Record<string, Json>) => void) => {
      const props = { ...valores(item) }
      mudar(props)
      mutate({ id: item.id, props: props as never })
    },
    [mutate],
  )
}

/** Guarda (ou tira, com null) a correção de um item da lista nas propriedades. */
export function gravarPorcao(props: Record<string, Json>, chave: string, porcao: Porcao | null) {
  const atuais = lerPorcoes(props._porcoes) as unknown as Record<string, Json>
  if (porcao) atuais[chave] = porcao as unknown as Json
  else delete atuais[chave]
  if (Object.keys(atuais).length) props._porcoes = atuais
  else delete props._porcoes
}

/* ------------------------------------------------------------------ */
/* Janela com o cálculo                                                */
/* ------------------------------------------------------------------ */

export type SecaoCalculo = {
  id: string
  titulo?: string
  /** Ao lado do título: "feita", "trocada por receita"… */
  subtitulo?: string
  calculo: Calculo
  /** Receitas: quantas porções rende (o cabeçalho mostra uma porção). */
  rende?: { n: number; conhecido: boolean; aoMudar: (n: number) => void }
  aviso?: string
  /** Sem isso, a seção é só leitura. */
  aoAjustar?: (chave: string, porcao: Porcao | null) => void
}

const totalDaSecao = (s: SecaoCalculo) => (s.rende ? vezes(s.calculo.total, 1 / s.rende.n) : s.calculo.total)

/**
 * De onde vêm os números: cada item, o alimento da TACO que ele virou e a quantidade. Tocar num
 * item abre a correção (outro alimento, outra quantidade, não contar ou os valores do rótulo).
 */
export function DetalheCalculo({
  aberta,
  aoMudar,
  titulo,
  descricao,
  secoes,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  titulo: string
  descricao?: string
  secoes: SecaoCalculo[]
}) {
  const [editando, setEditando] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!aberta) setEditando(null)
  }, [aberta])
  const total = somar(...secoes.map(totalDaSecao))

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={titulo}
      descricao={descricao}
      largura="lg"
      rodape={
        <Botao variante="primario" onClick={() => aoMudar(false)}>
          Pronto
        </Botao>
      }
    >
      <div className="grid gap-6">
        {secoes.length > 1 ? (
          <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
            <p>
              <span className="font-semibold tabular">{kcal(total.kcal)} kcal</span> · {gramas(total.p)} g de proteína
            </p>
            <p className="text-xs text-ink-3">
              {gramas(total.c)} g de carboidrato · {gramas(total.g)} g de gordura
            </p>
          </div>
        ) : null}
        {secoes.map((s) => (
          <SecaoDoCalculo key={s.id} secao={s} editando={editando} aoEditar={setEditando} />
        ))}
        <p className="text-xs leading-relaxed text-ink-3">
          Valores da Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição revisada e ampliada, NEPA/Unicamp, 2011. Para o que a TACO não tem (leite líquido, whey, geleia), vale um valor típico de rótulo. É
          uma estimativa: marcas e receitas mudam os números.
        </p>
      </div>
    </Janela>
  )
}

function SecaoDoCalculo({ secao: s, editando, aoEditar }: { secao: SecaoCalculo; editando: string | null; aoEditar: (id: string | null) => void }) {
  const t = totalDaSecao(s)
  const semItens = s.calculo.itens.length === 0
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        {s.titulo ? (
          <h3 className="font-medium">
            {s.titulo}
            {s.subtitulo ? <span className="ml-2 text-xs font-normal text-ink-3">{s.subtitulo}</span> : null}
          </h3>
        ) : null}
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-ink tabular">{kcal(t.kcal)} kcal</span> · {gramas(t.p)} g prot.{s.rende ? " por porção" : ""}
        </p>
      </div>
      {s.rende ? <Rende rende={s.rende} total={s.calculo.total} /> : null}
      {s.aviso ? <p className="mb-2 text-xs text-ink-3">{s.aviso}</p> : null}
      {semItens ? (
        <p className="rounded-lg border border-dashed border-line-strong px-3 py-3 text-sm text-ink-2">Nada para calcular aqui.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {s.calculo.itens.map((item) => {
            const id = `${s.id}|${item.chave}`
            return (
              <LinhaItem
                key={id}
                item={item}
                aberto={editando === id}
                aoAbrir={s.aoAjustar ? () => aoEditar(id) : undefined}
                aoFechar={() => aoEditar(null)}
                aoSalvar={s.aoAjustar ? (p) => s.aoAjustar!(item.chave, p) : undefined}
              />
            )
          })}
        </ul>
      )}
      {!semItens ? (
        <p className="mt-1.5 text-xs text-ink-3">
          {gramas(t.c)} g de carboidrato · {gramas(t.g)} g de gordura{s.rende ? " por porção" : ""}
        </p>
      ) : null}
    </section>
  )
}

function Rende({ rende, total }: { rende: NonNullable<SecaoCalculo["rende"]>; total: Nutrientes }) {
  const { n, conhecido, aoMudar } = rende
  return (
    <div className="mb-3 grid gap-1.5 rounded-lg bg-surface-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-2">Rende</span>
        <Botao variante="contorno" tamanho="icone-sm" aria-label="Uma porção a menos" disabled={n <= 1} onClick={() => aoMudar(n - 1)}>
          <Minus />
        </Botao>
        <span className="w-6 text-center font-semibold tabular" aria-live="polite">
          {n}
        </span>
        <Botao variante="contorno" tamanho="icone-sm" aria-label="Uma porção a mais" disabled={n >= 50} onClick={() => aoMudar(n + 1)}>
          <Plus />
        </Botao>
        <span className="text-ink-2">{n === 1 ? "porção" : "porções"}</span>
      </div>
      <p className="text-xs text-ink-3">
        A receita toda: {kcal(total.kcal)} kcal e {gramas(total.p)} g de proteína.
        {conhecido ? "" : " Ninguém disse quantas porções ela rende, então contei a receita toda como uma."}
      </p>
    </div>
  )
}

function DescricaoParte({ parte: p }: { parte: Parte }) {
  if (p.tipo === "alimento")
    return (
      <span className="mt-0.5 block text-xs text-ink-3">
        <span className="text-ink-2">{p.alimento.nome}</span>
        {p.alimento.fonte === "tipico" ? " (valor típico de rótulo)" : ""} · {textoQuantidade(p.qtd, p.un)}
        {p.porcaoTipica ? " (porção típica)" : ""}
        {p.nota ? <span className="mt-0.5 block">{p.nota}</span> : null}
      </span>
    )
  if (p.tipo === "ignorado") return <span className="mt-0.5 block text-xs text-ink-3">{MOTIVOS[p.motivo]}</span>
  if (p.tipo === "valores") return <span className="mt-0.5 block text-xs text-ink-3">Valores que você informou</span>
  return (
    <span className="mt-0.5 flex items-center gap-1 text-xs text-warning">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden />
      {p.motivo === "alimento" ? "Não reconheci o alimento" : `Não reconheci a quantidade${p.alimento ? ` (${p.alimento.nome})` : ""}`}
    </span>
  )
}

function LinhaItem({
  item,
  aberto,
  aoAbrir,
  aoFechar,
  aoSalvar,
}: {
  item: ItemCalculado
  aberto: boolean
  aoAbrir?: () => void
  aoFechar: () => void
  aoSalvar?: (p: Porcao | null) => void
}) {
  const conta = item.partes.some((p) => p.tipo === "alimento" || p.tipo === "valores")
  const conteudo = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug">{item.texto}</span>
        {item.partes.length > 1 && item.partes.every((p) => p.tipo === "ignorado") ? (
          <DescricaoParte parte={item.partes[0]} />
        ) : (
          item.partes.map((p, i) => <DescricaoParte key={i} parte={p} />)
        )}
        {item.ajustado ? <span className="mt-1 inline-block rounded-full bg-pen-soft px-1.5 py-0.5 text-[11px] font-medium text-pen">ajustado por você</span> : null}
      </span>
      <span className="shrink-0 text-right text-sm tabular">
        {conta ? (
          <>
            {kcal(item.nutrientes.kcal)} kcal
            <span className="block text-xs text-ink-3">{gramas(item.nutrientes.p)} g prot.</span>
          </>
        ) : (
          <span className="text-ink-3">{item.semCalculo ? "?" : "–"}</span>
        )}
      </span>
    </>
  )
  return (
    <li>
      {aoAbrir ? (
        <button
          type="button"
          onClick={aberto ? aoFechar : aoAbrir}
          aria-expanded={aberto}
          className={cn("flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 toque:min-h-12", aberto && "bg-surface-2")}
        >
          {conteudo}
        </button>
      ) : (
        <div className="flex items-start gap-3 px-3 py-2.5">{conteudo}</div>
      )}
      {aberto && aoSalvar ? (
        <AjusteItem
          item={item}
          aoSalvar={(p) => {
            aoSalvar(p)
            aoFechar()
          }}
          aoCancelar={aoFechar}
        />
      ) : null}
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Corrigir um item                                                    */
/* ------------------------------------------------------------------ */

const paraCampo = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",")

function AjusteItem({ item, aoSalvar, aoCancelar }: { item: ItemCalculado; aoSalvar: (p: Porcao | null) => void; aoCancelar: () => void }) {
  const unica = item.partes.length === 1 ? item.partes[0] : null
  const inicial = unica?.tipo === "alimento" ? unica.alimento : unica?.tipo === "desconhecido" ? unica.alimento : undefined
  const [modo, setModo] = React.useState<"alimento" | "valores">(unica?.tipo === "valores" ? "valores" : "alimento")
  const [alimento, setAlimento] = React.useState<Alimento | undefined>(inicial)
  const [busca, setBusca] = React.useState("")
  const [buscando, setBuscando] = React.useState(!inicial)
  const [qtd, setQtd] = React.useState(unica?.tipo === "alimento" ? paraCampo(unica.qtd) : "")
  const [un, setUn] = React.useState<"g" | "ml">(unica?.tipo === "alimento" ? unica.un : "g")
  const [vals, setVals] = React.useState(() => {
    const n = item.nutrientes
    const tem = item.partes.some((p) => p.tipo === "alimento" || p.tipo === "valores")
    return tem ? { kcal: paraCampo(Math.round(n.kcal)), p: paraCampo(n.p), c: paraCampo(n.c), g: paraCampo(n.g) } : { kcal: "", p: "", c: "", g: "" }
  })
  const resultados = React.useMemo(() => buscarAlimentos(busca, 8), [busca])
  const n = lerNumeroDigitadoBr(qtd)
  const previa = alimento && n && n > 0 ? parteDaPorcao(item.texto, { tipo: "alimento", id: alimento.id, qtd: n, un }) : null
  const kcalValor = lerNumeroDigitadoBr(vals.kcal)
  const numeroOuZero = (t: string) => (t.trim() ? (lerNumeroDigitadoBr(t) ?? 0) : 0)

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (modo === "alimento") {
      if (!alimento || !n || n <= 0) return
      aoSalvar({ tipo: "alimento", id: alimento.id, qtd: n, un })
    } else {
      if (kcalValor === null || kcalValor < 0) return
      aoSalvar({ tipo: "valores", kcal: kcalValor, p: numeroOuZero(vals.p), c: numeroOuZero(vals.c), g: numeroOuZero(vals.g) })
    }
  }
  const podeSalvar = modo === "alimento" ? Boolean(alimento && n && n > 0) : kcalValor !== null && kcalValor >= 0

  return (
    <form onSubmit={salvar} className="grid gap-3 border-t border-line bg-surface-2/60 px-3 py-3">
      <Segmentos
        rotulo="Como corrigir"
        valor={modo}
        aoMudar={setModo}
        opcoes={[
          { valor: "alimento", rotulo: "Alimento da tabela" },
          { valor: "valores", rotulo: "Valores do rótulo" },
        ]}
        className="justify-self-start"
      />

      {modo === "alimento" ? (
        <>
          {alimento && !buscando ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{alimento.nome}</span>
                <span className="block text-xs text-ink-3">
                  {kcal(alimento.por100.kcal)} kcal e {numero(alimento.por100.p, 1)} g de proteína por 100 {alimento.porMl ? "ml" : "g"}
                </span>
              </span>
              <Botao variante="contorno" tamanho="sm" onClick={() => setBuscando(true)}>
                Trocar alimento
              </Botao>
            </div>
          ) : (
            <div className="grid gap-1.5">
              <label className="relative block">
                <span className="sr-only">Buscar alimento</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
                <Entrada autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar: arroz, frango, banana…" className="pl-8" />
              </label>
              {busca.trim() ? (
                resultados.length ? (
                  <ul className="max-h-56 overflow-y-auto rounded-lg border border-line bg-surface scrollbar-thin">
                    {resultados.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setAlimento(a)
                            setBuscando(false)
                            setBusca("")
                            if (!qtd) setUn(ehBebida(a) ? "ml" : "g")
                          }}
                          className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2 toque:min-h-11"
                        >
                          <span className="min-w-0">{a.nome}</span>
                          <span className="shrink-0 text-xs text-ink-3 tabular">{kcal(a.por100.kcal)} kcal</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-ink-2">Nada com esse nome na TACO. Tente outro nome ou use “Valores do rótulo”.</p>
                )
              ) : (
                <p className="text-xs text-ink-3">Os valores são por 100 g; depois você diz quanto comeu.</p>
              )}
              {alimento ? (
                <button type="button" onClick={() => setBuscando(false)} className="justify-self-start text-xs text-ink-2 underline-offset-2 hover:underline">
                  Manter {alimento.nome}
                </button>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-ink-2">Quantidade</span>
              <Entrada inputMode="decimal" autoComplete="off" value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="Ex.: 150" className="w-28" />
            </label>
            <Segmentos
              rotulo="Unidade"
              valor={un}
              aoMudar={setUn}
              opcoes={[
                { valor: "g", rotulo: "g" },
                { valor: "ml", rotulo: "ml" },
              ]}
            />
          </div>
          {previa && (previa.tipo === "alimento" || previa.tipo === "valores") ? (
            <p className="text-sm">
              = <span className="font-semibold tabular">{kcal(previa.nutrientes.kcal)} kcal</span> · {gramas(previa.nutrientes.p)} g de proteína
            </p>
          ) : null}
        </>
      ) : (
        <div className="grid gap-2">
          <p className="text-xs text-ink-3">Os valores da quantidade deste item, como no rótulo (por exemplo, 1 scoop de whey).</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["kcal", "Calorias (kcal)"],
                ["p", "Proteína (g)"],
                ["c", "Carboidrato (g)"],
                ["g", "Gordura (g)"],
              ] as const
            ).map(([k, rotulo]) => (
              <label key={k} className="grid gap-1 text-sm">
                <span className="font-medium text-ink-2">{rotulo}</span>
                <Entrada inputMode="decimal" autoComplete="off" value={vals[k]} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Botao variante="primario" tamanho="sm" type="submit" disabled={!podeSalvar}>
          Salvar
        </Botao>
        <Botao variante="contorno" tamanho="sm" onClick={() => aoSalvar({ tipo: "ignorar" })}>
          Não contar
        </Botao>
        {item.ajustado ? (
          <Botao variante="fantasma" tamanho="sm" onClick={() => aoSalvar(null)}>
            Voltar ao cálculo automático
          </Botao>
        ) : null}
        <Botao variante="fantasma" tamanho="sm" className="ml-auto" onClick={aoCancelar}>
          Cancelar
        </Botao>
      </div>
    </form>
  )
}
