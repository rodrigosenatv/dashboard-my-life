"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import * as React from "react"
import { PenLine, Star } from "lucide-react"
import { toast } from "sonner"
import type { Json } from "@/lib/supabase/database.types"
import { Botao } from "@/components/ui/button"
import { Secao } from "@/components/ui/basicos"
import { AreaTexto } from "@/components/ui/campos"
import type { Colecao } from "@/features/colecoes/visao-colecao"
import { cn, isoDia } from "@/lib/utils"
import { useGravarPessoal } from "./dados"
import {
  cabecalhoDoDia,
  type EntradaDiario,
  entradaDeHoje,
  linkDoItem,
  nesteDia,
  resumoDoTexto,
  rotuloDoDia,
  TAG_DIARIO,
  TAG_ESPECIAL,
  textoHaAnos,
  tituloDoDia,
} from "./logica"

/* O rascunho de uma entrada nova fica no navegador: se a página fechar antes de guardar, o texto volta. */
const chaveRascunho = (dia: string) => `diario:rascunho:${dia}`

function lerRascunho(dia: string): string {
  try {
    return localStorage.getItem(chaveRascunho(dia)) ?? ""
  } catch {
    return ""
  }
}

function guardarRascunho(dia: string, t: string) {
  try {
    if (t.trim()) localStorage.setItem(chaveRascunho(dia), t)
    else localStorage.removeItem(chaveRascunho(dia))
  } catch {
    // Sem armazenamento (janela privada, por exemplo): só não há rascunho
  }
}

function apagarRascunho(dia: string) {
  try {
    localStorage.removeItem(chaveRascunho(dia))
  } catch {
    // Nada a apagar
  }
}

