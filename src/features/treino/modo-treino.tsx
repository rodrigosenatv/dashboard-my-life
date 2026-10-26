"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import { useRouter } from "next/navigation"
import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, ChevronLeft, ChevronRight, CirclePlay, Dumbbell, Ellipsis, ListOrdered, Minus, Plus, Timer, Trophy, X } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Confirmar, Janela } from "@/components/ui/janela"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuRotulo, MenuSeparador } from "@/components/ui/menu"
import { PlayerYoutube } from "@/components/video-youtube"
import { cn, plural } from "@/lib/utils"
import { useTelaAcesa } from "@/lib/tela-acesa"
import { lerYoutube } from "@/lib/youtube"
import { camposExercicio, kg, lerExercicio, lerNumeroDigitado, notaVisivel, prescricao, useColecoesTreino, useItensDe } from "./dados"
import {
  DIFICULDADES,
  bateRecorde,
  contar,
  gravarSessao,
  lerSessao,
  marcaTexto,
  minutosEntre,
  mudarSessao,
  rotuloDaFicha,
  salvarSessao,
  seriesDe,
  useSessaoAtiva,
  type SessaoAtiva,
} from "./sessao"

const DESCANSOS = [45, 60, 90, 120, 180]
const CHAVE_DESCANSO = "treino:descanso"

/* ------------------------------------------------------------------ */
/* Formatos                                                            */
/* ------------------------------------------------------------------ */

const doisDigitos = (n: number) => String(n).padStart(2, "0")
const mmss = (s: number) => `${Math.floor(s / 60)}:${doisDigitos(s % 60)}`
const tempo = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}:${doisDigitos(Math.floor((s % 3600) / 60))}:${doisDigitos(s % 60)}` : mmss(s))
const numeroTexto = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2, useGrouping: false })
const rotuloDescanso = (s: number) => (s % 60 === 0 ? `${s / 60} min` : s > 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`)

const lerInteiro = (t: string): number | null => {
  const so = t.replace(/\D/g, "").slice(0, 3)
  return so ? Number(so) : null
}

/* ------------------------------------------------------------------ */
/* Ganchos do aparelho                                                 */
/* ------------------------------------------------------------------ */

/** O relógio da tela, de segundo em segundo (0 até montar no navegador). */
function useAgora() {
  const [agora, setAgora] = React.useState(0)
  React.useEffect(() => {
    const tique = () => setAgora(Date.now())
    tique()
    const t = window.setInterval(tique, 1000)
    document.addEventListener("visibilitychange", tique)
    return () => {
      window.clearInterval(t)
      document.removeEventListener("visibilitychange", tique)
    }
  }, [])
  return agora
}

/** Tempo de descanso escolhido (fica neste aparelho). */
function useDescanso(): [number, (s: number) => void] {
  const [segundos, setSegundos] = React.useState(90)
  React.useEffect(() => {
    try {
      const salvo = Number(localStorage.getItem(CHAVE_DESCANSO))
      if (DESCANSOS.includes(salvo)) setSegundos(salvo)
    } catch {
      /* fica o padrão */
    }
  }, [])
  const mudar = (s: number) => {
    setSegundos(s)
    try {
      localStorage.setItem(CHAVE_DESCANSO, String(s))
    } catch {
      /* só não fica lembrado */
    }
  }
  return [segundos, mudar]
}

/** Três toques curtos no fim do descanso, sem arquivo de áudio. */
function bipar(ctx: AudioContext | null) {
  if (!ctx) return
  try {
    void ctx.resume()
    ;[0, 0.22, 0.44].forEach((t) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.2)
    })
  } catch {
    /* sem som: fica a vibração e o aviso na tela */
  }
}

/* ------------------------------------------------------------------ */
/* Tela                                                                */
/* ------------------------------------------------------------------ */

