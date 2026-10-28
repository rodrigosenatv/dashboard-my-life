"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import * as React from "react"
import { ArrowUp, CalendarRange, Check, Clapperboard, Copy, GraduationCap, History, Inbox, Library, ListChecks, Plus, Search, Sparkles, Square, Trash, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Janela } from "@/components/ui/janela"
import { Markdown } from "@/components/markdown"
import { CHAVE_PROMPT } from "@/lib/ia/info"
import { copiarTexto } from "@/lib/copiar"
import { novoId, useAtualizar, useCriar, useExcluir } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import { cn, contem, dataRelativa } from "@/lib/utils"
import { useDoisToques } from "@/components/ui/botao-excluir"
import { infoProvedor, type Provedor } from "@/lib/ia/info"
import { credencial, provedoresAtivos, useConfigIA } from "@/lib/ia/chaves-locais"
import { camposDoPrompt, preencherPrompt, usePromptsBiblioteca } from "@/features/paginas/prompts"
import { TextoPrompt } from "@/features/conteudo/texto-prompt"
import { CabecalhoEstudio, MolduraEstudio } from "@/features/conteudo/moldura"
import { SECAO_CONVERSAS, conversaParaTexto, textoParaConversa, tituloDaConversa, useConversas, type Mensagem } from "./conversas"

/** Começo da mensagem que o servidor manda quando a resposta falha. */
const MARCA_ERRO = "[Não foi possível"

const SUGESTOES: { titulo: string; texto: string; icone: LucideIcon; cor: string }[] = [
  { titulo: "Planejar a semana", texto: "Me ajude a planejar minha semana a partir das minhas prioridades.", icone: CalendarRange, cor: "var(--b-violeta)" },
  { titulo: "Ideias de Reels", texto: "Crie 10 ideias de Reels sobre produtividade para quem estuda para concursos.", icone: Clapperboard, cor: "var(--b-luz)" },
  { titulo: "Resumir um tema", texto: "Resuma em tópicos o que eu preciso saber sobre [TEMA].", icone: ListChecks, cor: "var(--b-luz-2)" },
  { titulo: "Plano de estudos", texto: "Monte um plano de estudos de 4 semanas para [DISCIPLINA].", icone: GraduationCap, cor: "var(--b-ambar)" },
]

const BOTAO_REDONDO =
  "grid size-10 shrink-0 place-items-center rounded-full border border-[var(--b-borda)] text-ink-2 transition-colors hover:border-[var(--b-borda-2)] hover:text-ink disabled:opacity-40"

/* ------------------------------------------------------------------ */
/* Escolher um prompt da biblioteca                                    */
/* ------------------------------------------------------------------ */