/** O diário: escrever o dia de hoje, ver o que já foi escrito e as entradas de dias anteriores. */
export function CartaoDiario({ entradas, colecao }: { entradas: EntradaDiario[]; colecao: Colecao | undefined }) {
  const gravar = useGravarPessoal()
  const hoje = isoDia()
  const deHoje = React.useMemo(() => entradaDeHoje(entradas, hoje), [entradas, hoje])
  const recentes = React.useMemo(() => entradas.filter((e) => e.id !== deHoje?.id).slice(0, 4), [entradas, deHoje])
  const neste = React.useMemo(() => nesteDia(entradas, hoje)[0], [entradas, hoje])

  const [continuando, setContinuando] = React.useState(false)
  const [texto, setTexto] = React.useState("")
  const [especial, setEspecial] = React.useState(false)
  const [salvando, setSalvando] = React.useState(false)
  // Sem entrada de hoje, a caixa começa com o rascunho deixado para trás
  React.useEffect(() => {
    if (!deHoje) setTexto(lerRascunho(hoje))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const escrevendo = !deHoje || continuando

  const continuar = () => {
    if (!deHoje) return
    setTexto(deHoje.texto)
    setEspecial(deHoje.especial)
    setContinuando(true)
  }

  const cancelar = () => {
    setContinuando(false)
    setTexto("")
    setEspecial(false)
  }

  const guardar = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const t = texto.trim()
    if (!t || salvando) return
    setSalvando(true)
    const tags = especial ? TAG_ESPECIAL : TAG_DIARIO
    try {
      if (deHoje) {
        await gravar.mudar(deHoje.item, (atual) => ({ content: t, props: { ...((atual.props ?? {}) as Record<string, Json>), Tags: tags } }), "diario")
        toast.success("Diário atualizado")
        setContinuando(false)
      } else {
        await gravar.criar("diario", { title: tituloDoDia(hoje), props: { Data: hoje, Tags: tags }, content: t })
        toast.success("Guardado no diário")
        apagarRascunho(hoje)
      }
      setTexto("")
      setEspecial(false)
    } catch {
      // Quem grava já avisou o que deu errado
    }
    setSalvando(false)
  }

  return (
    <Secao
      titulo="Diário"
      acao={
        colecao ? (
          <Botao asChild variante="fantasma" tamanho="sm">
            <Link href={`/colecoes/${colecao.id}`}>Ver tudo</Link>
          </Botao>
        ) : undefined
      }
    >
      <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <p className="text-sm font-medium text-ink-2">{cabecalhoDoDia(hoje)}</p>

        {escrevendo ? (
          <form onSubmit={guardar} className="mt-2">
            <AreaTexto
              aria-label="Como foi o seu dia?"
              placeholder="Como foi o seu dia?"
              rows={5}
              className="min-h-32"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value)
                if (!deHoje) guardarRascunho(hoje, e.target.value)
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault()
                  void guardar()
                }
              }}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                aria-pressed={especial}
                onClick={() => setEspecial((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors toque:min-h-11",
                  especial ? "border-pen bg-pen/15 text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
                )}
              >
                <Star className={cn("size-3.5", especial && "fill-current")} aria-hidden />
                Ocasião especial
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {continuando ? (
                  <Botao variante="fantasma" tamanho="sm" onClick={cancelar} disabled={salvando}>
                    Cancelar
                  </Botao>
                ) : null}
                <Botao variante="primario" tamanho="sm" type="submit" disabled={!texto.trim() || salvando}>
                  Guardar no diário
                </Botao>
              </div>
            </div>
          </form>
        ) : (
          <div className="mt-2">
            {deHoje.titulo || deHoje.especial ? (
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                {deHoje.titulo ? <p className="min-w-0 font-semibold">{deHoje.titulo}</p> : null}
                {deHoje.especial ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-pen-soft px-2 py-0.5 text-xs font-medium text-pen">
                    <Star aria-hidden className="size-3 fill-current" /> Ocasião especial
                  </span>
                ) : null}
              </div>
            ) : null}
            <p className="line-clamp-6 text-[15px] leading-relaxed">
              {resumoDoTexto(deHoje.texto, 600) || <span className="text-ink-3">Sem texto</span>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Botao variante="contorno" tamanho="sm" onClick={continuar}>
                <PenLine /> Continuar escrevendo
              </Botao>
              <Botao asChild variante="fantasma" tamanho="sm">
                <Link href={linkDoItem(deHoje.id)}>Abrir</Link>
              </Botao>
            </div>
          </div>
        )}

        {recentes.length ? (
          <section aria-label="Últimos dias" className="mt-5 border-t border-line pt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-ink-3">Últimos dias</h3>
            <ul className="mt-2 grid gap-1">
              {recentes.map((e) => {
                const resumo = resumoDoTexto(e.texto)
                return (
                  <li key={e.id}>
                    <Link href={linkDoItem(e.id)} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2 toque:min-h-11">
                      <span className="w-24 shrink-0 pt-0.5 text-xs text-ink-3">{rotuloDoDia(e.data, hoje)}</span>
                      <span className="line-clamp-2 min-w-0 flex-1 text-sm">
                        {e.titulo ? <span className="font-medium">{resumo ? `${e.titulo} · ` : e.titulo}</span> : null}
                        {resumo || (!e.titulo ? <span className="text-ink-3">Sem texto</span> : null)}
                      </span>
                      {e.especial ? <Star role="img" aria-label="Ocasião especial" className="mt-0.5 size-3.5 shrink-0 fill-current text-pen" /> : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        {neste ? (
          // O quadro inteiro é o link: no celular, o alvo do dedo fica do tamanho do quadro
          <Link href={linkDoItem(neste.entrada.id)} className="group mt-4 block rounded-lg bg-pen-soft px-3 py-2.5">
            <span className="block text-xs font-medium text-pen">{textoHaAnos(neste.anos)}</span>
            <span className="mt-0.5 line-clamp-2 block text-sm group-hover:underline">
              {resumoDoTexto(neste.entrada.texto, 160) || neste.entrada.titulo || "Ver a entrada"}
            </span>
          </Link>
        ) : null}
      </div>
    </Secao>
  )
}
