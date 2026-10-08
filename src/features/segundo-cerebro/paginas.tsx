"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import * as React from "react"
import { ArrowLeft, FolderKanban, Pencil, Plus } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Etiqueta, Progresso, Secao, Segmentos, Vazio } from "@/components/ui/basicos"
import { useAtualizar, useLista } from "@/lib/data"
import { STATUS_AREA } from "@/lib/rotulos"
import { cn, porcentagem } from "@/lib/utils"
import { ListaCapturas } from "@/features/capturas/lista-capturas"
import { DialogoArea } from "@/features/projetos/pagina-projetos"
import { progresso, useAreas, useProjetos, type AreaPara } from "@/features/projetos/dados"

/* ------------------------------------------------------------------ */
/* Caixa de entrada, Anotações, Recursos                               */
/* ------------------------------------------------------------------ */

export function PaginaEntrada() {
  return (
    <div>
      <Cabecalho
        area="projetos"
        titulo="Caixa de Entrada"
        descricao="Capturas que ainda não têm área, projeto nem tipo. Preencher qualquer um deles já tira o item da fila."
      />
      <ListaCapturas modo="entrada" />
    </div>
  )
}

export function PaginaAnotacoes() {
  return (
    <div>
      <Cabecalho area="projetos" titulo="Anotações" descricao="Todas as capturas ativas: ideias, citações, metodologias, vídeos e links." />
      <ListaCapturas modo="anotacoes" agrupamentos={["nenhum", "tag", "tipo", "categoria"]} />
    </div>
  )
}

