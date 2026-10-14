"use client"

import * as React from "react"
import { addDays, format, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowLeftRight, Calculator, Check, ChevronDown, PenLine, Undo2 } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Progresso, Secao } from "@/components/ui/basicos"
import { Entrada } from "@/components/ui/campos"
import { cn, dataRelativa, isoDia, plural } from "@/lib/utils"
import { Medidor, gramas, kcal, textoNutrientes } from "./calculo"
import { diaVazio, type Dia, type Metas, type Refeicao } from "./dados"
import { NADA, calcularAnotacao, somar, type Calculo, type Nutrientes } from "./nutricao"
import type { Receita } from "./receitas"

const LETRAS = ["S", "T", "Q", "Q", "S", "S", "D"]
const noDia = (iso: string) => new Date(`${iso}T12:00`)

/** "Hoje", "Ontem" ou "Segunda, 12 de outubro". */
export function nomeDoDia(dia: string): string {
  const r = dataRelativa(dia)
  if (r === "hoje" || r === "ontem") return r[0].toUpperCase() + r.slice(1)
  const t = format(noDia(dia), "EEEE, d 'de' MMMM", { locale: ptBR })
  return t[0].toUpperCase() + t.slice(1)
}

/** O que uma refeição soma no dia: o plano, a receita que a substituiu ou o que foi anotado. */
export type ValorRefeicao =
  | { origem: "plano"; n: Nutrientes; semCalculo: boolean; calculo?: Calculo }
  | { origem: "receita"; n: Nutrientes; semCalculo: boolean; receita: Receita }
  | { origem: "anotacao"; n: Nutrientes; semCalculo: boolean; calculo: Calculo | null; nota: string }

export function valorDaRefeicao(r: Refeicao, registro: Dia, calculos: Map<string, Calculo>, receitas: Map<string, Receita>): ValorRefeicao {
  const id = r.item.id
  const nota = registro.diferente[id]
  if (nota !== undefined) {
    const calculo = nota.trim() ? calcularAnotacao(nota) : null
    return { origem: "anotacao", n: calculo?.total ?? NADA, semCalculo: !calculo?.itens.length || calculo.semCalculo > 0, calculo, nota }
  }
  const receita = registro.trocas[id] ? receitas.get(registro.trocas[id]) : undefined
  if (receita) return { origem: "receita", n: receita.calc.porPorcao, semCalculo: receita.calc.semCalculo > 0 || !receita.calc.itens.length, receita }
  const calculo = calculos.get(id)
  return { origem: "plano", n: calculo?.total ?? NADA, semCalculo: (calculo?.semCalculo ?? 0) > 0, calculo }
}

export type AlvoCalculo = { tipo: "dia" } | { tipo: "refeicao"; id: string } | { tipo: "plano" }

/**
 * O dia escolhido: as refeições do plano, em ordem, para marcar com um toque. A próxima
 * fica aberta com o que comer; ao marcar, a seguinte abre sozinha. Em cima, as calorias e a
 * proteína do que já foi marcado, contra a meta e o previsto para o dia.
 */
