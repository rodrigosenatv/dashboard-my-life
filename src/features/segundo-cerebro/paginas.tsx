"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import * as React from "react"
import { isThisWeek, isToday } from "date-fns"
import { Archive, ArchiveRestore, Boxes, ChevronRight, FolderKanban, Inbox, NotebookPen, Pencil, Plus, Shapes } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Carregando, Etiqueta, Segmentos } from "@/components/ui/basicos"
import { useAtualizar, useLista } from "@/lib/data"
import { STATUS_AREA } from "@/lib/rotulos"
import { cn, plural, porcentagem } from "@/lib/utils"
import { ListaCapturas } from "@/features/capturas/lista-capturas"
import { ACAO_ACESA, CabecalhoCerebro, MolduraCerebro, type ItemHud } from "./cabecalho"
import { ChipPrazo, textoEtapas, VazioCerebro } from "./ui"
import { diasNaFila } from "./logica"
import { DialogoArea } from "@/features/projetos/pagina-projetos"
import { progresso, useAreas, useProjetos, type AreaPara } from "@/features/projetos/dados"

/* ------------------------------------------------------------------ */
/* Caixa de entrada, Anotações, Recursos                               */
/* ------------------------------------------------------------------ */

function BotaoNovaCaptura({ aoClicar }: { aoClicar: () => void }) {
  return (
    <Botao variante="primario" tamanho="lg" onClick={aoClicar} className={cn("rounded-full px-5", ACAO_ACESA)}>
      <Plus /> Nova captura
    </Botao>
  )
}

export function PaginaEntrada() {
  return (
    <MolduraCerebro>
      <ListaCapturas
        modo="entrada"
        cabecalho={({ novaCaptura, capturas, carregando }) => {
          const hoje = capturas.filter((c) => isToday(new Date(c.captured_at))).length
          const espera = diasNaFila(capturas.map((c) => c.captured_at), new Date())
          const hud: ItemHud[] = carregando
            ? []
            : capturas.length
              ? [
                  { n: capturas.length, rotulo: "para organizar", cor: "var(--b-luz)" },
                  ...(hoje ? [{ n: hoje, rotulo: hoje === 1 ? "chegou hoje" : "chegaram hoje" }] : []),
                  ...(espera >= 2 ? [{ n: espera, rotulo: "dias na fila", cor: espera >= 7 ? "var(--b-rosa)" : "var(--b-ambar)" }] : []),
                ]
              : [{ n: "✓", rotulo: "tudo organizado", cor: "var(--b-menta)" }]
          return (
            <CabecalhoCerebro
              icone={Inbox}
              papel="Captura e triagem"
              titulo="Caixa de entrada"
              descricao="Suas ideias começam aqui. Revise as capturas e encaminhe cada uma para um projeto, uma área ou os recursos."
              descricaoNoCelular={!capturas.length}
              acoes={<BotaoNovaCaptura aoClicar={novaCaptura} />}
              hud={hud}
            />
          )
        }}
      />
    </MolduraCerebro>
  )
}

export function PaginaAnotacoes() {
  return (
    <MolduraCerebro>
      <ListaCapturas
        modo="anotacoes"
        agrupamentos={["nenhum", "tag", "tipo", "categoria"]}
        cabecalho={({ novaCaptura, capturas, carregando }) => {
          const semana = capturas.filter((c) => isThisWeek(new Date(c.captured_at), { weekStartsOn: 0 })).length
          const ideias = capturas.filter((c) => c.kind === "Ideia").length
          return (
            <CabecalhoCerebro
              icone={NotebookPen}
              papel="Tudo o que você guardou"
              titulo="Anotações"
              descricao="Ideias, reflexões, referências e conteúdos que valem guardar, num lugar só."
              descricaoNoCelular={!capturas.length}
              acoes={<BotaoNovaCaptura aoClicar={novaCaptura} />}
              hud={
                carregando || !capturas.length
                  ? []
                  : [
                      { n: capturas.length, rotulo: capturas.length === 1 ? "anotação" : "anotações", cor: "var(--b-luz)" },
                      ...(semana ? [{ n: semana, rotulo: "nesta semana" }] : []),
                      ...(ideias ? [{ n: ideias, rotulo: ideias === 1 ? "ideia" : "ideias", cor: "var(--b-ambar)" }] : []),
                    ]
              }
            />
          )
        }}
      />
    </MolduraCerebro>
  )
}

