"use client"

import Link from "next/link"
import * as React from "react"
import { ChevronRight, CirclePlay, Minus, Plus, Search } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Esqueleto, Secao, Segmentos, Vazio } from "@/components/ui/basicos"
import { Campo, Entrada } from "@/components/ui/campos"
import { Confirmar, Janela } from "@/components/ui/janela"
import { PlayerYoutube } from "@/components/video-youtube"
import { novoId, useAtualizar, useCriar, useExcluir } from "@/lib/data"
import type { Json } from "@/lib/supabase/database.types"
import { cn, contem, formatar, normalizar, plural } from "@/lib/utils"
import { lerYoutube, linkYoutube } from "@/lib/youtube"
import { esquema, type Colecao, type Propriedade } from "@/features/colecoes/visao-colecao"
import {
  camposExercicio,
  lerExercicio,
  lerFicha,
  listarFichas,
  maisComum,
  notaVisivel,
  prescricao,
  useItensDe,
  valores,
  type CamposExercicio,
  type Exercicio,
  type Ficha,
} from "./dados"
import { historicoDe, marcaTexto, maisPesada, useHistoricoTreino, type HistoricoExercicio } from "./sessao"

const TODOS = "__todos"
const CHAVE_ABA = "treino:ficha"

const rotuloFicha = (f: Ficha) => (f.foco ? `${f.letra} · ${f.foco}` : f.letra)