/** Modo treino em tela cheia: um exercício por vez, séries com carga e repetições, descanso. */
export function ModoTreino() {
  const sessao = useSessaoAtiva()
  // Ao salvar ou descartar, a tela fica parada (com um aviso, se houver) até a página de Treino abrir
  const [saindo, setSaindo] = React.useState<string | null>(null)
  if (saindo !== null)
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-ink">
        {saindo ? (
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <Check className="size-4 text-pen" /> {saindo}
          </p>
        ) : null}
      </div>
    )
  if (!sessao || sessao.pendente) return <SemTreino pendente={Boolean(sessao?.pendente)} />
  return <Treinando sessao={sessao} aoSair={setSaindo} />
}

function SemTreino({ pendente }: { pendente: boolean }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6 text-center text-ink">
      <div className="max-w-sm">
        <Dumbbell className="mx-auto size-8 text-ink-3" />
        <p className="mt-3 font-medium">{pendente ? "O último treino está esperando para ser salvo." : "Nenhum treino em andamento."}</p>
        <p className="mt-1 text-sm text-ink-2">{pendente ? "Abra a página de Treino com internet para salvar." : "Escolha a ficha e comece pela página de Treino."}</p>
        <Botao asChild variante="primario" className="mt-5">
          <Link href="/vida/treino">Ir para Treino</Link>
        </Botao>
      </div>
    </div>
  )
}