export function PaginaRecursos() {
  return (
    <MolduraCerebro>
      <ListaCapturas
        modo="recursos"
        agrupamentos={["tag", "categoria", "nenhum"]}
        cabecalho={({ novaCaptura, capturas, carregando }) => {
          const tags = new Set(capturas.flatMap((c) => c.tags)).size
          const links = capturas.filter((c) => c.url).length
          return (
            <CabecalhoCerebro
              icone={Boxes}
              papel="Referências para consultar"
              titulo="Recursos"
              descricao="Sua biblioteca de referências avulsas (sem projeto e sem área), pronta para consultar e virar ação quando precisar."
              descricaoNoCelular={!capturas.length}
              acoes={<BotaoNovaCaptura aoClicar={novaCaptura} />}
              hud={
                carregando || !capturas.length
                  ? []
                  : [
                      { n: capturas.length, rotulo: capturas.length === 1 ? "recurso" : "recursos", cor: "var(--b-luz)" },
                      ...(tags ? [{ n: tags, rotulo: tags === 1 ? "tag" : "tags" }] : []),
                      ...(links ? [{ n: links, rotulo: links === 1 ? "link" : "links", cor: "var(--b-luz-2)" }] : []),
                    ]
              }
            />
          )
        }}
      />
    </MolduraCerebro>
  )
}

/* ------------------------------------------------------------------ */
/* Arquivo                                                             */
/* ------------------------------------------------------------------ */

type AbaArquivo = "capturas" | "projetos" | "areas"

/** Uma linha do arquivo: o nome (que abre) e o botão de restaurar. */
function LinhaArquivada({ href, nome, icone: Icone, etiqueta, aoRestaurar, ocupado }: { href: string; nome: string; icone: typeof FolderKanban; etiqueta?: React.ReactNode; aoRestaurar: () => void; ocupado: boolean }) {
  return (
    <li className="vidro-vivo flex flex-wrap items-center gap-3 px-3.5 py-3 sm:flex-nowrap sm:px-4">
      <span aria-hidden className="icone-aceso size-9 opacity-80">
        <Icone className="size-4" />
      </span>
      <Link href={href} className="min-w-0 flex-1 break-words font-medium hover:text-[var(--b-luz)]">
        {nome}
      </Link>
      {etiqueta}
      <Botao variante="contorno" tamanho="sm" className="ml-auto rounded-full bg-transparent" disabled={ocupado} onClick={aoRestaurar}>
        <ArchiveRestore /> Restaurar
      </Botao>
    </li>
  )
}

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
    <MolduraCerebro>
      <CabecalhoCerebro
        icone={Archive}
        papel="Fora de foco"
        titulo="Arquivo"
        descricao="Um lugar tranquilo para o que saiu de foco. Nada se perde: revise e restaure quando quiser."
        descricaoNoCelular={false}
      />
      <Segmentos
        rotulo="O que ver no arquivo"
        className="mb-6 w-full bg-black/25 sm:w-auto"
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
          <VazioCerebro icone={FolderKanban} titulo="Nenhum projeto arquivado." descricao="Projetos arquivados saem da lista, mas continuam aqui com etapas e anotações." />
        ) : (
          <ul className="grid gap-2">
            {projetosArq.map((p) => (
              <LinhaArquivada
                key={p.id}
                href={`/projetos/${p.id}`}
                nome={p.name}
                icone={FolderKanban}
                etiqueta={p.done ? <Etiqueta cor="rotina">Finalizado</Etiqueta> : null}
                ocupado={atualizarProjeto.isPending}
                aoRestaurar={() => atualizarProjeto.mutate({ id: p.id, archived: false })}
              />
            ))}
          </ul>
        )
      ) : areasArq.length === 0 ? (
        <VazioCerebro icone={Shapes} titulo="Nenhuma área arquivada." />
      ) : (
        <ul className="grid gap-2">
          {areasArq.map((a) => (
            <LinhaArquivada
              key={a.id}
              href={`/projetos/areas/${a.id}`}
              nome={a.name}
              icone={Shapes}
              ocupado={atualizarArea.isPending}
              aoRestaurar={() => atualizarArea.mutate({ id: a.id, status: "ativa" })}
            />
          ))}
        </ul>
      )}
    </MolduraCerebro>
  )
}

/* ------------------------------------------------------------------ */
/* Áreas                                                               */
/* ------------------------------------------------------------------ */

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

/** A situação da área: "Acontecendo" com o ponto aceso; as outras, apagadas. */
function SituacaoArea({ status }: { status: string }) {
  const ativa = status === "ativa"
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", ativa ? "text-[var(--b-menta)]" : "text-ink-3")}>
      <span className="relative flex size-2 shrink-0">
        {ativa ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--b-menta)] opacity-60 motion-reduce:hidden" /> : null}
        <span className={cn("relative inline-flex size-2 rounded-full", ativa ? "bg-[var(--b-menta)]" : "bg-ink-3/60")} />
      </span>
      {STATUS_AREA[status as keyof typeof STATUS_AREA] ?? status}
    </span>
  )
}

