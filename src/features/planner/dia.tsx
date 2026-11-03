"use client"

import * as React from "react"
import { CalendarPlus, Plus } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Janela } from "@/components/ui/janela"
import { ORDEM_ETAPAS, type Etapa } from "@/features/conteudo/logica"
import { STATUS_CONTEUDO, type StatusConteudo } from "@/lib/rotulos"
import { formatar } from "@/lib/utils"
import { etapaDe, type Conteudo } from "./ui"

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

function Ponto({ status }: { status: string }) {
  return <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: etapaDe(status).cor }} />
}

/**
 * Um dia do planner: o que já cai nele e, nos dias que ainda vêm, os conteúdos da esteira sem data para
 * agendar ali com um toque (os prontos primeiro).
 */
export function JanelaDia({
  dia,
  hoje,
  itens,
  aoFechar,
  aoAbrir,
  aoAgendar,
  aoNovo,
}: {
  dia: string | null
  hoje: string
  itens: Conteudo[]
  aoFechar: () => void
  aoAbrir: (c: Conteudo) => void
  aoAgendar: (c: Conteudo, dia: string) => void
  aoNovo: (dia: string, status: StatusConteudo) => void
}) {
  if (!dia) return null
  const passou = dia < hoje
  const doDia = itens
    .filter((i) => i.publish_date === dia)
    .sort((a, b) => ORDEM_ETAPAS.indexOf(b.status as Etapa) - ORDEM_ETAPAS.indexOf(a.status as Etapa))
  const semData = passou
    ? []
    : itens
        .filter((i) => !i.publish_date && i.status !== "ideia" && i.status !== "publicado")
        .sort((a, b) => ORDEM_ETAPAS.indexOf(b.status as Etapa) - ORDEM_ETAPAS.indexOf(a.status as Etapa) || a.title.localeCompare(b.title))
  const nome = maiuscula(formatar(dia, "EEEE, d 'de' MMMM"))

  return (
    <Janela
      aberta
      aoMudar={(v) => {
        if (!v) aoFechar()
      }}
      titulo={nome}
      descricao={dia === hoje ? "Hoje" : passou ? "Este dia já passou" : undefined}
      rodape={
        <Botao variante="primario" onClick={() => aoNovo(dia, passou ? "publicado" : "idealizando")}>
          <Plus /> {passou ? "Registrar um publicado" : "Novo conteúdo neste dia"}
        </Botao>
      }
    >
      <section aria-labelledby="dia-neste" className="grid gap-1.5">
        <h3 id="dia-neste" className="rotulo-hud">
          Neste dia
        </h3>
        {doDia.length ? (
          <ul className="grid gap-0.5">
            {doDia.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => aoAbrir(c)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-ink/[0.05]">
                  <Ponto status={c.status} />
                  <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
                  <span className="shrink-0 text-xs text-ink-3">{c.status !== "publicado" && passou ? "Não saiu" : STATUS_CONTEUDO[c.status as StatusConteudo]}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 py-2 text-sm text-ink-2">{passou ? "Nada saiu neste dia." : "Nada marcado ainda."}</p>
        )}
      </section>

      {passou ? null : (
        <section aria-labelledby="dia-agendar" className="mt-5 grid gap-1.5">
          <h3 id="dia-agendar" className="rotulo-hud">
            Agendar neste dia
          </h3>
          {semData.length ? (
            <ul className="grid gap-0.5">
              {semData.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => aoAgendar(c, dia)}
                    aria-label={`Agendar ${c.title} para ${nome}`}
                    className="group flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-ink/[0.05]"
                  >
                    <Ponto status={c.status} />
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <span className="shrink-0 text-xs text-ink-3">{STATUS_CONTEUDO[c.status as StatusConteudo]}</span>
                    <CalendarPlus className="size-4 shrink-0 text-ink-3 group-hover:text-[var(--b-luz)]" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-2 text-sm text-ink-2">Tudo na esteira já tem data. Crie um conteúdo novo para este dia.</p>
          )}
        </section>
      )}
    </Janela>
  )
}
