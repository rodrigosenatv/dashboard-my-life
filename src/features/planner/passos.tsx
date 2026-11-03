"use client"

import * as React from "react"
import { ArrowRight, BatteryLow, CalendarPlus, ChartColumn, CheckCheck, ListChecks, Radio, TriangleAlert, type LucideIcon } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { TituloPainel } from "@/features/conteudo/moldura"
import type { Passo } from "@/features/conteudo/logica"
import { STATUS_CONTEUDO, type StatusConteudo } from "@/lib/rotulos"
import { dataRelativa, plural } from "@/lib/utils"
import { ETAPA, type Conteudo } from "./ui"

const VISIVEIS = 4

type Linha = {
  chave: string
  icone: LucideIcon
  cor: string
  titulo: string
  detalhe: string
  item?: Conteudo
  acao: { rotulo: React.ReactNode; aria?: string; principal?: boolean; fazer: () => void }
}

const etapa = (s: string) => STATUS_CONTEUDO[s as StatusConteudo] ?? s

/**
 * Os próximos passos: o que fazer agora, do mais urgente ao menos (publicar o que está pronto, o que
 * atrasou, o que sai em breve, o que não tem data, a reserva e os números a registrar), cada um com a
 * ação ali mesmo.
 */
export function ProximosPassos({
  passos,
  itens,
  hoje,
  aoAbrir,
  aoPublicar,
  aoAvancar,
  aoVer,
}: {
  passos: Passo[]
  itens: Conteudo[]
  hoje: string
  aoAbrir: (c: Conteudo) => void
  aoPublicar: (c: Conteudo) => void
  aoAvancar: (c: Conteudo) => void
  aoVer: (visao: "ideias" | "quadro") => void
}) {
  const [todos, setTodos] = React.useState(false)
  const porId = new Map(itens.map((i) => [i.id, i]))

  const linhas: Linha[] = []
  for (const p of passos) {
    if (p.tipo === "reserva") {
      linhas.push({
        chave: "reserva",
        icone: BatteryLow,
        cor: "var(--b-ambar)",
        titulo: p.emProducao || p.ideias ? "Reserva baixa" : "Banco de ideias vazio",
        detalhe: p.emProducao
          ? `${plural(p.emProducao, "conteúdo")} em produção: avance em lote até ter ${plural(p.faltam, "pronto")} a mais.`
          : p.ideias
            ? `Escolha ${p.faltam === 1 ? "1 ideia" : `${p.faltam} ideias`} do banco para produzir.`
            : "Anote ideias soltas, mesmo pela metade: perguntas dos comentários rendem bons posts.",
        acao: { rotulo: p.emProducao ? "Ver quadro" : "Ver ideias", fazer: () => aoVer(p.emProducao ? "quadro" : "ideias") },
      })
      continue
    }
    const item = porId.get(p.id)
    if (!item) continue
    const formato = item.format ? ` · ${item.format}` : ""
    if (p.tipo === "publicar")
      linhas.push({
        chave: `publicar-${item.id}`,
        icone: Radio,
        cor: "var(--b-verde)",
        titulo: p.dia === hoje ? "Publicar hoje" : `Era para ${dataRelativa(p.dia)}: está pronto`,
        detalhe: `${item.title}${formato}`,
        item,
        acao: { rotulo: "Publiquei", principal: true, aria: `Marcar ${item.title} como publicado`, fazer: () => aoPublicar(item) },
      })
    else if (p.tipo === "atrasado")
      linhas.push({
        chave: `atrasado-${item.id}`,
        icone: TriangleAlert,
        cor: "var(--danger)",
        titulo: `Atrasado desde ${dataRelativa(p.dia)}`,
        detalhe: `${item.title} · em ${etapa(item.status)}`,
        item,
        acao: { rotulo: "Reagendar", aria: `Reagendar ${item.title}`, fazer: () => aoAbrir(item) },
      })
    else if (p.tipo === "prazo") {
      const Icone = ETAPA[p.proxima as StatusConteudo]?.icone ?? ArrowRight
      linhas.push({
        chave: `prazo-${item.id}`,
        icone: Icone,
        cor: ETAPA[p.proxima as StatusConteudo]?.cor ?? "var(--b-luz)",
        titulo: `Sai ${dataRelativa(p.dia)} e está em ${etapa(item.status)}`,
        detalhe: `${item.title}${formato}`,
        item,
        acao: {
          rotulo: (
            <>
              {etapa(p.proxima)} <ArrowRight />
            </>
          ),
          aria: `Avançar ${item.title} para ${etapa(p.proxima)}`,
          fazer: () => aoAvancar(item),
        },
      })
    } else if (p.tipo === "agendar")
      linhas.push({
        chave: `agendar-${item.id}`,
        icone: CalendarPlus,
        cor: "var(--b-luz-2)",
        titulo: "Pronto, sem data",
        detalhe: `${item.title}${formato}`,
        item,
        acao: { rotulo: "Agendar", aria: `Agendar ${item.title}`, fazer: () => aoAbrir(item) },
      })
    else if (p.tipo === "numeros")
      linhas.push({
        chave: "numeros",
        icone: ChartColumn,
        cor: "var(--b-violeta)",
        titulo: p.total > 1 ? `Registre os números de ${p.total} posts` : "Registre os números",
        detalhe: `${item.title} · publicado ${dataRelativa(p.dia)}`,
        item,
        acao: { rotulo: "Registrar", aria: `Registrar os números de ${item.title}`, fazer: () => aoAbrir(item) },
      })
  }

  const mostrar = todos ? linhas : linhas.slice(0, VISIVEIS)
  return (
    <section aria-labelledby="titulo-passos" className="vidro min-w-0 p-4 sm:p-5">
      <TituloPainel id="titulo-passos" icone={ListChecks} titulo="Próximos passos" cor="var(--b-luz-2)" extra={linhas.length ? <span className="tabular text-ink-3">{linhas.length}</span> : null} />
      {linhas.length === 0 ? (
        <div className="flex items-start gap-3 py-2">
          <span className="icone-aceso size-9" style={{ "--cor": "var(--b-verde)" } as React.CSSProperties} aria-hidden>
            <CheckCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Tudo em dia.</p>
            <p className="text-sm text-ink-2">Nada atrasado e a reserva cobre a semana. Boa hora para anotar ideias novas.</p>
            <Botao variante="contorno" tamanho="sm" className="mt-2 rounded-full" onClick={() => aoVer("ideias")}>
              Ver ideias
            </Botao>
          </div>
        </div>
      ) : (
        <>
          <ul className="-my-1 divide-y divide-[var(--b-borda)]">
            {mostrar.map((l) => {
              const Icone = l.icone
              const texto = (
                <>
                  <span className="block text-sm font-medium leading-snug first-letter:uppercase">{l.titulo}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-ink-3">{l.detalhe}</span>
                </>
              )
              return (
                <li key={l.chave} className="flex items-center gap-3 py-2.5">
                  <span className="icone-aceso size-9" style={{ "--cor": l.cor } as React.CSSProperties} aria-hidden>
                    <Icone className="size-4" />
                  </span>
                  {l.item ? (
                    <button type="button" onClick={() => aoAbrir(l.item!)} className="min-w-0 flex-1 rounded-md py-0.5 text-left hover:text-[var(--b-luz)]">
                      {texto}
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1">{texto}</div>
                  )}
                  <Botao
                    variante={l.acao.principal ? "primario" : "contorno"}
                    tamanho="sm"
                    className="shrink-0 rounded-full"
                    aria-label={l.acao.aria}
                    onClick={l.acao.fazer}
                  >
                    {l.acao.rotulo}
                  </Botao>
                </li>
              )
            })}
          </ul>
          {linhas.length > VISIVEIS ? (
            <button type="button" onClick={() => setTodos((v) => !v)} aria-expanded={todos} className="mt-2 min-h-10 rounded-full px-2 text-sm font-medium text-ink-2 hover:text-ink">
              {todos ? "Mostrar menos" : `Mostrar mais ${linhas.length - VISIVEIS}`}
            </button>
          ) : null}
        </>
      )}
    </section>
  )
}
