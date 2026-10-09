"use client"

import Link from "next/link"
import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowUp, Check, Copy, History, Inbox, Library, Plus, Search, Square, Trash } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Vazio } from "@/components/ui/basicos"
import { Janela } from "@/components/ui/janela"
import { CHAVE_PROMPT, Markdown } from "@/components/markdown"
import { novoId, useAtualizar, useCriar, useExcluir } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import { cn, contem, dataRelativa } from "@/lib/utils"
import { infoProvedor, type Provedor } from "@/lib/ia/info"
import { credencial, provedoresAtivos, useConfigIA } from "@/lib/ia/chaves-locais"
import { camposDoPrompt, preencherPrompt, usePromptsBiblioteca } from "@/features/paginas/prompts"
import { SECAO_CONVERSAS, conversaParaTexto, textoParaConversa, tituloDaConversa, useConversas, type Mensagem } from "./conversas"

/** Começo da mensagem que o servidor manda quando a resposta falha. */
const MARCA_ERRO = "[Não foi possível"

const SUGESTOES = [
  "Me ajude a planejar minha semana a partir das minhas prioridades.",
  "Crie 10 ideias de Reels sobre produtividade para quem estuda para concursos.",
  "Resuma em tópicos o que eu preciso saber sobre [TEMA].",
  "Monte um plano de estudos de 4 semanas para [DISCIPLINA].",
]

/* ------------------------------------------------------------------ */
/* Escolher um prompt da biblioteca                                    */
/* ------------------------------------------------------------------ */