function Treinando({ sessao, aoSair }: { sessao: SessaoAtiva; aoSair: (aviso: string) => void }) {
  const router = useRouter()
  const qc = useQueryClient()
  const agora = useAgora()
  const [descanso, setDescanso] = useDescanso()
  const [editando, setEditando] = React.useState<number | null>(null)
  const [extra, setExtra] = React.useState(false)
  const [lista, setLista] = React.useState(false)
  const [terminar, setTerminar] = React.useState(false)
  const [descartar, setDescartar] = React.useState(false)
  const [aviso, setAviso] = React.useState("")
  const [vendoVideo, setVendoVideo] = React.useState(false)
  const audio = React.useRef<AudioContext | null>(null)
  const avisado = React.useRef<number | undefined>(undefined)
  useTelaAcesa()

  const indice = Math.min(Math.max(sessao.atual, 0), sessao.exercicios.length - 1)
  const ex = sessao.exercicios[indice]
  const feitas = seriesDe(sessao, ex.id)
  const alvo = ex.series ?? 0
  const completo = feitas.length >= Math.max(alvo, 1) && !extra
  const ultimo = indice >= sessao.exercicios.length - 1
  const c = contar(sessao)
  const decorrido = agora ? Math.max(0, Math.floor((agora - Date.parse(sessao.inicio)) / 1000)) : 0
  const restante = agora && sessao.descansoAte ? Math.max(0, Math.ceil((sessao.descansoAte - agora) / 1000)) : 0
  const serieEditada = editando !== null ? sessao.series[editando] : undefined

  // O vídeo vem da lista de exercícios (se mudou durante o treino, vale o novo); sem internet, o copiado ao começar
  const { exercicios: colecaoExercicios } = useColecoesTreino()
  const { data: itensExercicios = [] } = useItensDe(colecaoExercicios)
  const videos = React.useMemo(() => {
    const campos = camposExercicio(colecaoExercicios, itensExercicios)
    return new Map(itensExercicios.map((i) => [i.id, lerExercicio(i, campos).video]))
  }, [colecaoExercicios, itensExercicios])
  const video = lerYoutube(videos.get(ex.id) ?? ex.video)

  // Fim do descanso: som, vibração e aviso para leitor de tela (uma vez por descanso)
  React.useEffect(() => {
    const ate = sessao.descansoAte
    if (!agora || !ate || avisado.current === ate || agora < ate) return
    avisado.current = ate
    if (agora - ate > 4000) return // voltou ao app bem depois: sem barulho fora de hora
    bipar(audio.current)
    navigator.vibrate?.([200, 100, 200])
    setAviso("Descanso terminado. Hora da próxima série.")
  }, [agora, sessao.descansoAte])

  /** O áudio só pode começar depois de um toque da pessoa (regra dos navegadores). */
  const prepararSom = () => {
    try {
      audio.current ??= new AudioContext()
      void audio.current.resume()
    } catch {
      audio.current = null
    }
  }

  const irPara = (i: number) => {
    setEditando(null)
    setExtra(false)
    setVendoVideo(false)
    mudarSessao((s) => ({ ...s, atual: Math.max(0, Math.min(s.exercicios.length - 1, i)) }))
  }

  const concluir = (peso: number | null, reps: number | null) => {
    prepararSom()
    navigator.vibrate?.(15)
    if (serieEditada && editando !== null) {
      mudarSessao((s) => ({ ...s, series: s.series.map((x, j) => (j === editando ? { ...x, peso, reps } : x)) }))
      setEditando(null)
      return
    }
    const recorde = bateRecorde(ex, feitas, peso)
    mudarSessao((s) => ({
      ...s,
      series: [...s.series, { exercicio: ex.id, nome: ex.nome, peso, reps, em: new Date().toISOString() }],
      descansoAte: Date.now() + descanso * 1000,
    }))
    setExtra(false)
    setAviso("")
    if (recorde && peso !== null) toast.success(`Novo recorde em ${ex.nome}`, { description: kg(peso) })
  }

  const excluirSerie = () => {
    if (editando === null) return
    mudarSessao((s) => ({ ...s, series: s.series.filter((_, j) => j !== editando) }))
    setEditando(null)
  }

  const somarDescanso = (seg: number) => mudarSessao((s) => ({ ...s, descansoAte: Math.max(s.descansoAte ?? 0, Date.now()) + seg * 1000 }))
  const pularDescanso = () => mudarSessao((s) => ({ ...s, descansoAte: undefined }))

  // Sugestão para a próxima série: a carga da série anterior (ou a da última vez) e as repetições da ficha
  const sugestao = (): { peso: string; reps: string } => {
    if (serieEditada) return { peso: serieEditada.peso === null ? "" : numeroTexto(serieEditada.peso), reps: serieEditada.reps === null ? "" : String(serieEditada.reps) }
    const k = feitas.length
    const anterior = feitas.at(-1)
    const ultimaVez = ex.ultima?.series ?? []
    const peso = anterior?.peso ?? ultimaVez[k]?.peso ?? ultimaVez.at(-1)?.peso ?? null
    const reps = ex.reps ?? ultimaVez[k]?.reps ?? anterior?.reps ?? null
    return { peso: peso === null ? "" : numeroTexto(peso), reps: reps === null ? "" : String(reps) }
  }

  const salvar = async (dificuldade: string) => {
    const atual = lerSessao()
    if (!atual) return
    const final: SessaoAtiva = { ...atual, fim: new Date().toISOString(), dificuldade: dificuldade || undefined, descansoAte: undefined }
    gravarSessao(final)
    try {
      await salvarSessao(final)
      aoSair("Treino salvo")
      gravarSessao(null)
      await Promise.all(["collection_items", "collections", "habit_logs"].map((t) => qc.invalidateQueries({ queryKey: [t] })))
      toast.success("Treino salvo", { description: `${rotuloDaFicha(final.ficha)} · ${plural(final.series.length, "série")}` })
    } catch {
      gravarSessao({ ...final, pendente: true })
      toast.error("Não deu para salvar agora.", { description: "O treino ficou guardado neste aparelho e é salvo quando a internet voltar." })
    }
    router.push("/vida/treino")
  }

  const linhas = Math.max(alvo, feitas.length + (completo ? 0 : 1))
  const ficha = rotuloDaFicha(sessao.ficha)

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-1 px-2 py-1.5">
          <Botao variante="fantasma" tamanho="icone" aria-label="Sair do modo treino (o treino continua guardado)" onClick={() => router.push("/vida/treino")}>
            <X />
          </Botao>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold">{ficha}</p>
            <p className="text-xs text-ink-3 tabular">
              {tempo(decorrido)} · {c.feitas} de {c.previstas} séries
            </p>
          </div>
          <Botao variante="fantasma" tamanho="icone" aria-label="Lista de exercícios" onClick={() => setLista(true)}>
            <ListOrdered />
          </Botao>
          <Menu>
            <MenuGatilho asChild>
              <Botao variante="fantasma" tamanho="icone" aria-label="Opções do treino">
                <Ellipsis />
              </Botao>
            </MenuGatilho>
            <MenuConteudo className="w-60">
              <MenuRotulo>Descanso entre séries</MenuRotulo>
              {DESCANSOS.map((s) => (
                <MenuItem key={s} onSelect={() => setDescanso(s)}>
                  <Check className={cn(s === descanso ? "opacity-100" : "opacity-0")} /> {rotuloDescanso(s)}
                </MenuItem>
              ))}
              <MenuSeparador />
              <MenuItem onSelect={() => setTerminar(true)}>
                <Check /> Terminar treino
              </MenuItem>
              <MenuItem perigo onSelect={() => setDescartar(true)}>
                <X /> Descartar treino
              </MenuItem>
            </MenuConteudo>
          </Menu>
        </div>
        <div className="h-0.5 bg-surface-3" aria-hidden>
          <div className="h-full bg-pen transition-[width] duration-300" style={{ width: `${(c.feitas / Math.max(1, c.previstas)) * 100}%` }} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl px-4 pb-80 pt-4">
        <div className="flex items-center justify-between gap-2">
          <Botao variante="fantasma" tamanho="icone" aria-label="Exercício anterior" disabled={indice === 0} onClick={() => irPara(indice - 1)}>
            <ChevronLeft />
          </Botao>
          <p className="text-sm text-ink-3">
            Exercício {indice + 1} de {sessao.exercicios.length}
          </p>
          <Botao variante="fantasma" tamanho="icone" aria-label="Próximo exercício" disabled={ultimo} onClick={() => irPara(indice + 1)}>
            <ChevronRight />
          </Botao>
        </div>
        <h1 className="mt-1 text-center font-display text-2xl font-semibold leading-tight">{ex.nome}</h1>
        <p className="mt-1 text-center text-sm text-ink-2">
          {prescricao(ex)}
          {notaVisivel(ex) ? ` · ${notaVisivel(ex)}` : ""}
        </p>
        {video ? (
          <div className="mt-3 flex justify-center">
            <Botao variante="secundario" tamanho="sm" onClick={() => setVendoVideo(true)}>
              <CirclePlay /> Ver execução
            </Botao>
          </div>
        ) : null}

        {ex.ultima || ex.recorde ? (
          <dl className="mt-4 grid gap-1.5 rounded-lg bg-surface px-3.5 py-3 text-sm">
            {ex.ultima ? (
              <div className="flex gap-3">
                <dt className="shrink-0 text-ink-3">Última vez</dt>
                <dd className="ml-auto text-right">{ex.ultima.series.map(marcaTexto).join(" · ")}</dd>
              </div>
            ) : null}
            {ex.recorde ? (
              <div className="flex gap-3">
                <dt className="shrink-0 text-ink-3">Recorde</dt>
                <dd className="ml-auto text-right">{marcaTexto(ex.recorde)}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <ol className="mt-5 grid gap-2" aria-label="Séries">
          {Array.from({ length: linhas }, (_, k) => {
            const feita = feitas[k]
            const agoraAqui = !feita && k === feitas.length && editando === null
            if (feita) {
              const recorde = bateRecorde(ex, feitas.slice(0, k), feita.peso)
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => setEditando(editando === feita.i ? null : feita.i)}
                    aria-pressed={editando === feita.i}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors",
                      editando === feita.i ? "border-pen bg-pen-soft" : "border-line bg-surface hover:border-line-strong",
                    )}
                  >
                    <span className="grid size-6 place-items-center rounded-full bg-pen text-pen-ink">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    <span className="text-sm text-ink-2">Série {k + 1}</span>
                    {recorde ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-pen-soft px-2 py-0.5 text-xs font-medium text-ink">
                        <Trophy className="size-3" /> recorde
                      </span>
                    ) : null}
                    <span className="ml-auto font-semibold tabular">{marcaTexto(feita)}</span>
                  </button>
                </li>
              )
            }
            return (
              <li
                key={k}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3.5 py-3",
                  agoraAqui ? "border-2 border-pen" : "border-dashed border-line text-ink-3",
                )}
              >
                <span className={cn("grid size-6 place-items-center rounded-full border text-xs tabular", agoraAqui ? "border-pen text-ink" : "border-line-strong")}>{k + 1}</span>
                <span className="text-sm">{agoraAqui ? `Série ${k + 1}: agora` : `Série ${k + 1}`}</span>
                {ex.reps ? <span className="ml-auto text-sm tabular">{ex.reps} rep.</span> : null}
              </li>
            )
          })}
        </ol>
        {completo && editando === null ? (
          <button type="button" onClick={() => setExtra(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-pen hover:underline">
            <Plus className="size-4" /> Série extra
          </button>
        ) : null}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {restante > 0 ? <Descanso restante={restante} total={descanso} aoSomar={() => somarDescanso(30)} aoPular={pularDescanso} /> : null}
          <p className="sr-only" aria-live="polite">
            {aviso}
          </p>
          {serieEditada ? (
            <EditorSerie
              key={`editar-${editando}`}
              titulo={`Corrigindo a série ${feitas.findIndex((f) => f.i === editando) + 1}`}
              inicial={sugestao()}
              rotulo="Salvar correção"
              aoConcluir={concluir}
              extra={
                <div className="flex gap-2">
                  <Botao variante="fantasma" className="flex-1 text-danger hover:text-danger" onClick={excluirSerie}>
                    Apagar série
                  </Botao>
                  <Botao variante="fantasma" className="flex-1" onClick={() => setEditando(null)}>
                    Cancelar
                  </Botao>
                </div>
              }
            />
          ) : completo ? (
            <Botao variante="primario" className="h-14 w-full text-base" onClick={() => (ultimo ? setTerminar(true) : irPara(indice + 1))}>
              {ultimo ? (
                <>
                  <Check /> Terminar treino
                </>
              ) : (
                <>
                  Próximo: <span className="truncate">{sessao.exercicios[indice + 1]?.nome}</span> <ChevronRight />
                </>
              )}
            </Botao>
          ) : (
            <EditorSerie
              key={`${ex.id}-${feitas.length}`}
              titulo={`Série ${feitas.length + 1}${alvo ? ` de ${Math.max(alvo, feitas.length + 1)}` : ""}${feitas.length >= alvo && alvo ? " (extra)" : ""}`}
              inicial={sugestao()}
              rotulo={`Concluir série ${feitas.length + 1}`}
              aoConcluir={concluir}
            />
          )}
        </div>
      </footer>

      <Janela aberta={vendoVideo && Boolean(video)} aoMudar={setVendoVideo} titulo={ex.nome} descricao="Como fazer" largura="lg">
        {video ? <PlayerYoutube key={video.id} video={video} titulo={ex.nome} iniciar /> : null}
      </Janela>

      <Janela aberta={lista} aoMudar={setLista} titulo="Exercícios" descricao={ficha}>
        <ol className="-mx-2 grid gap-0.5">
          {sessao.exercicios.map((e, i) => {
            const n = seriesDe(sessao, e.id).length
            const pronto = n >= Math.max(e.series ?? 0, 1)
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    irPara(i)
                    setLista(false)
                  }}
                  aria-current={i === indice ? "step" : undefined}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-2 toque:min-h-12", i === indice && "bg-surface-2")}
                >
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-xs tabular", pronto ? "border-pen bg-pen text-pen-ink" : "border-line-strong text-ink-3")}>
                    {pronto ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{e.nome}</span>
                  <span className="shrink-0 text-sm text-ink-3 tabular">
                    {n}/{e.series ?? "–"}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </Janela>

      <ResumoTreino aberta={terminar} aoMudar={setTerminar} sessao={sessao} agora={agora} aoSalvar={salvar} aoDescartar={() => setDescartar(true)} />

      <Confirmar
        aberta={descartar}
        aoMudar={setDescartar}
        titulo="Descartar este treino?"
        descricao={c.feitas ? `As ${plural(c.feitas, "série")} registradas se perdem.` : undefined}
        acao="Descartar"
        aoConfirmar={() => {
          aoSair("")
          gravarSessao(null)
          router.push("/vida/treino")
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Partes                                                              */
/* ------------------------------------------------------------------ */

function Descanso({ restante, total, aoSomar, aoPular }: { restante: number; total: number; aoSomar: () => void; aoPular: () => void }) {
  return (
    <div className="mb-3 rounded-lg bg-pen-soft px-3 py-2" role="timer" aria-label={`Descanso: ${mmss(restante)}`}>
      <div className="flex items-center gap-2">
        <Timer className="size-4 shrink-0 text-ink-2" aria-hidden />
        <span className="text-sm text-ink-2">Descanso</span>
        <span className="text-lg font-semibold tabular">{mmss(restante)}</span>
        <div className="ml-auto flex gap-1">
          <Botao variante="fantasma" tamanho="sm" onClick={aoSomar}>
            +30 s
          </Botao>
          <Botao variante="fantasma" tamanho="sm" onClick={aoPular}>
            Pular
          </Botao>
        </div>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <div className="h-full rounded-full bg-pen transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(100, (restante / Math.max(total, restante)) * 100)}%` }} />
      </div>
    </div>
  )
}

function Passo({ id, rotulo, valor, aoMudar, decimal }: { id: string; rotulo: string; valor: string; aoMudar: (v: string) => void; decimal?: boolean }) {
  const n = decimal ? lerNumeroDigitado(valor) : lerInteiro(valor)
  const mudar = (d: number) => {
    const novo = Math.max(0, Math.round(((n ?? 0) + d) * 100) / 100)
    aoMudar(decimal ? numeroTexto(novo) : String(novo))
  }
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs text-ink-3">
        {rotulo}
      </label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Diminuir ${rotulo.toLowerCase()}`}
          disabled={!n}
          onClick={() => mudar(-1)}
          className="grid size-12 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface active:bg-surface-2 disabled:opacity-40"
        >
          <Minus className="size-5" />
        </button>
        <input
          id={id}
          aria-label={rotulo}
          inputMode={decimal ? "decimal" : "numeric"}
          autoComplete="off"
          value={valor}
          onChange={(e) => aoMudar(decimal ? e.target.value.replace(/[^\d.,]/g, "").slice(0, 6) : e.target.value.replace(/\D/g, "").slice(0, 3))}
          placeholder="–"
          className="h-12 w-full min-w-0 rounded-lg border border-line-strong bg-surface text-center text-lg font-semibold tabular placeholder:text-ink-3 focus-visible:border-pen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen/25"
        />
        <button
          type="button"
          aria-label={`Aumentar ${rotulo.toLowerCase()}`}
          onClick={() => mudar(1)}
          className="grid size-12 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface active:bg-surface-2"
        >
          <Plus className="size-5" />
        </button>
      </div>
    </div>
  )
}

function EditorSerie({
  titulo,
  inicial,
  rotulo,
  aoConcluir,
  extra,
}: {
  titulo: string
  inicial: { peso: string; reps: string }
  rotulo: string
  aoConcluir: (peso: number | null, reps: number | null) => void
  extra?: React.ReactNode
}) {
  const [peso, setPeso] = React.useState(inicial.peso)
  const [reps, setReps] = React.useState(inicial.reps)
  const p = lerNumeroDigitado(peso)
  const r = lerInteiro(reps)
  const invalido = (peso.trim() !== "" && p === null) || (p === null && r === null)
  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium">{titulo}</p>
      <div className="grid grid-cols-2 gap-3">
        <Passo id="serie-peso" rotulo="Carga (kg)" valor={peso} aoMudar={setPeso} decimal />
        <Passo id="serie-reps" rotulo="Repetições" valor={reps} aoMudar={setReps} />
      </div>
      <Botao variante="primario" className="h-14 w-full text-base" disabled={invalido} onClick={() => aoConcluir(p, r)}>
        <Check /> {rotulo}
      </Botao>
      {extra}
    </div>
  )
}

function ResumoTreino({
  aberta,
  aoMudar,
  sessao,
  agora,
  aoSalvar,
  aoDescartar,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  sessao: SessaoAtiva
  agora: number
  aoSalvar: (dificuldade: string) => Promise<void>
  aoDescartar: () => void
}) {
  const [dificuldade, setDificuldade] = React.useState("")
  const [salvando, setSalvando] = React.useState(false)
  const c = contar(sessao)
  const minutos = agora ? minutosEntre(sessao.inicio, new Date(agora).toISOString()) : 0
  const vazio = c.feitas === 0

  return (
    <Janela
      aberta={aberta}
      aoMudar={(v) => !salvando && aoMudar(v)}
      titulo={vazio ? "Nenhuma série registrada" : "Terminar treino"}
      descricao={rotuloDaFicha(sessao.ficha)}
      rodape={
        vazio ? (
          <>
            <Botao variante="fantasma" onClick={() => aoMudar(false)}>
              Voltar ao treino
            </Botao>
            <Botao
              variante="perigo"
              onClick={() => {
                aoMudar(false)
                aoDescartar()
              }}
            >
              Descartar
            </Botao>
          </>
        ) : (
          <>
            <Botao variante="fantasma" disabled={salvando} onClick={() => aoMudar(false)}>
              Voltar ao treino
            </Botao>
            <Botao
              variante="primario"
              disabled={salvando}
              onClick={async () => {
                setSalvando(true)
                await aoSalvar(dificuldade)
                setSalvando(false)
              }}
            >
              {salvando ? "Salvando…" : "Salvar treino"}
            </Botao>
          </>
        )
      }
    >
      {vazio ? (
        <p className="text-sm text-ink-2">Conclua ao menos uma série para salvar, ou descarte este treino.</p>
      ) : (
        <div className="grid gap-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Duração", `${minutos} min`],
              ["Séries", `${c.feitas}`],
              ["Exercícios", `${c.exercicios} de ${sessao.exercicios.length}`],
              ["Volume", kg(Math.round(c.volume))],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-lg bg-surface-2 px-3 py-2">
                <dt className="text-xs text-ink-3">{rotulo}</dt>
                <dd className="text-lg font-semibold">{valor}</dd>
              </div>
            ))}
          </dl>
          {c.recordes.length ? (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                <Trophy className="size-4 text-pen" /> {c.recordes.length === 1 ? "Recorde novo" : `${c.recordes.length} recordes novos`}
              </p>
              <ul className="grid gap-1 text-sm">
                {c.recordes.map((r) => (
                  <li key={r.nome} className="flex justify-between gap-3">
                    <span className="truncate text-ink-2">{r.nome}</span>
                    <span className="shrink-0 font-medium tabular">{marcaTexto(r)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink-2">Como foi?</legend>
            <div className="flex gap-1.5">
              {DIFICULDADES.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={dificuldade === d}
                  onClick={() => setDificuldade(dificuldade === d ? "" : d)}
                  className={cn(
                    "flex-1 rounded-full border px-3 py-2 text-sm transition-colors toque:min-h-11",
                    dificuldade === d ? "border-pen bg-pen text-pen-ink" : "border-line-strong text-ink-2 hover:border-pen hover:text-ink",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </Janela>
  )
}

