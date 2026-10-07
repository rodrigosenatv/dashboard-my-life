"use client"

import Link from "next/link"
import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowUp, RotateCcw, Square } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Vazio } from "@/components/ui/basicos"
import { CHAVE_PROMPT, Markdown } from "@/components/markdown"
import { cn } from "@/lib/utils"

type Mensagem = { role: "user" | "assistant"; content: string }
const CHAVE_CONVERSA = "dml-conversa"

export function PaginaAssistente() {
  const { data: status } = useQuery({
    queryKey: ["ia-status"],
    queryFn: async () => (await fetch("/api/ia")).json() as Promise<{ disponivel: boolean; modelo: string }>,
    staleTime: Infinity,
  })
  const [mensagens, setMensagens] = React.useState<Mensagem[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(CHAVE_CONVERSA) ?? "[]")
    } catch {
      return []
    }
  })
  const [texto, setTexto] = React.useState(() => {
    try {
      const p = sessionStorage.getItem(CHAVE_PROMPT)
      if (p) sessionStorage.removeItem(CHAVE_PROMPT)
      return p ?? ""
    } catch {
      return ""
    }
  })
  const [respondendo, setRespondendo] = React.useState(false)
  const abortar = React.useRef<AbortController | null>(null)
  const fim = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE_CONVERSA, JSON.stringify(mensagens))
    } catch {}
    fim.current?.scrollIntoView({ block: "end" })
  }, [mensagens])

  const enviar = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const t = texto.trim()
    if (!t || respondendo) return
    const historico: Mensagem[] = [...mensagens, { role: "user", content: t }]
    setMensagens([...historico, { role: "assistant", content: "" }])
    setTexto("")
    setRespondendo(true)
    const ctrl = new AbortController()
    abortar.current = ctrl
    try {
      const r = await fetch("/api/ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensagens: historico }), signal: ctrl.signal })
      if (!r.ok || !r.body) {
        const corpo = await r.json().catch(() => ({}))
        throw new Error(corpo.erro ?? `Erro ${r.status}`)
      }
      const leitor = r.body.getReader()
      const dec = new TextDecoder()
      let acumulado = ""
      for (;;) {
        const { done, value } = await leitor.read()
        if (done) break
        acumulado += dec.decode(value, { stream: true })
        setMensagens([...historico, { role: "assistant", content: acumulado }])
      }
    } catch (erro) {
      if ((erro as Error).name !== "AbortError") {
        setMensagens([...historico, { role: "assistant", content: `Não foi possível responder: ${(erro as Error).message}` }])
      }
    } finally {
      setRespondendo(false)
      abortar.current = null
    }
  }

  if (status && !status.disponivel) {
    return (
      <div>
        <Cabecalho area="conteudo" titulo="Assistente" />
        <Vazio
          titulo="O assistente ainda não está ligado."
          descricao="Para usar a IA dentro do app, crie uma chave de API no Claude Console e adicione-a na Vercel como ANTHROPIC_API_KEY. O uso é cobrado pela Anthropic conforme o consumo."
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col">
      <Cabecalho
        area="conteudo"
        titulo="Assistente"
        descricao={
          <>
            Converse com o Claude ou mande um prompt da <Link href="/conteudo/biblioteca" className="text-pen hover:underline">biblioteca</Link>.
          </>
        }
        acoes={
          mensagens.length ? (
            <Botao variante="fantasma" onClick={() => setMensagens([])}>
              <RotateCcw /> Nova conversa
            </Botao>
          ) : null
        }
      />

      <div className="flex-1">
        {mensagens.length === 0 ? (
          <p className="max-w-xl text-ink-2">Escreva uma pergunta abaixo. A conversa fica só nesta aba e some ao fechar.</p>
        ) : (
          <ol className="grid max-w-3xl gap-6">
            {mensagens.map((m, i) => (
              <li key={i} className={cn(m.role === "user" ? "ml-auto max-w-[85%] rounded-xl bg-pen-soft px-4 py-3" : "")}>
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap text-[15px]">{m.content}</p>
                ) : m.content ? (
                  <Markdown texto={m.content} />
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
        <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface p-2 shadow-overlay">
          <textarea
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
      </form>
    </div>
  )
}
