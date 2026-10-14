"use client"

import * as React from "react"
import { Plus, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Vazio } from "@/components/ui/basicos"
import { BotaoExcluir } from "@/components/ui/botao-excluir"
import { Campo, Entrada } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import type { Json } from "@/lib/supabase/database.types"
import { cn, formatar, isoDia } from "@/lib/utils"
import { TIPOS_GASTO, lerValorDigitado, reais, resumirGastos, tipoDoGasto, useGravarViagens, valorDoGasto, type Gasto, type TipoGasto, type Viagem } from "./dados"
import { CampoReais, EscolhaPilulas, EscolherViagem, ICONE_GASTO, valorNoCampo } from "./ui"

/**
 * Os gastos da viagem contra o orçamento: o que já foi pago, quanto a viagem deve custar no
 * total (pago mais o previsto que falta) e cada categoria. Um gasto previsto vira pago num toque.
 */
export function GastosViagem({ viagem, viagens, gastos, aoDefinirOrcamento }: { viagem: Viagem; viagens: Viagem[]; gastos: Gasto[]; aoDefinirOrcamento: () => void }) {
  const gravar = useGravarViagens()
  const resumo = React.useMemo(() => resumirGastos(gastos), [gastos])
  const [form, setForm] = React.useState<{ aberto: boolean; gasto: Gasto | null }>({ aberto: false, gasto: null })
  const comecou = viagem.situacao === "andamento" || viagem.situacao === "realizada"

  const pagar = (g: Gasto) => {
    const dataAntes = ((g.item.props ?? {}) as Record<string, Json>).Data
    void gravar.mudarProps(
      g.item,
      (p) => {
        p.Realizado = g.previsto
        if (!p.Data) p.Data = isoDia()
      },
      "gastos",
    )
    toast.success(`${g.titulo}: pago`, {
      action: {
        label: "Desfazer",
        onClick: () =>
          void gravar.mudarProps(
            g.item,
            (p) => {
              delete p.Realizado
              if (dataAntes === undefined || dataAntes === null) delete p.Data
              else p.Data = dataAntes
            },
            "gastos",
          ),
      },
    })
  }

  return (
    <div className="grid gap-6">
      <Resumo viagem={viagem} gasto={resumo.gasto} previsao={resumo.previsao} faltaPagar={resumo.faltaPagar} aoDefinirOrcamento={aoDefinirOrcamento} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold">Gastos</h3>
        <Botao variante="primario" tamanho="sm" onClick={() => setForm({ aberto: true, gasto: null })}>
          <Plus /> Lançar gasto
        </Botao>
      </div>

      {!gastos.length ? (
        <Vazio
          icone={<Wallet />}
          titulo="Nenhum gasto ainda."
          descricao={comecou ? "Lance o que for pagando durante a viagem: leva poucos segundos." : "Planeje o que já sabe: passagem, hospedagem, passeios. Depois é só marcar como pago."}
          acao={
            <Botao onClick={() => setForm({ aberto: true, gasto: null })}>
              <Plus /> Lançar gasto
            </Botao>
          }
        />
      ) : (
        <div className="grid gap-5">
          {resumo.categorias.map((c) => {
            const Icone = ICONE_GASTO[c.tipo]
            return (
              <section key={c.tipo} aria-label={c.rotulo}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <h4 className="flex items-center gap-2 text-sm font-semibold">
                    <Icone className="size-4 text-ink-3" aria-hidden /> {c.rotulo}
                  </h4>
                  <p className="text-sm tabular text-ink-2">{!c.gasto ? `previsto ${reais(c.previsao)}` : c.previsao > c.gasto ? `${reais(c.gasto)} de ${reais(c.previsao)}` : reais(c.gasto)}</p>
                </div>
                <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                  {c.itens.map((g) => (
                    <LinhaGasto key={g.id} gasto={g} aoAbrir={() => setForm({ aberto: true, gasto: g })} aoPagar={() => pagar(g)} />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <FormGasto aberto={form.aberto} aoMudar={(v) => setForm((f) => ({ ...f, aberto: v }))} viagem={viagem} viagens={viagens} gasto={form.gasto} comecou={comecou} />
    </div>
  )
}

function Resumo({ viagem, gasto, previsao, faltaPagar, aoDefinirOrcamento }: { viagem: Viagem; gasto: number; previsao: number; faltaPagar: number; aoDefinirOrcamento: () => void }) {
  const orcamento = viagem.orcamento
  const total = Math.max(orcamento ?? 0, previsao, gasto, 1)
  const acima = orcamento !== null && previsao > orcamento
  const pct = (n: number) => `${Math.min(100, (n / total) * 100)}%`
  return (
    <section aria-label="Resumo dos gastos" className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <p className="text-sm text-ink-2">Pago até agora</p>
      <p className="font-display text-3xl font-semibold tabular">{reais(gasto)}</p>
      {orcamento !== null ? (
        <p className="text-sm text-ink-3">de {reais(orcamento)} de orçamento</p>
      ) : (
        <button type="button" onClick={aoDefinirOrcamento} className="text-sm font-medium text-pen hover:underline">
          Definir um orçamento
        </button>
      )}

      {orcamento !== null || previsao > 0 ? (
        <div
          className="relative mt-4 h-2.5 w-full overflow-hidden rounded-full bg-surface-3"
          role="img"
          aria-label={`Pago ${reais(gasto)}, previsão ${reais(previsao)}${orcamento !== null ? `, orçamento ${reais(orcamento)}` : ""}`}
        >
          <div className="absolute inset-y-0 left-0 bg-pen/35" style={{ width: pct(previsao) }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-pen" style={{ width: pct(gasto) }} />
          {acima ? <div aria-hidden className="absolute inset-y-0 w-0.5 bg-danger" style={{ left: pct(orcamento!) }} /> : null}
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-ink-3">Previsão da viagem</dt>
          <dd className="font-semibold tabular">{reais(previsao)}</dd>
        </div>
        <div>
          <dt className="text-ink-3">Falta pagar</dt>
          <dd className="font-semibold tabular">{reais(faltaPagar)}</dd>
        </div>
      </dl>
      {orcamento !== null && previsao > 0 ? (
        <p className={cn("mt-3 text-sm", acima ? "font-medium text-danger" : "text-ink-2")}>
          {acima ? `A previsão passa ${reais(previsao - orcamento)} do orçamento.` : previsao === orcamento ? "A previsão fecha no orçamento." : `Cabe no orçamento: sobram ${reais(orcamento - previsao)}.`}
        </p>
      ) : null}
    </section>
  )
}

function LinhaGasto({ gasto: g, aoAbrir, aoPagar }: { gasto: Gasto; aoAbrir: () => void; aoPagar: () => void }) {
  const pendente = g.realizado === null && g.previsto !== null
  const quando = g.data ? ` em ${formatar(g.data, "d 'de' MMM")}` : ""
  const detalhe =
    g.realizado !== null
      ? g.previsto !== null && g.previsto !== g.realizado
        ? `Pago${quando} · previsto ${reais(g.previsto)}`
        : `Pago${quando}`
      : g.previsto !== null
        ? "Previsto, falta pagar"
        : "Sem valor"
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
      <button type="button" onClick={aoAbrir} className="min-w-0 flex-1 text-left toque:min-h-11">
        <span className="block truncate font-medium">{g.titulo}</span>
        <span className={cn("block truncate text-xs", pendente ? "text-warning" : "text-ink-3")}>{detalhe}</span>
      </button>
      {pendente ? (
        <Botao variante="contorno" tamanho="sm" onClick={aoPagar} aria-label={`Marcar ${g.titulo} como pago`}>
          Paguei
        </Botao>
      ) : null}
      <span className={cn("w-20 shrink-0 text-right text-sm font-semibold tabular", pendente && "text-ink-2")}>{reais(valorDoGasto(g))}</span>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Janela do gasto                                                     */
/* ------------------------------------------------------------------ */

function FormGasto({
  aberto,
  aoMudar,
  viagem,
  viagens,
  gasto,
  comecou,
}: {
  aberto: boolean
  aoMudar: (v: boolean) => void
  viagem: Viagem
  viagens: Viagem[]
  gasto: Gasto | null
  comecou: boolean
}) {
  const gravar = useGravarViagens()
  const [titulo, setTitulo] = React.useState("")
  const [tipo, setTipo] = React.useState<TipoGasto>("outros")
  const [tipoEscolhido, setTipoEscolhido] = React.useState(false)
  const [previsto, setPrevisto] = React.useState("")
  const [pago, setPago] = React.useState("")
  const [data, setData] = React.useState("")
  const [destino, setDestino] = React.useState(viagem.id)
  const [erro, setErro] = React.useState("")

  React.useEffect(() => {
    if (!aberto) return
    setTitulo(gasto?.titulo ?? "")
    setTipo(gasto?.tipo ?? "outros")
    setTipoEscolhido(Boolean(gasto))
    setPrevisto(valorNoCampo(gasto?.previsto))
    setPago(valorNoCampo(gasto?.realizado))
    setData(gasto?.data ?? (comecou ? isoDia() : ""))
    setDestino(viagem.id)
    setErro("")
  }, [aberto, gasto, comecou, viagem.id])

  const mudarTitulo = (t: string) => {
    setTitulo(t)
    if (!tipoEscolhido) setTipo(tipoDoGasto(t))
  }

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    const valorPrevisto = previsto.trim() ? lerValorDigitado(previsto) : null
    const valorPago = pago.trim() ? lerValorDigitado(pago) : null
    if ((previsto.trim() && valorPrevisto === null) || (pago.trim() && valorPago === null)) return setErro("Use só números, como 150 ou 89,90.")
    if (valorPrevisto === null && valorPago === null) return setErro("Diga quanto: o previsto, o pago ou os dois.")
    const rotulo = TIPOS_GASTO.find((x) => x.id === tipo)!.rotulo
    const t = titulo.trim() || rotulo
    const categoria = gasto && !tipoEscolhido && gasto.categoria ? gasto.categoria : rotulo
    const aplicar = (props: Record<string, Json>) => {
      if (destino) props._viagem = destino
      else delete props._viagem
      props.Tipo = categoria
      if (valorPrevisto !== null) props.Previsto = valorPrevisto
      else delete props.Previsto
      if (valorPago !== null) props.Realizado = valorPago
      else delete props.Realizado
      if (data) props.Data = data
      else delete props.Data
      return props
    }
    if (gasto) void gravar.mudar(gasto.item, (atual) => ({ title: t, props: aplicar({ ...((atual.props ?? {}) as Record<string, Json>) }) }), "gastos")
    else void gravar.criar("gastos", { title: t, props: aplicar({}) }).catch(() => {})
    if (destino !== viagem.id) toast.success(destino ? `Movido para ${viagens.find((v) => v.id === destino)?.nome ?? "outra viagem"}` : "Tirado da viagem", { description: destino ? undefined : "Ele fica em Sem viagem, na página de Viagens." })
    aoMudar(false)
  }

  const idForm = "form-gasto"
  return (
    <Janela
      aberta={aberto}
      aoMudar={aoMudar}
      titulo={gasto ? "Editar gasto" : "Lançar gasto"}
      rodape={
        <>
          {gasto ? (
            <BotaoExcluir
              aoExcluir={() => {
                void gravar.excluir([gasto.item])
                aoMudar(false)
              }}
            />
          ) : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form={idForm}>
            {gasto ? "Salvar" : "Lançar"}
          </Botao>
        </>
      }
    >
      <form id={idForm} onSubmit={salvar} className="grid gap-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Previsto" htmlFor="gasto-previsto">
            {/* Durante e depois da viagem o comum é lançar o que pagou; antes, planejar */}
            <CampoReais autoFocus={!gasto && !comecou} id="gasto-previsto" value={previsto} onChange={(e) => setPrevisto(e.target.value)} placeholder="0" aria-describedby={erro ? "gasto-erro" : undefined} />
          </Campo>
          <Campo rotulo="Pago" htmlFor="gasto-pago">
            <CampoReais autoFocus={!gasto && comecou} id="gasto-pago" value={pago} onChange={(e) => setPago(e.target.value)} placeholder="0" aria-describedby={erro ? "gasto-erro" : undefined} />
          </Campo>
        </div>
        <p className="-mt-2 text-xs text-ink-3">Planejando, preencha o previsto. Quando pagar, o pago (pode ser diferente).</p>
        <Campo rotulo="O quê" htmlFor="gasto-titulo">
          <Entrada id="gasto-titulo" value={titulo} onChange={(e) => mudarTitulo(e.target.value)} placeholder="Ex.: Passagem, Pousada, Almoço" autoComplete="off" />
        </Campo>
        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Categoria</span>
          <EscolhaPilulas
            rotulo="Categoria do gasto"
            opcoes={TIPOS_GASTO}
            valor={tipo}
            icones={ICONE_GASTO}
            aoMudar={(v) => {
              setTipo(v)
              setTipoEscolhido(true)
            }}
          />
        </div>
        <Campo rotulo="Data" htmlFor="gasto-data" dica="Opcional.">
          <Entrada id="gasto-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="max-w-48" />
        </Campo>
        {gasto ? <EscolherViagem id="gasto-viagem" valor={destino} aoMudar={setDestino} viagens={viagens} /> : null}
        {erro ? (
          <p id="gasto-erro" role="alert" className="text-sm text-danger">
            {erro}
          </p>
        ) : null}
      </form>
    </Janela>
  )
}