/** O núcleo da área: a inicial num anel de luz, com um ponto em órbita quando ela está acontecendo. */
function Nucleo({ nome, ativa, tamanho = 48 }: { nome: string; ativa: boolean; tamanho?: number }) {
  return (
    <span
      aria-hidden
      className="nucleo shrink-0 font-display font-semibold text-ink"
      data-parado={ativa ? undefined : ""}
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.4, "--r": `${tamanho / 2}px` } as React.CSSProperties}
    >
      {nome.trim().charAt(0).toUpperCase() || "?"}
    </span>
  )
}

export function PaginaAreas() {
  const { data: areas = [], isLoading } = useAreas()
  const { data: projetos = [] } = useProjetos()
  const contar = useContagensArea()
  const [nova, setNova] = React.useState(false)
  const [editar, setEditar] = React.useState<AreaPara | null>(null)
  const [verArquivadas, setVerArquivadas] = React.useState(false)
  const visiveis = areas.filter((a) => (verArquivadas ? a.status === "arquivada" : a.status !== "arquivada"))
  const ordem = { ativa: 0, nao_iniciada: 1, arquivada: 2 } as Record<string, number>
  const ativas = areas.filter((a) => a.status === "ativa")
  const idsAtivas = new Set(ativas.map((a) => a.id))
  const projetosEmAreas = projetos.filter((p) => !p.parent_id && !p.archived && !p.done && p.area_id && idsAtivas.has(p.area_id)).length
  const capturasEmAreas = ativas.reduce((n, a) => n + contar(a.id).capturas, 0)

  return (
    <MolduraCerebro>
      <CabecalhoCerebro
        icone={Shapes}
        papel="Responsabilidades contínuas"
        titulo="Áreas"
        descricao="As responsabilidades sem data para acabar: saúde, finanças, carreira… Cada área reúne os projetos e as referências dela."
        descricaoNoCelular={!areas.length}
        acoes={
          <Botao variante="primario" tamanho="lg" onClick={() => setNova(true)} className={cn("rounded-full px-5", ACAO_ACESA)}>
            <Plus /> Nova área
          </Botao>
        }
        hud={
          isLoading || !areas.length
            ? []
            : [
                { n: ativas.length, rotulo: ativas.length === 1 ? "acontecendo" : "acontecendo", cor: "var(--b-menta)" },
                { n: projetosEmAreas, rotulo: projetosEmAreas === 1 ? "projeto em andamento" : "projetos em andamento", cor: "var(--b-luz)" },
                { n: capturasEmAreas, rotulo: capturasEmAreas === 1 ? "captura" : "capturas" },
              ]
        }
      />
      <Segmentos
        rotulo="Situação das áreas"
        className="mb-6 w-full bg-black/25 sm:w-auto"
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
        <VazioCerebro
          icone={Shapes}
          titulo={verArquivadas ? "Nenhuma área arquivada." : "Nenhuma área ainda."}
          descricao={verArquivadas ? undefined : "Crie áreas como Saúde, Finanças ou Carreira e ligue a elas os seus projetos e capturas."}
          acao={
            verArquivadas ? null : (
              <Botao variante="primario" className="rounded-full" onClick={() => setNova(true)}>
                <Plus /> Nova área
              </Botao>
            )
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...visiveis]
            .sort((a, b) => (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9) || a.name.localeCompare(b.name))
            .map((a) => {
              const n = contar(a.id)
              return (
                <li key={a.id} className="group relative">
                  <Link href={`/projetos/areas/${a.id}`} className="vidro-vivo flex h-full min-h-44 flex-col p-4 focus-visible:outline-offset-2 sm:p-5">
                    <div className="flex items-center gap-4 pr-9">
                      <Nucleo nome={a.name} ativa={a.status === "ativa"} />
                      <div className="min-w-0">
                        <p className="break-words font-display text-lg font-semibold leading-tight transition-colors group-hover:text-[var(--b-luz)]">{a.name}</p>
                        <p className="mt-1">
                          <SituacaoArea status={a.status} />
                        </p>
                      </div>
                    </div>
                    {a.description ? <p className="mt-3 line-clamp-2 text-sm text-ink-2">{a.description}</p> : null}
                    <dl className="mt-auto grid grid-cols-2 gap-2 pt-4">
                      <div className="rounded-xl border border-[var(--b-borda)] bg-black/20 px-3 py-2">
                        <dt className="rotulo-hud text-[10px]">Projetos</dt>
                        <dd className="tabular font-display text-xl font-semibold text-[var(--b-luz)]">{n.projetos}</dd>
                      </div>
                      <div className="rounded-xl border border-[var(--b-borda)] bg-black/20 px-3 py-2">
                        <dt className="rotulo-hud text-[10px]">Capturas</dt>
                        <dd className="tabular font-display text-xl font-semibold">{n.capturas}</dd>
                      </div>
                    </dl>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setEditar(a)}
                    aria-label={`Editar ${a.name}`}
                    className="absolute right-3 top-3 grid size-10 place-items-center rounded-full text-ink-2 opacity-100 transition-opacity hover:bg-white/[0.08] hover:text-ink focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 toque:opacity-100"
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
    </MolduraCerebro>
  )
}

export function PaginaArea() {
  const { id } = useParams<{ id: string }>()
  const { data: areas = [], isLoading } = useAreas()
  const { data: projetos = [] } = useProjetos()
  const contar = useContagensArea()
  const atualizar = useAtualizar("areas")
  const [editar, setEditar] = React.useState(false)
  const area = areas.find((a) => a.id === id)

  if (isLoading)
    return (
      <MolduraCerebro detalhe>
        <Carregando />
      </MolduraCerebro>
    )
  if (!area)
    return (
      <MolduraCerebro detalhe>
        <VazioCerebro
          icone={Shapes}
          titulo="Área não encontrada."
          descricao="Ela pode ter sido excluída."
          acao={
            <Botao asChild variante="primario" className="rounded-full">
              <Link href="/projetos/areas">Voltar para Áreas</Link>
            </Botao>
          }
        />
      </MolduraCerebro>
    )

  const projetosArea = projetos.filter((p) => !p.parent_id && p.area_id === area.id && !p.archived)
  const emAndamento = projetosArea.filter((p) => !p.done).length
  const n = contar(area.id)

  return (
    <MolduraCerebro detalhe>
      <CabecalhoCerebro
        voltar={{ href: "/projetos/areas", rotulo: "Áreas" }}
        icone={Shapes}
        papel="Área"
        titulo={
          <span className="flex items-center gap-5">
            <Nucleo nome={area.name} ativa={area.status === "ativa"} tamanho={40} />
            {area.name}
          </span>
        }
        descricao={area.description || "Projetos e referências desta área da sua vida."}
        acoes={
          <Botao variante="contorno" tamanho="icone" className="rounded-full bg-transparent" aria-label="Editar área" onClick={() => setEditar(true)}>
            <Pencil />
          </Botao>
        }
        hud={[
          { n: emAndamento, rotulo: emAndamento === 1 ? "projeto em andamento" : "projetos em andamento", cor: "var(--b-luz)" },
          { n: n.capturas, rotulo: n.capturas === 1 ? "captura" : "capturas" },
        ]}
      >
        <Segmentos
          rotulo="Situação da área"
          className="mt-4 w-full bg-black/25 sm:w-auto"
          valor={area.status}
          aoMudar={(v) => atualizar.mutate({ id: area.id, status: v })}
          opcoes={Object.entries(STATUS_AREA).map(([valor, rotulo]) => ({ valor, rotulo }))}
        />
      </CabecalhoCerebro>

      {projetosArea.length ? (
        <section aria-labelledby="titulo-projetos-area" className="mb-10">
          <h2 id="titulo-projetos-area" className="rotulo-hud mb-3 flex items-center gap-2">
            <FolderKanban className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Projetos da área
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projetosArea.map((p) => {
              const pr = progresso(p.id, projetos)
              const pct = p.done ? 100 : porcentagem(pr.feitos, pr.total)
              return (
                <li key={p.id}>
                  <Link href={`/projetos/${p.id}`} className="vidro-vivo group flex h-full flex-col p-4">
                    <p className="flex items-start gap-2 font-medium">
                      <span className="min-w-0 flex-1 break-words transition-colors group-hover:text-[var(--b-luz)]">{p.name}</span>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-ink-3 group-hover:text-[var(--b-luz)]" aria-hidden />
                    </p>
                    <div className="mt-auto pt-4">
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-ink-3">
                        <span className="tabular">{p.done ? "Concluído" : textoEtapas(pr.feitos, pr.total)}</span>
                        <ChipPrazo prazo={p.deadline} feito={p.done} />
                      </div>
                      <div className="barra-luz" role="progressbar" aria-label={`Progresso de ${p.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="titulo-capturas-area">
        <h2 id="titulo-capturas-area" className="rotulo-hud mb-3 flex items-center gap-2">
          <NotebookPen className="size-3.5 text-[var(--b-luz)]" aria-hidden /> {plural(n.capturas, "captura")} da área
        </h2>
        <ListaCapturas modo={{ area: area.id }} agrupamentos={["nenhum", "tag", "tipo"]} />
      </section>
      <DialogoArea aberta={editar} aoMudar={setEditar} area={area} />
    </MolduraCerebro>
  )
}