function EscolherPrompt({ aberta, aoMudar, aoEscolher }: { aberta: boolean; aoMudar: (v: boolean) => void; aoEscolher: (texto: string) => void }) {
  const { prompts, isLoading } = usePromptsBiblioteca(aberta)
  const [busca, setBusca] = React.useState("")
  const lista = prompts.filter((p) => !busca || contem(`${p.pagina} ${p.titulo} ${p.texto}`, busca)).slice(0, 80)
  return (
    <Janela aberta={aberta} aoMudar={aoMudar} titulo="Prompts da biblioteca" largura="lg">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por assunto, página ou palavra"
          aria-label="Buscar prompt"
          className="h-10 w-full rounded-md border border-line-strong bg-surface pl-8 pr-3 text-sm placeholder:text-ink-3 focus-visible:border-pen focus-visible:outline-none"
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
                className="w-full rounded-lg border border-line bg-surface p-3 text-left hover:border-pen"
              >
                <span className="block text-xs text-ink-3">{[p.modulo !== p.pagina ? p.modulo : "", p.pagina].filter(Boolean).join(" › ")}</span>
                {p.titulo ? <span className="mt-0.5 block text-sm font-medium">{p.titulo}</span> : null}
                <span className="mt-1 line-clamp-3 block font-mono text-xs leading-relaxed text-ink-2">{p.texto}</span>
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

function ListaConversas({ atual, aoAbrir, aoNova }: { atual: string | null; aoAbrir: (id: string) => void; aoNova: () => void }) {
  const { data: conversas = [] } = useConversas()
  const excluir = useExcluir("pages")
  return (
    <div>
      <Botao variante="contorno" className="mb-3 w-full justify-start" onClick={aoNova}>
        <Plus /> Nova conversa
      </Botao>
      {conversas.length === 0 ? (
        <p className="px-1 text-sm text-ink-3">As conversas ficam salvas aqui.</p>
      ) : (
        <ul className="grid gap-0.5">
          {conversas.map((c) => (
            <li key={c.id} className="group flex min-w-0 items-center">
              <button
                type="button"
                onClick={() => aoAbrir(c.id)}
                aria-current={c.id === atual ? "true" : undefined}
                className={cn("min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2", c.id === atual && "bg-surface-2 font-medium")}
              >
                <span className="block truncate">{c.title}</span>
                <span className="block text-xs font-normal text-ink-3 first-letter:uppercase">{dataRelativa(c.updated_at.slice(0, 10))}</span>
              </button>
              <button
                type="button"
                aria-label={`Excluir conversa ${c.title}`}
                onClick={() => {
                  excluir.mutate(c.id)
                  if (c.id === atual) aoNova()
                }}
                className="rounded p-1.5 text-ink-3 opacity-0 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
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
  const estilo = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-ink"
  return (
    <div className="mt-2 flex gap-1">
      <button
        type="button"
        className={estilo}
        onClick={async () => {
          await navigator.clipboard.writeText(texto)
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
        {salvo ? <Check className="size-3.5" /> : <Inbox className="size-3.5" />} {salvo ? "Na Caixa de Entrada" : "Guardar na Caixa de Entrada"}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export function PaginaAssistente() {
  const { data: status } = useQuery({
    queryKey: ["ia-status"],
    queryFn: async () => (await fetch("/api/ia")).json() as Promise<{ vercel: boolean }>,
    staleTime: Infinity,
  })
  const cfgIA = useConfigIA()
  const ativos = provedoresAtivos(cfgIA)
  const opcoesIA: Provedor[] = status?.vercel && !ativos.includes("anthropic") ? [...ativos, "anthropic"] : ativos
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
    fim.current?.scrollIntoView({ block: "end" })
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
    const historico: Mensagem[] = [...mensagens, { role: "user", content: t }]
    setMensagens([...historico, { role: "assistant", content: "" }])
    setTexto("")
    setCampos({})
    setRespondendo(true)
    const ctrl = new AbortController()
    abortar.current = ctrl
    let acumulado = ""
    const cred = provedor ? credencial(cfgIA, provedor) : null
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

  if (status && !opcoesIA.length) {
    return (
      <div>
        <Cabecalho area="conteudo" titulo="Assistente" />
        <Vazio
          titulo="Nenhuma IA ligada neste navegador."
          descricao="Cadastre a chave de API do Claude, do ChatGPT ou do Gemini em Configurações. A chave fica guardada só neste navegador, e o uso é cobrado pela empresa da IA conforme o consumo."
          acao={
            <Link href="/configuracoes#ia" className="text-sm font-medium text-pen hover:underline">
              Abrir Configurações
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-8">
      <div className="flex min-h-[calc(100dvh-12rem)] min-w-0 flex-col">
        <Cabecalho
          area="conteudo"
          titulo="Assistente"
          descricao={
            <>
              Converse com a IA ou use um prompt da <Link href="/conteudo/biblioteca" className="text-pen hover:underline">biblioteca</Link>. As conversas ficam salvas.
            </>
          }
          acoes={
            <div className="flex gap-2 lg:hidden">
              <Botao variante="contorno" tamanho="icone" aria-label="Conversas salvas" onClick={() => setVerHistorico(true)}>
                <History />
              </Botao>
              {mensagens.length ? (
                <Botao variante="contorno" tamanho="icone" aria-label="Nova conversa" onClick={nova}>
                  <Plus />
                </Botao>
              ) : null}
            </div>
          }
        />

        <div className="flex-1">
          {mensagens.length === 0 ? (
            <div className="max-w-3xl">
              <p className="mb-3 text-sm text-ink-2">Para começar:</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {SUGESTOES.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => usarTexto(s)} className="h-full w-full rounded-lg border border-line bg-surface p-3 text-left text-sm text-ink-2 hover:border-line-strong hover:text-ink">
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ol className="grid max-w-3xl gap-6">
              {mensagens.map((m, i) => (
                <li key={i} className={cn(m.role === "user" ? "ml-auto max-w-[85%] rounded-xl bg-pen-soft px-4 py-3" : "")}>
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap text-[15px]">{m.content}</p>
                  ) : m.content ? (
                    <>
                      <Markdown texto={m.content} />
                      {!(respondendo && i === mensagens.length - 1) && !m.content.trimStart().startsWith(MARCA_ERRO) && !m.content.startsWith("Não foi possível") ? <AcoesResposta texto={m.content} pergunta={mensagens[i - 1]?.content ?? ""} /> : null}
                    </>
                  ) : (
                    <p className="text-sm text-ink-3">Pensando…</p>
                  )}
                </li>
              ))}
            </ol>
          )}
          <div ref={fim} />
        </div>

        <form onSubmit={enviar} className="sticky bottom-24 mt-6 max-w-3xl lg:bottom-6">
          <div className="rounded-xl border border-line-strong bg-surface p-2 shadow-overlay">
            {listaCampos.length ? (
              <fieldset className="mb-2 grid gap-2 border-b border-line px-1 pb-3 sm:grid-cols-2">
                <legend className="mb-1.5 px-1 text-xs font-medium text-ink-3">Preencha o prompt</legend>
                {listaCampos.map((c) => (
                  <label key={c} className="grid gap-1 text-xs text-ink-2">
                    <span className="font-mono">{c}</span>
                    <input
                      value={campos[c] ?? ""}
                      onChange={(e) => setCampos((v) => ({ ...v, [c]: e.target.value }))}
                      className="h-8 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink focus-visible:border-pen focus-visible:outline-none"
                    />
                  </label>
                ))}
              </fieldset>
            ) : null}
            <div className="flex items-end gap-2">
              <Botao type="button" variante="fantasma" tamanho="icone" aria-label="Escolher prompt da biblioteca" title="Prompts da biblioteca" onClick={() => setVerPrompts(true)}>
                <Library />
              </Botao>
              {opcoesIA.length > 1 ? (
                <select
                  value={provedor}
                  onChange={(e) => setEscolhida(e.target.value as Provedor)}
                  aria-label="IA usada"
                  className="h-9 max-w-28 shrink-0 rounded-md border border-line bg-surface-2 px-1.5 text-xs text-ink-2"
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
                placeholder="Pergunte qualquer coisa"
                aria-label="Mensagem para o assistente"
                className="max-h-60 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-ink-3"
              />
              {respondendo ? (
                <Botao variante="secundario" tamanho="icone" aria-label="Parar" onClick={() => abortar.current?.abort()}>
                  <Square />
                </Botao>
              ) : (
                <Botao type="submit" variante="primario" tamanho="icone" aria-label="Enviar" disabled={!texto.trim()}>
                  <ArrowUp />
                </Botao>
              )}
            </div>
          </div>
        </form>
      </div>

      <aside aria-label="Conversas salvas" className="hidden min-w-0 lg:block">
        <div className="sticky top-6">
          <ListaConversas atual={conversaId} aoAbrir={abrir} aoNova={nova} />
        </div>
      </aside>

      <Janela aberta={verHistorico} aoMudar={setVerHistorico} titulo="Conversas">
        <ListaConversas atual={conversaId} aoAbrir={abrir} aoNova={nova} />
      </Janela>
      <EscolherPrompt aberta={verPrompts} aoMudar={setVerPrompts} aoEscolher={usarTexto} />
    </div>
  )
}
