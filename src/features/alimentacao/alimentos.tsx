"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import * as React from "react"
import { Botao } from "@/components/ui/button"
import { Esqueleto } from "@/components/ui/basicos"
import { Janela } from "@/components/ui/janela"
import { normalizar, numero, numeroFlexivel } from "@/lib/utils"
import { esquema, type Colecao } from "@/features/colecoes/visao-colecao"
import { useItensDe, valores } from "@/features/treino/dados"

/** Nome real da coluna (no Notion pode vir "Proteína", "Proteinas (g)"…). */
function coluna(c: Colecao | undefined, chaves: Set<string>, comeco: string) {
  return [...new Set([...esquema(c).map((p) => p.name), ...chaves])].find((n) => normalizar(n).startsWith(comeco))
}

/**
 * A tabela de alimentos com as calorias calculadas na hora (4 kcal por grama de
 * carboidrato e de proteína, 9 por grama de gordura), como a fórmula que existia no Notion.
 */
export function TabelaAlimentos({ aberta, aoMudar, colecao }: { aberta: boolean; aoMudar: (v: boolean) => void; colecao: Colecao | undefined }) {
  const { data: itens = [], isLoading } = useItensDe(aberta ? colecao : undefined)
  const linhas = React.useMemo(() => {
    const chaves = new Set(itens.flatMap((i) => Object.keys(valores(i))))
    const nomes = { c: coluna(colecao, chaves, "carbo"), p: coluna(colecao, chaves, "prote"), g: coluna(colecao, chaves, "gordu") }
    return itens
      .map((i) => {
        const v = valores(i)
        const c = nomes.c ? numeroFlexivel(v[nomes.c]) : null
        const p = nomes.p ? numeroFlexivel(v[nomes.p]) : null
        const g = nomes.g ? numeroFlexivel(v[nomes.g]) : null
        const kcal = c === null && p === null && g === null ? null : 4 * (c ?? 0) + 4 * (p ?? 0) + 9 * (g ?? 0)
        return { id: i.id, nome: i.title.trim() || "Sem nome", c, p, g, kcal }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  }, [itens, colecao])
  const soma = (k: "c" | "p" | "g" | "kcal") => linhas.reduce((t, l) => t + (l[k] ?? 0), 0)
  const celula = (n: number | null, casas = 1) => (n === null ? <span className="text-ink-3">–</span> : numero(n, casas))

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo="Tabela de alimentos"
      descricao="Por porção, como você cadastrou. Calorias calculadas: 4 kcal por grama de carboidrato e de proteína, 9 por grama de gordura."
      largura="lg"
      rodape={
        <>
          {colecao ? (
            <Botao asChild variante="fantasma" className="mr-auto">
              <Link href={`/colecoes/${colecao.id}`}>Editar em Coleções</Link>
            </Botao>
          ) : null}
          <Botao variante="primario" onClick={() => aoMudar(false)}>
            Fechar
          </Botao>
        </>
      }
    >
      {!colecao ? (
        <p className="text-sm text-ink-2">Não há tabela de alimentos. Ela vem da importação do Notion ou pode ser criada em Coleções.</p>
      ) : isLoading ? (
        <Esqueleto className="h-48" />
      ) : (
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th className="py-2 pr-3 font-medium">Alimento</th>
                <th className="px-2 py-2 text-right font-medium">Carbo (g)</th>
                <th className="px-2 py-2 text-right font-medium">Proteína (g)</th>
                <th className="px-2 py-2 text-right font-medium">Gordura (g)</th>
                <th className="py-2 pl-2 text-right font-medium">kcal</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 font-medium">{l.nome}</td>
                  <td className="tabular px-2 py-2 text-right text-ink-2">{celula(l.c)}</td>
                  <td className="tabular px-2 py-2 text-right text-ink-2">{celula(l.p)}</td>
                  <td className="tabular px-2 py-2 text-right text-ink-2">{celula(l.g)}</td>
                  <td className="tabular py-2 pl-2 text-right font-medium">{celula(l.kcal, 0)}</td>
                </tr>
              ))}
            </tbody>
            {linhas.length > 1 ? (
              <tfoot>
                <tr className="border-t border-line-strong text-xs text-ink-3">
                  <td className="py-2 pr-3">Soma</td>
                  <td className="tabular px-2 py-2 text-right">{numero(soma("c"), 1)}</td>
                  <td className="tabular px-2 py-2 text-right">{numero(soma("p"), 1)}</td>
                  <td className="tabular px-2 py-2 text-right">{numero(soma("g"), 1)}</td>
                  <td className="tabular py-2 pl-2 text-right">{numero(soma("kcal"), 0)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </Janela>
  )
}
