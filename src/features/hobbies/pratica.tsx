"use client"

import * as React from "react"
import { Plus, Timer } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Vazio } from "@/components/ui/basicos"
import { formatar, isoDia, plural } from "@/lib/utils"
import { diaCurto, mesPorExtenso, textoDesde, textoMinutos, type ResumoHobby, type Sessao } from "./dados"

const POR_VEZ = 60

/** A aba Prática de um hobby: o recado da última vez, os números do mês e o diário. */
export function PraticaHobby({ sessoes, resumo, aoRegistrar, aoEditar }: { sessoes: Sessao[]; resumo: ResumoHobby; aoRegistrar: () => void; aoEditar: (s: Sessao) => void }) {
  const hoje = isoDia()
  const [limite, setLimite] = React.useState(POR_VEZ)
  const visiveis = sessoes.slice(0, limite)

  if (!sessoes.length)
    return (
      <Vazio
        icone={<Timer />}
        titulo="Nenhuma prática registrada ainda."
        descricao="Registre a primeira para acompanhar a sua semana e deixar um recado para a próxima vez."
        acao={
          // O botão principal já está no cartão da semana, logo acima
          <Botao variante="contorno" onClick={aoRegistrar}>
            <Plus /> Registrar prática
          </Botao>
        }
      />
    )

  const meses = new Map<string, Sessao[]>()
  for (const s of visiveis) {
    const mes = s.data.slice(0, 7)
    meses.set(mes, [...(meses.get(mes) ?? []), s])
  }

  const ultima = resumo.ultima

  return (
    <div className="grid gap-6">
      {ultima?.proximo ? (
        <div className="rounded-xl border border-pen/25 bg-pen-soft px-4 py-3">
          <p className="text-xs font-medium text-pen">Para a próxima vez · anotado {diaCurto(ultima.data, hoje)}</p>
          <p className="mt-0.5 text-ink">{ultima.proximo}</p>
        </div>
      ) : null}

      <dl className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface">
        <Numero rotulo="Este mês" valor={plural(resumo.sessoesNoMes, "prática")} detalhe={textoMinutos(resumo.minutosNoMes) || undefined} />
        <Numero rotulo="Total" valor={plural(resumo.total, "prática")} />
        <Numero rotulo="Última" valor={resumo.diasSemPraticar === null ? "–" : textoDesde(resumo.diasSemPraticar)} detalhe={ultima?.minutos ? textoMinutos(ultima.minutos) : undefined} />
      </dl>

      <div className="grid gap-6">
        {[...meses].map(([mes, lista]) => (
          <section key={mes} aria-label={mesPorExtenso(`${mes}-01`)}>
            <h3 className="mb-2 text-sm font-medium text-ink-2 first-letter:uppercase">{mesPorExtenso(`${mes}-01`)}</h3>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {lista.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => aoEditar(s)} className="flex w-full items-start gap-3.5 px-4 py-3 text-left transition-colors hover:bg-surface-2 toque:min-h-12" aria-label={`Editar a prática de ${diaCurto(s.data, hoje)}`}>
                    <span aria-hidden className="w-9 shrink-0 text-center">
                      <span className="block text-[11px] font-medium uppercase text-ink-3">{formatar(s.data, "EEEEEE")}</span>
                      <span className="block text-lg font-semibold leading-tight tabular">{formatar(s.data, "d")}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={s.anotacoes ? "block whitespace-pre-line text-sm" : "block text-sm text-ink-3"}>{s.anotacoes || "Sem anotações"}</span>
                      {s.proximo ? <span className="mt-1 block text-xs text-ink-3">Próxima vez: {s.proximo}</span> : null}
                    </span>
                    {s.minutos ? <span className="shrink-0 pt-0.5 text-sm tabular text-ink-2">{textoMinutos(s.minutos)}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {sessoes.length > visiveis.length ? (
        <Botao variante="contorno" className="justify-self-start" onClick={() => setLimite((l) => l + POR_VEZ)}>
          Mostrar mais antigas
        </Botao>
      ) : null}
    </div>
  )
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-3 py-3 sm:px-5">
      <dt className="text-xs text-ink-3">{rotulo}</dt>
      <dd className="truncate text-sm font-semibold tabular">{valor}</dd>
      {detalhe ? <dd className="truncate text-xs text-ink-3">{detalhe}</dd> : null}
    </div>
  )
}