/** Fichas A/B/C/D: os exercícios de cada treino, na ordem, com séries × repetições. */
export function FichasTreino({ colecao, grupos, historico }: { colecao: Colecao | undefined; grupos: Colecao | undefined; historico: Colecao | undefined }) {
  const { data: itens = [], isLoading } = useItensDe(colecao)
  const { data: itensGrupos = [] } = useItensDe(grupos)
  const { indice } = useHistoricoTreino(historico)
  const criarColecao = useCriar("collections", { aviso: "Lista de exercícios criada" })

  const campos = React.useMemo(() => camposExercicio(colecao, itens), [colecao, itens])
  const exercicios = React.useMemo(() => itens.map((i) => lerExercicio(i, campos)), [itens, campos])
  const fichas = React.useMemo(() => listarFichas(exercicios), [exercicios])
  const nomesGrupos = React.useMemo(
    () => [...new Set(itensGrupos.map((g) => g.title.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [itensGrupos],
  )

  // A última ficha aberta volta aberta (fica só neste aparelho)
  const [guardada, setGuardada] = React.useState<string | null>(null)
  React.useEffect(() => {
    try {
      setGuardada(localStorage.getItem(CHAVE_ABA))
    } catch {
      /* sem acesso ao armazenamento: abre na primeira ficha */
    }
  }, [])
  const [grupo, setGrupo] = React.useState("")
  const [busca, setBusca] = React.useState("")
  const [aberto, setAberto] = React.useState<Exercicio | "novo" | null>(null)

  if (!colecao)
    return (
      <Secao titulo="Fichas">
        <Vazio
          titulo="Ainda não há lista de exercícios."
          descricao="Crie a lista e cadastre os exercícios de cada ficha (A, B, C…), com séries e repetições."
          acao={
            <Botao
              variante="primario"
              onClick={() =>
                criarColecao.mutate({
                  id: novoId(),
                  name: "Exercícios",
                  section: "outros",
                  description: "Treino",
                  schema: [
                    { name: "Séries", type: "number" },
                    { name: "Repetições", type: "number" },
                    { name: "Treino", type: "multi_select" },
                    { name: "Grupos Musculares", type: "multi_select" },
                    { name: "Anotação", type: "text" },
                  ],
                })
              }
            >
              <Plus /> Criar lista de exercícios
            </Botao>
          }
        />
      </Secao>
    )

  const aba = guardada && (guardada === TODOS || fichas.some((f) => f.valor === guardada)) ? guardada : (fichas[0]?.valor ?? TODOS)
  const escolher = (v: string) => {
    setGuardada(v)
    setGrupo("")
    try {
      localStorage.setItem(CHAVE_ABA, v)
    } catch {
      /* só não fica lembrada */
    }
  }

  const ficha = fichas.find((f) => f.valor === aba)
  const daAba = aba === TODOS ? exercicios : exercicios.filter((e) => e.fichas.includes(aba))
  const contagemGrupos = new Map<string, number>()
  for (const e of daAba) for (const g of e.grupos) contagemGrupos.set(g, (contagemGrupos.get(g) ?? 0) + 1)
  const gruposDaAba = [...contagemGrupos].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
  const grupoAtivo = contagemGrupos.has(grupo) ? grupo : ""
  const visiveis = daAba.filter((e) => (!grupoAtivo || e.grupos.includes(grupoAtivo)) && (aba !== TODOS || contem(e.nome, busca)))
  const totalSeries = daAba.reduce((s, e) => s + (e.series ?? 0), 0)
  const algumComGrupo = exercicios.some((e) => e.grupos.length)

  return (
    <Secao titulo="Fichas" acao={<Link href={`/colecoes/${colecao.id}`} className="text-sm text-ink-2 hover:text-ink">Tabela completa</Link>}>
      {isLoading ? (
        <Esqueleto className="h-80 rounded-xl" />
      ) : (
        <>
          <Segmentos
            rotulo="Fichas de treino"
            valor={aba}
            aoMudar={escolher}
            className="mb-4"
            opcoes={[
              ...fichas.map((f) => ({ valor: f.valor, rotulo: f.letra, contagem: exercicios.filter((e) => e.fichas.includes(f.valor)).length })),
              { valor: TODOS, rotulo: "Todos", contagem: exercicios.length },
            ]}
          />

          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="font-medium">{ficha ? (ficha.foco ? `Treino ${ficha.letra} · ${ficha.foco}` : ficha.valor) : "Todos os exercícios"}</h3>
            <p className="text-sm text-ink-3">
              {plural(daAba.length, "exercício")}
              {ficha && totalSeries ? ` · ${totalSeries} séries` : ""}
            </p>
          </div>

          {aba === TODOS ? (
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar exercício" aria-label="Buscar exercício" className="pl-9" />
            </div>
          ) : null}

          {gruposDaAba.length ? (
            <div role="group" aria-label="Filtrar por grupo muscular" className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
              {[["", daAba.length] as [string, number], ...gruposDaAba].map(([g, n]) => (
                <button
                  key={g || "todos"}
                  type="button"
                  aria-pressed={grupoAtivo === g}
                  onClick={() => setGrupo(g)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors toque:min-h-10",
                    grupoAtivo === g ? "border-pen bg-pen/15 font-medium text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
                  )}
                >
                  {g || "Todos os grupos"} <span className="tabular text-xs text-ink-3">{n}</span>
                </button>
              ))}
            </div>
          ) : null}

          {visiveis.length ? (
            <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {visiveis.map((e, i) => {
                const nota = notaVisivel(e)
                const ultima = maisPesada(historicoDe(indice, e.item.id, e.nome)?.ultima?.series ?? [])
                const detalhe =
                  aba === TODOS
                    ? [e.fichas.map((f) => fichas.find((x) => x.valor === f)?.letra ?? f).join(" · ") || "Sem ficha", ...e.grupos].join(" · ")
                    : [ultima ? `Última: ${marcaTexto(ultima)}` : "", ...e.grupos, nota].filter(Boolean).join(" · ")
                return (
                  <li key={e.item.id}>
                    <button
                      type="button"
                      onClick={() => setAberto(e)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60 toque:min-h-14"
                    >
                      {aba !== TODOS ? <span className="w-5 shrink-0 text-right text-sm text-ink-3 tabular">{i + 1}</span> : null}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 font-medium leading-snug">
                          <span className="min-w-0">{e.nome}</span>
                          {e.video ? (
                            <>
                              <CirclePlay className="size-3.5 shrink-0 text-ink-3" aria-hidden />
                              <span className="sr-only">, tem vídeo</span>
                            </>
                          ) : null}
                        </span>
                        {detalhe ? <span className="mt-0.5 block truncate text-xs text-ink-3">{detalhe}</span> : null}
                      </span>
                      <span className="shrink-0 text-sm font-medium text-ink-2 tabular">{prescricao(e)}</span>
                      <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-ink-2">
              {busca && aba === TODOS ? "Nenhum exercício com esse nome." : "Nenhum exercício nesta ficha ainda."}
            </p>
          )}

          <Botao variante="fantasma" className="mt-2" onClick={() => setAberto("novo")}>
            <Plus /> {ficha ? `Adicionar exercício ao treino ${ficha.letra}` : "Novo exercício"}
          </Botao>
          {!algumComGrupo && nomesGrupos.length ? (
            <p className="mt-1 text-xs text-ink-3">Toque num exercício para marcar o grupo muscular. Com os grupos marcados, dá para filtrar a ficha por grupo.</p>
          ) : null}
        </>
      )}

      <DialogoExercicio
        aberto={aberto !== null}
        aoFechar={() => setAberto(null)}
        colecao={colecao}
        campos={campos}
        exercicio={aberto === "novo" ? null : aberto}
        historico={aberto && aberto !== "novo" ? historicoDe(indice, aberto.item.id, aberto.nome) : undefined}
        fichas={fichas}
        fichaAtual={ficha?.valor}
        nomesGrupos={nomesGrupos}
        sugestao={{ series: maisComum(daAba.map((e) => e.series)), reps: maisComum(daAba.map((e) => e.reps)) }}
        proximaPosicao={Math.max(0, ...itens.map((i) => i.position)) + 1}
      />
    </Secao>
  )
}

/* ------------------------------------------------------------------ */
/* Janela do exercício                                                 */
/* ------------------------------------------------------------------ */

const lerInteiro = (t: string): number | null => {
  const so = t.replace(/\D/g, "").slice(0, 3)
  return so ? Number(so) : null
}

function Contador({ id, rotulo, valor, aoMudar }: { id: string; rotulo: string; valor: number | null; aoMudar: (v: number | null) => void }) {
  const atual = valor ?? 0
  return (
    <Campo rotulo={rotulo} htmlFor={id}>
      <div className="flex items-center gap-1.5">
        <Botao variante="contorno" tamanho="icone" aria-label={`Diminuir ${rotulo.toLowerCase()}`} disabled={atual <= 1} onClick={() => aoMudar(Math.max(1, atual - 1))}>
          <Minus />
        </Botao>
        <Entrada id={id} inputMode="numeric" value={valor ?? ""} onChange={(e) => aoMudar(lerInteiro(e.target.value))} className="w-16 text-center tabular" />
        <Botao variante="contorno" tamanho="icone" aria-label={`Aumentar ${rotulo.toLowerCase()}`} onClick={() => aoMudar(Math.min(999, atual + 1))}>
          <Plus />
        </Botao>
      </div>
    </Campo>
  )
}

function Escolhas({
  legenda,
  opcoes,
  selecionadas,
  aoMudar,
  extra,
}: {
  legenda: string
  opcoes: { valor: string; rotulo: string }[]
  selecionadas: string[]
  aoMudar: (v: string[]) => void
  extra?: React.ReactNode
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink-2">{legenda}</legend>
      <div className="flex flex-wrap items-center gap-1.5">
        {opcoes.map((o) => {
          const sel = selecionadas.includes(o.valor)
          return (
            <button
              key={o.valor}
              type="button"
              aria-pressed={sel}
              onClick={() => aoMudar(sel ? selecionadas.filter((x) => x !== o.valor) : [...selecionadas, o.valor])}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors toque:min-h-10",
                sel ? "border-pen bg-pen text-pen-ink" : "border-line-strong text-ink-2 hover:border-pen hover:text-ink",
              )}
            >
              {o.rotulo}
            </button>
          )
        })}
        {extra}
      </div>
    </fieldset>
  )
}

/** "E" vira "Treino E", para a ficha nova seguir o padrão das outras. */
const nomeDaFicha = (t: string) => {
  const v = t.trim().replace(/\s+/g, " ")
  return /^[a-z0-9]{1,3}$/i.test(v) ? `Treino ${v.toUpperCase()}` : v
}

function DialogoExercicio({
  aberto,
  aoFechar,
  colecao,
  campos,
  exercicio,
  historico,
  fichas,
  fichaAtual,
  nomesGrupos,
  sugestao,
  proximaPosicao,
}: {
  aberto: boolean
  aoFechar: () => void
  colecao: Colecao
  campos: CamposExercicio
  exercicio: Exercicio | null
  historico?: HistoricoExercicio
  fichas: Ficha[]
  fichaAtual?: string
  nomesGrupos: string[]
  sugestao: { series: number | null; reps: number | null }
  proximaPosicao: number
}) {
  const criar = useCriar("collection_items")
  const atualizar = useAtualizar("collection_items")
  const excluir = useExcluir("collection_items")
  const atualizarColecao = useAtualizar("collections")
  const [nome, setNome] = React.useState("")
  const [series, setSeries] = React.useState<number | null>(null)
  const [reps, setReps] = React.useState<number | null>(null)
  const [nota, setNota] = React.useState("")
  const [video, setVideo] = React.useState("")
  const [selFichas, setSelFichas] = React.useState<string[]>([])
  const [selGrupos, setSelGrupos] = React.useState<string[]>([])
  const [novaFicha, setNovaFicha] = React.useState<string | null>(null)
  const [apagar, setApagar] = React.useState(false)

  React.useEffect(() => {
    if (!aberto) return
    setNome(exercicio?.nome ?? "")
    setSeries(exercicio ? exercicio.series : sugestao.series)
    setReps(exercicio ? exercicio.reps : sugestao.reps)
    setNota(exercicio?.nota ?? "")
    setVideo(exercicio?.video ?? "")
    setSelFichas(exercicio ? exercicio.fichas : fichaAtual ? [fichaAtual] : [])
    setSelGrupos(exercicio?.grupos ?? [])
    setNovaFicha(fichas.length ? null : "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, exercicio])

  const criarFicha = () => {
    const v = nomeDaFicha(novaFicha ?? "")
    if (v && !selFichas.includes(v)) setSelFichas([...selFichas, v])
    setNovaFicha(null)
  }

  // Grupos que o exercício já tinha e não estão na lista de grupos continuam aparecendo
  const opcoesGrupos = [...new Set([...nomesGrupos, ...selGrupos])]
  const opcoesFichas = [
    ...fichas.map((f) => ({ valor: f.valor, rotulo: rotuloFicha(f) })),
    ...selFichas.filter((v) => !fichas.some((f) => f.valor === v)).map((v) => ({ valor: v, rotulo: rotuloFicha(lerFicha(v)) })),
  ]

  const videoLido = lerYoutube(video)
  const videoInvalido = video.trim() !== "" && !videoLido

  /** Garante que as colunas usadas existam na coleção, para aparecerem também na tabela. */
  const garantirColunas = () => {
    const atual = esquema(colecao)
    const novas: Propriedade[] = []
    const precisa = (nome: string, type: string, usada: boolean) => {
      if (usada && !atual.some((p) => normalizar(p.name) === normalizar(nome))) novas.push({ name: nome, type })
    }
    precisa(campos.series, "number", series !== null)
    precisa(campos.reps, "number", reps !== null)
    precisa(campos.fichas, "multi_select", selFichas.length > 0)
    precisa(campos.grupos, "multi_select", selGrupos.length > 0)
    precisa(campos.nota, "text", Boolean(nota.trim()))
    precisa(campos.video, "url", Boolean(videoLido))
    if (novas.length) atualizarColecao.mutate({ id: colecao.id, schema: [...atual, ...novas] as unknown as Json })
  }

  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault()
    const titulo = nome.trim()
    if (!titulo || videoInvalido) return
    const props: Record<string, Json> = exercicio ? { ...valores(exercicio.item) } : {}
    const definir = (chave: string, valor: Json, vazio: boolean) => {
      if (vazio) delete props[chave]
      else props[chave] = valor
    }
    definir(campos.series, series, series === null)
    definir(campos.reps, reps, reps === null)
    definir(campos.nota, nota.trim(), !nota.trim())
    definir(campos.video, videoLido ? linkYoutube(videoLido) : "", !videoLido)
    definir(campos.fichas, selFichas, !selFichas.length)
    definir(campos.grupos, selGrupos, !selGrupos.length)
    if (exercicio) atualizar.mutate({ id: exercicio.item.id, title: titulo, props })
    else criar.mutate({ id: novoId(), collection_id: colecao.id, title: titulo, props, position: proximaPosicao })
    garantirColunas()
    aoFechar()
  }

  return (
    <>
      <Janela
        aberta={aberto}
        aoMudar={(v) => !v && aoFechar()}
        titulo={exercicio ? "Editar exercício" : "Novo exercício"}
        rodape={
          <>
            {exercicio ? (
              <Botao variante="fantasma" className="mr-auto text-danger hover:text-danger" onClick={() => setApagar(true)}>
                Excluir
              </Botao>
            ) : null}
            <Botao variante="fantasma" onClick={aoFechar}>
              Cancelar
            </Botao>
            <Botao variante="primario" type="submit" form="form-exercicio" disabled={!nome.trim() || videoInvalido}>
              {exercicio ? "Salvar" : "Adicionar"}
            </Botao>
          </>
        }
      >
        <form id="form-exercicio" onSubmit={salvar} className="grid gap-5">
          <Campo rotulo="Nome" htmlFor="ex-nome">
            <Entrada id="ex-nome" autoFocus={!exercicio} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Supino reto" />
          </Campo>
          <div className="flex flex-wrap gap-x-6 gap-y-4">
            <Contador id="ex-series" rotulo="Séries" valor={series} aoMudar={setSeries} />
            <Contador id="ex-reps" rotulo="Repetições" valor={reps} aoMudar={setReps} />
          </div>
          {historico?.ultima || historico?.recorde ? (
            <dl className="grid gap-1 rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm">
              {historico.ultima ? (
                <div className="flex gap-3">
                  <dt className="shrink-0 text-ink-3">Última vez ({formatar(historico.ultima.data, "d MMM")})</dt>
                  <dd className="ml-auto text-right">{historico.ultima.series.map(marcaTexto).join(" · ")}</dd>
                </div>
              ) : null}
              {historico.recorde ? (
                <div className="flex gap-3">
                  <dt className="shrink-0 text-ink-3">Recorde ({formatar(historico.recorde.data, "d MMM yyyy")})</dt>
                  <dd className="ml-auto text-right">{marcaTexto(historico.recorde)}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <Campo rotulo="Anotação" htmlFor="ex-nota" dica="Tempo (60s, 15min), cadência, ajuste do aparelho…">
            <Entrada id="ex-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" />
          </Campo>
          <Campo
            rotulo="Vídeo da execução (YouTube)"
            htmlFor="ex-video"
            dica={videoInvalido ? undefined : "Cole o link de um vídeo ou Short do YouTube."}
          >
            <div className="flex gap-2">
              <Entrada
                id="ex-video"
                inputMode="url"
                autoComplete="off"
                value={video}
                onChange={(e) => setVideo(e.target.value)}
                placeholder="https://youtu.be/…"
                aria-invalid={videoInvalido}
                aria-describedby={videoInvalido ? "ex-video-erro" : undefined}
              />
              {video ? (
                <Botao variante="fantasma" onClick={() => setVideo("")}>
                  Tirar
                </Botao>
              ) : null}
            </div>
            {videoInvalido ? (
              <p id="ex-video-erro" className="text-sm text-danger">
                Esse link não é de um vídeo do YouTube.
              </p>
            ) : null}
          </Campo>
          {videoLido ? <PlayerYoutube key={videoLido.id} video={videoLido} titulo={nome || "exercício"} compacto /> : null}
          <Escolhas
            legenda="Fichas"
            opcoes={opcoesFichas}
            selecionadas={selFichas}
            aoMudar={setSelFichas}
            extra={
              novaFicha === null ? (
                <button
                  type="button"
                  onClick={() => setNovaFicha("")}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-3 py-1.5 text-sm text-ink-2 hover:border-pen hover:text-ink toque:min-h-10"
                >
                  <Plus className="size-3.5" /> Nova ficha
                </button>
              ) : (
                <span className="flex w-full items-center gap-2">
                  <Entrada
                    autoFocus={fichas.length > 0}
                    value={novaFicha}
                    onChange={(e) => setNovaFicha(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        criarFicha()
                      }
                      if (e.key === "Escape") {
                        e.stopPropagation()
                        setNovaFicha(null)
                      }
                    }}
                    placeholder="Letra ou nome (ex.: E, Treino E - cardio)"
                    aria-label="Nome da nova ficha"
                    className="max-w-72"
                  />
                  <Botao variante="secundario" onClick={criarFicha} disabled={!novaFicha.trim()}>
                    Criar
                  </Botao>
                </span>
              )
            }
          />
          {opcoesGrupos.length ? (
            <Escolhas legenda="Grupos musculares" opcoes={opcoesGrupos.map((g) => ({ valor: g, rotulo: g }))} selecionadas={selGrupos} aoMudar={setSelGrupos} />
          ) : null}
          {exercicio ? (
            <Link href={`/colecoes/item/${exercicio.item.id}`} className="justify-self-start text-sm font-medium text-pen hover:underline">
              Abrir a página do exercício
            </Link>
          ) : null}
        </form>
      </Janela>
      <Confirmar
        aberta={apagar}
        aoMudar={setApagar}
        titulo={`Excluir “${exercicio?.nome ?? ""}”?`}
        descricao="O exercício sai de todas as fichas."
        aoConfirmar={() => {
          if (exercicio) excluir.mutate(exercicio.item.id)
          aoFechar()
        }}
      />
    </>
  )
}
