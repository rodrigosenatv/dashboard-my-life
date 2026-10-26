"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import {
  ArrowLeft,
  ArrowUpRight,
  BookText,
  Check,
  ChevronDown,
  Copy,
  Ellipsis,
  ImageIcon,
  ImageOff,
  KeyRound,
  Minus,
  NotebookPen,
  Pencil,
  Plus,
  Radar,
  Route,
  Trash,
} from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Esqueleto } from "@/components/ui/basicos"
import { Confirmar } from "@/components/ui/janela"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { EditorMarkdown, Markdown } from "@/components/markdown"
import { useAtualizar, useExcluir } from "@/lib/data"
import { copiarTexto } from "@/lib/copiar"
import { cn } from "@/lib/utils"
import { JanelaAula } from "./aula"
import { CapaCurso, IconePlataforma } from "./capa"
import { apagarCapasDoCurso, useCapaDoCurso, useCapasDosCursos, useCurso, useCursos, useMudarNotas, useMudarStatus, type Curso } from "./dados"
import { BotaoFoco } from "./foco"
import { JanelaCurso } from "./formulario-curso"
import { categoriasDos, editarAula, linkDoCurso, mapaDe, ondeParei, ORDEM_STATUS, partesDoTitulo, plataformaDoLink, plural, STATUS, statusDo, type Aula, type MapaCurso } from "./logica"
import { ListaPraticas } from "./praticar"

const MOLDURA = "tema-cursos plataforma -mx-4 -mb-28 -mt-5 min-h-[calc(100dvh-7rem)] px-4 pb-32 pt-5 sm:mx-0 sm:mb-0 sm:mt-0 sm:min-h-0 sm:rounded-[1.75rem] sm:px-6 sm:pb-10 sm:pt-6 lg:px-8"