export function HojeAlimentacao({
  refeicoes,
  dias,
  dia,
  aoEscolherDia,
  aoMudar,
  aoEditarRefeicao,
  calculos,
  receitas,
  metas,
  aoVerCalculo,
  aoTrocar,
}: {
  refeicoes: Refeicao[]
  dias: Map<string, Dia>
  dia: string
  aoEscolherDia: (d: string) => void
  aoMudar: (dia: string, mudar: (d: Dia) => Dia) => void
  aoEditarRefeicao: (id: string) => void
  calculos: Map<string, Calculo>
  receitas: Map<string, Receita>
  metas: Metas
  aoVerCalculo: (alvo: AlvoCalculo) => void
  aoTrocar: (refeicaoId: string) => void
}) {
  const hoje = isoDia()
  const registro = dias.get(dia) ?? diaVazio(dia)
  const ids = refeicoes.map((r) => r.item.id)
  const feitas = new Set(registro.feitas.filter((f) => ids.includes(f)))
  const valores = new Map(refeicoes.map((r) => [r.item.id, valorDaRefeicao(r, registro, calculos, receitas)]))
  const consumido = somar(...refeicoes.filter((r) => feitas.has(r.item.id)).map((r) => valores.get(r.item.id)!.n))
  const previsto = somar(...[...valores.values()].map((v) => v.n))
  const semCalculo = [...valores.values()].filter((v) => v.semCalculo).length
  const temCalculo = previsto.kcal > 0
  const proxima = refeicoes.find((r) => !feitas.has(r.item.id))?.item.id ?? null
  // undefined = automático (abre a próxima); null = tudo fechado pela pessoa
  const [aberta, setAberta] = React.useState<string | null | undefined>(undefined)
  React.useEffect(() => setAberta(undefined), [dia])
  const abertaAgora = aberta === undefined ? proxima : aberta

  const alternar = (r: Refeicao) => {
    const id = r.item.id
    const marcar = !feitas.has(id)
    aoMudar(dia, (d) => {
      const diferente = { ...d.diferente }
      if (!marcar) delete diferente[id]
      return { ...d, feitas: marcar ? [...new Set([...d.feitas, id])] : d.feitas.filter((x) => x !== id), diferente }
    })
    navigator.vibrate?.(10)
    if (marcar && abertaAgora === id) {
      const depois = refeicoes.slice(refeicoes.indexOf(r) + 1).find((x) => !feitas.has(x.item.id))
      setAberta(depois?.item.id ?? null)
    }
  }

  const comiDiferente = (r: Refeicao, nota: string) => {
    const id = r.item.id
    aoMudar(dia, (d) => ({ ...d, feitas: [...new Set([...d.feitas, id])], diferente: { ...d.diferente, [id]: nota.trim() } }))
    if (abertaAgora === id) {
      const depois = refeicoes.slice(refeicoes.indexOf(r) + 1).find((x) => !feitas.has(x.item.id))
      setAberta(depois?.item.id ?? null)
    }
  }

  const voltarAoPlano = (r: Refeicao) =>
    aoMudar(dia, (d) => {
      const trocas = { ...d.trocas }
      delete trocas[r.item.id]
      return { ...d, trocas }
    })

  const total = refeicoes.length
  const completo = total > 0 && feitas.size >= total

  return (
    <Secao
      titulo={nomeDoDia(dia)}
      acao={
        dia !== hoje ? (
          <Botao variante="fantasma" tamanho="sm" onClick={() => aoEscolherDia(hoje)}>
            Voltar para hoje
          </Botao>
        ) : null
      }
    >
      <div className="rounded-xl border border-line bg-surface">
        <div className="p-4 pb-3 sm:px-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-sm">
              <span className="text-2xl font-semibold">{feitas.size}</span>
              <span className="text-ink-2"> de {plural(total, "refeição", "refeições")}</span>
            </p>
            {completo ? (
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Check className="size-4 text-pen" /> Plano do dia completo
              </p>
            ) : null}
          </div>
          {temCalculo ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-x-5">
                <Medidor rotulo="Calorias" unidade="kcal" consumido={consumido.kcal} previsto={previsto.kcal} meta={metas.kcal} />
                <Medidor rotulo="Proteína" unidade="g" consumido={consumido.p} previsto={previsto.p} meta={metas.proteina} />
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-ink-3">
                {completo ? "Total do dia" : "Previsto no dia, com o que falta do plano"}: {kcal(previsto.kcal)} kcal e {gramas(previsto.p)} g de proteína
                {semCalculo ? ` (${plural(semCalculo, "refeição sem cálculo", "refeições sem cálculo")})` : ""}.{" "}
                <button type="button" onClick={() => aoVerCalculo({ tipo: "dia" })} className="font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline">
                  Ver cálculo
                </button>
              </p>
            </>
          ) : (
            <Progresso rotulo={`Refeições de ${nomeDoDia(dia).toLowerCase()}`} valor={total ? (feitas.size / total) * 100 : 0} />
          )}
          <Semana dias={dias} total={ids} dia={dia} aoEscolher={aoEscolherDia} />
        </div>

        <ol className="divide-y divide-line border-t border-line">
          {refeicoes.map((r) => (
            <LinhaRefeicao
              key={r.item.id}
              refeicao={r}
              feita={feitas.has(r.item.id)}
              diferente={registro.diferente[r.item.id]}
              aberta={abertaAgora === r.item.id}
              proxima={proxima === r.item.id && dia === hoje}
              aoAbrir={() => setAberta(abertaAgora === r.item.id ? null : r.item.id)}
              aoAlternar={() => alternar(r)}
              aoComerDiferente={(nota) => comiDiferente(r, nota)}
              aoEditar={() => aoEditarRefeicao(r.item.id)}
              valor={valores.get(r.item.id)!}
              aoVerCalculo={() => aoVerCalculo({ tipo: "refeicao", id: r.item.id })}
              aoTrocar={() => aoTrocar(r.item.id)}
              aoVoltarAoPlano={() => voltarAoPlano(r)}
            />
          ))}
        </ol>
      </div>
    </Secao>
  )
}

