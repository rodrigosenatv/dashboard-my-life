"use client"

import * as React from "react"
import { addDays, format, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Check, ChevronDown, PenLine, Undo2 } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Progresso, Secao } from "@/components/ui/basicos"
import { Entrada } from "@/components/ui/campos"
import { cn, dataRelativa, isoDia, plural } from "@/lib/utils"
import { diaVazio, type Dia, type Refeicao } from "./dados"

const LETRAS = ["S", "T", "Q", "Q", "S", "S", "D"]
const noDia = (iso: string) => new Date(`${iso}T12:00`)

/** "Hoje", "Ontem" ou "Segunda, 12 de outubro". */
export function nomeDoDia(dia: string): string {
  const r = dataRelativa(dia)
  if (r === "hoje" || r === "ontem") return r[0].toUpperCase() + r.slice(1)
  const t = format(noDia(dia), "EEEE, d 'de' MMMM", { locale: ptBR })
  return t[0].toUpperCase() + t.slice(1)
}

/**
 * O dia escolhido: as refeições do plano, em ordem, para marcar com um toque. A próxima
 * fica aberta com o que comer; ao marcar, a seguinte abre sozinha.
 */
export function HojeAlimentacao({
  refeicoes,
  dias,
  dia,
  aoEscolherDia,
  aoMudar,
  aoEditarRefeicao,
}: {
  refeicoes: Refeicao[]
  dias: Map<string, Dia>
  dia: string
  aoEscolherDia: (d: string) => void
  aoMudar: (dia: string, mudar: (d: Dia) => Dia) => void
  aoEditarRefeicao: (id: string) => void
}) {
  const hoje = isoDia()
  const registro = dias.get(dia) ?? diaVazio(dia)
  const ids = refeicoes.map((r) => r.item.id)
  const feitas = new Set(registro.feitas.filter((f) => ids.includes(f)))
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
          <Progresso rotulo={`Refeições de ${nomeDoDia(dia).toLowerCase()}`} valor={total ? (feitas.size / total) * 100 : 0} />
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
}) {
  const [anotando, setAnotando] = React.useState(false)
  const [nota, setNota] = React.useState("")
  const painel = `refeicao-${r.item.id}`
  const comeuDiferente = diferente !== undefined

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
            ) : r.quando ? (
              <span className="block truncate text-xs text-ink-3">{r.quando}</span>
            ) : null}
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition-transform", aberta && "rotate-180")} aria-hidden />
        </button>
      </div>

      {aberta ? (
        <div id={painel} className="grid gap-3 px-4 pb-4 pl-[3.75rem] sm:px-5 sm:pl-16">
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

          {anotando ? (
            <form onSubmit={salvarNota} className="flex flex-wrap items-center gap-2">
              <Entrada autoFocus value={nota} onChange={(e) => setNota(e.target.value)} placeholder="O que você comeu? (opcional)" aria-label={`O que você comeu no lugar de ${r.nome}`} className="min-w-48 flex-1" />
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