/** A tela de um curso: a capa na tela de luz, a situação, a trilha das aulas, o que praticar e o caderno. */
export function PaginaCurso() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: curso, isLoading } = useCurso(id)
  const { data: todos = [] } = useCursos()
  const { data: capas } = useCapasDosCursos()
  const capa = useCapaDoCurso()
  const excluir = useExcluir("courses")
  const [editar, setEditar] = React.useState(false)
  const [apagar, setApagar] = React.useState(false)
  const [janelaAula, setJanelaAula] = React.useState<{ aberta: boolean; aula: Aula | null }>({ aberta: false, aula: null })
  const entradaCapa = React.useRef<HTMLInputElement>(null)
  const categorias = React.useMemo(() => categoriasDos(todos).map((k) => k.nome), [todos])

  if (isLoading)
    return (
      <div className={MOLDURA} aria-busy="true" aria-label="Carregando o curso">
        <div className="grid gap-6 pt-12 sm:grid-cols-[20rem_1fr]">
          <Esqueleto className="aspect-video w-full rounded-2xl bg-white/[0.06]" />
          <div className="grid content-start gap-3">
            <Esqueleto className="h-4 w-40 bg-white/[0.06]" />
            <Esqueleto className="h-10 w-3/4 bg-white/[0.06]" />
            <Esqueleto className="mt-4 h-2 w-full bg-white/[0.06]" />
          </div>
        </div>
      </div>
    )
  if (!curso)
    return (
      <div className={MOLDURA}>
        <div className="vidro mx-auto mt-10 max-w-md px-6 py-10 text-center">
          <p className="font-display text-xl font-semibold">Curso não encontrado</p>
          <p className="mt-1 text-ink-2">Ele pode ter sido excluído.</p>
          <Botao asChild variante="primario" className="mt-5">
            <Link href="/estudos/cursos">Voltar para os cursos</Link>
          </Botao>
        </div>
      </div>
    )

  const mapa = mapaDe(curso.notes)
  const caminhoCapa = capas?.get(curso.id) ?? null
  const anotar = () => setJanelaAula({ aberta: true, aula: null })

  return (
    <div className={MOLDURA}>
      <nav className="flex items-center justify-between gap-2">
        <Link href="/estudos/cursos" className="-ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Cursos
        </Link>
        <div className="flex items-center gap-1">
          <Botao variante="fantasma" tamanho="icone" aria-label="Editar dados do curso" onClick={() => setEditar(true)}>
            <Pencil />
          </Botao>
          <Menu>
            <MenuGatilho asChild>
              <Botao variante="fantasma" tamanho="icone" aria-label="Mais opções do curso">
                <Ellipsis />
              </Botao>
            </MenuGatilho>
            <MenuConteudo className="tema-cursos w-56">
              <MenuItem disabled={capa.enviando} onSelect={() => entradaCapa.current?.click()}>
                <ImageIcon /> {caminhoCapa ? "Trocar capa" : "Pôr uma capa"}
              </MenuItem>
              {caminhoCapa ? (
                <MenuItem onSelect={() => void capa.tirar(curso.id)}>
                  <ImageOff /> Tirar a capa
                </MenuItem>
              ) : null}
              <MenuItem onSelect={() => setEditar(true)}>
                <Pencil /> Editar dados
              </MenuItem>
              <MenuSeparador />
              <MenuItem perigo onSelect={() => setApagar(true)}>
                <Trash /> Excluir curso
              </MenuItem>
            </MenuConteudo>
          </Menu>
        </div>
      </nav>
      <input
        ref={entradaCapa}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const arquivo = e.target.files?.[0]
          e.target.value = ""
          if (arquivo) void capa.enviar(arquivo, curso.id)
        }}
      />

      <Cabeca curso={curso} mapa={mapa} caminhoCapa={caminhoCapa} enviandoCapa={capa.enviando} aoAnotar={anotar} aoCapa={() => entradaCapa.current?.click()} />

      {/* No celular: a trilha, o que praticar, o acesso e o caderno. No computador, praticar e acesso à direita */}
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Trilha curso={curso} mapa={mapa} aoAnotar={anotar} aoAbrirAula={(aula) => setJanelaAula({ aberta: true, aula })} />
        </div>
        <aside className="grid gap-4 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <ListaPraticas curso={curso} praticas={mapa.praticas} />
          <Acesso curso={curso} aoEditar={() => setEditar(true)} />
        </aside>
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <Caderno curso={curso} aberto={!mapa.aulas.length && Boolean(curso.notes?.trim())} />
        </div>
      </div>

      <JanelaCurso aberta={editar} aoMudar={setEditar} curso={curso} categorias={categorias} />
      <JanelaAula curso={curso} aula={janelaAula.aula} aberta={janelaAula.aberta} aoMudar={(v) => !v && setJanelaAula({ aberta: false, aula: null })} />
      <Confirmar
        aberta={apagar}
        aoMudar={setApagar}
        className="tema-cursos"
        titulo={`Excluir “${curso.name}”?`}
        descricao="O curso, as aulas anotadas e as ações saem da plataforma."
        aoConfirmar={() => {
          excluir.mutate(curso.id, {
            onSuccess: () => {
              void apagarCapasDoCurso(curso.id)
              toast.success("Curso excluído.")
            },
          })
          router.push("/estudos/cursos")
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cabeça                                                              */
/* ------------------------------------------------------------------ */

function Cabeca({
  curso,
  mapa,
  caminhoCapa,
  enviandoCapa,
  aoAnotar,
  aoCapa,
}: {
  curso: Curso
  mapa: MapaCurso
  caminhoCapa: string | null
  enviandoCapa: boolean
  aoAnotar: () => void
  aoCapa: () => void
}) {
  const mudarStatus = useMudarStatus()
  const s = statusDo(curso)
  const link = linkDoCurso(curso.url)
  const plataforma = plataformaDoLink(curso.url)
  const parou = ondeParei(mapa)
  const feitas = mapa.praticas.filter((p) => p.feito).length

  return (
    <header className="mt-4 grid gap-6 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] sm:items-center sm:gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div className="tela-holo">
        <button type="button" onClick={aoCapa} aria-label={caminhoCapa ? "Trocar a capa do curso" : "Pôr uma capa no curso"} className="tela-conteudo group block aspect-video w-full">
          <CapaCurso curso={curso} caminho={caminhoCapa} prioridade />
          <span className={cn("absolute inset-0 z-10 grid place-items-center bg-black/45 text-sm font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100", enviandoCapa && "opacity-100")}>
            {enviandoCapa ? "Enviando a capa…" : caminhoCapa ? "Trocar capa" : "Pôr uma capa"}
          </span>
        </button>
      </div>

      <div className="flex min-w-0 flex-col">
        <p className="rotulo-hud flex flex-wrap items-center gap-x-2 gap-y-1">
          {s === "em_andamento" ? (
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--b-luz)] opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-[var(--b-luz)]" />
            </span>
          ) : null}
          {STATUS[s].rotulo}
          {plataforma ? (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <IconePlataforma id={plataforma.id} className="size-3" /> {plataforma.nome}
              </span>
            </>
          ) : null}
        </p>
        <h1 className="mt-2 font-display text-[1.9rem] font-semibold leading-[1.08] tracking-tight text-balance sm:text-[2.6rem]">{curso.name}</h1>
        {curso.categories.length ? (
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Áreas">
            {curso.categories.map((k) => (
              <li key={k}>
                <Link
                  href={`/estudos/cursos?ver=todos&area=${encodeURIComponent(k)}`}
                  className="inline-flex rounded-full border border-[var(--b-borda)] bg-white/[0.04] px-2.5 py-0.5 text-xs text-ink-2 hover:border-[var(--b-borda-2)] hover:text-ink"
                >
                  {k}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <div role="radiogroup" aria-label="Situação do curso" className="order-4 mt-5 flex flex-wrap gap-1.5 sm:order-none">
          {ORDEM_STATUS.map((st) => {
            const ativo = st === s
            return (
              <button
                key={st}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => mudarStatus(curso, st)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors toque:min-h-11",
                  ativo
                    ? st === "concluido"
                      ? "border-[var(--b-ambar)] bg-[var(--b-ambar)]/15 text-ink"
                      : "border-[var(--b-luz)] bg-[var(--b-luz)]/12 text-ink shadow-[0_0_16px_-6px_var(--b-luz)]"
                    : "border-[var(--b-borda)] text-ink-2 hover:border-[var(--b-borda-2)] hover:text-ink",
                )}
              >
                {ativo ? <Check className="size-3.5" aria-hidden /> : null}
                {STATUS[st].rotulo}
              </button>
            )
          })}
        </div>

        <div className="order-5 sm:order-none">
          <ControleProgresso curso={curso} />
        </div>

        <p className="order-6 mt-3 text-sm text-ink-3 sm:order-none">
          {plural(mapa.aulas.length, "aula anotada", "aulas anotadas")}
          {mapa.modulos.length > 1 ? ` em ${plural(mapa.modulos.length, "módulo")}` : ""}
          {mapa.praticas.length ? ` · ${feitas} de ${plural(mapa.praticas.length, "ação feita", "ações feitas")}` : ""}
          {parou && s !== "concluido" ? (
            <>
              {" · "}
              <span className="text-ink-2">
                <Radar className="mr-1 inline size-3.5 -translate-y-px text-[var(--b-rosa)]" aria-hidden />
                parou em {partesDoTitulo(parou.titulo).nome}
              </span>
            </>
          ) : null}
        </p>

        <div className="order-3 mt-5 flex flex-wrap gap-2 sm:order-none">
          {link ? (
            <Botao asChild variante="primario" tamanho="lg" className="flex-1 shadow-[0_0_26px_-6px_var(--b-luz)] sm:flex-none">
              <a href={link} target="_blank" rel="noopener noreferrer">
                {plataforma ? <IconePlataforma id={plataforma.id} /> : <ArrowUpRight />} {s === "concluido" ? (plataforma?.acao ?? "Abrir o curso") : plataforma?.em ? `Continuar ${plataforma.em}` : "Continuar o curso"}
              </a>
            </Botao>
          ) : null}
          <Botao variante={link ? "contorno" : "primario"} tamanho="lg" onClick={aoAnotar} className={cn(link ? "bg-transparent" : "flex-1 sm:flex-none")}>
            <NotebookPen /> Anotar aula
          </Botao>
          <BotaoFoco />
        </div>
      </div>
    </header>
  )
}

/** O progresso em passos de 5%: muda na hora e grava quando a pessoa para de mexer. */
function ControleProgresso({ curso }: { curso: Curso }) {
  const { mutate } = useAtualizar("courses")
  const s = statusDo(curso)
  const [valor, setValor] = React.useState<number | null>(curso.progress)
  const espera = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  React.useEffect(() => setValor(curso.progress), [curso.progress])
  React.useEffect(() => () => clearTimeout(espera.current), [])

  if (s === "concluido") {
    return (
      <div className="mt-5 flex items-center gap-3">
        <div className="barra-luz flex-1 [&>span]:!bg-[var(--b-ambar)] [&>span]:shadow-[0_0_14px_rgb(245_197_74/0.6)]" aria-hidden>
          <span style={{ width: "100%" }} />
        </div>
        <span className="text-sm font-semibold text-[var(--b-ambar)]">Concluído</span>
      </div>
    )
  }

  const gravar = (n: number) => {
    setValor(n)
    clearTimeout(espera.current)
    espera.current = setTimeout(() => mutate({ id: curso.id, progress: n }), 600)
  }
  const passo = (d: number) => gravar(Math.max(0, Math.min(100, Math.round(((valor ?? 0) + d) / 5) * 5)))

  if (valor === null) {
    return (
      <div className="mt-5 flex items-center gap-3 text-sm text-ink-3">
        <span>Progresso não informado.</span>
        <button type="button" onClick={() => gravar(0)} className="min-h-10 rounded-full px-2 font-medium text-[var(--b-luz)] hover:bg-white/[0.06]">
          Informar
        </button>
      </div>
    )
  }
  return (
    <div className="mt-5 flex items-center gap-2">
      <div className="barra-luz flex-1" role="progressbar" aria-label={`Progresso de ${curso.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={valor}>
        <span style={{ width: `${valor}%` }} />
      </div>
      <button type="button" aria-label="Menos 5%" onClick={() => passo(-5)} disabled={valor <= 0} className="grid size-9 place-items-center rounded-full border border-[var(--b-borda)] text-ink-2 hover:border-[var(--b-borda-2)] hover:text-ink disabled:opacity-40 toque:size-11">
        <Minus className="size-4" />
      </button>
      <span className="tabular w-11 text-center text-sm font-semibold" aria-live="polite">
        {valor}%
      </span>
      <button type="button" aria-label="Mais 5%" onClick={() => passo(5)} disabled={valor >= 100} className="grid size-9 place-items-center rounded-full border border-[var(--b-borda)] text-ink-2 hover:border-[var(--b-borda-2)] hover:text-ink disabled:opacity-40 toque:size-11">
        <Plus className="size-4" />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Trilha                                                              */
/* ------------------------------------------------------------------ */

/** Texto curto para a prévia de uma aula (sem marcação). */
function previa(corpo: string): string {
  return corpo
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s*([-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+|>\s*|#{1,6}\s+)/, "")
        .replace(/(\*\*|__|`)/g, "")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .trim(),
    )
    .filter(Boolean)
    .join(" · ")
}

function Trilha({ curso, mapa, aoAnotar, aoAbrirAula }: { curso: Curso; mapa: MapaCurso; aoAnotar: () => void; aoAbrirAula: (a: Aula) => void }) {
  const mudar = useMudarNotas()
  const [abertas, setAbertas] = React.useState<Set<number>>(() => new Set())
  const ultima = mapa.aulas[mapa.aulas.length - 1]
  const s = statusDo(curso)

  const alternar = (linha: number) =>
    setAbertas((atual) => {
      const novo = new Set(atual)
      if (novo.has(linha)) novo.delete(linha)
      else novo.add(linha)
      return novo
    })

  return (
    <section aria-labelledby="titulo-trilha" className="min-w-0">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="rotulo-hud flex items-center gap-2">
            <Route className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Trilha
          </p>
          <h2 id="titulo-trilha" className="mt-1 font-display text-2xl font-semibold">
            Aulas
          </h2>
        </div>
        {mapa.aulas.length ? (
          <Botao variante="contorno" onClick={aoAnotar} className="bg-transparent">
            <Plus /> Anotar aula
          </Botao>
        ) : null}
      </div>

      {mapa.aulas.length ? (
        <ol className="trilha mt-5 grid">
          {mapa.aulas.map((a, i) => {
            const p = partesDoTitulo(a.titulo)
            const novoModulo = a.modulo && (i === 0 || mapa.aulas[i - 1].modulo !== a.modulo)
            const atual = a === ultima && s !== "concluido"
            const aberta = abertas.has(a.linha)
            const resumo = previa(a.corpo)
            return (
              <React.Fragment key={`${a.linha}:${a.titulo}`}>
                {novoModulo ? (
                  <li className={cn("relative z-[1] pb-3 pl-10", i > 0 && "pt-4")} aria-hidden>
                    <span className="rotulo-hud text-[var(--b-luz-2)]">{a.modulo}</span>
                  </li>
                ) : null}
                <li className="flex gap-4">
                  <span className="no-trilha mt-0.5" data-atual={atual ? "" : undefined} aria-hidden>
                    {s === "concluido" ? <Check className="size-3 text-[var(--b-luz)]" /> : <span className="size-1.5 rounded-full bg-[var(--b-luz)]" />}
                  </span>
                  <div className="min-w-0 flex-1 pb-5">
                    <button type="button" aria-expanded={aberta} onClick={() => alternar(a.linha)} className="group flex w-full items-start gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--b-luz)]/50">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {p.numero ? <span className="tabular font-display text-sm font-semibold text-[var(--b-luz)]">{p.numero}</span> : null}
                          <span className="font-medium leading-snug group-hover:text-[var(--b-luz)]">{p.nome}</span>
                          {p.tag ? <span className="rounded-md border border-[var(--b-borda)] px-1.5 py-px font-mono text-[11px] text-ink-3">{p.tag}</span> : null}
                          {atual ? <span className="rounded-full bg-[var(--b-rosa)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--b-rosa)]">Você parou aqui</span> : null}
                        </span>
                        {!aberta && resumo ? <span className="mt-1 line-clamp-2 block text-sm text-ink-3">{resumo}</span> : null}
                      </span>
                      <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-ink-3 transition-transform", aberta && "rotate-180")} aria-hidden />
                    </button>
                    {aberta ? (
                      <div className="mt-2 rounded-xl border border-[var(--b-borda)] bg-white/[0.03] p-3.5 sm:p-4">
                        {a.corpo ? (
                          <Markdown texto={a.corpo} aoMudar={(novo) => mudar(curso, (t) => editarAula(t, a, { titulo: a.titulo, corpo: novo }))} className="text-[15px]" />
                        ) : (
                          <p className="text-sm text-ink-3">Nada anotado nesta aula.</p>
                        )}
                        <div className="mt-3 flex justify-end">
                          <Botao variante="fantasma" tamanho="sm" onClick={() => aoAbrirAula(a)}>
                            <Pencil /> Editar aula
                          </Botao>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </li>
              </React.Fragment>
            )
          })}
          {s !== "concluido" ? (
            <li className="flex gap-4">
              <button type="button" onClick={aoAnotar} aria-label="Anotar a próxima aula" className="no-trilha border-dashed !shadow-none hover:border-[var(--b-luz)]">
                <Plus className="size-3 text-[var(--b-luz)]" aria-hidden />
              </button>
              <button type="button" onClick={aoAnotar} className="-mt-0.5 min-h-8 text-left text-sm font-medium text-[var(--b-luz)] hover:underline">
                Anotar a próxima aula
              </button>
            </li>
          ) : null}
        </ol>
      ) : (
        <div className="vidro mt-5 px-5 py-8 text-center">
          <Route className="mx-auto size-7 text-[var(--b-luz)]" aria-hidden />
          <p className="mt-2 font-medium">A trilha começa na primeira aula</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">Anote cada aula ao terminar: o que aprendeu e o que vai praticar. A última anotada mostra onde você parou.</p>
          <Botao variante="primario" className="mt-4" onClick={aoAnotar}>
            <NotebookPen /> Anotar a primeira aula
          </Botao>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Caderno e acesso                                                    */
/* ------------------------------------------------------------------ */

function Caderno({ curso, aberto: abertoAntes }: { curso: Curso; aberto: boolean }) {
  const mudar = useMudarNotas()
  const [aberto, setAberto] = React.useState(abertoAntes)
  return (
    <section aria-labelledby="titulo-caderno" className="vidro p-4 sm:p-6">
      <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="rotulo-hud flex items-center gap-2">
            <BookText className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Caderno do curso
          </span>
          <span id="titulo-caderno" className="mt-1 block text-sm text-ink-2">
            Todas as anotações: links, materiais, a trilha e as ações, do jeito que estão escritas.
          </span>
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-ink-3 transition-transform", aberto && "rotate-180")} aria-hidden />
      </button>
      {aberto ? (
        <div className="mt-4">
          <EditorMarkdown rotulo={`anotações de ${curso.name}`} valor={curso.notes ?? ""} aoSalvar={(v) => mudar(curso, () => v)} />
        </div>
      ) : null}
    </section>
  )
}

function Acesso({ curso, aoEditar }: { curso: Curso; aoEditar: () => void }) {
  const link = linkDoCurso(curso.url)
  const plataforma = plataformaDoLink(curso.url)
  let dominio = ""
  try {
    dominio = link ? new URL(link).hostname.replace(/^www\./, "") : ""
  } catch {}
  return (
    <section aria-labelledby="titulo-acesso" className="vidro p-4 sm:p-5">
      <h2 id="titulo-acesso" className="rotulo-hud flex items-center gap-2">
        <KeyRound className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Acesso
      </h2>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--b-borda)] bg-white/[0.03] px-3 py-2.5 hover:border-[var(--b-borda-2)]">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--b-luz)]/12 text-[var(--b-luz)]">
            <IconePlataforma id={plataforma?.id ?? "site"} className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{plataforma && plataforma.id !== "site" ? plataforma.nome : dominio}</span>
            <span className="block truncate text-xs text-ink-3">{dominio}</span>
          </span>
          <ArrowUpRight className="size-4 shrink-0 text-ink-3" aria-hidden />
        </a>
      ) : (
        <p className="mt-2 text-sm text-ink-2">Sem link de acesso.</p>
      )}
      {curso.access_email ? (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--b-borda)] bg-white/[0.03] px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-ink-3">E-mail de acesso</span>
            <span className="block truncate text-sm">{curso.access_email}</span>
          </span>
          <button
            type="button"
            aria-label="Copiar o e-mail de acesso"
            onClick={async () => {
              if (await copiarTexto(curso.access_email ?? "")) toast.success("E-mail copiado.")
              else toast.error("Não foi possível copiar.")
            }}
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-white/[0.06] hover:text-ink toque:size-11"
          >
            <Copy className="size-4" />
          </button>
        </div>
      ) : null}
      <button type="button" onClick={aoEditar} className="mt-3 min-h-10 rounded-full px-2 text-sm font-medium text-[var(--b-luz)] hover:bg-white/[0.06]">
        {link || curso.access_email ? "Editar acesso" : "Pôr o link e o e-mail"}
      </button>
    </section>
  )
}