/** Segunda a domingo: quantas refeições foram marcadas em cada dia. Tocar escolhe o dia. */
function Semana({ dias, total, dia, aoEscolher }: { dias: Map<string, Dia>; total: string[]; dia: string; aoEscolher: (d: string) => void }) {
  const hoje = isoDia()
  const inicio = startOfWeek(new Date(), { weekStartsOn: 1 })
  const semana = Array.from({ length: 7 }, (_, i) => isoDia(addDays(inicio, i)))
  const completos = semana.filter((d) => total.length && (dias.get(d)?.feitas.filter((f) => total.includes(f)).length ?? 0) >= total.length).length
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-xs text-ink-3">
        Esta semana: {completos === 1 ? "1 dia completo" : `${completos} dias completos`}
      </p>
      <ol aria-label="Dias desta semana" className="grid grid-cols-7 gap-1">
        {semana.map((d, i) => {
          const n = dias.get(d)?.feitas.filter((f) => total.includes(f)).length ?? 0
          const completo = total.length > 0 && n >= total.length
          const futuro = d > hoje
          const escolhido = d === dia
          const data = noDia(d)
          return (
            <li key={d}>
              <button
                type="button"
                disabled={futuro}
                aria-pressed={escolhido}
                aria-label={`${format(data, "EEEE, d 'de' MMMM", { locale: ptBR })}: ${n} de ${total.length} refeições`}
                onClick={() => aoEscolher(d)}
                className="group flex w-full flex-col items-center gap-1 rounded-lg py-1 disabled:cursor-default"
              >
                <span className={cn("text-xs", d === hoje ? "font-semibold text-ink" : "text-ink-3")}>{LETRAS[i]}</span>
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-full border text-xs transition-colors tabular",
                    completo ? "border-pen bg-pen text-pen-ink" : n > 0 ? "border-pen text-ink" : "border-line-strong text-ink-3",
                    escolhido && "ring-2 ring-pen ring-offset-2 ring-offset-surface",
                    futuro ? "opacity-40" : !escolhido && "group-hover:border-pen",
                  )}
                >
                  {completo ? <Check className="size-4" strokeWidth={2.5} /> : n > 0 ? `${n}/${total.length}` : data.getDate()}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function LinhaRefeicao({
  refeicao: r,
  feita,
  diferente,
  aberta,
  proxima,
  aoAbrir,
  aoAlternar,
  aoComerDiferente,
  aoEditar,
  valor,
  aoVerCalculo,
  aoTrocar,
  aoVoltarAoPlano,
}: {
  refeicao: Refeicao
  feita: boolean
  diferente: string | undefined
  aberta: boolean
  proxima: boolean
  aoAbrir: () => void
  aoAlternar: () => void
  aoComerDiferente: (nota: string) => void
  aoEditar: () => void
  valor: ValorRefeicao
  aoVerCalculo: () => void
  aoTrocar: () => void
  aoVoltarAoPlano: () => void
}) {
  const [anotando, setAnotando] = React.useState(false)
  const [nota, setNota] = React.useState("")
  const painel = `refeicao-${r.item.id}`
  const comeuDiferente = diferente !== undefined
  const receita = valor.origem === "receita" ? valor.receita : null
  const temValor = valor.n.kcal > 0

  const salvarNota = (e: React.FormEvent) => {
    e.preventDefault()
    aoComerDiferente(nota)
    setAnotando(false)
  }

  return (
    <li className={cn(proxima && !aberta && "bg-pen-soft/40")}>
      <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
        <button
          type="button"
          aria-pressed={feita}
          aria-label={feita ? `Desmarcar ${r.nome}` : `Marcar ${r.nome} como feita`}
          onClick={aoAlternar}
          className={cn(
            "relative grid size-8 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors after:absolute after:-inset-2",
            feita ? (comeuDiferente ? "border-pen bg-pen-soft text-ink" : "border-pen bg-pen text-pen-ink") : "border-line-strong hover:border-pen",
          )}
        >
          {feita ? comeuDiferente ? <PenLine className="size-3.5" /> : <Check className="size-4 animate-marcar" strokeWidth={2.5} /> : null}
        </button>
        <button type="button" onClick={aoAbrir} aria-expanded={aberta} aria-controls={painel} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left toque:min-h-11">
          <span className="min-w-0 flex-1">
            <span className={cn("block font-medium leading-snug", feita && !aberta && "text-ink-2")}>
              {r.nome}
              {proxima ? <span className="ml-2 rounded-full bg-pen px-1.5 py-0.5 align-middle text-[11px] font-medium text-pen-ink">próxima</span> : null}
            </span>
            {comeuDiferente ? (
              <span className="block truncate text-xs text-ink-2">Comi diferente{diferente ? `: ${diferente}` : ""}</span>
            ) : receita ? (
              <span className="block truncate text-xs text-ink-2">Receita: {receita.nome}</span>
            ) : r.quando ? (
              <span className="block truncate text-xs text-ink-3">{r.quando}</span>
            ) : null}
          </span>
          {temValor || valor.semCalculo ? (
            <span className={cn("shrink-0 text-xs tabular", feita && !aberta ? "text-ink-3" : "text-ink-2")} aria-label={temValor ? `${kcal(valor.n.kcal)} quilocalorias` : "Sem cálculo"}>
              {temValor ? `${kcal(valor.n.kcal)} kcal` : "–"}
            </span>
          ) : null}
          <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition-transform", aberta && "rotate-180")} aria-hidden />
        </button>
      </div>

      {aberta ? (
        <div id={painel} className="grid gap-3 px-4 pb-4 pl-[3.75rem] sm:px-5 sm:pl-16">
          {receita ? (
            <div className="rounded-lg border border-line px-3 py-2.5 text-sm">
              <p>
                <span className="text-ink-2">Trocada por </span>
                <span className="font-medium">{receita.nome}</span>
              </p>
              <p className="mt-0.5 text-xs text-ink-3">
                Uma porção{receita.calc.rendeConhecido && receita.calc.rende > 1 ? ` (a receita rende ${receita.calc.rende})` : ""}
                {receita.ingredientes.length ? ` · ${receita.ingredientes.slice(0, 5).join(", ")}` : ""}
              </p>
              <button type="button" onClick={aoVoltarAoPlano} className="mt-1.5 text-xs font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline">
                Voltar ao plano
              </button>
            </div>
          ) : (
            <>
              {r.objetivo ? <p className="text-sm text-ink-2">{r.objetivo}</p> : null}
              {r.nota ? <p className="text-sm font-medium">{r.nota}</p> : null}
              {r.itens.length ? (
                <ul className="grid list-disc gap-1 pl-4 text-sm marker:text-ink-3">
                  {r.itens.map((i, k) => (
                    <li key={k}>{i}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-3">Sem itens. Toque em Editar para dizer o que comer.</p>
              )}
            </>
          )}

          {temValor || valor.semCalculo ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
              {temValor ? (
                <span>
                  {valor.origem === "anotacao" ? "Pela anotação: " : ""}
                  {textoNutrientes(valor.n)}
                </span>
              ) : (
                <span>{valor.origem === "anotacao" ? "Sem estimativa: diga o que comeu, como “2 bananas”." : "Sem cálculo ainda."}</span>
              )}
              {valor.origem !== "anotacao" || valor.calculo?.itens.length ? (
                <button type="button" onClick={aoVerCalculo} className="inline-flex items-center gap-1 text-xs font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline">
                  <Calculator className="size-3.5" aria-hidden /> Ver cálculo
                </button>
              ) : null}
            </p>
          ) : null}

          {anotando ? (
            <form onSubmit={salvarNota} className="flex flex-wrap items-center gap-2">
              <Entrada autoFocus value={nota} onChange={(e) => setNota(e.target.value)} placeholder="O que comeu? Ex.: 2 bananas e 1 iogurte" aria-label={`O que você comeu no lugar de ${r.nome}`} className="min-w-48 flex-1" />
              <Botao variante="primario" type="submit">
                Salvar
              </Botao>
              <Botao variante="fantasma" onClick={() => setAnotando(false)}>
                Cancelar
              </Botao>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              {!feita ? (
                <Botao variante="primario" tamanho="sm" onClick={aoAlternar}>
                  <Check /> Feita
                </Botao>
              ) : null}
              {comeuDiferente ? (
                <Botao
                  variante="contorno"
                  tamanho="sm"
                  onClick={() => {
                    setNota(diferente ?? "")
                    setAnotando(true)
                  }}
                >
                  <PenLine /> Editar anotação
                </Botao>
              ) : (
                <Botao
                  variante="contorno"
                  tamanho="sm"
                  onClick={() => {
                    setNota("")
                    setAnotando(true)
                  }}
                >
                  <PenLine /> Comi diferente
                </Botao>
              )}
              {!comeuDiferente ? (
                <Botao variante="contorno" tamanho="sm" onClick={aoTrocar}>
                  <ArrowLeftRight /> {receita ? "Outra receita" : "Trocar por receita"}
                </Botao>
              ) : null}
              {feita ? (
                <Botao variante="fantasma" tamanho="sm" onClick={aoAlternar}>
                  <Undo2 /> Desmarcar
                </Botao>
              ) : null}
              <Botao variante="fantasma" tamanho="sm" className="ml-auto" onClick={aoEditar}>
                Editar
              </Botao>
            </div>
          )}
        </div>
      ) : null}
    </li>
  )
}