export function PaginaRecursos() {
  return (
    <div>
      <Cabecalho
        area="projetos"
        titulo="Recursos"
        descricao="Anotações que não estão ligadas a projetos nem a áreas e não foram arquivadas: material de consulta."
      />
      <ListaCapturas modo="recursos" agrupamentos={["tag", "categoria", "nenhum"]} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Arquivo                                                             */
/* ------------------------------------------------------------------ */

type AbaArquivo = "capturas" | "projetos" | "areas"

export function PaginaArquivo() {
  const [aba, setAba] = React.useState<AbaArquivo>("capturas")
  const { data: projetos = [] } = useProjetos()
  const { data: areas = [] } = useAreas()
  const { data: capturas = [] } = useLista("captures", { colunas: "id,archived", chave: ["contagem-arquivo"] })
  const atualizarProjeto = useAtualizar("projects")
  const atualizarArea = useAtualizar("areas")
  const projetosArq = projetos.filter((p) => !p.parent_id && p.archived)
  const areasArq = areas.filter((a) => a.status === "arquivada")

  return (
    <div>
      <Cabecalho area="projetos" titulo="Arquivo" descricao="O que já saiu de cena: capturas, projetos e áreas arquivados. Nada se perde, e tudo pode voltar." />
      <Segmentos
        rotulo="O que ver no arquivo"
        className="mb-6"
        valor={aba}
        aoMudar={setAba}
        opcoes={[
          { valor: "capturas", rotulo: "Capturas", contagem: capturas.filter((c) => c.archived).length },
          { valor: "projetos", rotulo: "Projetos", contagem: projetosArq.length },
          { valor: "areas", rotulo: "Áreas", contagem: areasArq.length },
        ]}
      />
      {aba === "capturas" ? (
        <ListaCapturas modo="arquivo" agrupamentos={["mes", "tag", "nenhum"]} />
      ) : aba === "projetos" ? (
        projetosArq.length === 0 ? (
          <Vazio titulo="Nenhum projeto arquivado." />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {projetosArq.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <Link href={`/projetos/${p.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                  {p.name}
                </Link>
                {p.done ? <Etiqueta cor="rotina">Finalizado</Etiqueta> : null}
                <Botao variante="fantasma" tamanho="sm" onClick={() => atualizarProjeto.mutate({ id: p.id, archived: false })}>
                  Restaurar
                </Botao>
              </li>
            ))}
          </ul>
        )
      ) : areasArq.length === 0 ? (
        <Vazio titulo="Nenhuma área arquivada." />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {areasArq.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
              <Link href={`/projetos/areas/${a.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {a.name}
              </Link>
              <Botao variante="fantasma" tamanho="sm" onClick={() => atualizarArea.mutate({ id: a.id, status: "ativa" })}>
                Restaurar
              </Botao>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Áreas                                                               */
/* ------------------------------------------------------------------ */

const corStatus: Record<string, string> = {
  ativa: "text-pen",
  nao_iniciada: "text-ink-3",
  arquivada: "text-rotina",
}

function useContagensArea() {
  const { data: capturas = [] } = useLista("captures", { colunas: "id,area_id,archived", chave: ["por-area"] })
  const { data: projetos = [] } = useProjetos()
  return React.useCallback(
    (id: string) => ({
      capturas: capturas.filter((c) => c.area_id === id && !c.archived).length,
      projetos: projetos.filter((p) => !p.parent_id && p.area_id === id && !p.archived && !p.done).length,
    }),
    [capturas, projetos],
  )
}

export function PaginaAreas() {
  const { data: areas = [], isLoading } = useAreas()
  const contar = useContagensArea()
  const [nova, setNova] = React.useState(false)
  const [editar, setEditar] = React.useState<AreaPara | null>(null)
  const [verArquivadas, setVerArquivadas] = React.useState(false)
  const visiveis = areas.filter((a) => (verArquivadas ? a.status === "arquivada" : a.status !== "arquivada"))
  const ordem = { ativa: 0, nao_iniciada: 1, arquivada: 2 } as Record<string, number>

  return (
    <div>
      <Cabecalho
        area="projetos"
        titulo="Áreas"
        descricao="Responsabilidades contínuas, sem data para acabar. Cada área reúne as capturas e os projetos ligados a ela."
        acoes={
          <Botao variante="primario" onClick={() => setNova(true)}>
            <Plus /> Nova área
          </Botao>
        }
      />
      <Segmentos
        rotulo="Situação das áreas"
        className="mb-6"
        valor={verArquivadas ? "arq" : "ativas"}
        aoMudar={(v) => setVerArquivadas(v === "arq")}
        opcoes={[
          { valor: "ativas", rotulo: "Ativas", contagem: areas.filter((a) => a.status !== "arquivada").length },
          { valor: "arq", rotulo: "Arquivadas", contagem: areas.filter((a) => a.status === "arquivada").length },
        ]}
      />
      {isLoading ? (
        <Carregando />
      ) : visiveis.length === 0 ? (
        <Vazio titulo={verArquivadas ? "Nenhuma área arquivada." : "Nenhuma área ainda."} descricao={verArquivadas ? undefined : "Crie áreas como Saúde, Finanças ou Espiritual."} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...visiveis]
            .sort((a, b) => (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9) || a.name.localeCompare(b.name))
            .map((a) => {
              const n = contar(a.id)
              return (
                <li key={a.id} className="group relative">
                  <Link href={`/projetos/areas/${a.id}`} className="flex h-full flex-col rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong">
                    <p className="pr-6 font-display text-lg font-semibold leading-tight">{a.name}</p>
                    <p className={cn("mt-1 text-xs font-medium", corStatus[a.status])}>{STATUS_AREA[a.status as keyof typeof STATUS_AREA] ?? a.status}</p>
                    <p className="mt-auto pt-5 text-sm text-ink-2">
                      <span className="tabular font-medium text-ink">{n.capturas}</span> {n.capturas === 1 ? "captura" : "capturas"}
                      {n.projetos ? (
                        <>
                          <span className="text-ink-3">, </span>
                          <span className="tabular font-medium text-ink">{n.projetos}</span> {n.projetos === 1 ? "projeto" : "projetos"}
                        </>
                      ) : null}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setEditar(a)}
                    aria-label={`Editar ${a.name}`}
                    className="absolute right-2 top-2 rounded-md p-1.5 text-ink-3 opacity-0 hover:bg-surface-2 hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </li>
              )
            })}
        </ul>
      )}
      <DialogoArea
        aberta={nova || Boolean(editar)}
        aoMudar={(v) => {
          if (!v) {
            setNova(false)
            setEditar(null)
          }
        }}
        area={editar}
      />
    </div>
  )
}

export function PaginaArea() {
  const { id } = useParams<{ id: string }>()
  const { data: areas = [], isLoading } = useAreas()
  const { data: projetos = [] } = useProjetos()
  const atualizar = useAtualizar("areas")
  const [editar, setEditar] = React.useState(false)
  const area = areas.find((a) => a.id === id)

  if (isLoading) return <Carregando />
  if (!area)
    return (
      <Vazio
        titulo="Área não encontrada."
        acao={
          <Link href="/projetos/areas" className="text-sm font-medium text-pen hover:underline">
            Voltar para Áreas
          </Link>
        }
      />
    )

  const projetosArea = projetos.filter((p) => !p.parent_id && p.area_id === area.id && !p.archived)

  return (
    <div>
      <Link href="/projetos/areas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" /> Áreas
      </Link>
      <Cabecalho
        area="projetos"
        titulo={area.name}
        descricao={area.description ?? undefined}
        acoes={
          <div className="flex items-center gap-2">
            <Segmentos
              rotulo="Situação da área"
              valor={area.status}
              aoMudar={(v) => atualizar.mutate({ id: area.id, status: v })}
              opcoes={Object.entries(STATUS_AREA).map(([valor, rotulo]) => ({ valor, rotulo }))}
            />
            <Botao variante="contorno" tamanho="icone-sm" aria-label="Editar área" onClick={() => setEditar(true)}>
              <Pencil />
            </Botao>
          </div>
        }
      />
      {projetosArea.length ? (
        <Secao titulo="Projetos da área" className="mb-10">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projetosArea.map((p) => {
              const pr = progresso(p.id, projetos)
              return (
                <li key={p.id}>
                  <Link href={`/projetos/${p.id}`} className="block rounded-lg border border-line bg-surface p-3.5 hover:border-line-strong">
                    <p className="flex items-center gap-2 font-medium">
                      <FolderKanban className="size-4 text-projetos" /> {p.name}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Progresso valor={p.done ? 100 : porcentagem(pr.feitos, pr.total)} cor="projetos" rotulo={`Progresso de ${p.name}`} />
                      <span className="tabular shrink-0 text-xs text-ink-3">{pr.total ? `${pr.feitos}/${pr.total}` : ""}</span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Secao>
      ) : null}
      <Secao titulo="Capturas da área">
        <ListaCapturas modo={{ area: area.id }} agrupamentos={["nenhum", "tag", "tipo"]} />
      </Secao>
      <DialogoArea aberta={editar} aoMudar={setEditar} area={area} />
    </div>
  )
}
