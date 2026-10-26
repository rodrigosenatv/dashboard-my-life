"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import * as React from "react"
import { ChevronRight } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Etiqueta, Secao } from "@/components/ui/basicos"
import { Confirmar, Janela } from "@/components/ui/janela"
import { useExcluir } from "@/lib/data"
import { dataRelativa, formatar, plural } from "@/lib/utils"
import type { Colecao } from "@/features/colecoes/visao-colecao"
import { kg } from "./dados"
import { marcaTexto, rotuloDaFicha, useHistoricoTreino, type SerieFeita, type SessaoSalva } from "./sessao"

const MOSTRAR = 5

/** Os treinos registrados, do mais novo ao mais antigo; tocar abre as séries de cada um. */
export function HistoricoTreinos({ historico }: { historico: Colecao | undefined }) {
  const { sessoes, carregando } = useHistoricoTreino(historico)
  const excluir = useExcluir("collection_items")
  const [aberta, setAberta] = React.useState<SessaoSalva | null>(null)
  const [apagar, setApagar] = React.useState(false)
  const [todas, setTodas] = React.useState(false)

  // Antes do primeiro treino registrado a seção não aparece: o cartão Hoje já leva a começar
  if (!historico || carregando || !sessoes.length) return null
  const recentes = [...sessoes].reverse()
  const mostradas = todas ? recentes : recentes.slice(0, MOSTRAR)

  return (
    <Secao
      titulo="Histórico"
      acao={
        <Link href={`/colecoes/${historico.id}`} className="text-sm text-ink-2 hover:text-ink">
          Tabela
        </Link>
      }
    >
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {mostradas.map((s) => (
          <li key={s.item.id}>
            <button type="button" onClick={() => setAberta(s)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60 toque:min-h-14">
              <span className="min-w-0 flex-1">
                <span className="block font-medium first-letter:uppercase">
                  {dataRelativa(s.data)} · {rotuloDaFicha(s.ficha)}
                </span>
                <span className="block text-xs text-ink-3">{resumoDe(s)}</span>
              </span>
              {s.dificuldade ? <Etiqueta>{s.dificuldade}</Etiqueta> : null}
              <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {recentes.length > MOSTRAR ? (
        <button type="button" onClick={() => setTodas(!todas)} className="mt-2 text-sm font-medium text-pen hover:underline">
          {todas ? "Mostrar menos" : `Ver todos os ${recentes.length}`}
        </button>
      ) : null}

      <Janela
        aberta={Boolean(aberta)}
        aoMudar={(v) => !v && setAberta(null)}
        titulo={aberta ? rotuloDaFicha(aberta.ficha) : "Treino"}
        descricao={aberta ? `${formatar(aberta.data, "EEEE, d 'de' MMMM")} · ${resumoDe(aberta)}` : undefined}
        rodape={
          <>
            <Botao variante="fantasma" className="mr-auto text-danger hover:text-danger" onClick={() => setApagar(true)}>
              Excluir
            </Botao>
            <Botao variante="secundario" onClick={() => setAberta(null)}>
              Fechar
            </Botao>
          </>
        }
      >
        {aberta ? <DetalheTreino sessao={aberta} /> : null}
      </Janela>
      <Confirmar
        aberta={apagar}
        aoMudar={setApagar}
        titulo="Excluir este treino?"
        descricao="As séries registradas nele se perdem. A marcação do hábito Treino continua."
        aoConfirmar={() => {
          if (aberta) excluir.mutate(aberta.item.id)
          setAberta(null)
        }}
      />
    </Secao>
  )
}

function resumoDe(s: SessaoSalva): string {
  return [s.duracao ? `${s.duracao} min` : "", plural(s.series.length, "série"), s.volume ? kg(Math.round(s.volume)) : ""].filter(Boolean).join(" · ")
}

/** As séries do treino, agrupadas por exercício, na ordem em que foram feitas. */
function DetalheTreino({ sessao }: { sessao: SessaoSalva }) {
  const grupos: { chave: string; nome: string; series: SerieFeita[] }[] = []
  for (const s of sessao.series) {
    const chave = s.exercicio || s.nome
    const g = grupos.find((x) => x.chave === chave)
    if (g) g.series.push(s)
    else grupos.push({ chave, nome: s.nome || "Exercício", series: [s] })
  }
  return (
    <div className="grid gap-4">
      {sessao.dificuldade ? <p className="text-sm text-ink-2">Dificuldade: {sessao.dificuldade}</p> : null}
      <ol className="grid gap-3">
        {grupos.map((g) => (
          <li key={g.chave}>
            <p className="font-medium">{g.nome}</p>
            <p className="text-sm text-ink-2 tabular">{g.series.map(marcaTexto).join(" · ")}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