function EscolherPrompt({ aberta, aoMudar, aoEscolher }: { aberta: boolean; aoMudar: (v: boolean) => void; aoEscolher: (texto: string) => void }) {
  const { prompts, isLoading } = usePromptsBiblioteca(aberta)
  const [busca, setBusca] = React.useState("")
  const lista = prompts.filter((p) => !busca || contem(`${p.modulo} ${p.pagina} ${p.titulo} ${p.texto}`, busca)).slice(0, 80)
  return (
    <Janela aberta={aberta} aoMudar={aoMudar} titulo="Prompts da biblioteca" largura="lg">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por assunto, módulo, página ou palavra"
          aria-label="Buscar prompt"
          className="h-11 w-full rounded-full border border-line-strong bg-surface pl-10 pr-3 text-base placeholder:text-ink-3 focus-visible:border-pen focus-visible:outline-none sm:text-sm"
        />
      </div>
      {isLoading ? (
        <p className="py-6 text-center text-sm text-ink-3">Carregando prompts…</p>
      ) : lista.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-2">
          {prompts.length ? "Nenhum prompt com esse texto." : "Nenhum prompt na biblioteca ainda. Blocos de código nas páginas da Biblioteca e do Planner aparecem aqui."}
        </p>
      ) : (
        <ul className="grid max-h-[60vh] gap-2 overflow-y-auto pr-1 scrollbar-thin">
          {lista.map((p) => (
            <li key={p.chave}>
              <button
                type="button"
                onClick={() => {
                  aoEscolher(p.texto)
                  aoMudar(false)
                }}
                className="w-full rounded-xl border border-line bg-ink/[0.03] p-3 text-left transition-colors hover:border-pen hover:bg-ink/[0.05]"
              >
                <span className="block truncate text-xs text-ink-3">{[p.modulo !== p.pagina ? p.modulo : "", p.pagina].filter(Boolean).join(" › ")}</span>
                {p.titulo ? <span className="mt-0.5 block text-sm font-medium">{p.titulo}</span> : null}
                <span className="mt-1 line-clamp-3 block font-mono text-xs leading-relaxed text-ink-2">
                  <TextoPrompt texto={p.texto} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Janela>
  )
}

/* ------------------------------------------------------------------ */
/* Histórico                                                           */
/* ------------------------------------------------------------------ */

function ExcluirConversa({ titulo, aoExcluir }: { titulo: string; aoExcluir: () => void }) {
  const { armado, tocar, desarmar } = useDoisToques(aoExcluir)
  return (
    <button
      type="button"
      aria-label={armado ? `Confirmar exclusão da conversa ${titulo}` : `Excluir conversa ${titulo}`}
      title={armado ? "Toque de novo para excluir" : "Excluir conversa"}
      onClick={tocar}
      onBlur={desarmar}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full hover:text-danger focus-visible:opacity-100 toque:opacity-100",
        armado ? "bg-danger-soft text-danger opacity-100" : "text-ink-3 opacity-0 group-hover:opacity-100",
      )}
    >
      {armado ? <Check className="size-3.5" /> : <Trash className="size-3.5" />}
    </button>
  )
}

function ListaConversas({ atual, aoAbrir, aoNova }: { atual: string | null; aoAbrir: (id: string) => void; aoNova: () => void }) {
  const { data: conversas = [] } = useConversas()
  const excluir = useExcluir("pages")
  return (
    <div>
      <button
        type="button"
        onClick={aoNova}
        className="mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--b-luz)]/45 bg-[var(--b-luz)]/[0.1] px-4 text-sm font-semibold transition-colors hover:border-[var(--b-luz)] hover:bg-[var(--b-luz)]/[0.18]"
      >
        <Plus className="size-4 text-[var(--b-luz)]" /> Nova conversa
      </button>
      {conversas.length === 0 ? (
        <p className="px-1 text-sm text-ink-3">As conversas ficam salvas aqui.</p>
      ) : (
        <>
          <p className="rotulo-hud mb-1.5 px-2">Conversas salvas</p>
          <ul className="grid gap-0.5">
            {conversas.map((c) => {
              const ativa = c.id === atual
              return (
                <li key={c.id} className="group relative flex min-w-0 items-center">
                  {ativa ? <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[var(--b-luz)]" /> : null}
                  <button
                    type="button"
                    onClick={() => aoAbrir(c.id)}
                    aria-current={ativa ? "true" : undefined}
                    className={cn("min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-ink/[0.05]", ativa && "bg-[var(--b-luz)]/[0.1] font-medium")}
                  >
                    <span className="block truncate">{c.title}</span>
                    <span className="block text-xs font-normal text-ink-3 first-letter:uppercase">{dataRelativa(c.updated_at.slice(0, 10))}</span>
                  </button>
                  <ExcluirConversa
                    titulo={c.title}
                    aoExcluir={() => {
                      excluir.mutate(c.id)
                      if (c.id === atual) aoNova()
                    }}
                  />
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Ações de cada resposta                                              */
/* ------------------------------------------------------------------ */

function AcoesResposta({ texto, pergunta }: { texto: string; pergunta: string }) {
  const [copiado, setCopiado] = React.useState(false)
  const [salvo, setSalvo] = React.useState(false)
  const criar = useCriar("captures")
  const titulo = (pergunta.split("\n").find((l) => l.trim()) ?? "Resposta do assistente").slice(0, 90)
  const estilo = "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[var(--b-borda)] px-3 text-xs font-medium text-ink-2 transition-colors hover:border-[var(--b-borda-2)] hover:text-ink toque:min-h-10"
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      <button
        type="button"
        className={estilo}
        onClick={async () => {
          if (!(await copiarTexto(texto))) return void toast.error("Não foi possível copiar.")
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1500)
        }}
      >
        {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copiado ? "Copiado" : "Copiar"}
      </button>
      <button
        type="button"
        className={estilo}
        disabled={salvo}
        onClick={() =>
          criar.mutate(
            { id: novoId(), title: titulo, content: texto, tags: ["assistente"] },
            {
              onSuccess: () => {
                setSalvo(true)
                toast.success("Salvo na Caixa de Entrada.")
              },
            },
          )
        }
      >
        {salvo ? <Check className="size-3.5 text-[var(--b-verde)]" /> : <Inbox className="size-3.5" />} {salvo ? "Na Caixa de Entrada" : "Guardar na Caixa de Entrada"}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export function PaginaAssistente() {
  const cfgIA = useConfigIA()
  const ativos = provedoresAtivos(cfgIA)
  const opcoesIA: Provedor[] = ativos
  const [escolhida, setEscolhida] = React.useState<Provedor | null>(null)
  const provedor: Provedor | undefined = escolhida && opcoesIA.includes(escolhida) ? escolhida : opcoesIA[0]
  const criarPagina = useCriar("pages")
  const atualizarPagina = useAtualizar("pages", { silencioso: true })

  const [conversaId, setConversaId] = React.useState<string | null>(null)
  const [mensagens, setMensagens] = React.useState<Mensagem[]>([])
  const [texto, setTexto] = React.useState("")
  const [campos, setCampos] = React.useState<Record<string, string>>({})
  const [respondendo, setRespondendo] = React.useState(false)
  const [verPrompts, setVerPrompts] = React.useState(false)
  const [verHistorico, setVerHistorico] = React.useState(false)
  const abortar = React.useRef<AbortController | null>(null)
  const fim = React.useRef<HTMLDivElement>(null)
  const entrada = React.useRef<HTMLTextAreaElement>(null)

  // Prompt mandado de outra tela ("Usar no assistente")
  React.useEffect(() => {
    try {
      const p = sessionStorage.getItem(CHAVE_PROMPT)
      if (p) {
        sessionStorage.removeItem(CHAVE_PROMPT)
        setTexto(p)
      }
    } catch {}
  }, [])

  React.useEffect(() => {
    if (mensagens.length) fim.current?.scrollIntoView({ block: "end" })
  }, [mensagens])

  // Sair da tela interrompe a resposta em andamento (e a cobrança dela)
  React.useEffect(() => () => abortar.current?.abort(), [])

  const listaCampos = camposDoPrompt(texto)

  const usarTexto = (t: string) => {
    setTexto(t)
    setCampos({})
    requestAnimationFrame(() => entrada.current?.focus())
  }

  const nova = () => {
    abortar.current?.abort()
    setConversaId(null)
    setMensagens([])
    setTexto("")
    setCampos({})
    setVerHistorico(false)
  }

  const abrir = async (id: string) => {
    abortar.current?.abort()
    const { data, error } = await supabase().from("pages").select("content").eq("id", id).maybeSingle()
    if (error || !data) return toast.error("Não foi possível abrir a conversa.")
    setConversaId(id)
    setMensagens(textoParaConversa(data.content))
    setVerHistorico(false)
  }

  const salvarConversa = async (lista: Mensagem[], id: string | null): Promise<string | null> => {
    if (!lista.some((m) => m.role === "assistant" && m.content.trim())) return id
    const content = conversaParaTexto(lista)
    if (id) {
      atualizarPagina.mutate({ id, content })
      return id
    }
    const nid = novoId()
    try {
      await criarPagina.mutateAsync({ id: nid, title: tituloDaConversa(lista), section: SECAO_CONVERSAS, content, position: Date.now() % 1_000_000 })
      return nid
    } catch {
      return null
    }
  }

  const enviar = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const t = preencherPrompt(texto, campos).trim()
    if (!t || respondendo) return
    const cred = provedor ? credencial(cfgIA, provedor) : null
    if (!provedor || !cred) {
      toast.error("Configure sua própria chave de IA em Configurações antes de enviar.")
      return
    }
    const historico: Mensagem[] = [...mensagens, { role: "user", content: t }]
    setMensagens([...historico, { role: "assistant", content: "" }])
    setTexto("")
    setCampos({})
    setRespondendo(true)
    const ctrl = new AbortController()
    abortar.current = ctrl
    let acumulado = ""
    try {
      const r = await fetch("/api/ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensagens: historico, provedor, chave: cred?.chave, modelo: cred?.modelo }), signal: ctrl.signal })
      if (!r.ok || !r.body) {
        const corpo = await r.json().catch(() => ({}))
        throw new Error(corpo.erro ?? `Erro ${r.status}`)
      }
      const leitor = r.body.getReader()
      const dec = new TextDecoder()
      for (;;) {
        const { done, value } = await leitor.read()
        if (done) break
        acumulado += dec.decode(value, { stream: true })
        setMensagens([...historico, { role: "assistant", content: acumulado }])
      }
    } catch (erro) {
      if ((erro as Error).name !== "AbortError") {
        acumulado = ""
        setMensagens([...historico, { role: "assistant", content: `Não foi possível responder: ${(erro as Error).message}` }])
      }
    } finally {
      setRespondendo(false)
      abortar.current = null
    }
    if (acumulado.trim() && !acumulado.trimStart().startsWith(MARCA_ERRO)) {
      const final = [...historico, { role: "assistant" as const, content: acumulado }]
      const id = await salvarConversa(final, conversaId)
      if (id) setConversaId(id)
    }
  }

  if (!opcoesIA.length) {
    return (
      <MolduraEstudio>
        <CabecalhoEstudio icone={Sparkles} papel="Converse com a IA" titulo="Assistente" />
        <div className="vidro mx-auto flex max-w-xl flex-col items-center px-6 py-10 text-center sm:py-12">
          <span className="orbe-ia size-20" data-apagado="" aria-hidden />
          <h2 className="mt-7 font-display text-xl font-semibold">Nenhuma IA ligada neste navegador.</h2>
          <p className="mt-2 text-sm text-ink-2">
            Cadastre a chave de API do Claude, do ChatGPT ou do Gemini em Configurações. A chave fica guardada só neste navegador, e o uso é cobrado pela empresa da IA conforme o consumo.
          </p>
          <Link
            href="/configuracoes#ia"
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-pen px-5 text-sm font-semibold text-pen-ink transition-[filter] hover:brightness-110"
          >
            Abrir Configurações
          </Link>
        </div>
      </MolduraEstudio>
    )
  }

  const nomeIA = provedor ? (infoProvedor(provedor)?.nome ?? "IA") : "IA"

  return (
    <MolduraEstudio className="flex flex-col sm:min-h-[calc(100dvh-6rem)]">
      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-8">
        <div className="flex min-w-0 flex-1 flex-col">
          <CabecalhoEstudio
            icone={Sparkles}
            papel="Converse com a IA"
            titulo="Assistente"
            className="mb-5 sm:mb-6"
            descricao={
              mensagens.length ? undefined : (
                <>
                  Converse com a IA ou use um prompt da{" "}
                  <Link href="/conteudo/biblioteca" className="text-[var(--b-luz)] hover:underline">
                    biblioteca
                  </Link>
                  . As conversas ficam salvas.
                </>
              )
            }
            acoes={
              <div className="flex gap-2 lg:hidden">
                <button type="button" aria-label="Conversas salvas" onClick={() => setVerHistorico(true)} className={BOTAO_REDONDO}>
                  <History className="size-4" />
                </button>
                {mensagens.length ? (
                  <button type="button" aria-label="Nova conversa" onClick={nova} className={BOTAO_REDONDO}>
                    <Plus className="size-4" />
                  </button>
                ) : null}
              </div>
            }
          />

          <div className="flex-1">
            {mensagens.length === 0 ? (
              <div className="mx-auto flex max-w-3xl flex-col items-center pb-4 pt-2 text-center sm:pt-6">
                <span className="orbe-ia size-20 sm:size-24" aria-hidden />
                <h2 className="mt-7 font-display text-2xl font-semibold sm:text-3xl">Como posso ajudar hoje?</h2>
                <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--b-borda)] bg-ink/[0.03] px-3 py-1 text-xs text-ink-2">
                  <span aria-hidden className="size-2 rounded-full bg-[var(--b-verde)]" />
                  {nomeIA} conectado
                </p>
                <ul className="mt-7 grid w-full gap-2 text-left sm:grid-cols-2">
                  {SUGESTOES.map((s) => (
                    <li key={s.titulo}>
                      <button type="button" onClick={() => usarTexto(s.texto)} className="vidro-vivo flex h-full w-full items-start gap-3 p-3.5 text-left">
                        <span className="icone-aceso size-9" style={{ "--cor": s.cor } as React.CSSProperties} aria-hidden>
                          <s.icone className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{s.titulo}</span>
                          <span className="mt-0.5 block text-sm text-ink-2">{s.texto}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setVerPrompts(true)}
                  className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--b-borda)] px-4 text-sm text-ink-2 transition-colors hover:border-[var(--b-luz)] hover:text-ink"
                >
                  <Library className="size-4 text-[var(--b-luz)]" /> Escolher um prompt da biblioteca
                </button>
              </div>
            ) : (
              <ol className="mx-auto grid max-w-3xl gap-6" aria-label="Conversa">
                {mensagens.map((m, i) => {
                  const pensando = respondendo && i === mensagens.length - 1
                  return m.role === "user" ? (
                    <li key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md border border-[var(--b-luz)]/30 bg-[var(--b-luz)]/[0.1] px-4 py-3">
                      <p className="whitespace-pre-wrap text-[15px]">{m.content}</p>
                    </li>
                  ) : (
                    <li key={i} className="flex min-w-0 gap-3">
                      <span className="orbe-ia mt-0.5 size-7" data-pensando={pensando ? "" : undefined} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="sr-only">{nomeIA}:</p>
                        {m.content ? (
                          <>
                            <Markdown texto={m.content} videos={false} />
                            {!pensando && !m.content.trimStart().startsWith(MARCA_ERRO) && !m.content.startsWith("Não foi possível") ? <AcoesResposta texto={m.content} pergunta={mensagens[i - 1]?.content ?? ""} /> : null}
                          </>
                        ) : (
                          <p className="pt-1 text-sm text-ink-3" role="status">
                            Pensando…
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
            <div ref={fim} />
          </div>

          <form onSubmit={enviar} className="sticky bottom-24 z-10 mx-auto mt-6 w-full max-w-3xl lg:bottom-6">
            <div className="console-ia p-2">
              {listaCampos.length ? (
                <fieldset className="mb-2 grid gap-2 border-b border-[var(--b-borda)] px-1 pb-3 sm:grid-cols-2">
                  <legend className="rotulo-hud mb-1.5 px-1">Preencha o prompt</legend>
                  {listaCampos.map((c) => (
                    <label key={c} className="grid gap-1 text-xs text-ink-2">
                      <span className="font-mono text-[var(--b-luz)]">{c}</span>
                      <input
                        value={campos[c] ?? ""}
                        onChange={(e) => setCampos((v) => ({ ...v, [c]: e.target.value }))}
                        className="h-10 rounded-xl border border-[var(--b-borda)] bg-surface px-3 text-base text-ink focus-visible:border-[var(--b-luz)] focus-visible:outline-none sm:h-9 sm:text-sm"
                      />
                    </label>
                  ))}
                </fieldset>
              ) : null}
              {/* No celular, o campo ocupa a linha de cima e os botões ficam embaixo; no computador, tudo numa linha */}
              <div className="flex flex-wrap items-end gap-2 sm:flex-nowrap">
                <button type="button" aria-label="Escolher prompt da biblioteca" title="Prompts da biblioteca" onClick={() => setVerPrompts(true)} className={cn(BOTAO_REDONDO, "border-transparent")}>
                  <Library className="size-4" />
                </button>
                {opcoesIA.length > 1 ? (
                  <select
                    value={provedor}
                    onChange={(e) => setEscolhida(e.target.value as Provedor)}
                    aria-label="IA usada"
                    className="h-10 max-w-28 shrink-0 rounded-full border border-[var(--b-borda)] bg-surface px-3 text-xs text-ink-2"
                  >
                    {opcoesIA.map((id) => (
                      <option key={id} value={id}>
                        {infoProvedor(id)?.nome}
                      </option>
                    ))}
                  </select>
                ) : null}
                <textarea
                  ref={entrada}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      enviar()
                    }
                  }}
                  rows={Math.min(8, Math.max(1, texto.split("\n").length))}
                  placeholder={`Pergunte qualquer coisa ao ${nomeIA}`}
                  aria-label="Mensagem para o assistente"
                  className="order-first max-h-60 min-h-11 w-full flex-1 basis-full resize-none bg-transparent px-2 py-2 text-base outline-none placeholder:text-ink-3 sm:order-none sm:basis-auto sm:text-[15px]"
                />
                <span aria-hidden className="flex-1 sm:hidden" />
                {respondendo ? (
                  <Botao variante="secundario" tamanho="icone" className="size-10 rounded-full" aria-label="Parar" onClick={() => abortar.current?.abort()}>
                    <Square />
                  </Botao>
                ) : (
                  <Botao type="submit" variante="primario" tamanho="icone" className="size-10 rounded-full" aria-label="Enviar" disabled={!texto.trim()}>
                    <ArrowUp />
                  </Botao>
                )}
              </div>
            </div>
          </form>
        </div>

        <aside aria-label="Conversas salvas" className="hidden min-w-0 lg:block">
          <div className="vidro sticky top-6 p-3">
            <ListaConversas atual={conversaId} aoAbrir={abrir} aoNova={nova} />
          </div>
        </aside>
      </div>

      <Janela aberta={verHistorico} aoMudar={setVerHistorico} titulo="Conversas">
        <ListaConversas atual={conversaId} aoAbrir={abrir} aoNova={nova} />
      </Janela>
      <EscolherPrompt aberta={verPrompts} aoMudar={setVerPrompts} aoEscolher={usarTexto} />
    </MolduraEstudio>
  )
}
